var CREATE_ALBUM_PATH = '/api/album/create';
var LIST_ALBUM_PATH = '/api/album/list';
var CREATE_PHOTO_PATH = '/api/photo/create/{{albumName}}/{{photoName}}';
var CREATE_HAR_PATH = '/api/har/create/{{albumName}}';

function getOrCreateAlbum(server, albumName, callback) {
  getAlbum(server, albumName, function(album) {
    if (album) {
      callback(album);
    }
    else {
      createAlbum(server, albumName, function(album) {
        callback(album);
      });
    }
  });
}

function createAlbum(server, albumName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', server + CREATE_ALBUM_PATH, true);
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

function getAlbum(server, albumName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', server + LIST_ALBUM_PATH, true);
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

function uploadPhoto(server, albumName, photoName, dataURI, callback, progressCallback) {
  var url = server + CREATE_PHOTO_PATH.replace('{{albumName}}', albumName).replace('{{photoName}}', photoName);
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

function uploadHar(server, albumName, harLog, callback) {
  var url = server + CREATE_HAR_PATH.replace('{{albumName}}', albumName);
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
