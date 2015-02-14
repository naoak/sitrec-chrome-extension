var fs = require('fs');
var path = require('path');
var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var api = require('./api');
var serveStatic = require('serve-static');
var serveIndex = require('serve-index');
var app = express();
var albumDirs;
var publicDir = path.join(__dirname, 'public');

var DATA_DIR = path.join('public', 'screenshots');

app.use(bodyParser.json({limit: '50mb'}));
app.use('/api', api.server(DATA_DIR));

app.engine('hbs', exphbs({extname: 'hbs', defaultLayout: 'main'}));
app.set('view engine', 'hbs');

function endsWith(text, suffix) {
  return text.indexOf(suffix, text.length - suffix.length) !== -1;
}

app.get('/', function(req, res) {
  api.getAlbumDirs().then(function(dirs) {
    var albumNames = dirs.map(function(dir) {
      return path.basename(dir);
    });
    res.render('home', {albums: albumNames});
  }).fail(function(err) {
    res.render('home', {albums: []});
  });
});

app.get('/album', function(req, res) {
  api.getAlbumDirs().then(function(albumDirs) {
    Q.all(albumDirs.map(api.enumerateFrames)).then(function(imagesList) {
      var albums = imagesList.map(function(images) {
        return {
          name: path.basename(path.dirname(images[0].path)),
          images: images
        };
      });
      res.render('albums', {
        albums: albums
      });
    });
  });
});

app.get('/album/:albumName', function(req, res) {
  var albumName = req.params.albumName;
  api.getAlbumDirs().then(function(albumDirs) {
    var names = albumDirs.map(function(dir) {
      return path.basename(dir);
    });
    var idx;
    var dir;
    idx = names.indexOf(albumName);
    if (idx > -1) {
      dir = albumDirs[idx];
      api.enumerateFrames(dir).then(function(images) {
        res.render('album', {
          name: path.basename(path.dirname(images[0].path)),
          images: images
        });
      });
    }
    else {
      res.render('album', {});
    }
  });
});

app.use('/', serveStatic(publicDir));
app.use('/', serveIndex(publicDir));

app.listen(8080);
