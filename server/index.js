var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var DATA_DIR = 'screenshots';

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

app.use(bodyParser.json({limit: '50mb'}));

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

app.listen(8080);
