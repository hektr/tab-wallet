// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeTabs') {
    const tabIds = message.tabIds;
    
    // Close tabs in batches to avoid overwhelming the browser
    const batchSize = 10;
    for (let i = 0; i < tabIds.length; i += batchSize) {
      const batch = tabIds.slice(i, i + batchSize);
      chrome.tabs.remove(batch);
    }
    
    sendResponse({ status: 'ok' });
  }
});
