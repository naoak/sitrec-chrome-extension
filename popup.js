document.addEventListener('DOMContentLoaded', function() {
  var resolveUrl = document.getElementById('resolveUrl');
  var url = document.getElementById('url');
  var fps = document.getElementById('fps');
  var recordBtn = document.getElementById('toggleRecord');

  chrome.storage.sync.get(['resolveUrl', 'url', 'fps'], function(items) {
    resolveUrl.value = items.resolveUrl || 'http://www.example.com/empty';
    url.value = items.url || 'http://www.example.com/';
    fps.value = items.fps || 10;
  });

  recordBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      toggleRecord: {
        resolveUrl: resolveUrl.value,
        url: url.value,
        fps: fps.value
      }
    }, function(response) {
      recordBtn.value = response.isRecording ? 'stop' : 'rec';
    });
  });

  resolveUrl.addEventListener('change', function() {
    chrome.storage.sync.set({resolveUrl: resolveUrl.value});
  });

  url.addEventListener('change', function() {
    chrome.storage.sync.set({url: url.value});
  });

  fps.addEventListener('change', function() {
    chrome.storage.sync.set({url: url.value});
  });
});
