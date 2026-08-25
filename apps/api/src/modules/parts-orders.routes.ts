import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  createPartsOrderSchema, updatePartsOrderSchema, receivePartsSchema,
  paginationSchema, idParamSchema, round2, SOCKET_EVENTS,
} from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { badRequest, notFound } from '../lib/errors.js';
import { emitTenant } from '../plugins/socket.js';

const include = {
  items: { include: { part: { select: { id: true, sku: true, name: true } } } },
  supplier: { select: { id: true, name: true, phone: true, email: true } },
  workOrder: { select: { id: true, number: true, status: true, vehicle: { select: { plate: true, brand: true, model: true } } } },
} satisfies Prisma.PartsOrderInclude;

const lineTotal = (qty: number, cost: number) => round2(qty * cost);

/** Pedidos a proveedor: es lo que sostiene la etapa "espera repuesto" de la OT. */
export default async function partsOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('partsorder:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { status, workOrderId } = req.query as { status?: string; workOrderId?: string };
    const where: Prisma.PartsOrderWhereInput = {
      tenantId,
      ...(status ? { status: status as Prisma.EnumPartsOrderStatusFilter['equals'] } : {}),
      ...(workOrderId ? { workOrderId } : {}),
      ...(q.q ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { reference: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.partsOrder.findMany({ where, ...skipTake(q.page, q.limit), orderBy: { createdAt: 'desc' }, include }),
      prisma.partsOrder.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.get('/:id', { preHandler: [app.authorize('partsorder:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const order = await prisma.partsOrder.findFirst({ where: { id, tenantId: req.scope() }, include });
    if (!order) throw notFound('Pedido no encontrado');
    return order;
  });

  app.post('/', { preHandler: [app.authorize('partsorder:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createPartsOrderSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, tenantId, 'pedido', { prefix: 'PED', pad: 5 });
      const total = data.items.reduce((acc, i) => round2(acc + lineTotal(i.quantity, i.unitCost)), 0);
      const order = await tx.partsOrder.create({
        data: {
          tenantId, number, workOrderId: data.workOrderId, supplierId: data.supplierId,
          expectedAt: data.expectedAt, reference: data.reference, notes: data.notes,
          total, createdById: req.currentUser!.id,
          items: {
            create: data.items.map((i) => ({
              tenantId, partId: i.partId ?? null, description: i.description,
              quantity: i.quantity, unitCost: i.unitCost, total: lineTotal(i.quantity, i.unitCost),
            })),
          },
        },
      });
      return tx.partsOrder.findUniqueOrThrow({ where: { id: order.id }, include });
    });

    emitTenant(tenantId, SOCKET_EVENTS.PARTS_ORDER_CHANGED, { id: created.id, status: created.status });
    reply.code(201);
    return created;
  });

  app.patch('/:id', { preHandler: [app.authorize('partsorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updatePartsOrderSchema.parse(req.body);
    const order = await prisma.partsOrder.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!order) throw notFound('Pedido no encontrado');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.partsOrder.update({
        where: { id },
        data: {
          supplierId: data.supplierId, status: data.status, expectedAt: data.expectedAt,
          reference: data.reference, notes: data.notes,
        },
      });
      if (data.items) {
        if (order.status !== 'BORRADOR' && order.status !== 'SOLICITADO') {
          throw badRequest('No se pueden cambiar los ítems de un pedido ya confirmado');
        }
        await tx.partsOrderItem.deleteMany({ where: { partsOrderId: id } });
        await tx.partsOrderItem.createMany({
          data: data.items.map((i) => ({
            tenantId, partsOrderId: id, partId: i.partId ?? null, description: i.description,
            quantity: i.quantity, unitCost: i.unitCost, total: lineTotal(i.quantity, i.unitCost),
          })),
        });
        const total = data.items.reduce((acc, i) => round2(acc + lineTotal(i.quantity, i.unitCost)), 0);
        await tx.partsOrder.update({ where: { id }, data: { total } });
      }
      return tx.partsOrder.findUniqueOrThrow({ where: { id }, include });
    });

    emitTenant(tenantId, SOCKET_EVENTS.PARTS_ORDER_CHANGED, { id, status: updated.status });
    return updated;
  });

  // ------------------------------------------------- recepción de mercadería
  app.post('/:id/receive', { preHandler: [app.authorize('partsorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = receivePartsSchema.parse(req.body);

    const order = await prisma.partsOrder.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!order) throw notFound('Pedido no encontrado');

    const warehouse = data.warehouseId
      ? await prisma.warehouse.findFirst({ where: { id: data.warehouseId, tenantId } })
      : (await prisma.warehouse.findFirst({ where: { tenantId, isDefault: true } })) ??
        (await prisma.warehouse.findFirst({ where: { tenantId } }));
    if (!warehouse) throw badRequest('No hay depósitos configurados');

    const result = await prisma.$transaction(async (tx) => {
      for (const line of data.lines) {
        const item = order.items.find((i) => i.id === line.itemId);
        if (!item) continue;
        const delta = round2(line.received - Number(item.received));
        if (delta <= 0) continue;

        await tx.partsOrderItem.update({ where: { id: item.id }, data: { received: line.received } });

        // Sólo entra al stock lo que está catalogado como repuesto
        if (item.partId) {
          await tx.stockMovement.create({
            data: {
              tenantId, partId: item.partId, warehouseId: warehouse.id, type: 'ENTRADA',
              quantity: delta, unitCost: item.unitCost, workOrderId: order.workOrderId,
              userId: req.currentUser!.id, reference: order.number, note: data.note ?? 'Recepción de pedido',
            },
          });
          await tx.partStock.upsert({
            where: { partId_warehouseId: { partId: item.partId, warehouseId: warehouse.id } },
            create: { tenantId, partId: item.partId, warehouseId: warehouse.id, quantity: delta },
            update: { quantity: { increment: delta } },
          });
          if (Number(item.unitCost) > 0) {
            await tx.part.update({ where: { id: item.partId }, data: { cost: item.unitCost } });
          }
        }
      }

      const items = await tx.partsOrderItem.findMany({ where: { partsOrderId: id } });
      const complete = items.every((i) => Number(i.received) >= Number(i.quantity));
      const partial = items.some((i) => Number(i.received) > 0);
      const status = complete ? 'RECIBIDO' : partial ? 'RECIBIDO_PARCIAL' : order.status;

      await tx.partsOrder.update({
        where: { id },
        data: { status: status as never, receivedAt: complete ? new Date() : null },
      });

      return tx.partsOrder.findUniqueOrThrow({ where: { id }, include });
    });

    emitTenant(tenantId, SOCKET_EVENTS.PARTS_RECEIVED, {
      id, number: result.number, status: result.status,
      workOrderId: result.workOrderId, workOrderNumber: result.workOrder?.number ?? null,
    });
    return result;
  });
}
