import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'node:fs/promises';
import type {
  ClientToServerEvents,
  ServerToClientEvents
} from '@questionbible/shared';
import { config } from './config.js';
import { initRedis, restoreRoomsFromRedis } from './game/persistence.js';
import { RoomManager } from './game/RoomManager.js';
import { registerHostHandlers } from './game/handlers/host.js';
import { registerPlayerHandlers } from './game/handlers/player.js';
import { registerAuthRoutes, type AuthJwtPayload } from './api/auth.js';
import { registerQuizRoutes } from './api/quizzes.js';
import { registerQuestionRoutes } from './api/questions.js';
import { registerImportRoutes } from './api/import.js';
import { registerReportRoutes } from './api/reports.js';

// Sửa lỗi #7: Không bao giờ để một Promise bị reject ngoài ý muốn làm tắt tiến trình Game Server
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [UnhandledRejection] Đã bắt lỗi để bảo vệ các phòng đang chơi:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [UncaughtException] Đã bắt lỗi hệ thống:', err);
});

async function bootstrap() {
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await initRedis();

  const app = Fastify({
    logger: config.nodeEnv === 'development' ? { level: 'info' } : true,
    trustProxy: true
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/'
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: {
      origin: true,
      credentials: true
    },
    perMessageDeflate: false,
    pingInterval: 10000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling']
  });

  const roomManager = new RoomManager(io);
  // Sửa lỗi #8: Khôi phục các phòng đang hoạt động từ Redis nếu server vừa khởi động lại
  await restoreRoomsFromRedis(roomManager);

  io.on('connection', (socket) => {
    const rawAddr = socket.handshake.address || '127.0.0.1';
    const isLocalProxy =
      rawAddr === '127.0.0.1' || rawAddr === '::1' || rawAddr.startsWith('::ffff:127.');
    const forwarded = isLocalProxy ? socket.handshake.headers['x-forwarded-for'] : undefined;
    const clientIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
      rawAddr;

    const getHostAuthUser = (): AuthJwtPayload | null => {
      try {
        const authToken = socket.handshake.auth?.token as string | undefined;
        if (authToken) {
          return app.jwt.verify<AuthJwtPayload>(authToken);
        }
        const rawCookie = socket.handshake.headers.cookie;
        if (rawCookie) {
          const parsed = app.parseCookie(rawCookie);
          if (parsed.qb_token) {
            return app.jwt.verify<AuthJwtPayload>(parsed.qb_token);
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    registerHostHandlers(socket, roomManager, getHostAuthUser);
    registerPlayerHandlers(socket, roomManager, clientIp);

    socket.on('disconnect', () => {
      const hostRoom = roomManager.getRoomByHostSocket(socket.id);
      if (hostRoom) {
        hostRoom.handleDisconnect(socket.id);
        roomManager.hostSocketToPin.delete(socket.id);
      }

      const playerRoom = roomManager.getRoomByPlayerSocket(socket.id);
      if (playerRoom) {
        playerRoom.handleDisconnect(socket.id);
        roomManager.playerSocketToPin.delete(socket.id);
      }
    });
  });

  await registerAuthRoutes(app);
  await registerQuizRoutes(app);
  await registerQuestionRoutes(app);
  await registerImportRoutes(app);
  await registerReportRoutes(app, roomManager);

  await app.listen({ port: config.port, host: config.host });
  console.log(`🚀 QuestionBible Server đang chạy tại http://${config.host}:${config.port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Lỗi khởi động QuestionBible Server:', err);
  process.exit(1);
});
