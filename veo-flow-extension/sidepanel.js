// sidepanel.js
// Logic cho Chrome Side Panel

const promptsBox = document.getElementById('veo-prompts');
const logArea = document.getElementById('veo-log');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('veo-start');
const stopBtn = document.getElementById('veo-stop');

// Format timestamp
function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
}

// Log to textarea
function log(text) {
  const timestamp = getTimestamp();
  logArea.value += `[${timestamp}] ${text}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

// Update status
function updateStatus(text) {
  statusEl.textContent = text;
}

// Load saved prompts
chrome.storage?.local?.get(['veoSidebarPrompts'], (data) => {
  if (data && data.veoSidebarPrompts) {
    promptsBox.value = data.veoSidebarPrompts;
  }
});

// Save prompts on change (debounced)
let saveTimeout;
promptsBox.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage?.local?.set({ veoSidebarPrompts: promptsBox.value });
  }, 1000);
});

// Start button
startBtn.addEventListener('click', async () => {
  const list = promptsBox.value.split('\n').map(p => p.trim()).filter(Boolean);
  if (!list.length) {
    log('⚠️ Vui lòng nhập prompt');
    return;
  }
  
  // Save prompts
  chrome.storage?.local?.set({ veoSidebarPrompts: promptsBox.value });
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    log('❌ Không tìm thấy tab');
    return;
  }
  
  // Check URL
  if (!tab.url || !tab.url.includes('labs.google')) {
    log('❌ Vui lòng mở trang Google Flow trước!');
    return;
  }
  
  log(`Gửi START_FLOW với ${list.length} prompt...`);
  
  // Send message to content script
  chrome.tabs.sendMessage(
    tab.id,
    { 
      type: 'START_FLOW', 
      prompts: list 
    },
    (response) => {
      if (chrome.runtime.lastError) {
        log('❌ Lỗi: ' + chrome.runtime.lastError.message);
        log('💡 Thử refresh trang Google Flow');
        return;
      }
      
      if (response && response.ok) {
        log('✓ Đã gửi START_FLOW');
        updateStatus('Running');
      } else {
        log('⚠️ Content script không phản hồi đúng');
      }
    }
  );
});

// Stop button
stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    log('❌ Không tìm thấy tab');
    return;
  }
  
  log('Gửi STOP_FLOW...');
  
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'STOP_FLOW' },
    (response) => {
      if (chrome.runtime.lastError) {
        log('❌ Lỗi: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.ok) {
        log('✓ Đã gửi STOP_FLOW');
        updateStatus('Stopped');
      }
    }
  );
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEBUG_LOG') {
    log('[content.js] ' + message.text);
  }
  
  if (message.type === 'PROGRESS_UPDATE') {
    const { done, total } = message;
    if (total > 0) {
      updateStatus(`Running: ${done}/${total}`);
    }
  }
  
  if (message.type === 'FLOW_STATUS') {
    updateStatus(message.status);
  }
});

// Initial log
log('Side panel đã load. Sẵn sàng sử dụng.');

