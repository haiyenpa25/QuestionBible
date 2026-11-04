import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { config } from '../config.js';

export interface AuthJwtPayload {
  userId: number;
  email: string;
  role: 'admin' | 'editor' | 'host';
  displayName: string;
}

export async function verifyRequestUser(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<AuthJwtPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = req.server.jwt.verify<AuthJwtPayload>(token);
      return decoded;
    }

    const cookieToken = req.cookies?.qb_token;
    if (cookieToken) {
      const decoded = req.server.jwt.verify<AuthJwtPayload>(cookieToken);
      return decoded;
    }

    reply.code(401).send({ error: 'Vui lòng đăng nhập để thực hiện thao tác này.' });
    return null;
  } catch {
    reply.code(401).send({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return null;
  }
}

export async function getOptionalRequestUser(req: FastifyRequest): Promise<AuthJwtPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return req.server.jwt.verify<AuthJwtPayload>(authHeader.slice(7));
    }
    const cookieToken = req.cookies?.qb_token;
    if (cookieToken) {
      return req.server.jwt.verify<AuthJwtPayload>(cookieToken);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sửa lỗi #3 (IDOR): Kiểm tra quyền sở hữu trước khi cho phép thêm/sửa/xoá câu hỏi hoặc nhập Excel
 */
export async function assertCanEditQuiz(
  authUser: AuthJwtPayload,
  quizId: number,
  reply: FastifyReply
): Promise<boolean> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, ownerId: true }
  });

  if (!quiz) {
    reply.code(404).send({ error: 'Không tìm thấy bộ câu hỏi.' });
    return false;
  }

  if (
    quiz.ownerId !== authUser.userId &&
    authUser.role !== 'admin' &&
    authUser.role !== 'editor'
  ) {
    reply.code(403).send({
      error: 'Bạn không phải người tạo bộ câu hỏi này nên không có quyền chỉnh sửa.'
    });
    return false;
  }

  return true;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { email?: string; password?: string };
    const email = (body?.email ?? '').trim().toLowerCase();
    const password = body?.password ?? '';

    if (!email || !password) {
      return reply.code(400).send({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return reply.code(401).send({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    const payload: AuthJwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName
    };

    const token = app.jwt.sign(payload, { expiresIn: '7d' });

    reply.setCookie('qb_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        churchName: user.churchName,
        role: user.role
      }
    };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('qb_token', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        churchName: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return reply.code(404).send({ error: 'Không tìm thấy tài khoản.' });
    }

    return { user };
  });

  app.get('/api/users', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;
    if (authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Chỉ quản trị viên mới có quyền quản lý tài khoản.' });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        churchName: true,
        role: true,
        createdAt: true,
        _count: {
          select: { quizzes: true, gameSessions: true }
        }
      }
    });

    return { users };
  });

  app.post('/api/users', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;
    if (authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Chỉ quản trị viên mới có quyền tạo tài khoản.' });
    }

    const body = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      churchName?: string;
      role?: 'admin' | 'editor' | 'host';
    };

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    const displayName = (body.displayName ?? '').trim();

    if (!email || !password || !displayName) {
      return reply.code(400).send({ error: 'Vui lòng nhập đủ email, mật khẩu và tên hiển thị.' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return reply.code(409).send({ error: 'Email này đã tồn tại trong hệ thống.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        churchName: body.churchName?.trim() || null,
        role: body.role ?? 'host'
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        churchName: true,
        role: true,
        createdAt: true
      }
    });

    return { user: created };
  });

  app.delete('/api/users/:id', async (req, reply) => {
    const authUser = await verifyRequestUser(req, reply);
    if (!authUser) return;
    if (authUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Chỉ quản trị viên mới có quyền xoá tài khoản.' });
    }

    const { id } = req.params as { id: string };
    const targetId = Number(id);
    if (targetId === authUser.userId) {
      return reply.code(400).send({ error: 'Không thể tự xoá tài khoản quản trị đang đăng nhập.' });
    }

    await prisma.user.delete({ where: { id: targetId } });
    return { ok: true };
  });
}
