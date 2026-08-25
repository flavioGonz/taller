import type { FastifyInstance } from 'fastify';
import { loginSchema, changePasswordSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { REFRESH_COOKIE, hashToken } from '../plugins/auth.js';

export default async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email: body.email.toLowerCase(),
        isActive: true,
        deletedAt: null,
        ...(body.tenantSlug ? { tenant: { slug: body.tenantSlug } } : {}),
      },
      include: { tenant: { select: { id: true, slug: true, name: true, logoUrl: true, status: true } } },
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized('Credenciales inválidas');
    }
    if (user.tenant && user.tenant.status === 'SUSPENDED') throw unauthorized('Taller suspendido');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await app.issueSession(
      { id: user.id, tenantId: user.tenantId, role: user.role, email: user.email },
      reply,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );

    await prisma.auditLog.create({
      data: { tenantId: user.tenantId, userId: user.id, action: 'login', entity: 'User', entityId: user.id, ip: req.ip },
    });

    return {
      user: {
        id: user.id, tenantId: user.tenantId, email: user.email, firstName: user.firstName,
        lastName: user.lastName, role: user.role, avatarUrl: user.avatarUrl,
        mustChangePwd: user.mustChangePwd,
        tenant: user.tenant ? { id: user.tenant.id, slug: user.tenant.slug, name: user.tenant.name, logoUrl: user.tenant.logoUrl } : null,
      },
    };
  });

  // POST /api/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw unauthorized('Sin refresh token');

    const session = await prisma.session.findFirst({
      where: { refreshToken: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, tenantId: true, role: true, email: true, isActive: true, deletedAt: true } } },
    });
    if (!session || !session.user.isActive || session.user.deletedAt) throw unauthorized('Sesión expirada');

    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await app.issueSession(session.user, reply, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return { ok: true };
  });

  // POST /api/auth/logout
  app.post('/logout', async (req, reply) => {
    await app.clearSession(reply, req.cookies[REFRESH_COOKIE]);
    return { ok: true };
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (req) => ({ user: req.currentUser }));

  // POST /api/auth/change-password
  app.post('/change-password', { preHandler: [app.authenticate] }, async (req) => {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser!.id } });
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw badRequest('La contraseña actual no coincide');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword), mustChangePwd: false },
    });
    await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  });
}
