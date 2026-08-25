import type { FastifyInstance } from 'fastify';
import { qualityCheckSchema, deliverySchema, idParamSchema, computeLine, round2, SOCKET_EVENTS } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { badRequest, notFound } from '../lib/errors.js';
import { emitTenant, emitWorkOrder } from '../plugins/socket.js';

/**
 * Las dos puertas finales del flujo: control de calidad y entrega.
 * Se montan sobre /api/work-orders porque siempre operan sobre una OT concreta.
 */
export default async function flowRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ------------------------------------------------- CONTROL DE CALIDAD
  app.get('/:id/quality', { preHandler: [app.authorize('quality:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return prisma.qualityCheck.findMany({
      where: { workOrderId: id, tenantId: req.scope() },
      orderBy: { createdAt: 'desc' },
      include: { inspector: { select: { firstName: true, lastName: true } } },
    });
  });

  app.post('/:id/quality', { preHandler: [app.authorize('quality:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = qualityCheckSchema.parse(req.body);

    const wo = await prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, status: true, number: true },
    });
    if (!wo) throw notFound('OT no encontrada');

    const result = await prisma.$transaction(async (tx) => {
      const check = await tx.qualityCheck.create({
        data: {
          tenantId, workOrderId: id, result: data.result, checklist: data.checklist as object,
          roadTest: data.roadTest, roadTestKm: data.roadTestKm, observations: data.observations,
          inspectorId: req.currentUser!.id,
        },
      });

      // Aprobado sigue a lavado; rechazado vuelve al taller
      const next = data.result === 'RECHAZADO' ? 'EN_PROCESO' : 'LAVADO';
      if (wo.status !== next) {
        await tx.workOrder.update({ where: { id }, data: { status: next } });
        await tx.workOrderStatusHistory.create({
          data: {
            tenantId, workOrderId: id, fromStatus: wo.status as never, toStatus: next,
            userId: req.currentUser!.id,
            note: `Control de calidad: ${data.result.toLowerCase().replace(/_/g, ' ')}${data.observations ? ` — ${data.observations}` : ''}`,
          },
        });
      }
      return check;
    });

    emitTenant(tenantId, SOCKET_EVENTS.QUALITY_CHECKED, { workOrderId: id, number: wo.number, result: data.result });
    emitWorkOrder(id, SOCKET_EVENTS.QUALITY_CHECKED, { workOrderId: id, result: data.result });
    reply.code(201);
    return result;
  });

  // -------------------------------------------------------------- ENTREGA
  app.get('/:id/delivery', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return prisma.delivery.findFirst({ where: { workOrderId: id, tenantId: req.scope() } });
  });

  app.post('/:id/deliver', { preHandler: [app.authorize('delivery:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = deliverySchema.parse(req.body);

    const wo = await prisma.workOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true, vehicle: { select: { id: true, mileage: true } } },
    });
    if (!wo) throw notFound('OT no encontrada');
    if (wo.status === 'ENTREGADO') throw badRequest('La OT ya fue entregada');
    if (!['FINALIZADO', 'LAVADO', 'CONTROL_CALIDAD', 'RECHAZADO'].includes(wo.status)) {
      throw badRequest(`No se puede entregar una OT en estado ${wo.status}`);
    }

    const warrantyUntil = data.warrantyDays
      ? new Date(Date.now() + data.warrantyDays * 24 * 3600 * 1000)
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.upsert({
        where: { workOrderId: id },
        create: {
          tenantId, workOrderId: id, receivedBy: data.receivedBy, receivedDoc: data.receivedDoc,
          mileageOut: data.mileageOut, fuelLevelOut: data.fuelLevelOut, signatureUrl: data.signatureUrl,
          observations: data.observations, warrantyDays: data.warrantyDays, warrantyUntil,
          nextServiceKm: data.nextServiceKm, nextServiceAt: data.nextServiceAt,
          deliveredById: req.currentUser!.id,
        },
        update: {
          receivedBy: data.receivedBy, receivedDoc: data.receivedDoc, mileageOut: data.mileageOut,
          fuelLevelOut: data.fuelLevelOut, signatureUrl: data.signatureUrl, observations: data.observations,
          warrantyDays: data.warrantyDays, warrantyUntil,
          nextServiceKm: data.nextServiceKm, nextServiceAt: data.nextServiceAt,
        },
      });

      await tx.workOrder.update({
        where: { id },
        data: { status: 'ENTREGADO', deliveredAt: new Date(), warrantyUntil },
      });
      await tx.workOrderStatusHistory.create({
        data: {
          tenantId, workOrderId: id, fromStatus: wo.status as never, toStatus: 'ENTREGADO',
          userId: req.currentUser!.id,
          note: `Entregado a ${data.receivedBy ?? 'el cliente'}${data.warrantyDays ? ` · garantía ${data.warrantyDays} días` : ''}`,
        },
      });

      if (data.mileageOut) {
        await tx.vehicle.update({ where: { id: wo.vehicleId }, data: { mileage: data.mileageOut } });
      }

      // Factura al entregar, si se pidió y aún no existe
      let invoice = null;
      if (data.invoice && wo.items.length > 0) {
        const already = await tx.document.findFirst({ where: { workOrderId: id, type: 'FACTURA', status: { not: 'ANULADO' } } });
        if (!already) {
          const lines = wo.items.map((i) => ({
            description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
            discountPct: Number(i.discountPct), taxPct: Number(i.taxPct),
          }));
          const t = lines.reduce(
            (acc, l) => {
              const c = computeLine(l);
              return { subtotal: round2(acc.subtotal + c.net), discount: round2(acc.discount + c.discount), tax: round2(acc.tax + c.tax) };
            },
            { subtotal: 0, discount: 0, tax: 0 },
          );
          const number = await nextNumber(tx, tenantId, 'factura', { prefix: 'FAC', pad: 6 });
          invoice = await tx.document.create({
            data: {
              tenantId, type: 'FACTURA', number, status: 'EMITIDO', customerId: wo.customerId, workOrderId: id,
              currency: wo.currency, subtotal: t.subtotal, discount: t.discount, tax: t.tax,
              total: round2(t.subtotal + t.tax),
              lines: { create: lines.map((l) => ({ tenantId, ...l, total: computeLine(l).total })) },
            },
          });
        }
      }

      // Postventa automática: encuesta a los 2 días y recordatorio de service
      const dueSurvey = new Date(Date.now() + 2 * 24 * 3600 * 1000);
      await tx.followUp.create({
        data: {
          tenantId, workOrderId: id, customerId: wo.customerId, vehicleId: wo.vehicleId,
          kind: 'SATISFACCION', dueAt: dueSurvey,
          notes: 'Llamar para confirmar que el vehículo quedó bien.',
        },
      });
      if (data.nextServiceAt || data.nextServiceKm) {
        await tx.followUp.create({
          data: {
            tenantId, workOrderId: id, customerId: wo.customerId, vehicleId: wo.vehicleId,
            kind: 'RECORDATORIO_SERVICE',
            dueAt: data.nextServiceAt ?? new Date(Date.now() + 180 * 24 * 3600 * 1000),
            notes: data.nextServiceKm ? `Próximo service a los ${data.nextServiceKm} km.` : 'Próximo service.',
          },
        });
      }

      return { delivery, invoice };
    });

    emitTenant(tenantId, SOCKET_EVENTS.VEHICLE_DELIVERED, { workOrderId: id, number: wo.number });
    emitWorkOrder(id, SOCKET_EVENTS.VEHICLE_DELIVERED, { workOrderId: id });
    reply.code(201);
    return result;
  });

  // ---------------------------------------------- resumen del expediente
  app.get('/:id/timeline', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();

    const [wo, quotes, orders, checks, delivery, inspections] = await Promise.all([
      prisma.workOrder.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, number: true, status: true, receivedAt: true, startedAt: true, finishedAt: true, deliveredAt: true, warrantyUntil: true },
      }),
      prisma.quote.findMany({
        where: { workOrderId: id, tenantId },
        orderBy: { version: 'asc' },
        select: { id: true, number: true, version: true, status: true, total: true, approvedTotal: true, sentAt: true, decidedAt: true, decisionChannel: true, decidedByName: true },
      }),
      prisma.partsOrder.findMany({
        where: { workOrderId: id, tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, number: true, status: true, expectedAt: true, receivedAt: true, total: true, supplier: { select: { name: true } } },
      }),
      prisma.qualityCheck.findMany({ where: { workOrderId: id, tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.delivery.findFirst({ where: { workOrderId: id, tenantId } }),
      prisma.inspection.findMany({
        where: { workOrderId: id, tenantId },
        select: { id: true, kind: true, createdAt: true, signedAt: true, _count: { select: { photos: true, damages: true } } },
      }),
    ]);
    if (!wo) throw notFound('OT no encontrada');
    return { workOrder: wo, inspections, quotes, partsOrders: orders, qualityChecks: checks, delivery };
  });
}
