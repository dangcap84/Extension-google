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
let initialImageFile = null; // Base64 string của ảnh bắt đầu

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
    initialImageFile = message.initialImageFile || null; // Lưu ảnh bắt đầu nếu có
    isRunning = true;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
    debugLog('Bắt đầu flow với ' + prompts.length + ' prompt');
    if (initialImageFile) {
      debugLog('📷 Có ảnh bắt đầu được cung cấp');
    }
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

/**
 * Check xem có video trong scene builder chưa
 * @returns {boolean} true nếu có video, false nếu chưa có
 */
function hasVideoInScene() {
  try {
    // Check số lượng assets > 0 (nếu có assets thì có thể có video)
    const assetCount = getAssetCount();
    if (assetCount > 0) {
      // Check xem có slider/timeline không (dấu hiệu có video)
      // Tìm các element có thể là timeline/slider
      const hasTimeline = Array.from(document.querySelectorAll('*')).some(el => {
        // Check nếu có element liên quan đến video timeline
        // Có thể check bằng cách tìm nút save frame (chỉ có khi có video)
        const saveBtn = Array.from(
          document.querySelectorAll('button[aria-haspopup="menu"] i.google-symbols')
        ).find(i => i.textContent.trim() === 'add');
        return saveBtn !== undefined;
      });
      
      if (hasTimeline) {
        return true;
      }
    }
    
    // Fallback: check xem có video element trong DOM không
    const videoElements = document.querySelectorAll('video');
    if (videoElements.length > 0) {
      return true;
    }
    
    return false;
  } catch (e) {
    debugLog('hasVideoInScene lỗi: ' + e);
    // Nếu có lỗi, giả định là chưa có video để an toàn
    return false;
  }
}


// ============================================
// MAIN FLOW - UPDATED
// ============================================
async function runFlow() {
  // Check xem có video trong scene chưa
  const hasVideo = hasVideoInScene();
  debugLog('📸 Đang check video trong scene...');
  
  // Nếu chưa có video và có ảnh bắt đầu, xử lý luồng mới
  if (!hasVideo && initialImageFile && currentPromptIndex === 0) {
    debugLog('📷 Chưa có video, bắt đầu với ảnh');
    
    let imageFlowSuccess = false;
    let imageFlowRetryCount = 0;
    
    while (!imageFlowSuccess && imageFlowRetryCount < 5 && !userStopped) {
      try {
        if (imageFlowRetryCount === 0) {
          // Lần đầu tiên: Upload ảnh và crop
          // 1. Chọn mode Frame to Video
          await ensureFrameToVideoMode();
          
          // 2. Upload ảnh
          await uploadImageFromFile(initialImageFile);
          
          // 3. Xử lý preview và crop
          const hasDialog = await handleImagePreviewAndCrop();
          
          if (hasDialog) {
            // Có dialog Notice → cần chọn asset mới nhất
            debugLog('📋 Có dialog Notice, cần chọn asset mới nhất');
            await openImagePicker();
            await selectLatestAsset();
          } else {
            // Không có dialog → ảnh đã tự động được chọn, không cần chọn lại
            debugLog('✅ Không có dialog, ảnh đã tự động được chọn');
          }
        } else {
          // Retry: Ảnh đã có sẵn, chỉ cần chọn lại asset đầu tiên
          debugLog(`🔄 Retry lần ${imageFlowRetryCount}/5: Chọn lại ảnh đã upload...`);
          
          // Đóng menu frame nếu còn mở (từ lần generate trước)
          await closeMenuFrame();
          await new Promise(r => setTimeout(r, 1000));
          
          // Mở image picker và chọn asset đầu tiên
          debugLog('📂 Đang mở image picker để chọn lại asset...');
          await openImagePicker();
          await new Promise(r => setTimeout(r, 1000));
          
          debugLog('🎯 Đang chọn asset đầu tiên...');
          await selectLatestAsset();
          debugLog('✅ Đã chọn asset đầu tiên xong');
        }
        
        // Kiểm tra dấu "+" đã chuyển thành thumbnail chưa trước khi nhập prompt
        debugLog('⏳ Kiểm tra dấu "+" đã chuyển thành thumbnail...');
        let plusButtonGone = false;
        let checkTries = 0;
        const maxCheckTries = 20; // 20 * 500ms = 10s
        
        while (isPlusButtonStillVisible() && checkTries < maxCheckTries) {
          await new Promise(r => setTimeout(r, 500));
          checkTries++;
          
          // Kiểm tra lại xem thumbnail đã xuất hiện chưa
          if (isImageThumbnailVisible()) {
            plusButtonGone = true;
            break;
          }
          
          if (checkTries % 4 === 0) {
            debugLog(`  Đã chờ ${checkTries * 0.5}s, dấu "+" vẫn còn...`);
          }
        }
        
        if (isPlusButtonStillVisible() && !isImageThumbnailVisible()) {
          // Sau 10s mà dấu "+" vẫn còn và thumbnail chưa xuất hiện
          debugLog('⚠️ Dấu "+" chưa chuyển thành thumbnail sau 10s, tắt menu frame và retry...');
          await closeMenuFrame();
          throw 'Dấu "+" chưa chuyển thành thumbnail sau 10s';
        }
        
        if (isImageThumbnailVisible()) {
          debugLog('✅ Thumbnail đã xuất hiện, dấu "+" đã được thay thế');
        } else if (!isPlusButtonStillVisible()) {
          debugLog('✅ Dấu "+" đã biến mất');
        }
        
        // 4. Nhập prompt đầu tiên
        debugLog('⌨️ Đang nhập prompt...');
        await inputPrompt(prompts[currentPromptIndex]);
        
        // 5. Click generate
        debugLog('🚀 Đang click generate...');
        await clickGenerate();
        
        // 6. Chờ video render xong (wait for new asset)
        debugLog('⏳ Đang chờ video render xong...');
        const prevAssetCount = getAssetCount();
        let waitTries = 0;
        let newAssetCount = getAssetCount();
        
        while (newAssetCount <= prevAssetCount && waitTries < 180) { // 180 * 1s = 3 phút
          await new Promise(r => setTimeout(r, 1000));
          newAssetCount = getAssetCount();
          waitTries++;
          
          if (waitTries % 20 === 0) {
            debugLog(`  Đã chờ ${waitTries}s... (${prevAssetCount} → ${newAssetCount})`);
          }
        }
        
        if (newAssetCount > prevAssetCount) {
          debugLog('✅ Đã xong prompt #' + (currentPromptIndex + 1) + ', video đã được tạo (' + prevAssetCount + ' → ' + newAssetCount + ')');
          currentPromptIndex++;
          sendProgressUpdate();
          // Reset initialImageFile sau khi đã sử dụng
          initialImageFile = null;
          imageFlowSuccess = true;
        } else {
          debugLog('⚠️ Video chưa được tạo sau 3 phút, sẽ retry luồng chọn ảnh');
          imageFlowRetryCount++;
          
          if (imageFlowRetryCount < 5) {
            debugLog(`🔄 Retry luồng chọn ảnh lần ${imageFlowRetryCount}/5...`);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        
      } catch (e) {
        debugLog('❌ Lỗi khi xử lý ảnh bắt đầu: ' + e);
        imageFlowRetryCount++;
        
        if (imageFlowRetryCount < 5) {
          debugLog(`🔄 Retry luồng chọn ảnh lần ${imageFlowRetryCount}/5 sau lỗi...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    
    if (!imageFlowSuccess && !userStopped) {
      debugLog('❌ Không thể tạo video từ ảnh sau ' + imageFlowRetryCount + ' lần thử.');
      debugLog('⏸️ Dừng flow tạm thời.');
      isRunning = false;
      scheduleAutoRestart('retry luồng chọn ảnh hết');
      return;
    }
    
    if (userStopped) {
      debugLog('⏹️ Flow dừng theo yêu cầu người dùng.');
      isRunning = false;
      chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
      return;
    }
  } else if (hasVideo) {
    debugLog('✅ Đã có video trong scene, sử dụng luồng cũ');
  }
  
  // Tiếp tục với luồng cũ (hoặc prompt tiếp theo nếu đã xử lý ảnh bắt đầu)
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
 * Upload ảnh từ base64 string
 * @param {string} imageBase64 - Base64 data URL của ảnh
 */
async function uploadImageFromFile(imageBase64) {
  debugLog('📤 Đang upload ảnh...');
  
  try {
    // Tìm nút + đầu tiên ở dưới prompt (button với icon "add" hoặc "image")
    // Tìm trong khu vực prompt textarea
    const textarea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    if (!textarea) {
      throw 'Không tìm thấy prompt textarea';
    }
    
    // Tìm button gần textarea (có thể là button với icon "add" hoặc "image")
    const promptArea = textarea.closest('div') || textarea.parentElement;
    const addButtons = Array.from(promptArea.querySelectorAll('button')).filter(btn => {
      const icon = btn.querySelector('i.google-symbols');
      if (icon) {
        const iconText = icon.textContent.trim().toLowerCase();
        return iconText === 'add' || iconText === 'image' || iconText === 'image_add';
      }
      return false;
    });
    
    if (addButtons.length === 0) {
      // Fallback: tìm button đầu tiên gần textarea
      const allButtons = Array.from(promptArea.querySelectorAll('button'));
      if (allButtons.length > 0) {
        debugLog('⚠️ Không tìm thấy button với icon add/image, thử button đầu tiên...');
        addButtons.push(allButtons[0]);
      } else {
        throw 'Không tìm thấy nút để mở menu ảnh';
      }
    }
    
    const addButton = addButtons[0];
    debugLog('✓ Tìm thấy nút mở menu ảnh');
    
    // Tìm input file trực tiếp trước (có thể đã có sẵn trong DOM)
    let fileInput = document.querySelector('input[type="file"]');
    
    if (fileInput) {
      debugLog('✓ Tìm thấy input file trực tiếp, đang trigger...');
      // Trigger click vào input file để mở file picker
      fileInput.click();
      await new Promise(r => setTimeout(r, 500));
    } else {
      // Nếu không tìm thấy, click nút + để mở menu
      debugLog('⚠️ Không tìm thấy input file trực tiếp, click nút + để mở menu...');
      addButton.click();
      await new Promise(r => setTimeout(r, 1000));
      
      // Tìm input file sau khi menu mở
      fileInput = document.querySelector('input[type="file"]');
      
      if (!fileInput) {
        // Tìm button "Upload" trong menu và click để trigger input
        const uploadButtons = Array.from(document.querySelectorAll('button, [role="menuitem"]')).filter(btn => {
          const text = btn.textContent.trim().toLowerCase();
          return text.includes('upload') || text.includes('chọn') || text.includes('browse');
        });
        
        if (uploadButtons.length > 0) {
          debugLog('✓ Tìm thấy button upload, đang click...');
          uploadButtons[0].click();
          await new Promise(r => setTimeout(r, 500));
          // Tìm lại input file sau khi click upload
          fileInput = document.querySelector('input[type="file"]');
        }
      }
      
      if (!fileInput) {
        // Tạo input file ẩn nếu không tìm thấy
        debugLog('⚠️ Không tìm thấy input file, tạo input ẩn...');
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
      }
    }
    
    // Convert base64 sang File
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/png';
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const file = new File([byteArray], 'image.png', { type: mimeType });
    
    // Tạo DataTransfer để set file vào input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
    
    debugLog('✓ Đã set file vào input và trigger change event');
    await new Promise(r => setTimeout(r, 1000));
    
    // Chờ popup preview xuất hiện
    debugLog('⏳ Đang chờ popup preview xuất hiện...');
    
  } catch (e) {
    debugLog('❌ uploadImageFromFile lỗi: ' + e);
    throw e;
  }
}

/**
 * Xử lý popup preview và crop ảnh
 * @returns {Promise<boolean>} true nếu có dialog Notice, false nếu không có
 */
async function handleImagePreviewAndCrop() {
  debugLog('✂️ Đang xử lý preview và crop...');
  
  try {
    // Chờ popup preview xuất hiện (có thể là dialog/modal)
    let cropAndSaveButton = null;
    let tries = 0;
    const maxTries = 50; // 1s
    
    while (!cropAndSaveButton && tries < maxTries) {
      // Tìm nút "Crop and Save"
      const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent.trim();
        return text.includes('Crop and Save') || text.includes('Crop and save') || 
               (text.includes('Crop') && text.includes('Save'));
      });
      
      if (buttons.length > 0) {
        cropAndSaveButton = buttons[0];
        break;
      }
      
      await new Promise(r => setTimeout(r, 200));
      tries++;
    }
    
    if (!cropAndSaveButton) {
      debugLog('⚠️ Không tìm thấy nút "Crop and Save", thử tìm nút crop khác...');
      // Fallback: tìm nút có text chứa "crop" và "save"
      const fallbackButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent.trim().toLowerCase();
        return (text.includes('crop') && text.includes('save')) || 
               text.includes('crop and save');
      });
      
      if (fallbackButtons.length > 0) {
        cropAndSaveButton = fallbackButtons[0];
      } else {
        throw 'Không tìm thấy nút "Crop and Save"';
      }
    }
    
    debugLog('✓ Tìm thấy nút "Crop and Save", đang click...');
    cropAndSaveButton.click();
    await new Promise(r => setTimeout(r, 1000));
    
    // Chờ dialog "Notice" xuất hiện và click "I agree"
    debugLog('⏳ Đang chờ dialog Notice xuất hiện...');
    let agreeButton = null;
    tries = 0;
    const maxNoticeTries = 20; // 10s
    
    while (!agreeButton && tries < maxNoticeTries) {
      // Tìm dialog "Notice" và nút "I agree"
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      for (const dialog of dialogs) {
        const dialogText = dialog.textContent || '';
        // Check xem có phải dialog Notice không (có text "Notice" hoặc "necessary rights")
        if (dialogText.includes('Notice') || dialogText.includes('necessary rights') || dialogText.includes('Prohibited Use Policy')) {
          // Tìm nút "I agree" trong dialog này
          const buttons = Array.from(dialog.querySelectorAll('button')).filter(btn => {
            const text = btn.textContent.trim();
            return text === 'I agree' || text.includes('I agree') || text.includes('agree');
          });
          
          if (buttons.length > 0) {
            agreeButton = buttons[0];
            break;
          }
        }
      }
      
      if (agreeButton) {
        break;
      }
      
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }
    
    if (agreeButton) {
      // Có dialog Notice
      debugLog('✓ Tìm thấy nút "I agree", đang click...');
      agreeButton.click();
      await new Promise(r => setTimeout(r, 1000));
      debugLog('✅ Đã click "I agree"');
      
      // Chờ thumbnail ảnh xuất hiện (thay thế nút dấu "+")
      debugLog('⏳ Đang chờ thumbnail ảnh xuất hiện...');
      let thumbnailVisible = false;
      tries = 0;
      const maxThumbnailTries = 20; // 20 * 500ms = 10s
      
      while (!thumbnailVisible && tries < maxThumbnailTries) {
        thumbnailVisible = isImageThumbnailVisible();
        if (thumbnailVisible) {
          break;
        }
        await new Promise(r => setTimeout(r, 500));
        tries++;
      }
      
      if (thumbnailVisible) {
        debugLog('✅ Thumbnail ảnh đã xuất hiện (thay thế nút dấu "+")');
      } else {
        debugLog('⚠️ Thumbnail ảnh chưa xuất hiện sau 10s, vẫn tiếp tục...');
      }
      
      // Chờ tiếp 2 giây để đảm bảo UI ổn định
      debugLog('⏳ Chờ thêm 2 giây...');
      await new Promise(r => setTimeout(r, 2000));
      
      debugLog('✅ Đã hoàn thành crop và chờ thumbnail ảnh');
      return true; // Có dialog
    } else {
      // Không có dialog Notice - chờ menu frame tắt
      debugLog('⚠️ Không tìm thấy dialog Notice, chờ menu frame tắt...');
      
      // Chờ menu frame (popup preview) tắt
      let menuFrameVisible = true;
      tries = 0;
      const maxMenuTries = 30; // 15s
      
      while (menuFrameVisible && tries < maxMenuTries) {
        // Check xem popup preview/dialog còn visible không
        const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
        const hasVisibleDialog = Array.from(dialogs).some(dialog => {
          const style = window.getComputedStyle(dialog);
          return style.display !== 'none' && dialog.offsetParent !== null;
        });
        
        // Check xem có button "Crop and Save" còn visible không
        const cropButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
          const text = btn.textContent.trim();
          return (text.includes('Crop and Save') || text.includes('Crop and save')) && 
                 btn.offsetParent !== null;
        });
        
        menuFrameVisible = hasVisibleDialog || cropButtons.length > 0;
        
        if (!menuFrameVisible) {
          break;
        }
        
        await new Promise(r => setTimeout(r, 500));
        tries++;
      }
      
      if (!menuFrameVisible) {
        debugLog('✅ Menu frame đã tắt');
        //Chờ thumbnail ảnh xuất hiện (thay thế nút dấu "+")
        debugLog('⏳ Đang chờ thumbnail ảnh xuất hiện...');
        let thumbnailVisible = false;
        tries = 0;
        const maxThumbnailTries = 40; // 40 * 500ms = 20s
        
        while (!thumbnailVisible && tries < maxThumbnailTries) {
          thumbnailVisible = isImageThumbnailVisible();
          if (thumbnailVisible) {
            break;
          }
          await new Promise(r => setTimeout(r, 500));
          tries++;
        }
        
        if (thumbnailVisible) {
          debugLog('✅ Thumbnail ảnh đã xuất hiện (đã thay thế nút dấu "+")');
        } else {
          debugLog('⚠️ Thumbnail ảnh chưa xuất hiện sau 20s, vẫn tiếp tục...');
        }
        // Chờ tiếp 2 giây để đảm bảo UI ổn định
        debugLog('⏳ Chờ thêm 2 giây...');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        debugLog('⚠️ Menu frame có thể chưa tắt hoàn toàn, vẫn tiếp tục...');
      }
      
      return false; // Không có dialog
    }
    
  } catch (e) {
    debugLog('❌ handleImagePreviewAndCrop lỗi: ' + e);
    throw e;
  }
}

/**
 * Check và chọn mode "Frame to Video" nếu chưa chọn
 */
async function ensureFrameToVideoMode() {
  debugLog('🔄 Đang check mode Frame to Video...');
  
  try {
    // Tìm button "Text to Video" (combobox)
    const modeButtons = Array.from(document.querySelectorAll('button[role="combobox"]')).filter(btn => {
      const text = btn.textContent.trim();
      return text.includes('Text to Video') || text.includes('Frame to Video') || text.includes('Frames to Video');
    });
    
    if (modeButtons.length === 0) {
      debugLog('⚠️ Không tìm thấy button chọn mode');
      return; // Có thể đã ở đúng mode hoặc UI khác
    }
    
    const modeButton = modeButtons[0];
    const currentMode = modeButton.textContent.trim();
    
    // Check xem có phải "Frame to Video" không
    if (currentMode.includes('Frame to Video') || currentMode.includes('Frames to Video')) {
      debugLog('✅ Đã ở mode Frame to Video');
      return;
    }
    
    // Click để mở dropdown
    debugLog('🔄 Đang click để mở dropdown mode...');
    modeButton.click();
    await new Promise(r => setTimeout(r, 500));
    
    // Tìm menu item "Frame to Video" hoặc "Frames to Video"
    const menuItems = document.querySelectorAll('[role="menuitem"], [role="option"]');
    const frameToVideoItem = Array.from(menuItems).find(item => {
      const text = item.textContent.trim();
      return text.includes('Frame to Video') || text.includes('Frames to Video');
    });
    
    if (frameToVideoItem) {
      debugLog('✓ Tìm thấy menu item Frame to Video, đang click...');
      frameToVideoItem.click();
      await new Promise(r => setTimeout(r, 1000));
      debugLog('✅ Đã chọn mode Frame to Video');
    } else {
      debugLog('⚠️ Không tìm thấy menu item Frame to Video, có thể đã ở đúng mode');
    }
    
  } catch (e) {
    debugLog('⚠️ ensureFrameToVideoMode lỗi: ' + e);
    // Không throw, tiếp tục flow
  }
}

/**
 * Kiểm tra nút dấu "+" còn hiện không (tức là thumbnail chưa xuất hiện)
 */
function isPlusButtonStillVisible() {
  try {
    const textarea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    if (!textarea) return false;
    
    // Tìm button gần textarea có icon "add" và visible
    const promptArea = textarea.closest('div') || textarea.parentElement;
    const addButtons = Array.from(promptArea.querySelectorAll('button')).filter(btn => {
      // Check button phải visible
      if (btn.offsetParent === null) return false;
      
      const icon = btn.querySelector('i.google-symbols');
      if (icon) {
        const iconText = icon.textContent.trim().toLowerCase();
        return iconText === 'add' || iconText === 'image' || iconText === 'image_add';
      }
      return false;
    });
    
    return addButtons.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Tắt menu frame/dialog (preview/crop dialog)
 */
async function closeMenuFrame() {
  try {
    debugLog('🔒 Đang tắt menu frame...');
    
    // Tìm và click nút đóng (X) hoặc nút Cancel/Close
    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    for (const dialog of dialogs) {
      const style = window.getComputedStyle(dialog);
      if (style.display !== 'none' && dialog.offsetParent !== null) {
        // Tìm nút đóng (X) hoặc Cancel
        const closeButtons = Array.from(dialog.querySelectorAll('button')).filter(btn => {
          const text = btn.textContent.trim().toLowerCase();
          const icon = btn.querySelector('i.google-symbols');
          const iconText = icon ? icon.textContent.trim().toLowerCase() : '';
          
          return text === 'cancel' || text === 'close' || 
                 iconText === 'close' || iconText === 'cancel' ||
                 btn.getAttribute('aria-label')?.toLowerCase().includes('close') ||
                 btn.getAttribute('aria-label')?.toLowerCase().includes('cancel');
        });
        
        if (closeButtons.length > 0) {
          debugLog('✓ Tìm thấy nút đóng, đang click...');
          closeButtons[0].click();
          await new Promise(r => setTimeout(r, 1000));
          return;
        }
        
        // Fallback: Nhấn ESC
        debugLog('⚠️ Không tìm thấy nút đóng, thử nhấn ESC...');
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
        dialog.dispatchEvent(escEvent);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    debugLog('⚠️ Không tìm thấy dialog để đóng');
  } catch (e) {
    debugLog('⚠️ Lỗi khi tắt menu frame: ' + e);
  }
}

/**
 * Kiểm tra thumbnail ảnh đã xuất hiện thay thế nút dấu "+" chưa
 * Thumbnail là element có hình ảnh (background-image hoặc img) nằm gần textarea prompt
 */
function isImageThumbnailVisible() {
  try {
    const textarea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    if (!textarea) return false;
    
    // Tìm trong khu vực gần textarea prompt
    const promptArea = textarea.closest('div') || textarea.parentElement;
    const parentContainer = promptArea.parentElement || promptArea;
    
    // Tìm tất cả elements trong container
    const allElements = Array.from(parentContainer.querySelectorAll('*'));
    
    // Kiểm tra các element có thể là thumbnail ảnh
    for (const el of allElements) {
      // Phải visible
      if (el.offsetParent === null) continue;
      
      // Check 1: img element
      if (el.tagName === 'IMG' && el.src && el.src !== '') {
        // Kiểm tra kích thước hợp lý cho thumbnail (không quá lớn)
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 200) {
          return true;
        }
      }
      
      // Check 2: div có background-image
      const style = window.getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url(')) {
        // Kiểm tra kích thước hợp lý cho thumbnail
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 200) {
          // Kiểm tra element này nằm gần textarea (trong cùng container hoặc gần đó)
          return true;
        }
      }
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

function isUploadIconVisible() {
  return Array.from(document.querySelectorAll('i.google-symbols')).some(i => i.textContent.trim().toLowerCase() === 'upload');
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
    
    while (!isUploadIconVisible() && tries < maxTries) {
      await new Promise(r => setTimeout(r, 500));
      tries++;
    }
    if (!isUploadIconVisible()) {
      debugLog('⚠️ Không thấy icon upload sau khi chờ. Vẫn tiếp tục.');
    } else {
      debugLog('✓ Đã thấy icon upload, asset list đã sẵn sàng.');
    }
    // Chờ 2s để đảm bảo asset mới đã render hoàn toàn
    debugLog('⏳ Đã tìm thấy asset mới nhất, chờ 2s để ổn định...');
    await new Promise(r => setTimeout(r, 2000));
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
