import type { Socket } from 'socket.io';
import {
  generateBibleNickname,
  type ClientToServerEvents,
  type ServerToClientEvents
} from '@questionbible/shared';
import type { RoomManager } from '../RoomManager.js';
import type { Player } from '../Player.js';
import { validateNickname } from '../../moderation/badwords-vi.js';

export function registerPlayerHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager,
  clientIp: string
): void {
  // Sửa lỗi #22: Server chủ động đo RTT định kỳ bằng gói server:rtt-ping (client không thể tự báo gian lận RTT)
  const measureServerRtt = () => {
    const room = roomManager.getRoomByPlayerSocket(socket.id);
    if (!room) return;
    const sentAt = Date.now();
    socket.timeout(3000).emit('server:rtt-ping', sentAt, (err) => {
      if (err) return;
      const rtt = Date.now() - sentAt;
      const playerId = room.socketIndex.get(socket.id);
      if (!playerId) return;
      const player = room.players.get(playerId);
      player?.updateRtt(rtt);
    });
  };

  const rttInterval = setInterval(measureServerRtt, 15000);
  rttInterval.unref?.();
  socket.on('disconnect', () => {
    clearInterval(rttInterval);
  });

  socket.on('player:join', async (data, ack) => {
    try {
      // Sửa lỗi #1: Chỉ chặn nếu IP này đang spam đoán mò SAI mã PIN quá giới hạn
      const wrongPinCheck = roomManager.isIpBlockedByWrongPin(clientIp);
      if (wrongPinCheck.blocked) {
        ack({ ok: false, error: wrongPinCheck.error });
        return;
      }

      const pin = (data.pin ?? '').trim();
      const room = roomManager.getRoomByPin(pin);
      if (!room) {
        // Chỉ ghi nhận vi phạm rate-limit khi nhập SAI mã PIN!
        // Nhập ĐÚNG mã PIN thì 300-500 người dùng chung 1 cục Wi-Fi hội trường đều vào đồng thời mượt mà.
        roomManager.recordWrongPinAttempt(clientIp);
        ack({ ok: false, error: 'Không tìm thấy phòng chơi với mã PIN này.' });
        return;
      }

      const rawNick =
        room.options.randomBibleNickname && !data.nickname?.trim()
          ? generateBibleNickname()
          : data.nickname;

      const nickCheck = validateNickname(rawNick);
      if (!nickCheck.valid) {
        ack({ ok: false, error: nickCheck.error });
        return;
      }

      const added = room.addPlayer({
        nickname: nickCheck.sanitized,
        teamName: data.teamName,
        socketId: socket.id,
        ip: clientIp,
        deviceId: data.deviceId
      });

      if (!added.ok || !added.player) {
        ack({
          ok: false,
          suggestions: added.suggestions,
          error: added.error ?? 'Không thể tham gia phòng.'
        });
        return;
      }

      roomManager.playerSocketToPin.set(socket.id, room.pin);
      await socket.join(room.socketRoomName);

      ack({
        ok: true,
        playerId: added.player.playerId,
        token: added.player.token,
        nickname: added.player.nickname,
        teamName: added.player.teamName,
        quizTitle: room.quizTitle,
        state: room.state,
        options: room.options,
        score: added.player.score,
        streak: added.player.streak
      });

      measureServerRtt();
      syncActiveQuestionToPlayer(socket, room, added.player);
    } catch (err) {
      console.error('Lỗi player:join:', err);
      ack({ ok: false, error: 'Lỗi hệ thống khi tham gia phòng.' });
    }
  });

  socket.on('player:rejoin', async (data, ack) => {
    try {
      const pin = (data.pin ?? '').trim();
      const room = roomManager.getRoomByPin(pin);
      if (!room) {
        ack({ ok: false, error: 'Phòng chơi không còn hoạt động.' });
        return;
      }

      const rejoined = room.rejoinPlayer({
        token: data.token,
        deviceId: data.deviceId,
        socketId: socket.id,
        ip: clientIp
      });

      if (!rejoined.ok || !rejoined.player) {
        ack({ ok: false, error: rejoined.error });
        return;
      }

      roomManager.playerSocketToPin.set(socket.id, room.pin);
      await socket.join(room.socketRoomName);

      ack({
        ok: true,
        playerId: rejoined.player.playerId,
        token: rejoined.player.token,
        nickname: rejoined.player.nickname,
        teamName: rejoined.player.teamName,
        quizTitle: room.quizTitle,
        state: room.state,
        options: room.options,
        score: rejoined.player.score,
        streak: rejoined.player.streak
      });

      measureServerRtt();
      syncActiveQuestionToPlayer(socket, room, rejoined.player);
    } catch (err) {
      console.error('Lỗi player:rejoin:', err);
      ack({ ok: false, error: 'Lỗi khi kết nối lại phòng.' });
    }
  });

  socket.on('player:answer', (data, ack) => {
    const room = roomManager.getRoomByPlayerSocket(socket.id);
    if (!room) {
      ack?.({ received: false, error: 'Bạn chưa tham gia phòng nào.' });
      return;
    }

    const res = room.submitPlayerAnswer(socket.id, data);
    ack?.(res);
  });

  socket.on('rtt:ping', (_clientTimestamp, ack) => {
    if (typeof ack === 'function') {
      ack(Date.now());
    }
  });
}

/**
 * Đồng bộ trạng thái câu hỏi hiện tại cho người vào muộn hoặc rớt mạng vào lại (Sửa lỗi #6, #13, #14)
 */
function syncActiveQuestionToPlayer(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  room: ReturnType<RoomManager['getRoomByPin']>,
  player: Player
): void {
  if (!room || room.currentQ < 0) return;
  const qData = room.questions[room.currentQ];
  if (!qData) return;

  // Sửa lỗi #6: Dùng chung đúng bản xáo trộn currentShuffledOptions của phòng (không gửi thứ tự gốc!)
  const shuffledOptions = room.getCurrentShuffledOptions();
  const alreadyAnswered = player.answers.has(room.currentQ);

  if (room.state === 'QUESTION_INTRO' || room.state === 'ANSWERING') {
    socket.emit('question:intro', {
      q: room.currentQ,
      totalQuestions: room.questions.length,
      type: qData.type,
      n: qData.options.length,
      t: qData.timeLimit,
      pointsFactor: qData.pointsFactor,
      content: room.options.showQuestionOnPlayer ? qData.content : undefined,
      options:
        qData.type === 'order' || qData.type === 'poll' || room.options.showQuestionOnPlayer
          ? shuffledOptions
          : undefined,
      sliderMin: qData.sliderMin,
      sliderMax: qData.sliderMax
    });

    if (room.state === 'ANSWERING') {
      const remainingMs = room.getRemainingAnswerMs();
      const remainingSec = Math.max(Math.ceil(remainingMs / 1000), 1);

      socket.emit('question:start', {
        q: room.currentQ,
        duration: remainingSec,
        serverTime: room.questionStartAt,
        endsAt: room.getAnswerEndsAt(),
        options:
          qData.type === 'order' || qData.type === 'poll' || room.options.showQuestionOnPlayer
            ? shuffledOptions
            : undefined
      });

      if (room.paused) {
        socket.emit('room:paused', {
          paused: true,
          remainingMs
        });
      }

      if (alreadyAnswered) {
        socket.emit('answer:ack', { received: true, q: room.currentQ });
      }
    }
  } else if (room.state === 'REVEAL' || room.state === 'LEADERBOARD') {
    // Sửa lỗi #14: Nếu người chơi kết nối lại lúc đang REVEAL hoặc LEADERBOARD, gửi lại kết quả câu vừa xong để không bị màn hình trống
    socket.emit('player:result', room.buildPlayerResultPayload(player, room.currentQ));
  } else if (room.state === 'SCRIPTURE') {
    socket.emit('player:result', room.buildPlayerResultPayload(player, room.currentQ));
    const sync = room.getHostSyncPayload(false);
    if (sync.scripture) socket.emit('scripture:show', sync.scripture);
  } else if (room.state === 'PODIUM' || room.state === 'ENDED') {
    // Tải lại trang sau khi kết thúc vẫn xem lại được kết quả cá nhân
    socket.emit('game:podium', room.buildPlayerPodiumPayload(player));
  }
}
