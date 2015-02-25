var TC_STATUS_PATH = '/api/tc/status';
var TC_START_PATH = '/api/tc/start/{{rate}}/{{delay}}';
var TC_STOP_PATH = '/api/tc/stop';
var QUALITY = 50;
var INITIAL_DELAY = 500;

var server;
var fps;
var losstime;
var album;
var enableHar;

var harLog = null;
var requestHook = new RequestHook();
var isRecording = false;
var timer = null;
var images = [];
var startDate;
var onResolveLoadListener = null;
var onLoadListener = null;
var connections = {};

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

function RequestHook() {
  this.isHook = false;
  this.details = [];
  this.targetTabId = -1;
}

RequestHook.prototype.startHook = function() {
  this.isHook = true;
  this.details = [];
};

RequestHook.prototype.stopHook = function() {
  this.isHook = false;
};

RequestHook.prototype.onBeforeRequest = function(details) {
  if (details.tabId == -1) {
    return;
  }
  if (details.tabId == this.targetTabId) {
    if (this.isHook) {
      this.details.push(details);
    }
  }
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

function startRecording(options) {
  var i = 0;
  isRecording = true;
  server = options.server;
  fps = parseInt(options.fps, 10);
  losstime = parseInt(options.losstime, 10);
  enableHar = options.enableHar;
  album = options.album || '';
  chrome.browserAction.setIcon({path: 'images/sc-rec.png'});
  chrome.browserAction.setTitle({title: 'Stop recording.'});
  images = [];

  function load() {
    onLoadListener = function(details) {
      if (details.url.split('#')[0].indexOf(options.url.split('#')[0]) == 0) {
        setTimeout(function() {
          stopRecording();
        }, losstime);
      }
    };
    chrome.webNavigation.onCompleted.addListener(onLoadListener);
    startDate = Date.now();
    if (enableHar) {
      requestHook.startHook();
    }
    chrome.tabs.update({
      url: options.url
    });
    takePhoto(i, images);
    timer = new IntervalTimer(function() {
      takePhoto(++i, images);
    }, 1000 / fps);
    timer.start();
  }
  startTc(options, function() {
    setProxy(options, function() {
      if (options.initialUrl) {
        onResolveLoadListener = function(details) {
          if (options.initialUrl.split('#')[0] == details.url.split('#')[0]) {
            chrome.webNavigation.onCompleted.removeListener(onResolveLoadListener);
            setTimeout(function() {
              load();
            }, INITIAL_DELAY);
          }
        }
        chrome.webNavigation.onCompleted.addListener(onResolveLoadListener);
        chrome.tabs.update({
          url: options.initialUrl
        });
      }
      else {
        load();
      }
    });
  });
}

function takePhoto(i, images, callback) {
  chrome.browserAction.setBadgeText({text: '' + i});
  chrome.tabs.captureVisibleTab(null, {quality: QUALITY}, function(img) {
    img = img ? img : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    images.push({
      index: i,
      time: Date.now() - startDate,
      data: img
    });
    if (callback) {
      callback();
    }
  });
}

function stopRecording() {
  isRecording = false;
  function doStop() {
    if (onLoadListener) {
      chrome.webNavigation.onCompleted.removeListener(onLoadListener);
      onLoadListener = null;
    }
    chrome.browserAction.setIcon({path: 'images/sc.png'});
    chrome.browserAction.setTitle({title: 'Start recording.'});
    if (enableHar) {
      chrome.tabs.getSelected(null, function(tab) {
        var port = connections[tab.id];
        function harListener(message) {
          if (message.responseHar) {
            harLog = requestHook.fixHAR({
              log: message.responseHar
            });
            requestHook.stopHook();
            port.onMessage.removeListener(harListener);
            showVideoPlaybackPage();
          }
        }
        if (port) {
          port.onMessage.addListener(harListener);
          port.postMessage({requestHar: true});
        }
        else {
          requestHook.stopHook();
          alert('To take a HAR file, DevTools must have been opened');
          showVideoPlaybackPage();
        }
      });
    }
    else {
      showVideoPlaybackPage();
    }
  }
  timer.stop(function() {
    clearProxy(function () {
      stopTc(doStop);
    });
  });
}

function showVideoPlaybackPage() {
  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
}

function getTcStatus(options, callback) {
  var url = options.server + TC_STATUS_PATH;
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
}

function startTc(options, callback) {
  var throttle = options.throttle;
  if (throttle && (throttle.rate || throttle.delay)) {
    var url = server + TC_START_PATH.replace('{{rate}}', throttle.rate).replace('{{delay}}', throttle.delay);
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
}

function stopTc(callback) {
  var url = server + TC_STOP_PATH;
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

function setProxy(options, callback) {
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
    clearProxy(callback);
  }
}

function clearProxy(callback) {
  chrome.proxy.settings.clear({scope: 'regular'}, callback);
}

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

// Handle messages from popup window
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.toggleRecord) {
    if (isRecording) {
      stopRecording();
    }
    else {
      startRecording(request.toggleRecord);
    }
    sendResponse({isRecording: isRecording});
  }
  else if (request.targetTabId) {
    requestHook.targetTabId = request.targetTabId;
    sendResponse(null);
  }
});

// Handle connections to Devtools
chrome.runtime.onConnect.addListener(function(port) {
  if (port.name == 'sitrec') {
    var extensionListener = function(message, sender, sendResponse) {
      if (message.name == 'init') {
        connections[message.tabId] = port;
        return;
      }
    }
    port.onMessage.addListener(extensionListener);
    port.onDisconnect.addListener(function(port) {
      port.onMessage.removeListener(extensionListener);
      var tabs = Object.keys(connections);
      for (var i = 0, len = tabs.length; i < len; i++) {
        if (connections[tabs[i]] == port) {
          delete connections[tabs[i]]
          break;
        }
      }
    });
  }
});

chrome.webRequest.onBeforeRequest.addListener(requestHook.onBeforeRequest.bind(requestHook), {urls: ["<all_urls>"]});
