var INITIAL_DELAY = 500;

var recorder = new Recorder();

function Recorder() {
  var self = this;
  this.quality = 50;
  this.isRecording = false;
  this.images = [];
  this.timer = null;
  this.startDate = 0;
  this.harLog = null;
  this.connections = {};
  this.onLoadListener = null;
  this.proxy = new Proxy();
  this.requestHook = new RequestHook();

  function connectWithPopupWindow() {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.toggleRecord) {
        if (self.isRecording) {
          self.stop();
        }
        else {
          self.start(request.toggleRecord);
        }
        sendResponse({isRecording: self.isRecording});
      }
      else if (request.targetTabId) {
        self.requestHook.targetTabId = request.targetTabId;
        sendResponse(null);
      }
    });
  }

  function connectWithDevTools() {
    chrome.runtime.onConnect.addListener(function(port) {
      if (port.name == 'sitrec') {
        var extensionListener = function(message, sender, sendResponse) {
          if (message.name == 'init') {
            self.connections[message.tabId] = port;
            return;
          }
        }
        port.onMessage.addListener(extensionListener);
        port.onDisconnect.addListener(function(port) {
          port.onMessage.removeListener(extensionListener);
          var tabs = Object.keys(self.connections);
          for (var i = 0, len = tabs.length; i < len; i++) {
            if (self.connections[tabs[i]] == port) {
              delete self.connections[tabs[i]]
              break;
            }
          }
        });
      }
    });
  }

  connectWithPopupWindow();
  connectWithDevTools();
};

Recorder.prototype.start = function(options) {
  var self = this;
  var index = 0;

  options.server = (options.server.lastIndexOf('/') === options.server.length - 1) ? options.server.slice(0, options.length - 1) : options.server;
  self.isRecording = true;
  self.options = options;
  self.server = options.server;
  self.fps = parseInt(options.fps, 10);
  self.losstime = parseInt(options.losstime, 10);
  self.album = options.album || '';
  self.tc = new TrafficControl(options.server);
  self.images = [];

  chrome.browserAction.setIcon({path: 'images/sc-rec.png'});
  chrome.browserAction.setTitle({title: 'Stop recording.'});

  function load() {
    self.onLoadListener = function(details) {
      if (details.url.split('#')[0].indexOf(options.url.split('#')[0]) == 0) {
        setTimeout(function() {
          self.stop();
        }, self.losstime);
      }
    };
    chrome.webNavigation.onCompleted.addListener(self.onLoadListener);
    self.startDate = Date.now();
    if (self.options.enableHar) {
      self.requestHook.start(options);
    }
    chrome.tabs.update({
      url: options.url
    });
    self.takeScreenCapture(index);
    self.timer = new IntervalTimer(function() {
      self.takeScreenCapture(++index);
    }, 1000 / self.fps);
    self.timer.start();
  }

  self.tc.start(options, function() {
    self.proxy.set(options, function() {
      if (options.initialUrl) {
        var onInitialLoadListener = function(details) {
          if (options.initialUrl.split('#')[0] == details.url.split('#')[0]) {
            chrome.webNavigation.onCompleted.removeListener(onInitialLoadListener);
            setTimeout(function() {
              load();
            }, INITIAL_DELAY);
          }
        }
        chrome.webNavigation.onCompleted.addListener(onInitialLoadListener);
        chrome.tabs.update({
          url: options.initialUrl
        });
      }
      else {
        load();
      }
    });
  });
};

Recorder.prototype.takeScreenCapture = function(index, callback) {
  var self = this;
  chrome.browserAction.setBadgeText({text: '' + index});
  chrome.tabs.captureVisibleTab(null, {quality: self.quality}, function(img) {
    img = img ? img : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    self.images.push({
      index: index,
      time: Date.now() - self.startDate,
      data: img
    });
    if (callback) {
      callback();
    }
  });
};

Recorder.prototype.stop = function() {
  var self = this;
  self.isRecording = false;

  function doStop() {
    if (self.onLoadListener) {
      chrome.webNavigation.onCompleted.removeListener(self.onLoadListener);
      self.onLoadListener = null;
    }
    chrome.browserAction.setIcon({path: 'images/sc.png'});
    chrome.browserAction.setTitle({title: 'Start recording.'});
    if (self.options.enableHar) {
      chrome.tabs.getSelected(null, function(tab) {
        var port = self.connections[tab.id];
        function harListener(message) {
          if (message.responseHar) {
            self.harLog = self.requestHook.fixHAR({
              log: message.responseHar
            });
            self.requestHook.stop();
            port.onMessage.removeListener(harListener);
            self.showVideoPlaybackPage();
          }
        }
        if (port) {
          port.onMessage.addListener(harListener);
          port.postMessage({requestHar: true});
        }
        else {
          self.requestHook.stop();
          alert('To take a HAR file, DevTools must have been opened');
          self.showVideoPlaybackPage();
        }
      });
    }
    else {
      self.showVideoPlaybackPage();
    }
  }

  self.timer.stop(function() {
    self.proxy.clear(function() {
      self.tc.stop(doStop);
    });
  });
};

Recorder.prototype.showVideoPlaybackPage = function() {
  var throttle = this.options.throttle;
  var albumName = this.album;

  if (throttle) {
    albumName += '-' + throttle.rate.replace('mbit', 'M').replace('kbit', 'K') + throttle.delay;
  }
  albumName += '-' + formatDate(new Date(this.startDate));
  this.fullAlbumName = albumName;

  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
};

function IntervalTimer(proc, span) {
  this.proc = proc;
  this.span = span;
  this.timer = null;
  this.gracefullStopCallback = null;
}

IntervalTimer.prototype.start = function() {
  var self = this;
  var proc = this.proc;
  var span = this.span;
  var start = Date.now();
  var time = 0;

  function instance() {
    var diff;
    time += span;
    proc();
    if (self.gracefullStopCallback) {
      self.gracefullStopCallback();
      self.gracefullStopCallback = null;
      self.timer = null;
    }
    else {
      diff = Date.now() - start - time;
      self.timer = setTimeout(instance, (span - diff));
    }
  }

  self.timer = setTimeout(instance, span);
};

IntervalTimer.prototype.stop = function(callback) {
  if (callback) {
    if (this.timer) {
      this.gracefullStopCallback = callback;
    }
    else {
      callback();
    }
  }
  else {
    clearTimeout(this.timer);
    this.timer = null;
  }
};

IntervalTimer.prototype.isActive = function() {
  return !!this.timer;
};

IntervalTimer.prototype.setProcedure = function(proc) {
  this.proc = proc;
};

function Proxy() {
}

Proxy.prototype.set = function(options, callback) {
  var httpProxy = options.httpProxy;
  if (httpProxy) {
    var parts = httpProxy.split(':');
    var hostName = parts[0];
    var port = parts.length >= 2 ? parseInt(parts[1], 10) : 80;
    var proxyConfig = {
      mode: "fixed_servers",
      rules: {
        proxyForHttp: {
          scheme: "http",
          host: hostName,
          port: port
        },
        bypassList: ["localhost"]
      }
    };
    chrome.proxy.settings.set({value: proxyConfig, scope: 'regular'}, callback);
  }
  else {
    this.clear(callback);
  }
};

Proxy.prototype.clear = function(callback) {
  chrome.proxy.settings.clear({scope: 'regular'}, callback);
};

function RequestHook() {
  var self = this;
  this.isHook = false;
  this.details = [];
  this.targetTabId = -1;

  function register() {
    chrome.webRequest.onBeforeRequest.addListener(function(details) {
      if (details.tabId == -1) {
        return;
      }
      if (details.tabId == self.targetTabId) {
        if (self.isHook) {
          self.details.push(details);
        }
      }
    }, {urls: ["<all_urls>"]});
  }

  register();
}

RequestHook.prototype.start = function(options) {
  this.options = options;
  this.isHook = true;
  this.details = [];
};

RequestHook.prototype.stop = function() {
  this.isHook = false;
};

RequestHook.prototype.fixHAR = function(har) {
  if (this.isHook) {
    var details = clone(this.details);
    if (har.log) {
      // Remove favicon.ico
      details = details.filter(function(d) {
        return d.url.indexOf('favicon.ico') === -1;
      });

      // Set page start time
      if (har.log.pages.length === 1 && details.length > 0) {
        har.log.pages[0].startedDateTime = toUTCString(new Date(details[0].timeStamp));
      }

      // Remove inline data entry
      har.log.entries = har.log.entries.filter(function(entry) {
        return entry.request.url.indexOf('data:') === -1;
      });

      // Set entry start time
      har.log.entries = har.log.entries.map(function(entry) {
        if (typeof entry.startedDateTime === 'object' && Object.keys(entry.startedDateTime).length === 0) {
          for (var i = 0; i < details.length; i++) {
            var d = details[i];
            if (d.url == entry.request.url) {
              entry.startedDateTime = toUTCString(new Date(d.timeStamp));
              details.splice(i, 1);
              break;
            }
          }
        }
        return entry;
      });

      // Insert page comment about recorder options
      har.log.pages[0].comment = JSON.stringify(this.options);

      if (details.length > 0) {
        alert(details.length + " request entries remain not to match");
        details.forEach(function(d) {
          alert(d.url);
        });
      }
    }
  }
  return har;
};

function TrafficControl(server) {
  this.server = server;
  this.statusPath = '/api/tc/status';
  this.startPath = '/api/tc/start/{{rate}}/{{delay}}';
  this.stopPath = '/api/tc/stop';
}

TrafficControl.prototype.getStatus = function(callback) {
  var url = this.server + this.statusPath;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = xhr.responseText;
      callback({
        status: data
      });
    }
  };
  xhr.send();
};

TrafficControl.prototype.start = function(options, callback) {
  var throttle = options.throttle;
  if (throttle && (throttle.rate || throttle.delay)) {
    var url = this.server + this.startPath.replace('{{rate}}', throttle.rate).replace('{{delay}}', throttle.delay);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onload = function(e) {
      if (this.status == 200) {
        var data = xhr.responseText;
        callback({
          status: data
        });
      }
    };
    xhr.send();
  }
  else {
    stopTc(callback);
  }
};

TrafficControl.prototype.stop = function(callback) {
  var url = this.server + this.stopPath;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.onload = function(e) {
    if (this.status == 200) {
      var data = xhr.responseText;
      callback({
        status: data
      });
    }
  };
  xhr.send();
};

function toUTCString(date) {
  function padZero(digits, num) {
    var result;
    digits = '' + digits;
    result = digits;
    for (var i = 0; i < num - digits.length; i++) {
      result = '0' + result;
    }
    return result;
  }
  var yy = padZero(date.getUTCFullYear(), 4);
  var MM = padZero(date.getUTCMonth() + 1, 2);
  var dd = padZero(date.getUTCDate(), 2);
  var hh = padZero(date.getUTCHours(), 2);
  var mm = padZero(date.getUTCMinutes(), 2);
  var ss = padZero(date.getUTCSeconds(), 2);
  var SS = padZero(date.getUTCMilliseconds(), 4);
  return yy + '-' + MM + '-' + dd + 'T' + hh + ':' + mm + ':' + ss + '.' + SS + 'Z';
}

function formatDate(date) {
  var yy = date.getFullYear();
  var mm = date.getMonth() + 1;
  var dd = date.getDate();
  var hh = date.getHours();
  var MM = date.getMinutes();
  if (mm < 10) {
    mm = '0' + mm;
  }
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (hh < 10) {
    hh = '0' + hh;
  }
  if (MM < 10) {
    MM = '0' + MM;
  }
  return yy + '-' + mm + dd + '-' + hh + MM;
}

function clone(obj) {
  var temp;
  if (obj == null || typeof(obj) != 'object') {
    return obj;
  }
  temp = obj.constructor();
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      temp[key] = clone(obj[key]);
    }
  }
  return temp;
}
