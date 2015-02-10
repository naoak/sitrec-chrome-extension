function $(id) { return document.querySelector(id); }

var background = chrome.extension.getBackgroundPage();
var IntervalTimer = background.IntervalTimer;
var images = background.images;
var startDate = background.startDate;
var startDateFormatted = formatDate(new Date(startDate));
var currentIndex = 0;
var $image;
var $slider;
var $playpause;
var $still;
var $frameIndex;
var timer = new IntervalTimer(null, 1000 / background.fps);

document.addEventListener('DOMContentLoaded', function() {
  $image = $('#image');
  $slider = $('#slider');
  $playpause = $('#playpause');
  $still = $('#still');
  $frameIndex = $('#frameIndex');

  $slider.setAttribute('min', 0);
  $slider.setAttribute('max', images.length - 1);
  $slider.setAttribute('step', 1);

  $slider.addEventListener('change', function(event) {
    setIndex(parseInt($slider.value, 10));
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

function updateSliderPosition(options) {
  if (!options || !options.ignoreState) {
    setState('playback');
  }
  $slider.value = currentIndex;
}

function playpause() {
  if (timer.isActive()) {
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
  timer.setProcedure(function() {
    if (currentIndex >= images.length - 1) {
      pause();
      return;
    }
    setIndex(currentIndex + 1);
    updateSliderPosition();
  });
  timer.start();
}

function pause() {
  $playpause.className = 'play';
  timer.stop();
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
  getOrCreateAlbum(startDateFormatted, function(album) {
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

