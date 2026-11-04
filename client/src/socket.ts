import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents
} from '@questionbible/shared';
import { getAuthToken } from './api';

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socketInstance) {
    socketInstance = io('/', {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        cb({ token: getAuthToken() });
      }
    });

    // Phản hồi gói đo RTT từ server (Sửa lỗi #22)
    socketInstance.on('server:rtt-ping', (_sentAt, ack) => {
      if (typeof ack === 'function') {
        ack();
      }
    });
  }

  return socketInstance;
}

export function refreshSocketAuth(): void {
  if (socketInstance) {
    socketInstance.disconnect().connect();
  }
}
