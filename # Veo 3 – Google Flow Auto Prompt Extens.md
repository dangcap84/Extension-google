# Veo 3 – Google Flow Auto Prompt Extension

## 1. Mục tiêu

Tạo **Chrome Extension** tự động hoá quy trình làm video dài bằng Veo 3 trong **Google Flow / SceneBuilder**.

Yêu cầu chính:

* Nhấn **Start một lần**
* Chạy **toàn bộ danh sách prompt tuần tự**
* Mỗi prompt dùng **frame mới nhất vừa Save as asset** từ cảnh trước
* **Không tải video**, **không xử lý frame**, **không backend**
* Thuần **UI automation** giống Auto Flow nhưng custom cho SceneBuilder

---

## 2. Luồng làm việc thực tế (đã xác thực)

### Thao tác thủ công hiện tại trong Google Flow

1. Có **master image** ban đầu
2. Dùng **Frames to Video (Veo 3)** → render video (~8s)
3. Video xuất hiện trong **SceneBuilder timeline**
4. Click **Save frame as asset** (frame cuối)
5. Frame được lưu vào **Assets**
6. Trong prompt bar:

   * Click **+ Image**
   * Chọn **asset mới nhất** vừa save
7. Nhập prompt tiếp theo
8. Render video mới
9. Lặp lại từ bước 4 cho tới hết prompt list

Extension sẽ **làm hộ toàn bộ thao tác UI trên**.

---

## 3. Phạm vi kỹ thuật (RẤT QUAN TRỌNG)

### Không làm

* ❌ Không xử lý video
* ❌ Không extract frame bằng code
* ❌ Không download file
* ❌ Không API / backend
* ❌ Không cloud / login

### Chỉ làm

* ✅ Click UI
* ✅ Nhập prompt
* ✅ Chọn asset mới nhất
* ✅ Loop theo state

---

## 4. Kiến trúc Extension

### Công nghệ

* Chrome Extension Manifest V3
* JavaScript thuần
* HTML đơn giản

### Công cụ

* Visual Studio Code
* Google Chrome

### Cấu trúc thư mục

```
veo-flow-extension/
├ manifest.json
├ popup.html
├ popup.js
└ content.js
```

---

## 5. Vai trò từng file

### manifest.json

* Khai báo extension
* Inject `content.js` vào trang Google Flow

### popup.html

* UI tối giản:

  * Textarea nhập prompt list (mỗi dòng = 1 prompt)
  * Button **Start**
  * Button **Stop** (optional)

### popup.js

* Lấy prompt list từ textarea
* Gửi message `START_FLOW` sang content script
* Không chứa logic automation

### content.js (trọng tâm)

* Chạy trực tiếp trong tab Google Flow
* Điều khiển toàn bộ UI
* Loop prompt list
* Quản lý state

---

## 6. Flow Engine (logic cốt lõi)

### Prompt list

Mỗi dòng = 1 prompt:

```
Wide cinematic shot, soft lighting
Camera slowly zooms in
Hands preparing ingredients, close-up
Steam rises, warm mood
```

### State

* `currentPromptIndex`
* `isRunning`

### Pseudo-code tổng thể

```js
for (let i = 0; i < prompts.length; i++) {
  await waitForVideoRendered();
  await saveFrameAsAsset();
  await openImagePicker();
  await selectLatestAsset();
  await inputPrompt(prompts[i]);
  await clickGenerate();
}
```

---

## 7. Các hàm automation bắt buộc

### 7.1 waitForVideoRendered()

Chờ video render xong trước khi thao tác tiếp.

Dấu hiệu ổn định:

* Nút **Save frame as asset** xuất hiện
* Timeline hiển thị `0:08 / 0:08`
* Spinner biến mất

Gợi ý:

* Dùng `MutationObserver`
* Không dùng `setTimeout` cố định

---

### 7.2 saveFrameAsAsset()

* Hover hoặc focus vào frame cuối trong timeline
* Click nút **Save frame as asset**

Selector ưu tiên:

* `aria-label`
* `role="button"` + text

---

### 7.3 openImagePicker()

* Focus vào prompt bar
* Click nút **+ Image**
* Đợi asset picker mở hoàn toàn

---

### 7.4 selectLatestAsset()

* Asset picker luôn sort **newest → oldest**
* Click **thumbnail đầu tiên**
* Click **Use / Confirm**

⚠️ Không dùng filename, không dùng timestamp

---

### 7.5 inputPrompt(prompt)

* Focus textarea prompt
* Clear nội dung cũ
* Paste prompt mới

---

### 7.6 clickGenerate()

* Click nút Generate
* Set state chờ render

---

## 8. Selector strategy (chống UI thay đổi)

Ưu tiên theo thứ tự:

1. `aria-label`
2. `role` + text
3. `data-testid`
4. DOM position (cuối cùng)

❌ Tránh:

* Class name random
* CSS deep chain

---

## 9. Cách test extension

### Load extension

1. Mở `chrome://extensions`
2. Bật **Developer mode**
3. Click **Load unpacked**
4. Chọn thư mục project

### Debug

* `content.js`: mở DevTools tab Google Flow → Console
* `popup.js`: right click popup → Inspect

---

## 10. Rủi ro & cách giảm thiểu

### UI Google Flow thay đổi

* Selector linh hoạt
* Fail fast + log rõ

### Render lâu / treo

* Poll trạng thái render
* Không click liên tục

### Asset load chậm

* Chờ asset picker render xong rồi mới chọn

---

## 11. Phạm vi mở rộng (sau MVP)

* Resume khi reload tab
* Preview prompt progress
* Pause / Resume
* Preset prompt template

---

## 12. Kết luận

Đây là:

* Một **stateful UI automation extension**
* Clone ý tưởng Auto Flow nhưng **custom sâu cho Veo 3 SceneBuilder**
* Phù hợp làm tool cá nhân hoặc sản phẩm niche

👉 File này dùng làm **nguồn yêu cầu (spec)** để làm việc tiếp với **GitHub Copilot / Cursor / AI coding assistant**.
