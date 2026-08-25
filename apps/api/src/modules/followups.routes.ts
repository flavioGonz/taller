import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createFollowUpSchema, closeFollowUpSchema, paginationSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { notFound } from '../lib/errors.js';

const include = {
  customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  workOrder: { select: { id: true, number: true } },
} satisfies Prisma.FollowUpInclude;

/** Postventa: encuestas, recordatorios de service, garantías y cobranza. */
export default async function followUpRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('followup:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { status = 'PENDIENTE', kind, overdue } = req.query as { status?: string; kind?: string; overdue?: string };

    const where: Prisma.FollowUpWhereInput = {
      tenantId,
      ...(status !== 'TODOS' ? { status: status as Prisma.EnumFollowUpStatusFilter['equals'] } : {}),
      ...(kind ? { kind: kind as Prisma.EnumFollowUpKindFilter['equals'] } : {}),
      ...(overdue === 'true' ? { dueAt: { lte: new Date() } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.followUp.findMany({ where, ...skipTake(q.page, q.limit), orderBy: { dueAt: 'asc' }, include }),
      prisma.followUp.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  // Resumen para el encabezado de postventa
  app.get('/stats', { preHandler: [app.authorize('followup:read')] }, async (req) => {
    const tenantId = req.scope();
    const now = new Date();
    const desde = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendientes, vencidos, hechosMes, rating] = await Promise.all([
      prisma.followUp.count({ where: { tenantId, status: 'PENDIENTE' } }),
      prisma.followUp.count({ where: { tenantId, status: 'PENDIENTE', dueAt: { lte: now } } }),
      prisma.followUp.count({ where: { tenantId, status: 'HECHO', doneAt: { gte: desde } } }),
      prisma.followUp.aggregate({
        where: { tenantId, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      pendientes,
      vencidos,
      hechosMes,
      satisfaccion: rating._avg?.rating ? Number(rating._avg.rating.toFixed(2)) : null,
      encuestas: rating._count?.rating ?? 0,
    };
  });

  app.post('/', { preHandler: [app.authorize('followup:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createFollowUpSchema.parse(req.body);
    reply.code(201);
    return prisma.followUp.create({ data: { ...data, tenantId }, include });
  });

  app.post('/:id/close', { preHandler: [app.authorize('followup:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = closeFollowUpSchema.parse(req.body);
    const found = await prisma.followUp.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Seguimiento no encontrado');
    return prisma.followUp.update({
      where: { id },
      data: { status: data.status, doneAt: new Date(), channel: data.channel, rating: data.rating, notes: data.notes },
      include,
    });
  });
}
