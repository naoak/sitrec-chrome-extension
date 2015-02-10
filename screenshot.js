var DEFAULT_FPS = 10;
var QUALITY = 50;
var RESOLVE_DELAY = 2000;
var fps;

var isRecording = false;
var timer = null;
var images = [];
var startDate;

function IntervalTimer(proc, span) {
  this.proc = proc;
  this.span = span;
  this.timer = null;
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
    diff = Date.now() - start - time;
    self.timer = setTimeout(instance, (span - diff));
  }
  self.timer = setTimeout(instance, span);
}

IntervalTimer.prototype.stop = function() {
  clearTimeout(this.timer);
  this.timer = null;
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
  chrome.browserAction.setIcon({path: 'images/icon-rec.png'});
  chrome.browserAction.setTitle({title: 'Stop recording.'});
  images = [];
  if (options.resolveUrl) {
    chrome.tabs.update({
      url: options.resolveUrl
    });
  }
  setTimeout(function() {
    startDate = Date.now();
    chrome.tabs.update({
      url: options.url
    });
    takePhoto(i, images, options);
    timer = new IntervalTimer(function() {
      takePhoto(++i, images, options);
    }, 1000 / fps);
    timer.start();
  }, options.resolveUrl ? RESOLVE_DELAY : 0);
}

function takePhoto(i, images, options) {
  chrome.browserAction.setBadgeText({text: '' + i});
  chrome.tabs.captureVisibleTab(null, {quality: QUALITY}, function(img) {
    img = img ? img : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    images.push({
      index: i,
      time: Date.now() - startDate,
      data: img
    });
  });
}

function stopRecording() {
  chrome.browserAction.setIcon({path: 'images/icon.png'});
  chrome.browserAction.setTitle({title: 'Start recording.'});
  timer.stop();
  showVideoPlaybackPage();
}

function showVideoPlaybackPage() {
  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.toggleRecord) {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(request.toggleRecord);
    }
    isRecording = !isRecording;
  }
  sendResponse({isRecording: isRecording});
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
