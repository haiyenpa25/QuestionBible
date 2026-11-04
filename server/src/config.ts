import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET ?? 'questionbible-super-secret-jwt-key-2026';

if (
  nodeEnv === 'production' &&
  (!process.env.JWT_SECRET ||
    jwtSecret === 'change-this-secret-in-production' ||
    jwtSecret === 'questionbible-super-secret-jwt-key-2026')
) {
  throw new Error('Cấu hình bảo mật: Bắt buộc đặt biến môi trường JWT_SECRET mạnh khi chạy production.');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? (nodeEnv === 'production' ? '127.0.0.1' : '0.0.0.0'),
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL ?? 'mysql://root:@127.0.0.1:3306/questionbible',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  uploadsDir: path.resolve(__dirname, '../../uploads'),
  // Chỉ giới hạn số lần nhập SAI mã PIN trên mỗi IP (chống dò PIN mà không chặn 300 người chung Wi-Fi)
  wrongPinRateLimitPerMin: Number(process.env.WRONG_PIN_RATE_LIMIT_PER_MIN ?? 60)
};
