import fp from 'fastify-plugin';
import { Server as IOServer, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { env, corsOrigins } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { tenantRoom, userRoom, workOrderRoom, SOCKET_EVENTS } from '@taller/shared';
import { raiseInsight } from '../lib/insights.js';
import type { JwtPayload } from './auth.js';
import { ACCESS_COOKIE } from './auth.js';

let io: IOServer | null = null;
export const getIO = () => io;

/** Emite a todos los clientes conectados de un taller. */
export function emitTenant(tenantId: string, event: string, payload: unknown) {
  io?.to(tenantRoom(tenantId)).emit(event, payload);
}
export function emitUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}
export function emitWorkOrder(id: string, event: string, payload: unknown) {
  io?.to(workOrderRoom(id)).emit(event, payload);
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export default fp(async (app: FastifyInstance) => {
  io = new IOServer(app.server, {
    path: '/socket.io',
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // --- Handshake autenticado: mismo JWT que la API (cookie o auth.token) ---
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        parseCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
      if (!token) return next(new Error('unauthorized'));

      const payload = app.jwt.verify<JwtPayload>(token);
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        select: { id: true, tenantId: true, role: true },
      });
      if (!user) return next(new Error('unauthorized'));

      socket.data.userId = user.id;
      socket.data.tenantId = user.tenantId;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, tenantId } = socket.data as { userId: string; tenantId: string | null };
    socket.join(userRoom(userId));
    if (tenantId) socket.join(tenantRoom(tenantId));

    socket.on('workorder:subscribe', (id: string) => {
      if (typeof id === 'string' && id.length < 64) socket.join(workOrderRoom(id));
    });
    socket.on('workorder:unsubscribe', (id: string) => {
      if (typeof id === 'string') socket.leave(workOrderRoom(id));
    });

    // --- State & Mutation Observer: detección de fugas de WebSocket ---
    const count = io?.engine.clientsCount ?? 0;
    if (count > env.SOCKET_LEAK_THRESHOLD) {
      raiseInsight({
        agent: 'STATE_MUTATION_OBSERVER',
        severity: 'WARN',
        code: 'SOCKET_CONNECTION_SPIKE',
        title: `Conexiones Socket.io por encima del umbral (${count})`,
        target: 'socket.io',
        metrics: { clients: count, threshold: env.SOCKET_LEAK_THRESHOLD },
        suggestion:
          'Verificar que el cliente desconecte en el cleanup del efecto y que no se creen múltiples instancias del socket por render.',
      });
    }

    socket.on('error', () => socket.disconnect(true));
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => io?.close(() => resolve()) ?? resolve());
    io = null;
  });

  app.decorate('io', io);
});

declare module 'fastify' {
  interface FastifyInstance {
    io: IOServer;
  }
}
