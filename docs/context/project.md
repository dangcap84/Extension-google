# Veo 3 Flow Auto Prompt Extension

## Mô tả

Chrome Extension tự động hóa việc nhập prompt trong Google Flow SceneBuilder (Veo 3). Extension tự động thực hiện chuỗi thao tác để tạo video từ các prompt đã nhập.

## Mục tiêu

1. Tự động hóa việc nhập prompt trong Google Flow SceneBuilder
2. Flow tiếp tục chạy ngay cả khi người dùng chuyển sang tab khác
3. Lưu prompts và logs vào localStorage để người dùng không mất dữ liệu
4. Reset log khi prompts được sửa
5. Thay thế prompts cũ khi paste prompts mới
6. Scroll assets xuống cuối trước mỗi prompt để đảm bảo slider có thể kéo đến frame cuối
7. Chờ video render xong trước khi chuyển sang prompt tiếp theo

## Target Website

- `https://labs.google/*` - Google Flow SceneBuilder

## Manifest Version

- Manifest V3 (Chrome Extension)
- Service Worker architecture

