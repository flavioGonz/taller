import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema, idParamSchema, SOCKET_EVENTS } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { badRequest, notFound } from '../lib/errors.js';
import { emitTenant } from '../plugins/socket.js';
import { newAuditId } from '../lib/audit-id.js';

const include = {
  customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  bay: { select: { id: true, name: true } },
  workOrder: { select: { id: true, number: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export default async function appointmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/appointments — agenda por rango
  app.get('/', { preHandler: [app.authorize('appointment:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = appointmentQuerySchema.parse(req.query);
    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to ? { scheduledAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.q
        ? {
            OR: [
              { contactName: { contains: q.q, mode: 'insensitive' } },
              { plate: { contains: q.q.toUpperCase() } },
              { vehicle: { plate: { contains: q.q.toUpperCase() } } },
              { customer: { lastName: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const raw = req.query as Record<string, unknown>;
    if (raw.page === undefined) {
      return prisma.appointment.findMany({ where, orderBy: { scheduledAt: 'asc' }, take: 300, include });
    }
    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({ where, ...skipTake(q.page, q.limit), orderBy: { scheduledAt: 'asc' }, include }),
      prisma.appointment.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.post('/', { preHandler: [app.authorize('appointment:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createAppointmentSchema.parse(req.body);
    if (!data.customerId && !data.contactName) throw badRequest('Indicá un cliente o al menos el nombre de contacto');

    const created = await prisma.appointment.create({
      data: { ...data, tenantId, plate: data.plate?.toUpperCase(), createdById: req.currentUser!.id },
      include,
    });
    emitTenant(tenantId, SOCKET_EVENTS.APPOINTMENT_CHANGED, created);
    reply.code(201);
    return created;
  });

  app.patch('/:id', { preHandler: [app.authorize('appointment:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateAppointmentSchema.parse(req.body);
    const found = await prisma.appointment.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Cita no encontrada');

    const updated = await prisma.appointment.update({
      where: { id },
      data: { ...data, ...(data.plate ? { plate: data.plate.toUpperCase() } : {}) },
      include,
    });
    emitTenant(tenantId, SOCKET_EVENTS.APPOINTMENT_CHANGED, updated);
    return updated;
  });

  // POST /api/appointments/:id/convert — la cita se transforma en OT
  app.post('/:id/convert', { preHandler: [app.authorize('workorder:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const body = (req.body ?? {}) as { kind?: string; priority?: string };

    const appt = await prisma.appointment.findFirst({ where: { id, tenantId }, include: { workOrder: { select: { id: true } } } });
    if (!appt) throw notFound('Cita no encontrada');
    if (appt.workOrder) throw badRequest('Esta cita ya tiene una OT abierta');
    if (!appt.customerId || !appt.vehicleId) {
      throw badRequest('La cita no tiene cliente y vehículo asociados: cargalos antes de abrir la OT');
    }

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, tenantId, 'work_order', { prefix: 'OT' });
      const wo = await tx.workOrder.create({
        data: {
          tenantId, number, auditId: newAuditId(),
          kind: (body.kind ?? 'REPARACION') as never,
          priority: (body.priority ?? 'NORMAL') as never,
          customerId: appt.customerId!,
          vehicleId: appt.vehicleId!,
          technicianId: appt.technicianId,
          bayId: appt.bayId,
          complaint: appt.reason,
          createdById: req.currentUser!.id,
          history: { create: { tenantId, toStatus: 'RECEPCION', userId: req.currentUser!.id, note: 'Ingreso desde la agenda' } },
        },
        select: { id: true, number: true },
      });
      await tx.appointment.update({ where: { id }, data: { status: 'EN_TALLER', workOrderId: wo.id } });
      return wo;
    });

    emitTenant(tenantId, SOCKET_EVENTS.APPOINTMENT_CHANGED, { id, workOrderId: created.id });
    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_CREATED, { id: created.id, number: created.number });
    reply.code(201);
    return created;
  });

  app.delete('/:id', { preHandler: [app.authorize('appointment:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.appointment.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Cita no encontrada');
    const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELADA' }, include });
    emitTenant(tenantId, SOCKET_EVENTS.APPOINTMENT_CHANGED, updated);
    return { ok: true };
  });
}
