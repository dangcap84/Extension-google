# Code Conventions

## File Structure

```
veo-flow-extension/
├── manifest.json          # Extension manifest (V3)
├── background.js          # Service Worker (flow orchestration)
├── content.js            # Content Script (command executor)
├── injected.js           # Injected script (main world interaction)
├── sidepanel.html        # Side Panel UI
├── sidepanel.js          # Side Panel logic
├── popup.html            # Popup UI (legacy, có thể không dùng)
└── popup.js              # Popup logic (legacy, có thể không dùng)
```

## Message Protocol

### Message Types

#### `START_FLOW`
- **From**: Side Panel
- **To**: Service Worker
- **Payload**: `{ type: 'START_FLOW', prompts: string[], tab?: Tab }`
- **Response**: `{ ok: boolean, error?: string }`

#### `STOP_FLOW`
- **From**: Side Panel
- **To**: Service Worker
- **Payload**: `{ type: 'STOP_FLOW' }`
- **Response**: `{ ok: boolean }`

#### `EXECUTE_COMMAND`
- **From**: Service Worker
- **To**: Content Script
- **Payload**: `{ type: 'EXECUTE_COMMAND', command: string, data?: any }`
- **Response**: `{ ok: boolean, ...data }`
- **Commands**:
  - `SCROLL_ASSETS`: Scroll asset list đến cuối
  - `SAVE_FRAME`: Lưu frame hiện tại thành asset
  - `OPEN_IMAGE_PICKER`: Mở asset picker
  - `SELECT_ASSET`: Chọn asset mới nhất
  - `INPUT_PROMPT`: Nhập prompt text (data: `{ prompt: string }`)
  - `CLICK_GENERATE`: Click nút Generate
  - `CHECK_ASSET_COUNT`: Đếm số assets (response: `{ count: number }`)
  - `WAIT_FOR_ASSET`: Chờ asset mới xuất hiện (data: `{ prevCount: number, timeout: number }`, response: `{ success: boolean, newCount: number }`)
  - `CHECK_PROGRESS_RUNNING`: Kiểm tra video đang render (response: `{ running: boolean }`)

#### `DEBUG_LOG`
- **From**: Service Worker / Content Script
- **To**: Side Panel
- **Payload**: `{ type: 'DEBUG_LOG', text: string }`

#### `PROGRESS_UPDATE`
- **From**: Service Worker
- **To**: Side Panel
- **Payload**: `{ type: 'PROGRESS_UPDATE', done: number, total: number }`

#### `FLOW_STATUS`
- **From**: Service Worker
- **To**: Side Panel
- **Payload**: `{ type: 'FLOW_STATUS', status: string }`
- **Status values**: `'Running'`, `'Stopped'`, `'Idle'`, `'Waiting restart'`

## Storage Keys

- `veoSidebarPrompts`: Lưu prompts trong sidepanel (string, mỗi dòng = 1 prompt)
- Flow state: Lưu trong Service Worker's `chrome.storage.local` (internal, không expose key name)

## DOM Selection Conventions

### scrollAssetListToEnd()

**Constraint**: Không được dùng dynamic class names

**Strategy**:
1. Tìm các `div` có ≥5 children
2. Filter children: có button hoặc có background-image
3. Lấy candidate đầu tiên
4. Scroll `grandParent` element (parent.parentElement)

**Optimization**: Check button trước (nhanh hơn), chỉ tính `getComputedStyle` khi không có button

### getAssetCount()

**Priority order**:
1. `.virtuoso-grid-list` hoặc `[role="grid"]` → count `[data-index] button`
2. Fallback: Tất cả `[data-index] button`
3. Fallback cuối: Thumbnails có background-image (slice 0-200 để tối ưu)

### Element Selectors

- **Save frame button**: `button[aria-haspopup="menu"] i.google-symbols` với textContent `'add'`
- **Save frame menu item**: `[role="menuitem"]` với textContent chứa `'save'` và `'frame'`
- **Asset list**: `.virtuoso-grid-list`
- **Latest asset**: `[data-index="1"] button`
- **Prompt textarea**: `#PINHOLE_TEXT_AREA_ELEMENT_ID`
- **Generate button**: `button i.google-symbols` với textContent `'arrow_forward'`

## Logging Conventions

- **Format**: `[timestamp] message`
- **Timestamp**: `HH:mm:ss` (24h format, Vietnamese locale)
- **Log destination**: Side Panel textarea (readonly)
- **Auto-scroll**: Log area tự động scroll xuống cuối khi có log mới
- **Prefixes**:
  - `✅` Success
  - `⚠️` Warning
  - `❌` Error
  - `⏳` Waiting
  - `🔄` Retry/Restart
  - `🎬` Processing prompt
  - `📽` Scroll assets
  - `📍` Save frame
  - `🖼️` Image picker
  - `🎨` Select asset
  - `⌨️` Input prompt
  - `🚀` Generate
  - `🎉` Flow complete

## Error Handling Conventions

- **Retry limit**: 5 lần cho mỗi prompt
- **Retry delay**: 2 giây giữa các lần retry
- **Auto-restart delay**: 10 giây
- **Timeout values**:
  - Wait for element: 10s (default)
  - Wait for asset: 180s (3 phút)
  - Wait for video render: 300s (5 phút)
  - Slider drag: 5s

## State Management

- **Service Worker state**: Lưu trong memory và `chrome.storage.local`
- **Content Script**: Không lưu state, chỉ thực thi commands
- **Side Panel**: Chỉ lưu prompts (user input), không lưu flow state

## Async Communication

- Tất cả message handlers phải return `true` nếu sử dụng async response
- Sử dụng `sendResponse()` trong async handlers
- Service Worker → Content Script: Sử dụng `chrome.tabs.sendMessage()` với callback hoặc Promise wrapper

## Code Style

- **Language**: JavaScript (ES6+)
- **Async/Await**: Ưu tiên async/await hơn Promise chains
- **Error handling**: Try-catch với debugLog
- **Comments**: Tiếng Việt cho business logic, tiếng Anh cho technical notes
- **Function naming**: camelCase, descriptive names
- **Variable naming**: camelCase

