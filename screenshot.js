var FPS = 10;
var QUALITY = 50;

var isRecording = false;
var timer = null;
var images = [];
var startDate;

function startRecording() {
  var i = 0;
  chrome.browserAction.setIcon({path: 'images/icon-rec.png'});
  chrome.browserAction.setTitle({title: 'Stop recording.'});
  images = [];
  startDate = Date.now();
  takePhoto(i, images);
  timer = setInterval(function() {
    takePhoto(++i, images);
  }, 1000 / FPS);
}

function takePhoto(i, images) {
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
  clearInterval(timer);
  showVideoPlaybackPage();
}

function showVideoPlaybackPage() {
  var playbackUrl = chrome.extension.getURL('playback.html');
  chrome.tabs.create({url: playbackUrl});
}

// Listen for a click on the camera icon. On that click, take a screenshot.
chrome.browserAction.onClicked.addListener(function(tab) {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
  isRecording = !isRecording;
});
