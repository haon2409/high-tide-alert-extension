# High Tide Alert Extension

Extension Chrome theo dõi mực nước thủy triều tại Sài Gòn (nguồn: thegioimoicau.com).

## Tính năng

- Biểu đồ mực nước theo giờ (nhiều ngày)
- Hai ngưỡng cảnh báo: **đỏ** (nguy hiểm) và **vàng** (cảnh báo)
- Chọn khung giờ cần theo dõi
- Badge trên icon: số ngày sắp tới có mực nước vượt ngưỡng đỏ
- Icon đổi màu theo mực nước **giờ hiện tại** (xanh / vàng / đỏ)
- Tự cập nhật badge mỗi 5 phút (background)

## Cài đặt

1. Mở `chrome://extensions/`
2. Bật **Developer mode**
3. **Load unpacked** → chọn thư mục extension này

## Cấu hình

- Bấm ⚙️ để chỉnh ngưỡng đỏ, ngưỡng vàng và các giờ cần kiểm tra
- Lưu → biểu đồ và badge cập nhật ngay

## Màu sắc biểu đồ

| Màu | Ý nghĩa |
|-----|---------|
| Xanh | Dưới cả hai ngưỡng |
| Vàng | ≥ ngưỡng vàng |
| Đỏ | ≥ ngưỡng đỏ |
| Sọc chéo | Giờ hiện tại |

## Quyền

- `storage` – lưu cấu hình
- `alarms` – cập nhật định kỳ
- `host_permissions` – đọc dữ liệu từ thegioimoicau.com
