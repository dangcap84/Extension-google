/**
 * Scroll asset list (timeline) đến cuối để đảm bảo slider kéo được đến frame cuối cùng
 * @returns {Promise<void>}
 */
async function scrollAssetListToEnd() {
  debugLog('📽 scrollAssetListToEnd: Đang scroll asset list đến cuối...');
  
  try {
    // Tìm asset list container
    const assetList = document.querySelector('.virtuoso-grid-list') || 
                      document.querySelector('[role="grid"]');
    
    if (!assetList) {
      debugLog('⚠️ Không tìm thấy asset list container');
      return;
    }
    
    // Tìm element có scrollbar - có thể là parent của asset list
    let scrollElement = null;
    
    // Kiểm tra asset list và các parent elements (chỉ tìm scroll ngang)
    let current = assetList;
    for (let i = 0; i < 10 && current; i++) {
      const hasHorizontalScroll = current.scrollWidth > current.clientWidth;
      
      if (hasHorizontalScroll) {
        scrollElement = current;
        debugLog(`📊 Tìm thấy scroll element ở level ${i}: ${current.tagName}${current.className ? '.' + current.className.split(' ')[0] : ''}`);
        break;
      }
      current = current.parentElement;
    }
    
    // Nếu không tìm thấy, tìm tất cả elements có scrollbar ngang
    if (!scrollElement) {
      const allElements = Array.from(document.querySelectorAll('*'));
      const scrollableElements = allElements.filter(el => {
        const style = window.getComputedStyle(el);
        const hasOverflow = style.overflow === 'auto' || style.overflow === 'scroll' || 
                           style.overflowX === 'auto' || style.overflowX === 'scroll';
        const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
        return hasOverflow && hasHorizontalScroll && el.offsetParent !== null;
      });
      
      // Tìm element gần asset list nhất
      if (scrollableElements.length > 0) {
        scrollElement = scrollableElements[0];
        debugLog(`📊 Tìm thấy scroll element từ overflow: ${scrollElement.tagName}`);
      }
    }
    
    if (!scrollElement) {
      debugLog('⚠️ Không tìm thấy element có scrollbar');
      return;
    }
    
    // Scroll theo chiều ngang (scrollLeft) - quan trọng nhất cho timeline
    const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
    const initialScrollLeft = scrollElement.scrollLeft;
    
    debugLog(`📊 Element: ${scrollElement.tagName}${scrollElement.className ? '.' + scrollElement.className.split(' ').slice(0, 2).join('.') : ''}`);
    debugLog(`📊 ScrollWidth: ${scrollElement.scrollWidth}, ClientWidth: ${scrollElement.clientWidth}`);
    debugLog(`📊 Initial scrollLeft: ${initialScrollLeft}, Max: ${maxScrollLeft}`);
    
    if (maxScrollLeft <= 0) {
      debugLog('ℹ️ Không cần scroll ngang (đã ở cuối hoặc không scroll được)');
    } else {
      // Scroll với nhiều cách và từng bước
      let scrollTries = 0;
      const maxScrollTries = 20;
      let success = false;
      
      while (scrollTries < maxScrollTries && !success) {
        const currentScrollLeft = scrollElement.scrollLeft;
        const remaining = maxScrollLeft - currentScrollLeft;
        
        if (remaining <= 2) {
          success = true;
          debugLog('✅ Scroll asset list thành công (ngang)');
          break;
        }
        
        // Scroll từng bước lớn để đảm bảo đến cuối
        const scrollStep = Math.min(remaining, Math.max(1000, remaining * 0.5));
        
        // Cách 1: scrollBy với step lớn
        scrollElement.scrollBy({
          left: scrollStep,
          behavior: 'auto'
        });
        await sleep(50);
        
        // Cách 2: Set scrollLeft trực tiếp
        scrollElement.scrollLeft = currentScrollLeft + scrollStep;
        await sleep(50);
        
        // Cách 3: scrollTo với giá trị lớn
        if (scrollTries % 3 === 0) {
          scrollElement.scrollTo({
            left: scrollElement.scrollWidth,
            behavior: 'auto'
          });
          await sleep(100);
        }
        
        const newScrollLeft = scrollElement.scrollLeft;
        const newRemaining = maxScrollLeft - newScrollLeft;
        
        if (scrollTries % 5 === 0) {
          debugLog(`📊 Lần thử ${scrollTries + 1}: scrollLeft = ${newScrollLeft.toFixed(0)}, còn lại = ${newRemaining.toFixed(0)}`);
        }
        
        // Nếu không tiến bộ, thử scroll trực tiếp đến cuối
        if (Math.abs(newScrollLeft - currentScrollLeft) < 1) {
          scrollElement.scrollLeft = scrollElement.scrollWidth;
          await sleep(100);
        }
        
        scrollTries++;
      }
      
      if (!success) {
        const finalScrollLeft = scrollElement.scrollLeft;
        debugLog(`⚠️ Scroll ngang chưa hết sau ${maxScrollTries} lần thử: ${finalScrollLeft.toFixed(0)} / ${maxScrollLeft.toFixed(0)}`);
        // Thử lần cuối: scroll trực tiếp
        scrollElement.scrollLeft = scrollElement.scrollWidth;
        await sleep(200);
        const finalCheck = scrollElement.scrollWidth - scrollElement.clientWidth - scrollElement.scrollLeft;
        if (finalCheck <= 5) {
          debugLog('✅ Scroll thành công sau lần thử cuối');
        }
      }
    }
    
    // Đợi một chút để đảm bảo scroll đã hoàn tất
    await sleep(DELAYS.MEDIUM);
    
  } catch (e) {
    debugLog('⚠️ scrollAssetListToEnd lỗi: ' + e);
  }
}
// content.js
// Chrome Extension for Google Flow - Veo 3 Auto Prompt Automation

// ============================================
// CONSTANTS
// ============================================

const TIMEOUTS = {
  ELEMENT_WAIT: 10000,
  SLIDER_DRAG: 5000,
  ASSET_WAIT: 180000, // 3 phút
  VIDEO_RENDER: 300000, // 5 phút
  AUTO_RESTART: 10000,
  THUMBNAIL_CHECK: 10000, // 10s
  MENU_FRAME_CLOSE: 15000, // 15s
  CROP_SAVE_BUTTON: 10000, // 10s
  NOTICE_DIALOG: 10000, // 10s
  UPLOAD_ICON: 20000, // 20s
  RETRY_DELAY: 2000,
  UI_STABILIZE: 2000,
  SHORT_DELAY: 500,
  MEDIUM_DELAY: 1000
};

const RETRY_LIMITS = {
  IMAGE_FLOW: 5,
  PROMPT: 5,
  CROP_SAVE_BUTTON: 50,
  NOTICE_DIALOG: 20,
  THUMBNAIL_CHECK: 20,
  MENU_FRAME: 30,
  UPLOAD_ICON: 40
};

const DELAYS = {
  SHORT: 100,
  MEDIUM: 300,
  NORMAL: 500,
  LONG: 1000,
  STABILIZE: 2000
};

// ============================================
// LANGUAGE MAPPINGS
// ============================================

const TEXT_MAPPINGS = {
  en: {
    CROP_AND_SAVE: ['Crop and Save', 'Crop and save', 'crop and save'],
    I_AGREE: ['I agree', 'I Agree', 'agree'],
    SAVE_FRAME: ['save', 'frame'],
    FRAME_TO_VIDEO: ['Frame to Video', 'Frames to Video'],
    TEXT_TO_VIDEO: ['Text to Video'],
    UPLOAD: ['upload', 'browse'],
    CANCEL: ['cancel'],
    CLOSE: ['close'],
    NOTICE: ['Notice', 'necessary rights', 'Prohibited Use Policy']
  },
  ja: {
    CROP_AND_SAVE: ['クロップして保存', 'クロップと保存', '保存'],
    I_AGREE: ['同意する', '同意', '承諾'],
    SAVE_FRAME: ['保存', 'フレーム'],
    FRAME_TO_VIDEO: ['フレームから動画', 'フレームを動画に'],
    TEXT_TO_VIDEO: ['テキストから動画'],
    UPLOAD: ['アップロード', 'アップロードする'],
    CANCEL: ['キャンセル', '取消'],
    CLOSE: ['閉じる', '閉'],
    NOTICE: ['通知', '注意事項', '利用規約']
  }
};

// IndexedDB constants for queue state
const QUEUE_DB_NAME = 'veoQueueDB';
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE_NAME = 'queueState';
let queueDB = null; // IndexedDB instance

/**
 * Auto-detect language from page
 * @returns {string} Language code ('en' or 'ja')
 */
function detectLanguage() {
  const lang = document.documentElement.lang || navigator.language || 'en';
  return lang.startsWith('ja') ? 'ja' : 'en';
}

/**
 * Check if text matches any of the language-specific strings
 * @param {string} text - Text to check
 * @param {string} key - Key in TEXT_MAPPINGS (e.g., 'CROP_AND_SAVE')
 * @param {string} lang - Language code ('en' or 'ja')
 * @returns {boolean}
 */
function matchesText(text, key, lang = null) {
  if (!lang) lang = detectLanguage();
  const mappings = TEXT_MAPPINGS[lang] || TEXT_MAPPINGS.en;
  const patterns = mappings[key] || [];
  
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => 
    lowerText.includes(pattern.toLowerCase())
  );
}

/**
 * Find button by text matching with language support
 * @param {NodeList|Array} buttons - Buttons to search
 * @param {string} key - Key in TEXT_MAPPINGS
 * @param {Object} options - Additional options { lang, requireAll }
 * @returns {HTMLElement|null}
 */
function findButtonByText(buttons, key, options = {}) {
  const lang = options.lang || detectLanguage();
  const requireAll = options.requireAll || false; // For "Crop AND Save"
  
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    
    if (requireAll) {
      // For "Crop and Save" - need both words
      const mappings = TEXT_MAPPINGS[lang] || TEXT_MAPPINGS.en;
      const patterns = mappings[key] || [];
      // Check if text contains all patterns (for SAVE_FRAME: both 'save' and 'frame')
      if (patterns.length > 1) {
        const allMatch = patterns.every(pattern => 
          text.toLowerCase().includes(pattern.toLowerCase())
        );
        if (allMatch) return btn;
      } else {
        // Single pattern, just check if it matches
        if (matchesText(text, key, lang)) return btn;
      }
    } else {
      if (matchesText(text, key, lang)) return btn;
    }
  }
  
  // Fallback: try English if current language failed
  if (lang !== 'en') {
    return findButtonByText(buttons, key, { ...options, lang: 'en' });
  }
  
  return null;
}

/**
 * Find button by aria-label or data attributes (language-independent)
 * @param {NodeList|Array} buttons - Buttons to search
 * @param {string|Array} ariaLabels - aria-label values to match
 * @param {string|Array} dataAttrs - data-* attribute values to match
 * @returns {HTMLElement|null}
 */
function findButtonByAttributes(buttons, ariaLabels = null, dataAttrs = null) {
  const ariaArray = ariaLabels ? (Array.isArray(ariaLabels) ? ariaLabels : [ariaLabels]) : [];
  const dataArray = dataAttrs ? (Array.isArray(dataAttrs) ? dataAttrs : [dataAttrs]) : [];
  
  for (const btn of buttons) {
    // Check aria-label
    if (ariaArray.length > 0) {
      const ariaLabel = btn.getAttribute('aria-label');
      if (ariaLabel && ariaArray.some(label => 
        ariaLabel.toLowerCase().includes(label.toLowerCase())
      )) {
        return btn;
      }
    }
    
    // Check data-* attributes
    if (dataArray.length > 0) {
      for (const attr of dataArray) {
        const value = btn.getAttribute(attr);
        if (value) return btn;
      }
    }
  }
  
  return null;
}

// ============================================
// STATE MANAGEMENT
// ============================================

let isRunning = false;
let prompts = [];
let currentPromptIndex = 0;
let totalPrompts = 0;
let totalPromptsProcessed = 0; // Tổng số prompt đã xử lý trong queue flow
let restartTimeoutId = null;
let userStopped = false;
let initialImageFile = null; // Base64 string của ảnh bắt đầu

// Queue state
let queueList = [];
let currentQueueIndex = 0;
let currentPromptIndexInQueue = 0; // Index của prompt hiện tại trong queue item đang xử lý
let isQueueMode = false;

function clearRestartTimer() {
  if (restartTimeoutId) {
    clearTimeout(restartTimeoutId);
    restartTimeoutId = null;
  }
}

/**
 * Lưu state vào chrome.storage.local để restore sau khi reload
 * Sử dụng chrome.storage thay vì localStorage để bảo mật hơn
 */
async function saveFlowState() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      console.error('⚠️ chrome.storage không sẵn sàng, không thể lưu state');
      try {
        debugLog('⚠️ chrome.storage không sẵn sàng, không thể lưu state');
      } catch (_) {}
      return false;
    }
    
    const stateData = {
      prompts: prompts,
      currentPromptIndex: currentPromptIndex,
      totalPrompts: totalPrompts,
      initialImageFile: initialImageFile,
      isRunning: isRunning
    };
    
    // Sử dụng chrome.storage.local thay vì localStorage để bảo mật hơn
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ veoFlowState: stateData }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
    
    try {
      debugLog('💾 Đã lưu state flow');
    } catch (e) {
      console.log('💾 Đã lưu state flow');
    }
    return true;
  } catch (e) {
    console.error('⚠️ Lỗi khi lưu state: ', e);
    try {
      debugLog('⚠️ Lỗi khi lưu state: ' + e);
    } catch (_) {}
    return false;
  }
}

/**
 * Restore state từ chrome.storage.local sau khi reload
 * Sử dụng chrome.storage thay vì localStorage để bảo mật hơn
 */
async function restoreFlowState() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      console.error('⚠️ chrome.storage không sẵn sàng, không thể restore state');
      try {
        debugLog('⚠️ chrome.storage không sẵn sàng, không thể restore state');
      } catch (_) {}
      return false;
    }
    
    // Đọc từ chrome.storage.local
    const data = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['veoFlowState'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
    
    if (!data || !data.veoFlowState) {
      return false;
    }
    
    const state = data.veoFlowState;
    
    if (state) {
      prompts = state.prompts || [];
      currentPromptIndex = state.currentPromptIndex || 0;
      totalPrompts = state.totalPrompts || 0;
      initialImageFile = state.initialImageFile || null;
      isRunning = state.isRunning || false;
      
      // Kiểm tra tính hợp lệ của state
      if (prompts.length === 0 || currentPromptIndex < 0 || currentPromptIndex >= prompts.length) {
        console.log('⚠️ State không hợp lệ, xóa state...');
        await clearFlowState();
        return false;
      }
      
      try {
        debugLog(`🔄 Đã restore state: prompt ${currentPromptIndex + 1}/${totalPrompts}`);
      } catch (e) {
        console.log(`🔄 Đã restore state: prompt ${currentPromptIndex + 1}/${totalPrompts}`);
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('⚠️ Lỗi khi restore state: ', e);
    try {
      debugLog('⚠️ Lỗi khi restore state: ' + e);
    } catch (_) {}
    return false;
  }
}

/**
 * Xóa state đã lưu
 * Sử dụng chrome.storage thay vì localStorage để bảo mật hơn
 */
async function clearFlowState() {
  try {
    if (!chrome.storage || !chrome.storage.local) {
      console.error('⚠️ chrome.storage không sẵn sàng, không thể xóa state');
      return false;
    }
    
    // Xóa từ chrome.storage.local
    await new Promise((resolve, reject) => {
      chrome.storage.local.remove(['veoFlowState'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
    
    try {
      debugLog('🗑️ Đã xóa state flow');
    } catch (e) {
      console.log('🗑️ Đã xóa state flow');
    }
    return true;
  } catch (e) {
    console.error('⚠️ Lỗi khi xóa state: ', e);
    try {
      debugLog('⚠️ Lỗi khi xóa state: ' + e);
    } catch (_) {}
    return false;
  }
}

/**
 * Khởi tạo IndexedDB cho queue state
 * @returns {Promise<IDBDatabase>}
 */
async function initQueueDB() {
  return new Promise((resolve, reject) => {
    // Nếu đã có database instance, return ngay
    if (queueDB) {
      resolve(queueDB);
      return;
    }

    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);

    request.onerror = () => {
      const error = request.error;
      console.error('⚠️ Lỗi khi mở IndexedDB:', error);
      try {
        debugLog('⚠️ Lỗi khi mở IndexedDB: ' + error);
      } catch (_) {}
      reject(error);
    };

    request.onsuccess = () => {
      queueDB = request.result;
      try {
        debugLog('✅ Đã khởi tạo IndexedDB cho queue state');
      } catch (_) {}
      resolve(queueDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Tạo object store nếu chưa có
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME);
        try {
          debugLog('✅ Đã tạo object store ' + QUEUE_STORE_NAME);
        } catch (_) {}
      }
    };
  });
}

/**
 * Lưu queue state vào IndexedDB để restore sau khi reload
 */
async function saveQueueState() {
  try {
    // Khởi tạo IndexedDB nếu chưa có
    const db = await initQueueDB();
    
    // Tạo state object với queueList đầy đủ (bao gồm imageBase64)
    const stateData = {
      queueList: queueList.map(q => ({
        imageBase64: q.imageBase64 || null,
        prompts: Array.isArray(q.prompts) ? q.prompts : (q.prompt ? [q.prompt] : [])
      })),
      currentQueueIndex: currentQueueIndex,
      currentPromptIndexInQueue: currentPromptIndexInQueue || 0,
      isQueueMode: isQueueMode,
      isRunning: isRunning,
      totalPromptsProcessed: totalPromptsProcessed || 0
    };
    
    // Lưu vào IndexedDB với key = "current"
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.put(stateData, 'current');
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(request.error?.message || 'Lỗi khi lưu vào IndexedDB'));
      };
    });
    
    try {
      debugLog('💾 Đã lưu queue state vào IndexedDB');
    } catch (e) {
      console.log('💾 Đã lưu queue state vào IndexedDB');
    }
    return true;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
    console.error('⚠️ Lỗi khi lưu queue state: ', errorMsg);
    try {
      debugLog('⚠️ Lỗi khi lưu queue state: ' + errorMsg);
    } catch (_) {}
    return false;
  }
}

/**
 * Restore queue state từ IndexedDB sau khi reload
 */
async function restoreQueueState() {
  try {
    // Khởi tạo IndexedDB nếu chưa có
    const db = await initQueueDB();
    
    // Lấy state từ IndexedDB với key = "current"
    const state = await new Promise((resolve, reject) => {
      const transaction = db.transaction([QUEUE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.get('current');
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(request.error?.message || 'Lỗi khi lấy từ IndexedDB'));
      };
    });
    
    if (!state) {
      return false;
    }
    
    // Restore tất cả biến global
    queueList = state.queueList || [];
    currentQueueIndex = state.currentQueueIndex || 0;
    currentPromptIndexInQueue = state.currentPromptIndexInQueue || 0;
    isQueueMode = state.isQueueMode || false;
    isRunning = state.isRunning || false;
    totalPromptsProcessed = state.totalPromptsProcessed || 0;
    
    // Kiểm tra tính hợp lệ của state
    if (queueList.length === 0 || currentQueueIndex < 0 || currentQueueIndex >= queueList.length) {
      console.log('⚠️ Queue state không hợp lệ, xóa state...');
      await clearQueueState();
      return false;
    }
    
    // Kiểm tra tính hợp lệ của currentPromptIndexInQueue
    const currentQueueItem = queueList[currentQueueIndex];
    if (currentQueueItem) {
      const prompts = Array.isArray(currentQueueItem.prompts) ? currentQueueItem.prompts : (currentQueueItem.prompt ? [currentQueueItem.prompt] : []);
      if (currentPromptIndexInQueue < 0) {
        console.log('⚠️ currentPromptIndexInQueue < 0, reset về 0...');
        currentPromptIndexInQueue = 0;
      } else if (currentPromptIndexInQueue >= prompts.length) {
        // Đã hoàn thành tất cả prompts trong queue này, chuyển sang queue tiếp theo
        console.log(`⚠️ currentPromptIndexInQueue (${currentPromptIndexInQueue}) >= prompts.length (${prompts.length}), đã hoàn thành queue này, chuyển sang queue tiếp theo...`);
        currentQueueIndex++;
        currentPromptIndexInQueue = 0;
        
        // Kiểm tra lại nếu queue mới hợp lệ
        if (currentQueueIndex >= queueList.length) {
          console.log('⚠️ Queue đã hoàn thành tất cả, xóa state...');
          await clearQueueState();
          return false;
        }
      }
    }
    
    try {
      debugLog(`🔄 Đã restore queue state: queue ${currentQueueIndex + 1}/${queueList.length}, prompt index ${currentPromptIndexInQueue}, prompts processed: ${totalPromptsProcessed}`);
    } catch (e) {
      console.log(`🔄 Đã restore queue state: queue ${currentQueueIndex + 1}/${queueList.length}, prompt index ${currentPromptIndexInQueue}, prompts processed: ${totalPromptsProcessed}`);
    }
    return true;
  } catch (e) {
    console.error('⚠️ Lỗi khi restore queue state: ', e);
    try {
      debugLog('⚠️ Lỗi khi restore queue state: ' + e);
    } catch (_) {}
    return false;
  }
}

/**
 * Xóa queue state đã lưu từ IndexedDB
 */
async function clearQueueState() {
  try {
    // Khởi tạo IndexedDB nếu chưa có
    const db = await initQueueDB();
    
    // Xóa state khỏi IndexedDB với key = "current"
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.delete('current');
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(request.error?.message || 'Lỗi khi xóa từ IndexedDB'));
      };
    });
    
    try {
      debugLog('🗑️ Đã xóa queue state từ IndexedDB');
    } catch (e) {
      console.log('🗑️ Đã xóa queue state từ IndexedDB');
    }
    return true;
  } catch (e) {
    console.error('⚠️ Lỗi khi xóa queue state: ', e);
    try {
      debugLog('⚠️ Lỗi khi xóa queue state: ' + e);
    } catch (_) {}
    return false;
  }
}

function scheduleAutoRestart(reason) {
  clearRestartTimer();
  if (userStopped) {
    debugLog(`⏸️ Bỏ qua auto-restart vì user đã stop (${reason})`);
    return;
  }
  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Waiting restart' });
  debugLog(`⏳ Sẽ tự chạy lại flow sau ${TIMEOUTS.AUTO_RESTART/1000}s... (${reason})`);
  restartTimeoutId = setTimeout(() => {
    if (userStopped) return;
    isRunning = true;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
    debugLog('🔄 Đang tự chạy lại flow từ prompt #' + (currentPromptIndex + 1));
    runFlow();
  }, TIMEOUTS.AUTO_RESTART);
}

// ============================================
// DOM CACHE
// ============================================

let cachedTextarea = null;
let cachedPromptArea = null;

/**
 * Get textarea element with caching
 * @returns {HTMLElement|null}
 */
function getTextarea() {
  if (!cachedTextarea || !document.contains(cachedTextarea)) {
    cachedTextarea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    cachedPromptArea = cachedTextarea ? (cachedTextarea.closest('div') || cachedTextarea.parentElement) : null;
  }
  return cachedTextarea;
}

/**
 * Get prompt area with caching
 * @returns {HTMLElement|null}
 */
function getPromptArea() {
  if (!cachedPromptArea || !document.contains(cachedPromptArea)) {
    const textarea = getTextarea();
    cachedPromptArea = textarea ? (textarea.closest('div') || textarea.parentElement) : null;
  }
  return cachedPromptArea;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sleep helper function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Wait for a condition to become true
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @param {string} errorMessage - Error message if timeout
 * @returns {Promise<boolean>}
 */
async function waitForCondition(condition, timeout, interval = DELAYS.NORMAL, errorMessage = 'Timeout') {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) return true;
    await sleep(interval);
  }
  throw new Error(errorMessage);
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Async function that returns { success: boolean, ...data }
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise<{success: boolean, retryCount: number, ...data}>}
 */
async function retryOperation(operation, maxRetries = RETRY_LIMITS.PROMPT, delay = DELAYS.STABILIZE, operationName = 'operation') {
  let retryCount = 0;
  while (retryCount < maxRetries && !userStopped) {
    try {
      const result = await operation();
      if (result && result.success !== false) {
        return { ...result, retryCount, success: true };
      }
      retryCount++;
      if (retryCount < maxRetries) {
        debugLog(`🔄 Retry ${operationName} lần ${retryCount}/${maxRetries}...`);
        await sleep(delay);
      }
    } catch (e) {
      debugLog(`❌ Lỗi khi ${operationName}: ${e}`);
      retryCount++;
      if (retryCount < maxRetries) {
        debugLog(`🔄 Retry ${operationName} lần ${retryCount}/${maxRetries} sau lỗi...`);
        await sleep(delay);
      }
    }
  }
  return { success: false, retryCount };
}

/**
 * Chờ thumbnail ảnh xuất hiện sau khi crop
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} true nếu thumbnail xuất hiện hoặc nút "+" đã biến mất
 */
async function waitForThumbnailAfterCrop(timeout = TIMEOUTS.THUMBNAIL_CHECK) {
  debugLog('⏳ Đang chờ thumbnail ảnh xuất hiện...');
  let thumbnailVisible = false;
  let plusButtonGone = false;
  const maxTries = Math.floor(timeout / DELAYS.NORMAL);
  let tries = 0;
  
  while (!thumbnailVisible && !plusButtonGone && tries < maxTries) {
    // Check userStopped
    if (userStopped) {
      debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ thumbnail');
      throw 'User đã dừng';
    }
    
    thumbnailVisible = isImageThumbnailVisible();
    plusButtonGone = !isPlusButtonStillVisible();
    
    // Nếu thumbnail đã xuất hiện HOẶC nút "+" đã biến mất thì OK
    if (thumbnailVisible || plusButtonGone) break;
    
    await sleep(DELAYS.NORMAL);
    tries++;
    
    if (tries % 4 === 0) {
      debugLog(`  Đã chờ ${tries * 0.5}s, thumbnail: ${thumbnailVisible}, nút "+": ${!plusButtonGone ? 'còn' : 'mất'}...`);
    }
  }
  
  if (thumbnailVisible) {
    debugLog('✅ Thumbnail ảnh đã xuất hiện (thay thế nút dấu "+")');
  } else if (plusButtonGone) {
    debugLog('✅ Nút dấu "+" đã biến mất, thumbnail có thể đã xuất hiện');
  } else {
    debugLog(`⚠️ Thumbnail ảnh chưa xuất hiện và nút "+" vẫn còn sau ${timeout/1000}s, vẫn tiếp tục...`);
  }
  
  await sleep(DELAYS.STABILIZE);
  return thumbnailVisible || plusButtonGone;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate prompt để tránh injection và DoS
 * @param {string} prompt - Prompt text để validate
 * @returns {boolean} true nếu hợp lệ
 */
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }
  

  
  // Kiểm tra không có script tags hoặc các ký tự nguy hiểm
  if (prompt.includes('<script') || prompt.includes('</script>')) {
    return false;
  }
  
  return true;
}

/**
 * Validate base64 image data
 * @param {string} imageBase64 - Base64 data URL
 * @returns {boolean} true nếu hợp lệ
 */
function validateBase64Image(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return false;
  }
  
  // Kiểm tra format data URL
  if (!imageBase64.startsWith('data:image/')) {
    return false;
  }
  
  // Kiểm tra có base64 data không
  const parts = imageBase64.split(',');
  if (parts.length !== 2 || !parts[1]) {
    return false;
  }
  
  // Kiểm tra mime type hợp lệ
  const mimeMatch = imageBase64.match(/data:image\/([^;]+);/);
  if (!mimeMatch) {
    return false;
  }
  
  const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  const imageType = mimeMatch[1].toLowerCase();
  if (!validTypes.includes(imageType)) {
    return false;
  }
  
  // Kiểm tra kích thước base64 (ước tính max 15MB khi decode)
  const base64Data = parts[1];
  const estimatedSize = (base64Data.length * 3) / 4; // Base64 encoding overhead
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (estimatedSize > MAX_SIZE) {
    return false;
  }
  
  return true;
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

function sendQueueProgressUpdate() {
  try {
    // Tính toán thông tin chi tiết về queue và prompt hiện tại
    let currentQueueNum = currentQueueIndex + 1;
    let currentPromptNum = 0;
    let totalPromptsInCurrentQueue = 0;
    
    if (currentQueueIndex < queueList.length) {
      const currentQueueItem = queueList[currentQueueIndex];
      const prompts = Array.isArray(currentQueueItem.prompts) ? currentQueueItem.prompts : (currentQueueItem.prompt ? [currentQueueItem.prompt] : []);
      totalPromptsInCurrentQueue = prompts.length;
      currentPromptNum = currentPromptIndexInQueue + 1; // +1 vì hiển thị từ 1, không phải 0
    }
    
    chrome.runtime.sendMessage({
      type: 'QUEUE_PROGRESS_UPDATE',
      done: currentQueueIndex,
      total: queueList.length,
      currentQueueNum: currentQueueNum,
      currentPromptNum: currentPromptNum,
      totalPromptsInCurrentQueue: totalPromptsInCurrentQueue,
      totalPromptsProcessed: totalPromptsProcessed
    });
  } catch (_) {}
}


// Helper: Kiểm tra có progress % đang chạy không
function isProgressRunning() {
  return Array.from(document.querySelectorAll('*')).some(el => {
    const text = el.textContent.trim();
    // Cho phép có khoảng trắng giữa số và dấu % (ví dụ: "0 %" hoặc "0%")
    return /^\d+\s*%$/.test(text) && el.offsetParent !== null;
  });
}

/**
 * Kiểm tra xem tab hiện tại có phải là tab Scenebuilder không
 * @returns {boolean} true nếu đang ở tab Scenebuilder
 */
function isScenebuilderTab() {
  try {
    // 1. Check URL có chứa labs.google
    if (!window.location.href.includes('labs.google')) {
      return false;
    }
    
    // 2. Check có textarea prompt (điều kiện quan trọng nhất)
    const textarea = document.querySelector('#PINHOLE_TEXT_AREA_ELEMENT_ID');
    if (!textarea) {
      return false; // Không có textarea thì chắc chắn không phải Scenebuilder
    }
    
    // 3. Check breadcrumb có "Scenebuilder" hoặc "SceneBuilder" (optional, có thể chưa render)
    const allElements = Array.from(document.querySelectorAll('*'));
    const breadcrumbs = allElements.filter(el => {
      const text = el.textContent || '';
      return (text.includes('Scenebuilder') || text.includes('SceneBuilder')) && 
             el.offsetParent !== null; // Chỉ lấy element visible
    });
    
    // 4. Check có nút generate (icon arrow_forward) - optional
    const hasGenerateBtn = Array.from(document.querySelectorAll('button i.google-symbols'))
      .some(i => i.textContent.trim() === 'arrow_forward');
    
    // Nếu có textarea và (breadcrumb hoặc nút generate) → là Scenebuilder
    // Nếu chỉ có textarea mà không có breadcrumb/generate → có thể là Scenebuilder đang load, vẫn return true
    return textarea !== null;
  } catch (e) {
    debugLog('⚠️ isScenebuilderTab lỗi: ' + e);
    return false;
  }
}

/**
 * Gửi message đến sidepanel để hiển thị/ẩn mask
 * @param {boolean} show - true để hiển thị, false để ẩn
 */
function updateScenebuilderMask(show) {
  try {
    chrome.runtime.sendMessage({
      type: 'SCENEBUILDER_MASK',
      show: show
    });
  } catch (e) {
    debugLog('⚠️ updateScenebuilderMask lỗi: ' + e);
  }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender - chỉ chấp nhận message từ extension
  if (!sender || sender.id !== chrome.runtime.id) {
    console.warn('⚠️ Message từ sender không hợp lệ:', sender);
    return false;
  }
  
  // Validate message structure
  if (!message || typeof message !== 'object' || !message.type) {
    console.warn('⚠️ Message không hợp lệ:', message);
    return false;
  }
  
  // Xử lý async messages
  if (message.type === 'START_FLOW') {
    // Validate START_FLOW message structure
    if (!Array.isArray(message.prompts) || message.prompts.length === 0) {
      sendResponse && sendResponse({ ok: false, error: 'Prompts không hợp lệ' });
      return false;
    }
    
    // Validate prompts
    const invalidPrompts = message.prompts.filter(p => !validatePrompt(p));
    if (invalidPrompts.length > 0) {
      sendResponse && sendResponse({ ok: false, error: `Có ${invalidPrompts.length} prompt không hợp lệ` });
      return false;
    }
    
    // Validate initialImageFile nếu có
    if (message.initialImageFile && !validateBase64Image(message.initialImageFile)) {
      sendResponse && sendResponse({ ok: false, error: 'Base64 image không hợp lệ' });
      return false;
    }
    (async () => {
      try {
    if (isRunning) {
      debugLog('Đã chạy rồi, bỏ qua START_FLOW');
          sendResponse && sendResponse({ ok: false, error: 'Đã chạy rồi' });
      return;
    }
    
    // Kiểm tra xem có đang ở tab Scenebuilder không
    if (!isScenebuilderTab()) {
      debugLog('❌ Không phải tab Scenebuilder! Vui lòng mở tab Scenebuilder để sử dụng extension.');
      updateScenebuilderMask(true);
      sendResponse && sendResponse({ ok: false, error: 'Không phải tab Scenebuilder' });
      return;
    }
    
    // Ẩn mask nếu đang hiển thị
    updateScenebuilderMask(false);
    
    userStopped = false;
    clearRestartTimer();
        await clearFlowState(); // Xóa state cũ khi bắt đầu flow mới
        
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
        
        try {
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
        } catch (e) {
          console.error('Lỗi khi gửi FLOW_STATUS: ', e);
        }
        
    debugLog('Bắt đầu flow với ' + prompts.length + ' prompt');
    if (initialImageFile) {
      debugLog('📷 Có ảnh bắt đầu được cung cấp');
    }
    sendProgressUpdate();
    runFlow();
    sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong START_FLOW: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'STOP_FLOW') {
    (async () => {
      try {
        // Dừng ngay lập tức - set flags trước
        userStopped = true;
        isRunning = false;
        
        // Clear tất cả timers
        clearRestartTimer();
        
        // Nếu đang ở queue mode, lưu state với isRunning = false để có thể continue sau
        if (isQueueMode && queueList.length > 0) {
          // Lưu queue state với isRunning = false
          await saveQueueState();
          debugLog('⏹️ Đã dừng queue (state đã được lưu để continue sau)');
        } else {
          // Normal flow mode hoặc không có queue - xóa state
          await clearFlowState();
          await clearQueueState();
          
          // Reset các biến state
          prompts = [];
          queueList = [];
          currentPromptIndex = 0;
          currentQueueIndex = 0;
          currentPromptIndexInQueue = 0;
          totalPrompts = 0;
          totalPromptsProcessed = 0;
          isQueueMode = false;
          initialImageFile = null;
          
          debugLog('⏹️ Đã dừng flow (state đã được xóa)');
        }
        
        try {
          chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
        } catch (e) {
          console.error('Lỗi khi gửi FLOW_STATUS: ', e);
        }
        
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong STOP_FLOW: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'DEBUG_TEST') {
    debugLog('content.js đã nhận DEBUG_TEST');
    sendResponse && sendResponse({ ok: true });
    return false; // Response đồng bộ
  }
  
  if (message.type === 'START_QUEUE') {
    // Validate START_QUEUE message structure
    if (!Array.isArray(message.queueList) || message.queueList.length === 0) {
      sendResponse && sendResponse({ ok: false, error: 'Queue list không hợp lệ' });
      return false;
    }
    
    // Validate queue items
    for (let i = 0; i < message.queueList.length; i++) {
      const queueItem = message.queueList[i];
      
      // Validate prompts (có thể là array hoặc string - backward compatible)
      let prompts = [];
      if (Array.isArray(queueItem.prompts)) {
        prompts = queueItem.prompts;
      } else if (queueItem.prompt && typeof queueItem.prompt === 'string') {
        prompts = [queueItem.prompt];
      } else {
        sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: prompts không hợp lệ` });
        return false;
      }
      
      if (prompts.length === 0) {
        sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: không có prompt nào` });
        return false;
      }
      
      // Validate từng prompt
      for (let j = 0; j < prompts.length; j++) {
        if (!validatePrompt(prompts[j])) {
          sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}, Prompt #${j + 1}: không hợp lệ (chứa ký tự không cho phép)` });
          return false;
        }
      }
      
      // Validate image if provided
      if (queueItem.imageBase64 !== null && queueItem.imageBase64 !== undefined) {
        if (!validateBase64Image(queueItem.imageBase64)) {
          sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: Base64 image không hợp lệ` });
          return false;
        }
      }
    }
    
    (async () => {
      try {
        if (isRunning) {
          debugLog('Đã chạy rồi, bỏ qua START_QUEUE');
          sendResponse && sendResponse({ ok: false, error: 'Đã chạy rồi' });
          return;
        }
        
        // Kiểm tra xem có đang ở tab Scenebuilder không
        if (!isScenebuilderTab()) {
          debugLog('❌ Không phải tab Scenebuilder! Vui lòng mở tab Scenebuilder để sử dụng extension.');
          updateScenebuilderMask(true);
          sendResponse && sendResponse({ ok: false, error: 'Không phải tab Scenebuilder' });
          return;
        }
        
        // Ẩn mask nếu đang hiển thị
        updateScenebuilderMask(false);
        
        userStopped = false;
        clearRestartTimer();
        await clearQueueState(); // Xóa state cũ khi bắt đầu queue mới
        
        // Kiểm tra nếu còn video đang render thì không cho chạy queue mới
        if (isProgressRunning()) {
          debugLog('⚠️ Đang có video render, không thể chạy queue mới!');
          sendResponse && sendResponse({ ok: false, error: 'Video đang render' });
          return;
        }
        
        // Set queue mode
        queueList = message.queueList;
        currentQueueIndex = 0;
        currentPromptIndexInQueue = 0; // Reset khi bắt đầu queue mới
        totalPromptsProcessed = 0; // Reset counter khi bắt đầu queue mới
        isQueueMode = true;
        isRunning = true;
        
        // Lưu state vào IndexedDB
        await saveQueueState();
        
        try {
          chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Queue Running' });
        } catch (e) {
          console.error('Lỗi khi gửi FLOW_STATUS: ', e);
        }
        
        debugLog('Bắt đầu queue với ' + queueList.length + ' queue items');
        sendQueueProgressUpdate();
        runQueueFlow();
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong START_QUEUE: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'CONTINUE_QUEUE') {
    (async () => {
      try {
        // Kiểm tra có queue state không
        const hasQueueState = await restoreQueueState();
        if (!hasQueueState) {
          sendResponse && sendResponse({ ok: false, error: 'Không có queue state để tiếp tục' });
          return;
        }
        
        // Kiểm tra xem có đang ở tab Scenebuilder không
        if (!isScenebuilderTab()) {
          debugLog('❌ Không phải tab Scenebuilder!');
          updateScenebuilderMask(true);
          sendResponse && sendResponse({ ok: false, error: 'Không phải tab Scenebuilder' });
          return;
        }
        
        // Ẩn mask nếu đang hiển thị
        updateScenebuilderMask(false);
        
        userStopped = false;
        clearRestartTimer();
        
        // Kiểm tra nếu còn video đang render thì không cho continue
        if (isProgressRunning()) {
          debugLog('⚠️ Đang có video render, không thể continue queue!');
          sendResponse && sendResponse({ ok: false, error: 'Video đang render' });
          return;
        }
        
        // Đảm bảo isRunning = true và isQueueMode = true
        isRunning = true;
        isQueueMode = true;
        
        try {
          chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Queue Running' });
        } catch (e) {
          console.error('Lỗi khi gửi FLOW_STATUS: ', e);
        }
        
        debugLog(`Tiếp tục queue từ queue #${currentQueueIndex + 1}, prompt #${currentPromptIndexInQueue + 1}`);
        sendQueueProgressUpdate();
        runQueueFlow();
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong CONTINUE_QUEUE: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'RESTART_QUEUE') {
    // Validate RESTART_QUEUE message structure
    if (!Array.isArray(message.queueList) || message.queueList.length === 0) {
      sendResponse && sendResponse({ ok: false, error: 'Queue list không hợp lệ' });
      return false;
    }
    
    // Validate queue items (giống START_QUEUE)
    for (let i = 0; i < message.queueList.length; i++) {
      const queueItem = message.queueList[i];
      
      let prompts = [];
      if (Array.isArray(queueItem.prompts)) {
        prompts = queueItem.prompts;
      } else if (queueItem.prompt && typeof queueItem.prompt === 'string') {
        prompts = [queueItem.prompt];
      } else {
        sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: prompts không hợp lệ` });
        return false;
      }
      
      if (prompts.length === 0) {
        sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: không có prompt nào` });
        return false;
      }
      
      for (let j = 0; j < prompts.length; j++) {
        if (!validatePrompt(prompts[j])) {
          sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}, Prompt #${j + 1}: không hợp lệ` });
          return false;
        }
      }
      
      if (queueItem.imageBase64 !== null && queueItem.imageBase64 !== undefined) {
        if (!validateBase64Image(queueItem.imageBase64)) {
          sendResponse && sendResponse({ ok: false, error: `Queue #${i + 1}: Base64 image không hợp lệ` });
          return false;
        }
      }
    }
    
    (async () => {
      try {
        // Kiểm tra xem có đang ở tab Scenebuilder không
        if (!isScenebuilderTab()) {
          debugLog('❌ Không phải tab Scenebuilder!');
          updateScenebuilderMask(true);
          sendResponse && sendResponse({ ok: false, error: 'Không phải tab Scenebuilder' });
          return;
        }
        
        // Ẩn mask nếu đang hiển thị
        updateScenebuilderMask(false);
        
        userStopped = false;
        clearRestartTimer();
        await clearQueueState(); // Xóa state cũ khi restart
        
        // Kiểm tra nếu còn video đang render thì không cho restart
        if (isProgressRunning()) {
          debugLog('⚠️ Đang có video render, không thể restart queue!');
          sendResponse && sendResponse({ ok: false, error: 'Video đang render' });
          return;
        }
        
        // Set queue mode - restart từ đầu
        queueList = message.queueList;
        currentQueueIndex = 0;
        currentPromptIndexInQueue = 0;
        totalPromptsProcessed = 0;
        isQueueMode = true;
        isRunning = true;
        
        // Lưu state mới
        await saveQueueState();
        
        try {
          chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Queue Running' });
        } catch (e) {
          console.error('Lỗi khi gửi FLOW_STATUS: ', e);
        }
        
        debugLog('Restart queue với ' + queueList.length + ' queue items');
        sendQueueProgressUpdate();
        runQueueFlow();
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong RESTART_QUEUE: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'UPDATE_QUEUE_LIST') {
    (async () => {
      try {
        // Validate queue list
        if (!Array.isArray(message.queueList)) {
          sendResponse && sendResponse({ ok: false, error: 'Queue list không hợp lệ' });
          return;
        }
        
        // Cập nhật queueList nhưng giữ nguyên state hiện tại (currentQueueIndex, currentPromptIndexInQueue)
        // Chỉ cập nhật dữ liệu của queue, không restart
        queueList = message.queueList;
        
        // Lưu state mới với queue list đã cập nhật
        await saveQueueState();
        
        debugLog('Đã cập nhật queue list (giữ nguyên vị trí hiện tại)');
        sendResponse && sendResponse({ ok: true });
      } catch (e) {
        console.error('Lỗi trong UPDATE_QUEUE_LIST: ', e);
        sendResponse && sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // Báo cho Chrome biết sẽ gửi response bất đồng bộ
  }
  
  if (message.type === 'CHECK_SCENEBUILDER_TAB') {
    const isScenebuilder = isScenebuilderTab();
    updateScenebuilderMask(!isScenebuilder);
    sendResponse && sendResponse({ ok: true, isScenebuilder });
    return false; // Response đồng bộ
  }
  
  return false; // Không xử lý message này
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
  // Kiểm tra xem có đang ở tab Scenebuilder không
  if (!isScenebuilderTab()) {
    debugLog('❌ Không phải tab Scenebuilder! Dừng flow.');
    updateScenebuilderMask(true);
    isRunning = false;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
    return;
  }
  
  // Ẩn mask nếu đang hiển thị
  updateScenebuilderMask(false);
  
  // Check xem có video trong scene chưa
  const hasVideo = hasVideoInScene();
  debugLog('📸 Đang check video trong scene...');
  
  // Nếu chưa có video và có ảnh bắt đầu, xử lý luồng mới
  if (!hasVideo && initialImageFile && currentPromptIndex === 0) {
    debugLog('📷 Chưa có video, bắt đầu với ảnh');
    
    let imageFlowSuccess = false;
    let imageFlowRetryCount = 0;
    
    while (!imageFlowSuccess && imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW && !userStopped) {
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
          
          // Check mode Frame to Video trước khi chọn ảnh (quan trọng khi retry)
          await ensureFrameToVideoMode();
          
          // Đóng menu frame nếu còn mở (từ lần generate trước)
          await closeMenuFrame();
          await sleep(DELAYS.LONG);
          
          // Mở image picker và chọn asset đầu tiên
          debugLog('📂 Đang mở image picker để chọn lại asset...');
          await openImagePicker();
          await sleep(DELAYS.LONG);
          
          debugLog('🎯 Đang chọn asset đầu tiên...');
          await selectLatestAsset();
          debugLog('✅ Đã chọn asset đầu tiên xong');
        }
        
        // Kiểm tra dấu "+" đã chuyển thành thumbnail chưa trước khi nhập prompt
        debugLog('⏳ Kiểm tra dấu "+" đã chuyển thành thumbnail...');
        let plusButtonGone = false;
        let checkTries = 0;
        const maxCheckTries = RETRY_LIMITS.THUMBNAIL_CHECK;
        
        while (isPlusButtonStillVisible() && checkTries < maxCheckTries) {
          // Check userStopped
          if (userStopped) {
            debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ thumbnail');
            throw 'User đã dừng';
          }
          
          await sleep(DELAYS.NORMAL);
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
        
        // Kiểm tra lại một lần nữa sau khi chờ
        const finalThumbnailVisible = isImageThumbnailVisible();
        const finalPlusButtonVisible = isPlusButtonStillVisible();
        
        if (finalThumbnailVisible) {
          // Thumbnail đã xuất hiện → OK, không cần quan tâm nút "+" nữa
          debugLog('✅ Thumbnail đã xuất hiện, dấu "+" đã được thay thế');
        } else if (!finalPlusButtonVisible) {
          // Nút "+" đã biến mất → OK, có thể thumbnail đang load
          debugLog('✅ Dấu "+" đã biến mất, thumbnail có thể đã xuất hiện');
        } else {
          // Sau 10s mà dấu "+" vẫn còn và thumbnail chưa xuất hiện
          debugLog('⚠️ Dấu "+" chưa chuyển thành thumbnail sau 10s, tắt menu frame và retry...');
          await closeMenuFrame();
          throw 'Dấu "+" chưa chuyển thành thumbnail sau 10s';
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
        const startTime = Date.now(); // Lưu thời gian bắt đầu
        // Khởi tạo với giá trị hiện tại để có thể detect progress biến mất ngay từ đầu
        let progressWasRunning = isProgressRunning();
        let progressDisappeared = false;
        let noProgressStartTime = null; // Thời điểm bắt đầu không có progress
        
        while (newAssetCount <= prevAssetCount && waitTries < TIMEOUTS.ASSET_WAIT / 1000) {
          // Check userStopped trước mỗi lần lặp
          if (userStopped) {
            debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ');
            return;
          }
          
          const progressRunning = isProgressRunning();
          
          // Phát hiện progress biến mất (từ có → không có)
          if (progressWasRunning && !progressRunning && !progressDisappeared) {
            // Check userStopped trước khi reload
            if (userStopped) {
              debugLog('⏹️ User đã dừng, không reload');
              return;
            }
            
            debugLog('⚠️ Progress % đã biến mất, kiểm tra số lượng video ngay...');
            // Không đợi 3s, check ngay lập tức để phát hiện lỗi nhanh hơn
            await sleep(500); // Chỉ đợi 0.5s để DOM cập nhật
            newAssetCount = getAssetCount();
            
            if (newAssetCount <= prevAssetCount) {
              // Video render thất bại: số video không đổi sau khi progress biến mất
              debugLog(`⚠️ Video render thất bại: số video không đổi (${prevAssetCount} → ${newAssetCount})`);
              debugLog('🔄 Đang reload trang để retry prompt này...');
              // KHÔNG tăng currentPromptIndex để retry lại prompt này sau khi reload
              await saveFlowState();
              await sleep(500);
              location.reload();
              return; // Dừng flow, sẽ tiếp tục sau khi reload
            } else {
              // Video render thành công: số video đã tăng
              debugLog(`✅ Video render thành công sau khi progress biến mất (${prevAssetCount} → ${newAssetCount})`);
              break; // Thoát vòng lặp
            }
            progressDisappeared = true;
          }
          
          // Check: Nếu không có progress và số video không tăng sau 10s → reload ngay
          if (!progressRunning) {
            if (noProgressStartTime === null) {
              noProgressStartTime = Date.now();
            } else {
              const noProgressDuration = Date.now() - noProgressStartTime;
              // Nếu không có progress trong 10 giây và số video không tăng → reload
              if (noProgressDuration > 10000 && newAssetCount <= prevAssetCount) {
                // Check userStopped trước khi reload
                if (userStopped) {
                  debugLog('⏹️ User đã dừng, không reload');
                  return;
                }
                
                debugLog(`⚠️ Không có progress trong ${Math.floor(noProgressDuration/1000)}s và số video không tăng (${prevAssetCount} → ${newAssetCount})`);
                debugLog('🔄 Đang reload trang để retry prompt này...');
                await saveFlowState();
                await sleep(500);
                location.reload();
                return; // Dừng flow, sẽ tiếp tục sau khi reload
              }
            }
          } else {
            // Có progress → reset timer
            noProgressStartTime = null;
          }
          
          progressWasRunning = progressRunning;
          
          await sleep(DELAYS.LONG);
          newAssetCount = getAssetCount();
          waitTries++;
          
          // Tính thời gian thực tế đã chờ (tính bằng giây)
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          
          if (waitTries % 20 === 0) {
            debugLog(`  Đã chờ ${elapsedSeconds}s... (${prevAssetCount} → ${newAssetCount})`);
          }
        }
        
        if (newAssetCount > prevAssetCount) {
          debugLog('✅ Đã xong prompt #' + (currentPromptIndex + 1) + ', video đã được tạo (' + prevAssetCount + ' → ' + newAssetCount + ')');
          currentPromptIndex++;
          sendProgressUpdate();
          // Reset initialImageFile sau khi đã sử dụng
          initialImageFile = null;
          imageFlowSuccess = true;
          
          // Reload trang sau mỗi 4 prompt thành công (nếu còn prompt tiếp theo)
          // Reload khi currentPromptIndex là 4, 8, 12... (bội số của 4)
          if (currentPromptIndex < prompts.length && currentPromptIndex % 4 === 0) {
            debugLog(`🔄 Đã hoàn thành ${currentPromptIndex} prompt, đang lưu state và reload trang...`);
            await saveFlowState();
            await sleep(500); // Đợi một chút để đảm bảo state được lưu
            location.reload();
            return; // Dừng flow, sẽ tiếp tục sau khi reload
          }
        } else {
          // Video render lỗi (timeout), reload trang ngay lập tức để retry
          debugLog(`⚠️ Video chưa được tạo sau ${TIMEOUTS.ASSET_WAIT/60000} phút, video render có thể bị lỗi`);
          debugLog('🔄 Đang reload trang để retry prompt này...');
          // KHÔNG tăng currentPromptIndex để retry lại prompt này sau khi reload
          await saveFlowState();
          await sleep(500);
          location.reload();
          return; // Dừng flow, sẽ tiếp tục sau khi reload
        }
        
      } catch (e) {
        // Check userStopped trước
        if (userStopped) {
          debugLog('⏹️ User đã dừng, không retry');
          return;
        }
        
        const errorMsg = e instanceof Error ? e.message : String(e);
        
        // Kiểm tra nếu là lỗi user dừng
        if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
          debugLog('⏹️ User đã dừng, không retry');
          return;
        }
        
        // Kiểm tra nếu là lỗi trang chết, reload ngay lập tức
        if (e instanceof Error && e.isPageDead) {
          debugLog('⚠️ Phát hiện trang bị chết trong image flow, đang reload trang ngay lập tức...');
          await saveFlowState();
          await sleep(500);
          location.reload();
          return; // Dừng flow, sẽ tiếp tục sau khi reload
        }
        
        debugLog(`❌ Lỗi khi xử lý ảnh bắt đầu (retry ${imageFlowRetryCount + 1}/${RETRY_LIMITS.IMAGE_FLOW}): ${errorMsg}`);
        imageFlowRetryCount++;
        
        if (imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW) {
          debugLog(`🔄 Retry luồng chọn ảnh lần ${imageFlowRetryCount}/${RETRY_LIMITS.IMAGE_FLOW} sau lỗi...`);
          await sleep(DELAYS.STABILIZE);
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
      
      while (!success && retryCount < RETRY_LIMITS.PROMPT && !userStopped) {
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
          const startTime = Date.now(); // Lưu thời gian bắt đầu
          // Khởi tạo với giá trị hiện tại để có thể detect progress biến mất ngay từ đầu
          let progressWasRunning = isProgressRunning();
          let progressDisappeared = false;
          let noProgressStartTime = null; // Thời điểm bắt đầu không có progress
          
          while (newAssetCount <= prevAssetCount && waitTries < TIMEOUTS.ASSET_WAIT / 1000) {
            // Check userStopped trước mỗi lần lặp
            if (userStopped) {
              debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ');
              return;
            }
            
            const progressRunning = isProgressRunning();
            
            // Phát hiện progress biến mất (từ có → không có)
            if (progressWasRunning && !progressRunning && !progressDisappeared) {
              // Check userStopped trước khi reload
              if (userStopped) {
                debugLog('⏹️ User đã dừng, không reload');
                return;
              }
              
              debugLog('⚠️ Progress % đã biến mất, kiểm tra số lượng video ngay...');
              // Không đợi 3s, check ngay lập tức để phát hiện lỗi nhanh hơn
              await sleep(500); // Chỉ đợi 0.5s để DOM cập nhật
              newAssetCount = getAssetCount();
              
              if (newAssetCount <= prevAssetCount) {
                // Video render thất bại: số video không đổi sau khi progress biến mất
                debugLog(`⚠️ Video render thất bại: số video không đổi (${prevAssetCount} → ${newAssetCount})`);
                debugLog('🔄 Đang reload trang để retry prompt này...');
                // KHÔNG tăng currentPromptIndex để retry lại prompt này sau khi reload
                await saveFlowState();
                await sleep(500);
                location.reload();
                return; // Dừng flow, sẽ tiếp tục sau khi reload
              } else {
                // Video render thành công: số video đã tăng
                debugLog(`✅ Video render thành công sau khi progress biến mất (${prevAssetCount} → ${newAssetCount})`);
                break; // Thoát vòng lặp
              }
              progressDisappeared = true;
            }
            
            // Check: Nếu không có progress và số video không tăng sau 10s → reload ngay
            if (!progressRunning) {
              if (noProgressStartTime === null) {
                noProgressStartTime = Date.now();
              } else {
                const noProgressDuration = Date.now() - noProgressStartTime;
                // Nếu không có progress trong 10 giây và số video không tăng → reload
                if (noProgressDuration > 10000 && newAssetCount <= prevAssetCount) {
                  // Check userStopped trước khi reload
                  if (userStopped) {
                    debugLog('⏹️ User đã dừng, không reload');
                    return;
                  }
                  
                  debugLog(`⚠️ Không có progress trong ${Math.floor(noProgressDuration/1000)}s và số video không tăng (${prevAssetCount} → ${newAssetCount})`);
                  debugLog('🔄 Đang reload trang để retry prompt này...');
                  await saveFlowState();
                  await sleep(500);
                  location.reload();
                  return; // Dừng flow, sẽ tiếp tục sau khi reload
                }
              }
            } else {
              // Có progress → reset timer
              noProgressStartTime = null;
            }
            
            progressWasRunning = progressRunning;
            
            await sleep(DELAYS.LONG);
            newAssetCount = getAssetCount();
            waitTries++;
            
            // Tính thời gian thực tế đã chờ (tính bằng giây)
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            
            // Log progress mỗi 20s (mỗi 20 lần lặp)
            if (waitTries % 20 === 0) {
              debugLog(`  Đã chờ ${elapsedSeconds}s... (${prevAssetCount} → ${newAssetCount})`);
            }
          }
          
          if (newAssetCount > prevAssetCount) {
            debugLog('✅ Đã xong prompt #' + (currentPromptIndex + 1) + ', asset mới đã được thêm (' + prevAssetCount + ' → ' + newAssetCount + ')');
            success = true;
            currentPromptIndex++;
            sendProgressUpdate();
            
            // Reload trang sau mỗi 4 prompt thành công (nếu còn prompt tiếp theo)
            // Reload khi currentPromptIndex là 4, 8, 12... (bội số của 4)
            if (currentPromptIndex < prompts.length && currentPromptIndex % 4 === 0) {
              debugLog(`🔄 Đã hoàn thành ${currentPromptIndex} prompt, đang lưu state và reload trang...`);
              await saveFlowState();
              await sleep(500); // Đợi một chút để đảm bảo state được lưu
              location.reload();
              return; // Dừng flow, sẽ tiếp tục sau khi reload
            }
          } else {
            // Video render lỗi (timeout), reload trang ngay lập tức để retry
            debugLog(`⚠️ Asset mới chưa được thêm sau ${TIMEOUTS.ASSET_WAIT/60000} phút, video render có thể bị lỗi`);
            debugLog('🔄 Đang reload trang để retry prompt này...');
            // KHÔNG tăng currentPromptIndex để retry lại prompt này sau khi reload
            await saveFlowState();
            await sleep(500);
            location.reload();
            return; // Dừng flow, sẽ tiếp tục sau khi reload
          }
        } catch (e) {
          // Check userStopped trước
          if (userStopped) {
            debugLog('⏹️ User đã dừng, không retry');
            return;
          }
          
          const errorMsg = e instanceof Error ? e.message : String(e);
          
          // Kiểm tra nếu là lỗi user dừng
          if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
            debugLog('⏹️ User đã dừng, không retry');
            return;
          }
          
          // Kiểm tra nếu là lỗi trang chết, reload ngay lập tức
          if (e instanceof Error && e.isPageDead) {
            debugLog('⚠️ Phát hiện trang bị chết, đang reload trang ngay lập tức...');
            await saveFlowState();
            await sleep(500);
            location.reload();
            return; // Dừng flow, sẽ tiếp tục sau khi reload
          }
          
          debugLog(`❌ Lỗi khi chạy prompt #${currentPromptIndex + 1} (retry ${retryCount + 1}/${RETRY_LIMITS.PROMPT}): ${errorMsg}`);
          retryCount++;
          
          if (retryCount < RETRY_LIMITS.PROMPT) {
            debugLog(`🔄 Retry lần ${retryCount}/${RETRY_LIMITS.PROMPT} sau lỗi...`);
            await sleep(DELAYS.STABILIZE);
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
      // Check userStopped trước
      if (userStopped) {
        debugLog('⏹️ User đã dừng, không schedule auto-restart');
        isRunning = false;
        return;
      }
      
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      // Kiểm tra nếu là lỗi user dừng
      if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
        debugLog('⏹️ User đã dừng, không schedule auto-restart');
        isRunning = false;
        return;
      }
      
      debugLog(`❌ Lỗi không mong đợi trong runFlow: ${errorMsg}`);
      isRunning = false;
      scheduleAutoRestart('exception');
      return;
    }
  }

  debugLog('🎉 Kết thúc flow.');
  isRunning = false;
  await clearFlowState(); // Xóa state đã lưu
  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Idle' });
}

// ============================================
// QUEUE FLOW
// ============================================
async function runQueueFlow() {
  // Kiểm tra xem có đang ở tab Scenebuilder không
  if (!isScenebuilderTab()) {
    debugLog('❌ Không phải tab Scenebuilder! Dừng queue.');
    updateScenebuilderMask(true);
    isRunning = false;
    chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
    return;
  }
  
  // Ẩn mask nếu đang hiển thị
  updateScenebuilderMask(false);
  
  // Khởi tạo totalPromptsProcessed nếu chưa có (từ state restore)
  if (totalPromptsProcessed === undefined) {
    totalPromptsProcessed = 0;
  }
  
  // Chạy từng queue item
  while (isRunning && currentQueueIndex < queueList.length) {
    if (userStopped) {
      debugLog('⏹️ Queue dừng theo yêu cầu người dùng.');
      isRunning = false;
      chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
      return;
    }
    
    const queueItem = queueList[currentQueueIndex];
    
    // Lấy prompts (backward compatible: có thể là array hoặc string)
    const prompts = Array.isArray(queueItem.prompts) ? queueItem.prompts : (queueItem.prompt ? [queueItem.prompt] : []);
    
    debugLog(`🎬 Đang xử lý Queue #${currentQueueIndex + 1}/${queueList.length} với ${prompts.length} prompt(s)`);
    
    // Xử lý từng prompt trong queue item này, bắt đầu từ currentPromptIndexInQueue (để restore sau reload)
    for (let promptIndex = currentPromptIndexInQueue; promptIndex < prompts.length; promptIndex++) {
      if (userStopped) {
        debugLog('⏹️ Queue dừng theo yêu cầu người dùng.');
        isRunning = false;
        chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
        return;
      }
      
      const prompt = prompts[promptIndex];
      debugLog(`📝 Prompt ${promptIndex + 1}/${prompts.length}: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);
      
      try {
        const prevAssetCount = getAssetCount();
        debugLog('📊 Số assets trước khi chờ render: ' + prevAssetCount);
        
        let success = false;
        let retryCount = 0;
        
        while (!success && retryCount < RETRY_LIMITS.PROMPT && !userStopped) {
          try {
            // Queue đầu tiên (index 0) và prompt đầu tiên (promptIndex 0)
            if (currentQueueIndex === 0 && promptIndex === 0) {
              if (queueItem.imageBase64) {
                // Có ảnh: upload ảnh → crop → chọn asset → nhập prompt → generate
                // Sử dụng image flow retry logic giống flow bình thường
                let imageFlowSuccess = false;
                let imageFlowRetryCount = 0;
                
                while (!imageFlowSuccess && imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW && !userStopped) {
                  try {
                    if (imageFlowRetryCount === 0) {
                      // Lần đầu tiên: Upload ảnh và crop
                      debugLog('📷 Queue đầu tiên có ảnh, đang upload...');
                      
                      // 1. Chọn mode Frame to Video
                      await ensureFrameToVideoMode();
                      
                      // 2. Upload ảnh
                      await uploadImageFromFile(queueItem.imageBase64);
                      
                      // 3. Xử lý preview và crop
                      const hasDialog = await handleImagePreviewAndCrop();
                      
                      if (hasDialog) {
                        debugLog('📋 Có dialog Notice, cần chọn asset mới nhất');
                        await openImagePicker();
                        await selectLatestAsset();
                      } else {
                        debugLog('✅ Không có dialog, ảnh đã tự động được chọn');
                      }
                    } else {
                      // Retry: Ảnh đã có sẵn, chỉ cần chọn lại asset đầu tiên
                      debugLog(`🔄 Retry lần ${imageFlowRetryCount}/${RETRY_LIMITS.IMAGE_FLOW}: Chọn lại ảnh đã upload...`);
                      
                      // Check mode Frame to Video trước khi chọn ảnh (quan trọng khi retry)
                      await ensureFrameToVideoMode();
                      
                      // Đóng menu frame nếu còn mở (từ lần generate trước)
                      await closeMenuFrame();
                      await sleep(DELAYS.LONG);
                      
                      // Mở image picker và chọn asset đầu tiên
                      debugLog('📂 Đang mở image picker để chọn lại asset...');
                      await openImagePicker();
                      await sleep(DELAYS.LONG);
                      
                      debugLog('🎯 Đang chọn asset đầu tiên...');
                      await selectLatestAsset();
                      debugLog('✅ Đã chọn asset đầu tiên xong');
                    }
                    
                    // Kiểm tra dấu "+" đã chuyển thành thumbnail chưa trước khi nhập prompt
                    debugLog('⏳ Kiểm tra dấu "+" đã chuyển thành thumbnail...');
                    let plusButtonGone = false;
                    let checkTries = 0;
                    const maxCheckTries = RETRY_LIMITS.THUMBNAIL_CHECK;
                    
                    while (isPlusButtonStillVisible() && checkTries < maxCheckTries) {
                      // Check userStopped
                      if (userStopped) {
                        debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ thumbnail');
                        throw 'User đã dừng';
                      }
                      
                      await sleep(DELAYS.NORMAL);
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
                    
                    // Kiểm tra lại một lần nữa sau khi chờ
                    const finalThumbnailVisible = isImageThumbnailVisible();
                    const finalPlusButtonVisible = isPlusButtonStillVisible();
                    
                    if (finalThumbnailVisible) {
                      // Thumbnail đã xuất hiện → OK, không cần quan tâm nút "+" nữa
                      debugLog('✅ Thumbnail đã xuất hiện, dấu "+" đã được thay thế');
                    } else if (!finalPlusButtonVisible) {
                      // Nút "+" đã biến mất → OK, có thể thumbnail đang load
                      debugLog('✅ Dấu "+" đã biến mất, thumbnail có thể đã xuất hiện');
                    } else {
                      // Sau 10s mà dấu "+" vẫn còn và thumbnail chưa xuất hiện
                      debugLog('⚠️ Dấu "+" chưa chuyển thành thumbnail sau 10s, tắt menu frame và retry...');
                      await closeMenuFrame();
                      throw 'Dấu "+" chưa chuyển thành thumbnail sau 10s';
                    }
                    
                    // 4. Nhập prompt
                    debugLog('⌨️ Đang nhập prompt...');
                    await inputPrompt(prompt);
                    
                    // 5. Click generate
                    debugLog('🚀 Đang click generate...');
                    await clickGenerate();
                    
                    imageFlowSuccess = true;
                  } catch (e) {
                    // Check userStopped trước
                    if (userStopped) {
                      debugLog('⏹️ User đã dừng, không retry');
                      return;
                    }
                    
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    
                    // Kiểm tra nếu là lỗi user dừng
                    if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
                      debugLog('⏹️ User đã dừng, không retry');
                      return;
                    }
                    
                    // Kiểm tra nếu là lỗi trang chết, reload ngay lập tức
                    if (e instanceof Error && e.isPageDead) {
                      debugLog('⚠️ Phát hiện trang bị chết trong image flow, đang reload trang ngay lập tức...');
                      await saveQueueState();
                      await sleep(500);
                      location.reload();
                      return;
                    }
                    
                    debugLog(`❌ Lỗi khi xử lý ảnh bắt đầu (retry ${imageFlowRetryCount + 1}/${RETRY_LIMITS.IMAGE_FLOW}): ${errorMsg}`);
                    imageFlowRetryCount++;
                    
                    if (imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW) {
                      debugLog(`🔄 Retry luồng chọn ảnh lần ${imageFlowRetryCount}/${RETRY_LIMITS.IMAGE_FLOW} sau lỗi...`);
                      await sleep(DELAYS.STABILIZE);
                    }
                  }
                }
                
                if (!imageFlowSuccess && !userStopped) {
                  debugLog('❌ Không thể tạo video từ ảnh sau ' + imageFlowRetryCount + ' lần thử.');
                  debugLog('⏸️ Dừng queue tạm thời.');
                  isRunning = false;
                  scheduleAutoRestart('retry luồng chọn ảnh hết');
                  return;
                }
                
                if (userStopped) {
                  debugLog('⏹️ Queue dừng theo yêu cầu người dùng.');
                  isRunning = false;
                  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
                  return;
                }
              } else {
                // Không có ảnh: cần có video sẵn trong scene, dùng flow hiện tại
                debugLog('⚠️ Queue đầu tiên không có ảnh, cần có video sẵn trong scene');
                const hasVideo = hasVideoInScene();
                if (!hasVideo) {
                  throw 'Queue đầu tiên không có ảnh và không có video sẵn trong scene';
                }
                
                // 1. Chọn mode Frame to Video
                await ensureFrameToVideoMode();
                
                // 2. Dùng flow hiện tại: save frame → chọn asset → nhập prompt → generate
                await scrollAssetListToEnd();
                await saveFrameAsAsset();
                await openImagePicker();
                await selectLatestAsset();
                await inputPrompt(prompt);
                await clickGenerate();
              }
            } else {
              // Queue tiếp theo (index > 0) hoặc prompt tiếp theo trong cùng queue
              if (queueItem.imageBase64 && currentQueueIndex === 0 && promptIndex === 0) {
                // Queue đầu tiên có ảnh, prompt đầu tiên - đã xử lý ở trên
                // Không vào đây
              } else if (queueItem.imageBase64 && promptIndex === 0) {
                // Queue tiếp theo (index > 0) có ảnh, prompt đầu tiên: upload ảnh → crop → chọn asset → nhập prompt → generate (bỏ qua saveFrameAsAsset)
                // Sử dụng image flow retry logic giống flow bình thường
                let imageFlowSuccess = false;
                let imageFlowRetryCount = 0;
                
                while (!imageFlowSuccess && imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW && !userStopped) {
                  try {
                    if (imageFlowRetryCount === 0) {
                      // Lần đầu tiên: Upload ảnh và crop
                      debugLog('📷 Queue này có ảnh, đang upload trực tiếp (bỏ qua save frame)...');
                      
                      // 1. Chọn mode Frame to Video
                      await ensureFrameToVideoMode();
                      
                      // 2. Upload ảnh
                      await uploadImageFromFile(queueItem.imageBase64);
                      
                      // 3. Xử lý preview và crop
                      const hasDialog = await handleImagePreviewAndCrop();
                      
                      if (hasDialog) {
                        debugLog('📋 Có dialog Notice, cần chọn asset mới nhất');
                        await openImagePicker();
                        await selectLatestAsset();
                      } else {
                        debugLog('✅ Không có dialog, ảnh đã tự động được chọn');
                      }
                    } else {
                      // Retry: Ảnh đã có sẵn, chỉ cần chọn lại asset đầu tiên
                      debugLog(`🔄 Retry lần ${imageFlowRetryCount}/${RETRY_LIMITS.IMAGE_FLOW}: Chọn lại ảnh đã upload...`);
                      
                      // Check mode Frame to Video trước khi chọn ảnh (quan trọng khi retry)
                      await ensureFrameToVideoMode();
                      
                      // Đóng menu frame nếu còn mở (từ lần generate trước)
                      await closeMenuFrame();
                      await sleep(DELAYS.LONG);
                      
                      // Mở image picker và chọn asset đầu tiên
                      debugLog('📂 Đang mở image picker để chọn lại asset...');
                      await openImagePicker();
                      await sleep(DELAYS.LONG);
                      
                      debugLog('🎯 Đang chọn asset đầu tiên...');
                      await selectLatestAsset();
                      debugLog('✅ Đã chọn asset đầu tiên xong');
                    }
                    
                    // Kiểm tra dấu "+" đã chuyển thành thumbnail chưa trước khi nhập prompt
                    debugLog('⏳ Kiểm tra dấu "+" đã chuyển thành thumbnail...');
                    let plusButtonGone = false;
                    let checkTries = 0;
                    const maxCheckTries = RETRY_LIMITS.THUMBNAIL_CHECK;
                    
                    while (isPlusButtonStillVisible() && checkTries < maxCheckTries) {
                      // Check userStopped
                      if (userStopped) {
                        debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ thumbnail');
                        throw 'User đã dừng';
                      }
                      
                      await sleep(DELAYS.NORMAL);
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
                    
                    // Kiểm tra lại một lần nữa sau khi chờ
                    const finalThumbnailVisible = isImageThumbnailVisible();
                    const finalPlusButtonVisible = isPlusButtonStillVisible();
                    
                    if (finalThumbnailVisible) {
                      // Thumbnail đã xuất hiện → OK, không cần quan tâm nút "+" nữa
                      debugLog('✅ Thumbnail đã xuất hiện, dấu "+" đã được thay thế');
                    } else if (!finalPlusButtonVisible) {
                      // Nút "+" đã biến mất → OK, có thể thumbnail đang load
                      debugLog('✅ Dấu "+" đã biến mất, thumbnail có thể đã xuất hiện');
                    } else {
                      // Sau 10s mà dấu "+" vẫn còn và thumbnail chưa xuất hiện
                      debugLog('⚠️ Dấu "+" chưa chuyển thành thumbnail sau 10s, tắt menu frame và retry...');
                      await closeMenuFrame();
                      throw 'Dấu "+" chưa chuyển thành thumbnail sau 10s';
                    }
                    
                    // 4. Nhập prompt
                    debugLog('⌨️ Đang nhập prompt...');
                    await inputPrompt(prompt);
                    
                    // 5. Click generate
                    debugLog('🚀 Đang click generate...');
                    await clickGenerate();
                    
                    imageFlowSuccess = true;
                  } catch (e) {
                    // Check userStopped trước
                    if (userStopped) {
                      debugLog('⏹️ User đã dừng, không retry');
                      return;
                    }
                    
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    
                    // Kiểm tra nếu là lỗi user dừng
                    if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
                      debugLog('⏹️ User đã dừng, không retry');
                      return;
                    }
                    
                    // Kiểm tra nếu là lỗi trang chết, reload ngay lập tức
                    if (e instanceof Error && e.isPageDead) {
                      debugLog('⚠️ Phát hiện trang bị chết trong image flow, đang reload trang ngay lập tức...');
                      await saveQueueState();
                      await sleep(500);
                      location.reload();
                      return;
                    }
                    
                    debugLog(`❌ Lỗi khi xử lý ảnh (retry ${imageFlowRetryCount + 1}/${RETRY_LIMITS.IMAGE_FLOW}): ${errorMsg}`);
                    imageFlowRetryCount++;
                    
                    if (imageFlowRetryCount < RETRY_LIMITS.IMAGE_FLOW) {
                      debugLog(`🔄 Retry luồng chọn ảnh lần ${imageFlowRetryCount}/${RETRY_LIMITS.IMAGE_FLOW} sau lỗi...`);
                      await sleep(DELAYS.STABILIZE);
                    }
                  }
                }
                
                if (!imageFlowSuccess && !userStopped) {
                  debugLog('❌ Không thể tạo video từ ảnh sau ' + imageFlowRetryCount + ' lần thử.');
                  debugLog('⏸️ Dừng queue tạm thời.');
                  isRunning = false;
                  scheduleAutoRestart('retry luồng chọn ảnh hết');
                  return;
                }
                
                if (userStopped) {
                  debugLog('⏹️ Queue dừng theo yêu cầu người dùng.');
                  isRunning = false;
                  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Stopped' });
                  return;
                }
              } else {
                // Không có ảnh hoặc prompt tiếp theo: dùng flow hiện tại (saveFrameAsAsset → chọn asset → nhập prompt → generate)
                debugLog('📸 Dùng frame từ video trước...');
                
                // 1. Chọn mode Frame to Video
                await ensureFrameToVideoMode();
                
                // 2. Save frame → chọn asset → nhập prompt → generate
                await scrollAssetListToEnd();
                await saveFrameAsAsset();
                await openImagePicker();
                await selectLatestAsset();
                await inputPrompt(prompt);
                await clickGenerate();
              }
            }
          
          // Chờ asset mới xuất hiện (tối đa 3 phút)
          debugLog('⏳ Đang chờ asset mới xuất hiện...');
          let waitTries = 0;
          let newAssetCount = getAssetCount();
          const startTime = Date.now();
          let progressWasRunning = isProgressRunning();
          let progressDisappeared = false;
          let noProgressStartTime = null;
          
          while (newAssetCount <= prevAssetCount && waitTries < TIMEOUTS.ASSET_WAIT / 1000) {
            // Check userStopped trước mỗi lần lặp
            if (userStopped) {
              debugLog('⏹️ User đã dừng, thoát khỏi vòng chờ');
              return;
            }
            
            const progressRunning = isProgressRunning();
            
            // Phát hiện progress biến mất
            if (progressWasRunning && !progressRunning && !progressDisappeared) {
              // Check userStopped trước khi reload
              if (userStopped) {
                debugLog('⏹️ User đã dừng, không reload');
                return;
              }
              
              debugLog('⚠️ Progress % đã biến mất, kiểm tra số lượng video ngay...');
              await sleep(500);
              newAssetCount = getAssetCount();
              
              if (newAssetCount <= prevAssetCount) {
                debugLog(`⚠️ Video render thất bại: số video không đổi (${prevAssetCount} → ${newAssetCount})`);
                debugLog('🔄 Đang reload trang để retry queue này...');
                await saveQueueState();
                await sleep(500);
                location.reload();
                return;
              } else {
                debugLog(`✅ Video render thành công sau khi progress biến mất (${prevAssetCount} → ${newAssetCount})`);
                break;
              }
              progressDisappeared = true;
            }
            
            // Check: Nếu không có progress và số video không tăng sau 10s → reload ngay
            if (!progressRunning) {
              if (noProgressStartTime === null) {
                noProgressStartTime = Date.now();
              } else {
                const noProgressDuration = Date.now() - noProgressStartTime;
                if (noProgressDuration > 10000 && newAssetCount <= prevAssetCount) {
                  // Check userStopped trước khi reload
                  if (userStopped) {
                    debugLog('⏹️ User đã dừng, không reload');
                    return;
                  }
                  
                  debugLog(`⚠️ Không có progress trong ${Math.floor(noProgressDuration/1000)}s và số video không tăng (${prevAssetCount} → ${newAssetCount})`);
                  debugLog('🔄 Đang reload trang để retry queue này...');
                  await saveQueueState();
                  await sleep(500);
                  location.reload();
                  return;
                }
              }
            } else {
              noProgressStartTime = null;
            }
            
            progressWasRunning = progressRunning;
            
            await sleep(DELAYS.LONG);
            newAssetCount = getAssetCount();
            waitTries++;
            
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            if (waitTries % 20 === 0) {
              debugLog(`  Đã chờ ${elapsedSeconds}s... (${prevAssetCount} → ${newAssetCount})`);
            }
          }
          
          if (newAssetCount > prevAssetCount) {
            debugLog(`✅ Đã xong prompt ${promptIndex + 1}/${prompts.length} trong Queue #${currentQueueIndex + 1}, video đã được tạo (${prevAssetCount} → ${newAssetCount})`);
            success = true;
            // Tăng tổng số prompt đã xử lý
            totalPromptsProcessed++;
            
            // Cập nhật progress ngay lập tức sau mỗi prompt
            sendQueueProgressUpdate();
            
            // Kiểm tra xem có phải prompt cuối cùng trong queue này không
            const isLastPromptInQueue = promptIndex === prompts.length - 1;
            
            if (isLastPromptInQueue) {
              // Đã hoàn thành tất cả prompts trong queue này
              // Tăng currentQueueIndex và reset currentPromptIndexInQueue TRƯỚC KHI lưu state
              currentQueueIndex++;
              currentPromptIndexInQueue = 0;
              
              debugLog(`✅ Đã hoàn thành Queue #${currentQueueIndex}/${queueList.length} với ${prompts.length} prompt(s)`);
              
              // Kiểm tra xem còn queue tiếp theo không
              if (currentQueueIndex >= queueList.length) {
                // Đã hoàn thành tất cả queue
                debugLog('✅ Đã hoàn thành tất cả queue!');
                isRunning = false;
                await clearQueueState();
                chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Idle' });
                return;
              }
            } else {
              // Chưa phải prompt cuối cùng, cập nhật currentPromptIndexInQueue để tiếp tục từ prompt tiếp theo
              currentPromptIndexInQueue = promptIndex + 1;
            }
            
            // Reload trang sau mỗi 4 prompt thành công (nếu còn prompt tiếp theo hoặc queue tiếp theo)
            // Reload khi totalPromptsProcessed là 4, 8, 12... (bội số của 4)
            const hasMorePrompts = !isLastPromptInQueue || currentQueueIndex < queueList.length;
            if (hasMorePrompts && totalPromptsProcessed % 4 === 0) {
              debugLog(`🔄 Đã hoàn thành ${totalPromptsProcessed} prompt, đang lưu state và reload trang...`);
              // Đảm bảo isRunning = true trước khi lưu state để tiếp tục sau reload
              isRunning = true;
              userStopped = false;
              await saveQueueState();
              await sleep(500); // Đợi một chút để đảm bảo state được lưu
              location.reload();
              return; // Dừng flow, sẽ tiếp tục sau khi reload
            }
            
            break; // Thoát khỏi retry loop
          } else {
            // Video render lỗi (timeout), reload trang ngay lập tức để retry
            debugLog(`⚠️ Video chưa được tạo sau ${TIMEOUTS.ASSET_WAIT/60000} phút, video render có thể bị lỗi`);
            debugLog('🔄 Đang reload trang để retry queue này...');
            await saveQueueState();
            await sleep(500);
            location.reload();
            return;
          }
        } catch (e) {
          // Check userStopped trước
          if (userStopped) {
            debugLog('⏹️ User đã dừng, không retry');
            return;
          }
          
          const errorMsg = e instanceof Error ? e.message : String(e);
          
          // Kiểm tra nếu là lỗi user dừng
          if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
            debugLog('⏹️ User đã dừng, không retry');
            return;
          }
          
          // Kiểm tra nếu là lỗi trang chết, reload ngay lập tức
          if (e instanceof Error && e.isPageDead) {
            debugLog('⚠️ Phát hiện trang bị chết, đang reload trang ngay lập tức...');
            await saveQueueState();
            await sleep(500);
            location.reload();
            return;
          }
          
          debugLog(`❌ Lỗi khi chạy Queue #${currentQueueIndex + 1} (retry ${retryCount + 1}/${RETRY_LIMITS.PROMPT}): ${errorMsg}`);
          retryCount++;
          
          if (retryCount < RETRY_LIMITS.PROMPT) {
            debugLog(`🔄 Retry lần ${retryCount}/${RETRY_LIMITS.PROMPT} sau lỗi...`);
            await sleep(DELAYS.STABILIZE);
          }
        }
      }
      
      if (!success && !userStopped) {
        debugLog(`❌ Không thể tạo video cho prompt ${promptIndex + 1}/${prompts.length} trong Queue #${currentQueueIndex + 1} sau ${retryCount} lần thử.`);
        debugLog('⏸️ Dừng queue tạm thời.');
        isRunning = false;
        scheduleAutoRestart('retry queue hết');
        return;
      }
      
      // Chờ một chút trước khi xử lý prompt tiếp theo (nếu có)
      if (promptIndex < prompts.length - 1) {
        await sleep(1000);
      }
    } catch (e) {
      // Check userStopped trước
      if (userStopped) {
        debugLog('⏹️ User đã dừng, không schedule auto-restart');
        isRunning = false;
        return;
      }
      
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      // Kiểm tra nếu là lỗi user dừng
      if (errorMsg === 'User đã dừng' || errorMsg.includes('User đã dừng')) {
        debugLog('⏹️ User đã dừng, không schedule auto-restart');
        isRunning = false;
        return;
      }
      
      debugLog(`❌ Lỗi không mong đợi khi xử lý prompt ${promptIndex + 1}/${prompts.length} trong Queue #${currentQueueIndex + 1}: ${errorMsg}`);
      isRunning = false;
      scheduleAutoRestart('exception');
      return;
    }
    } // End for loop prompts
    
    // Lưu ý: Nếu đã hoàn thành tất cả prompts trong queue, currentQueueIndex và currentPromptIndexInQueue 
    // đã được cập nhật trong vòng lặp (khi xử lý prompt cuối cùng)
    // Chỉ cần log và update progress nếu chưa được xử lý
    if (currentPromptIndexInQueue === 0 && currentQueueIndex > 0) {
      // Đã chuyển sang queue tiếp theo trong vòng lặp
      debugLog(`✅ Đã hoàn thành Queue #${currentQueueIndex}/${queueList.length}`);
    }
    sendQueueProgressUpdate();
    
    // Reload trang sau mỗi 4 queue thành công (nếu còn queue tiếp theo)
    if (currentQueueIndex < queueList.length && currentQueueIndex % 4 === 0) {
      debugLog(`🔄 Đã hoàn thành ${currentQueueIndex} queue, đang lưu state và reload trang...`);
      await saveQueueState();
      await sleep(500);
      location.reload();
      return;
    }
  }
  
  debugLog('🎉 Kết thúc queue.');
  isRunning = false;
  isQueueMode = false;
  await clearQueueState();
  chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Idle' });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Chờ element xuất hiện trong DOM (kể cả thay đổi attributes hiển thị)
 */
function waitForElement(selector, timeout = TIMEOUTS.ELEMENT_WAIT, { visible = false } = {}) {
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
 * @returns {Promise<void>}
 * @throws {Error} Nếu không tìm thấy slider hoặc nút save frame
 */
async function saveFrameAsAsset() {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  debugLog('📍 saveFrameAsAsset: Bắt đầu...');
  
  try {
    // Scroll asset list đến cuối trước khi thao tác slider
    await scrollAssetListToEnd();

    // Inject script nếu chưa có
    // Sử dụng tên biến khó đoán để tránh bị override
    const INJECTION_MARKER = '__veo3_flow_injected_' + chrome.runtime.id.replace(/-/g, '_');
    const FUNCTION_NAME = '__veo3_seekToEnd_' + chrome.runtime.id.replace(/-/g, '_');
    
    if (!window[INJECTION_MARKER]) {
      debugLog('🔧 Đang inject script vào main world...');
      
      // Tạo script tag và load từ extension
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = function() {
        this.remove();
        debugLog('✓ injected.js đã load và remove');
      };
      (document.head || document.documentElement).appendChild(script);
      
      // Đánh dấu đã inject với tên khó đoán
      window[INJECTION_MARKER] = true;
      debugLog('✓ Đã inject script main world.');
      
      // Chờ script được execute
      await sleep(DELAYS.SHORT * 2);
      
      // Kiểm tra tính toàn vẹn của function
      if (typeof window.seekToEndOfVideo !== 'function') {
        throw 'Function seekToEndOfVideo không tồn tại sau khi inject';
      }
    }

    // Gửi message yêu cầu kéo slider
    debugLog('🎯 Gửi yêu cầu kéo slider đến cuối...');
    const result = await new Promise((resolve, reject) => {
      let resolved = false;
      const currentOrigin = window.location.origin;
      function handler(e) {
        // Validate origin để tránh XSS
        if (e.origin !== currentOrigin) {
          return; // Bỏ qua message từ origin khác
        }
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
      window.postMessage({ type: 'SEEK_TO_END_VIDEO_REQUEST' }, currentOrigin);
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('message', handler);
        debugLog(`⏱️ Timeout - không nhận được response sau ${TIMEOUTS.SLIDER_DRAG/1000}s`);
        reject(`Timeout kéo slider (${TIMEOUTS.SLIDER_DRAG/1000}s)`);
      }, TIMEOUTS.SLIDER_DRAG);
    });
    if (!result.ok) {
      const errorMsg = result.error || 'unknown';
      // Nếu error là null hoặc 'unknown', có thể trang bị chết, cần reload
      if (!result.error || result.error === 'unknown' || result.error === null) {
        debugLog('⚠️ Phát hiện trang có thể bị chết (ok=false, error=null/unknown), sẽ reload trang...');
        // Throw error đặc biệt để code trên có thể catch và reload
        const reloadError = new Error('PAGE_DEAD_NEED_RELOAD');
        reloadError.isPageDead = true;
        throw reloadError;
      }
      throw 'Không kéo được slider đến cuối: ' + errorMsg;
    }
    debugLog('✓ Đã kéo slider đến cuối');
    await sleep(DELAYS.LONG);

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
    await sleep(DELAYS.LONG);
    // Tìm menu item "Save frame as asset" bằng icon add_photo_alternate
    debugLog('🔍 Tìm menu item Save frame...');
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    debugLog(`Tìm thấy ${menuItems.length} menu items`);
    
    // Tìm icon add_photo_alternate trong menu items
    let saveMenuItem = null;
    const allIcons = Array.from(document.querySelectorAll('i.material-icons-outlined, i.material-icons'));
    const addPhotoIcon = allIcons.find(i => i.textContent.trim() === 'add_photo_alternate');
    
    if (addPhotoIcon) {
      // Tìm menu item chứa icon này
      saveMenuItem = addPhotoIcon.closest('[role="menuitem"]');
      if (saveMenuItem) {
        debugLog('✓ Tìm thấy menu item Save frame bằng icon add_photo_alternate');
      }
    }
    
    // Fallback: thử tìm bằng aria-label nếu không tìm được bằng icon
    if (!saveMenuItem) {
      saveMenuItem = findButtonByAttributes(Array.from(menuItems), ['save', 'frame'], null);
    }
    
    // Fallback: dùng text matching đa ngôn ngữ
    if (!saveMenuItem) {
      saveMenuItem = findButtonByText(Array.from(menuItems), 'SAVE_FRAME', { requireAll: true });
    }
    
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
    await sleep(DELAYS.LONG);
  } catch (e) {
    debugLog('❌ saveFrameAsAsset: Lỗi ' + e);
    throw e;
  }
}


/**
 * STEP 3: Mở asset picker (có thể bỏ qua nếu tự hiện)
 * @returns {Promise<void>}
 */
async function openImagePicker() {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  debugLog('🖼️ openImagePicker: Chờ asset picker hiện...');
  // Asset picker thường tự hiện sau khi save frame
  await sleep(DELAYS.LONG);
}

/**
 * Validate base64 image data
 * @param {string} imageBase64 - Base64 data URL
 * @returns {boolean} true nếu hợp lệ
 */
function validateBase64Image(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return false;
  }
  
  // Kiểm tra format data URL
  if (!imageBase64.startsWith('data:image/')) {
    return false;
  }
  
  // Kiểm tra có base64 data không
  const parts = imageBase64.split(',');
  if (parts.length !== 2 || !parts[1]) {
    return false;
  }
  
  // Kiểm tra mime type hợp lệ
  const mimeMatch = imageBase64.match(/data:image\/([^;]+);/);
  if (!mimeMatch) {
    return false;
  }
  
  const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  const imageType = mimeMatch[1].toLowerCase();
  if (!validTypes.includes(imageType)) {
    return false;
  }
  
  // Kiểm tra kích thước base64 (ước tính max 15MB khi decode)
  const base64Data = parts[1];
  const estimatedSize = (base64Data.length * 3) / 4; // Base64 encoding overhead
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (estimatedSize > MAX_SIZE) {
    return false;
  }
  
  return true;
}

/**
 * Upload ảnh từ base64 string
 * @param {string} imageBase64 - Base64 data URL của ảnh
 * @returns {Promise<void>}
 * @throws {Error} Nếu không tìm thấy textarea hoặc nút upload, hoặc base64 không hợp lệ
 */
async function uploadImageFromFile(imageBase64) {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  // Validate base64 trước khi sử dụng
  if (!validateBase64Image(imageBase64)) {
    throw 'Base64 image không hợp lệ (format sai, quá lớn, hoặc không phải ảnh)';
  }
  
  debugLog('📤 Đang upload ảnh...');
  
  try {
    // Tìm nút + đầu tiên ở dưới prompt (button với icon "add" hoặc "image")
    // Tìm trong khu vực prompt textarea
    const textarea = getTextarea();
    if (!textarea) {
      throw 'Không tìm thấy prompt textarea';
    }
    
    // Tìm button gần textarea (có thể là button với icon "add" hoặc "image")
    const promptArea = getPromptArea();
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
      await sleep(DELAYS.NORMAL);
    } else {
      // Nếu không tìm thấy, click nút + để mở menu
      debugLog('⚠️ Không tìm thấy input file trực tiếp, click nút + để mở menu...');
      addButton.click();
      await sleep(DELAYS.LONG);
      
      // Tìm input file sau khi menu mở
      fileInput = document.querySelector('input[type="file"]');
      
      if (!fileInput) {
        // Tìm button "Upload" trong menu - ưu tiên aria-label, sau đó text matching đa ngôn ngữ
        const allMenuButtons = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
        
        // Thử tìm bằng aria-label trước
        let uploadButton = findButtonByAttributes(allMenuButtons, ['upload', 'browse'], null);
        
        // Nếu không tìm thấy, dùng text matching đa ngôn ngữ
        if (!uploadButton) {
          uploadButton = findButtonByText(allMenuButtons, 'UPLOAD');
        }
        
        if (uploadButton) {
          debugLog('✓ Tìm thấy button upload, đang click...');
          uploadButton.click();
          await sleep(DELAYS.NORMAL);
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
    await sleep(DELAYS.LONG);
    
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
    const maxTries = RETRY_LIMITS.CROP_SAVE_BUTTON;
    
    while (!cropAndSaveButton && tries < maxTries) {
      // Tìm dialog/modal crop (có thể là role="dialog" hoặc element chứa title "Cắt thành phần")
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
      let cropDialog = null;
      
      // Tìm dialog có chứa text "Cắt thành phần" hoặc "Crop"
      for (const dialog of dialogs) {
        const dialogText = dialog.textContent || '';
        // Kiểm tra có phải dialog crop không (có thể có text về crop hoặc có button nhiều)
        const allDialogButtons = Array.from(dialog.querySelectorAll('button'));
        if (allDialogButtons.length >= 4) { // Dialog crop thường có ít nhất 4 nút: Hủy, Đặt lại, Ngang, Cắt và lưu
          cropDialog = dialog;
          break;
        }
      }
      
      // Nếu không tìm thấy bằng cách trên, thử tìm dialog visible đầu tiên
      if (!cropDialog && dialogs.length > 0) {
        for (const dialog of dialogs) {
          const style = window.getComputedStyle(dialog);
          if (style.display !== 'none' && dialog.offsetParent !== null) {
            const allDialogButtons = Array.from(dialog.querySelectorAll('button'));
            if (allDialogButtons.length >= 3) { // Có ít nhất 3 button
              cropDialog = dialog;
              break;
            }
          }
        }
      }
      
      if (cropDialog) {
        // Tìm tất cả button trong dialog crop
        const allDialogButtons = Array.from(cropDialog.querySelectorAll('button')).filter(btn => {
          const style = window.getComputedStyle(btn);
          return style.display !== 'none' && btn.offsetParent !== null;
        });
        
        if (allDialogButtons.length >= 4) {
          // Nút "Crop and Save" (Cắt và lưu) là nút cuối cùng trong danh sách
          // Theo ảnh: Hủy, Đặt lại, Ngang, Cắt và lưu (nút cuối)
          cropAndSaveButton = allDialogButtons[allDialogButtons.length - 1];
          debugLog(`✓ Tìm thấy ${allDialogButtons.length} nút trong dialog crop, chọn nút cuối cùng`);
        }
      }
      
      // Fallback: thử tìm bằng text/attribute nếu không tìm được bằng vị trí
      if (!cropAndSaveButton) {
        const allButtons = Array.from(document.querySelectorAll('button'));
        // Thử tìm bằng aria-label trước (không phụ thuộc ngôn ngữ)
        cropAndSaveButton = findButtonByAttributes(allButtons, ['crop', 'save'], null);
        
        // Nếu không tìm thấy, dùng text matching đa ngôn ngữ
        if (!cropAndSaveButton) {
          cropAndSaveButton = findButtonByText(allButtons, 'CROP_AND_SAVE', { requireAll: true });
        }
      }
      
      if (cropAndSaveButton) {
        break;
      }
      
      await sleep(DELAYS.SHORT * 2);
      tries++;
    }
    
    if (!cropAndSaveButton) {
      throw 'Không tìm thấy nút "Crop and Save"';
    }
    
    debugLog('✓ Tìm thấy nút "Crop and Save", đang click...');
    cropAndSaveButton.click();
    await sleep(DELAYS.LONG);
    
    // Chờ dialog "Notice" xuất hiện và click "I agree"
    debugLog('⏳ Đang chờ dialog Notice xuất hiện...');
    let agreeButton = null;
    tries = 0;
    const maxNoticeTries = RETRY_LIMITS.NOTICE_DIALOG;
    
    while (!agreeButton && tries < maxNoticeTries) {
      // Tìm dialog "Notice" và nút "I agree"
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      for (const dialog of dialogs) {
        const dialogText = dialog.textContent || '';
        // Check xem có phải dialog Notice không - dùng text matching đa ngôn ngữ
        const isNoticeDialog = matchesText(dialogText, 'NOTICE');
        
        if (isNoticeDialog) {
          // Tìm nút "I agree" - ưu tiên aria-label, sau đó text matching
          const buttons = Array.from(dialog.querySelectorAll('button'));
          
          // Thử tìm bằng aria-label trước
          agreeButton = findButtonByAttributes(buttons, ['agree', 'accept'], null);
          
          // Nếu không tìm thấy, dùng text matching đa ngôn ngữ
          if (!agreeButton) {
            agreeButton = findButtonByText(buttons, 'I_AGREE');
          }
          
          if (agreeButton) {
            break;
          }
        }
      }
      
      if (agreeButton) {
        break;
      }
      
      await sleep(DELAYS.NORMAL);
      tries++;
    }
    
    if (agreeButton) {
      // Có dialog Notice
      debugLog('✓ Tìm thấy nút "I agree", đang click...');
      agreeButton.click();
      await sleep(DELAYS.LONG);
      debugLog('✅ Đã click "I agree"');
      
      // Chờ thumbnail ảnh xuất hiện (thay thế nút dấu "+")
      await waitForThumbnailAfterCrop(TIMEOUTS.THUMBNAIL_CHECK);
      
      debugLog('✅ Đã hoàn thành crop và chờ thumbnail ảnh');
      return true; // Có dialog
    } else {
      // Không có dialog Notice - chờ menu frame tắt
      debugLog('⚠️ Không tìm thấy dialog Notice, chờ menu frame tắt...');
      
      // Chờ menu frame (popup preview) tắt
      let menuFrameVisible = true;
      tries = 0;
      const maxMenuTries = RETRY_LIMITS.MENU_FRAME;
      
      while (menuFrameVisible && tries < maxMenuTries) {
        // Check xem popup preview/dialog còn visible không
        const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
        const hasVisibleDialog = Array.from(dialogs).some(dialog => {
          const style = window.getComputedStyle(dialog);
          return style.display !== 'none' && dialog.offsetParent !== null;
        });
        
        // Check xem có button "Crop and Save" còn visible không
        const allVisibleButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.offsetParent !== null
        );
        const cropButtons = allVisibleButtons.filter(btn => {
          // Dùng text matching đa ngôn ngữ
          return findButtonByText([btn], 'CROP_AND_SAVE', { requireAll: true }) !== null;
        });
        
        menuFrameVisible = hasVisibleDialog || cropButtons.length > 0;
        
        if (!menuFrameVisible) {
          break;
        }
        
        await sleep(DELAYS.NORMAL);
        tries++;
      }
      
      if (!menuFrameVisible) {
        debugLog('✅ Menu frame đã tắt');
        //Chờ thumbnail ảnh xuất hiện (thay thế nút dấu "+")
        await waitForThumbnailAfterCrop(TIMEOUTS.UPLOAD_ICON);
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
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  debugLog('🔄 Đang check mode Frame to Video...');
  
  try {
    // Tìm button mode selector (combobox) - chỉ có 1 combobox trên màn hình
    const allModeButtons = Array.from(document.querySelectorAll('button[role="combobox"]'));
    
    if (allModeButtons.length === 0) {
      debugLog('⚠️ Không tìm thấy button chọn mode');
      return; // Có thể đã ở đúng mode hoặc UI khác
    }
    
    // Lấy button đầu tiên (vì chỉ có 1 combobox)
    const modeButton = allModeButtons[0];
    
    // Kiểm tra innerText/textContent có chứa "arrow_drop_down" để đảm bảo đúng element
    const buttonText = modeButton.innerText || modeButton.textContent || '';
    if (!buttonText.toLowerCase().includes('arrow_drop_down')) {
      debugLog('⚠️ Button không phải combobox (không có arrow_drop_down)');
      return;
    }
    
    // Lưu text hiện tại của combobox để so sánh
    const currentModeText = modeButton.innerText || modeButton.textContent || '';
    
    // Click để mở dropdown
    debugLog('🔄 Đang click để mở dropdown mode...');
    modeButton.click();
    await sleep(DELAYS.NORMAL);
    
    // Tìm menu items
    const menuItems = document.querySelectorAll('[role="menuitem"], [role="option"]');
    const menuItemsArray = Array.from(menuItems);
    
    if (menuItemsArray.length === 0) {
      debugLog('⚠️ Không tìm thấy menu items sau khi mở dropdown');
      return;
    }
    
    // Lấy item thứ 2 (index 1)
    if (menuItemsArray.length < 2) {
      debugLog('⚠️ Không có đủ menu items (cần ít nhất 2 items)');
      return;
    }
    
    const frameToVideoItem = menuItemsArray[1]; // Item thứ 2 (index 1)
    const frameToVideoText = frameToVideoItem.innerText || frameToVideoItem.textContent || '';
    
    // So sánh text của item thứ 2 với text hiện tại của combobox để kiểm tra đã ở đúng mode chưa
    // Loại bỏ ký tự xuống dòng và "arrow_drop_down" để so sánh
    const normalizedCurrentText = currentModeText.replace(/\n/g, ' ').replace(/arrow_drop_down/gi, '').trim();
    const normalizedFrameToVideoText = frameToVideoText.trim();
    
    if (normalizedCurrentText === normalizedFrameToVideoText) {
      debugLog('✅ Đã ở mode Frame to Video');
      // Đóng dropdown bằng cách click ra ngoài hoặc ESC
      document.body.click();
      await sleep(DELAYS.SHORT);
      return;
    }
    
    // Chưa đúng mode, click vào item thứ 2
    debugLog('✓ Đang click vào menu item thứ 2 (Frame to Video)...');
    frameToVideoItem.click();
    await sleep(DELAYS.LONG);
    debugLog('✅ Đã chọn mode Frame to Video');
    
  } catch (e) {
    debugLog('⚠️ ensureFrameToVideoMode lỗi: ' + e);
    // Không throw, tiếp tục flow
  }
}

/**
 * Kiểm tra nút dấu "+" bên trái (gần textarea) còn hiện không (tức là thumbnail chưa xuất hiện)
 * Phân biệt với nút "+" bên phải (nút khác, không liên quan)
 * @returns {boolean}
 */
function isPlusButtonStillVisible() {
  try {
    const textarea = getTextarea();
    if (!textarea) return false;
    
    const promptArea = getPromptArea();
    if (!promptArea) return false;
    
    // Lấy vị trí của textarea để so sánh
    const textareaRect = textarea.getBoundingClientRect();
    const textareaLeft = textareaRect.left;
    const textareaTop = textareaRect.top;
    
    // Tìm tất cả button có icon "add" và visible
    const allAddButtons = Array.from(promptArea.querySelectorAll('button')).filter(btn => {
      // Check button phải visible
      if (btn.offsetParent === null) return false;
      
      const icon = btn.querySelector('i.google-symbols');
      if (icon) {
        const iconText = icon.textContent.trim().toLowerCase();
        return iconText === 'add' || iconText === 'image' || iconText === 'image_add';
      }
      return false;
    });
    
    if (allAddButtons.length === 0) return false;
    
    // Tìm nút "+" ở bên trái textarea (gần textarea nhất về phía trái)
    // Nút "+" bên trái sẽ có vị trí left < textarea.left và gần textarea nhất
    let leftMostButton = null;
    let minDistance = Infinity;
    
    for (const btn of allAddButtons) {
      const btnRect = btn.getBoundingClientRect();
      const btnLeft = btnRect.left;
      const btnRight = btnRect.right;
      const btnTop = btnRect.top;
      
      // Nút "+" bên trái sẽ ở bên trái textarea (btnRight < textareaLeft hoặc gần textareaLeft)
      // Và ở cùng hàng hoặc gần hàng với textarea
      const horizontalDistance = Math.abs(btnLeft - textareaLeft);
      const verticalDistance = Math.abs(btnTop - textareaTop);
      const totalDistance = horizontalDistance + verticalDistance * 0.5; // Ưu tiên khoảng cách ngang
      
      // Nút bên trái: btnRight <= textareaLeft + 50 (cho phép một chút lệch)
      if (btnRight <= textareaLeft + 50 && totalDistance < minDistance) {
        minDistance = totalDistance;
        leftMostButton = btn;
      }
    }
    
    // Nếu không tìm thấy nút bên trái, có thể nút "+" đã chuyển thành thumbnail
    // Hoặc nếu chỉ có 1 nút và nó ở gần textarea (có thể là nút bên trái)
    if (!leftMostButton && allAddButtons.length === 1) {
      const btn = allAddButtons[0];
      const btnRect = btn.getBoundingClientRect();
      // Nếu nút này ở gần textarea (trong vòng 100px) thì coi như là nút bên trái
      const distance = Math.abs(btnRect.left - textareaLeft) + Math.abs(btnRect.top - textareaTop);
      if (distance < 100) {
        leftMostButton = btn;
      }
    }
    
    return leftMostButton !== null;
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
        // Tìm nút đóng (X) hoặc Cancel - ưu tiên aria-label và icon, sau đó text matching
        const dialogButtons = Array.from(dialog.querySelectorAll('button'));
        
        // Thử tìm bằng aria-label trước
        let closeButton = findButtonByAttributes(dialogButtons, ['close', 'cancel'], null);
        
        // Thử tìm bằng icon (không phụ thuộc ngôn ngữ)
        if (!closeButton) {
          closeButton = dialogButtons.find(btn => {
            const icon = btn.querySelector('i.google-symbols');
            if (icon) {
              const iconText = icon.textContent.trim().toLowerCase();
              return iconText === 'close' || iconText === 'cancel';
            }
            return false;
          });
        }
        
        // Nếu không tìm thấy, dùng text matching đa ngôn ngữ
        if (!closeButton) {
          closeButton = findButtonByText(dialogButtons, 'CLOSE') || 
                       findButtonByText(dialogButtons, 'CANCEL');
        }
        
        if (closeButton) {
          debugLog('✓ Tìm thấy nút đóng, đang click...');
          closeButton.click();
          await sleep(DELAYS.LONG);
          return;
        }
        
        // Fallback: Nhấn ESC
        debugLog('⚠️ Không tìm thấy nút đóng, thử nhấn ESC...');
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
        dialog.dispatchEvent(escEvent);
        await sleep(DELAYS.LONG);
      }
    }
    
    debugLog('⚠️ Không tìm thấy dialog để đóng');
  } catch (e) {
    debugLog('⚠️ Lỗi khi tắt menu frame: ' + e);
  }
}

/**
 * Kiểm tra thumbnail ảnh đã xuất hiện thay thế nút dấu "+" bên trái chưa
 * Thumbnail là element có hình ảnh (background-image hoặc img) nằm ở vị trí bên trái textarea
 * Phân biệt với các hình ảnh khác (như nút "+" bên phải)
 */
function isImageThumbnailVisible() {
  try {
    const textarea = getTextarea();
    if (!textarea) return false;
    
    const promptArea = getPromptArea();
    if (!promptArea) return false;
    
    // Lấy vị trí của textarea để so sánh
    const textareaRect = textarea.getBoundingClientRect();
    const textareaLeft = textareaRect.left;
    const textareaTop = textareaRect.top;
    
    // Tìm trong khu vực gần textarea prompt
    const parentContainer = promptArea.parentElement || promptArea;
    
    // Check 1: img elements - chỉ lấy thumbnail ở bên trái textarea
    const images = parentContainer.querySelectorAll('img');
    for (const img of images) {
      if (img.offsetParent === null) continue;
      if (!img.src || img.src === '' || img.src.includes('data:image/svg')) continue;
      
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 200) {
        // Kiểm tra xem img có ở bên trái textarea không (vị trí thumbnail)
        const imgRight = rect.right;
        const imgTop = rect.top;
        // Thumbnail sẽ ở bên trái textarea (imgRight <= textareaLeft + 50) và cùng hàng/gần hàng
        const horizontalDistance = Math.abs(imgRight - textareaLeft);
        const verticalDistance = Math.abs(imgTop - textareaTop);
        
        if (imgRight <= textareaLeft + 50 && verticalDistance < 100) {
        return true;
        }
      }
    }
    
    // Check 2: div có background-image - chỉ lấy thumbnail ở bên trái textarea
    const divs = parentContainer.querySelectorAll('div');
    for (const div of Array.from(divs).slice(0, 100)) { // Tăng số lượng check để tìm chính xác hơn
      if (div.offsetParent === null) continue;
      
      const style = window.getComputedStyle(div);
      if (style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url(')) {
        const rect = div.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 200) {
          // Kiểm tra xem div có ở bên trái textarea không (vị trí thumbnail)
          const divRight = rect.right;
          const divTop = rect.top;
          // Thumbnail sẽ ở bên trái textarea (divRight <= textareaLeft + 50) và cùng hàng/gần hàng
          const horizontalDistance = Math.abs(divRight - textareaLeft);
          const verticalDistance = Math.abs(divTop - textareaTop);
          
          if (divRight <= textareaLeft + 50 && verticalDistance < 100) {
          return true;
          }
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
 * @returns {Promise<void>}
 * @throws {Error} Nếu không tìm thấy asset list hoặc asset mới nhất
 */
async function selectLatestAsset() {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  debugLog('🎨 selectLatestAsset: Chọn asset mới nhất...');
  
  try {
    // Chờ asset list hiện
    const assetList = await waitForElement('.virtuoso-grid-list', TIMEOUTS.ELEMENT_WAIT - 2000);

    // Chờ icon upload xuất hiện (i.google-symbols có textContent 'upload')
    let tries = 0;
    const maxTries = RETRY_LIMITS.UPLOAD_ICON;
    
    while (!isUploadIconVisible() && tries < maxTries) {
      await sleep(DELAYS.NORMAL);
      tries++;
    }
    if (!isUploadIconVisible()) {
      debugLog('⚠️ Không thấy icon upload sau khi chờ. Vẫn tiếp tục.');
    } else {
      debugLog('✓ Đã thấy icon upload, asset list đã sẵn sàng.');
    }
    // Chờ 2s để đảm bảo asset mới đã render hoàn toàn
    debugLog('⏳ Đã tìm thấy asset mới nhất, chờ 2s để ổn định...');
    await sleep(DELAYS.STABILIZE);
    // Chọn asset đầu tiên sau nút upload (data-index="1")
    const assetBtn = document.querySelector('[data-index="1"] button');
    if (!assetBtn) throw 'Không tìm thấy asset mới nhất';

    assetBtn.click();
    debugLog('✓ Đã chọn asset mới nhất.');

    await sleep(DELAYS.NORMAL);

  } catch (e) {
    debugLog('❌ selectLatestAsset: Lỗi ' + e);
    throw e;
  }
}

/**
 * STEP 5: Nhập prompt vào textarea
 * @param {string} prompt - Prompt text để nhập
 * @returns {Promise<void>}
 * @throws {Error} Nếu không tìm thấy textarea hoặc prompt không hợp lệ
 */
async function inputPrompt(prompt) {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
  // Validate prompt trước khi sử dụng
  if (!validatePrompt(prompt)) {
    throw 'Prompt không hợp lệ (quá dài hoặc chứa ký tự không cho phép)';
  }
  
  debugLog('⌨️ inputPrompt: Nhập prompt...');
  
  try {
    const textarea = await waitForElement('#PINHOLE_TEXT_AREA_ELEMENT_ID', TIMEOUTS.ELEMENT_WAIT - 4000);
    // Update cache
    cachedTextarea = textarea;
    cachedPromptArea = textarea ? (textarea.closest('div') || textarea.parentElement) : null;
    
    // Focus và clear
    textarea.focus();
    textarea.value = '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    await sleep(DELAYS.SHORT);
    
    // Nhập prompt mới (textarea.value tự động escape HTML)
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    debugLog('✓ Đã nhập prompt.');
    await sleep(DELAYS.MEDIUM);
    
  } catch (e) {
    debugLog('❌ inputPrompt: Lỗi ' + e);
    throw e;
  }
}

/**
 * STEP 6: Click nút Generate
 * @returns {Promise<void>}
 * @throws {Error} Nếu không tìm thấy nút generate
 */
async function clickGenerate() {
  // Kiểm tra tab Scenebuilder
  if (!isScenebuilderTab()) {
    updateScenebuilderMask(true);
    throw 'Không phải tab Scenebuilder';
  }
  
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
    await sleep(800); // Slightly less than DELAYS.LONG
    
  } catch (e) {
    debugLog('❌ clickGenerate: Lỗi ' + e);
    throw e;
  }
}

// ============================================
// AUTO RESTORE STATE AFTER RELOAD
// ============================================

/**
 * Tự động restore state và tiếp tục flow sau khi reload
 */
async function autoRestoreAndContinue() {
  try {
    // Đợi DOM load xong
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      });
    }
    
    // Đợi extension sẵn sàng (check chrome.runtime)
    let extensionReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        if (chrome && chrome.runtime && chrome.runtime.id) {
          extensionReady = true;
          break;
        }
      } catch (_) {}
      await sleep(500);
    }
    
    if (!extensionReady) {
      console.log('⚠️ Extension chưa sẵn sàng, bỏ qua auto-restore');
      return;
    }
    
    // Đợi trang load xong (check các element UI chính)
    try {
      debugLog('⏳ Đang đợi trang load xong sau reload...');
    } catch (e) {
      console.log('⏳ Đang đợi trang load xong sau reload...');
    }
    
    let pageReady = false;
    const maxPageTries = 60; // Tối đa 30s (60 * 500ms)
    let pageTries = 0;
    
    while (!pageReady && pageTries < maxPageTries) {
      // Check các element UI chính để xác định trang đã load xong
      const textarea = getTextarea();
      const hasGenerateButton = Array.from(document.querySelectorAll('button i.google-symbols'))
        .some(i => i.textContent.trim() === 'arrow_forward');
      
      // Nếu có textarea và nút generate → trang đã load xong
      if (textarea && hasGenerateButton) {
        // Kiểm tra thêm: nếu có assets thì check assets, nếu chưa có thì chỉ cần UI chính
        const assetCount = getAssetCount();
        if (assetCount > 0) {
          // Có assets, đợi thêm một chút để đảm bảo tất cả đã render
          await sleep(DELAYS.LONG);
          const assetCount2 = getAssetCount();
          if (assetCount2 > 0) {
            pageReady = true;
            try {
              debugLog(`✅ Trang đã load xong: có ${assetCount2} assets`);
            } catch (e) {
              console.log(`✅ Trang đã load xong: có ${assetCount2} assets`);
            }
            // Đợi thêm 5s để chắc chắn
            try {
              debugLog('⏳ Đợi thêm 5s để chắc chắn...');
            } catch (e) {
              console.log('⏳ Đợi thêm 5s để chắc chắn...');
            }
            await sleep(5000);
            break;
          }
        } else {
          // Chưa có assets nhưng UI đã sẵn sàng → trang đã load xong
          pageReady = true;
          try {
            debugLog('✅ Trang đã load xong: UI sẵn sàng (chưa có video)');
          } catch (e) {
            console.log('✅ Trang đã load xong: UI sẵn sàng (chưa có video)');
          }
          // Đợi thêm 5s để chắc chắn
          try {
            debugLog('⏳ Đợi thêm 5s để chắc chắn...');
          } catch (e) {
            console.log('⏳ Đợi thêm 5s để chắc chắn...');
          }
          await sleep(5000);
          break;
        }
      }
      
      await sleep(500);
      pageTries++;
      
      if (pageTries % 10 === 0) {
        try {
          debugLog(`  Đã chờ ${pageTries * 0.5}s, đang đợi trang load...`);
        } catch (e) {
          console.log(`  Đã chờ ${pageTries * 0.5}s, đang đợi trang load...`);
        }
      }
    }
    
    if (!pageReady) {
      try {
        debugLog('⚠️ Trang chưa load xong sau 30s, vẫn tiếp tục...');
      } catch (e) {
        console.log('⚠️ Trang chưa load xong sau 30s, vẫn tiếp tục...');
      }
    }
    
    // Đợi thêm 5s để ổn định sau khi trang đã load
    try {
      debugLog('⏳ Đang đợi 5s để ổn định sau khi trang load...');
    } catch (e) {
      console.log('⏳ Đang đợi 5s để ổn định sau khi trang load...');
    }
    await sleep(5000);
    
    // Khởi tạo IndexedDB trước khi restore state
    try {
      await initQueueDB();
    } catch (e) {
      console.error('⚠️ Lỗi khi khởi tạo IndexedDB: ', e);
      try {
        debugLog('⚠️ Lỗi khi khởi tạo IndexedDB: ' + e);
      } catch (_) {}
    }
    
    // Kiểm tra xem có đang ở tab Scenebuilder không (sau khi DOM đã load xong)
    // Restore queue state và normal flow state
    const hasQueueState = await restoreQueueState();
    const hasState = await restoreFlowState();
    
    if (hasQueueState || hasState) {
      // Có state, cần check xem có phải Scenebuilder tab không
      if (!isScenebuilderTab()) {
        updateScenebuilderMask(true);
        try {
          debugLog('⚠️ Không phải tab Scenebuilder, không thể restore state');
        } catch (e) {
          console.log('⚠️ Không phải tab Scenebuilder, không thể restore state');
        }
        // Xóa state vì không thể restore
        if (hasQueueState) await clearQueueState();
        if (hasState) await clearFlowState();
        return;
      }
      
      // Ẩn mask nếu đang hiển thị
      updateScenebuilderMask(false);
    }
    
    // Debug: log các biến sau khi restore để kiểm tra
    if (hasQueueState) {
      try {
        debugLog(`🔍 Debug restore queue: isQueueMode=${isQueueMode}, isRunning=${isRunning}, currentQueueIndex=${currentQueueIndex}, queueList.length=${queueList.length}, userStopped=${userStopped}`);
      } catch (e) {
        console.log(`🔍 Debug restore queue: isQueueMode=${isQueueMode}, isRunning=${isRunning}, currentQueueIndex=${currentQueueIndex}, queueList.length=${queueList.length}, userStopped=${userStopped}`);
      }
      
      // Đảm bảo các biến được set đúng sau khi restore
      // Nếu có queue state và còn queue để xử lý, đảm bảo isRunning và userStopped đúng
      if (currentQueueIndex < queueList.length) {
        // Còn queue để xử lý, đảm bảo isRunning = true và userStopped = false
        // Lưu ý: Nếu state được lưu với isRunning = false (đã stop), không tự động set lại = true
        // Chỉ set lại = true nếu state được lưu với isRunning = true (đang chạy trước khi reload)
        // Nhưng vì đã restore rồi, nên isRunning đã có giá trị từ state
        // Nếu state có isRunning = true, thì giữ nguyên
        // Nếu state có isRunning = false (đã stop), thì không tự động tiếp tục
        
        // Chỉ set lại userStopped = false nếu isRunning = true (để có thể continue)
        if (isRunning && userStopped) {
          try {
            debugLog('⚠️ userStopped=true sau restore nhưng isRunning=true, đang set lại userStopped = false');
          } catch (e) {
            console.log('⚠️ userStopped=true sau restore nhưng isRunning=true, đang set lại userStopped = false');
          }
          userStopped = false;
        }
        
        // Đảm bảo isQueueMode = true
        if (!isQueueMode) {
          try {
            debugLog('⚠️ isQueueMode=false sau restore, đang set lại = true');
          } catch (e) {
            console.log('⚠️ isQueueMode=false sau restore, đang set lại = true');
          }
          isQueueMode = true;
        }
      }
    }
    
    // Restore state và tiếp tục flow
    // Chỉ tiếp tục nếu:
    // 1. Có queue state
    // 2. isQueueMode = true
    // 3. isRunning = true (đang chạy trước khi reload, không phải đã stop)
    // 4. Còn queue để xử lý
    // 5. userStopped = false
    if (hasQueueState) {
      // Debug: log từng điều kiện để xem điều kiện nào không thỏa mãn
      try {
        debugLog(`🔍 Kiểm tra điều kiện tiếp tục: hasQueueState=${hasQueueState}, isQueueMode=${isQueueMode}, isRunning=${isRunning}, currentQueueIndex=${currentQueueIndex}, queueList.length=${queueList.length}, userStopped=${userStopped}`);
      } catch (e) {
        console.log(`🔍 Kiểm tra điều kiện tiếp tục: hasQueueState=${hasQueueState}, isQueueMode=${isQueueMode}, isRunning=${isRunning}, currentQueueIndex=${currentQueueIndex}, queueList.length=${queueList.length}, userStopped=${userStopped}`);
      }
    }
    
    if (hasQueueState && isQueueMode && isRunning && currentQueueIndex < queueList.length && !userStopped) {
      try {
        debugLog(`🔄 Tiếp tục queue từ queue #${currentQueueIndex + 1} sau reload...`);
      } catch (e) {
        console.log(`🔄 Tiếp tục queue từ queue #${currentQueueIndex + 1} sau reload...`);
      }
      
      try {
        chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Queue Running' });
      } catch (e) {
        console.error('Lỗi khi gửi FLOW_STATUS: ', e);
      }
      
      try {
        sendQueueProgressUpdate();
      } catch (e) {
        console.error('Lỗi khi gửi queue progress update: ', e);
      }
      
      runQueueFlow();
    } else if (hasState && !isQueueMode && isRunning && currentPromptIndex < prompts.length && !userStopped) {
      try {
        debugLog(`🔄 Tiếp tục flow từ prompt #${currentPromptIndex + 1} sau reload...`);
      } catch (e) {
        console.log(`🔄 Tiếp tục flow từ prompt #${currentPromptIndex + 1} sau reload...`);
      }
      
      try {
        chrome.runtime.sendMessage({ type: 'FLOW_STATUS', status: 'Running' });
      } catch (e) {
        console.error('Lỗi khi gửi FLOW_STATUS: ', e);
      }
      
      try {
        sendProgressUpdate();
      } catch (e) {
        console.error('Lỗi khi gửi progress update: ', e);
      }
      
      runFlow();
    } else if (hasQueueState) {
      // Có queue state nhưng queue đã hoàn thành hoặc đã dừng
      // Nếu isRunning = false (đã stop), giữ lại state để có thể continue
      // Chỉ xóa nếu queue đã hoàn thành (currentQueueIndex >= queueList.length)
      if (currentQueueIndex >= queueList.length) {
        // Queue đã hoàn thành, xóa state
        try {
          debugLog('ℹ️ Queue đã hoàn thành, xóa state...');
        } catch (e) {
          console.log('ℹ️ Queue đã hoàn thành, xóa state...');
        }
        await clearQueueState();
      } else {
        // Queue đã dừng (isRunning = false) nhưng chưa hoàn thành, giữ lại state để continue
        try {
          debugLog(`ℹ️ Queue đã dừng tại queue #${currentQueueIndex + 1}, prompt #${currentPromptIndexInQueue + 1}. Có thể tiếp tục bằng nút Continue.`);
        } catch (e) {
          console.log(`ℹ️ Queue đã dừng tại queue #${currentQueueIndex + 1}, prompt #${currentPromptIndexInQueue + 1}. Có thể tiếp tục bằng nút Continue.`);
        }
      }
    } else if (hasState) {
      // Có state nhưng flow đã hoàn thành hoặc đã dừng
      try {
        debugLog('ℹ️ Có state nhưng flow đã hoàn thành hoặc đã dừng, xóa state...');
      } catch (e) {
        console.log('ℹ️ Có state nhưng flow đã hoàn thành hoặc đã dừng, xóa state...');
      }
      await clearFlowState();
    }
  } catch (e) {
    console.error('❌ Lỗi trong autoRestoreAndContinue: ', e);
    try {
      debugLog('❌ Lỗi trong autoRestoreAndContinue: ' + e);
    } catch (_) {}
  }
}

// Tự động chạy khi script load (chỉ một lần)
let autoRestoreCalled = false;
if (!autoRestoreCalled) {
  autoRestoreCalled = true;
  autoRestoreAndContinue();
}

