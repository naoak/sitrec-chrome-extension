chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  var currentTab = tabs[0];
  chrome.runtime.sendMessage({targetTabId: currentTab.id});
});

document.addEventListener('DOMContentLoaded', function() {
  var inputInfos = [
    {name: 'recordName', default: ''},
    {name: 'server', default: 'http://localhost:11080'},
    {name: 'httpProxy', default: 'localhost:11001'},
    {name: 'initialUrl', default: 'http://www.example.com/empty'},
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
  var throttle = document.getElementById('throttle');
  var viewBtn = document.getElementById('view');
  var recordBtn = document.getElementById('toggleRecord');

  chrome.browserAction.setBadgeText({text: ''});

  chrome.storage.sync.get(inputNames, function(items) {
    inputNames.forEach(function(key, i) {
      inputs[key].value = items[key] || inputDefaults[i];
    });
  });

  chrome.storage.sync.get(['throttle'], function(items) {
    var value = items['throttle'];
    var i;
    for (i = 0; i < throttle.options.length; i++) {
      if (throttle.options[i].value == value) {
        break;
      }
    }
    if (i == throttle.options.length) {
      i = 0;
    }
    throttle.selectedIndex = i;
  });

  viewBtn.addEventListener('click', function() {
    var server = inputs['server'].value;
    chrome.tabs.create({url: server});
  });

  recordBtn.addEventListener('click', function() {
    var options = {};
    var tcValue = throttle.options[throttle.selectedIndex].value;
    var tcParts = tcValue ? tcValue.split(':') : [];
    inputNames.forEach(function(key) {
      options[key] = inputs[key].value;
    });
    if (tcValue) {
      options.throttle = {
        rate: tcParts[0],
        delay: tcParts[1]
      };
    }
    else {
      options.throttle = null;
    }
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

  throttle.addEventListener('change', function() {
    var value = throttle.options[throttle.selectedIndex].value;
    chrome.storage.sync.set({throttle: value});
  });
});
