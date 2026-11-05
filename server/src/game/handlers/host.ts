import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents
} from '@questionbible/shared';
import type { RoomManager } from '../RoomManager.js';
import type { AuthJwtPayload } from '../../api/auth.js';

export function registerHostHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager,
  getHostUser: () => AuthJwtPayload | null
): void {
  socket.on('host:create', async (data, ack) => {
    try {
      const hostUser = getHostUser();
      if (!hostUser) {
        ack({ ok: false, error: 'Vui lòng đăng nhập tài khoản Người dẫn để mở phòng.' });
        return;
      }

      const result = await roomManager.createRoom({
        quizId: Number(data.quizId),
        hostId: hostUser.userId,
        hostSocketId: socket.id,
        options: data.options
      });

      if (!result.ok || !result.room) {
        ack({ ok: false, error: result.error ?? 'Không thể tạo phòng.' });
        return;
      }

      const room = result.room;
      // Bảng điều khiển cũng nhận đáp án & ghi chú (hiển thị ẩn, chỉ mở khi người dẫn bấm xem)
      await socket.join([room.hostRoomName, room.remoteRoomName]);

      ack({
        ok: true,
        pin: room.pin,
        roomId: room.roomId,
        quizTitle: room.quizTitle,
        totalQuestions: room.questions.length,
        options: room.options,
        remoteKey: room.remoteKey
      });

      room.scheduleLobbyUpdate(true);
    } catch (err) {
      console.error('Lỗi host:create:', err);
      ack({ ok: false, error: 'Lỗi hệ thống khi tạo phòng.' });
    }
  });

  // Sửa lỗi #4: Kiểm tra đúng chủ phòng (room.hostId === hostUser.userId hoặc admin) trước khi cho phép điều khiển lại phòng
  socket.on('host:rejoin', async (data, ack) => {
    try {
      const room = roomManager.getRoomByPin(data.pin);
      if (!room) {
        ack({ ok: false, error: 'Không tìm thấy phòng với mã PIN này.' });
        return;
      }

      const hostUser = getHostUser();
      if (!hostUser) {
        ack({ ok: false, error: 'Vui lòng đăng nhập để điều khiển phòng.' });
        return;
      }

      if (room.hostId !== hostUser.userId && hostUser.role !== 'admin') {
        ack({ ok: false, error: 'Bạn không phải là người mở phòng này nên không có quyền điều khiển.' });
        return;
      }

      // Màn chiếu riêng (role 'screen'): chỉ nhận hình ảnh, không giành quyền điều khiển của bảng điều khiển
      const isScreen = data.role === 'screen';
      if (!isScreen) {
        if (room.hostSocketId && room.hostSocketId !== socket.id) {
          roomManager.hostSocketToPin.delete(room.hostSocketId);
        }
        room.hostSocketId = socket.id;
        roomManager.hostSocketToPin.set(socket.id, room.pin);
      }
      await socket.join(isScreen ? room.hostRoomName : [room.hostRoomName, room.remoteRoomName]);

      ack({
        ok: true,
        pin: room.pin,
        roomId: room.roomId,
        quizTitle: room.quizTitle,
        totalQuestions: room.questions.length,
        options: room.options,
        remoteKey: isScreen ? undefined : room.remoteKey,
        state: room.state,
        lobby: room.getLobbyPayload(),
        sync: room.getHostSyncPayload(!isScreen)
      });
    } catch (err) {
      console.error('Lỗi host:rejoin:', err);
      ack({ ok: false, error: 'Lỗi khi kết nối lại phòng.' });
    }
  });

  // Điện thoại điều khiển: quét QR trên bảng điều khiển (chứa remoteKey bí mật), không cần đăng nhập
  socket.on('remote:attach', async (data, ack) => {
    if (typeof ack !== 'function') return;
    try {
      const room = roomManager.getRoomByPin(String(data?.pin ?? ''));
      if (!room || !room.isRemoteKeyValid(data?.key)) {
        ack({ ok: false, error: 'Mã điều khiển không hợp lệ hoặc phòng đã đóng.' });
        return;
      }
      if (room.remoteSockets.size >= 5 && !room.remoteSockets.has(socket.id)) {
        ack({ ok: false, error: 'Phòng đã có đủ 5 thiết bị điều khiển.' });
        return;
      }
      room.remoteSockets.add(socket.id);
      roomManager.hostSocketToPin.set(socket.id, room.pin);
      await socket.join([room.hostRoomName, room.remoteRoomName]);
      ack({ ok: true, sync: room.getHostSyncPayload(true) });
    } catch (err) {
      console.error('Lỗi remote:attach:', err);
      ack({ ok: false, error: 'Lỗi khi ghép điện thoại điều khiển.' });
    }
  });

  socket.on('host:start', (data) => {
    const room = data?.pin
      ? roomManager.getRoomByPin(data.pin)
      : roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.startGame();
  });

  socket.on('host:next', (data) => {
    const room = data?.pin
      ? roomManager.getRoomByPin(data.pin)
      : roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.nextPhase();
  });

  socket.on('host:skip', (data) => {
    const room = data?.pin
      ? roomManager.getRoomByPin(data.pin)
      : roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.skipCurrentPhase();
  });

  socket.on('host:pause', (data) => {
    const room = data?.pin
      ? roomManager.getRoomByPin(data.pin)
      : roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.togglePause();
  });

  socket.on('host:end', (data) => {
    const room = data?.pin
      ? roomManager.getRoomByPin(data.pin)
      : roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    void room.showPodium().catch((err) => console.error('Lỗi showPodium:', err));
  });

  socket.on('host:kick', (data) => {
    const room = roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.kickPlayer(data.playerId, Boolean(data.banDevice));
  });

  socket.on('host:lock', (data) => {
    const room = roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.locked = Boolean(data.locked);
    room.scheduleLobbyUpdate(true);
  });

  socket.on('host:update-options', (data) => {
    const room = roomManager.getRoomByHostSocket(socket.id);
    if (!room || !room.canControl(socket.id)) return;
    room.updateOptions(data.options);
  });
}
