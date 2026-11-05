import { ref, type Ref } from 'vue';
import { getSocket } from '../socket';

/**
 * Đồng hồ theo giờ server (mục "đồng hồ đồng bộ" roadmaps.md).
 *
 * Điện thoại tắt màn hình / chuyển tab sẽ làm setInterval chạy chậm hoặc dừng hẳn,
 * nên không đếm lùi bằng cách trừ dần từng giây nữa. Thay vào đó:
 *  - đo độ lệch đồng hồ máy so với server (lấy mẫu có RTT nhỏ nhất, kiểu NTP),
 *  - server gửi mốc hết giờ tuyệt đối `endsAt`,
 *  - mỗi lần vẽ chỉ cần tính endsAt - giờ_server_hiện_tại.
 */

let offsetMs = 0; // serverTime ≈ Date.now() + offsetMs
let bestRttMs = Number.POSITIVE_INFINITY;
let syncing = false;
let lastSyncAt = 0;
let hooksInstalled = false;

function sampleOnce(): Promise<void> {
  return new Promise((resolve) => {
    const socket = getSocket();
    if (!socket.connected) {
      resolve();
      return;
    }
    const t0 = Date.now();
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      resolve();
    }, 3000);
    socket.emit('rtt:ping', t0, (serverTs: number) => {
      if (done) return;
      clearTimeout(timer);
      const t1 = Date.now();
      const rtt = t1 - t0;
      // Mẫu có RTT nhỏ hơn thì chính xác hơn; mẫu cũ hơn 60s cho phép bị thay thế
      if (typeof serverTs === 'number' && (rtt <= bestRttMs || t1 - lastSyncAt > 60_000)) {
        bestRttMs = rtt;
        offsetMs = serverTs - (t0 + rtt / 2);
        lastSyncAt = t1;
      }
      resolve();
    });
  });
}

export async function syncServerClock(samples = 5): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    bestRttMs = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples; i++) {
      await sampleOnce();
    }
  } finally {
    syncing = false;
  }
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Cài đặt đồng bộ lại khi kết nối lại & khi người dùng mở lại màn hình */
export function installServerClock(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const socket = getSocket();
  socket.on('connect', () => {
    void syncServerClock();
  });
  if (socket.connected) void syncServerClock();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncServerClock(3);
    });
  }
}

/**
 * Bộ đếm ngược theo mốc giờ server. Gọi start(endsAt) khi bắt đầu / tiếp tục,
 * freeze(remainingMs) khi tạm dừng, stop() khi hết câu.
 */
export function createServerCountdown(onSecondChange?: (sec: number) => void): {
  remainingSeconds: Ref<number>;
  start: (endsAt: number) => void;
  freeze: (remainingMs: number) => void;
  stop: () => void;
} {
  installServerClock();
  const remainingSeconds = ref(0);
  let endsAt = 0;
  let frame: ReturnType<typeof setInterval> | null = null;

  const render = () => {
    const sec = Math.max(Math.ceil((endsAt - serverNow()) / 1000), 0);
    if (sec !== remainingSeconds.value) {
      remainingSeconds.value = sec;
      onSecondChange?.(sec);
    }
    if (sec <= 0) clear();
  };

  const clear = () => {
    if (frame) {
      clearInterval(frame);
      frame = null;
    }
  };

  // Màn hình bật lại -> vẽ lại ngay, không chờ nhịp kế tiếp
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && frame) render();
    });
  }

  return {
    remainingSeconds,
    start(newEndsAt: number) {
      clear();
      endsAt = newEndsAt;
      remainingSeconds.value = Math.max(Math.ceil((endsAt - serverNow()) / 1000), 0);
      // 200ms/lần: rẻ, và chỉ cập nhật giao diện khi số giây thay đổi
      frame = setInterval(render, 200);
    },
    freeze(remainingMs: number) {
      clear();
      remainingSeconds.value = Math.max(Math.ceil(remainingMs / 1000), 0);
    },
    stop() {
      clear();
    }
  };
}
