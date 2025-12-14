// content.js
// Chrome Extension for Google Flow - Veo 3 Auto Prompt Automation

let isRunning = false;
let prompts = [];
let currentPromptIndex = 0;

// ============================================
// MESSAGING & DEBUG
// ============================================

function debugLog(text) {
  chrome.runtime.sendMessage({ type: 'DEBUG_LOG', text });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_FLOW') {
    if (isRunning) {
      debugLog('Đã chạy rồi, bỏ qua START_FLOW');
      return;
    }
    prompts = message.prompts;
    currentPromptIndex = 0;
    isRunning = true;
    debugLog('Bắt đầu flow với ' + prompts.length + ' prompt');
    runFlow();
    sendResponse && sendResponse({ ok: true });
  }
  
  if (message.type === 'STOP_FLOW') {
    isRunning = false;
    debugLog('Đã dừng flow');
    sendResponse && sendResponse({ ok: true });
  }
  
  if (message.type === 'DEBUG_TEST') {
    debugLog('content.js đã nhận DEBUG_TEST');
    sendResponse && sendResponse({ ok: true });
  }
});

// ============================================
// MAIN FLOW
// ============================================

async function runFlow() {
  while (isRunning && currentPromptIndex < prompts.length) {
    try {
      debugLog('🎬 Đang xử lý prompt #' + (currentPromptIndex + 1));
      
      // Chờ video render xong (nếu không phải prompt đầu tiên)
      if (currentPromptIndex > 0) {
        await waitForVideoRendered();
      }
      
      await saveFrameAsAsset();
      await openImagePicker();
      await selectLatestAsset();
      await inputPrompt(prompts[currentPromptIndex]);
      await clickGenerate();
      
      debugLog('✅ Đã xong prompt #' + (currentPromptIndex + 1));
      currentPromptIndex++;
      
    } catch (e) {
      debugLog('❌ Lỗi: ' + e);
      isRunning = false;
      break;
    }
  }
  
  debugLog('🏁 Kết thúc flow.');
  isRunning = false;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Chờ element xuất hiện trong DOM
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    
    const observer = new MutationObserver(() => {
      const el2 = document.querySelector(selector);
      if (el2) {
        observer.disconnect();
        resolve(el2);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
      observer.disconnect();
      reject('Timeout waiting for selector: ' + selector);
    }, timeout);
  });
}

// ============================================
// AUTOMATION STEPS
// ============================================

/**
 * STEP 1: Chờ video render xong
 * Dấu hiệu: 
 * - Không còn % progress (50%, 75%, etc)
 * - Nút save frame (icon add) xuất hiện
 * - Video đã có trong timeline
 */
async function waitForVideoRendered() {
  debugLog('⏳ Chờ video render xong...');
  
  try {
    // Bước 1: Chờ progress biến mất
    debugLog('📊 Chờ progress bar biến mất...');
    let attempts = 0;
    const maxAttempts = 120; // 2 phút (120 * 1000ms)
    
    while (attempts < maxAttempts) {
      // Tìm progress text (50%, 75%, etc)
      const progressElements = document.querySelectorAll('*');
      let hasProgress = false;
      
      for (const el of progressElements) {
        const text = el.textContent.trim();
        // Check nếu có text dạng "50%" hoặc "75%"
        if (/^\d+%$/.test(text) && el.offsetParent !== null) {
          hasProgress = true;
          break;
        }
      }
      
      if (!hasProgress) {
        debugLog('✓ Progress đã biến mất');
        break;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      throw 'Timeout chờ video render (2 phút)';
    }
    
    // Bước 2: Chờ thêm 2s để chắc chắn
    await new Promise(r => setTimeout(r, 2000));
    
    // Bước 3: Kiểm tra nút save frame đã xuất hiện
    debugLog('🔍 Kiểm tra nút save frame...');
    const saveBtn = Array.from(
      document.querySelectorAll('button[aria-haspopup="menu"] i.google-symbols')
    ).find(i => i.textContent.trim() === 'add');
    
    if (!saveBtn) {
      debugLog('⚠️ Chưa thấy nút save frame, chờ thêm 2s...');
      await new Promise(r => setTimeout(r, 2000));
    }
    
    debugLog('✓ Video đã render xong.');
    
  } catch (e) {
    debugLog('⚠️ waitForVideoRendered: Lỗi ' + e);
    throw e;
  }
}

/**
 * STEP 2: Kéo slider đến cuối video và save frame as asset
 * - Inject script vào main world để có quyền tương tác với slider
 * - Kéo slider đến 100% bằng pointer events
 * - Click nút save frame
 */
async function saveFrameAsAsset() {
  debugLog('📍 saveFrameAsAsset: Bắt đầu...');
  
  try {
    // Inject script nếu chưa có
    if (!window.__sliderDragInjected) {
      debugLog('🔧 Đang inject script vào main world...');
      
      // Tạo script tag và load từ extension
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = function() {
        this.remove();
        debugLog('✓ injected.js đã load và remove');
      };
      (document.head || document.documentElement).appendChild(script);
      
      window.__sliderDragInjected = true;
      debugLog('✓ Đã inject script main world.');
      
      // Chờ script được execute
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Gửi message yêu cầu kéo slider
    debugLog('🎯 Gửi yêu cầu kéo slider đến cuối...');
    const result = await new Promise((resolve, reject) => {
      let resolved = false;
      
      function handler(e) {
        if (e.data && e.data.type === 'SEEK_TO_END_VIDEO_RESULT') {
          if (resolved) return; // Tránh resolve nhiều lần
          resolved = true;
          window.removeEventListener('message', handler);
          debugLog('📨 Nhận kết quả từ main world: ok=' + e.data.ok + ', error=' + e.data.error);
          resolve(e.data);
        }
      }
      
      window.addEventListener('message', handler);
      
      debugLog('📤 Gửi message SEEK_TO_END_VIDEO_REQUEST');
      window.postMessage({ type: 'SEEK_TO_END_VIDEO_REQUEST' }, '*');
      
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('message', handler);
        debugLog('⏱️ Timeout - không nhận được response sau 5s');
        reject('Timeout kéo slider (5s)');
      }, 5000);
    });
    
    if (!result.ok) {
      throw 'Không kéo được slider đến cuối: ' + (result.error || 'unknown');
    }
    
    debugLog('✓ Đã kéo slider đến cuối');
    await new Promise(r => setTimeout(r, 400));
    
    // Tìm và click nút save frame (icon "add")
    debugLog('🔍 Tìm nút save frame...');
    const saveBtn = Array.from(
      document.querySelectorAll('button[aria-haspopup="menu"] i.google-symbols')
    ).find(i => i.textContent.trim() === 'add');
    
    if (!saveBtn) {
      debugLog('❌ Không tìm thấy nút save frame');
      throw 'Không tìm thấy nút save frame';
    }
    
    const btn = saveBtn.closest('button');
    debugLog('✓ Tìm thấy nút save frame');
    
    // Hover để mở menu
    debugLog('🖱️ Hover để mở menu...');
    btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    
    // Chờ menu xuất hiện
    await new Promise(r => setTimeout(r, 500));
    
    // Tìm menu item "Save frame as asset"
    debugLog('🔍 Tìm menu item Save frame...');
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    debugLog(`Tìm thấy ${menuItems.length} menu items`);
    
    const saveMenuItem = Array.from(menuItems).find(item => {
      const text = item.textContent.toLowerCase();
      return text.includes('save') && text.includes('frame');
    });
    
    if (!saveMenuItem) {
      debugLog('❌ Không tìm thấy menu item Save frame');
      debugLog('Menu items có: ' + Array.from(menuItems).map(m => m.textContent).join(', '));
      throw 'Không tìm thấy menu item Save frame';
    }
    
    debugLog('✓ Tìm thấy menu item: ' + saveMenuItem.textContent);
    
    // Click menu item
    saveMenuItem.click();
    debugLog('✓ Đã click Save frame as asset.');
    
    // Chờ asset được lưu
    await new Promise(r => setTimeout(r, 1000));
    
  } catch (e) {
    debugLog('❌ saveFrameAsAsset: Lỗi ' + e);
    throw e;
  }
}

// XÓA hàm seekToEndOfVideoMainWorld cũ vì đã inline vào script injection

/**
 * STEP 3: Mở asset picker (có thể bỏ qua nếu tự hiện)
 */
async function openImagePicker() {
  debugLog('🖼️ openImagePicker: Chờ asset picker hiện...');
  // Asset picker thường tự hiện sau khi save frame
  await new Promise(r => setTimeout(r, 500));
}

/**
 * STEP 4: Chọn asset mới nhất (data-index="1")
 * Asset list sorted newest -> oldest
 */
async function selectLatestAsset() {
  debugLog('🎨 selectLatestAsset: Chọn asset mới nhất...');
  
  try {
    // Chờ asset list hiện
    const assetList = await waitForElement('.virtuoso-grid-list', 8000);
    
    // Chờ loading icon biến mất
    let tries = 0;
    while (document.querySelector('.sc-21a999a-8.bDuNSZ') && tries < 20) {
      await new Promise(r => setTimeout(r, 300));
      tries++;
    }
    
    // Chọn asset đầu tiên sau nút upload (data-index="1")
    const assetBtn = document.querySelector('[data-index="1"] button');
    if (!assetBtn) throw 'Không tìm thấy asset mới nhất';
    
    assetBtn.click();
    debugLog('✓ Đã chọn asset mới nhất.');
    
    await new Promise(r => setTimeout(r, 500));
    
  } catch (e) {
    debugLog('❌ selectLatestAsset: Lỗi ' + e);
    throw e;
  }
}

/**
 * STEP 5: Nhập prompt vào textarea
 */
async function inputPrompt(prompt) {
  debugLog('⌨️ inputPrompt: Nhập prompt...');
  
  try {
    const textarea = await waitForElement('#PINHOLE_TEXT_AREA_ELEMENT_ID', 6000);
    
    // Focus và clear
    textarea.focus();
    textarea.value = '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 100));
    
    // Nhập prompt mới
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    debugLog('✓ Đã nhập prompt.');
    await new Promise(r => setTimeout(r, 300));
    
  } catch (e) {
    debugLog('❌ inputPrompt: Lỗi ' + e);
    throw e;
  }
}

/**
 * STEP 6: Click nút Generate
 */
async function clickGenerate() {
  debugLog('🚀 clickGenerate: Click nút generate...');
  
  try {
    // Tìm button có icon arrow_forward
    const genBtn = Array.from(
      document.querySelectorAll('button i.google-symbols')
    ).find(i => i.textContent.trim() === 'arrow_forward');
    
    if (!genBtn) throw 'Không tìm thấy nút generate';
    
    const btn = genBtn.closest('button');
    btn.click();
    
    debugLog('✓ Đã click generate.');
    await new Promise(r => setTimeout(r, 800));
    
  } catch (e) {
    debugLog('❌ clickGenerate: Lỗi ' + e);
    throw e;
  }
}