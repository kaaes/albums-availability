var SpotifyApi = {

  sendRequest: function(url, callback) {

    var accessToken = Config.getValidToken()
    if (accessToken == null) {
      var error = 'unauthorised';
      callback(error);
      return;
    }

    d3.json(url)
    .header('Authorization', 'Bearer ' + accessToken)
    .get(callback);
  }
}