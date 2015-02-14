var Q = require('q');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var path = require('path');
var express = require('express');
var app = express();

var albumDirs;
var publicDir = path.join(__dirname, 'public');
var DATA_DIR = path.join('public', 'screenshots');

module.exports = {
  server: server,
  getAlbumDirs: getAlbumDirs,
  enumerateFrames: enumerateFrames
};

function server(options) {
  DATA_DIR = (options && options.dataDir) || DATA_DIR;
  return app;
}

function decodeDataUri(dataUri) {
  var regex = /^data:.+\/(.+);base64,(.*)$/;
  var matches = dataUri.match(regex);
  var ext = matches[1];
  var data = matches[2];
  return {
    ext: ext,
    buffer: new Buffer(data, 'base64')
  };
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

function endsWith(text, suffix) {
  return text.indexOf(suffix, text.length - suffix.length) !== -1;
}

app.get('/album/list', function(req, res) {
  fs.readdir(DATA_DIR, function(err, dirs) {
    if (!err) {
      res.json({
        items: dirs.map(function(dir) {
          return {name: dir};
        })
      });
    }
    else {
      res.json({
        items: []
      });
    }
  });
});

app.post('/album/create', function(req, res) {
  var albumDir;
  var albumName = req.body && req.body.name;

  if (albumName) {
    albumDir = path.join(DATA_DIR, albumName);
    mkdirp(albumDir, function(err) {
      if (!err) {
        res.json({
          name: albumName
        });
      }
      else {
        res.status(500).send('Failed to create dir ' + albumName);
      }
    });
  }
  else {
    res.status(400).send('Must be specify an album name by json format such as {"name": "xxx"}.');
  }
});

app.post('/photo/create/:albumName/:photoName', function(req, res) {
  var albumName = req.params.albumName;
  var photoName = req.params.photoName;
  var dataURI = req.body.dataURI;
  var albumDir;

  if (albumName && photoName && dataURI) {
    albumDir = path.join(DATA_DIR, albumName);
    mkdirp(albumDir, function(err) {
      if (!err) {
        var data = decodeDataUri(dataURI);
        var photoPath = path.join(albumDir, photoName + '.' + data.ext);
        fs.writeFile(photoPath, data.buffer, function(err) {
          if (!err) {
            console.log(albumDir + '/' + photoName + ': ' + data.buffer.length + ' bytes');
            res.status(201).json({
              size: data.buffer.length
            });
          }
          else {
            res.status(500).send('Failed to save photo file ' + photoName + '.' + data.ext);
          }
        });
      }
      else {
        res.status(500).send('Failed to create dir ' + albumName);
      }
    });
  }
  else {
    res.status(400).send('Bad Request');
  }
});

app.post('/har/create/:albumName', function(req, res) {
  var albumName = req.params.albumName;
  var harLog = req.body.har;
  var harBuffer = JSON.stringify(harLog);
  var albumDir;

  if (albumName && harLog) {
    albumDir = path.join(DATA_DIR, albumName);
    mkdirp(albumDir, function(err) {
      if (!err) {
        var harPath = path.join(albumDir, 'page.har');
        fs.writeFile(harPath, JSON.stringify(harLog), function(err) {
          if (!err) {
            console.log(albumDir + '/page.har: ' + harBuffer.length + ' bytes');
            res.status(201).json({
              size: harBuffer.length
            });
          }
          else {
            res.status(500).send('Failed to save har file');
          }
        });
      }
      else {
        res.status(500).send('Failed to create dir ' + albumName);
      }
    });
  }
  else {
    res.status(400).send('Bad Request');
  }
});

app.get('/dev-har/get/:albumName', function(req, res) {
  var albumName = req.params.albumName;
  var harLog;
  var albumDir;

  if (albumName) {
    albumDir = path.join(DATA_DIR, albumName);
    var harPath = path.join(albumDir, 'dev.har');
    fs.readFile(harPath, function(err, data) {
      if (!err) {
        res.type('application/json').send(data);
      }
      else {
        res.status(404).send('Not found har files');
      }
    });
  }
  else {
    res.status(400).send('Bad Request');
  }
});

