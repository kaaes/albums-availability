var Config = {
  setLastSearch: function(id) {
    localStorage.setItem('lastSearch', id);
    window.location.hash = id;
  },

  getLastSearch: function() {
    return window.location.hash.substring(1) || localStorage.getItem('lastSearch');
  },

  setExactSearch: function(useExact) {
    localStorage.setItem('exactSearch', mode);
  },

  getExactSearch: function() {
    return localStorage.getItem('exactSearch') === 'true';
  },

  getValidToken: function() {
    var expiresAt = parseInt(localStorage.getItem('token_expires_at'), 10);
    var token = localStorage.getItem('token');
    var now = Date.now();
    return !!token && !!expiresAt && expiresAt > now ? token : null;
  },

  setToken: function(accessToken) {
    localStorage.setItem('token', accessToken);
  },

  setExpiresAt: function(expiresIn) {
    var now = Date.now();
    var expiresAt = now + parseInt(expiresIn, 10) * 1000;
    localStorage.setItem('token_expires_at', expiresAt);
  }
}