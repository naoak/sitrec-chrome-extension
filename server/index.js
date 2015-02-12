var Q = require('q');
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
app.use('/api', api(DATA_DIR));

app.engine('hbs', exphbs({extname: 'hbs', defaultLayout: 'main'}));
app.set('view engine', 'hbs');

function endsWith(text, suffix) {
  return text.indexOf(suffix, text.length - suffix.length) !== -1;
}

function walk(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) {
      return done(err);
    }
    var pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    list.forEach(function(file) {
      file = path.join(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) {
              done(null, results);
            }
          });
        }
        else {
          results.push(file);
          if (!--pending) {
            done(null, results);
          }
        }
      });
    });
  });
};

function enumerateAlbumDirs(baseDir) {
  var d = Q.defer();
  walk(baseDir, function(err, files) {
    if (err) {
      d.reject(err);
      return;
    }
    var albums = files.filter(function(file) {
      return path.basename(file) == 'dev.har';
    }).map(function(file) {
      return path.dirname(file);
    });
    albumDirs = albums;
    albumDirs.sort(function(l, r) {
      return path.basename(l).localeCompare(path.basename(r));
    });
    d.resolve(albumDirs);
  });
  return d.promise;
}

function enumerateFrames(albumDir) {
  var d = Q.defer();
  fs.readdir(albumDir, function(err, list) {
    if (err) {
      d.reject(err);
      return;
    }
    var ext = '.jpeg';
    var images = list.filter(function(file) {
      return endsWith(file, ext);
    });
    var images = images.map(function(file) {
      return {
        ms: parseInt(file.slice(0, -ext.length), 10),
        path: '/' + path.relative(publicDir, path.join(albumDir, file))
      };
    });
    images.sort(function(l, r) {
      return l.ms - r.ms;
    });
    d.resolve(images);
  });
  return d.promise;
}

function getAlbumDirs() {
  var d = Q.defer();
  if (albumDirs) {
    d.resolve(albumDirs);
  }
  else {
    return enumerateAlbumDirs(DATA_DIR);
  }
  return d.promise;
}

app.get('/', function(req, res) {
  getAlbumDirs().then(function(dirs) {
    var albumNames = dirs.map(function(dir) {
      return path.basename(dir);
    });
    res.render('home', {albums: albumNames});
  }).fail(function(err) {
    res.render('home', {albums: []});
  });
});

app.get('/album', function(req, res) {
  getAlbumDirs().then(function(albumDirs) {
    Q.all(albumDirs.map(enumerateFrames)).then(function(imagesList) {
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
  getAlbumDirs().then(function(albumDirs) {
    var names = albumDirs.map(function(dir) {
      return path.basename(dir);
    });
    var idx;
    var dir;
    idx = names.indexOf(albumName);
    if (idx > -1) {
      dir = albumDirs[idx];
      enumerateFrames(dir).then(function(images) {
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
