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

// Queue Management Elements
const queueImageInput = document.getElementById('queue-image-input');
const queueImagePreview = document.getElementById('queue-image-preview');
const queuePromptInput = document.getElementById('queue-prompt-input');
const addQueueBtn = document.getElementById('add-queue-btn');
const queueListEl = document.getElementById('queue-list');
const queueCountEl = document.getElementById('queue-count');
const startQueueBtn = document.getElementById('start-queue-btn');
const stopQueueBtn = document.getElementById('stop-queue-btn');
const clearQueueBtn = document.getElementById('clear-queue-btn');
const queueProgressEl = document.getElementById('queue-progress');
const queueProgressTextEl = document.getElementById('queue-progress-text');
const normalModeBtn = document.getElementById('normal-mode-btn');
const queueModeBtn = document.getElementById('queue-mode-btn');
const normalFlowSection = document.getElementById('normal-flow-section');
const queueSection = document.getElementById('queue-section');

// Queue State
let queueList = [];
let queueImageBase64 = null;
let nextQueueId = 1;
let currentMode = 'normal'; // 'normal' or 'queue'
let modeListenersAttached = false; // Flag để track việc đã attach event listeners

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

// Validate image file
function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'Không có file' };
  }
  
  // Kiểm tra loại file
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Vui lòng chọn file ảnh' };
  }
  
  // Giới hạn kích thước file (max 10MB) để tránh DoS
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB)` };
  }
  
  // Kiểm tra các định dạng ảnh hợp lệ
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validImageTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Định dạng ảnh không được hỗ trợ (chỉ hỗ trợ JPEG, PNG, GIF, WebP)' };
  }
  
  return { valid: true };
}

// Handle image input
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    imagePreview.classList.remove('visible');
    selectedImageBase64 = null;
    return;
  }
  
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    log('⚠️ ' + validation.error);
    imageInput.value = ''; // Reset input
    imagePreview.classList.remove('visible');
    selectedImageBase64 = null;
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    
    // Validate base64 format
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image/')) {
      log('❌ Lỗi: Base64 không hợp lệ');
      selectedImageBase64 = null;
      imagePreview.classList.remove('visible');
      return;
    }
    
    selectedImageBase64 = base64; // data URL (base64)
    imagePreview.src = selectedImageBase64;
    imagePreview.classList.add('visible');
    log('✓ Đã chọn ảnh: ' + file.name + ` (${(file.size / 1024).toFixed(2)}KB)`);
  };
  reader.onerror = () => {
    log('❌ Lỗi đọc file ảnh');
    selectedImageBase64 = null;
    imagePreview.classList.remove('visible');
  };
  reader.readAsDataURL(file);
});

// Validate prompt
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }
  // Kiểm tra không có script tags
  if (prompt.includes('<script') || prompt.includes('</script>')) {
    return false;
  }
  return true;
}

// Start button
startBtn.addEventListener('click', async () => {
  const list = promptsBox.value.split('\n').map(p => p.trim()).filter(Boolean);
  if (!list.length) {
    log('⚠️ Vui lòng nhập prompt');
    return;
  }
  
  // Validate tất cả prompts
  const invalidPrompts = list.filter(p => !validatePrompt(p));
  if (invalidPrompts.length > 0) {
    log(`⚠️ Có ${invalidPrompts.length} prompt không hợp lệ (quá dài hoặc chứa ký tự không cho phép)`);
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
        // Re-enable buttons
        startBtn.disabled = false;
        startQueueBtn.disabled = false;
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
  
  if (message.type === 'QUEUE_PROGRESS_UPDATE') {
    // Hiển thị progress
    if (queueProgressEl) {
      queueProgressEl.style.display = 'block';
    }
    
    // Cập nhật text progress
    if (queueProgressTextEl) {
      const { done, total, currentQueueNum, currentPromptNum, totalPromptsInCurrentQueue, totalPromptsProcessed } = message;
      
      if (currentQueueNum && currentPromptNum && totalPromptsInCurrentQueue) {
        queueProgressTextEl.textContent = `Queue ${currentQueueNum}/${total} - Prompt ${currentPromptNum}/${totalPromptsInCurrentQueue} (Tổng: ${totalPromptsProcessed || 0} prompts đã xử lý)`;
      } else {
        queueProgressTextEl.textContent = `Queue ${done + 1}/${total} (Tổng: ${totalPromptsProcessed || 0} prompts đã xử lý)`;
      }
    }
    
    // Hiển thị nút Stop, ẩn nút Start
    if (stopQueueBtn) {
      stopQueueBtn.style.display = 'inline-block';
    }
    if (startQueueBtn) {
      startQueueBtn.style.display = 'none';
    }
    const { done, total } = message;
    if (total > 0) {
      updateStatus(`Queue: ${done}/${total}`);
    }
  }
  
  if (message.type === 'FLOW_STATUS') {
    const status = message.status;
    updateStatus(status);
    
    // Disable/enable buttons based on status
    const isRunning = status === 'Running' || status === 'Queue Running';
    const isQueueRunning = status === 'Queue Running';
    startBtn.disabled = isRunning;
    startQueueBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;
    
    // Hiển thị/ẩn nút Stop Queue và progress
    if (isQueueRunning) {
      if (stopQueueBtn) {
        stopQueueBtn.style.display = 'inline-block';
      }
      if (startQueueBtn) {
        startQueueBtn.style.display = 'none';
      }
      if (queueProgressEl) {
        queueProgressEl.style.display = 'block';
      }
    } else {
      // Stopped hoặc Idle
      if (stopQueueBtn) {
        stopQueueBtn.style.display = 'none';
      }
      if (startQueueBtn) {
        startQueueBtn.style.display = 'inline-block';
      }
      if (queueProgressEl && (status === 'Stopped' || status === 'Idle')) {
        queueProgressEl.style.display = 'none';
      }
    }
  }
  
  if (message.type === 'SCENEBUILDER_MASK') {
    showScenebuilderMask(message.show);
  }
});

// ============================================
// QUEUE MANAGEMENT
// ============================================

// Generate unique ID for queue item
function generateQueueId() {
  return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Load queue list from storage
function loadQueueList() {
  chrome.storage?.local?.get(['veoQueueList', 'veoNextQueueId'], (data) => {
    if (data && data.veoQueueList) {
      queueList = data.veoQueueList;
      nextQueueId = data.veoNextQueueId || 1;
      renderQueueList();
      updateQueueCount();
    }
  });
}

// Save queue list to storage
function saveQueueList() {
  chrome.storage?.local?.set({ 
    veoQueueList: queueList,
    veoNextQueueId: nextQueueId
  });
}

// Add queue item
function addQueue() {
  const promptText = queuePromptInput.value.trim();
  
  if (!promptText) {
    log('⚠️ Vui lòng nhập prompt cho queue');
    return;
  }
  
  // Split thành nhiều prompt (mỗi dòng 1 prompt)
  const prompts = promptText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
  
  if (prompts.length === 0) {
    log('⚠️ Không có prompt hợp lệ');
    return;
  }
  
  // Validate tất cả prompts
  const invalidPrompts = prompts.filter(p => !validatePrompt(p));
  if (invalidPrompts.length > 0) {
    log('⚠️ Có prompt không hợp lệ (chứa ký tự không cho phép)');
    return;
  }
  
  // Validate image if provided
  if (queueImageBase64) {
    if (!queueImageBase64.startsWith('data:image/')) {
      log('⚠️ Ảnh không hợp lệ');
      return;
    }
  }
  
  const queueItem = {
    id: generateQueueId(),
    imageBase64: queueImageBase64,
    prompts: prompts, // Array of prompts
    order: queueList.length
  };
  
  queueList.push(queueItem);
  saveQueueList();
  renderQueueList();
  updateQueueCount();
  
  // Clear input
  queuePromptInput.value = '';
  queueImageInput.value = '';
  queueImageBase64 = null;
  queueImagePreview.src = '';
  queueImagePreview.classList.remove('visible');
  
  log(`✓ Đã thêm queue #${queueList.length} với ${prompts.length} prompt(s)`);
}

// Remove queue item
function removeQueue(queueId) {
  const index = queueList.findIndex(q => q.id === queueId);
  if (index === -1) return;
  
  queueList.splice(index, 1);
  // Reorder
  queueList.forEach((q, i) => {
    q.order = i;
  });
  
  saveQueueList();
  renderQueueList();
  updateQueueCount();
  log(`✓ Đã xóa queue #${index + 1}`);
}

// Update queue item
function updateQueue(queueId, updates) {
  const index = queueList.findIndex(q => q.id === queueId);
  if (index === -1) return;
  
  const queueItem = queueList[index];
  if (updates.prompt !== undefined) {
    if (!validatePrompt(updates.prompt)) {
      log('⚠️ Prompt không hợp lệ');
      return false;
    }
    queueItem.prompt = updates.prompt;
  }
  if (updates.imageBase64 !== undefined) {
    if (updates.imageBase64 && !updates.imageBase64.startsWith('data:image/')) {
      log('⚠️ Ảnh không hợp lệ');
      return false;
    }
    queueItem.imageBase64 = updates.imageBase64;
  }
  
  saveQueueList();
  renderQueueList();
  log(`✓ Đã cập nhật queue #${index + 1}`);
  return true;
}

// Reorder queue items
function reorderQueue(queueId, direction) {
  const index = queueList.findIndex(q => q.id === queueId);
  if (index === -1) return;
  
  if (direction === 'up' && index > 0) {
    // Swap with previous
    [queueList[index], queueList[index - 1]] = [queueList[index - 1], queueList[index]];
    queueList[index].order = index;
    queueList[index - 1].order = index - 1;
  } else if (direction === 'down' && index < queueList.length - 1) {
    // Swap with next
    [queueList[index], queueList[index + 1]] = [queueList[index + 1], queueList[index]];
    queueList[index].order = index;
    queueList[index + 1].order = index + 1;
  } else {
    return; // Cannot move
  }
  
  saveQueueList();
  renderQueueList();
  log(`✓ Đã di chuyển queue`);
}

// Render queue list
function renderQueueList() {
  queueListEl.innerHTML = '';
  
  if (queueList.length === 0) {
    queueListEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 12px;">Chưa có queue nào. Thêm queue để bắt đầu.</div>';
    return;
  }
  
  // Sort by order
  const sortedQueue = [...queueList].sort((a, b) => a.order - b.order);
  
  sortedQueue.forEach((queueItem, index) => {
    const queueItemEl = document.createElement('div');
    queueItemEl.className = 'queue-item';
    
    // Preview image or placeholder
    const previewEl = document.createElement('div');
    if (queueItem.imageBase64) {
      const img = document.createElement('img');
      img.src = queueItem.imageBase64;
      img.className = 'queue-item-preview';
      previewEl.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'queue-item-preview no-image';
      placeholder.textContent = '📷';
      previewEl.appendChild(placeholder);
    }
    
    // Content
    const contentEl = document.createElement('div');
    contentEl.className = 'queue-item-content';
    
    const numberEl = document.createElement('div');
    numberEl.className = 'queue-item-number';
    numberEl.textContent = `#${index + 1}`;
    
    const promptEl = document.createElement('div');
    promptEl.className = 'queue-item-prompt';
    // Hiển thị prompts (nếu là array thì join, nếu là string thì dùng trực tiếp - backward compatible)
    const prompts = Array.isArray(queueItem.prompts) ? queueItem.prompts : (queueItem.prompt ? [queueItem.prompt] : []);
    const promptText = prompts.length > 0 ? (prompts.length === 1 ? prompts[0] : `${prompts.length} prompts: ${prompts[0].substring(0, 40)}${prompts[0].length > 40 ? '...' : ''}`) : 'No prompts';
    promptEl.textContent = promptText;
    promptEl.title = prompts.join('\n'); // Tooltip hiển thị tất cả prompts
    
    contentEl.appendChild(numberEl);
    contentEl.appendChild(promptEl);
    
    // Actions
    const actionsEl = document.createElement('div');
    actionsEl.className = 'queue-item-actions';
    
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'secondary small';
    editBtn.textContent = '✏️';
    editBtn.title = 'Sửa';
    editBtn.onclick = () => editQueueItem(queueItem.id);
    
    // Move up button
    const upBtn = document.createElement('button');
    upBtn.className = 'secondary small';
    upBtn.textContent = '↑';
    upBtn.title = 'Lên';
    upBtn.disabled = index === 0;
    upBtn.onclick = () => reorderQueue(queueItem.id, 'up');
    
    // Move down button
    const downBtn = document.createElement('button');
    downBtn.className = 'secondary small';
    downBtn.textContent = '↓';
    downBtn.title = 'Xuống';
    downBtn.disabled = index === queueList.length - 1;
    downBtn.onclick = () => reorderQueue(queueItem.id, 'down');
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger small';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Xóa';
    deleteBtn.onclick = () => {
      if (confirm(`Xóa queue #${index + 1}?`)) {
        removeQueue(queueItem.id);
      }
    };
    
    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(upBtn);
    actionsEl.appendChild(downBtn);
    actionsEl.appendChild(deleteBtn);
    
    queueItemEl.appendChild(previewEl);
    queueItemEl.appendChild(contentEl);
    queueItemEl.appendChild(actionsEl);
    
    queueListEl.appendChild(queueItemEl);
  });
}

// Edit queue item
function editQueueItem(queueId) {
  const queueItem = queueList.find(q => q.id === queueId);
  if (!queueItem) return;
  
  // Fill input fields - backward compatible với prompt string hoặc prompts array
  const prompts = Array.isArray(queueItem.prompts) ? queueItem.prompts : (queueItem.prompt ? [queueItem.prompt] : []);
  queuePromptInput.value = prompts.join('\n');
  if (queueItem.imageBase64) {
    queueImageBase64 = queueItem.imageBase64;
    queueImagePreview.src = queueImageBase64;
    queueImagePreview.classList.add('visible');
  } else {
    queueImageBase64 = null;
    queueImagePreview.src = '';
    queueImagePreview.classList.remove('visible');
  }
  queueImageInput.value = ''; // Clear file input
  
  // Remove from list
  removeQueue(queueId);
  
  log(`📝 Đang chỉnh sửa queue, nhập lại và ấn Add Queue để cập nhật`);
}

// Update queue count
function updateQueueCount() {
  queueCountEl.textContent = queueList.length;
}

// Clear all queues
function clearAllQueues() {
  if (queueList.length === 0) return;
  
  if (confirm(`Xóa tất cả ${queueList.length} queue?`)) {
    queueList = [];
    saveQueueList();
    renderQueueList();
    updateQueueCount();
    log('✓ Đã xóa tất cả queue');
  }
}

// Handle queue image input
queueImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    queueImagePreview.classList.remove('visible');
    queueImageBase64 = null;
    return;
  }
  
  const validation = validateImageFile(file);
  if (!validation.valid) {
    log('⚠️ ' + validation.error);
    queueImageInput.value = '';
    queueImagePreview.classList.remove('visible');
    queueImageBase64 = null;
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image/')) {
      log('❌ Lỗi: Base64 không hợp lệ');
      queueImageBase64 = null;
      queueImagePreview.classList.remove('visible');
      return;
    }
    
    queueImageBase64 = base64;
    queueImagePreview.src = queueImageBase64;
    queueImagePreview.classList.add('visible');
  };
  reader.onerror = () => {
    log('❌ Lỗi đọc file ảnh');
    queueImageBase64 = null;
    queueImagePreview.classList.remove('visible');
  };
  reader.readAsDataURL(file);
});

// Add Queue button
addQueueBtn.addEventListener('click', addQueue);

// Stop Queue button
stopQueueBtn.addEventListener('click', async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      log('❌ Không tìm thấy tab');
      return;
    }
    
    // Send STOP_FLOW message to content script
    await chrome.tabs.sendMessage(tab.id, { type: 'STOP_FLOW' });
    log('⏹️ Đã gửi lệnh dừng queue');
    
    // Ẩn nút Stop, hiển thị nút Start
    if (stopQueueBtn) {
      stopQueueBtn.style.display = 'none';
    }
    if (startQueueBtn) {
      startQueueBtn.style.display = 'inline-block';
      startQueueBtn.disabled = false;
    }
    if (queueProgressEl) {
      queueProgressEl.style.display = 'none';
    }
  } catch (e) {
    log('❌ Lỗi khi dừng queue: ' + e);
  }
});

// Start Queue button
startQueueBtn.addEventListener('click', async () => {
  if (queueList.length === 0) {
    log('⚠️ Chưa có queue nào để chạy');
    return;
  }
  
  // Disable button và hiển thị nút Stop
  startQueueBtn.disabled = true;
  startBtn.disabled = true;
  if (stopQueueBtn) {
    stopQueueBtn.style.display = 'inline-block';
  }
  if (startQueueBtn) {
    startQueueBtn.style.display = 'none';
  }
  if (queueProgressEl) {
    queueProgressEl.style.display = 'block';
  }
  if (queueProgressTextEl) {
    queueProgressTextEl.textContent = 'Đang khởi động...';
  }
  
  // Sort by order
  const sortedQueue = [...queueList].sort((a, b) => a.order - b.order);
  
  // Prepare queue list for content script
  // Backward compatible: nếu có prompts array thì dùng, nếu không thì dùng prompt string
  const queueListForContent = sortedQueue.map(q => {
    const prompts = Array.isArray(q.prompts) ? q.prompts : (q.prompt ? [q.prompt] : []);
    return {
      imageBase64: q.imageBase64 || null,
      prompts: prompts // Array of prompts
    };
  });
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    log('❌ Không tìm thấy tab');
    startQueueBtn.disabled = false;
    startBtn.disabled = false;
    return;
  }
  
  // Check URL
  if (!tab.url || !tab.url.includes('labs.google')) {
    log('❌ Vui lòng mở trang Google Flow trước!');
    startQueueBtn.disabled = false;
    startBtn.disabled = false;
    return;
  }
  
  // Check Scenebuilder tab
  log('🔍 Đang kiểm tra tab Scenebuilder...');
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'CHECK_SCENEBUILDER_TAB' },
    (response) => {
      if (chrome.runtime.lastError) {
        log('❌ Lỗi: ' + chrome.runtime.lastError.message);
        log('💡 Thử refresh trang Google Flow');
        startQueueBtn.disabled = false;
        startBtn.disabled = false;
        return;
      }
      
      if (response && response.ok) {
        if (!response.isScenebuilder) {
          log('❌ Không phải tab Scenebuilder! Vui lòng mở tab Scenebuilder để sử dụng extension.');
          showScenebuilderMask(true);
          startQueueBtn.disabled = false;
          startBtn.disabled = false;
          return;
        }
        
        showScenebuilderMask(false);
        log('✅ Đã xác nhận tab Scenebuilder');
        log(`Gửi START_QUEUE với ${queueListForContent.length} queue...`);
        
        // Send START_QUEUE message
        chrome.tabs.sendMessage(
          tab.id,
          {
            type: 'START_QUEUE',
            queueList: queueListForContent
          },
          (response) => {
            if (chrome.runtime.lastError) {
              log('❌ Lỗi: ' + chrome.runtime.lastError.message);
              log('💡 Thử refresh trang Google Flow');
              startQueueBtn.disabled = false;
              startBtn.disabled = false;
              return;
            }
            
            if (response && response.ok) {
              log('✓ Đã gửi START_QUEUE');
              updateStatus('Queue Running');
            } else {
              log('⚠️ Content script không phản hồi đúng: ' + (response?.error || 'Unknown error'));
              startQueueBtn.disabled = false;
              startBtn.disabled = false;
            }
          }
        );
      } else {
        log('⚠️ Không thể kiểm tra tab Scenebuilder');
        startQueueBtn.disabled = false;
        startBtn.disabled = false;
      }
    }
  );
});

// Clear Queue button
clearQueueBtn.addEventListener('click', clearAllQueues);

// Switch between Normal and Queue mode
function switchMode(mode, forceUpdate = false) {
  // Bỏ qua check nếu forceUpdate = true (khi khởi tạo)
  if (!forceUpdate && mode === currentMode) return;
  
  currentMode = mode;
  
  if (mode === 'normal') {
    // Show normal flow, hide queue
    normalFlowSection.classList.remove('hidden');
    queueSection.classList.add('hidden');
    normalModeBtn.classList.remove('inactive');
    normalModeBtn.classList.add('active');
    queueModeBtn.classList.remove('active');
    queueModeBtn.classList.add('inactive');
  } else {
    // Show queue, hide normal flow
    normalFlowSection.classList.add('hidden');
    queueSection.classList.remove('hidden');
    queueModeBtn.classList.remove('inactive');
    queueModeBtn.classList.add('active');
    normalModeBtn.classList.remove('active');
    normalModeBtn.classList.add('inactive');
    // Load queue list when switching to queue mode
    loadQueueList();
  }
  
  // Save preference
  chrome.storage?.local?.set({ veoCurrentMode: currentMode });
}

// Initialize mode and event listeners when DOM is ready
function initializeMode() {
  // Ensure buttons exist
  if (!normalModeBtn || !queueModeBtn || !normalFlowSection || !queueSection) {
    // Retry after a short delay if elements not ready
    setTimeout(initializeMode, 100);
    return;
  }
  
  // Mode toggle button events - attach only once
  if (!modeListenersAttached) {
    normalModeBtn.addEventListener('click', () => switchMode('normal'));
    queueModeBtn.addEventListener('click', () => switchMode('queue'));
    modeListenersAttached = true;
  }
  
  // Load mode preference
  chrome.storage?.local?.get(['veoCurrentMode'], (data) => {
    if (data && data.veoCurrentMode) {
      currentMode = data.veoCurrentMode;
      // Force update UI khi khởi tạo
      switchMode(currentMode, true);
    } else {
      // Default to normal mode, force update UI
      switchMode('normal', true);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMode);
} else {
  // DOM already loaded
  initializeMode();
}

// Load queue list on init
loadQueueList();

// Initial log
log('Side panel đã load. Sẵn sàng sử dụng.');

