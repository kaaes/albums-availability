google.load("visualization", "1", {packages:["geochart"]});
google.setOnLoadCallback(onGoogleLoaded);

function onGoogleLoaded() {

  var ALL_MARKETS = {"AD":"Andorra","AR":"Argentina","AU":"Australia","AT":"Austria","BE":"Belgium","BO":"Bolivia","BR":"Brazil","BG":"Bulgaria","CA":"Canada","CL":"Chile","CO":"Colombia","CR":"Costa Rica","CY":"Cyprus","CZ":"Czech Republic","DK":"Denmark","DO":"Dominican Republic","EC":"Ecuador","SV":"El Salvador","EE":"Estonia","FI":"Finland","FR":"France","DE":"Germany","GR":"Greece","GT":"Guatemala","HN":"Honduras","HK":"Hong Kong","HU":"Hungary","IS":"Iceland","IE":"Republic of Ireland","IT":"Italy","LV":"Latvia","LI":"Liechtenstein","LT":"Lithuania","LU":"Luxembourg","MY":"Malaysia","MT":"Malta","MX":"Mexico","MC":"Monaco","NL":"Netherlands","NZ":"New Zealand","NI":"Nicaragua","NO":"Norway","PA":"Panama","PY":"Paraguay","PE":"Peru","PH":"Philippines","PL":"Poland","PT":"Portugal","RO":"Romania","ES":"Spain","SG":"Singapore","SK":"Slovakia","SI":"Slovenia","SE":"Sweden","CH":"Switzerland","TW":"Taiwan","TR":"Turkey","GB":"United Kingdom","US":"United States","UY":"Uruguay"};
  var SPOTIFY_API = 'https://api.spotify.com/v1';

  var HIGHLIGHT_TIMEOUT = 100;

  var chart;
  
  var chartContainer = document.querySelector('#regions-map');
  var searchForm = document.querySelector('#search-form');
  var albumInfoBig = document.querySelector('#data-info');
  var infoContainer = document.querySelector('#regions-info');
  var exactSearchButton = document.querySelector('#exact-search-button');

  var albumInfoBigTemplate = document.querySelector('#template-album-info-big').innerHTML;
  var albumNotAvailableTemplate = document.querySelector('#template-album-not-available').innerHTML;
  var albumNotFoundTemplate = document.querySelector('#template-album-not-found').innerHTML;

  document.body.addEventListener('drop', handleDrop, false);
  document.body.addEventListener('dragover', handleDragOver, false);

  var timeoutHandler;
  infoContainer.addEventListener('mouseover', handleMouseover);
  infoContainer.addEventListener('mouseout', handleMouseout);

  exactSearchButton.checked = !getExactSearchEnabled();
  exactSearchButton.addEventListener('change', handleExactChange);
  searchForm.addEventListener('submit', handleFormSubmit);

  function handleFormSubmit(evt) {
    evt.preventDefault();
    var searchValue = evt.target[0].value;
    var uri = parseUri(searchValue);
    validateAndPerformSearch(uri);
  }

  function handleExactChange(evt) {
    setExactSearchEnabled(!evt.target.checked);
    var lastSearch = getLastSearch();
    if (lastSearch) {
      performSearch(lastSearch);
    }
  }

  function handleMouseover(evt) {
    clearTimeout(timeoutHandler);
    var self = this;
    timeoutHandler = setTimeout(function() {
      var path = evt.path;
      var current = self.dataset.active;
      for(var i = 0; i < path.length; i++) {
        if (path[i].dataset && path[i].dataset.albumid) {
          if (path[i].dataset.albumid != current) {
            current = path[i].dataset.albumid;
            self.dataset.active = current;
            highlight(current);
          }
          return;
        }
      }
      highlight(null);
      self.active = null;
    }, HIGHLIGHT_TIMEOUT);
  }

  function handleMouseout(evt) {
    clearTimeout(timeoutHandler);
    var self = this;
    timeoutHandler = setTimeout(function() {
      self.dataset.active = null;
      highlight(null);
    }, HIGHLIGHT_TIMEOUT);
  }

  function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var url = evt.dataTransfer.getData('text/plain');
    if (!url) return;
    if (url.indexOf('http://open.spotify.com/') > -1) {
      var parsed = parseUri(url.replace('http://open.spotify.com/', 'spotify/'), '/');
    } else {
      var parsed = parseUri(url);
    }

    validateAndPerformSearch(parsed);

    return false;
  }

  function parseUri(uri, delimiter) {
    var segments = uri.split(delimiter || ':');
    var id, type;
    if (segments[1] === 'user') {
      type = segments[3];
      id = segments[2] + ':' + segments[4];
    } else if (segments[1] === 'album') {
      type = segments[1];
      id = segments[2];
    }
    return {type: type, id: id};
  }

  function validateAndPerformSearch(parsedUri) {
    if (parsedUri.type == 'album') {
      document.body.classList.remove('invalid-search');
      performSearch(parsedUri.id);
    } else {
      document.body.classList.add('invalid-search');
      drawChart([]);
      albumInfoBig.innerHTML = '';
      infoContainer.innerHTML = '';
    }
  }

  function performSearch(id) {
    setLastSearch(id);
    infoContainer.innerHTML = '';
    
    d3.json(SPOTIFY_API + '/albums/' + id, function(error, album) {
      if (error) {
        console.error(error);
        return;
      }

      fillInfo(album);

      function albumsCallback(result, next) {
        if (next) {
          getAlbums(next, album.name, albumsCallback, result);
        } else {
          fillInfoData(result, album);
          fillChartData(result);
        }
      }

      var uri = SPOTIFY_API + '/artists/' + album.artists[0].id + '/albums?album_type=' + album.album_type;
      getAlbums(uri, album.name, albumsCallback, { markets: [], ids: [], count: {} });
    });
  }

  function getAlbums(uri, albumName, callback, result) {
    d3.json(uri, function(error, albums) {
      albums.items.forEach(function(el) {
        var condition = getExactSearchEnabled() ? 
          el.name == albumName : el.name.indexOf(albumName) == 0 || albumName.indexOf(el.name) == 0
        if (condition) {
          result.markets.push(el.available_markets || []);
          result.ids.push(el.id);
          if (el.available_markets) {
            el.available_markets.forEach(function(market) {
              result.count[market] = result.count[market] || 0;
              result.count[market]++;
            });
          }
        }
      });

      callback(result, albums.next);
    });
  }

  function fillInfo(info) {
    var data = {
      albumTitle: info.name,
      albumType: info.album_type,
      artistName: info.artists.map(function(el) { return el.name; }).join(', ')
    }
    var rendered = Mustache.render(albumInfoBigTemplate, data);
    albumInfoBig.innerHTML = rendered;
  }

  var currentDataset;

  function highlight(id) {
    if (currentDataset) {
      var markets = [];
      var dataset = currentDataset.map(function(el) {
        var row = el.slice(0);
        row.spid = el.spid;
        if (row.spid && row.spid == id) {
          markets.push(row[0])
          row[1] = 0.5;
        }
        return row;
      });
      drawChart(dataset.filter(function(el) {
        return markets.indexOf(el[0]) == -1 || el.spid == id;
      }));
    }
  }

  function getAlbumInfo(name, albums, id) {
    var fragment = document.createDocumentFragment();
    var title = document.createElement('h3');
    title.classList.add("row");
    title.classList.add("album-title");
    title.innerHTML = name;

    fragment.appendChild(title);
    
    albums.forEach(function(album) {
      var div = document.createElement('div');
      div.dataset.albumid = album.id;
      div.classList.add("album-info");
      div.classList.add("row");

      if (album.id == id) {
        div.classList.add("searched");
      }

      var explicit = false;
      for(var i = 0; i < album.tracks.items.length; i++) {
        if (album.tracks.items[i].explicit) {
          explicit = true;
          break;
        }
      }

      var copyrights = d3.map(album.copyrights, function(d) { return d.type });
      
      var html = '';
      html += '<a href="https://open.spotify.com/album/' + album.id + '">'
      html += '<img class="cover" src="' + album.images[2].url + '" alt="" />';
      html += '</a>';
      html += '<ul>';
      html += '<li><a href="https://open.spotify.com/album/' + album.id + '">';
      html += album.tracks.items.length + ' tracks on ' + album.tracks.items.pop().disc_number + ' discs';
      html += '</a></li>';
      html += '<li>' + album.album_type + ' &bull; ';
      html += album.release_date + '</li>';
      if (explicit) {
        html += '<li><span class="explicit">Explicit</span>&nbsp;</li>';
      }
      html += '</ul>';
      html += '<p>' + album.available_markets.map(function(el) {
        return '<span title="' + ALL_MARKETS[el] + '">' + el + '</span>';
      }).join(' ') + '</p>';
      html += '<p class="uri"><a href="https://api.spotify.com/v1/albums/' + album.id + '">' + album.uri+ '</a></p>';
      if (copyrights.get('C')) {
        html += '<p class="copyrights">&copy; ' + copyrights.get('C').text; + '</p>';
      }
      if (copyrights.get('P')) {
        html += '<p class="copyrights">&#8471; ' + copyrights.get('P').text + '</p>';
      }
      div.innerHTML = html;

      fragment.appendChild(div);
    });
    return fragment;
  }

  function fillInfoData(result, album) {
    var ids = result.ids;
    if (ids.length) {
      d3.json(SPOTIFY_API + '/albums?ids=' + ids, function(error, albums) {
        console.log("Full found albums", albums.albums);
        var nest = d3.nest()
          .key(function(d) { return d.name; })
          .sortKeys(function(a, b) {
            return a == album.name ? 1 : -1;
          })
          .sortValues(function(a, b){
            return a.id == album.id ? -1 : 1;
          })
          .entries(albums.albums);
        
        nest.forEach(function(el) {
          infoContainer.insertBefore(getAlbumInfo(el.key, el.values, album.id), infoContainer.firstChild);
        });

        var exactAlbumFound = infoContainer.querySelector(".searched");
        if (!exactAlbumFound) {
          var html = Mustache.render(albumNotFoundTemplate, {
            albumApiLink: album.href,
            albumUri: album.uri
          })
          infoContainer.innerHTML = html + infoContainer.innerHTML;
        }
      });
    }
  }

  function fillChartData(result) {
    var marketsList = result.markets;
    var ids = result.ids;
    var data = [];
    var allMarkets = Object.keys(ALL_MARKETS);

    marketsList.forEach(function(markets, i) {
      markets.forEach(function(market) {
        var index = allMarkets.indexOf(market);
        if (index > -1) {
          allMarkets.splice(allMarkets.indexOf(market), 1);
        }

        if (ALL_MARKETS[market]) {
          var el = [ALL_MARKETS[market], result.count[market], result.count[market] + ' versions available'];
          el.spid = ids[i];
          data.push(el);
        } else {
          console.log('Not in available markets', market);
        }
      });
    });

    if (allMarkets.length) {
      console.log("Not available in: " + allMarkets);
      var html = Mustache.render(albumNotAvailableTemplate, {
        markets: allMarkets.map(function(el) {
          return { code: el, name: ALL_MARKETS[el]}
        })
      });
      infoContainer.innerHTML = html;
    }

    allMarkets.forEach(function(market) {
      data.push([ALL_MARKETS[market], 0, 'Not available']);
    });

    console.log("Chart data", data);
    currentDataset = data;
    drawChart(data);
  }

  function drawChart(markets) {
    var chartData = new google.visualization.DataTable();
    chartData.addColumn('string', 'Country');
    chartData.addColumn('number', 'Available');
    chartData.addColumn({type: 'string', role: 'tooltip'});
    chartData.addRows(markets);

    var max = d3.max(currentDataset, function(el) { return el[1] });

    if (max < 1) max = 1;

    var options = {
      backgroundColor: 'transparent',
      datalessRegionColor: '#2e2f33',
      keepAspectRatio: true,
      colorAxis: {
        minValue: 0,
        colors: ['#8f2600', '#bdaa00', '#4B6601', '#B4D612'],
        values: [0, 0.5, 1, max]
      },
      legend: 'none',
      tooltip: {
        showColorCode: false
      },
      enableRegionInteractivity: true,
      animation: {
        duration: 1000,
        easing: 'out',
      }
    };

    chart.draw(chartData, options);
  }

  function getLastSearch() {
    return window.location.hash.substring(1) || localStorage.getItem('lastSearch');
  }

  function setLastSearch(id) {
    localStorage.setItem('lastSearch', id);
    window.location.hash = id;
  }

  function setExactSearchEnabled(mode) {
    localStorage.setItem('exactSearch', mode);
  }

  function getExactSearchEnabled() {
    return localStorage.getItem('exactSearch') === 'true';
  }

  chart = new google.visualization.GeoChart(chartContainer);
  
  performSearch(getLastSearch() || "18qY7zpuNqeXNGywRysjxx");
}