function $(id) {
  return document.querySelector(id);
}

var background = chrome.extension.getBackgroundPage();
var IntervalTimer = background.IntervalTimer;
var recorder = background.recorder;
var throttle = recorder.options.throttle;
var currentIndex = 0;
var $image;
var $slider;
var $playpause;
var $recordList;
var $seekTime;
var timer = new IntervalTimer(null, 1000 / recorder.fps);

document.addEventListener('DOMContentLoaded', function() {
  $image = $('#image');
  $slider = $('#slider');
  $playpause = $('#playpause');
  $recordList = $('#recordList');
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

  $recordList.addEventListener('click', function(event) {
    window.open(recorder.server, '_blank');
  });

  document.addEventListener('keydown', function(event) {
    if (event.keyCode == 32) {
      playpause();
    }
  });

  setIndex(currentIndex);

  if (window.location.hash == '#upload') {
    uploadAll();
  }
});

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

  getOrCreateRecord(recorder.server, recorder.fullRecordName, function(record) {
    uploadNext(record, 0);
  });
}

function uploadNext(record, i) {
  var image;
  var photoName;
  var dataUri;

  if (i < recorder.images.length) {
    setIndex(i);
    updateSliderPosition({ignoreState: true});

    image = recorder.images[i];
    photoName = '' + (image.index * (1000 / recorder.fps));
    dataUri = image.data;

    uploadPhoto(recorder.server, record.name, photoName, dataUri, function(data) {
      setProgress(((i + 1) / recorder.images.length) * 100);
      uploadNext(record, i + 1);
    }, function(loaded, total) {
      setProgress(((i + loaded / total) / recorder.images.length) * 100);
    });
  }
  else {
    if (recorder.harLog) {
      uploadHar(recorder.server, record.name, recorder.harLog, function() {
        setSharedInfo(record.name, 'All images and a HAR file have been uploaded.');
        setState('shared');
      });
    }
    else {
      setSharedInfo(record.name, 'All images have been uploaded.');
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
 * @param {String} recordName the record name
 * @param {String} message (optional) message to the user
 */
function setSharedInfo(recordName, message) {
  var link = $('#bottom .shared .link');
  link.innerHTML = '<a href="' + recorder.server + '/album/' + recordName + '" target="_blank">' + recordName + '</a>';

  // If message specified, set it
  if (message) {
    $('#bottom .shared .message').innerText = message;
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
