import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  createAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema, idParamSchema,
  AGENDA_KIND_DEFS, readableAgendaKinds, can, SOCKET_EVENTS,
  type AgendaKind,
} from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { emitTenant } from '../plugins/socket.js';
import { newAuditId } from '../lib/audit-id.js';

const include = {
  customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  bay: { select: { id: true, name: true } },
  workOrder: { select: { id: true, number: true, status: true } },
  supplier: { select: { id: true, name: true } },
  partsOrder: { select: { id: true, number: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export default async function appointmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/appointments — agenda por rango
  app.get('/', { preHandler: [app.authorize('appointment:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = appointmentQuerySchema.parse(req.query);
    const role = req.currentUser!.role;

    // Un técnico no tiene por qué ver los pagos del taller: el calendario se
    // recorta en el servidor, no sólo en la pantalla.
    const visibles = readableAgendaKinds((p) => can(role, p));
    const pedidos = (q.kinds ?? '').split(',').map((k) => k.trim()).filter(Boolean) as AgendaKind[];
    const kinds = pedidos.length > 0 ? pedidos.filter((k) => visibles.includes(k)) : visibles;

    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      kind: { in: kinds as never[] },
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

  app.post('/', { preHandler: [app.authorize('appointment:write', 'billing:write', 'partsorder:write', 'delivery:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createAppointmentSchema.parse(req.body);
    const def = AGENDA_KIND_DEFS[data.kind];

    if (!can(req.currentUser!.role, def.write)) {
      throw forbidden(`Tu rol no puede agendar un evento de tipo "${def.label}"`);
    }
    // Un evento tiene que poder identificarse: o cuelga de alguien, o tiene título
    if (!data.customerId && !data.contactName && !data.title && !data.supplierId && !data.workOrderId) {
      throw badRequest('Poné al menos un título, un cliente o un proveedor para identificar el evento');
    }

    const created = await prisma.appointment.create({
      data: { ...data, tenantId, plate: data.plate?.toUpperCase(), createdById: req.currentUser!.id },
      include,
    });

    // El evento no queda suelto en el calendario: se refleja en lo que representa
    await reflejar(created, tenantId, req.currentUser!.id);

    emitTenant(tenantId, SOCKET_EVENTS.APPOINTMENT_CHANGED, created);
    reply.code(201);
    return created;
  });

  app.patch('/:id', { preHandler: [app.authorize('appointment:write', 'billing:write', 'partsorder:write', 'delivery:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateAppointmentSchema.parse(req.body);
    const found = await prisma.appointment.findFirst({ where: { id, tenantId }, select: { id: true, kind: true } });
    if (!found) throw notFound('Cita no encontrada');

    // El permiso lo manda el tipo del evento, tanto el actual como al que se mueve
    const role = req.currentUser!.role;
    for (const k of [found.kind as AgendaKind, data.kind as AgendaKind | undefined].filter(Boolean) as AgendaKind[]) {
      if (!can(role, AGENDA_KIND_DEFS[k].write)) {
        throw forbidden(`Tu rol no puede editar un evento de tipo "${AGENDA_KIND_DEFS[k].label}"`);
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { ...data, ...(data.plate ? { plate: data.plate.toUpperCase() } : {}) },
      include,
    });
    await reflejar(updated, tenantId, req.currentUser!.id);
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

/**
 * Un evento de agenda no es sólo una fila del calendario: representa algo que
 * ya existe en el sistema. Acá se refleja para que las dos vistas coincidan.
 *
 * - Una **entrega al cliente** fija la fecha comprometida de la OT y deja el
 *   movimiento en el historial.
 * - Una **llegada de proveedor** anota la fecha esperada del pedido.
 *
 * Si algo falla no se rompe el alta del evento: la agenda es la fuente y el
 * reflejo es una comodidad.
 */
async function reflejar(
  ev: { id: string; kind: string; scheduledAt: Date; workOrderId: string | null; partsOrderId: string | null; title: string | null },
  tenantId: string,
  userId: string,
) {
  try {
    if (ev.kind === 'ENTREGA' && ev.workOrderId) {
      const wo = await prisma.workOrder.findFirst({
        where: { id: ev.workOrderId, tenantId },
        select: { id: true, promisedAt: true, status: true },
      });
      if (wo && wo.promisedAt?.getTime() !== ev.scheduledAt.getTime()) {
        await prisma.workOrder.update({ where: { id: wo.id }, data: { promisedAt: ev.scheduledAt } });
        await prisma.workOrderStatusHistory.create({
          data: {
            tenantId,
            workOrderId: wo.id,
            fromStatus: wo.status,
            toStatus: wo.status,
            note: `Entrega agendada para el ${ev.scheduledAt.toLocaleString('es-UY', { timeZone: 'America/Montevideo' })}`,
            userId,
          },
        });
        emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_UPDATED, { id: wo.id });
      }
    }

    if (ev.kind === 'ENTREGA_PROVEEDOR' && ev.partsOrderId) {
      await prisma.partsOrder.updateMany({
        where: { id: ev.partsOrderId, tenantId },
        data: { expectedAt: ev.scheduledAt },
      });
    }
  } catch (err) {
    // el reflejo es best-effort: se registra y se sigue
    console.warn('[agenda] no se pudo reflejar el evento', ev.id, (err as Error).message);
  }
}
