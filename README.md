# QuestionBible

Nền tảng Đố Vui Kinh Thánh Thời Gian Thực (Real-time Bible Quiz Platform) dành cho các Hội Thánh Tin Lành, Ban Thanh Tráng, Thanh Thiếu Niên và Trường Chúa Nhật (hỗ trợ 300–500+ người chơi đồng thời qua Wi-Fi/4G).

## Tính năng nổi bật

- **6 loại câu hỏi Kinh Thánh**: Trắc nghiệm 4 lựa chọn (`single`), Đúng/Sai (`true_false`), Nhiều lựa chọn (`multiple`), Sắp xếp thứ tự sự kiện (`order`), Điền từ Kinh Thánh (`type_answer`), Khảo sát (`poll`).
- **Tối ưu đặc biệt cho mạng Wi-Fi Hội Thánh (300–500+ người cùng lúc)**:
  - Định danh từng thiết bị qua `deviceId` + `reconnectToken` (không chặn nhầm NAT IP chung của Wi-Fi nhà thờ).
  - Giao diện điện thoại siêu nhẹ (~7.5 KB gzip), Zero-Media trên máy người chơi, đồng bộ đồng hồ Server (`serverClock`).
- **Trích dẫn Kinh Thánh Truyền Thống (1925 - Cadman)**: Hiển thị câu gốc và giải thích ngay sau mỗi câu hỏi trên màn chiếu và điện thoại, kèm chế độ Ôn tập Kinh Thánh cuối giờ.
- **Điều khiển từ xa cho MC (Host Remote Control)**: MC có thể cầm điện thoại di chuyển trên bục giảng để bấm chuyển câu, tạm dừng, xem đáp án và câu gốc Kinh Thánh.
- **Chế độ Thiếu Nhi / Trường Chúa Nhật**: Chế độ tính điểm đồng đều (`speedScoring: false`) và lời khích lệ thân thiện (`friendlyMode`).

## Cấu trúc Monorepo

- `shared/`: Kiểu dữ liệu TypeScript, Socket.IO events, công thức tính điểm, chuẩn hóa tiếng Việt & tên riêng Kinh Thánh.
- `server/`: Node.js + Express + Socket.IO + Prisma (MySQL) + Redis snapshot.
- `client/`: Vue 3 + Vite + Pinia + Tailwind CSS.
- `loadtest/`: Các kịch bản kiểm thử tải 300–500 người chơi đồng thời.

## Hướng dẫn chạy dự án (Local / XAMPP)

1. **Khởi động MySQL** (XAMPP trên cổng `3306`) và cấu hình file `.env`.
2. **Cài đặt thư viện & Khởi tạo CSDL**:
   ```bash
   npm install
   npm run db:push
   npm run db:seed
   ```
3. **Chạy môi trường phát triển (Server + Client)**:
   ```bash
   npm run dev
   ```
   - Giao diện Web (Client): `http://localhost:5173`
   - Máy chủ API & Socket.IO (Server): `http://localhost:3000`

## Tài khoản mẫu (Sau khi chạy `db:seed`)

- **Quản trị viên (Admin)**: `admin@questionbible.local` / `Bible@2026`
- **Giáo viên Trường Chúa Nhật (Host)**: `giaovien@questionbible.local` / `Bible@2026`
- **Đặc trách Thanh Niên (Host)**: `thanhnien@questionbible.local` / `Bible@2026`
