import { io } from 'socket.io-client';
import assert from 'node:assert/strict';

const SERVER_URL = 'http://127.0.0.1:3000';
const SHARED_CHURCH_WIFI_IP = '113.161.72.100';
const TOTAL_PLAYERS = 300;

async function main() {
  console.log(`🚀 Bắt đầu kiểm thử thực tế ${TOTAL_PLAYERS} người chơi cùng 1 địa chỉ IP Wi-Fi (${SHARED_CHURCH_WIFI_IP})...`);

  // 1. Đăng nhập tài khoản Host chính
  const hostLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'host@questionbible.vn', password: 'Host@123' })
  }).then((r) => r.json());

  // 2. Đăng nhập tài khoản khác để kiểm thử chống chiếm phòng (Sửa lỗi #4)
  const otherLogin = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'giaoduc@questionbible.vn', password: 'Editor@123' })
  }).then((r) => r.json());

  const hostSocket = io(SERVER_URL, {
    auth: { token: hostLogin.token },
    transports: ['websocket']
  });
  await new Promise((r) => hostSocket.on('connect', r));

  const createRes = await new Promise((resolve) =>
    hostSocket.emit('host:create', { quizId: 3 }, resolve)
  );
  assert.equal(createRes.ok, true, 'Host mở phòng thành công');
  const pin = createRes.pin;
  console.log(`✅ Đã mở phòng PIN: ${pin} (${createRes.totalQuestions} câu hỏi)`);

  // 3. Kiểm thử chống chiếm phòng (#4): tài khoản khác thử host:rejoin vào PIN này phải bị từ chối
  const attackerSocket = io(SERVER_URL, {
    auth: { token: otherLogin.token },
    transports: ['websocket']
  });
  await new Promise((r) => attackerSocket.on('connect', r));
  const hijackAttempt = await new Promise((resolve) =>
    attackerSocket.emit('host:rejoin', { pin }, resolve)
  );
  assert.equal(hijackAttempt.ok, false, 'Phải chặn tài khoản khác chiếm quyền điều khiển phòng');
  console.log(`🔒 Kiểm thử chống chiếm phòng (#4): Đã chặn thành công (${hijackAttempt.error})`);
  attackerSocket.disconnect();

  // 4. Cho 300 người chơi từ CÙNG 1 IP Wi-Fi (113.161.72.100) vào phòng cùng lúc!
  const joinStartMs = Date.now();
  const playerSockets = [];
  const joinResults = await Promise.all(
    Array.from({ length: TOTAL_PLAYERS }, async (_, idx) => {
      const sock = io(SERVER_URL, {
        transports: ['websocket'],
        extraHeaders: {
          'x-forwarded-for': SHARED_CHURCH_WIFI_IP
        }
      });
      playerSockets.push(sock);
      await new Promise((r) => sock.on('connect', r));

      return new Promise((resolve) => {
        sock.emit(
          'player:join',
          {
            pin,
            nickname: `TínHữu_${idx + 1}`,
            deviceId: `wifi-device-${idx + 1}`
          },
          resolve
        );
      });
    })
  );

  const joinElapsedMs = Date.now() - joinStartMs;
  const successCount = joinResults.filter((r) => r.ok).length;
  console.log(
    `📶 Kết quả vào phòng cùng 1 IP Wi-Fi: ${successCount}/${TOTAL_PLAYERS} người thành công trong ${joinElapsedMs}ms!`
  );
  assert.equal(
    successCount,
    TOTAL_PLAYERS,
    `Toàn bộ ${TOTAL_PLAYERS} người chơi cùng IP Wi-Fi phải vào phòng thành công`
  );

  // 5. Kiểm thử trùng tên từ thiết bị mới -> phải trả về 3 tên gợi ý (Mục 6.4 roadmaps.md)
  const dupSocket = io(SERVER_URL, {
    transports: ['websocket'],
    extraHeaders: { 'x-forwarded-for': SHARED_CHURCH_WIFI_IP }
  });
  await new Promise((r) => dupSocket.on('connect', r));
  const dupRes = await new Promise((resolve) =>
    dupSocket.emit(
      'player:join',
      { pin, nickname: 'TínHữu_1', deviceId: 'new-device-999' },
      resolve
    )
  );
  assert.equal(dupRes.ok, false);
  assert.equal(Array.isArray(dupRes.suggestions) && dupRes.suggestions.length === 3, true);
  console.log(`💡 Kiểm thử trùng tên (Mục 6.4): Tự động gợi ý 3 tên -> [${dupRes.suggestions.join(', ')}]`);
  dupSocket.disconnect();

  // 6. Chạy 1 câu hỏi cho cả 300 người cùng bấm trả lời và đo độ trễ
  const questionStartPromise = new Promise((resolve) =>
    hostSocket.once('question:start', resolve)
  );
  hostSocket.on('question:intro', () => {
    hostSocket.emit('host:skip', { pin });
  });

  hostSocket.emit('host:start', { pin });
  const qStart = await questionStartPromise;

  const answerStartMs = Date.now();
  const answerAcks = await Promise.all(
    playerSockets.map(
      (sock, idx) =>
        new Promise((resolve) => {
          sock.emit(
            'player:answer',
            { q: qStart.q, choice: idx % 4 },
            resolve
          );
        })
    )
  );
  const answerElapsedMs = Date.now() - answerStartMs;
  const ackedCount = answerAcks.filter((a) => a?.received).length;
  console.log(
    `⚡ 300 người chơi gửi câu trả lời đồng thời: ${ackedCount}/${TOTAL_PLAYERS} được ghi nhận trong ${answerElapsedMs}ms!`
  );
  assert.equal(ackedCount, TOTAL_PLAYERS);

  // Kết thúc sớm để kiểm tra tốc độ phát Bục Vinh Danh (Sửa lỗi #18)
  const podiumStartMs = Date.now();
  const podiumPromise = new Promise((resolve) => hostSocket.once('game:podium', resolve));
  hostSocket.emit('host:end', { pin });
  const podium = await podiumPromise;
  const podiumLatencyMs = Date.now() - podiumStartMs;

  console.log(
    `🏆 Bục vinh danh phát tới Host & 300 người chơi trong ${podiumLatencyMs}ms (Quán quân: ${podium.top3[0].nickname} - ${podium.top3[0].score} đ)`
  );

  for (const s of playerSockets) s.disconnect();
  hostSocket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});

