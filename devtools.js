var backgroundPageConnection = chrome.runtime.connect({
  name: 'sitrec'
});

backgroundPageConnection.postMessage({
  name: 'devtoolsopen',
  tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.requestHar) {
    chrome.devtools.network.getHAR(function(harLog) {
      backgroundPageConnection.postMessage({
        responseHar: harLog
      });
    });
  }
});
