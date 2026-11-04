# ĐÁNH GIÁ DỰ ÁN & LỘ TRÌNH PHÁT TRIỂN — QuestionBible

> Ngày đánh giá: 04/11/2026
> Phạm vi: toàn bộ mã nguồn hiện có (`shared/`, `server/`, `client/`, `deploy/`, `loadtest/`), khoảng 9.400 dòng.
> Đã chạy kiểm tra: `npm test` (5/5 pass), `tsc --noEmit` cho server (không lỗi), thử bộ lọc biệt danh với tên tiếng Việt thật.

---

## MỤC LỤC

1. [Tóm tắt đánh giá](#1-tóm-tắt-đánh-giá)
2. [Những gì đã làm tốt](#2-những-gì-đã-làm-tốt)
3. [Lỗi phải sửa trước khi chạy thật](#3-lỗi-phải-sửa-trước-khi-chạy-thật)
4. [Phân tích chuyên sâu: câu hỏi hiển thị thế nào](#4-phân-tích-chuyên-sâu-câu-hỏi-hiển-thị-thế-nào)
5. [Phân tích chuyên sâu: cách soạn câu hỏi tối ưu](#5-phân-tích-chuyên-sâu-cách-soạn-câu-hỏi-tối-ưu)
6. [Phân tích chuyên sâu: khách mời vào không cần đăng nhập, tên tạm, trùng tên](#6-phân-tích-chuyên-sâu-khách-mời-vào-không-cần-đăng-nhập-tên-tạm-trùng-tên)
7. [Các tính năng nên thêm](#7-các-tính-năng-nên-thêm)
8. [Lộ trình (Roadmap)](#8-lộ-trình-roadmap)
9. [Danh sách kiểm tra trước buổi chơi 300 người](#9-danh-sách-kiểm-tra-trước-buổi-chơi-300-người)

---

## 1. Tóm tắt đánh giá

| Hạng mục | Điểm | Nhận xét ngắn |
|---|---|---|
| Kiến trúc tổng thể | **8/10** | Bám sát phương án: server làm trọng tài, Socket.IO, kiểu sự kiện dùng chung giữa client và server, gộp sự kiện cập nhật cho host |
| Logic game / tính điểm | **7/10** | Công thức đúng, có test; còn lỗi ở câu sắp xếp, câu thăm dò và lúc tạm dừng |
| Độ bền khi chạy thật | **4/10** | Một lỗi CSDL có thể làm sập cả server; snapshot Redis chỉ ghi chứ không đọc lại; phòng không bao giờ được dọn |
| Bảo mật | **3/10** | Lộ tài khoản admin demo, thiếu kiểm tra quyền sở hữu ở nhiều API, có thể chiếm phòng của người khác, upload SVG gây XSS |
| Sẵn sàng cho 300 người tại một địa điểm | **3/10** | **Giới hạn theo IP chặn người cùng Wi-Fi**: chỉ 30 người vào được, tối đa 20 lượt vào/phút |
| Trình soạn câu hỏi | **5/10** | Có CRUD và nhập Excel; **chưa có nút tải ảnh**, chưa có video/âm thanh, chưa có kho câu hỏi dùng lại |
| Trải nghiệm người chơi | **7/10** | Vào không cần đăng nhập, tự kết nối lại, rung, giữ màn hình sáng; xử lý trùng tên còn thô |

**Kết luận**: nền móng tốt, đúng hướng. Tuy nhiên **chưa nên dùng cho buổi 300 người** cho đến khi sửa xong 10 lỗi ở mục 3. Ước tính sửa mất khoảng **1–1,5 tuần**.

---

## 2. Những gì đã làm tốt

- **Server làm trọng tài**: đáp án đúng chỉ gửi đi khi công bố (`question:reveal`), mỗi người chỉ được trả lời 1 lần, và câu trả lời chỉ được nhận khi phòng đang ở trạng thái `ANSWERING` ([Room.ts:494](server/src/game/Room.ts#L494)).
- **Kiểu sự kiện dùng chung** cho client và server ([shared/src/events.ts](shared/src/events.ts)) nên khó gửi sai dữ liệu.
- **Gộp sự kiện cập nhật** `lobby:update` (500ms) và `answer:count` (250ms), không làm ngập màn hình host.
- Có thời gian ân hạn 500ms, **bù trễ mạng**, mở đáp án sớm khi mọi người đã trả lời, hoà điểm thì xét theo tổng thời gian trả lời đúng.
- **Kết nối lại bằng token** lưu trong `localStorage`. Người vào muộn vẫn nhận được câu đang chạy.
- Phân tách code: trang người chơi nhẹ, tải lười (lazy) theo route.
- Có sẵn: chuẩn hoá tiếng Việt cho câu gõ đáp án, bảng tên tương đương (Phi-e-rơ = Peter), tạo biệt danh theo nhân vật Kinh Thánh, nhập Excel, xuất báo cáo, kịch bản Artillery, cấu hình Nginx, cấu hình PM2.
- Test lõi chạy được (`npm test`: 5/5 pass), typecheck sạch.

---

## 3. Lỗi phải sửa trước khi chạy thật

### 3.1. Mức P0: chặn sự kiện thật hoặc lỗ hổng bảo mật nghiêm trọng

| # | Vấn đề | Vị trí | Hậu quả | Cách sửa |
|---|---|---|---|---|
| 1 | **Giới hạn 30 người/IP và 20 lượt vào/phút/IP** | [config.ts:17-18](server/src/config.ts#L17-L18), [player.ts:17](server/src/game/handlers/player.ts#L17), [player.ts:33](server/src/game/handlers/player.ts#L33) | 300 người dùng chung Wi-Fi hội trường đi ra **cùng 1 IP công cộng**, nên người thứ 31 bị từ chối, và từ lượt thứ 21 trong phút đầu cũng bị chặn. Mạng 4G (CGNAT) cũng gom nhiều người lạ vào chung IP | Bỏ giới hạn số người/IP. Giới hạn theo **mã thiết bị** (deviceId) thay vì IP. Rate limit theo IP chỉ để chống dò PIN, đặt mức cao (vd 600/phút) và tính **theo số lần sai PIN**, không tính lần vào thành công |
| 2 | **Lộ tài khoản demo admin** (`Admin@123`) ngay trên trang đăng nhập | [LoginPage.vue:26](client/src/pages/LoginPage.vue#L26), seed cố định mật khẩu | Ai cũng đăng nhập được quyền admin | Chỉ hiện nút demo khi `import.meta.env.DEV`. Seed production đọc mật khẩu từ biến môi trường, bắt buộc đổi mật khẩu ở lần đăng nhập đầu |
| 3 | **Thiếu kiểm tra quyền sở hữu (IDOR)** | [questions.ts:33](server/src/api/questions.ts#L33), [:113](server/src/api/questions.ts#L113), [:201](server/src/api/questions.ts#L201), [import.ts:99](server/src/api/import.ts#L99), [reports.ts:82](server/src/api/reports.ts#L82), [:177](server/src/api/reports.ts#L177) | Bất kỳ host nào cũng sửa/xoá câu hỏi, nhập Excel vào bộ đề người khác, xem/xuất báo cáo người khác | Viết hàm `assertCanEditQuiz(user, quizId)` / `assertCanViewSession(...)` dùng chung, gọi ở mọi route |
| 4 | **Chiếm phòng của người khác** | [host.ts:52](server/src/game/handlers/host.ts#L52) `host:rejoin` | Một tài khoản host bất kỳ biết PIN là giành quyền điều khiển phòng đang chạy | Kiểm tra `room.hostId === hostId` (hoặc user là admin) |
| 5 | **Trang trạng thái admin không kiểm tra vai trò** | [reports.ts:24](server/src/api/reports.ts#L24) | Host thường xem được mọi phòng đang chạy | Thêm kiểm tra `role === 'admin'` |
| 6 | **Câu sắp xếp lộ đáp án** | [Room.ts:399-420](server/src/game/Room.ts#L399-L420), [player.ts:161](server/src/game/handlers/player.ts#L161) | Mỗi mục gửi về điện thoại kèm `position` **chính là thứ tự đúng**; người biết mở DevTools sắp theo `position` là xong. Người vào muộn còn nhận danh sách **chưa xáo trộn**, tức là đúng sẵn | Gửi id ngẫu nhiên tạm thời cho mỗi mục (ánh xạ lại trên server), xáo trộn bằng `crypto.randomInt`, dùng cùng một bản xáo trộn cho người vào muộn |
| 7 | **Promise lỗi không ai bắt làm sập server** | [Room.ts:264](server/src/game/Room.ts#L264), [host.ts:126](server/src/game/handlers/host.ts#L126), các chỗ `void room.showPodium()` | Từ Node 15, một promise bị reject mà không ai bắt (vd MySQL mất kết nối 1 giây) sẽ **tắt tiến trình**, nên **mọi phòng đang chơi đều mất** | Bọc `.catch(log)` ở mọi chỗ gọi `void`; thêm `process.on('unhandledRejection')` để ghi log; tách việc ghi CSDL khỏi luồng game (lỗi DB không được chặn game) |
| 8 | **Snapshot Redis chỉ ghi, không bao giờ đọc lại** | [persistence.ts](server/src/game/persistence.ts) (không có hàm khôi phục) | PM2 khởi động lại là mất trận. Phương án hứa "khôi phục được" nhưng code chưa làm | Viết `restoreRoomsFromRedis()` lúc khởi động, lưu đủ dữ liệu (câu hỏi, câu trả lời từng câu, token người chơi, thứ tự xáo trộn) |
| 9 | **Upload cho phép SVG** | [quizzes.ts:337](server/src/api/quizzes.ts#L337) | SVG chứa `<script>` được phục vụ cùng tên miền, gây XSS và có thể đánh cắp token đăng nhập (token đang nằm trong `localStorage`) | Bỏ `.svg`, kiểm tra magic bytes, chuyển mọi ảnh sang WebP bằng `sharp`, xoá EXIF |
| 10 | **Cấu hình production lỏng** | [config.ts:14](server/src/config.ts#L14), [index.ts:66](server/src/index.ts#L66), [index.ts:117](server/src/index.ts#L117), [auth.ts:83](server/src/api/auth.ts#L83) | Thiếu `JWT_SECRET` thì dùng chuỗi cố định nằm trong code; server nghe trên `0.0.0.0` và tin header `X-Forwarded-For` nên ai gọi thẳng cổng 3000 cũng giả được IP; cookie thiếu `secure` | Thiếu `JWT_SECRET` khi production thì không cho khởi động; nghe trên `127.0.0.1`; chỉ tin XFF từ Nginx; cookie `secure: true`; bỏ trả token trong body, chỉ dùng cookie httpOnly |

### 3.2. Mức P1: sai logic hoặc trải nghiệm, nên sửa trong 2 tuần đầu

| # | Vấn đề | Vị trí | Cách sửa |
|---|---|---|---|
| 11 | **Bộ lọc biệt danh chặn nhầm tên thật**. Đã thử: *Đàm Vĩnh Hưng, Minh Đạm, Bé Lớn, Các bạn trẻ, Buổi sáng, Đêm Thánh, Bưởi, Đèo Cả, Vol 2* đều **bị chặn**. Nguyên nhân: `[.+-_]` trong regex là một **dải ký tự** từ `+` tới `_`, chứa luôn cả chữ cái, nên `d?m` khớp với "dam", "dem"...; thêm các mẫu quá ngắn như `lon`, `cac`, `buoi` | [badwords-vi.ts:8](server/src/moderation/badwords-vi.ts#L8) | Viết `[.\-+_]` (escape dấu gạch); so khớp **trên chữ có dấu** cho các từ có nghĩa kép; thêm danh sách trắng (whitelist) tên/họ phổ biến; viết test cho cả 2 chiều: chặn đúng và **không chặn nhầm** |
| 12 | **Trùng bản ghi người chơi trong DB** | [Room.ts:264](server/src/game/Room.ts#L264) và [persistence.ts:191](server/src/game/persistence.ts#L191) | Lúc vào phòng gọi `ensureGamePlayerInMySQL` không chờ kết quả, lúc flush lại gọi lần nữa trong khi `dbPlayerId` còn `null`, nên tạo 2 dòng. Cách sửa: lưu promise vào player (`player.dbReady`) và chờ lại chính promise đó |
| 13 | **Điện thoại vẫn đếm ngược khi host tạm dừng** | [stores/player.ts:83](client/src/stores/player.ts#L83) không nghe `room:paused` | Thêm listener; đồng hồ client nên tính theo `serverTime + duration`, đồng bộ lệch giờ bằng ping, không tự trừ 1 mỗi giây |
| 14 | **Vào lại lúc đang công bố đáp án hoặc bảng xếp hạng thì màn hình trống** | [player.ts:160](server/src/game/handlers/player.ts#L160) chỉ đồng bộ khi đang INTRO hoặc ANSWERING | Gửi lại `player:result` của câu vừa xong, hoặc màn hình "Đang chờ câu tiếp theo" kèm điểm/hạng |
| 15 | **Câu thăm dò (poll) vẫn cộng điểm và streak** | [scoring.ts:109](shared/src/scoring.ts#L109) | Poll luôn 0 điểm, không đụng tới streak và `correctCount` |
| 16 | **Câu sắp xếp chấm từng phần quá dễ**: đúng 1/4 vị trí cũng tính là "đúng", streak tăng; xếp bừa trung bình đã trúng 1 vị trí | [scoring.ts:164](shared/src/scoring.ts#L164) | Chỉ tính "đúng" khi khớp 100%. Nếu chấm từng phần thì chỉ cộng điểm khi đúng ≥ 50% vị trí, không tăng streak |
| 17 | **Phòng không bao giờ được dọn** (`closeRoom` không được gọi ở đâu) | [RoomManager.ts:160](server/src/game/RoomManager.ts#L160) | Hẹn giờ đóng phòng 30 phút sau PODIUM, và đóng phòng LOBBY bỏ trống sau 2 giờ |
| 18 | **`showPodium` chạy được nhiều lần** và phải chờ 300 lệnh UPDATE tuần tự xong mới phát bục vinh danh | [Room.ts:772](server/src/game/Room.ts#L772), [persistence.ts:224](server/src/game/persistence.ts#L224) | Thêm kiểm tra trạng thái; **phát podium trước rồi mới ghi DB**; gộp UPDATE vào 1 transaction |
| 19 | **Redis rớt là không kết nối lại** (`retryStrategy: () => null`) | [persistence.ts:21](server/src/game/persistence.ts#L21) | Bật retry có backoff; khi Redis mất thì chuyển sang chế độ chỉ chạy trên RAM và ghi log cảnh báo |
| 20 | **Sửa câu hỏi sau trận làm sai báo cáo cũ** (báo cáo tham chiếu `questionId` đang sống) | schema `GameAnswer` | Lưu snapshot JSON câu hỏi/đáp án vào `game_sessions` lúc mở phòng |
| 21 | **Tuỳ chọn `friendlyMode` và chế độ `self_paced` có trong kiểu dữ liệu nhưng chưa có tác dụng** | [Room.ts:111](server/src/game/Room.ts#L111) | Triển khai (mục 7), hoặc ẩn khỏi giao diện cho tới khi làm xong |
| 22 | **RTT do client tự báo**, có thể khai gian để được bù tới 300ms | [player.ts:141](server/src/game/handlers/player.ts#L141) | Để server tự đo (server gửi ping, client ack), không tin số liệu client gửi lên |
| 23 | Thứ tự xáo trộn câu sắp xếp **đoán trước được** (công thức cố định) | [Room.ts:409](server/src/game/Room.ts#L409) | Dùng Fisher-Yates với `crypto.randomInt` |
| 24 | Dự án **chưa có git** | thư mục gốc | `git init` ngay, commit theo từng mục sửa lỗi; thư mục `dist/` đã nằm trong `.gitignore` |

---

## 4. Phân tích chuyên sâu: câu hỏi hiển thị thế nào

### 4.1. Nguyên tắc hiển thị (học từ Kahoot)

| Màn hình | Hiển thị | Lý do |
|---|---|---|
| **Màn hình chiếu (host)** | Câu hỏi, media (ảnh/video/âm thanh), 4 đáp án có màu + hình, đồng hồ, số người đã trả lời | Cả phòng nhìn chung, tạo không khí tập thể |
| **Điện thoại (player)** | Mặc định **chỉ có 4 ô màu/hình**. Tuỳ chọn hiện chữ đáp án khi phòng rộng hoặc có người khiếm thị | Gói tin nhẹ, mạng yếu vẫn chơi được, không ai cúi đầu đọc riêng |
| **Video/âm thanh** | **Chỉ phát trên máy host**, không bao giờ phát trên 300 điện thoại | 300 người cùng tải video sẽ làm sập Wi-Fi |

### 4.2. Các dạng nội dung nên hỗ trợ

| Dạng | Dùng cho | Cách làm | Ưu tiên |
|---|---|---|---|
| **Văn bản** | Mọi câu hỏi | Câu hỏi tối đa **120 ký tự**, đáp án tối đa **75 ký tự** (giống giới hạn của Kahoot, đọc kịp trong 3–5 giây). Có đếm ký tự ngay trong trình soạn | Có, cần thêm giới hạn |
| **Ảnh minh hoạ câu hỏi** | Tranh Kinh Thánh, bản đồ, đồ vật (hòm giao ước, áo tế lễ) | Upload, server chuyển sang WebP 1280px; có ô `alt` mô tả ảnh | **Thiếu nút upload trong trình soạn** (API đã có) |
| **Ảnh làm đáp án** | "Đâu là bản đồ xứ Ga-li-lê?", "Đâu là hình Đền Thờ?" | Mỗi đáp án có thể có ảnh thay cho chữ; host hiện lưới 2×2 | Giai đoạn 2 |
| **Ảnh hiện dần** (image reveal) | "Nhân vật/địa danh nào đây?" | Ảnh bị che bằng ô vuông hoặc làm mờ, rõ dần theo đồng hồ; trả lời sớm thì được nhiều điểm hơn | Giai đoạn 3, rất vui với thiếu nhi |
| **Âm thanh** | Đoạn thánh ca ("Bài hát này dựa trên Thi Thiên nào?"), đoạn đọc Kinh Thánh | Upload mp3 ≤ 5MB, có thời điểm bắt đầu/kết thúc, chỉ phát trên host | Giai đoạn 2 |
| **Video** | Cảnh phim Kinh Thánh, video minh hoạ ngắn | **Cách A (khuyên dùng):** link YouTube + giây bắt đầu/kết thúc, nhúng ở host. **Cách B:** upload mp4 ≤ 50MB cho nơi mạng yếu (phục vụ qua Nginx, tải trước lúc vào sảnh) | Giai đoạn 2 |
| **Thẻ câu Kinh Thánh** | Màn hình sau khi công bố đáp án | Khung lớn: câu gốc (bản 1925) + tham chiếu + giải thích, font to, nền dịu. Đã có `ScriptureSpotlightModal`, cần làm thành **một bước riêng trong luồng chơi** để host dừng lại chia sẻ | Có, cần nâng cấp |
| **Bản đồ chọn điểm** (pin answer) | "Chạm vào vị trí Giê-ru-sa-lem" | Ảnh bản đồ cố định, đáp án là vùng tròn (x, y, r); điện thoại hiện bản đồ để chạm | Giai đoạn 3 |

### 4.3. Thời gian đọc nên tự tính theo độ dài

Hiện tại `INTRO_DURATION_MS = 3500` cố định ([Room.ts:52](server/src/game/Room.ts#L52)). Câu dài 120 ký tự kèm ảnh thì 3,5 giây không đủ đọc. Đề xuất:

```
thời_gian_intro = clamp( 2000 + 45ms × số_ký_tự + (có_ảnh ? 1500 : 0), 3000, 9000 )
video/âm thanh: intro = thời lượng đoạn phát (hết đoạn mới mở đáp án)
```

### 4.4. Thay đổi CSDL đề xuất cho media

Hiện `questions.image_url` chỉ có một ảnh. Nên chuyển sang bảng media:

```prisma
model Media {
  id          Int      @id @default(autoincrement())
  ownerId     Int
  kind        MediaKind      // image | audio | video_file | youtube
  url         String  @db.VarChar(500)
  width       Int?
  height      Int?
  durationSec Int?
  altText     String? @db.VarChar(255)
  createdAt   DateTime @default(now())
}

// Question:      mediaId Int?, mediaStartSec Int?, mediaEndSec Int?, revealEffect String?
// QuestionOption: mediaId Int?   (ảnh làm đáp án)
```

Lợi ích: một ảnh dùng lại cho nhiều câu, có thư viện media riêng để chọn lại, dọn được file rác.

### 4.5. Tải trước (preload) để không giật

- Khi host vào sảnh chờ: tải trước **toàn bộ** ảnh/âm thanh của bộ đề vào bộ nhớ trình duyệt, có thanh tiến trình "Đã tải 18/20 media".
- Video YouTube: tạo sẵn player ở câu trước, `cueVideoById` trước 1 câu.
- Nếu có câu dùng video mà mạng host yếu: cảnh báo ngay ở sảnh.

---

## 5. Phân tích chuyên sâu: cách soạn câu hỏi tối ưu

### 5.1. Vấn đề của trình soạn hiện tại

- Câu hỏi **gắn cứng vào 1 bộ đề** (`questions.quiz_id`), không dùng lại được giữa các bộ.
- Chưa có nút tải ảnh, chưa xem trước được câu hỏi trông thế nào trên màn chiếu.
- Gõ câu gốc Kinh Thánh bằng tay nên dễ sai chính tả và tốn thời gian.
- Nhập Excel không có bước xem trước và báo lỗi từng dòng.

### 5.2. Mô hình đề xuất: **Kho câu hỏi + Bộ đề**

```
           ┌──────────── KHO CÂU HỎI (question bank) ────────────┐
           │ Mỗi câu: nội dung, đáp án, media, tham chiếu,       │
           │ độ khó, chủ đề, trạng thái duyệt, người soạn        │
           └──────────────┬──────────────────────────────────────┘
                          │ n – n   (bảng quiz_items: quizId, questionId,
                          │          position, timeLimit?, pointsFactor? ghi đè)
           ┌──────────────▼─────────────┐
           │ BỘ ĐỀ = danh sách câu chọn │ ← chọn tay, hoặc "Tạo ngẫu nhiên 20 câu:
           │ từ kho, sắp xếp, cài đặt   │   Tân Ước, độ khó 2–3, chủ đề Phép lạ"
           └────────────────────────────┘
```

Lợi ích: ban giáo dục soạn một lần, nhiều host dùng lại; sửa lỗi một câu thì mọi bộ đề được cập nhật; thống kê được "câu này đã được chơi 40 lần, 35% đúng" để chỉnh độ khó.

### 5.3. Giao diện soạn kiểu "slide" (như Kahoot)

```
┌──────────┬──────────────────────────────────────┬─────────────────┐
│ Danh sách│   XEM TRƯỚC ĐÚNG NHƯ MÀN CHIẾU        │  Cài đặt câu    │
│ câu (kéo │   ┌──────────────────────────────┐   │  - Loại câu     │
│ thả sắp  │   │ Ai đóng tàu theo lệnh Chúa?  │   │  - Thời gian    │
│ xếp)     │   │        [ảnh]                 │   │  - Điểm x1/x2/0 │
│ 1 ▣      │   │ ▲ Áp-ra-ham   ◆ Nô-ê ✓       │   │  - Tham chiếu   │
│ 2 ▣      │   │ ● Môi-se      ■ Đa-vít       │   │  - Độ khó/Chủ đề│
│ + Thêm   │   └──────────────────────────────┘   │  - Giải thích   │
└──────────┴──────────────────────────────────────┴─────────────────┘
```

Tính năng tăng tốc soạn:
- **Tự lưu** (autosave) sau mỗi 2 giây; có hoàn tác.
- **Nhân bản câu** (Ctrl+D), phím tắt chọn đáp án đúng (1–4).
- **Kiểm tra ngay khi gõ**: thiếu đáp án đúng, quá độ dài, thiếu tham chiếu, đáp án trùng nhau, câu hỏi gần giống một câu đã có trong kho (so sánh chuỗi đã chuẩn hoá).
- Nút **"Xem như người chơi"** mở ra giao diện điện thoại.

### 5.4. Công cụ riêng cho Kinh Thánh (tiết kiệm thời gian nhất)

1. **Nạp sẵn toàn văn Kinh Thánh bản 1925** (phạm vi công cộng) vào bảng `bible_verses(book_id, chapter, verse, text)`, khoảng 31.000 câu, vài MB.
2. **Ô chọn tham chiếu thông minh**: gõ "gi 3 16" thì gợi ý *Giăng 3:16*; kiểm tra số chương/câu có tồn tại; **tự điền câu gốc**.
3. **Tạo câu điền khuyết bằng 1 cú bấm**: chọn câu gốc, bấm vào từ cần ẩn, hệ thống tự tạo câu `type_answer` với đáp án là từ đó, và câu hỏi là câu gốc có `___` thay cho từ đó.
4. **Tạo câu "Câu này ở sách nào?"**: chọn câu gốc, hệ thống tự tạo 3 đáp án nhiễu là các sách cùng thể loại (vd: cùng là sách Phúc Âm).
5. **Tạo câu sắp xếp thứ tự sách**: chọn khoảng sách, hệ thống tự lấy 4 sách và đáp án đúng là thứ tự trong Kinh Thánh.
6. **Trợ lý AI (tuỳ chọn, giai đoạn sau)**: dán một đoạn Kinh Thánh, AI gợi ý 5–10 câu nháp, các câu này **bắt buộc vào trạng thái "Chờ duyệt"**, người soạn phải xem lại từng câu.

### 5.5. Nhập Excel tốt hơn

- Tải lên → **bảng xem trước** → các dòng lỗi được tô đỏ kèm lý do ("Dòng 14: thiếu đáp án đúng", "Dòng 22: sách 'Giăng 1' không tồn tại, ý bạn là '1 Giăng'?") → chỉ nhập các dòng hợp lệ.
- Hỗ trợ cột `Ảnh` (tên file trong một file .zip gửi kèm, hoặc URL).
- Cung cấp **mẫu Google Sheets** để nhiều người soạn song song, rồi xuất ra .xlsx.

### 5.6. Quy trình duyệt nội dung

```
Nháp ─► Gửi duyệt ─► Người duyệt (editor/mục sư) ─► Đã duyệt (vào kho chung)
                              │
                              └─► Trả lại kèm góp ý (comment trên từng câu)
```

- Duyệt **từng câu**, không chỉ cả bộ đề.
- Nút **"Báo lỗi câu hỏi"** cho host sau trận, đưa vào hàng đợi cho editor.
- Lưu lịch sử sửa đổi (ai sửa, lúc nào).

---

## 6. Phân tích chuyên sâu: khách mời vào không cần đăng nhập, tên tạm, trùng tên

### 6.1. Trả lời ngắn

**Có, khách mời vào chơi mà không cần đăng nhập**, và nên luôn giữ như vậy. Code hiện tại đã làm đúng điều này: chỉ cần PIN và biệt danh. Phần cần làm thêm là **xử lý tên và nhận diện thiết bị**.

### 6.2. Luồng vào phòng đề xuất (dưới 10 giây)

```
Quét QR trên màn chiếu  ─►  play.tenmien.vn/123456  (PIN đã điền sẵn)
            │
            ▼
   Nhập biệt danh  [______________]  [🎲 Tên ngẫu nhiên]
   (gợi ý sẵn tên lần trước trên máy này)
            │
            ▼
   (Chế độ đội) chọn đội ── hoặc được chia tự động
            │
            ▼
   Sảnh chờ: "Chào Phước! Nhìn lên màn hình nhé 👀"
```

- **QR phải chứa sẵn PIN**, người chơi chỉ còn nhập tên.
- Có trang ngắn `play.tenmien.vn` cho người không quét được QR.

### 6.3. Nhận diện thiết bị (deviceId): nền tảng cho mọi xử lý bên dưới

Lần đầu mở trang, tạo một `deviceId` ngẫu nhiên và lưu vào `localStorage`. ID này **không phải thông tin cá nhân**, chỉ để:

| Việc | Hiện tại | Đề xuất |
|---|---|---|
| Kết nối lại | Token theo từng trận (có rồi) | Giữ nguyên, thêm `deviceId` để nhận lại khi token mất |
| Mở 2 tab / vào lại bằng tên khác | Được phép | Một `deviceId` chỉ giữ 1 chỗ trong phòng; vào lại thì **nối vào chỗ cũ** |
| Kick / cấm | Cấm theo **biệt danh**: đổi tên là vào lại được | Cấm theo `deviceId` (+ biệt danh); host chọn "Mời ra" (vào lại được) hoặc "Cấm" |
| Giới hạn số người | Theo IP (**sai**, xem lỗi #1) | Theo thiết bị |

> Người cố tình xoá `localStorage` hoặc mở tab ẩn danh vẫn lách được, nhưng trong buổi sinh hoạt hội thánh mức bảo vệ này là đủ. Host vẫn có nút kick và khoá phòng.

### 6.4. Xử lý trùng tên

**Hiện tại**: so trùng kiểu không phân biệt hoa/thường; trùng thì báo lỗi "chọn tên khác" ([Room.ts:233](server/src/game/Room.ts#L233)). Vấn đề:
- "Phước", "Phuoc", "phước  " bị xem là **khác nhau**, nên trên bảng xếp hạng nhìn như trùng.
- Người chơi bị từ chối không biết nên đổi thành gì, nên nhiều em nhỏ bỏ cuộc.
- Người rớt mạng, mất token (vd đổi trình duyệt) thì **không lấy lại được tên mình**.

**Đề xuất xử lý theo thứ tự:**

```
Người chơi nhập "Phước"
   │
   ├─ Chuẩn hoá để so sánh: bỏ dấu, viết thường, gộp khoảng trắng, bỏ ký tự vô hình
   │  (zero-width), đổi ký tự giả dạng (Cyrillic "о" → "o")  →  "phuoc"
   │
   ├─ Không trùng                                  → vào phòng
   │
   ├─ Trùng với CHÍNH thiết bị này (cùng deviceId)  → nối lại chỗ cũ, giữ điểm
   │
   ├─ Trùng với người đang mất kết nối, khác thiết bị → KHÔNG cho giành tên
   │  (tránh mạo danh để cướp điểm). Host có nút "Gộp/chuyển chỗ" nếu cần
   │
   └─ Trùng với người đang chơi
        → Server tự gợi ý 3 lựa chọn, bấm 1 lần là vào:
          [Phước 2]   [Phước Trung Tín]   [Phước 🐑]
          hoặc tự nhập tên khác
```

Ngoài ra:
- **Hiển thị**: nếu 2 tên khác nhau nhưng nhìn giống nhau thì màn hình host thêm hậu tố nhỏ `#2`.
- **Độ dài**: 2–**20** ký tự hiển thị (30 là quá dài cho bảng xếp hạng trên máy chiếu).
- **Emoji**: cho phép tối đa 2 emoji; cấm ký tự điều khiển, chữ xếp chồng (zalgo).

### 6.5. Tên tạm và các chế độ đặt tên (host chọn khi mở phòng)

| Chế độ | Mô tả | Dùng khi |
|---|---|---|
| **Tự do** (mặc định) | Tự nhập + lọc từ cấm + nút 🎲 | Thanh niên, sinh hoạt chung |
| **Tên ngẫu nhiên bắt buộc** | Hệ thống cấp tên "Ghê-đê-ôn Dũng Cảm 42", được bấm đổi tối đa 3 lần | Thiếu nhi, sự kiện đông người lạ, tránh hoàn toàn tên xấu |
| **Tên thật + nhóm/lớp** | 2 ô: Họ tên, Lớp/Ban (vd "Lớp Ê-xơ-tê") | Trường Chúa Nhật, cần biết ai làm bài để chấm |
| **Duyệt tên** | Tên hiện ở màn host với trạng thái chờ duyệt; host bấm ✓ / ✗ (có nút "Duyệt tất cả") | Buổi có khách lạ, livestream |

Host còn có thể **đổi tên** một người chơi thay vì kick (vd đổi tên không phù hợp thành "Người chơi 17"). Việc này nhẹ nhàng hơn với các em nhỏ.

### 6.6. Sửa bộ lọc từ cấm (bắt buộc, xem lỗi #11)

- Sửa regex `[.+-_]` thành `[.\-+_]`.
- Chia làm 2 nhóm:
  - **Nhóm từ tục rõ ràng**: so khớp trên chuỗi bỏ dấu, có xét kiểu viết lách luật (`d.m`, `đ*o`).
  - **Nhóm từ có nghĩa kép trong tiếng Việt** (lớn/lồn, các/cặc, buổi/buồi, đèo/đéo, đàm/...): **chỉ so trên chữ có dấu**, không so trên chữ đã bỏ dấu.
- **Whitelist** họ và tên lót phổ biến (Đàm, Đạm, Lớn, Bưởi...).
- Test: 200 tên thật phải **qua được**, 50 biến thể từ tục phải **bị chặn**.
- Thêm "từ cấm tuỳ chỉnh" cho từng hội thánh.

### 6.7. Khi nào mới cần người chơi đăng nhập?

Chỉ khi có **chế độ luyện tập cá nhân, bảng xếp hạng cả mùa, huy hiệu** (giai đoạn 4). Khi đó đăng nhập là **tuỳ chọn**: dùng Google/Zalo, hoặc "mã cá nhân" 6 ký tự do thầy cô cấp cho thiếu nhi. Chơi trực tiếp vẫn không bắt buộc đăng nhập. Với trẻ em, cần xin đồng ý của phụ huynh theo **Nghị định 13/2023**.

---

## 7. Các tính năng nên thêm

### 7.1. Cho người dẫn (host)

| Tính năng | Giá trị | Ưu tiên |
|---|---|---|
| **Điều khiển bằng điện thoại** (remote): laptop chiếu, điện thoại bấm Tiếp/Tạm dừng/Kick | Người dẫn đứng trên bục, không phải chạy về laptop. **Rất hữu ích ở nhà thờ** | Cao |
| **Tách màn chiếu và bảng điều khiển** (presenter view): một cửa sổ sạch cho máy chiếu, một cửa sổ có ghi chú, đáp án, số người | Không lộ đáp án lên máy chiếu khi thao tác | Cao |
| Ghi chú cho người dẫn trên từng câu (điều muốn chia sẻ) | Biến trò chơi thành giờ học | Cao |
| Bước "Chia sẻ Lời Chúa" sau mỗi câu (thẻ câu gốc toàn màn hình) | Mục vụ | Cao |
| Chế độ thân thiện (`friendlyMode`) **thực sự hoạt động**: điện thoại chỉ báo "Bạn trong top 10" hoặc "Cố lên!" thay vì "hạng 287/300" | Tránh làm các em xếp cuối ngại | Trung bình |
| Tự động chạy (auto-advance) sau N giây | Một người vừa dẫn vừa lo kỹ thuật | Trung bình |
| Bảng hiện người chơi rớt mạng / chưa trả lời | Biết ai cần giúp | Trung bình |
| Chiếu bảng xếp hạng đội trực tiếp | Chế độ đội hấp dẫn hơn | Trung bình |
| Giấy khen PDF cho top 3 / cả đội | Trao thưởng tại chỗ | Thấp |

### 7.2. Cho người chơi

| Tính năng | Ưu tiên |
|---|---|
| Hiện chữ đáp án trên điện thoại (bật mặc định khi phòng có trên 100 người, vì người ngồi cuối khó nhìn màn chiếu) | Cao |
| Đồng hồ đồng bộ với server, không lệch (lỗi #13) | Cao |
| Màn hình kết quả cá nhân cuối trận: số câu đúng, các câu sai kèm câu gốc để ôn | Cao |
| Chữ to / tương phản cao / hỗ trợ trình đọc màn hình | Trung bình |
| PWA: thêm vào màn hình chính, tải nhanh lần sau | Trung bình |
| Chế độ khán giả (chỉ xem, không chơi) cho livestream | Thấp |

### 7.3. Chế độ chơi

| Chế độ | Mô tả | Ưu tiên |
|---|---|---|
| **Tự chơi theo hạn** (`self_paced`, đã có trong enum, chưa làm) | Giao link cho cả tuần, câu hỏi hiện ngay trên điện thoại, xếp hạng chung | Cao: phục vụ học Kinh Thánh hằng tuần |
| Đội nâng cao | Chọn đội khi vào, đội trưởng, chia đều theo số người | Trung bình |
| Giải đấu nhiều vòng | Vòng loại theo hội thánh, rồi chung kết | Thấp |
| Luyện tập cá nhân hằng ngày ("Câu đố mỗi ngày") | Giữ người dùng quay lại | Thấp |

### 7.4. Vận hành và hạ tầng

| Tính năng | Ưu tiên |
|---|---|
| Khôi phục phòng từ Redis khi khởi động lại (lỗi #8) | Cao |
| Ghi log có cấu trúc + cảnh báo qua Telegram khi lỗi/CPU cao | Cao |
| Trang `/api/health` kiểm tra cả MySQL và Redis | Cao |
| Prisma **migrate** thay cho `db push` khi lên production | Cao |
| CI: chạy test + typecheck + build mỗi lần push | Trung bình |
| Kịch bản Artillery mô phỏng **300 người từ cùng 1 IP** (giống Wi-Fi hội trường) | Cao: nếu chạy kịch bản này sẽ thấy ngay lỗi #1 |
| Nhiều hội thánh dùng chung (multi-tenant) | Thấp |

---

## 8. Lộ trình (Roadmap)

> Giả định 1 lập trình viên full-stack. Có 2 người thì rút ngắn khoảng 40%.
> Mỗi giai đoạn có **tiêu chí hoàn thành** rõ ràng, chưa đạt thì chưa sang giai đoạn sau.

### Giai đoạn 0: An toàn và sẵn sàng chạy thật (tuần 1–2) 🔴

**Mục tiêu**: tổ chức được một buổi 300 người mà không bị sập, không bị chiếm quyền.

- [ ] `git init`, commit trạng thái hiện tại
- [ ] Lỗi #1: bỏ giới hạn theo IP, thêm `deviceId`, rate limit theo số lần sai PIN
- [ ] Lỗi #2: ẩn tài khoản demo ở production, seed đọc mật khẩu từ biến môi trường
- [ ] Lỗi #3, #4, #5: lớp kiểm tra quyền dùng chung cho mọi route và `host:rejoin`
- [ ] Lỗi #6, #23: xáo trộn an toàn, dùng id tạm cho câu sắp xếp
- [ ] Lỗi #7: bắt mọi promise lỗi, lỗi DB không được làm dừng game
- [ ] Lỗi #9: bỏ SVG, chuyển ảnh sang WebP bằng `sharp`
- [ ] Lỗi #10: cấu hình production (JWT secret bắt buộc, nghe trên 127.0.0.1, cookie secure, chỉ tin XFF từ Nginx)
- [ ] Lỗi #11: sửa bộ lọc biệt danh, thêm test cho cả 2 chiều
- [ ] Lỗi #12, #13, #14, #15, #16, #18: sửa logic game
- [ ] Viết test tích hợp Socket.IO: vào phòng, trả lời, rớt mạng, vào lại, kick, tạm dừng

**Tiêu chí hoàn thành**: Artillery 500 người **từ cùng 1 IP** đều vào được, p95 trễ < 300ms, không mất câu trả lời nào; tắt MySQL 10 giây giữa trận thì game vẫn chạy; tài khoản host A không sửa được gì của host B.

### Giai đoạn 1: Bền vững và vận hành (tuần 3) 🟠

- [ ] Lỗi #8: khôi phục phòng từ Redis (kill PM2 giữa câu 5 rồi chơi tiếp từ câu 5)
- [ ] Lỗi #17, #19: dọn phòng cũ, Redis tự kết nối lại
- [ ] Lỗi #20: snapshot câu hỏi vào phiên chơi
- [ ] Lỗi #22: server tự đo RTT
- [ ] Health check đầy đủ, log có cấu trúc, cảnh báo Telegram
- [ ] Chuyển sang `prisma migrate`, viết script deploy một lệnh, backup đã thử khôi phục thật
- [ ] **Chơi thử thật 30–50 người** (một buổi nhóm thanh niên), ghi lại mọi vấn đề

**Tiêu chí hoàn thành**: buổi chơi thử không có sự cố nghiêm trọng; khởi động lại server giữa trận không mất dữ liệu.

### Giai đoạn 2: Khách mời và trải nghiệm người chơi (tuần 4–5) 🟡

- [ ] Link/QR có sẵn PIN (`/play/123456`), trang `play.` ngắn gọn
- [ ] Luồng xử lý trùng tên đầy đủ (mục 6.4): chuẩn hoá, gợi ý 3 tên, nhận lại chỗ cũ bằng `deviceId`
- [ ] 4 chế độ đặt tên (mục 6.5), host đổi tên/duyệt tên, kick hoặc cấm theo thiết bị
- [ ] `friendlyMode` hoạt động thật
- [ ] Hiện chữ đáp án trên điện thoại, tự bật khi trên 100 người
- [ ] Màn hình kết quả cá nhân và ôn lại câu sai
- [ ] Điều khiển bằng điện thoại (remote) và tách màn chiếu / bảng điều khiển
- [ ] Thời gian intro tự tính theo độ dài câu (mục 4.3)

**Tiêu chí hoàn thành**: 10 người dùng thử (có cả thiếu nhi và người lớn tuổi) đều tự vào được trong dưới 15 giây mà không cần ai hướng dẫn.

### Giai đoạn 3: Media và trình soạn câu hỏi mới (tuần 6–8) 🟢

- [ ] Bảng `Media` + thư viện media, upload ảnh/âm thanh/mp4, nhúng YouTube có giây bắt đầu/kết thúc
- [ ] Ảnh làm đáp án; preload toàn bộ media ở sảnh chờ
- [ ] Trình soạn kiểu slide: xem trước giống màn chiếu, kéo thả, tự lưu, phím tắt, kiểm tra ngay khi gõ
- [ ] Giới hạn 120/75 ký tự, có đếm ký tự
- [ ] Nhập Excel có bước xem trước và báo lỗi từng dòng; mẫu Google Sheets
- [ ] Bước "Chia sẻ Lời Chúa" và ghi chú cho người dẫn

**Tiêu chí hoàn thành**: một editor soạn 20 câu có ảnh trong **dưới 30 phút**.

### Giai đoạn 4: Kho câu hỏi và công cụ Kinh Thánh (tuần 9–11) 🔵

- [ ] Tách **Kho câu hỏi** và **Bộ đề** (bảng `quiz_items` n–n), migrate dữ liệu cũ
- [ ] Nạp Kinh Thánh 1925 vào `bible_verses`, ô chọn tham chiếu thông minh, tự điền câu gốc
- [ ] Tạo câu điền khuyết, "Câu này ở sách nào?", sắp xếp sách chỉ với 1 cú bấm
- [ ] Tạo bộ đề ngẫu nhiên theo bộ lọc (sách/chủ đề/độ khó)
- [ ] Duyệt từng câu, góp ý, nút "Báo lỗi câu hỏi", lịch sử sửa đổi
- [ ] Thống kê độ khó thực tế của từng câu (tỉ lệ đúng qua các trận)
- [ ] Nhóm soạn đạt **500 câu đã duyệt**

### Giai đoạn 5: Mở rộng (tuần 12 trở đi) 🟣

- [ ] Chế độ tự chơi theo hạn (`self_paced`)
- [ ] Chế độ đội nâng cao, giải đấu nhiều vòng
- [ ] Ảnh hiện dần, chọn điểm trên bản đồ
- [ ] PWA, "Câu đố mỗi ngày", tài khoản người chơi tuỳ chọn, huy hiệu
- [ ] Nhiều hội thánh dùng chung, mỗi nơi có kho riêng và kho chung
- [ ] Trợ lý AI gợi ý câu hỏi (bắt buộc duyệt)
- [ ] Giấy khen PDF, CI/CD

### Tổng quan thời gian

```
Tuần:   1   2   3   4   5   6   7   8   9  10  11  12+
GĐ0   ████████                                          An toàn, sẵn sàng chạy thật
GĐ1           ████                                      Bền vững + chơi thử 50 người
GĐ2               ████████                              Khách mời & trải nghiệm
GĐ3                       ████████████                  Media & trình soạn
GĐ4                                   ████████████      Kho câu hỏi & công cụ Kinh Thánh
GĐ5                                               ████► Mở rộng
                  ▲
                  └─ Sau tuần 3: đủ an toàn cho buổi 300 người (với câu hỏi văn bản/ảnh)
```

---

## 9. Danh sách kiểm tra trước buổi chơi 300 người

**1 tuần trước**
- [ ] Đã xong Giai đoạn 0 và 1
- [ ] Chạy Artillery 500 người trên chính VPS production, mô phỏng cùng 1 IP
- [ ] Bộ đề đã duyệt, đã chơi thử toàn bộ, media tải được
- [ ] Backup CSDL, có ghi chú cách khôi phục

**Tại địa điểm**
- [ ] Kiểm tra Wi-Fi: số Access Point, hoặc thông báo cho mọi người dùng 4G
- [ ] Máy host cắm dây mạng LAN, có 4G dự phòng
- [ ] Mở `pm2 monit` trên một máy khác để theo dõi
- [ ] Màn chiếu: QR to, PIN to, đường dẫn ngắn
- [ ] Một người hỗ trợ kỹ thuật riêng, không kiêm người dẫn

**Ngay sau buổi**
- [ ] Xuất báo cáo, ghi lại sự cố, đưa vào hàng đợi sửa lỗi
