/**
 * Scroll asset list (timeline) đến cuối để đảm bảo slider kéo được đến frame cuối cùng
 * Dựa trên logic tìm container có nhiều children thumbnails, sau đó scroll grandParent
 */
async function scrollAssetListToEnd() {
  debugLog('📽 scrollAssetListToEnd: Đang scroll asset list đến cuối...');
  
  try {
    // Tìm các div có nhiều children (có thể là container chứa thumbnails)
    // Không dùng class động, chỉ dựa vào số lượng children và cấu trúc DOM
    const candidates = Array.from(document.querySelectorAll('div')).filter(div => {
      // Tìm div có ít nhất 5 children (giống logic code console)
      // Và children có thể là thumbnails (có button hoặc có background-image)
      // Tối ưu: check button trước (nhanh hơn), chỉ tính style nếu không có button
      const childThumbs = Array.from(div.children).filter(child => {
        // Kiểm tra button trước (nhanh hơn querySelector)
        if (child.querySelector('button')) return true;
        // Chỉ tính style nếu không có button
        const style = window.getComputedStyle(child);
        return style.backgroundImage && style.backgroundImage !== 'none';
      });
      return childThumbs.length >= 5;
    });
    
    if (candidates.length === 0) {
      debugLog('⚠️ Không tìm thấy container có nhiều thumbnails');
      return;
    }
    
    // Lấy candidate đầu tiên
    const container = candidates[0];
    const parent = container.parentElement;
    const grandParent = parent?.parentElement;
    
    if (!grandParent) {
      debugLog('⚠️ Không tìm thấy grandParent');
      return;
    }
    
    debugLog(`📊 ScrollWidth: ${grandParent.scrollWidth}, ClientWidth: ${grandParent.clientWidth}`);
    debugLog(`📊 Current scrollLeft: ${grandParent.scrollLeft}`);
    
    const maxScrollLeft = grandParent.scrollWidth - grandParent.clientWidth;
    debugLog(`📊 Max scrollLeft: ${maxScrollLeft}`);
    
    if (maxScrollLeft <= 0) {
      debugLog('ℹ️ Không cần scroll (đã ở cuối hoặc không scroll được)');
      return;
    }
    
    // Set scrollLeft trực tiếp
    grandParent.scrollLeft = maxScrollLeft;
    await new Promise(r => setTimeout(r, 300));
    
    const finalScrollLeft = grandParent.scrollLeft;
    debugLog(`📊 ScrollLeft sau khi set: ${finalScrollLeft}`);
    
    if (Math.abs(finalScrollLeft - maxScrollLeft) < 10) {
      debugLog('✅ Scroll asset list thành công');
    } else {
      debugLog(`⚠️ Scroll chưa hết: ${finalScrollLeft} / ${maxScrollLeft}`);
    }
    
  } catch (e) {
    debugLog('⚠️ scrollAssetListToEnd lỗi: ' + e);
  }
}
// content.js
// Chrome Extension for Google Flow - Veo 3 Auto Prompt Automation

let isRunning = false;
let prompts = [];
let currentPromptIndex = 0;
let totalPrompts = 0;
let restartTimeoutId = null;
let userStopped = false;

function clearRestartTimer() {
  if (restartTimeoutId) {
    clearTimeout(restartTimeoutId);
    restartTimeoutId = null;
  }
}

function scheduleAutoRestart(reason) {
  clearRestartTimer();
  if (userStopped) {
    debugLog(`⏸️ Bỏ qua auto-restart vì user đã stop (${reason})`);
    return;
  }
  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Waiting restart' });
  debugLog(`⏳ Sẽ tự chạy lại flow sau 10s... (${reason})`);
  restartTimeoutId = setTimeout(() => {
    if (userStopped) return;
    isRunning = true;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
    debugLog('🔄 Đang tự chạy lại flow từ prompt #' + (currentPromptIndex + 1));
    runFlow();
  }, 10000);
}

// ============================================
// MESSAGING & DEBUG
// ============================================

function debugLog(text) {
  chrome.runtime.sendMessage({ type: 'DEBUG_LOG', text });
}

function sendProgressUpdate() {
  try {
    chrome.runtime.sendMessage({
      type: 'PROGRESS_UPDATE',
      done: currentPromptIndex,
      total: totalPrompts
    });
  } catch (_) {}
}


// Helper: Kiểm tra có progress % đang chạy không
function isProgressRunning() {
  return Array.from(document.querySelectorAll('*')).some(el => {
    const text = el.textContent.trim();
    return /^\d+%$/.test(text) && el.offsetParent !== null;
  });
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_FLOW') {
    if (isRunning) {
      debugLog('Đã chạy rồi, bỏ qua START_FLOW');
      return;
    }
    userStopped = false;
    clearRestartTimer();
    // Kiểm tra nếu còn video đang render thì không cho chạy flow mới
    if (isProgressRunning()) {
      debugLog('⚠️ Đang có video render, không thể chạy flow mới!');
      sendResponse && sendResponse({ ok: false, error: 'Video đang render' });
      return;
    }
    prompts = message.prompts;
    currentPromptIndex = 0;
    totalPrompts = prompts.length;
    isRunning = true;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
    debugLog('Bắt đầu flow với ' + prompts.length + ' prompt');
    sendProgressUpdate();
    runFlow();
    sendResponse && sendResponse({ ok: true });
  }
  
  if (message.type === 'STOP_FLOW') {
    userStopped = true;
    isRunning = false;
    clearRestartTimer();
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
    debugLog('Đã dừng flow');
    sendResponse && sendResponse({ ok: true });
  }
  
  if (message.type === 'DEBUG_TEST') {
    debugLog('content.js đã nhận DEBUG_TEST');
    sendResponse && sendResponse({ ok: true });
  }
});

// ============================================
// HELPER: Đếm số lượng assets ưu tiên selector ổn định
// ============================================
function getAssetCount() {
  try {
    // Ưu tiên: tìm grid container trước
    const grid = document.querySelector('.virtuoso-grid-list') || document.querySelector('[role="grid"]');
    if (grid) {
      const count = grid.querySelectorAll('[data-index] button').length;
      if (count > 0) return count;
    }

    // Fallback: tìm tất cả button có data-index
    const count = document.querySelectorAll('[data-index] button').length;
    if (count > 0) return count;

    // Fallback cuối: thumbnails có background-image (chỉ khi không tìm thấy button)
    const thumbnails = Array.from(document.querySelectorAll('div')).slice(0, 200).filter(div => {
      const style = window.getComputedStyle(div);
      return style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url(');
    });
    return thumbnails.length;
  } catch (e) {
    debugLog('getAssetCount lỗi: ' + e);
    return 0;
  }
}


// ============================================
// MAIN FLOW - UPDATED
// ============================================
async function runFlow() {
  while (isRunning && currentPromptIndex < prompts.length) {
    if (userStopped) {
      debugLog('⏹️ Flow dừng theo yêu cầu người dùng.');
      isRunning = false;
      chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
      return;
    }
    try {
      debugLog('🎬 Đang xử lý prompt #' + (currentPromptIndex + 1));

      // Đếm số lượng asset TRƯỚC KHI chờ video render
      const prevAssetCount = getAssetCount();
      debugLog('📊 Số assets trước khi chờ render: ' + prevAssetCount);

      let success = false;
      let retryCount = 0;
      
      while (!success && retryCount < 5 && !userStopped) {
        try {
          // Luôn scroll asset list đến cuối trước mỗi prompt
          await scrollAssetListToEnd();
          await saveFrameAsAsset();
          await openImagePicker();
          await selectLatestAsset();
          await inputPrompt(prompts[currentPromptIndex]);
          await clickGenerate();

          // Chờ asset mới xuất hiện (tối đa 3 phút)
          debugLog('⏳ Đang chờ asset mới xuất hiện...');
          let waitTries = 0;
          let newAssetCount = getAssetCount();
          
          while (newAssetCount <= prevAssetCount && waitTries < 180) { // 180 * 1s = 180s = 3 phút
            await new Promise(r => setTimeout(r, 1000));
            newAssetCount = getAssetCount();
            waitTries++;
            
            // Log progress mỗi 10s
            if (waitTries % 20 === 0) {
              debugLog(`  Đã chờ ${waitTries / 2}s... (${prevAssetCount} → ${newAssetCount})`);
            }
          }
          
          if (newAssetCount > prevAssetCount) {
            debugLog('✅ Đã xong prompt #' + (currentPromptIndex + 1) + ', asset mới đã được thêm (' + prevAssetCount + ' → ' + newAssetCount + ')');
            success = true;
            currentPromptIndex++;
            sendProgressUpdate();
          } else {
            debugLog('⚠️ Asset mới chưa được thêm sau 3 phút, sẽ retry prompt này.');
            retryCount++;
            
            if (retryCount < 5) {
              debugLog(`🔄 Retry lần ${retryCount}/5...`);
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        } catch (e) {
          debugLog('❌ Lỗi khi chạy prompt: ' + e);
          retryCount++;
          
          if (retryCount < 5) {
            debugLog(`🔄 Retry lần ${retryCount}/5 sau lỗi...`);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      
      if (!success && !userStopped) {
        debugLog('❌ Không thể tạo asset mới sau ' + retryCount + ' lần thử.');
        debugLog('⏸️ Dừng flow tạm thời.');
        isRunning = false;
        scheduleAutoRestart('retry hết');
        return;
      }

    } catch (e) {
      debugLog('❌ Lỗi không mong đợi: ' + e);
      isRunning = false;
      scheduleAutoRestart('exception');
      return;
    }
  }

  debugLog('🎉 Kết thúc flow.');
  isRunning = false;
  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Idle' });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Chờ element xuất hiện trong DOM (kể cả thay đổi attributes hiển thị)
 */
function waitForElement(selector, timeout = 10000, { visible = false } = {}) {
  return new Promise((resolve, reject) => {
    const pick = () => {
      const el = document.querySelector(selector);
      if (!el) return null;
      if (visible && el.offsetParent === null) return null;
      return el;
    };

    const first = pick();
    if (first) return resolve(first);
    
    const observer = new MutationObserver(() => {
      const el2 = pick();
      if (el2) {
        observer.disconnect();
        resolve(el2);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-hidden', 'hidden'] });
    
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
 * STEP 2: Kéo slider đến cuối video và save frame as asset
 * - Inject script vào main world để có quyền tương tác với slider
 * - Kéo slider đến 100% bằng pointer events
 * - Click nút save frame
 */
async function saveFrameAsAsset() {
  debugLog('📍 saveFrameAsAsset: Bắt đầu...');
  
  try {
    // Scroll asset list đến cuối trước khi thao tác slider
    await scrollAssetListToEnd();

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
          if (resolved) return;
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
    await new Promise(r => setTimeout(r, 1000));

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
    await new Promise(r => setTimeout(r, 1000));
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


/**
 * STEP 3: Mở asset picker (có thể bỏ qua nếu tự hiện)
 */
async function openImagePicker() {
  debugLog('🖼️ openImagePicker: Chờ asset picker hiện...');
  // Asset picker thường tự hiện sau khi save frame
  await new Promise(r => setTimeout(r, 1000));
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

    // Chờ icon upload xuất hiện (i.google-symbols có textContent 'upload')
    let tries = 0;
    const maxTries = 40; // 10s
    function isUploadIconVisible() {
      return Array.from(document.querySelectorAll('i.google-symbols')).some(i => i.textContent.trim().toLowerCase() === 'upload');
    }
    while (!isUploadIconVisible() && tries < maxTries) {
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }
    if (!isUploadIconVisible()) {
      debugLog('⚠️ Không thấy icon upload sau khi chờ. Vẫn tiếp tục.');
    } else {
      debugLog('✓ Đã thấy icon upload, asset list đã sẵn sàng.');
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
