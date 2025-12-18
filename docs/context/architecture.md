# Architecture Decisions

## Overview

Extension sử dụng Chrome Side Panel API và Service Worker architecture để đảm bảo flow tiếp tục chạy khi người dùng chuyển tab.

## Components

### 1. Service Worker (`background.js`)

**Vai trò**: Quản lý flow state và điều phối automation steps

**Chức năng**:
- Quản lý state: `isRunning`, `prompts`, `currentPromptIndex`, `totalPrompts`, `userStopped`, `tabId`
- Điều phối flow loop: gửi commands tuần tự đến content script
- Xử lý messages: `START_FLOW`, `STOP_FLOW` từ sidepanel
- Lưu state vào `chrome.storage.local`
- Auto-restart flow sau 10s nếu gặp lỗi

**State Management**:
- State được lưu trong `chrome.storage.local` để persist qua service worker restarts
- Flow state object: `{ isRunning, prompts, currentPromptIndex, totalPrompts, userStopped, tabId, prevAssetCount, retryCount }`

### 2. Content Script (`content.js`)

**Vai trò**: Command executor - thực thi automation commands từ Service Worker

**Chức năng**:
- Nhận commands từ Service Worker qua `EXECUTE_COMMAND` message
- Thực thi các automation functions: `scrollAssetListToEnd()`, `saveFrameAsAsset()`, `openImagePicker()`, `selectLatestAsset()`, `inputPrompt()`, `clickGenerate()`, `getAssetCount()`, `waitForNewAsset()`, `isProgressRunning()`
- Gửi kết quả về Service Worker
- Gửi debug logs về sidepanel qua `DEBUG_LOG` message

**Không quản lý state**: Content script chỉ thực thi commands, không lưu flow state

### 3. Side Panel (`sidepanel.html`, `sidepanel.js`)

**Vai trò**: UI chính cho extension

**Chức năng**:
- Hiển thị textarea để nhập prompts (mỗi dòng = 1 prompt)
- Buttons: Start, Stop
- Hiển thị log từ content script và service worker
- Hiển thị status và progress
- Lưu prompts vào `chrome.storage.local` (key: `veoSidebarPrompts`)
- Gửi `START_FLOW` và `STOP_FLOW` messages đến Service Worker

**UI Features**:
- Dark theme
- Auto-scroll log
- Debounced save prompts (1s delay)

### 4. Injected Script (`injected.js`)

**Vai trò**: Tương tác với elements trong main world (không bị isolated world của content script)

**Chức năng**:
- Kéo video timeline slider đến cuối (100%)
- Sử dụng pointer events để drag slider
- Giao tiếp với content script qua `window.postMessage`

## Communication Flow

```
Side Panel → Service Worker → Content Script → DOM
                ↓
         chrome.storage.local
```

### Message Types

1. **Side Panel → Service Worker**:
   - `START_FLOW`: Bắt đầu flow với prompts
   - `STOP_FLOW`: Dừng flow

2. **Service Worker → Content Script**:
   - `EXECUTE_COMMAND`: Thực thi automation command
     - Commands: `SCROLL_ASSETS`, `SAVE_FRAME`, `OPEN_IMAGE_PICKER`, `SELECT_ASSET`, `INPUT_PROMPT`, `CLICK_GENERATE`, `CHECK_ASSET_COUNT`, `WAIT_FOR_ASSET`, `CHECK_PROGRESS_RUNNING`

3. **Content Script → Service Worker**:
   - Response từ `EXECUTE_COMMAND`: `{ ok: true, ...data }`

4. **Service Worker/Content Script → Side Panel**:
   - `DEBUG_LOG`: Gửi log message
   - `PROGRESS_UPDATE`: Cập nhật tiến độ `{ done, total }`
   - `FLOW_STATUS`: Cập nhật trạng thái `{ status }`

## Flow Sequence (mỗi prompt)

1. Scroll assets to end
2. Get asset count (prevCount)
3. Save frame (kéo slider đến cuối, click save frame)
4. Open image picker (chờ tự hiện)
5. Select latest asset (data-index="1")
6. Input prompt text
7. Click generate button
8. Wait for new asset (timeout: 3 minutes)
9. Wait for video render complete (check `isProgressRunning()`)
10. Move to next prompt

## Error Handling

- **Retry logic**: Tối đa 5 lần retry cho mỗi prompt
- **Auto-restart**: Tự động restart flow sau 10s nếu gặp lỗi
- **Timeouts**:
  - Wait for asset: 3 phút (180s)
  - Wait for video render: 5 phút (300s)
  - Wait for element: 10s (default)

## Removed Mechanisms

Các cơ chế đã được loại bỏ:

1. **Wake Lock API**: Không cần thiết với Service Worker architecture
2. **Keep-alive mechanism**: Service Worker tự quản lý lifecycle
3. **Mini popup**: Không cần thiết với Side Panel API
4. **"Run in background" button**: Side Panel đã cung cấp persistent UI
5. **Sidebar DOM injection**: Thay bằng Side Panel API

## Why Service Worker Architecture?

1. **Persistent execution**: Service Worker tiếp tục chạy khi tab không active
2. **State persistence**: State lưu trong `chrome.storage.local` survive service worker restarts
3. **Better separation**: Service Worker quản lý orchestration, Content Script chỉ thực thi commands
4. **No wake lock needed**: Service Worker không bị kill khi tab inactive (khác với background page)

