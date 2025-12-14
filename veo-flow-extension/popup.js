// popup.js

// Format timestamp
function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });
}

// Log to textarea
function log(text) {
  const logArea = document.getElementById('log');
  const timestamp = getTimestamp();
  logArea.value += `[${timestamp}] ${text}\n`;
  logArea.scrollTop = logArea.scrollHeight;
}

// Lắng nghe message từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEBUG_LOG') {
    log('[content.js] ' + message.text);
  }
});

// Start button
document.getElementById('startBtn').addEventListener('click', async () => {
  const promptText = document.getElementById('promptList').value.trim();
  
  if (!promptText) {
    log('⚠️ Vui lòng nhập ít nhất 1 prompt!');
    return;
  }
  
  const prompts = promptText.split('\n').filter(p => p.trim());
  
  if (prompts.length === 0) {
    log('⚠️ Không có prompt hợp lệ!');
    return;
  }
  
  log(`Gửi START_FLOW với ${prompts.length} prompt...`);
  
  try {
    // Lấy tab hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      log('❌ Không tìm thấy tab hiện tại!');
      return;
    }
    
    // Kiểm tra URL
    if (!tab.url || !tab.url.includes('labs.google')) {
      log('❌ Vui lòng mở trang Google Flow trước!');
      log('   URL hiện tại: ' + (tab.url || 'unknown'));
      return;
    }
    
    log('✓ Tab URL: ' + tab.url);
    
    // Gửi message tới content script
    chrome.tabs.sendMessage(
      tab.id,
      { 
        type: 'START_FLOW', 
        prompts: prompts 
      },
      (response) => {
        if (chrome.runtime.lastError) {
          log('❌ Lỗi kết nối content script:');
          log('   ' + chrome.runtime.lastError.message);
          log('💡 Thử refresh trang Google Flow và mở lại popup');
          return;
        }
        
        if (response && response.ok) {
          log('✓ Đã gửi START_FLOW.');
        } else {
          log('⚠️ Content script không phản hồi đúng');
        }
      }
    );
    
  } catch (error) {
    log('❌ Lỗi: ' + error.message);
  }
});

// Stop button
document.getElementById('stopBtn').addEventListener('click', async () => {
  log('Gửi STOP_FLOW...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      log('❌ Không tìm thấy tab!');
      return;
    }
    
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'STOP_FLOW' },
      (response) => {
        if (chrome.runtime.lastError) {
          log('❌ Lỗi: ' + chrome.runtime.lastError.message);
          return;
        }
        log('✓ Đã gửi STOP_FLOW.');
      }
    );
    
  } catch (error) {
    log('❌ Lỗi: ' + error.message);
  }
});

// Test connection button (để debug)
document.getElementById('testBtn')?.addEventListener('click', async () => {
  log('🧪 Test kết nối với content script...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      log('❌ Không tìm thấy tab!');
      return;
    }
    
    log('Tab ID: ' + tab.id);
    log('Tab URL: ' + tab.url);
    
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'DEBUG_TEST' },
      (response) => {
        if (chrome.runtime.lastError) {
          log('❌ Content script CHƯA LOAD!');
          log('   Error: ' + chrome.runtime.lastError.message);
          log('💡 Hãy refresh trang Google Flow');
          return;
        }
        
        if (response && response.ok) {
          log('✅ Content script ĐÃ LOAD và hoạt động!');
        } else {
          log('⚠️ Content script phản hồi không đúng');
        }
      }
    );
    
  } catch (error) {
    log('❌ Lỗi: ' + error.message);
  }
});

// Load khi popup mở
log('Popup đã load. Sẵn sàng sử dụng.');