/**
 * Kiểm thử 4 tính năng: điện thoại điều khiển + màn chiếu, bước "Chia sẻ Lời Chúa",
 * màn xem lại cá nhân, đồng hồ theo giờ server (endsAt).
 * Chạy: node loadtest/verify-remote-scripture-review.mjs  (server dev phải đang chạy)
 */
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';

const SERVER_URL = process.env.SERVER_URL ?? 'http://127.0.0.1:3000';
const QUIZ_ID = Number(process.env.QUIZ_ID ?? 3);

const connect = (opts = {}) =>
  new Promise((resolve) => {
    const s = io(SERVER_URL, { transports: ['websocket'], ...opts });
    s.on('connect', () => resolve(s));
  });
const emit = (s, ev, data) => new Promise((resolve) => s.emit(ev, data, resolve));
const once = (s, ev, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Hết giờ chờ sự kiện ${ev}`)), ms);
    s.once(ev, (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });
const notReceived = (s, ev, ms = 800) =>
  new Promise((resolve) => {
    let got = false;
    const h = () => (got = true);
    s.on(ev, h);
    setTimeout(() => {
      s.off(ev, h);
      resolve(!got);
    }, ms);
  });

async function main() {
  const login = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.HOST_EMAIL ?? 'host@questionbible.vn',
      password: process.env.HOST_PASSWORD ?? 'Host@123'
    })
  }).then((r) => r.json());
  assert.ok(login.token, 'Đăng nhập người dẫn');

  const control = await connect({ auth: { token: login.token } });
  const created = await emit(control, 'host:create', { quizId: QUIZ_ID });
  assert.equal(created.ok, true, created.error);
  assert.match(created.remoteKey, /^[0-9a-f]{32}$/, 'Trả về remoteKey cho chủ phòng');
  const pin = created.pin;
  console.log(`✅ Mở phòng ${pin} (${created.totalQuestions} câu)`);

  // --- 1. Điện thoại điều khiển & màn chiếu ---
  const intruder = await connect();
  const bad = await emit(intruder, 'remote:attach', { pin, key: 'a'.repeat(32) });
  assert.equal(bad.ok, false, 'Sai khoá phải bị từ chối');
  intruder.emit('host:start', { pin }); // không có quyền -> bỏ qua
  console.log('🔒 Sai khoá điều khiển bị từ chối');

  const remote = await connect();
  const attached = await emit(remote, 'remote:attach', { pin, key: created.remoteKey });
  assert.equal(attached.ok, true, attached.error);
  assert.equal(attached.sync.state, 'LOBBY');

  const screen = await connect({ auth: { token: login.token } });
  const scr = await emit(screen, 'host:rejoin', { pin, role: 'screen' });
  assert.equal(scr.ok, true, scr.error);
  assert.equal(scr.remoteKey, undefined, 'Màn chiếu không được nhận remoteKey');

  const player = await connect();
  const joined = await emit(player, 'player:join', { pin, nickname: 'Ba-na-ba', deviceId: `dev-${Date.now()}` });
  assert.equal(joined.ok, true, joined.error);

  // Điện thoại điều khiển bấm "Bắt đầu"
  const screenNoKey = notReceived(screen, 'remote:answer-key', 1500);
  const keyP = once(remote, 'remote:answer-key');
  const introP = once(player, 'question:intro');
  remote.emit('host:start', { pin });
  const key = await keyP;
  await introP;
  assert.ok(key.correctText, 'Điện thoại điều khiển nhận đáp án trước');
  assert.equal(await screenNoKey, true, 'Màn chiếu KHÔNG nhận đáp án trước');
  console.log(`📱 Điện thoại điều khiển bắt đầu trận; đáp án câu 1: "${key.correctText}" (màn chiếu không nhận)`);

  // --- 4. Đồng hồ theo giờ server ---
  const startP = once(player, 'question:start');
  remote.emit('host:skip', { pin });
  const start = await startP;
  assert.equal(typeof start.endsAt, 'number', 'question:start có endsAt');
  const skew = Math.abs(start.endsAt - (start.serverTime + start.duration * 1000));
  assert.ok(skew < 5, 'endsAt = serverTime + duration');
  console.log(`⏱️ endsAt hợp lệ, còn ${Math.round((start.endsAt - Date.now()) / 1000)}s`);

  // Tạm dừng -> tiếp tục: endsAt mới phải lùi lại đúng bằng thời gian dừng
  const pauseP = once(player, 'room:paused');
  remote.emit('host:pause', { pin });
  await pauseP;
  await new Promise((r) => setTimeout(r, 1200));
  const resumeP = once(player, 'room:paused');
  remote.emit('host:pause', { pin });
  const resumed = await resumeP;
  assert.equal(resumed.paused, false);
  assert.ok(resumed.endsAt - start.endsAt >= 1100, 'endsAt lùi lại sau khi tạm dừng');
  console.log(`⏸️ Tạm dừng 1,2s -> endsAt lùi ${resumed.endsAt - start.endsAt}ms`);

  // Người chơi trả lời (chọn phương án 0) -> mở đáp án
  const revealP = once(control, 'question:reveal');
  const ack = await emit(player, 'player:answer', { q: 0, choice: 0, text: 'x', order: [0, 1, 2, 3], value: 0 });
  assert.equal(ack.received, true, ack.error);
  const reveal = await revealP;

  // --- 2. Chia sẻ Lời Chúa ---
  const hasScripture = Boolean(reveal.verseText || reveal.explanation);
  if (hasScripture) {
    const scrP = once(player, 'scripture:show');
    const scrScreenP = once(screen, 'scripture:show');
    remote.emit('host:next', { pin });
    const scripture = await scrP;
    await scrScreenP;
    assert.equal(scripture.q, 0);
    console.log(`📖 Bước Chia sẻ Lời Chúa: ${scripture.bibleReference ?? '(không tham chiếu)'}`);

    // Tải lại màn chiếu giữa bước này -> đồng bộ đúng trạng thái
    const screen2 = await connect({ auth: { token: login.token } });
    const re = await emit(screen2, 'host:rejoin', { pin, role: 'screen' });
    assert.equal(re.sync.state, 'SCRIPTURE');
    assert.ok(re.sync.scripture && re.sync.reveal && re.sync.intro, 'Đồng bộ đủ dữ liệu khi tải lại');
    screen2.disconnect();
    console.log('🔄 Màn chiếu tải lại giữa chừng vẫn hiện đúng bước Lời Chúa');
  } else {
    console.log('ℹ️ Câu 1 không có câu gốc/bài học -> bỏ qua bước Lời Chúa (đúng thiết kế)');
  }

  const lbP = once(control, 'leaderboard');
  remote.emit('host:next', { pin });
  await lbP;

  // --- 3. Màn xem lại cá nhân ---
  const podiumP = once(player, 'game:podium');
  remote.emit('host:end', { pin });
  const podium = await podiumP;
  assert.ok(Array.isArray(podium.review), 'Có danh sách xem lại');
  assert.equal(podium.review.length, 1, 'Chỉ gồm các câu đã hỏi');
  const item = podium.review[0];
  assert.equal(item.answered, true);
  assert.ok(item.correctAnswer, 'Có đáp án đúng dạng chữ');
  console.log(`📚 Xem lại: "${item.content}" — bạn chọn "${item.yourAnswer}", đáp án "${item.correctAnswer}", ${item.correct ? 'ĐÚNG' : 'SAI'}`);

  // Người chơi tải lại trang sau khi kết thúc vẫn xem lại được
  const player2 = await connect();
  const podium2P = once(player2, 'game:podium');
  const rj = await emit(player2, 'player:rejoin', { pin, token: joined.token });
  assert.equal(rj.ok, true, rj.error);
  const podium2 = await podium2P;
  assert.equal(podium2.review.length, 1);
  console.log('🔄 Người chơi tải lại trang sau trận vẫn thấy màn xem lại');

  for (const s of [control, remote, screen, player, player2, intruder]) s.disconnect();
  console.log('\n🎉 Tất cả kiểm thử 4 tính năng đều ĐẠT');
}

main().catch((err) => {
  console.error('❌ THẤT BẠI:', err);
  process.exit(1);
});
