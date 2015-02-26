function $(id) {
  return document.querySelector(id);
}

var background = chrome.extension.getBackgroundPage();
var IntervalTimer = background.IntervalTimer;
var recorder = background.recorder;
var startDateFormatted = formatDate(new Date(recorder.startDate));
var currentIndex = 0;
var $image;
var $slider;
var $playpause;
var $upload;
var $seekTime;
var timer = new IntervalTimer(null, 1000 / recorder.fps);

document.addEventListener('DOMContentLoaded', function() {
  $image = $('#image');
  $slider = $('#slider');
  $playpause = $('#playpause');
  $upload = $('#upload');
  $seekTime = $('#seekTime');

  $slider.setAttribute('min', 0);
  $slider.setAttribute('max', recorder.images.length - 1);
  $slider.setAttribute('step', 1);

  $slider.addEventListener('change', function(event) {
    setIndex(parseInt($slider.value, 10));
    pause();
  });

  $playpause.addEventListener('click', function(event) {
    playpause();
  });

  $upload.addEventListener('click', function(event) {
    uploadAll();
  });

  document.addEventListener('keydown', function(event) {
    if (event.keyCode == 32) {
      playpause();
    }
  });

  setIndex(currentIndex);
  uploadAll();
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
  if (currentIndex == recorder.images.length - 1) {
    setIndex(0);
    updateSliderPosition();
  }

  // Load images and render them in sequence
  timer.setProcedure(function() {
    if (currentIndex >= recorder.images.length - 1) {
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
  if (index >= recorder.images.length) {
    console.error('Index out of bounds');
    return;
  }
  currentIndex = index;
  // TODO: validate index
  $image.src = recorder.images[index].data;
  $seekTime.textContent = '' + (index * 1000 / recorder.fps);
}

function uploadAll() {
  setState('upload');
  setProgress(0);
  getOrCreateAlbum(recorder.server, recorder.album + '-' + startDateFormatted, function(album) {
    uploadNext(album, 0);
  });
}

function uploadNext(album, i) {
  var image;
  var photoName;
  var dataUri;

  if (i < recorder.images.length) {
    setIndex(i);
    updateSliderPosition({ignoreState: true});

    image = recorder.images[i];
    photoName = '' + (image.index * (1000 / recorder.fps));
    dataUri = image.data;

    uploadPhoto(recorder.server, album.name, photoName, dataUri, function(data) {
      setProgress(((i + 1) / recorder.images.length) * 100);
      uploadNext(album, i + 1);
    }, function(loaded, total) {
      setProgress(((i + loaded / total) / recorder.images.length) * 100);
    });
  }
  else {
    if (recorder.harLog) {
      uploadHar(recorder.server, album.name, recorder.harLog, function() {
        setSharedInfo(album.name, 'All images and HAR have been uploaded.');
        setState('shared');
      });
    }
    else {
      setSharedInfo(album.name, 'All images have been uploaded.');
      setState('shared');
    }
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

