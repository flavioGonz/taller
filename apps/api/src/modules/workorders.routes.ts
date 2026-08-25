import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  createWorkOrderSchema, updateWorkOrderSchema, changeStatusSchema, workOrderQuerySchema,
  idParamSchema, computeLine, computeTotals, canTransition, SOCKET_EVENTS,
  type WorkOrderStatus,
} from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { newAuditId } from '../lib/audit-id.js';
import { skipTake, toPaginated, safeOrderBy } from '../lib/pagination.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { emitTenant, emitWorkOrder, emitUser } from '../plugins/socket.js';
import { raiseInsight } from '../lib/insights.js';

const SORTABLE = ['receivedAt', 'number', 'status', 'grandTotal', 'promisedAt'] as const;

const detailInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true, email: true } },
  vehicle: {
    select: {
      id: true, plate: true, brand: true, model: true, year: true, vin: true, color: true, mileage: true, photoUrl: true,
      brandRef: { select: { id: true, name: true, logoFile: true } },
    },
  },
  technician: { select: { id: true, firstName: true, lastName: true, specialty: true } },
  bay: { select: { id: true, name: true } },
  items: { orderBy: { createdAt: 'asc' } },
  history: { orderBy: { createdAt: 'desc' }, include: { user: { select: { firstName: true, lastName: true } } } },
  attachments: true,
} satisfies Prisma.WorkOrderInclude;

/** Recalcula y persiste los totales de la OT a partir de sus ítems. */
async function recalcTotals(db: Prisma.TransactionClient, workOrderId: string) {
  const items = await db.workOrderItem.findMany({ where: { workOrderId } });
  const totals = computeTotals(
    items.map((i) => ({
      kind: i.kind,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      taxPct: Number(i.taxPct),
    })),
  );
  return db.workOrder.update({
    where: { id: workOrderId },
    data: {
      laborTotal: totals.laborTotal,
      partsTotal: totals.partsTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
    },
  });
}

export default async function workOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ---------------------------------------------------------------- listado
  app.get('/', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const tenantId = req.scope();
    const q = workOrderQuerySchema.parse(req.query);
    const user = req.currentUser!;

    // `kinds=SINIESTRO,CHAPA_PINTURA` → las páginas de Ingresos agrupan varios tipos
    const { kinds, insured } = req.query as { kinds?: string; insured?: string };
    const kindFilter = (kinds ?? '').split(',').map((k) => k.trim()).filter(Boolean);

    const where: Prisma.WorkOrderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.technicianId ? { technicianId: q.technicianId } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
      ...(q.from || q.to ? { receivedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.promisedFrom || q.promisedTo
        ? { promisedAt: { ...(q.promisedFrom ? { gte: q.promisedFrom } : {}), ...(q.promisedTo ? { lte: q.promisedTo } : {}) } }
        : {}),
      ...(kindFilter.length > 0 ? { kind: { in: kindFilter as never } } : {}),
      // `insured=true|false` separa lo que va por compañía de lo particular
      ...(insured === 'true' ? { insuranceCase: { isNot: null } } : {}),
      ...(insured === 'false' ? { insuranceCase: { is: null } } : {}),
      // Alcance reducido: el técnico ve lo suyo, el cliente sólo sus vehículos
      ...(user.role === 'TECNICO' ? { technicianId: user.id } : {}),
      ...(user.role === 'CLIENTE' ? { customer: { portalUser: { id: user.id } } } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q, mode: 'insensitive' } },
              { auditId: { contains: q.q.toUpperCase() } },
              { vehicle: { plate: { contains: q.q.toUpperCase() } } },
              { customer: { lastName: { contains: q.q, mode: 'insensitive' } } },
              { customer: { companyName: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        ...skipTake(q.page, q.limit),
        orderBy: safeOrderBy(q.sort, q.order, SORTABLE, 'receivedAt'),
        select: {
          id: true, number: true, auditId: true, kind: true, status: true, priority: true,
          receivedAt: true, promisedAt: true, deliveredAt: true,
          laborTotal: true, partsTotal: true, grandTotal: true, currency: true, bayId: true, technicianId: true,
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true } },
          vehicle: {
            select: {
              id: true, plate: true, brand: true, model: true, year: true, color: true, photoUrl: true,
              brandRef: { select: { name: true, logoFile: true } },
            },
          },
          technician: { select: { id: true, firstName: true, lastName: true } },
          bay: { select: { id: true, name: true } },
          insuranceCase: { select: { status: true, insurer: { select: { name: true } } } },
          _count: { select: { items: true, quotes: true } },
        },
      }),
      prisma.workOrder.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  // -------------------------------------------- contadores por tipo de ingreso
  // Alimenta el menú "Ingresos" y el tablero de /ingresos.
  app.get('/intake-counts', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const tenantId = req.scope();
    const user = req.currentUser!;
    const { closed } = req.query as { closed?: string };

    const base: Prisma.WorkOrderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(closed === 'true' ? {} : { status: { notIn: ['ENTREGADO', 'CANCELADO'] } }),
      ...(user.role === 'TECNICO' ? { technicianId: user.id } : {}),
    };

    const [byKind, conSeguro, sinSeguro, total] = await Promise.all([
      prisma.workOrder.groupBy({ by: ['kind'], where: base, _count: { _all: true } }),
      prisma.workOrder.count({ where: { ...base, insuranceCase: { isNot: null } } }),
      prisma.workOrder.count({ where: { ...base, insuranceCase: { is: null }, kind: { not: 'SINIESTRO' } } }),
      prisma.workOrder.count({ where: base }),
    ]);

    const kinds = Object.fromEntries(byKind.map((k) => [k.kind, k._count._all]));
    return {
      total,
      kinds,
      channels: {
        siniestros: kinds.SINIESTRO ?? 0,
        particulares: sinSeguro,
        aseguradora: conSeguro,
        mantenimiento: kinds.MANTENIMIENTO ?? 0,
        reparacion: kinds.REPARACION ?? 0,
        diagnostico: kinds.DIAGNOSTICO ?? 0,
        'chapa-pintura': kinds.CHAPA_PINTURA ?? 0,
        neumaticos: kinds.NEUMATICOS ?? 0,
        garantia: kinds.GARANTIA ?? 0,
        preentrega: kinds.PREENTREGA ?? 0,
      } as Record<string, number>,
    };
  });

  // ------------------------------------------------------- tablero (kanban)
  app.get('/board', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const tenantId = req.scope();
    const user = req.currentUser!;
    const rows = await prisma.workOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['ENTREGADO', 'CANCELADO'] },
        ...(user.role === 'TECNICO' ? { technicianId: user.id } : {}),
      },
      orderBy: [{ priority: 'desc' }, { receivedAt: 'asc' }],
      select: {
        id: true, number: true, auditId: true, kind: true, status: true, priority: true,
        receivedAt: true, promisedAt: true, laborTotal: true, partsTotal: true, grandTotal: true, currency: true,
        customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true, phone: true } },
        vehicle: {
          select: {
            id: true, plate: true, brand: true, model: true, year: true, color: true, photoUrl: true,
            brandRef: { select: { name: true, logoFile: true } },
          },
        },
        technician: { select: { id: true, firstName: true, lastName: true } },
        bay: { select: { id: true, name: true } },
        insuranceCase: { select: { status: true, insurer: { select: { name: true } } } },
        _count: { select: { items: true, quotes: true } },
      },
    });
    return rows;
  });

  // ----------------------------------------------------------------- detalle
  app.get('/:id', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId: req.scope(), deletedAt: null }, include: detailInclude });
    if (!wo) throw notFound('OT no encontrada');
    if (req.currentUser!.role === 'TECNICO' && wo.technicianId !== req.currentUser!.id) {
      throw forbidden('La OT está asignada a otro técnico');
    }
    return wo;
  });

  // ------------------------------------------------------------------ crear
  app.post('/', { preHandler: [app.authorize('workorder:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createWorkOrderSchema.parse(req.body);
    const userId = req.currentUser!.id;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, tenantId, customerId: data.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) throw badRequest('El vehículo no pertenece al cliente indicado');

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, tenantId, 'work_order', { prefix: 'OT' });
      const wo = await tx.workOrder.create({
        data: {
          tenantId,
          number,
          auditId: newAuditId(),
          kind: data.kind,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          technicianId: data.technicianId ?? null,
          bayId: data.bayId ?? null,
          priority: data.priority,
          complaint: data.complaint,
          mileageIn: data.mileageIn,
          fuelLevel: data.fuelLevel,
          promisedAt: data.promisedAt,
          checklistIn: (data.checklistIn ?? {}) as object,
          createdById: userId,
          items: {
            create: data.items.map((i) => ({
              tenantId,
              kind: i.kind,
              serviceId: i.serviceId ?? null,
              partId: i.partId ?? null,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountPct: i.discountPct,
              taxPct: i.taxPct,
              hours: i.hours ?? null,
              total: computeLine(i).total,
            })),
          },
          history: { create: { tenantId, toStatus: 'RECEPCION', userId, note: 'Ingreso del vehículo' } },
        },
      });

      if (data.mileageIn) {
        await tx.vehicle.update({ where: { id: data.vehicleId }, data: { mileage: data.mileageIn } });
      }
      await recalcTotals(tx, wo.id);
      return tx.workOrder.findUniqueOrThrow({ where: { id: wo.id }, include: detailInclude });
    });

    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_CREATED, created);
    if (created.technicianId) emitUser(created.technicianId, SOCKET_EVENTS.NOTIFICATION, { type: 'assigned', workOrder: { id: created.id, number: created.number } });

    reply.code(201);
    return created;
  });

  // ---------------------------------------------------------------- editar
  app.patch('/:id', { preHandler: [app.authorize('workorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateWorkOrderSchema.parse(req.body);
    const user = req.currentUser!;

    const current = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!current) throw notFound('OT no encontrada');
    if (user.role === 'TECNICO' && current.technicianId !== user.id) throw forbidden('La OT está asignada a otro técnico');
    if (current.status === 'ENTREGADO' || current.status === 'CANCELADO') throw badRequest('La OT está cerrada');

    const { items, ...rest } = data;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        data: {
          ...rest,
          ...(rest.customerApproved === true && !current.customerApproved ? { customerApprovedAt: new Date() } : {}),
        },
        where: { id },
      });

      if (items) {
        await tx.workOrderItem.deleteMany({ where: { workOrderId: id } });
        if (items.length > 0) {
          await tx.workOrderItem.createMany({
            data: items.map((i) => ({
              tenantId, workOrderId: id, kind: i.kind,
              serviceId: i.serviceId ?? null, partId: i.partId ?? null,
              description: i.description, quantity: i.quantity, unitPrice: i.unitPrice,
              discountPct: i.discountPct, taxPct: i.taxPct, hours: i.hours ?? null,
              total: computeLine(i).total,
            })),
          });
        }
        await recalcTotals(tx, id);
      }
      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });

    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_UPDATED, updated);
    emitWorkOrder(id, SOCKET_EVENTS.WORKORDER_UPDATED, updated);
    return updated;
  });

  // ------------------------------------------------- cambio de estado (OT)
  app.post('/:id/status', { preHandler: [app.authorize('workorder:status')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { status, note } = changeStatusSchema.parse(req.body);
    const user = req.currentUser!;

    const wo = await prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: { where: { kind: 'REPUESTO' } } },
    });
    if (!wo) throw notFound('OT no encontrada');
    if (user.role === 'TECNICO' && wo.technicianId !== user.id) throw forbidden('La OT está asignada a otro técnico');

    const from = wo.status as WorkOrderStatus;
    if (from === status) return wo;
    if (!canTransition(from, status)) {
      throw badRequest(`Transición no permitida: ${from} → ${status}`);
    }
    if (status === 'EN_PROCESO' && !wo.customerApproved && wo.grandTotal.greaterThan(0) && from === 'PRESUPUESTADO') {
      throw badRequest('El presupuesto aún no fue aprobado por el cliente');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Descuento de stock al pasar a EN_PROCESO (una sola vez)
      if (status === 'EN_PROCESO' && from !== 'ESPERA_REPUESTO') {
        const warehouse = await tx.warehouse.findFirst({ where: { tenantId, isDefault: true } })
          ?? await tx.warehouse.findFirst({ where: { tenantId } });
        if (warehouse) {
          for (const item of wo.items) {
            if (!item.partId) continue;
            const already = await tx.stockMovement.findFirst({
              where: { workOrderId: id, partId: item.partId, type: 'SALIDA' }, select: { id: true },
            });
            if (already) continue;
            await tx.stockMovement.create({
              data: {
                tenantId, partId: item.partId, warehouseId: warehouse.id, type: 'SALIDA',
                quantity: item.quantity, workOrderId: id, userId: user.id, reference: wo.number,
                note: 'Consumo automático por inicio de trabajo',
              },
            });
            await tx.partStock.upsert({
              where: { partId_warehouseId: { partId: item.partId, warehouseId: warehouse.id } },
              create: { tenantId, partId: item.partId, warehouseId: warehouse.id, quantity: item.quantity.negated() },
              update: { quantity: { decrement: item.quantity } },
            });
          }
        }
      }

      const data: Prisma.WorkOrderUpdateInput = { status };
      if (status === 'EN_PROCESO' && !wo.startedAt) data.startedAt = new Date();
      if (status === 'FINALIZADO') data.finishedAt = new Date();
      if (status === 'ENTREGADO') data.deliveredAt = new Date();

      await tx.workOrder.update({ where: { id }, data });
      await tx.workOrderStatusHistory.create({
        data: { tenantId, workOrderId: id, fromStatus: from, toStatus: status, userId: user.id, note },
      });
      return tx.workOrder.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });

    const payload = { id, number: wo.number, from, to: status, tenantId, byUserId: user.id, at: new Date().toISOString() };
    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, payload);
    emitWorkOrder(id, SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, payload);
    if (updated.technicianId) emitUser(updated.technicianId, SOCKET_EVENTS.NOTIFICATION, { type: 'status', workOrder: payload });

    // Señal para el Refactor Recommender: OTs que rebotan entre estados
    const bounces = await prisma.workOrderStatusHistory.count({ where: { workOrderId: id } });
    if (bounces > 12) {
      raiseInsight({
        agent: 'REFACTOR_RECOMMENDER', severity: 'INFO', code: 'WORKORDER_STATUS_CHURN',
        title: `La OT ${wo.number} acumula ${bounces} cambios de estado`,
        target: 'workorder:status', tenantId,
        metrics: { workOrderId: id, changes: bounces },
        suggestion: 'Posible fricción en el flujo: evaluar sub-estados o checklist de control de calidad antes de FINALIZADO.',
      });
    }
    return updated;
  });

  // ---------------------------------------------------------- parte de horas
  app.post('/:id/time', { preHandler: [app.authorize('workorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { minutes, note } = (req.body ?? {}) as { minutes?: number; note?: string };
    if (!minutes || minutes <= 0) throw badRequest('minutes debe ser mayor a 0');
    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!wo) throw notFound('OT no encontrada');
    return prisma.workOrderTimeLog.create({
      data: { tenantId, workOrderId: id, userId: req.currentUser!.id, minutes, note, endedAt: new Date() },
    });
  });

  // -------------------------------------------------------------- anulación
  app.delete('/:id', { preHandler: [app.authorize('workorder:delete')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!wo) throw notFound('OT no encontrada');
    await prisma.workOrder.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELADO' } });
    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_DELETED, { id });
    return { ok: true };
  });
}
