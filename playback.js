function $(id) { return document.querySelector(id); }

var background = chrome.extension.getBackgroundPage();
var images = background.images;
var startDate = background.startDate;
var currentIndex = 0;
var $image;
var $slider;
var $playpause;
var $still;
var $frameIndex;
var timer = null;

document.addEventListener('DOMContentLoaded', function() {
  $image = $('#image');
  $slider = $('#slider');
  $playpause = $('#playpause');
  $still = $('#still');
  $frameIndex = $('#frameIndex');

  $slider.addEventListener('change', function(event) {
    var ratio = $('#slider').value / 100;
    setIndex(parseInt((images.length - 1) * ratio, 10));
    pause();
  });

  $playpause.addEventListener('click', function(event) {
    playpause();
  });

  $still.addEventListener('click', function(event) {
    uploadAll();
  });

  document.addEventListener('keydown', function(event) {
    if (event.keyCode == 32) {
      playpause();
    }
  });

  setIndex(currentIndex);
  setState('playback');
});

function updateSliderPosition(options) {
  if (!options || !options.ignoreState) {
    setState('playback');
  }
  var percent = parseInt(currentIndex * 100 / (images.length - 1), 10);
  $('#slider').value = percent;
}

function playpause() {
  if (timer) {
    pause();
  } else {
    play();
  }
}

function play() {
  $playpause.className = 'pause';

  // If already at the end, restart
  if (currentIndex == images.length - 1) {
    setIndex(0);
    updateSliderPosition();
  }

  // Load images and render them in sequence
  timer = setInterval(function() {
    if (currentIndex >= images.length - 1) {
      pause();
      return;
    }
    setIndex(currentIndex + 1);
    updateSliderPosition();
  }, 1000 / background.FPS);
}

function pause() {
  $playpause.className = 'play';
  clearInterval(timer);
  timer = null;
}

function setIndex(index) {
  if (index >= images.length) {
    console.error('Index out of bounds');
    return;
  }
  currentIndex = index;
  // TODO: validate index
  $image.src = images[index].data;
  $frameIndex.textContent = '' + index;
}

function uploadAll() {
  setState('upload');
  setProgress(0);
  getOrCreateAlbum(startDate, function(album) {
    uploadNext(album, 0);
  });
}

function uploadNext(album, i) {
  var image;
  var photoName;
  var dataUri;

  if (i < images.length) {
    setIndex(i);
    updateSliderPosition({ignoreState: true});

    image = images[i];
    photoName = image.time;
    dataUri = image.data;

    uploadPhoto(album.name, photoName, dataUri, function(data) {
      setProgress(((i + 1) / images.length) * 100);
      uploadNext(album, i + 1);
    }, function(loaded, total) {
      setProgress(((i + loaded / total) / images.length) * 100);
    });
  }
  else {
    setSharedInfo(album.name, 'All images have been uploaded.');
    setState('shared');
  }
}

/**
 * @param {String} state can be 'playback', 'upload', 'shared'
 */
function setState(state) {
  var STATES = ['playback', 'upload', 'shared'];
  STATES.forEach(function(s) {
    $('#bottom .' + s).style.display = (s == state ? 'block' : 'none');
  });
}

/**
 * @param {Int} percent goes from 0 to 100.
 */
function setProgress(percent) {
  document.querySelector('.upload .progress').style.width = percent + '%';
}

/**
 * @param {String} url the URL that was shared
 * @param {String} message (optional) message to the user
 * @param {Object} editUrl (optional) URL to edit the uploaded asset
 */
function setSharedInfo(url, message, editUrl) {
  var link = $('#bottom .shared .link');
  link.innerText = url;

  // If message specified, set it
  if (message) {
    $('#bottom .shared .message').innerText = message;
  }

  // If editUrl specified, make sure user can click it
  if (editUrl) {
  }

  // Lastly, select the URL
  setTimeout(function() { selectElementContents(link); }, 200);
}

function selectElementContents(element) {
  var range = document.createRange();
  element.focus();
  range.setStart(element.firstChild, 0);
  range.setEnd(element.lastChild, element.innerText.length);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

