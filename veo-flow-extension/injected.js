// injected.js
// Script này chạy trong main world (page context)
// Được inject từ content.js để có quyền tương tác trực tiếp với page

(function() {
  console.log('[MAIN WORLD] injected.js loaded');
  
  // Hàm kéo slider đến cuối video
  window.seekToEndOfVideo = async function() {
    console.log('[MAIN WORLD] seekToEndOfVideo được gọi');
    try {
      // Tìm slider
      const slider = document.querySelector('[role="slider"][aria-orientation="horizontal"]');
      if (!slider) {
        console.error('[MAIN WORLD] Không tìm thấy slider');
        return false;
      }
      console.log('[MAIN WORLD] Tìm thấy slider:', slider);
      
      // Lấy giá trị min/max/current
      const min = parseFloat(slider.getAttribute('aria-valuemin')) || 0;
      const max = parseFloat(slider.getAttribute('aria-valuemax')) || 100;
      const current = parseFloat(slider.getAttribute('aria-valuenow')) || 0;
      console.log('[MAIN WORLD] Slider values - min:', min, 'max:', max, 'current:', current);
      
      // Tìm track (vùng có thể kéo) - FIXED: lấy parent level 2
      // Parent level 1 = span nhỏ chứa thumb
      // Parent level 2 = track chính (width ~300-400px)
      const track = slider.parentElement.parentElement;
      
      if (!track) {
        console.error('[MAIN WORLD] Không tìm thấy track');
        return false;
      }
      
      const trackRect = track.getBoundingClientRect();
      console.log('[MAIN WORLD] Tìm thấy track:', track.className);
      console.log('[MAIN WORLD] Track width:', Math.round(trackRect.width), 'px');
      
      // Kiểm tra track có đủ rộng không (phải > 200px)
      if (trackRect.width < 172) {
        console.error('[MAIN WORLD] Track quá nhỏ:', trackRect.width, 'px - có thể selector sai');
        return false;
      }
      
      // Tính toạ độ
      const sliderRect = slider.getBoundingClientRect();
      
      const startX = sliderRect.left + sliderRect.width / 2;
      const startY = sliderRect.top + sliderRect.height / 2;
      const endX = trackRect.right - 10; // Trừ 10px để an toàn
      const endY = startY;
      
      console.log('[MAIN WORLD] Track rect:', {
        left: Math.round(trackRect.left),
        right: Math.round(trackRect.right),
        width: Math.round(trackRect.width)
      });
      console.log('[MAIN WORLD] Slider rect:', {
        left: Math.round(sliderRect.left),
        right: Math.round(sliderRect.right),
        width: Math.round(sliderRect.width)
      });
      console.log('[MAIN WORLD] Drag từ (' + Math.round(startX) + ',' + Math.round(startY) + ') đến (' + Math.round(endX) + ',' + Math.round(endY) + ')');
      
      // === HELPER FUNCTIONS ===
      
      function dispatchPointerEvent(element, type, clientX, clientY, options = {}) {
        const event = new PointerEvent(type, {
          view: window,
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: clientX,
          clientY: clientY,
          screenX: clientX + window.screenX,
          screenY: clientY + window.screenY,
          pointerId: 1,
          width: 1,
          height: 1,
          pressure: type.includes('up') ? 0 : 0.5,
          tangentialPressure: 0,
          tiltX: 0,
          tiltY: 0,
          twist: 0,
          pointerType: options.pointerType || 'mouse',
          isPrimary: options.isPrimary !== false,
          button: options.button ?? 0,
          buttons: options.buttons ?? 0,
        });
        element.dispatchEvent(event);
      }
      
      function dispatchMouseEvent(element, type, clientX, clientY, options = {}) {
        const event = new MouseEvent(type, {
          view: window,
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: clientX,
          clientY: clientY,
          screenX: clientX + window.screenX,
          screenY: clientY + window.screenY,
          button: options.button ?? 0,
          buttons: options.buttons ?? 0,
          relatedTarget: null,
        });
        element.dispatchEvent(event);
      }
      
      function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }
      
      function wait(ms) { 
        return new Promise(res => setTimeout(res, ms)); 
      }
      
      // === DRAG SIMULATION - Thử nhiều phương pháp ===
      
      console.log('[MAIN WORLD] Bắt đầu drag simulation...');
      
      // Scroll vào view
      slider.scrollIntoView({ behavior: 'instant', block: 'center' });
      await wait(200);
      
      // ==========================================
      // PHƯƠNG PHÁP 1: Pointer Events (chuẩn)
      // ==========================================
      console.log('[MAIN WORLD] Thử phương pháp 1: Pointer Events');
      
      // Phase 1: Pointer Down
      dispatchPointerEvent(slider, 'pointerdown', startX, startY, { 
        pointerType: 'mouse', 
        isPrimary: true, 
        button: 0, 
        buttons: 1 
      });
      dispatchMouseEvent(slider, 'mousedown', startX, startY, { 
        button: 0, 
        buttons: 1 
      });
      slider.focus();
      await wait(100);
      
      // Phase 2: Pointer Move (25 steps với easing)
      const steps = 25;
      for (let i = 1; i <= steps; i++) {
        const progress = easeInOutCubic(i / steps);
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY;
        
        dispatchPointerEvent(slider, 'pointermove', currentX, currentY, { 
          pointerType: 'mouse', 
          isPrimary: true, 
          button: 0, 
          buttons: 1 
        });
        dispatchMouseEvent(slider, 'mousemove', currentX, currentY, { 
          button: 0, 
          buttons: 1 
        });
        
        await wait(15);
      }
      
      // Phase 3: Pointer Up
      dispatchPointerEvent(slider, 'pointermove', endX, endY, { 
        pointerType: 'mouse', 
        isPrimary: true, 
        button: 0, 
        buttons: 1 
      });
      await wait(50);
      
      dispatchPointerEvent(slider, 'pointerup', endX, endY, { 
        pointerType: 'mouse', 
        isPrimary: true, 
        button: 0, 
        buttons: 0 
      });
      dispatchMouseEvent(slider, 'mouseup', endX, endY, { 
        button: 0, 
        buttons: 0 
      });
      dispatchMouseEvent(slider, 'click', endX, endY, { 
        button: 0, 
        buttons: 0 
      });
      
      await wait(100);
      
      // Trigger input/change events
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      
      await wait(300);
      
      // Kiểm tra kết quả
      let newValue = parseFloat(slider.getAttribute('aria-valuenow'));
      console.log('[MAIN WORLD] Phương pháp 1 - Giá trị:', newValue);
      
      if (Math.abs(newValue - max) < 1) {
        console.log('[MAIN WORLD] ✅ Thành công với Pointer Events!');
        return true;
      }
      
      // ==========================================
      // PHƯƠNG PHÁP 2: Click trực tiếp vào cuối track
      // ==========================================
      console.log('[MAIN WORLD] Thử phương pháp 2: Click vào cuối track');
      
      const clickX = trackRect.right - 10;
      const clickY = trackRect.top + trackRect.height / 2;
      
      dispatchMouseEvent(track, 'mousedown', clickX, clickY, { button: 0, buttons: 1 });
      await wait(50);
      dispatchMouseEvent(track, 'mouseup', clickX, clickY, { button: 0, buttons: 0 });
      dispatchMouseEvent(track, 'click', clickX, clickY, { button: 0, buttons: 0 });
      
      await wait(300);
      
      newValue = parseFloat(slider.getAttribute('aria-valuenow'));
      console.log('[MAIN WORLD] Phương pháp 2 - Giá trị:', newValue);
      
      if (Math.abs(newValue - max) < 1) {
        console.log('[MAIN WORLD] ✅ Thành công với Click track!');
        return true;
      }
      
      // ==========================================
      // PHƯƠNG PHÁP 3: Keyboard - End key
      // ==========================================
      console.log('[MAIN WORLD] Thử phương pháp 3: Keyboard End key');
      
      slider.focus();
      await wait(100);
      
      slider.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'End',
        code: 'End',
        keyCode: 35,
        which: 35,
        bubbles: true,
        cancelable: true
      }));
      
      await wait(50);
      
      slider.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'End',
        code: 'End',
        keyCode: 35,
        which: 35,
        bubbles: true,
        cancelable: true
      }));
      
      await wait(300);
      
      newValue = parseFloat(slider.getAttribute('aria-valuenow'));
      console.log('[MAIN WORLD] Phương pháp 3 - Giá trị:', newValue);
      
      if (Math.abs(newValue - max) < 1) {
        console.log('[MAIN WORLD] ✅ Thành công với Keyboard!');
        return true;
      }
      
      // ==========================================
      // PHƯƠNG PHÁP 4: Set giá trị trực tiếp
      // ==========================================
      console.log('[MAIN WORLD] Thử phương pháp 4: Set aria-valuenow trực tiếp');
      
      slider.setAttribute('aria-valuenow', max);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Tìm inner thumb span và set style left
      const thumbInner = slider.querySelector('span[style*="left"]');
      if (thumbInner) {
        thumbInner.style.left = 'calc(100% - 0.72px)';
        console.log('[MAIN WORLD] Đã set style left của thumb');
      }
      
      await wait(300);
      
      newValue = parseFloat(slider.getAttribute('aria-valuenow'));
      console.log('[MAIN WORLD] Phương pháp 4 - Giá trị:', newValue);
      
      if (Math.abs(newValue - max) < 1) {
        console.log('[MAIN WORLD] ✅ Thành công với Set trực tiếp!');
        return true;
      }
      
      // ==========================================
      // TẤT CẢ PHƯƠNG PHÁP ĐỀU THẤT BẠI
      // ==========================================
      console.error('[MAIN WORLD] ❌ Tất cả phương pháp đều thất bại');
      console.log('[MAIN WORLD] Giá trị cuối cùng:', newValue, '/', max);
      
      return false;
      
    } catch (e) {
      console.error('[MAIN WORLD] Lỗi:', e);
      return false;
    }
  };
  
  // Lắng nghe message từ content script
  window.addEventListener('message', async function(e) {
    if (e.data && e.data.type === 'SEEK_TO_END_VIDEO_REQUEST') {
      console.log('[MAIN WORLD] Nhận request SEEK_TO_END_VIDEO_REQUEST');
      let ok = false, error = null;
      try {
        ok = await window.seekToEndOfVideo();
      } catch (err) { 
        error = err && err.message ? err.message : String(err);
        console.error('[MAIN WORLD] Lỗi khi thực thi:', error);
      }
      console.log('[MAIN WORLD] Gửi kết quả - ok:', ok, 'error:', error);
      window.postMessage({ 
        type: 'SEEK_TO_END_VIDEO_RESULT', 
        ok, 
        error 
      }, '*');
    }
  });
  
  console.log('[MAIN WORLD] Script sẵn sàng');
})();