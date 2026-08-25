import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createServiceSchema, updateServiceSchema, paginationSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { conflict, notFound } from '../lib/errors.js';

export default async function serviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('service:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const raw = req.query as Record<string, unknown>;
    const where: Prisma.ServiceCatalogWhereInput = {
      tenantId,
      isActive: true,
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { code: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    if (raw.page === undefined) return prisma.serviceCatalog.findMany({ where, orderBy: { name: 'asc' }, take: 500 });
    const [rows, total] = await Promise.all([
      prisma.serviceCatalog.findMany({ where, ...skipTake(q.page, q.limit), orderBy: { name: 'asc' } }),
      prisma.serviceCatalog.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.post('/', { preHandler: [app.authorize('service:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createServiceSchema.parse(req.body);
    try {
      reply.code(201);
      return await prisma.serviceCatalog.create({ data: { ...data, tenantId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Ya existe un servicio con ese código');
      throw e;
    }
  });

  app.patch('/:id', { preHandler: [app.authorize('service:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateServiceSchema.parse(req.body);
    const found = await prisma.serviceCatalog.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Servicio no encontrado');
    return prisma.serviceCatalog.update({ where: { id }, data });
  });

  app.delete('/:id', { preHandler: [app.authorize('service:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.serviceCatalog.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Servicio no encontrado');
    await prisma.serviceCatalog.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });
}
