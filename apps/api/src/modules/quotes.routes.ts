import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  createQuoteSchema, updateQuoteSchema, sendQuoteSchema, decideQuoteSchema,
  idParamSchema, computeLine, computeTotals, round2, SOCKET_EVENTS,
} from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { nextNumber } from '../lib/counters.js';
import { badRequest, notFound } from '../lib/errors.js';
import { emitTenant, emitWorkOrder } from '../plugins/socket.js';
import { buildQuotePdf } from '../lib/quote-pdf.js';
import { sendMail, sendWhatsAppFile, mailConfigured, whatsappConfigured } from '../lib/notify.js';
import { env } from '../env.js';

const include = {
  items: { orderBy: { position: 'asc' as const } },
  workOrder: {
    select: {
      id: true, number: true, status: true, currency: true,
      customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true, email: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true, year: true } },
    },
  },
};

/** Recalcula los totales del presupuesto y el total sólo de lo aprobado. */
function totalsOf(items: { kind: string; quantity: unknown; unitPrice: unknown; discountPct: unknown; taxPct: unknown; decision?: string }[]) {
  const norm = items.map((i) => ({
    kind: i.kind,
    quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
    discountPct: Number(i.discountPct), taxPct: Number(i.taxPct),
    decision: i.decision,
  }));
  const all = computeTotals(norm);
  const approved = norm.filter((i) => i.decision === 'APROBADO');
  const approvedTotal = approved.length > 0 ? computeTotals(approved).grandTotal : 0;
  return { ...all, approvedTotal };
}

export default async function quoteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ------------------------------------------------------------- listado
  app.get('/', { preHandler: [app.authorize('quote:read')] }, async (req) => {
    const tenantId = req.scope();
    const { workOrderId, status } = req.query as { workOrderId?: string; status?: string };
    return prisma.quote.findMany({
      where: {
        tenantId,
        ...(workOrderId ? { workOrderId } : {}),
        ...(status ? { status: status as Prisma.EnumQuoteStatusFilter['equals'] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      include,
    });
  });

  app.get('/:id', { preHandler: [app.authorize('quote:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId: req.scope() }, include });
    if (!quote) throw notFound('Presupuesto no encontrado');
    return quote;
  });

  // -------------------------------------------------- nueva versión / alta
  app.post('/', { preHandler: [app.authorize('quote:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createQuoteSchema.parse(req.body);

    const wo = await prisma.workOrder.findFirst({
      where: { id: data.workOrderId, tenantId, deletedAt: null },
      select: { id: true, currency: true, status: true },
    });
    if (!wo) throw notFound('OT no encontrada');

    // Si copia una versión anterior, arrastra los ítems que el cliente no rechazó
    let items = data.items;
    if (data.fromQuoteId && items.length === 0) {
      const src = await prisma.quote.findFirst({
        where: { id: data.fromQuoteId, tenantId, workOrderId: wo.id },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      if (!src) throw notFound('Presupuesto de origen no encontrado');
      items = src.items
        .filter((i) => i.decision !== 'RECHAZADO')
        .map((i) => ({
          kind: i.kind, serviceId: i.serviceId ?? undefined, partId: i.partId ?? undefined,
          description: i.description, detail: i.detail ?? undefined,
          quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
          discountPct: Number(i.discountPct), taxPct: Number(i.taxPct),
          hours: i.hours ? Number(i.hours) : undefined,
          optional: i.optional, urgent: i.urgent,
        }));
    }

    const created = await prisma.$transaction(async (tx) => {
      const previous = await tx.quote.findFirst({
        where: { tenantId, workOrderId: wo.id },
        orderBy: { version: 'desc' },
        select: { id: true, number: true, version: true, status: true },
      });

      // Misma numeración, versión incremental: PRE-2026-000004 v2
      const number = previous?.number ?? (await nextNumber(tx, tenantId, 'presupuesto', { prefix: 'PRE', pad: 6 }));
      const version = (previous?.version ?? 0) + 1;

      if (previous && ['BORRADOR', 'ENVIADO'].includes(previous.status)) {
        await tx.quote.update({ where: { id: previous.id }, data: { status: 'SUPERSEDIDO' } });
      }

      const totals = totalsOf(items.map((i) => ({ ...i, decision: 'PENDIENTE' })));

      const quote = await tx.quote.create({
        data: {
          tenantId, workOrderId: wo.id, number, version,
          validUntil: data.validUntil, notes: data.notes, terms: data.terms,
          summary: data.summary, estimatedDays: data.estimatedDays,
          warrantyDays: data.warrantyDays ?? 90,
          currency: wo.currency, createdById: req.currentUser!.id,
          subtotal: totals.subtotal, discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal, total: totals.grandTotal, approvedTotal: 0,
          items: {
            create: items.map((i, idx) => ({
              tenantId, kind: i.kind, serviceId: i.serviceId ?? null, partId: i.partId ?? null,
              description: i.description, detail: i.detail ?? null,
              quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxPct: i.taxPct,
              hours: i.hours ?? null, optional: i.optional, urgent: i.urgent,
              total: computeLine(i).total, position: idx,
            })),
          },
        },
      });
      return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, include });
    });

    emitTenant(tenantId, SOCKET_EVENTS.QUOTE_CREATED, { id: created.id, workOrderId: wo.id, version: created.version });
    reply.code(201);
    return created;
  });

  // ------------------------------------------------------------- editar
  app.patch('/:id', { preHandler: [app.authorize('quote:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateQuoteSchema.parse(req.body);

    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!quote) throw notFound('Presupuesto no encontrado');
    if (!['BORRADOR', 'ENVIADO'].includes(quote.status)) {
      throw badRequest('Sólo se puede editar un presupuesto en borrador o enviado; creá una versión nueva');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: {
          validUntil: data.validUntil, notes: data.notes, terms: data.terms,
          summary: data.summary, estimatedDays: data.estimatedDays, warrantyDays: data.warrantyDays,
        },
      });

      if (data.items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        if (data.items.length > 0) {
          await tx.quoteItem.createMany({
            data: data.items.map((i, idx) => ({
              tenantId, quoteId: id, kind: i.kind, serviceId: i.serviceId ?? null, partId: i.partId ?? null,
              description: i.description, detail: i.detail ?? null,
              quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxPct: i.taxPct,
              hours: i.hours ?? null, optional: i.optional, urgent: i.urgent,
              total: computeLine(i).total, position: idx,
            })),
          });
        }
        const items = await tx.quoteItem.findMany({ where: { quoteId: id } });
        const t = totalsOf(items);
        await tx.quote.update({
          where: { id },
          data: { subtotal: t.subtotal, discountTotal: t.discountTotal, taxTotal: t.taxTotal, total: t.grandTotal, approvedTotal: t.approvedTotal },
        });
      }
      return tx.quote.findUniqueOrThrow({ where: { id }, include });
    });

    return updated;
  });

  // ------------------------------------------------------------- PDF
  app.get('/:id/pdf', { preHandler: [app.authorize('quote:read')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const { buffer, filename } = await buildQuotePdf(id, req.scope());
    const { download } = req.query as { download?: string };
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `${download === 'true' ? 'attachment' : 'inline'}; filename="${filename}"`)
      .header('Content-Length', buffer.length);
    return reply.send(buffer);
  });

  // Qué canales están realmente disponibles en esta instalación
  app.get('/delivery/channels', { preHandler: [app.authorize('quote:read')] }, async () => ({
    email: mailConfigured(),
    whatsapp: whatsappConfigured(),
  }));

  // ------------------------------- enviar al cliente (y marcar como enviado)
  app.post('/:id/send', { preHandler: [app.authorize('quote:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { channel, note, to, message, deliver } = sendQuoteSchema.parse(req.body ?? {});

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        workOrder: {
          select: {
            id: true, status: true, number: true,
            customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true, email: true, phone: true } },
            vehicle: { select: { plate: true, brand: true, model: true } },
          },
        },
      },
    });
    if (!quote) throw notFound('Presupuesto no encontrado');
    if (quote.items.length === 0) throw badRequest('El presupuesto no tiene ítems');

    // ---------------- entrega real por correo o WhatsApp ----------------
    let delivery: { channel: string; target: string; ok: boolean } | null = null;

    if (deliver && (channel === 'EMAIL' || channel === 'WHATSAPP')) {
      const c = quote.workOrder.customer;
      const who = c.isCompany ? (c.companyName ?? '') : [c.firstName, c.lastName].filter(Boolean).join(' ');
      const veh = `${quote.workOrder.vehicle.plate} · ${quote.workOrder.vehicle.brand} ${quote.workOrder.vehicle.model}`;
      const { buffer, filename } = await buildQuotePdf(id, tenantId);
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, phone: true } });

      if (channel === 'EMAIL') {
        const target = to || c.email;
        if (!target) throw badRequest('El cliente no tiene correo cargado');
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.55">
            <p>Hola ${who || ''},</p>
            <p>Te adjuntamos el presupuesto <strong>${quote.number}</strong> para tu vehículo <strong>${veh}</strong>.</p>
            ${message ? `<p>${message}</p>` : ''}
            <p>Cualquier duda respondé este correo o escribinos${tenant.phone ? ` al ${tenant.phone}` : ''}.</p>
            <p style="color:#64748b;font-size:13px">${tenant.name}</p>
          </div>`;
        await sendMail({
          to: target,
          subject: `Presupuesto ${quote.number} · ${veh}`,
          html,
          text: `Presupuesto ${quote.number} para ${veh}. ${message ?? ''}`,
          attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
        });
        delivery = { channel: 'EMAIL', target, ok: true };
      }

      if (channel === 'WHATSAPP') {
        const target = to || c.phone;
        if (!target) throw badRequest('El cliente no tiene teléfono cargado');
        const caption =
          message ??
          `Hola ${who || ''}, te enviamos el presupuesto ${quote.number} para ${veh}. ` +
            `Cualquier consulta respondenos por acá. ${tenant.name}`;
        await sendWhatsAppFile(target, { filename, content: buffer, mimetype: 'application/pdf' }, caption);
        delivery = { channel: 'WHATSAPP', target, ok: true };
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quote.update({
        where: { id },
        data: { status: 'ENVIADO', sentAt: new Date(), sentChannel: channel, notes: note ?? quote.notes },
      });
      // La OT queda a la espera de la respuesta del cliente
      if (['RECEPCION', 'DIAGNOSTICO'].includes(quote.workOrder.status)) {
        await tx.workOrder.update({ where: { id: quote.workOrderId }, data: { status: 'PRESUPUESTADO' } });
        await tx.workOrderStatusHistory.create({
          data: {
            tenantId, workOrderId: quote.workOrderId,
            fromStatus: quote.workOrder.status as never, toStatus: 'PRESUPUESTADO',
            userId: req.currentUser!.id, note: `Presupuesto ${q.number} v${q.version} enviado por ${channel.toLowerCase()}`,
          },
        });
      }
      return tx.quote.findUniqueOrThrow({ where: { id }, include });
    });

    emitTenant(tenantId, SOCKET_EVENTS.QUOTE_SENT, { id, workOrderId: quote.workOrderId });
    emitWorkOrder(quote.workOrderId, SOCKET_EVENTS.QUOTE_SENT, { id });
    return { ...updated, delivery, appUrl: env.APP_URL };
  });

  // ============================================================
  //  REGISTRAR LA RESPUESTA DEL CLIENTE (ítem por ítem)
  // ============================================================
  app.post('/:id/decide', { preHandler: [app.authorize('quote:decide')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = decideQuoteSchema.parse(req.body);

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
      include: { items: true, workOrder: { select: { id: true, status: true, number: true } } },
    });
    if (!quote) throw notFound('Presupuesto no encontrado');
    if (['ANULADO', 'SUPERSEDIDO'].includes(quote.status)) throw badRequest('El presupuesto ya no está vigente');

    const byId = new Map(data.decisions.map((d) => [d.itemId, d]));
    const resolved = quote.items.map((i) => {
      const explicit = byId.get(i.id);
      const decision = explicit?.decision ?? data.all ?? i.decision;
      return { ...i, decision, decisionNote: explicit?.note ?? i.decisionNote };
    });

    const approved = resolved.filter((i) => i.decision === 'APROBADO');
    const rejected = resolved.filter((i) => i.decision === 'RECHAZADO');
    const pending = resolved.filter((i) => i.decision === 'PENDIENTE');

    const status =
      approved.length === 0 && rejected.length > 0 && pending.length === 0 ? 'RECHAZADO'
      : approved.length > 0 && (rejected.length > 0 || pending.length > 0) ? 'APROBADO_PARCIAL'
      : approved.length > 0 ? 'APROBADO'
      : quote.status;

    const totals = totalsOf(resolved);

    const result = await prisma.$transaction(async (tx) => {
      for (const item of resolved) {
        await tx.quoteItem.update({
          where: { id: item.id },
          data: { decision: item.decision as never, decisionNote: item.decisionNote },
        });
      }

      await tx.quote.update({
        where: { id },
        data: {
          status: status as never,
          approvedTotal: totals.approvedTotal,
          decidedAt: new Date(),
          decisionChannel: data.channel,
          decidedByName: data.decidedByName,
          decisionNote: data.note,
          rejectionReason: data.rejectionReason,
          registeredById: req.currentUser!.id,
        },
      });

      if (data.applyToWorkOrder) {
        // Los ítems aprobados pasan a ser el trabajo real de la OT
        await tx.workOrderItem.deleteMany({ where: { workOrderId: quote.workOrderId } });
        if (approved.length > 0) {
          await tx.workOrderItem.createMany({
            data: approved.map((i) => ({
              tenantId, workOrderId: quote.workOrderId, kind: i.kind,
              serviceId: i.serviceId, partId: i.partId, description: i.description,
              quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct,
              taxPct: i.taxPct, hours: i.hours, total: i.total,
            })),
          });
        }

        const t = computeTotals(
          approved.map((i) => ({
            kind: i.kind, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
            discountPct: Number(i.discountPct), taxPct: Number(i.taxPct),
          })),
        );

        const nextStatus = approved.length > 0 ? 'APROBADO' : 'RECHAZADO';
        await tx.workOrder.update({
          where: { id: quote.workOrderId },
          data: {
            laborTotal: t.laborTotal, partsTotal: t.partsTotal, discountTotal: t.discountTotal,
            taxTotal: t.taxTotal, grandTotal: t.grandTotal,
            customerApproved: approved.length > 0,
            customerApprovedAt: approved.length > 0 ? new Date() : null,
            rejectionReason: approved.length === 0 ? (data.rejectionReason ?? data.note) : null,
            status: nextStatus,
          },
        });
        await tx.workOrderStatusHistory.create({
          data: {
            tenantId, workOrderId: quote.workOrderId,
            fromStatus: quote.workOrder.status as never, toStatus: nextStatus,
            userId: req.currentUser!.id,
            note: `${quote.number} v${quote.version}: ${approved.length} aprobados / ${rejected.length} rechazados · ${data.channel.toLowerCase()}${data.decidedByName ? ` · ${data.decidedByName}` : ''}`,
          },
        });
      }

      return tx.quote.findUniqueOrThrow({ where: { id }, include });
    });

    const payload = {
      quoteId: id, workOrderId: quote.workOrderId, status,
      approved: approved.length, rejected: rejected.length,
      approvedTotal: round2(totals.approvedTotal),
    };
    emitTenant(tenantId, SOCKET_EVENTS.QUOTE_DECIDED, payload);
    emitWorkOrder(quote.workOrderId, SOCKET_EVENTS.QUOTE_DECIDED, payload);
    return result;
  });

  app.post('/:id/void', { preHandler: [app.authorize('quote:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!quote) throw notFound('Presupuesto no encontrado');
    return prisma.quote.update({ where: { id }, data: { status: 'ANULADO' }, include });
  });
}
