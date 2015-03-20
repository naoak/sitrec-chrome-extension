var INITIAL_DELAY = 500;

var recorder = new Recorder();

function RecorderState() {
  this.state = false;
}

RecorderState.prototype.set = function(state) {
  this.state = state;
  chrome.runtime.sendMessage({
    recordState: {
      recording: state
    }
  });
};

RecorderState.prototype.isRecording = function() {
  return this.state;
};

function Recorder() {
  var self = this;
  this.quality = 50;
  this.state = new RecorderState();
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
        if (self.state.isRecording()) {
          self.stop();
        }
        else {
          self.start(request.toggleRecord);
        }
      }
    });
  }

  function connectWithDevTools() {
    chrome.runtime.onConnect.addListener(function(port) {
      if (port.name == 'sitrec') {
        var extensionListener = function(message, sender, sendResponse) {
          if (message.name == 'devtoolsopen') {
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
  var server = options.server;

  server = (server.lastIndexOf('/') === server.length - 1) ? server.slice(0, server.length - 1) : server;
  options.server = server;
  self.state.set(true);
  self.options = options;
  self.server = server;
  self.fps = parseInt(options.fps, 10);
  self.losstime = parseInt(options.losstime, 10);
  self.recordName = options.recordName || '';
  self.tc = new TrafficControl(options.server);
  self.images = [];
  self.harLog = null;

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
    self.requestHook.start(options);
    chrome.tabs.update(self.targetTabId, {
      url: options.url,
      active: true
    });
    self.takeScreenCapture(index, postCaptureMessage);
    self.timer = new IntervalTimer(function() {
      self.takeScreenCapture(++index, postCaptureMessage);
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
        chrome.tabs.update(self.targetTabId, {
          url: options.initialUrl,
          active: true
        });
      }
      else {
        load();
      }
    });
  });

  function postCaptureMessage() {
    chrome.runtime.sendMessage({
      capture: {
        index: index
      }
    });
  }
};

Recorder.prototype.takeScreenCapture = function(index, callback) {
  var self = this;
  chrome.browserAction.setBadgeText({text: '' + index});
  chrome.tabs.captureVisibleTab(self.targetWindowId, {quality: self.quality}, function(img) {
    img = img ? img : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    self.images.push({
      index: index,
      time: Date.now() - self.startDate,
      ms: Math.round((1000 / self.fps) * index),
      data: img
    });
    if (callback) {
      callback(index);
    }
  });
};

Recorder.prototype.stop = function() {
  var self = this;

  function doStop() {
    if (self.onLoadListener) {
      chrome.webNavigation.onCompleted.removeListener(self.onLoadListener);
      self.onLoadListener = null;
    }
    chrome.browserAction.setIcon({path: 'images/sc.png'});
    chrome.browserAction.setTitle({title: 'Start recording.'});
    var port = self.connections[self.targetTabId];
    function harListener(message) {
      if (message.responseHar) {
        self.makeFullRecordName();
        self.harLog = self.requestHook.fixHAR({
          log: message.responseHar
        });
        self.requestHook.stop();
        port.onMessage.removeListener(harListener);
      }
      self.state.set(false);
    }
    if (port) {
      port.onMessage.addListener(harListener);
      port.postMessage({requestHar: true});
    }
    else {
      self.requestHook.stop();
      self.alert('To take a HAR file, DevTools must have been opened');
      self.state.set(false);
    }
  }

  self.timer.stop(function() {
    self.proxy.clear(function() {
      self.tc.stop(doStop);
    });
  });
};

Recorder.prototype.alert = function(message) {
  chrome.runtime.sendMessage({
    alert: {
      message: message
    }
  });
};

Recorder.prototype.makeFullRecordName = function() {
  var throttle = this.options.throttle;
  var recordName = this.recordName;
  if (throttle) {
    recordName += '-' + throttle.rate + throttle.delay;
  }
  recordName += '-' + formatDate(new Date(this.startDate));
  this.fullRecordName = this.options.fullRecordName = recordName;
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
  var self = this;

  function isEmptyObject(obj) {
    return typeof obj === 'object' && Object.keys(obj).length === 0;
  }

  if (this.isHook) {
    var details = clone(this.details);
    if (har.log) {
      // Remove favicon.ico
      details = details.filter(function(d) {
        return d.url.indexOf('favicon.ico') === -1;
      });

      // Insert page comment about recorder options
      har.log.pages[0].comment = JSON.stringify({
        options: this.options
      });

      // Set page start time
      if (har.log.pages.length === 1 && details.length > 0) {
        har.log.pages[0].startedDateTime = toUTCString(new Date(details[0].timeStamp));
      }

      // Remove inline data entries
      har.log.entries = har.log.entries.filter(function(entry) {
        return entry.request.url.indexOf('data:') === -1;
      });

      // Set each entry start time
      har.log.entries = har.log.entries.map(function(entry) {
        if (isEmptyObject(entry.startedDateTime)) {
          for (var i = 0; i < details.length; i++) {
            var d = details[i];
            if (d.url == entry.request.url) {
              entry.startedDateTime = toUTCString(new Date(d.timeStamp));
              entry.comment = JSON.stringify({
                timeStamp: d.timeStamp
              });
              details.splice(i, 1);
              break;
            }
          }
        }
        return entry;
      });

      // Remove empty entries which are generated when the request entries hit the cache
      har.log.entries = har.log.entries.filter(function(entry) {
        return !isEmptyObject(entry.startedDateTime);
      });

      // Sort entries by request time stamps
      har.log.entries.sort(function(a, b) {
        return JSON.parse(a.comment).timeStamp - JSON.parse(b.comment).timeStamp;
      });

      if (details.length > 0) {
        self.alert(details.length + " request entries remain not to match");
        details.forEach(function(d) {
          self.alert(d.url);
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
    this.stop(callback);
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
  var SS = padZero(date.getUTCMilliseconds(), 3);
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

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.windows.getLastFocused(null, function(window) {
    recorder.targetWindowId = window.id;
    chrome.tabs.query({windowId: window.id, active: true}, function(tabs) {
      if (tabs.length > 0) {
        recorder.requestHook.targetTabId = recorder.targetTabId = tabs[0].id;
        chrome.tabs.create({
          url: chrome.extension.getURL('vulcanized.html'),
          active: false
        }, function(tab) {
          chrome.windows.create({
              tabId: tab.id,
              type: 'popup',
              focused: true
          });
        });
      }
      else {
        alert('Error: Active tab is not found.');
      }
    });
  });
});
