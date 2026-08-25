import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createUserSchema, updateUserSchema, paginationSchema, idParamSchema, ASSIGNABLE_ROLES } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';

const SAFE = {
  id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
  specialty: true, hourlyRate: true, isActive: true, avatarUrl: true, lastLoginAt: true, createdAt: true,
} satisfies Prisma.UserSelect;

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('user:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { role } = req.query as { role?: string };
    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
      ...(role ? { role: role as Prisma.EnumRoleFilter['equals'] } : {}),
      ...(q.q ? { OR: [{ firstName: { contains: q.q, mode: 'insensitive' } }, { lastName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, ...skipTake(q.page, q.limit), orderBy: { firstName: 'asc' }, select: SAFE }),
      prisma.user.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.post('/', { preHandler: [app.authorize('user:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createUserSchema.parse(req.body);
    if (!ASSIGNABLE_ROLES.includes(data.role) && req.currentUser!.role !== 'SUPER_ADMIN') {
      throw forbidden('Sólo un SUPER_ADMIN puede crear un usuario con ese rol');
    }
    try {
      reply.code(201);
      return await prisma.user.create({
        data: {
          tenantId, email: data.email.toLowerCase(), passwordHash: await hashPassword(data.password),
          firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: data.role,
          specialty: data.specialty, hourlyRate: data.hourlyRate, isActive: data.isActive, mustChangePwd: true,
        },
        select: SAFE,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Ya existe un usuario con ese email en el taller');
      throw e;
    }
  });

  app.patch('/:id', { preHandler: [app.authorize('user:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateUserSchema.parse(req.body);
    const found = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, role: true } });
    if (!found) throw notFound('Usuario no encontrado');
    if (found.role === 'SUPER_ADMIN' && req.currentUser!.role !== 'SUPER_ADMIN') throw forbidden('No autorizado');
    return prisma.user.update({
      where: { id },
      data: { ...data, ...(data.email ? { email: data.email.toLowerCase() } : {}) },
      select: SAFE,
    });
  });

  app.post('/:id/reset-password', { preHandler: [app.authorize('user:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || password.length < 8) throw conflict('La contraseña debe tener al menos 8 caracteres');
    const found = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Usuario no encontrado');
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePwd: true } });
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  app.delete('/:id', { preHandler: [app.authorize('user:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    if (id === req.currentUser!.id) throw forbidden('No podés desactivar tu propio usuario');
    const found = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Usuario no encontrado');
    await prisma.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    return { ok: true };
  });

  // Bahías del taller (config operativa, vive con usuarios/ajustes)
  app.get('/bays', { preHandler: [app.authorize('user:read')] }, async (req) =>
    prisma.bay.findMany({
      where: { tenantId: req.scope() },
      orderBy: { name: 'asc' },
      include: { _count: { select: { workOrders: true } } },
    }),
  );

  app.post('/bays', { preHandler: [app.authorize('tenant:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const body = (req.body ?? {}) as { name?: string; kind?: string };
    const name = (body.name ?? '').trim();
    if (!name) throw badRequest('Poné un nombre a la bahía');
    const exists = await prisma.bay.findFirst({ where: { tenantId, name }, select: { id: true } });
    if (exists) throw conflict('Ya existe una bahía con ese nombre');
    reply.code(201);
    return prisma.bay.create({ data: { tenantId, name, kind: body.kind?.trim() || null } });
  });

  app.patch('/bays/:id', { preHandler: [app.authorize('tenant:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const body = (req.body ?? {}) as { name?: string; kind?: string; isActive?: boolean };
    const found = await prisma.bay.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Bahía no encontrada');
    return prisma.bay.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.kind !== undefined ? { kind: body.kind.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  });

  app.delete('/bays/:id', { preHandler: [app.authorize('tenant:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const bay = await prisma.bay.findFirst({
      where: { id, tenantId },
      select: { id: true, _count: { select: { workOrders: true } } },
    });
    if (!bay) throw notFound('Bahía no encontrada');
    if (bay._count.workOrders > 0) {
      // Con historial no se borra: se desactiva para que no se pueda asignar más
      return prisma.bay.update({ where: { id }, data: { isActive: false } });
    }
    await prisma.bay.delete({ where: { id } });
    return { ok: true };
  });

  // Numeración de documentos: en qué va cada contador del taller
  app.get('/counters', { preHandler: [app.authorize('tenant:write')] }, async (req) =>
    prisma.counter.findMany({ where: { tenantId: req.scope() }, orderBy: [{ key: 'asc' }, { period: 'desc' }] }),
  );
}
