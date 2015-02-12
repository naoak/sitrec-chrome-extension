document.addEventListener('DOMContentLoaded', function() {
  var inputNames = [
    'resolveUrl',
    'url',
    'album',
    'losstime',
    'fps'
  ];
  var inputDefaults = [
    'http://www.example.com/empty',
    'http://www.example.com/',
    '',
    0,
    10
  ];

  var inputs = inputNames.reduce(function(memo, key) {
    memo[key] = document.getElementById(key);
    return memo;
  }, {});
  var recordBtn = document.getElementById('toggleRecord');

  chrome.storage.sync.get(inputNames, function(items) {
    inputNames.forEach(function(key, i) {
      inputs[key].value = items[key] || inputDefaults[i];
    });
  });

  recordBtn.addEventListener('click', function() {
    var options = {};
    inputNames.forEach(function(key) {
      options[key] = inputs[key].value;
    });
    options.enableHar = true;
    chrome.runtime.sendMessage({toggleRecord: options}, function(response) {
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
