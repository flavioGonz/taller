import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env, isProd } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { can, type Permission, type Role, type SessionUser } from '@taller/shared';

export const ACCESS_COOKIE = 'ts_at';
export const REFRESH_COOKIE = 'ts_rt';

export interface JwtPayload {
  sub: string;
  tid: string | null;
  role: Role;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (
      ...permissions: Permission[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    issueSession: (
      user: { id: string; tenantId: string | null; role: Role; email: string },
      reply: FastifyReply,
      meta?: { ip?: string; userAgent?: string },
    ) => Promise<void>;
    clearSession: (reply: FastifyReply, refreshToken?: string) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser?: SessionUser;
    tenantId?: string | null;
  }
}

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE || isProd,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export default fp(async (app) => {
  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: ACCESS_COOKIE, signed: false },
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });

  app.decorate('issueSession', async (user, reply, meta) => {
    const payload: JwtPayload = { sub: user.id, tid: user.tenantId, role: user.role, email: user.email };
    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TTL });
    const refreshToken = crypto.randomBytes(48).toString('hex');

    await prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        refreshToken: sha256(refreshToken),
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 250),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
      },
    });

    reply
      .setCookie(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: env.JWT_ACCESS_TTL })
      .setCookie(REFRESH_COOKIE, refreshToken, {
        ...cookieBase,
        path: '/api/auth',
        maxAge: env.JWT_REFRESH_TTL,
      });
  });

  app.decorate('clearSession', async (reply, refreshToken) => {
    if (refreshToken) {
      await prisma.session
        .updateMany({ where: { refreshToken: sha256(refreshToken) }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
    reply.clearCookie(ACCESS_COOKIE, { ...cookieBase }).clearCookie(REFRESH_COOKIE, { ...cookieBase, path: '/api/auth' });
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    let payload: JwtPayload;
    try {
      payload = await req.jwtVerify<JwtPayload>();
    } catch {
      throw unauthorized('Sesión inválida o expirada');
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      select: {
        id: true, tenantId: true, email: true, firstName: true, lastName: true,
        role: true, avatarUrl: true,
        tenant: { select: { id: true, slug: true, name: true, logoUrl: true, status: true } },
      },
    });

    if (!user) throw unauthorized('Usuario inexistente o desactivado');
    if (user.tenant && user.tenant.status === 'SUSPENDED') throw forbidden('Taller suspendido');

    req.currentUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as Role,
      avatarUrl: user.avatarUrl,
      tenant: user.tenant
        ? { id: user.tenant.id, slug: user.tenant.slug, name: user.tenant.name, logoUrl: user.tenant.logoUrl }
        : null,
    };
    req.tenantId = user.tenantId;
  });

  app.decorate('authorize', (...permissions: Permission[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.currentUser) await app.authenticate(req, reply);
      const role = req.currentUser!.role;
      const ok = permissions.length === 0 || permissions.some((p) => can(role, p));
      if (!ok) throw forbidden(`El rol ${role} no tiene permiso para esta operación`);
    };
  });
});

export const hashToken = sha256;
