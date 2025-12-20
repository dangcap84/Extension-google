// sidepanel.js
// Logic cho Chrome Side Panel

const promptsBox = document.getElementById('veo-prompts');
const logArea = document.getElementById('veo-log');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('veo-start');
const stopBtn = document.getElementById('veo-stop');
const imageInput = document.getElementById('veo-image-input');
const imagePreview = document.getElementById('image-preview');
const scenebuilderMask = document.getElementById('scenebuilder-mask');
let selectedImageBase64 = null;

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

// Show/hide Scenebuilder mask
function showScenebuilderMask(show) {
  if (scenebuilderMask) {
    scenebuilderMask.style.display = show ? 'flex' : 'none';
  }
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

// Handle image input
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    imagePreview.classList.remove('visible');
    selectedImageBase64 = null;
    return;
  }
  
  if (!file.type.startsWith('image/')) {
    log('⚠️ Vui lòng chọn file ảnh');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    selectedImageBase64 = event.target.result; // data URL (base64)
    imagePreview.src = selectedImageBase64;
    imagePreview.classList.add('visible');
    log('✓ Đã chọn ảnh: ' + file.name);
  };
  reader.onerror = () => {
    log('❌ Lỗi đọc file ảnh');
    selectedImageBase64 = null;
    imagePreview.classList.remove('visible');
  };
  reader.readAsDataURL(file);
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
  
  // Kiểm tra xem có phải tab Scenebuilder không
  log('🔍 Đang kiểm tra tab Scenebuilder...');
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'CHECK_SCENEBUILDER_TAB' },
    (response) => {
      if (chrome.runtime.lastError) {
        log('❌ Lỗi: ' + chrome.runtime.lastError.message);
        log('💡 Thử refresh trang Google Flow');
        return;
      }
      
      if (response && response.ok) {
        if (!response.isScenebuilder) {
          log('❌ Không phải tab Scenebuilder! Vui lòng mở tab Scenebuilder để sử dụng extension.');
          showScenebuilderMask(true);
          return;
        }
        
        // Ẩn mask nếu đang hiển thị
        showScenebuilderMask(false);
        
        log('✅ Đã xác nhận tab Scenebuilder');
  log(`Gửi START_FLOW với ${list.length} prompt...`);
  
  // Prepare message
  const message = {
    type: 'START_FLOW',
    prompts: list
  };
  
  // Add image if selected
  if (selectedImageBase64) {
    message.initialImageFile = selectedImageBase64;
    log('📷 Đã thêm ảnh vào message');
  }
  
  // Send message to content script
  chrome.tabs.sendMessage(
    tab.id,
    message,
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
              log('⚠️ Content script không phản hồi đúng: ' + (response?.error || 'Unknown error'));
            }
          }
        );
      } else {
        log('⚠️ Không thể kiểm tra tab Scenebuilder');
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
  
  if (message.type === 'SCENEBUILDER_MASK') {
    showScenebuilderMask(message.show);
  }
});

// Initial log
log('Side panel đã load. Sẵn sàng sử dụng.');

