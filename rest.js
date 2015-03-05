var CREATE_RECORD_PATH = '/api/record/create';
var LIST_RECORD_PATH = '/api/record/list';
var CREATE_PHOTO_PATH = '/api/photo/create/{{recordName}}/{{photoName}}';
var CREATE_HAR_PATH = '/api/har/create/{{recordName}}';

function getOrCreateRecord(server, recordName, callback) {
  getRecord(server, recordName, function(record) {
    if (record) {
      callback(record);
    }
    else {
      createRecord(server, recordName, function(record) {
        callback(record);
      });
    }
  });
}

function createRecord(server, recordName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', server + CREATE_RECORD_PATH, true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = JSON.parse(xhr.responseText);
      if (callback) {
        callback(data);
      }
    }
  };
  xhr.send(JSON.stringify({name: '' + recordName}));
}

function getRecord(server, recordName, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', server + LIST_RECORD_PATH, true);
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = JSON.parse(xhr.responseText);
      var records = data.items;
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        if (record.name == recordName) {
          callback(record);
          return;
        }
      }
      callback();
    }
  };
  xhr.send();
}

function uploadPhoto(server, recordName, photoName, dataURI, callback, progressCallback) {
  var url = server + CREATE_PHOTO_PATH.replace('{{recordName}}', recordName).replace('{{photoName}}', photoName);
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

function uploadHar(server, recordName, harLog, callback) {
  var url = server + CREATE_HAR_PATH.replace('{{recordName}}', recordName);
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
