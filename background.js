var QUALITY = 50;
var RESOLVE_DELAY = 500;
var server;
var fps;
var losstime;
var album;
var enableHar;

var harLog = null;
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
}

IntervalTimer.prototype.stop = function(callback) {
  if (callback) {
    this.gracefullStopCallback = callback;
  }
  else {
    clearTimeout(this.timer);
    this.timer = null;
  }
}

IntervalTimer.prototype.isActive = function() {
  return !!this.timer;
}

IntervalTimer.prototype.setProcedure = function(proc) {
  this.proc = proc;
}

function startRecording(options) {
  var i = 0;
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
    chrome.tabs.update({
      url: options.url
    });
    takePhoto(i, images);
    timer = new IntervalTimer(function() {
      takePhoto(++i, images);
    }, 1000 / fps);
    timer.start();
  }
  setProxy(options, function() {
    if (options.initialUrl) {
      onResolveLoadListener = function(details) {
        if (options.initialUrl.split('#')[0] == details.url.split('#')[0]) {
          chrome.webNavigation.onCompleted.removeListener(onResolveLoadListener);
          setTimeout(function() {
            load();
          }, RESOLVE_DELAY);
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
            harLog = {
              log: message.responseHar
            };
            port.onMessage.removeListener(harListener);
            showVideoPlaybackPage();
          }
        }
        port.onMessage.addListener(harListener);
        port.postMessage({requestHar: true});
      });
    }
    else {
      showVideoPlaybackPage();
    }
  }
  timer.stop();
  clearProxy(doStop);
}

function showVideoPlaybackPage() {
  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
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

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.toggleRecord) {
    if (isRecording) {
      stopRecording();
    }
    else {
      startRecording(request.toggleRecord);
    }
    isRecording = !isRecording;
    sendResponse({isRecording: isRecording});
  }
});

chrome.browserAction.onClicked.addListener(function(tab) {
  if (isRecording) {
    stopRecording();
    isRecording = !isRecording;
  }
  else {
    chrome.browserAction.setPopup({popup: 'popup.html'});
  }
});

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name == 'screencast') {
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
