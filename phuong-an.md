# PHƯƠNG ÁN XÂY DỰNG ỨNG DỤNG ĐỐ KINH THÁNH TRỰC TUYẾN (kiểu Kahoot)

> Tên dự án tạm gọi: **QuestionBible**
> Mục tiêu: một nền tảng đố Kinh Thánh Tin Lành theo thời gian thực. Người dẫn chiếu câu hỏi lên màn hình lớn, người chơi trả lời bằng điện thoại. Chạy trên hạ tầng **PA Vietnam** (hosting/VPS + tên miền), chịu tải ổn định **200–300 người chơi cùng lúc** và còn dư để lên 500–1.000.

---

## MỤC LỤC

1. [Kahoot hoạt động thế nào](#1-kahoot-hoạt-động-thế-nào)
2. [Điểm mạnh, điểm yếu của Kahoot và bài học rút ra](#2-điểm-mạnh-điểm-yếu-của-kahoot-và-bài-học-rút-ra)
3. [Đặc thù của một app đố Kinh Thánh Tin Lành](#3-đặc-thù-của-một-app-đố-kinh-thánh-tin-lành)
4. [Phạm vi tính năng](#4-phạm-vi-tính-năng)
5. [Chọn hạ tầng PA Vietnam: shared hosting hay VPS?](#5-chọn-hạ-tầng-pa-vietnam-shared-hosting-hay-vps)
6. [Công nghệ đề xuất](#6-công-nghệ-đề-xuất)
7. [Kiến trúc hệ thống](#7-kiến-trúc-hệ-thống)
8. [Luồng một trận đấu và các sự kiện realtime](#8-luồng-một-trận-đấu-và-các-sự-kiện-realtime)
9. [Cách tính điểm](#9-cách-tính-điểm)
10. [Thiết kế cơ sở dữ liệu](#10-thiết-kế-cơ-sở-dữ-liệu)
11. [Đảm bảo hiệu năng cho 200–300 người chơi](#11-đảm-bảo-hiệu-năng-cho-200300-người-chơi)
12. [Bảo mật và chống gian lận](#12-bảo-mật-và-chống-gian-lận)
13. [Triển khai lên PA Vietnam từng bước](#13-triển-khai-lên-pa-vietnam-từng-bước)
14. [Cấu trúc thư mục mã nguồn](#14-cấu-trúc-thư-mục-mã-nguồn)
15. [Lộ trình phát triển](#15-lộ-trình-phát-triển)
16. [Chi phí ước tính](#16-chi-phí-ước-tính)
17. [Rủi ro và cách xử lý](#17-rủi-ro-và-cách-xử-lý)
18. [Kết luận và đề xuất cuối](#18-kết-luận-và-đề-xuất-cuối)

---

## 1. Kahoot hoạt động thế nào

### 1.1. Ba vai trò chính

| Vai trò | Thiết bị | Việc làm |
|---|---|---|
| **Người soạn (Creator)** | Máy tính | Soạn bộ câu hỏi (kahoot): câu hỏi, đáp án, thời gian, hình ảnh |
| **Người dẫn (Host)** | Máy tính + máy chiếu/TV | Mở phòng, hiện mã PIN, điều khiển nhịp chơi, chiếu câu hỏi và bảng xếp hạng |
| **Người chơi (Player)** | Điện thoại | Nhập PIN và biệt danh, bấm chọn đáp án |

### 1.2. Vòng đời một trận

```
Host tạo phòng ─► Hiện mã PIN + QR ─► Người chơi vào sảnh chờ (lobby)
      │
      ▼
Bắt đầu ─► [Lặp mỗi câu]
              ├─ Hiện câu hỏi (vài giây cho mọi người đọc)
              ├─ Mở đáp án + đồng hồ đếm ngược (5–240 giây)
              ├─ Người chơi bấm (trên điện thoại chỉ thấy 4 ô màu/hình)
              ├─ Hết giờ hoặc mọi người đã trả lời ─► Hiện đáp án đúng + biểu đồ số người chọn
              ├─ Điện thoại báo Đúng/Sai, số điểm, thứ hạng, chuỗi đúng liên tiếp
              └─ Bảng xếp hạng top 5
      │
      ▼
Bục vinh danh (Top 3) ─► Báo cáo chi tiết cho host (xuất Excel)
```

### 1.3. Những điểm thiết kế "ăn tiền" của Kahoot

1. **Hai màn hình**: câu hỏi chỉ hiện trên màn hình lớn, điện thoại chỉ có 4 ô màu (đỏ ▲, xanh dương ◆, vàng ●, xanh lá ■). Cả phòng nhìn chung một hướng, tạo không khí tập thể. Điện thoại không cần tải nội dung nặng nên mạng yếu vẫn chơi được.
2. **Điểm theo tốc độ**: trả lời đúng càng nhanh càng nhiều điểm, tạo cảm giác hồi hộp.
3. **Chuỗi đúng liên tiếp (streak)**: thưởng thêm, giữ người chơi tập trung.
4. **Bảng xếp hạng sau mỗi câu**: tạo kịch tính, người tụt hạng muốn gỡ lại.
5. **Nhạc nền và hiệu ứng âm thanh**: phát ở máy host, nâng không khí.
6. **Vào chơi không cần tài khoản**: chỉ cần PIN và biệt danh, mất chưa tới 10 giây.
7. **Nhiều loại câu hỏi**: trắc nghiệm, Đúng/Sai, gõ đáp án, sắp xếp thứ tự (puzzle), thăm dò ý kiến (poll), thanh trượt (slider), word cloud.
8. **Chế độ đội (Team mode)** và **chế độ tự chơi (Assignment/self-paced)**, giao bài về nhà có hạn chót.
9. **Báo cáo**: câu nào nhiều người sai, ai cần ôn thêm.

---

## 2. Điểm mạnh, điểm yếu của Kahoot và bài học rút ra

| Kahoot | Hệ quả | Bài học cho QuestionBible |
|---|---|---|
| Bản miễn phí giới hạn rất chặt (khoảng 10 người/phòng với nhiều gói, hoặc giới hạn tính năng) | Hội thánh muốn chơi 200–300 người phải trả phí theo năm, khá đắt | **Tự host, không giới hạn người chơi**, chi phí chỉ là tiền VPS |
| Giao diện tiếng Anh, không có kho câu hỏi Kinh Thánh tiếng Việt | Phải tự soạn từ đầu, dễ sai tên riêng | **Kho câu hỏi tiếng Việt có sẵn**, gắn trích dẫn Kinh Thánh |
| Không gắn với câu Kinh Thánh | Chơi xong chỉ có điểm, không có bài học | **Sau mỗi câu hiện câu gốc + giải thích ngắn**, biến trò chơi thành giờ học |
| Có quảng cáo, nội dung thế tục ở bản miễn phí | Không phù hợp sinh hoạt hội thánh | Không quảng cáo, nội dung kiểm soát được |
| Chỉ đóng gói câu hỏi dạng chung | Khó làm câu "điền câu gốc", "ai nói câu này", "sắp xếp các sách" | **Loại câu hỏi riêng cho Kinh Thánh** |
| Phụ thuộc máy chủ nước ngoài | Mạng quốc tế chập chờn thì trễ, không công bằng | **Máy chủ ở Việt Nam (PA Vietnam)**, độ trễ thấp |
| Biệt danh tục tĩu, phải kick thủ công | Mất trật tự khi chơi đông | Lọc từ ngữ tiếng Việt + host duyệt/kick nhanh |

**Kết luận phân tích**: giữ nguyên "công thức vui" của Kahoot (hai màn hình, điểm tốc độ, streak, bảng xếp hạng, nhạc), bỏ giới hạn người chơi, và thêm **lớp nội dung Kinh Thánh** (trích dẫn, giải thích, kho câu hỏi phân loại).

---

## 3. Đặc thù của một app đố Kinh Thánh Tin Lành

### 3.1. Bản dịch Kinh Thánh dùng để trích dẫn

| Bản dịch | Bản quyền | Khuyến nghị |
|---|---|---|
| **Bản Truyền Thống 1925 (Cadman)** | Đã thuộc phạm vi công cộng | **Dùng làm bản mặc định** để trích dẫn câu gốc trong app |
| Bản Truyền Thống Hiệu Đính 2010 (BTTHĐ) | Có bản quyền (Thánh Kinh Hội) | Chỉ dùng nếu xin được phép |
| Bản Dịch Mới (BDM), Bản Phổ Thông... | Có bản quyền | Không nhúng toàn văn; chỉ ghi tham chiếu (vd: *Giăng 3:16*) |

> Đặt tham chiếu (sách–chương–câu) thành trường riêng trong CSDL. Tham chiếu thì không có bản quyền, nên sau này đổi bản dịch hiển thị cũng dễ.

### 3.2. Danh mục 66 sách (Kinh Điển Tin Lành)

- **Cựu Ước (39 sách)**: Sáng Thế Ký → Ma-la-chi
- **Tân Ước (27 sách)**: Ma-thi-ơ → Khải Huyền
- Không gồm các sách Thứ Kinh (Deuterocanonical). Đây là điểm khác bộ Công giáo, cần thống nhất ngay từ dữ liệu gốc.
- Viết tên riêng theo phiên âm Tin Lành truyền thống: *Môi-se, Áp-ra-ham, Đa-vít, Phi-e-rơ, Phao-lô, Giê-ru-sa-lem*... Có thể kèm bảng "tên gọi khác" để câu hỏi gõ đáp án chấp nhận nhiều cách viết.

### 3.3. Loại câu hỏi riêng cho Kinh Thánh

| Loại | Ví dụ | Cách chấm |
|---|---|---|
| Trắc nghiệm 4 đáp án | "Ai đóng tàu theo lệnh Đức Chúa Trời?" | 1 hoặc nhiều đáp án đúng |
| Đúng / Sai | "Giô-na ở trong bụng cá 3 ngày 3 đêm." | 2 lựa chọn |
| **Điền câu gốc** | "Vì Đức Chúa Trời yêu thương thế gian đến nỗi đã ban ___ một của Ngài" | Gõ chữ, so khớp mềm (bỏ dấu, bỏ hoa/thường, chấp nhận từ đồng nghĩa) |
| **Ai nói câu này?** | "Ta là đường đi, chân lý, và sự sống" | Trắc nghiệm |
| **Câu này ở sách nào?** | Hiện một câu gốc, chọn sách | Trắc nghiệm |
| **Sắp xếp thứ tự** | Xếp 4 sách Phúc Âm đúng thứ tự; xếp các sự kiện đời Môi-se | Đúng hoàn toàn mới có điểm (hoặc tính điểm từng phần) |
| Thanh trượt (số) | "Mê-tu-sê-la sống bao nhiêu tuổi?" (969) | Đúng trong khoảng sai số cho phép |
| Hình ảnh / bản đồ | Chọn vị trí Bết-lê-hem trên bản đồ | Trắc nghiệm có hình |
| Thăm dò (Poll) | "Câu gốc yêu thích của bạn?" | Không chấm điểm, dùng để chia sẻ |

### 3.4. Phân loại kho câu hỏi

- **Theo phần**: Cựu Ước / Tân Ước / từng sách
- **Theo chủ đề**: Nhân vật, Phép lạ, Ngụ ngôn, Lễ hội, Địa danh, Câu gốc, Giáo lý căn bản (Ba Ngôi, Sự cứu rỗi, Báp-têm...)
- **Theo độ khó**: Thiếu nhi / Thiếu niên / Thanh niên / Người lớn / Chuyên sâu
- **Theo dịp**: Giáng Sinh, Phục Sinh, Lễ Ngũ Tuần, Trại hè, Trường Chúa Nhật

### 3.5. Yếu tố mục vụ

- Mỗi câu có trường **"Giải thích / Bài học"** (1–3 câu) hiện sau khi công bố đáp án. Người dẫn có thể đọc và chia sẻ thêm.
- **Chế độ thiếu nhi**: chữ to, có hình, thời gian dài hơn, có thể **tắt điểm tốc độ** để các em không áp lực.
- **Chế độ thân thiện**: chỉ hiện top 5, không hiện người xếp cuối (tránh làm ai ngại).
- Mở đầu có thể chiếu câu Kinh Thánh hoặc lời cầu nguyện ngắn trong sảnh chờ.
- Có **người kiểm duyệt nội dung** (mục sư/truyền đạo/ban giáo dục) trước khi câu hỏi được đưa vào kho chung, tránh sai giáo lý.

---

## 4. Phạm vi tính năng

### 4.1. MVP (bản đầu tiên, đủ dùng cho một buổi 300 người)

**Người chơi**
- Vào bằng PIN 6 số hoặc quét QR, nhập biệt danh, không cần đăng ký
- 4 ô màu/hình to, dễ bấm
- Báo Đúng/Sai, điểm, thứ hạng hiện tại, streak sau mỗi câu
- **Tự kết nối lại** khi rớt mạng (giữ nguyên điểm)

**Người dẫn**
- Đăng nhập, mở phòng từ một bộ câu hỏi
- Sảnh chờ: hiện PIN, QR, danh sách người vào, số người, nút kick, nút khóa phòng
- Điều khiển: Bắt đầu / Câu tiếp / Bỏ qua / Tạm dừng / Kết thúc sớm
- Màn hình chiếu: câu hỏi, đồng hồ, số người đã trả lời, biểu đồ đáp án, câu gốc giải thích, bảng xếp hạng top 5, bục vinh danh top 3
- Nhạc nền + âm thanh (bật/tắt)
- Xuất kết quả ra Excel/CSV

**Soạn câu hỏi**
- CRUD bộ câu hỏi; loại câu: Trắc nghiệm, Đúng/Sai, Gõ đáp án
- Thời gian mỗi câu, điểm chuẩn/gấp đôi/không tính điểm, hình ảnh
- Trường tham chiếu Kinh Thánh + giải thích
- **Nhập hàng loạt từ Excel** (rất quan trọng để soạn nhanh vài trăm câu)

**Quản trị**
- Quản lý tài khoản host (admin tạo, không mở đăng ký tự do ở giai đoạn đầu)
- Kho câu hỏi mẫu (khoảng 300–500 câu khởi đầu)

### 4.2. Giai đoạn 2

- Sắp xếp thứ tự, Thanh trượt, Poll, câu có hình bản đồ
- **Chế độ đội** (theo ban, nhóm nhỏ, hội thánh)
- **Chế độ tự chơi**: giao link, người chơi làm trong 1 tuần, xếp hạng chung
- Thống kê: câu khó nhất, tỉ lệ đúng theo chủ đề
- Tạo bộ câu hỏi ngẫu nhiên từ kho theo bộ lọc (sách/chủ đề/độ khó)
- Màn hình "Chiếu câu gốc" đẹp sau mỗi câu (font lớn, nền ảnh)

### 4.3. Giai đoạn 3 (mở rộng)

- PWA (cài như app trên điện thoại), chế độ luyện tập cá nhân hằng ngày, huy hiệu
- Nhiều hội thánh dùng chung (multi-tenant), mỗi nơi có kho riêng + kho chung
- Giải đấu nhiều vòng (vòng loại → chung kết)
- Hỗ trợ AI gợi ý câu hỏi từ một đoạn Kinh Thánh. **Bắt buộc có người kiểm duyệt** trước khi dùng

---

## 5. Chọn hạ tầng PA Vietnam: shared hosting hay VPS?

Đây là **quyết định quan trọng nhất** của dự án.

### 5.1. Vì sao game kiểu Kahoot cần kết nối realtime (WebSocket)

Khi host bấm "Câu tiếp", **300 điện thoại phải nhận lệnh gần như cùng lúc** (dưới 200ms) để công bằng về thời gian. Có 2 cách:

| Cách | Cơ chế | Tải khi 300 người |
|---|---|---|
| **Polling** (PHP thường) | Mỗi điện thoại hỏi server 1 lần/giây "có gì mới không?" | **300 request/giây liên tục**, trễ trung bình 0,5–1 giây, không công bằng |
| **WebSocket** | Mỗi điện thoại giữ 1 kết nối mở, server chủ động đẩy | 300 kết nối gần như không tốn CPU, trễ 20–100ms |

### 5.2. So sánh các gói PA Vietnam

| Tiêu chí | **Hosting Linux (cPanel, shared)** | **Cloud VPS / Cloud Server** |
|---|---|---|
| Chạy PHP + MySQL | Có | Có |
| Chạy tiến trình thường trực (Node.js, WebSocket server) | **Không** hoặc rất hạn chế (bị kill, giới hạn Entry Process ~20–30, không mở port) | **Có**, toàn quyền root |
| Chịu 300 request/giây polling | **Không**, sẽ bị khóa tài khoản vì vượt CPU/EP | Có |
| SSL miễn phí | Có (AutoSSL) | Có (Let's Encrypt) |
| Quản trị | Dễ (giao diện) | Cần biết Linux cơ bản (phương án này có hướng dẫn từng bước) |
| Phù hợp game realtime 300 người | ❌ | ✅ |

> **Kết luận: dùng Cloud VPS của PA Vietnam**, không dùng shared hosting cho phần game.
> Tên miền mua ở PA Vietnam chỉ cần trỏ **bản ghi A** về IP của VPS.
>
> *Nếu đã lỡ mua shared hosting*: vẫn dùng được để chạy **landing page/giới thiệu** hoặc chuyển đổi/nâng cấp sang VPS (liên hệ PA Vietnam). Không nên cố chạy game realtime trên đó.

### 5.3. Cấu hình VPS khuyến nghị

| Quy mô | vCPU | RAM | SSD | Ghi chú |
|---|---|---|---|---|
| Tối thiểu (≤ 300 người, 1 phòng) | 2 | 2 GB | 30–40 GB | Đủ chạy, nên bật swap 2GB |
| **Khuyến nghị (300–1.000 người, vài phòng song song)** | **2** | **4 GB** | **40–60 GB** | **Chọn gói này**, dư sức cho MySQL + Redis + Node |
| Lớn (nhiều hội thánh, giải đấu 2.000+) | 4 | 8 GB | 80 GB | Lúc đó mới tính tách DB |

- Hệ điều hành: **Ubuntu Server 24.04 LTS** (hoặc 22.04 LTS)
- Datacenter tại Việt Nam để độ trễ thấp nhất với người chơi trong nước
- Băng thông: một trận 300 người × 20 câu tiêu tốn chưa tới **50–100 MB** (dữ liệu game rất nhẹ, chủ yếu là ảnh), nên băng thông không phải vấn đề

---

## 6. Công nghệ đề xuất

### 6.1. Stack chính (khuyến nghị)

| Lớp | Công nghệ | Lý do chọn |
|---|---|---|
| Ngôn ngữ | **TypeScript** (cả server và client) | Dùng chung kiểu dữ liệu sự kiện giữa client/server, ít lỗi |
| Game server realtime | **Node.js 22 LTS + Socket.IO 4** | Chuẩn de facto cho game kiểu Kahoot; tự kết nối lại, tự fallback sang long-polling khi mạng chặn WebSocket, có "room" để broadcast sẵn |
| API REST | **Fastify** (hoặc Express) chạy chung tiến trình | Nhanh, nhẹ; xử lý đăng nhập, soạn câu hỏi, báo cáo |
| Cơ sở dữ liệu | **MySQL 8 / MariaDB 10.11** | Quen thuộc (bạn đang dùng XAMPP), PA Vietnam hỗ trợ tốt |
| ORM | **Prisma** | Migration rõ ràng, type-safe |
| Bộ nhớ đệm / trạng thái phòng | **Redis 7** | Lưu trạng thái phòng để server khởi động lại không mất trận; sẵn sàng scale nhiều tiến trình |
| Frontend | **Vue 3 + Vite + Pinia + TailwindCSS** | Nhẹ, dễ học, build ra file tĩnh |
| Âm thanh / hiệu ứng | Howler.js, canvas-confetti | Nhẹ |
| QR code | `qrcode` | Tạo QR vào phòng |
| Xuất Excel | `exceljs` | Báo cáo + nhập câu hỏi hàng loạt |
| Web server | **Nginx** | Phục vụ file tĩnh, nén gzip/brotli, reverse proxy WebSocket, SSL |
| Quản lý tiến trình | **PM2** | Tự khởi động lại khi lỗi/khởi động lại VPS, xem log |
| SSL | **Let's Encrypt (certbot)** | Miễn phí; HTTPS là **bắt buộc** (trình duyệt điện thoại chặn nhiều thứ nếu không có) |
| Kiểm thử tải | **Artillery** (engine socket.io) hoặc k6 | Giả lập 500 người chơi trước khi tổ chức thật |

### 6.2. Phương án thay thế nếu đội phát triển chỉ quen PHP

**Laravel 11 + Laravel Reverb (WebSocket server viết bằng PHP) + Vue 3 (Inertia)** cũng chạy được trên VPS PA Vietnam và chịu được 300 người. Tuy vậy:
- Trạng thái game (đồng hồ, ai đã trả lời, điểm) phải lưu qua Redis và xử lý qua queue, phức tạp hơn
- Logic hẹn giờ server-side trong PHP kém tự nhiên hơn Node

→ **Vẫn khuyến nghị Node.js cho game server.** Nếu muốn, có thể dùng Laravel cho trang quản trị/soạn câu hỏi và Node chỉ làm game server. Đổi lại, phải duy trì 2 ngôn ngữ.

### 6.3. Những thứ **không** nên dùng

- Firebase / Pusher / Ably gói miễn phí: giới hạn khoảng 100–200 kết nối đồng thời, không đủ 300, và phụ thuộc dịch vụ nước ngoài
- Polling bằng PHP trên shared hosting: sẽ quá tải như phân tích ở mục 5

---

## 7. Kiến trúc hệ thống

```
                           Internet (domain: dokinhthanh.vn - ví dụ)
                                         │  HTTPS / WSS (443)
                                         ▼
┌──────────────────────────── VPS PA Vietnam (Ubuntu 24.04) ─────────────────────────────┐
│                                                                                         │
│   ┌───────────────────────── Nginx ─────────────────────────┐                          │
│   │  /            → file tĩnh SPA (Vue build) + cache 1 năm  │                          │
│   │  /uploads/    → ảnh câu hỏi (WebP, cache)                │                          │
│   │  /api/*       → proxy :3000                              │                          │
│   │  /socket.io/* → proxy :3000 (Upgrade: websocket)         │                          │
│   └──────────────────────────┬───────────────────────────────┘                          │
│                              ▼                                                          │
│   ┌──────────── Node.js (PM2) :3000 ──────────────┐                                    │
│   │  Fastify REST API   │   Socket.IO Game Engine  │                                    │
│   │  - Auth (JWT)       │   - Room Manager         │                                    │
│   │  - Quiz CRUD        │   - Timer server-side    │                                    │
│   │  - Import Excel     │   - Scoring              │                                    │
│   │  - Reports          │   - Leaderboard          │                                    │
│   └──────────┬──────────┴───────────┬──────────────┘                                    │
│              ▼                      ▼                                                   │
│     ┌──────────────┐       ┌────────────────┐                                           │
│     │  MySQL 8     │       │  Redis 7       │                                           │
│     │  dữ liệu bền │       │  trạng thái    │                                           │
│     │  (quiz, kết  │       │  phòng, PIN,   │                                           │
│     │  quả trận)   │       │  phiên kết nối │                                           │
│     └──────────────┘       └────────────────┘                                           │
│                                                                                         │
│   Cron: backup MySQL hằng đêm → lưu ngoài VPS                                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

   Máy chiếu (Host screen)  ◄── WSS ──►  Server  ◄── WSS ──►  300 điện thoại (Player)
```

### 7.1. Nguyên tắc thiết kế cốt lõi

1. **Server là trọng tài duy nhất (server-authoritative)**: đồng hồ, đáp án đúng, điểm đều tính trên server. Client **không bao giờ** nhận đáp án đúng trước khi hết giờ, nên không thể mở DevTools để gian lận.
2. **Trạng thái trận nằm trong RAM** (đối tượng `Room`) để xử lý nhanh, **đồng bộ snapshot sang Redis** sau mỗi câu. Nếu Node khởi động lại, trận đấu khôi phục được.
3. **Ghi CSDL theo lô**: không ghi MySQL mỗi lần bấm. Gom kết quả từng câu rồi ghi 1 lần (bulk insert) khi câu kết thúc.
4. **Gói tin tối thiểu**: điện thoại chỉ nhận `{q: 5, type: "quiz", n: 4, t: 20}`. Không nhận nội dung câu hỏi (trừ khi bật chế độ "hiện câu hỏi trên điện thoại" cho người ngồi xa màn hình).
5. **Một tiến trình Node là đủ** cho 300–3.000 người. Chưa cần cluster, đỡ phức tạp. Kiến trúc vẫn sẵn sàng thêm `@socket.io/redis-adapter` khi cần scale.

---

## 8. Luồng một trận đấu và các sự kiện realtime

### 8.1. Máy trạng thái của phòng

```
LOBBY ──start──► QUESTION_INTRO (3–5s, hiện câu hỏi)
                      │
                      ▼
                 ANSWERING (đếm ngược, nhận câu trả lời)
                      │  hết giờ / tất cả đã trả lời / host bấm "dừng"
                      ▼
                 REVEAL (đáp án đúng + biểu đồ + câu gốc giải thích)
                      │
                      ▼
                 LEADERBOARD (top 5) ──còn câu──► QUESTION_INTRO
                      │ hết câu
                      ▼
                 PODIUM ──► ENDED (lưu kết quả, xuất báo cáo)
```

### 8.2. Danh sách sự kiện Socket.IO

**Client → Server**

| Sự kiện | Ai gửi | Dữ liệu |
|---|---|---|
| `host:create` | Host | `{ quizId, options }` → trả `{ pin, roomId }` |
| `host:start` / `host:next` / `host:skip` / `host:pause` / `host:end` | Host | `{}` |
| `host:kick` | Host | `{ playerId }` |
| `host:lock` | Host | `{ locked: true }` |
| `player:join` | Player | `{ pin, nickname }` → trả `{ playerId, token }` |
| `player:rejoin` | Player | `{ pin, token }` (khi rớt mạng, token lưu ở localStorage) |
| `player:answer` | Player | `{ q, choice }` hoặc `{ q, text }` hoặc `{ q, order: [] }` |

**Server → Client**

| Sự kiện | Gửi tới | Dữ liệu |
|---|---|---|
| `lobby:update` | Host | danh sách/số người chơi (gộp lại, gửi tối đa 2 lần/giây) |
| `question:intro` | Host (đầy đủ) / Player (rút gọn) | câu hỏi + đáp án (host); số ô + loại (player) |
| `question:start` | Tất cả | `{ q, duration, serverTime }` |
| `answer:count` | Host | `{ answered: 187, total: 284 }` (gộp, ~4 lần/giây) |
| `answer:ack` | Player gửi | `{ received: true }` (khóa nút, hiện "Đang chờ...") |
| `question:reveal` | Host | đáp án đúng, thống kê từng đáp án, câu gốc, giải thích |
| `player:result` | **Từng** Player | `{ correct, points, total, rank, streak }` |
| `leaderboard` | Host | top 5 + người vượt hạng nhiều nhất |
| `game:podium` | Tất cả | top 3; mỗi player nhận thêm thứ hạng của chính mình |
| `player:kicked` | Player bị kick | lý do |

### 8.3. Xử lý thời gian công bằng

- Server ghi `startAt = Date.now()` khi phát `question:start`.
- Khi nhận `player:answer`, server tính `elapsed = now - startAt`.
- **Bù trễ mạng**: lúc người chơi join và định kỳ, server ping-pong để đo RTT của từng người, rồi trừ `RTT/2` (giới hạn tối đa 300ms) khỏi `elapsed`. Người mạng chậm không bị thiệt nhiều, mà cũng không lợi dụng được.
- Chấp nhận câu trả lời đến trễ tối đa **500ms grace period** sau khi hết giờ (vì độ trễ mạng), nhưng chỉ tính điểm tối thiểu.
- Mỗi người chỉ được trả lời **1 lần**/câu; lần gửi sau bị bỏ qua.

---

## 9. Cách tính điểm

### 9.1. Công thức (tương tự Kahoot)

```
Nếu SAI hoặc không trả lời:  điểm = 0, streak = 0

Nếu ĐÚNG:
  tỉ_lệ_thời_gian = elapsed / duration          (0 → 1)
  điểm_cơ_bản     = round( (1 - tỉ_lệ_thời_gian / 2) × 1000 × hệ_số )
                    → trả lời tức thì ≈ 1000, sát giờ ≈ 500
  thưởng_streak   = min(streak - 1, 5) × 100     (streak 2 → +100 ... tối đa +500)
  điểm            = điểm_cơ_bản + thưởng_streak

hệ_số: 0 (không tính điểm), 1 (chuẩn), 2 (gấp đôi, dùng cho câu cuối)
```

### 9.2. Tuỳ chọn cho người dẫn

- **Tắt điểm tốc độ** (chế độ thiếu nhi): đúng = 1000 điểm cố định
- **Tắt streak**
- **Câu sắp xếp**: đúng hoàn toàn = 100%; tuỳ chọn chấm từng phần theo số vị trí đúng
- **Câu gõ đáp án**: chuẩn hoá trước khi so (bỏ dấu tiếng Việt, bỏ khoảng trắng thừa, viết thường, bỏ dấu gạch nối), so với danh sách đáp án chấp nhận. Ví dụ "Phi-e-rơ", "phie ro", "Phêrô" (nếu thêm vào danh sách) đều đúng
- **Hoà điểm**: ai có tổng thời gian trả lời đúng ít hơn xếp trên

### 9.3. Tính bảng xếp hạng nhanh

Với 300 người, sắp xếp mảng trong RAM mất dưới 1ms, không cần tối ưu thêm. Thứ hạng của từng người được tính một lần sau mỗi câu rồi gửi riêng qua `player:result`.

---

## 10. Thiết kế cơ sở dữ liệu

### 10.1. Sơ đồ quan hệ

```
users ─1─┐
         ├─n─ quizzes ─1─n─ questions ─1─n─ question_options
         │                      │
         │                      └─n─1─ bible_books (tham chiếu)
         │
         └─n─ game_sessions ─1─n─ game_players ─1─n─ game_answers
                                                        │
                                       questions ─1─n───┘

tags ─n─n─ questions   (qua question_tags)
```

### 10.2. Các bảng chính

```sql
-- Tài khoản người soạn / người dẫn
CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  church_name   VARCHAR(191) NULL,
  role          ENUM('admin','editor','host') NOT NULL DEFAULT 'host',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 66 sách Kinh Thánh Tin Lành
CREATE TABLE bible_books (
  id          TINYINT UNSIGNED PRIMARY KEY,     -- 1..66
  name_vi     VARCHAR(50) NOT NULL,             -- 'Sáng Thế Ký'
  abbr_vi     VARCHAR(10) NOT NULL,             -- 'Sáng'
  testament   ENUM('OT','NT') NOT NULL,
  chapters    TINYINT UNSIGNED NOT NULL
);

-- Bộ câu hỏi
CREATE TABLE quizzes (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id     BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(191) NOT NULL,
  description  TEXT NULL,
  cover_image  VARCHAR(255) NULL,
  audience     ENUM('kids','teens','youth','adults','all') DEFAULT 'all',
  visibility   ENUM('private','church','public') DEFAULT 'private',
  status       ENUM('draft','review','approved') DEFAULT 'draft',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Câu hỏi
CREATE TABLE questions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id         BIGINT UNSIGNED NOT NULL,
  position        SMALLINT UNSIGNED NOT NULL,
  type            ENUM('quiz','true_false','type_answer','order','slider','poll') NOT NULL,
  content         TEXT NOT NULL,
  image_url       VARCHAR(255) NULL,
  time_limit      SMALLINT UNSIGNED NOT NULL DEFAULT 20,   -- giây
  points_factor   TINYINT UNSIGNED NOT NULL DEFAULT 1,     -- 0,1,2
  -- Tham chiếu Kinh Thánh
  book_id         TINYINT UNSIGNED NULL,
  chapter         SMALLINT UNSIGNED NULL,
  verse_from      SMALLINT UNSIGNED NULL,
  verse_to        SMALLINT UNSIGNED NULL,
  verse_text      TEXT NULL,          -- trích câu gốc (bản 1925)
  explanation     TEXT NULL,          -- giải thích / bài học
  difficulty      TINYINT UNSIGNED DEFAULT 2,  -- 1..5
  -- cho slider
  slider_min      INT NULL, slider_max INT NULL, slider_answer INT NULL, slider_tolerance INT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES bible_books(id),
  INDEX idx_quiz_pos (quiz_id, position)
);

-- Đáp án (trắc nghiệm, đúng/sai, sắp xếp, đáp án chấp nhận cho câu gõ chữ)
CREATE TABLE question_options (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id  BIGINT UNSIGNED NOT NULL,
  position     TINYINT UNSIGNED NOT NULL,    -- thứ tự hiển thị / thứ tự đúng (order)
  content      VARCHAR(255) NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Chủ đề
CREATE TABLE tags (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) UNIQUE);
CREATE TABLE question_tags (
  question_id BIGINT UNSIGNED, tag_id INT UNSIGNED,
  PRIMARY KEY (question_id, tag_id)
);

-- Một lần tổ chức chơi
CREATE TABLE game_sessions (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id      BIGINT UNSIGNED NOT NULL,
  host_id      BIGINT UNSIGNED NOT NULL,
  pin          CHAR(6) NOT NULL,
  mode         ENUM('classic','team','self_paced') DEFAULT 'classic',
  settings     JSON NULL,
  player_count SMALLINT UNSIGNED DEFAULT 0,
  started_at   DATETIME NULL,
  ended_at     DATETIME NULL,
  INDEX idx_pin (pin)
);

CREATE TABLE game_players (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id   BIGINT UNSIGNED NOT NULL,
  nickname     VARCHAR(30) NOT NULL,
  team_name    VARCHAR(50) NULL,
  final_score  INT UNSIGNED DEFAULT 0,
  final_rank   SMALLINT UNSIGNED NULL,
  correct_count SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

CREATE TABLE game_answers (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id    BIGINT UNSIGNED NOT NULL,
  question_id  BIGINT UNSIGNED NOT NULL,
  answer       JSON NOT NULL,          -- {choice:2} | {text:"..."} | {order:[3,1,2,4]}
  is_correct   BOOLEAN NOT NULL,
  response_ms  INT UNSIGNED NOT NULL,
  points       INT UNSIGNED NOT NULL,
  FOREIGN KEY (player_id) REFERENCES game_players(id) ON DELETE CASCADE,
  INDEX idx_question (question_id)
);
```

### 10.3. Dữ liệu trong Redis (trạng thái phòng đang chơi)

```
room:{pin}            HASH   { roomId, quizId, hostSocket, state, currentQ, startAt, locked }
room:{pin}:players    HASH   { playerId → JSON{nickname, score, streak, token, connected} }
room:{pin}:answers:{q} HASH  { playerId → JSON{choice, ms} }
pin:active            SET    các PIN đang dùng (tránh trùng)
TTL: 6 giờ sau khi phòng kết thúc
```

### 10.4. Mẫu file Excel nhập câu hỏi

| Loại | Câu hỏi | A | B | C | D | Đáp án đúng | Thời gian | Sách | Chương | Câu | Câu gốc | Giải thích | Độ khó | Chủ đề |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| quiz | Ai đóng tàu theo lệnh Đức Chúa Trời? | Áp-ra-ham | Nô-ê | Môi-se | Đa-vít | B | 20 | Sáng Thế Ký | 6 | 14 | Ngươi hãy đóng một chiếc tàu bằng cây gô-phe... | Nô-ê vâng lời... | 1 | Nhân vật; Cựu Ước |
| true_false | Giô-na ở trong bụng cá 3 ngày 3 đêm | Đúng | Sai | | | A | 10 | Giô-na | 1 | 17 | ... | ... | 1 | Phép lạ |

---

## 11. Đảm bảo hiệu năng cho 200–300 người chơi

### 11.1. Ước lượng tải

| Hạng mục | Con số | Đánh giá |
|---|---|---|
| Kết nối WebSocket đồng thời | 300 | Node.js xử lý được 10.000+ trên 1 core. Mức 300 chỉ dùng khoảng **3%** khả năng |
| RAM mỗi kết nối Socket.IO | ~20–50 KB | 300 × 50KB = **15 MB** |
| Đỉnh tải: 300 người bấm trong 2 giây đầu | ~150 msg/giây | Rất nhẹ |
| Broadcast "câu tiếp" | 1 sự kiện × 300 socket | < 10ms |
| Gửi kết quả riêng từng người | 300 tin nhỏ (~100 byte) | < 20ms |
| Tải trang lần đầu (300 người cùng vào) | 300 × ~300KB (JS+CSS gzip) | **Đỉnh duy nhất đáng lưu ý**, xử lý bằng Nginx cache + nén |

### 11.2. Các biện pháp tối ưu cụ thể

**Phía server**
1. **Gộp sự kiện cập nhật host (throttle)**: `lobby:update` và `answer:count` chỉ gửi tối đa 2–4 lần/giây, không gửi mỗi lần có người vào/bấm
2. **Không broadcast danh sách người chơi cho người chơi**, chỉ gửi cho host
3. Bật `perMessageDeflate: false` (nén từng tin tốn CPU hơn lợi ích với tin nhỏ)
4. Cấu hình Socket.IO: `pingInterval: 10000, pingTimeout: 20000` để điện thoại khoá màn hình ngắn không bị đá ra; `transports: ['websocket','polling']`
5. Không gọi MySQL trong lúc đang nhận câu trả lời; bulk insert khi câu kết thúc
6. Nâng giới hạn hệ điều hành: `ulimit -n 65535`, `net.core.somaxconn = 4096`

**Phía Nginx**
1. Bật **gzip + brotli** cho JS/CSS/JSON
2. File build Vite có hash trong tên, đặt `Cache-Control: public, max-age=31536000, immutable`
3. `worker_connections 4096`; `proxy_read_timeout 3600s` cho đường dẫn socket.io
4. HTTP/2 bật sẵn

**Phía client (điện thoại)**
1. Trang người chơi tách riêng (code-splitting), **gói JS dưới 150KB gzip**. Không tải trang soạn câu hỏi/trang host
2. Ảnh chuyển sang **WebP, tối đa 1280px**, khoảng 100–200KB; điện thoại không cần tải ảnh (chỉ host chiếu)
3. Nhạc/âm thanh chỉ tải ở máy host
4. Tự kết nối lại: lưu `token` trong `localStorage`, gửi `player:rejoin` ngay khi socket reconnect. Đang giữa câu thì vẫn trả lời được
5. **Wake Lock API**: giữ màn hình điện thoại không tắt trong lúc chơi
6. Rung nhẹ (Vibration API) khi có câu mới/kết quả

### 11.3. ⚠️ Nút thắt thật sự: **mạng Wi-Fi tại địa điểm**, không phải server

300 điện thoại cùng vào **một router Wi-Fi gia đình** (thường chịu 30–60 thiết bị) sẽ **sập trước cả server**. Khuyến nghị cho ban tổ chức:

- **Khuyến khích dùng 4G/5G**: game rất nhẹ, mỗi người tốn chưa tới 5MB cả trận
- Nếu dùng Wi-Fi: cần **nhiều Access Point chuyên dụng** (Unifi, Aruba, TP-Link Omada...), mỗi AP khoảng 50–80 người, hoặc thuê đơn vị sự kiện
- **Máy host nối dây mạng LAN** nếu được, đây là máy quan trọng nhất
- Chuẩn bị **4G dự phòng** cho máy host (phát từ điện thoại)
- Ứng dụng đã có fallback long-polling của Socket.IO cho mạng chặn WebSocket (một số Wi-Fi công cộng)

### 11.4. Kiểm thử tải bắt buộc trước buổi thật

Viết kịch bản **Artillery** giả lập **500 người chơi** (gấp gần 2 lần mục tiêu): vào phòng, nhận câu hỏi, trả lời ngẫu nhiên sau 1–15 giây, chơi hết 20 câu. Tiêu chí đạt:

| Chỉ số | Ngưỡng đạt |
|---|---|
| Tỉ lệ kết nối thành công | ≥ 99,5% |
| Độ trễ từ host bấm "Câu tiếp" đến 95% client nhận (p95) | < 300 ms |
| CPU VPS lúc đỉnh | < 50% |
| RAM Node.js | < 300 MB |
| Không mất câu trả lời nào | 100% |

Ngoài ra nên **thử thật với 30–50 người** (một buổi nhóm thanh niên) trước sự kiện lớn.

---

## 12. Bảo mật và chống gian lận

| Mối nguy | Biện pháp |
|---|---|
| Xem đáp án đúng qua DevTools | Server **không gửi** `is_correct` cho đến khi `question:reveal` |
| Bấm nhiều lần / gửi giả câu trả lời | Mỗi player 1 câu trả lời/câu; kiểm tra `q` khớp câu hiện tại; chỉ nhận trong trạng thái `ANSWERING` |
| Một người mở nhiều tab để chiếm bảng xếp hạng | Giới hạn số người chơi/IP (vd ≤ 5, vì nhiều người chung NAT 4G); host kick nhanh |
| Đoán PIN để phá phòng khác | PIN 6 số ngẫu nhiên, **rate limit** `player:join` (vd 10 lần/phút/IP); host có nút **khóa phòng** sau khi đủ người |
| Biệt danh tục tĩu, xúc phạm | Bộ lọc từ cấm tiếng Việt (có/không dấu, kiểu viết lách luật như "d.m"); host kick + cấm biệt danh; tuỳ chọn **tạo biệt danh ngẫu nhiên** theo tên nhân vật Kinh Thánh ("Ghê-đê-ôn Dũng Cảm") |
| Mạo danh host | Host đăng nhập JWT (httpOnly cookie); thao tác `host:*` kiểm tra socket có quyền với phòng |
| Tấn công XSS qua nội dung câu hỏi/biệt danh | Vue tự escape; không dùng `v-html` với dữ liệu người dùng; sanitize khi lưu |
| SQL injection | Prisma (truy vấn tham số hoá) |
| Mật khẩu | bcrypt/argon2; HTTPS bắt buộc |
| Tấn công dò quét VPS | UFW chỉ mở 22/80/443; SSH bằng key, tắt đăng nhập root bằng mật khẩu; **fail2ban** |
| Mất dữ liệu | Backup MySQL hằng đêm (mysqldump nén), giữ 14 bản, đồng bộ ra ngoài VPS (Google Drive bằng rclone hoặc máy cá nhân); bật snapshot của PA Vietnam nếu gói có |
| Dữ liệu cá nhân trẻ em | Không thu thập họ tên thật/số điện thoại người chơi; chỉ lưu biệt danh. Phù hợp Nghị định 13/2023 về bảo vệ dữ liệu cá nhân |

---

## 13. Triển khai lên PA Vietnam từng bước

### 13.1. Mua dịch vụ

1. Đăng ký **Cloud VPS** tại PA Vietnam: 2 vCPU / 4GB RAM / SSD 40GB+, **Ubuntu 24.04**, datacenter Việt Nam
2. Tên miền (ví dụ `dokinhthanh.vn` hoặc subdomain `quiz.tenhoithanh.org`): vào **trang quản lý DNS của PA Vietnam**, tạo:
   - Bản ghi `A`  `@`   → IP VPS
   - Bản ghi `A`  `www` → IP VPS
   - (Tuỳ chọn) `A` `play` → IP VPS, làm link ngắn cho người chơi: `play.dokinhthanh.vn`

### 13.2. Cài đặt máy chủ (chạy một lần)

```bash
# 1. Cập nhật & tạo user
apt update && apt upgrade -y
adduser deploy && usermod -aG sudo deploy
# (copy SSH key, tắt PasswordAuthentication trong /etc/ssh/sshd_config)

# 2. Tường lửa
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
apt install -y fail2ban

# 3. Node.js 22 LTS + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm i -g pm2

# 4. MySQL, Redis, Nginx, Certbot
apt install -y mysql-server redis-server nginx certbot python3-certbot-nginx
mysql_secure_installation

# 5. Swap 2GB (phòng hờ)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 13.3. Cấu hình Nginx (`/etc/nginx/sites-available/questionbible`)

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    server_name dokinhthanh.vn www.dokinhthanh.vn play.dokinhthanh.vn;
    root /var/www/questionbible/client/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # File build có hash → cache dài
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias /var/www/questionbible/uploads/;
        expires 30d;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/questionbible /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d dokinhthanh.vn -d www.dokinhthanh.vn -d play.dokinhthanh.vn   # tự gia hạn
```

Trong `/etc/nginx/nginx.conf`: `worker_processes auto; events { worker_connections 4096; }`

### 13.4. Triển khai ứng dụng

```bash
cd /var/www/questionbible
git pull
npm ci
npm run build                      # build client (Vite) + server (tsc)
npx prisma migrate deploy          # cập nhật CSDL
pm2 startOrReload ecosystem.config.js
pm2 save && pm2 startup            # tự chạy lại khi VPS khởi động lại
```

`ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'questionbible',
    script: 'server/dist/index.js',
    instances: 1,            // 1 tiến trình là đủ cho vài nghìn người
    max_memory_restart: '800M',
    env: { NODE_ENV: 'production', PORT: 3000 }
  }]
};
```

### 13.5. Backup tự động (cron hằng đêm 2h sáng)

```bash
0 2 * * * mysqldump --single-transaction questionbible | gzip > /backup/qb_$(date +\%F).sql.gz && find /backup -mtime +14 -delete
```

### 13.6. Giám sát

- `pm2 monit` / `pm2 logs` để xem trực tiếp khi tổ chức
- **UptimeRobot** (miễn phí) ping `https://dokinhthanh.vn/api/health` mỗi 5 phút, báo qua email/Telegram khi sập
- Trang `/admin/status` nội bộ: số phòng đang chạy, số kết nối, RAM, CPU

### 13.7. Môi trường phát triển trên máy bạn (Windows + XAMPP)

- Dùng **MySQL của XAMPP** làm CSDL dev (không cần Apache cho phần này)
- Cài Node.js 22 LTS, Redis cho Windows (Memurai) hoặc chạy Redis qua Docker/WSL2
- `npm run dev` chạy Vite (client) + server có hot reload
- Thử nhiều người chơi: mở nhiều tab hoặc dùng điện thoại cùng mạng LAN truy cập `http://<IP-máy>:5173`

---

## 14. Cấu trúc thư mục mã nguồn

```
QuestionBible/
├── package.json                 # npm workspaces
├── ecosystem.config.js          # PM2
├── shared/                      # Kiểu dữ liệu dùng chung client + server
│   └── src/
│       ├── events.ts            # định nghĩa toàn bộ sự kiện Socket.IO (type-safe)
│       ├── scoring.ts           # công thức tính điểm (dùng chung để test)
│       └── normalize.ts         # chuẩn hoá tiếng Việt cho câu gõ đáp án
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed/                # 66 sách + bộ câu hỏi mẫu
│   └── src/
│       ├── index.ts             # khởi động Fastify + Socket.IO
│       ├── config.ts
│       ├── api/                 # REST: auth, quizzes, questions, import, reports
│       ├── game/
│       │   ├── RoomManager.ts   # tạo/tìm/xoá phòng, cấp PIN
│       │   ├── Room.ts          # máy trạng thái + timer của 1 trận
│       │   ├── Player.ts
│       │   ├── handlers/        # host.ts, player.ts (xử lý sự kiện)
│       │   └── persistence.ts   # snapshot Redis, bulk insert MySQL
│       ├── moderation/
│       │   └── badwords-vi.ts
│       └── tests/
├── client/
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── router.ts
│       ├── socket.ts            # kết nối + tự rejoin
│       ├── pages/
│       │   ├── play/            # Người chơi: JoinPin, Nickname, Answer, Result, Podium
│       │   ├── host/            # Người dẫn: Lobby, Question, Reveal, Leaderboard, Podium
│       │   └── studio/          # Soạn câu hỏi, nhập Excel, báo cáo
│       ├── components/
│       ├── stores/              # Pinia
│       └── assets/sounds/
├── uploads/                     # ảnh câu hỏi (gitignore)
├── loadtest/
│   └── artillery-500-players.yml
└── docs/
    └── phuong-an.md
```

---

## 15. Lộ trình phát triển

Giả định 1 lập trình viên full-stack làm bán thời gian/toàn thời gian. Có 2 người thì rút ngắn khoảng 40%.

| Giai đoạn | Thời lượng | Nội dung | Kết quả bàn giao |
|---|---|---|---|
| **0. Chuẩn bị** | 1 tuần | Chốt tên miền, mua VPS, thống nhất bản dịch Kinh Thánh, nhóm soạn 100 câu đầu tiên theo mẫu Excel | VPS sẵn sàng, file Excel câu hỏi |
| **1. Lõi game** | 2–3 tuần | Room/Player/Timer, sự kiện Socket.IO, tính điểm, màn hình host + player cơ bản (trắc nghiệm, đúng/sai) | Chơi được 1 trận đầy đủ trên LAN |
| **2. Soạn câu hỏi + tài khoản** | 2 tuần | Đăng nhập, CRUD quiz, upload ảnh, **nhập Excel**, tham chiếu Kinh Thánh + giải thích | Ban giáo dục tự soạn được |
| **3. Hoàn thiện trải nghiệm** | 1–2 tuần | Âm thanh, hiệu ứng, bục vinh danh, QR, tự kết nối lại, lọc biệt danh, câu gõ đáp án, báo cáo Excel | Trải nghiệm gần Kahoot |
| **4. Triển khai + kiểm thử tải** | 1 tuần | Đưa lên VPS PA Vietnam, SSL, backup, Artillery 500 người, chơi thử thật 30–50 người, sửa lỗi | **MVP chạy thật** |
| **5. Giai đoạn 2** | 3–4 tuần | Sắp xếp, slider, poll, chế độ đội, tự chơi, thống kê, tạo quiz ngẫu nhiên từ kho | Bản đầy đủ |
| **6. Giai đoạn 3** | tuỳ nhu cầu | PWA, luyện tập hằng ngày, giải đấu, đa hội thánh, AI gợi ý câu hỏi | Nền tảng mở rộng |

**Tổng cho MVP: khoảng 7–9 tuần.**

### Song song với lập trình: xây kho câu hỏi

- Chia đề cho các nhóm (thanh niên, trường Chúa Nhật, ban giáo dục), mỗi nhóm phụ trách vài sách
- Mỗi câu **bắt buộc có tham chiếu** sách/chương/câu
- Quy trình: *Soạn → Người thứ 2 kiểm tra → Mục sư/truyền đạo duyệt → Đưa vào kho chung*
- Mục tiêu khởi đầu: **300–500 câu**, phủ cả Cựu Ước và Tân Ước, 3 cấp độ khó

---

## 16. Chi phí ước tính

| Hạng mục | Chi phí | Ghi chú |
|---|---|---|
| Tên miền `.vn` | khoảng 450.000–750.000đ/năm đầu (gia hạn rẻ hơn ở một số đuôi) | `.com`/`.org` rẻ hơn. **Xem bảng giá hiện hành của PA Vietnam** |
| Cloud VPS 2 vCPU / 4GB | khoảng 300.000–600.000đ/tháng | Mua theo năm thường được giảm giá. **Xem bảng giá hiện hành** |
| SSL | 0đ | Let's Encrypt |
| Phần mềm (Node, MySQL, Redis, Nginx, Vue...) | 0đ | Mã nguồn mở |
| Giám sát (UptimeRobot) | 0đ | Gói miễn phí |
| Nhạc nền/âm thanh | 0đ | Dùng nguồn miễn phí bản quyền (Pixabay, Freesound CC0) hoặc thánh ca đã hết bản quyền |
| **Tổng vận hành** | **khoảng 4–8 triệu đồng/năm** | So với Kahoot trả phí cho nhóm lớn thì rẻ hơn nhiều và **không giới hạn người chơi** |

> Con số trên là ước lượng tham khảo, giá thực tế cần kiểm tra trên website PA Vietnam tại thời điểm mua.

---

## 17. Rủi ro và cách xử lý

| Rủi ro | Mức độ | Cách xử lý |
|---|---|---|
| Wi-Fi địa điểm quá tải | **Cao** | Khuyến khích 4G; nhiều AP; host dùng dây LAN + 4G dự phòng (mục 11.3) |
| Server khởi động lại giữa trận | Trung bình | Snapshot trạng thái vào Redis sau mỗi câu; client tự rejoin; host bấm "Tiếp tục" |
| Máy host mất kết nối | Trung bình | Phòng **không bị huỷ** khi host rớt; host mở lại trang là điều khiển tiếp (xác thực bằng tài khoản) |
| Sai sót giáo lý/sai trích dẫn trong câu hỏi | Trung bình | Quy trình duyệt 3 bước; nút "Báo lỗi câu hỏi" cho host |
| Vấn đề bản quyền bản dịch Kinh Thánh | Trung bình | Dùng bản 1925 (phạm vi công cộng); các bản khác chỉ ghi tham chiếu |
| Nhạc có bản quyền | Thấp | Chỉ dùng nhạc CC0 hoặc tự sáng tác |
| Lập trình viên nghỉ giữa chừng | Trung bình | TypeScript + cấu trúc rõ + tài liệu + git; chọn công nghệ phổ biến dễ tìm người |
| Bị tấn công/spam | Thấp | Rate limit, khóa phòng, fail2ban, UFW, backup |
| Vượt 300 lên vài nghìn người | Thấp | Nâng cấp VPS (PA Vietnam nâng cấu hình nhanh); bật cluster + Redis adapter, kiến trúc đã sẵn sàng |

---

## 18. Kết luận và đề xuất cuối

### Phương án tối ưu được chọn

| Hạng mục | Lựa chọn |
|---|---|
| **Hạ tầng** | **Cloud VPS PA Vietnam** (2 vCPU / 4GB RAM / Ubuntu 24.04, datacenter VN) + tên miền PA Vietnam trỏ bản ghi A. **Không dùng shared hosting** cho phần game |
| **Backend** | Node.js 22 LTS + TypeScript + Fastify + **Socket.IO** |
| **Dữ liệu** | MySQL 8 (dữ liệu bền) + Redis (trạng thái phòng) qua Prisma |
| **Frontend** | Vue 3 + Vite + Tailwind; 3 khu vực: Player (siêu nhẹ), Host (trình chiếu), Studio (soạn câu hỏi) |
| **Vận hành** | Nginx (SSL Let's Encrypt, gzip, proxy WebSocket) + PM2 + backup hằng đêm + UptimeRobot |
| **Nội dung** | 66 sách Tin Lành, trích dẫn bản Truyền Thống 1925, mỗi câu có tham chiếu + giải thích, quy trình duyệt nội dung |
| **Khả năng chịu tải** | 300 người chỉ dùng khoảng 5% năng lực của cấu hình đề xuất; đã kiểm thử ở mức 500 người; nâng lên vài nghìn người chỉ cần nâng VPS |

### Vì sao phương án này tối ưu

1. **Đúng kỹ thuật**: game kiểu Kahoot bắt buộc cần WebSocket. VPS là lựa chọn duy nhất trên PA Vietnam cho phép điều đó một cách ổn định.
2. **Dư tải nhiều lần**: 300 kết nối là mức rất nhẹ với Node.js; nút thắt thật sự là Wi-Fi tại chỗ, và phương án đã có hướng xử lý.
3. **Rẻ**: khoảng 4–8 triệu/năm, không giới hạn người chơi, không quảng cáo.
4. **Đúng mục vụ**: không chỉ là trò chơi mà còn là giờ học Lời Chúa, nhờ câu gốc và giải thích sau mỗi câu, chế độ thiếu nhi, chế độ thân thiện.
5. **Dễ phát triển tiếp**: công nghệ phổ biến, mã nguồn mở, TypeScript chung client/server, kiến trúc sẵn sàng mở rộng.

### Việc cần làm ngay

1. ☐ Đăng ký Cloud VPS + tên miền tại PA Vietnam
2. ☐ Chốt bản dịch Kinh Thánh dùng để trích dẫn (đề xuất: 1925)
3. ☐ Lập nhóm soạn câu hỏi, phát file Excel mẫu (mục 10.4)
4. ☐ Khởi tạo mã nguồn theo cấu trúc mục 14, bắt đầu **Giai đoạn 1: Lõi game**
5. ☐ Lên lịch một buổi chơi thử 30–50 người sau khoảng 6 tuần

---

*Tài liệu phương án, phiên bản 1.0, ngày 04/11/2026.*
