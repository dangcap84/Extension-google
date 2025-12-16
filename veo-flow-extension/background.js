// background.js
// Lắng nghe click vào action icon để mở side panel
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  // Mở side panel cho tab hiện tại
  chrome.sidePanel.open({ windowId: tab.windowId });
});
