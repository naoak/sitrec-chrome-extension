var PROTOCOL = 'http';
var DOMAIN = 'localhost:11080'
var CREATE_ALBUM_URL = PROTOCOL + '://' + DOMAIN + '/api/album/create';
var LIST_ALBUM_URL = PROTOCOL + '://' + DOMAIN + '/api/album/list';
var CREATE_PHOTO_URL = PROTOCOL + '://' + DOMAIN + '/api/photo/create/{{albumName}}/{{photoName}}';
var CREATE_HAR_URL = PROTOCOL + '://' + DOMAIN + '/api/har/create/{{albumName}}';

function getOrCreateAlbum(albumName, callback) {
  getAlbum(albumName, function(album) {
    if (album) {
      callback(album);
    }
    else {
      createAlbum(albumName, function(album) {
        callback(album);
      });
    }
  });
}

function createAlbum(albumName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', CREATE_ALBUM_URL, true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = JSON.parse(xhr.responseText);
      if (callback) {
        callback(data);
      }
    }
  };
  xhr.send(JSON.stringify({name: '' + albumName}));
}

function getAlbum(albumName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', LIST_ALBUM_URL, true);
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = JSON.parse(xhr.responseText);
      var albums = data.items;
      for (var i = 0; i < albums.length; i++) {
        var album = albums[i];
        if (album.name == albumName) {
          callback(album);
          return;
        }
      }
      callback();
    }
  };
  xhr.send();
}

function uploadPhoto(albumName, photoName, dataURI, callback, progressCallback) {
  var url = CREATE_PHOTO_URL.replace('{{albumName}}', albumName).replace('{{photoName}}', photoName);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.onload = function(e) {
    if (this.status == 201) {
      var data = JSON.parse(xhr.responseText);
      callback({size: data.size});
    }
  };
  if (progressCallback) {
    xhr.upload.onprogress = function(e) {
      console.log('progress', e.lengthComputable, e.loaded, e.total);
      if (e.lengthComputable) {
        progressCallback(e.loaded, e.total);
      }
    };
  }
  xhr.send(JSON.stringify({
    dataURI: dataURI
  }));
}

function uploadHar(albumName, harLog, callback) {
  var url = CREATE_HAR_URL.replace('{{albumName}}', albumName);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.onload = function(e) {
    if (this.status == 201) {
      var data = JSON.parse(xhr.responseText);
      callback({size: data.size});
    }
  };
  xhr.send(JSON.stringify({
    har: harLog
  }));
}
