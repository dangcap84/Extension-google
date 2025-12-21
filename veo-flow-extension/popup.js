// popup.js

// Local storage keys
const STORAGE_KEY = 'veo3_prompt_list';
const LOG_STORAGE_KEY = 'veo3_log';

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

// Log to textarea + persist to localStorage
function log(text) {
  const timestamp = getTimestamp();
  const logArea = document.getElementById('log');
  logArea.value += `[${timestamp}] ${text}\n`;
  logArea.scrollTop = logArea.scrollHeight;
  try {
    localStorage.setItem(LOG_STORAGE_KEY, logArea.value);
  } catch (e) {
    console.warn('Không thể lưu log vào localStorage:', e);
  }
}

// Reset log khi người dùng thay đổi prompt
function resetLog() {
  const logArea = document.getElementById('log');
  if (!logArea) return;
  logArea.value = '';
  try {
    localStorage.removeItem(LOG_STORAGE_KEY);
  } catch (e) {
    console.warn('Không thể xóa log khỏi localStorage:', e);
  }
}

// ============================================
// LOAD PROMPTS FROM LOCALSTORAGE
// ============================================
function loadSavedPrompts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      document.getElementById('promptList').value = saved;
      log('✅ Đã load prompts đã lưu');
    }
  } catch (e) {
    log('⚠️ Lỗi khi load prompts: ' + e.message);
  }
}

// ============================================
// LOAD LOG FROM LOCALSTORAGE
// ============================================
function loadSavedLog() {
  try {
    const savedLog = localStorage.getItem(LOG_STORAGE_KEY);
    if (savedLog) {
      const logArea = document.getElementById('log');
      logArea.value = savedLog;
      logArea.scrollTop = logArea.scrollHeight;
    }
  } catch (e) {
    console.warn('Lỗi khi load log từ localStorage:', e);
  }
}

// ============================================
// SAVE PROMPTS TO LOCALSTORAGE
// ============================================
function savePrompts() {
  try {
    const content = document.getElementById('promptList').value.trim();
    localStorage.setItem(STORAGE_KEY, content);
  } catch (e) {
    log('⚠️ Lỗi khi lưu prompts: ' + e.message);
  }
}

// ============================================
// AUTO-SAVE ON INPUT CHANGE (debounced)
// ============================================
let saveTimeout;
const promptListEl = document.getElementById('promptList');

promptListEl.addEventListener('input', () => {
  // Mỗi lần sửa prompt, reset toàn bộ log
  resetLog();

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    savePrompts();
    log('💾 Đã tự động lưu prompts');
  }, 1000);
});

// Khi người dùng paste prompt mới: ghi đè toàn bộ nội dung cũ
promptListEl.addEventListener('paste', (event) => {
  try {
    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const text = (clipboardData.getData('text') || '').trim();
    if (!text) return;

    event.preventDefault();

    // Reset log khi dán prompt mới
    resetLog();

    promptListEl.value = text;
    savePrompts();
    log('📋 Đã dán prompt mới (ghi đè danh sách cũ).');
  } catch (e) {
    console.warn('Lỗi khi xử lý paste prompt:', e);
  }
});

// Lắng nghe message từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEBUG_LOG') {
    log('[content.js] ' + message.text);
  }
});

// Validate prompt
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }
  // Giới hạn độ dài để tránh DoS (max 2000 ký tự)
  const MAX_PROMPT_LENGTH = 2000;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return false;
  }
  // Kiểm tra không có script tags
  if (prompt.includes('<script') || prompt.includes('</script>')) {
    return false;
  }
  return true;
}

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
  
  // Validate tất cả prompts
  const invalidPrompts = prompts.filter(p => !validatePrompt(p));
  if (invalidPrompts.length > 0) {
    log(`⚠️ Có ${invalidPrompts.length} prompt không hợp lệ (quá dài hoặc chứa ký tự không cho phép)`);
    return;
  }
  
  // Lưu prompts trước khi start
  savePrompts();
  log('💾 Đã lưu prompts');
  
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

// ============================================
// INIT: Load saved prompts + logs when popup opens
// ============================================
loadSavedPrompts();
loadSavedLog();
log('Popup đã load. Sẵn sàng sử dụng.');