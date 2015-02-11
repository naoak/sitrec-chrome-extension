document.addEventListener('DOMContentLoaded', function() {
  var inputNames = ['resolveUrl', 'url', 'album', 'fps'];
  var inputs = inputNames.reduce(function(memo, key) {
    memo[key] = document.getElementById(key);
    return memo;
  }, {});
  var recordBtn = document.getElementById('toggleRecord');

  chrome.storage.sync.get(inputNames, function(items) {
    inputs.resolveUrl.value = items.resolveUrl || 'http://www.example.com/empty';
    inputs.url.value = items.url || 'http://www.example.com/';
    inputs.album.value = items.album || '';
    inputs.fps.value = items.fps || 10;
  });

  recordBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      toggleRecord: {
        resolveUrl: inputs.resolveUrl.value,
        url: inputs.url.value,
        album: inputs.album.value,
        fps: inputs.fps.value,
        enableHar: true
      }
    }, function(response) {
      recordBtn.value = response.isRecording ? 'stop' : 'rec';
    });
  });

  inputNames.forEach(function(key) {
    inputs[key].addEventListener('change', function() {
      var obj = {};
      obj[key] = inputs[key].value;
      chrome.storage.sync.set(obj);
    });
  });
});
