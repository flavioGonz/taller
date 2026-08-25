import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createDocumentSchema, createPaymentSchema, paginationSchema, idParamSchema, computeLine, round2 } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { skipTake, toPaginated } from '../lib/pagination.js';
import { badRequest, notFound } from '../lib/errors.js';

const PREFIX: Record<string, string> = { PRESUPUESTO: 'PRE', FACTURA: 'FAC', REMITO: 'REM', RECIBO: 'REC' };
const COUNTER_KEY: Record<string, 'presupuesto' | 'factura' | 'remito' | 'recibo'> = {
  PRESUPUESTO: 'presupuesto', FACTURA: 'factura', REMITO: 'remito', RECIBO: 'recibo',
};

export default async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/documents', { preHandler: [app.authorize('billing:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { type, status, customerId } = req.query as { type?: string; status?: string; customerId?: string };
    const where: Prisma.DocumentWhereInput = {
      tenantId,
      ...(type ? { type: type as Prisma.EnumDocumentTypeFilter['equals'] } : {}),
      ...(status ? { status: status as Prisma.EnumDocumentStatusFilter['equals'] } : {}),
      ...(customerId ? { customerId } : {}),
      ...(q.q ? { number: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.document.findMany({
        where, ...skipTake(q.page, q.limit), orderBy: { issueDate: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true } },
          workOrder: { select: { id: true, number: true } },
        },
      }),
      prisma.document.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.get('/documents/:id', { preHandler: [app.authorize('billing:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const doc = await prisma.document.findFirst({
      where: { id, tenantId: req.scope() },
      include: { lines: true, payments: true, customer: true, workOrder: { select: { id: true, number: true } } },
    });
    if (!doc) throw notFound('Documento no encontrado');
    return doc;
  });

  // Emitir presupuesto/factura (opcionalmente derivado de una OT)
  app.post('/documents', { preHandler: [app.authorize('billing:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createDocumentSchema.parse(req.body);

    const totals = data.lines.reduce(
      (acc, l) => {
        const t = computeLine(l);
        return { subtotal: round2(acc.subtotal + t.net), discount: round2(acc.discount + t.discount), tax: round2(acc.tax + t.tax) };
      },
      { subtotal: 0, discount: 0, tax: 0 },
    );

    const doc = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, tenantId, COUNTER_KEY[data.type]!, { prefix: PREFIX[data.type]!, pad: 6 });
      return tx.document.create({
        data: {
          tenantId, type: data.type, number, status: 'EMITIDO',
          customerId: data.customerId, workOrderId: data.workOrderId,
          dueDate: data.dueDate, currency: data.currency, notes: data.notes,
          subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax,
          total: round2(totals.subtotal + totals.tax),
          lines: {
            create: data.lines.map((l) => ({
              tenantId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
              discountPct: l.discountPct, taxPct: l.taxPct, total: computeLine(l).total,
            })),
          },
        },
        include: { lines: true },
      });
    });

    reply.code(201);
    return doc;
  });

  // Generar el presupuesto directamente desde una OT
  app.post('/documents/from-workorder/:id', { preHandler: [app.authorize('billing:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { type = 'PRESUPUESTO' } = (req.body ?? {}) as { type?: 'PRESUPUESTO' | 'FACTURA' };

    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null }, include: { items: true } });
    if (!wo) throw notFound('OT no encontrada');
    if (wo.items.length === 0) throw badRequest('La OT no tiene ítems para facturar');

    const lines = wo.items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      taxPct: Number(i.taxPct),
    }));
    const totals = lines.reduce(
      (acc, l) => {
        const t = computeLine(l);
        return { subtotal: round2(acc.subtotal + t.net), discount: round2(acc.discount + t.discount), tax: round2(acc.tax + t.tax) };
      },
      { subtotal: 0, discount: 0, tax: 0 },
    );

    const doc = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, tenantId, COUNTER_KEY[type]!, { prefix: PREFIX[type]!, pad: 6 });
      const created = await tx.document.create({
        data: {
          tenantId, type, number, status: 'EMITIDO', customerId: wo.customerId, workOrderId: wo.id,
          currency: wo.currency, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax,
          total: round2(totals.subtotal + totals.tax),
          lines: {
            create: lines.map((l) => ({
              tenantId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
              discountPct: l.discountPct, taxPct: l.taxPct, total: computeLine(l).total,
            })),
          },
        },
        include: { lines: true },
      });
      if (type === 'PRESUPUESTO' && wo.status === 'DIAGNOSTICO') {
        await tx.workOrder.update({ where: { id: wo.id }, data: { status: 'PRESUPUESTADO' } });
        await tx.workOrderStatusHistory.create({
          data: { tenantId, workOrderId: wo.id, fromStatus: 'DIAGNOSTICO', toStatus: 'PRESUPUESTADO', userId: req.currentUser!.id, note: `Presupuesto ${number}` },
        });
      }
      return created;
    });

    reply.code(201);
    return doc;
  });

  // Registrar pago
  app.post('/documents/:id/payments', { preHandler: [app.authorize('billing:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = createPaymentSchema.parse(req.body);

    const doc = await prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw notFound('Documento no encontrado');
    if (doc.status === 'ANULADO') throw badRequest('El documento está anulado');

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { tenantId, documentId: id, method: data.method, amount: data.amount, currency: doc.currency, reference: data.reference, paidAt: data.paidAt ?? new Date() },
      });
      const paid = round2(Number(doc.paid) + data.amount);
      const status = paid >= Number(doc.total) ? 'PAGADO' : paid > 0 ? 'PARCIAL' : doc.status;
      await tx.document.update({ where: { id }, data: { paid, status } });
      return payment;
    });

    reply.code(201);
    return result;
  });

  app.post('/documents/:id/void', { preHandler: [app.authorize('billing:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const doc = await prisma.document.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!doc) throw notFound('Documento no encontrado');
    return prisma.document.update({ where: { id }, data: { status: 'ANULADO' } });
  });
}
