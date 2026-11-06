 PEAK AI – bản nâng cấp đa phương thức (thử nghiệm)
Tính năng được bổ sung
Chat văn bản với Gemini.
Gửi ảnh PNG/JPG/WEBP, PDF, TXT, CSV để Gemini phân tích.
Gửi DOCX: trình duyệt trích xuất văn bản từ Word rồi gửi cho Gemini (không giữ định dạng biểu đồ/ảnh nhúng).
Tạo ảnh qua Gemini Interactions API (`GEMINI_IMAGE_MODEL`).
Voice thời gian thực qua Gemini Live API với ephemeral token; API key thật chỉ ở máy chủ.
Cấu hình
Giữ `GEMINI_API_KEY` ở biến môi trường của Render, không đưa vào GitHub hoặc HTML.
Biến tùy chọn:
`GEMINI_MODEL` (mặc định `gemini-2.5-flash`)
`GEMINI_IMAGE_MODEL` (mặc định `gemini-3.1-flash-image`)
`GEMINI_LIVE_MODEL` (mặc định `models/gemini-3.8-live`)
Triển khai
Build command: `npm install`
Start command: `npm run start`
Ứng dụng phục vụ `public/index.html`.
Giới hạn và lưu ý
Tệp gửi trực tiếp giới hạn khoảng 17 MB để tránh vượt giới hạn JSON/base64 của máy chủ.
DOCX cần tải JSZip từ CDN; cần kết nối Internet. Tài liệu Word được trích xuất thành văn bản, không bảo toàn bố cục.
Gemini Live và model tạo ảnh có hạn mức/quyền truy cập riêng. Model tạo ảnh Gemini 3.1 Flash Image hiện không có mức miễn phí tiêu chuẩn theo bảng giá của Google; không bật thanh toán nếu chưa được người giám hộ đồng ý.
Voice cần trình duyệt hỗ trợ micro và kết nối WebSocket; nên kiểm tra trong môi trường triển khai thật. Mã token Live là mã ngắn hạn.
Đây là bản tích hợp thử nghiệm. Các API Google có thể thay đổi; sau khi deploy cần thử từng tính năng và xem Render Logs nếu có lỗi.
