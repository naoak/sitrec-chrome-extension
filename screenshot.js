var DEFAULT_FPS = 10;
var QUALITY = 50;
var RESOLVE_DELAY = 500;
var fps;
var album;

var isRecording = false;
var timer = null;
var images = [];
var startDate;
var onResolveLoadListener = null;
var onLoadListener = null;

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
  fps = parseInt((options.fps || DEFAULT_FPS), 10);
  album = options.album || '';
  chrome.browserAction.setIcon({path: 'images/icon-rec.png'});
  chrome.browserAction.setTitle({title: 'Stop recording.'});
  images = [];

  function load() {
    onLoadListener = function(details) {
      if (details.url.split('#')[0].indexOf(options.url.split('#')[0]) == 0) {
        stopRecording();
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
  if (options.resolveUrl) {
    onResolveLoadListener = function(details) {
      if (options.resolveUrl.split('#')[0] == details.url.split('#')[0]) {
        chrome.webNavigation.onCompleted.removeListener(onResolveLoadListener);
        setTimeout(function() {
          load();
        }, RESOLVE_DELAY);
      }
    }
    chrome.webNavigation.onCompleted.addListener(onResolveLoadListener);
    chrome.tabs.update({
      url: options.resolveUrl
    });
  }
  else {
    load();
  }
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
    chrome.browserAction.setIcon({path: 'images/icon.png'});
    chrome.browserAction.setTitle({title: 'Start recording.'});
    showVideoPlaybackPage();
  }
  timer.stop();
  doStop();
}

function showVideoPlaybackPage() {
  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
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
