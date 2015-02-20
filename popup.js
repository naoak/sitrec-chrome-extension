document.addEventListener('DOMContentLoaded', function() {
  var inputInfos = [
    {name: 'album', default: ''},
    {name: 'httpProxy', default: 'localhost:11001'},
    {name: 'resolveUrl', default: 'http://www.example.com/empty'},
    {name: 'url', default: 'http://www.example.com/'},
    {name: 'losstime', default: 0},
    {name: 'fps', default: 10}
  ];
  var inputNames = inputInfos.map(function(info) {
    return info.name;
  });
  var inputDefaults = inputInfos.map(function(info) {
    return info.default;
  });

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
