import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  insurerSchema, insurerTermsSchema, insurerContactSchema,
  insuranceCaseSchema, authorizationSchema, idParamSchema,
  checkInsuranceReadiness, SOCKET_EVENTS,
} from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { emitTenant, emitWorkOrder } from '../plugins/socket.js';

const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const include = {
  terms: true,
  contacts: { orderBy: { name: 'asc' as const } },
  _count: { select: { cases: true } },
} satisfies Prisma.InsurerInclude;

/**
 * Aseguradoras: catálogo de compañías y, sobre todo, las condiciones con las
 * que cada una acepta una reparación. Esas condiciones son las que después
 * validan si el expediente puede mandarse a autorizar.
 */
export default async function insurerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ------------------------------------------------------------- listado
  app.get('/', { preHandler: [app.authorize('catalog:read')] }, async (req) => {
    const tenantId = req.scope();
    const { q, auto } = req.query as { q?: string; auto?: string };
    return prisma.insurer.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        ...(auto === 'true' ? { worksAuto: true } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { legalName: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ worksAuto: 'desc' }, { name: 'asc' }],
      include,
    });
  });

  app.get('/:id', { preHandler: [app.authorize('catalog:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const insurer = await prisma.insurer.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
      include: {
        ...include,
        cases: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            workOrder: {
              select: {
                id: true, number: true, status: true, receivedAt: true, grandTotal: true,
                vehicle: { select: { plate: true, brand: true, model: true } },
                customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true } },
              },
            },
          },
        },
      },
    });
    if (!insurer) throw notFound('Aseguradora no encontrada');
    return insurer;
  });

  app.post('/', { preHandler: [app.authorize('catalog:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = insurerSchema.parse(req.body);
    const slug = slugify(data.name);
    const exists = await prisma.insurer.findFirst({ where: { slug, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
    if (exists) throw conflict('Ya existe una aseguradora con ese nombre');

    reply.code(201);
    return prisma.insurer.create({
      data: {
        ...data, tenantId, slug, source: 'manual',
        email: data.email || null, claimsEmail: data.claimsEmail || null,
        terms: { create: { tenantId } },
      },
      include,
    });
  });

  app.patch('/:id', { preHandler: [app.authorize('catalog:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = insurerSchema.partial().parse(req.body);
    const found = await prisma.insurer.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
    if (!found) throw notFound('Aseguradora no encontrada');
    return prisma.insurer.update({
      where: { id },
      data: { ...data, ...(data.email !== undefined ? { email: data.email || null } : {}), ...(data.claimsEmail !== undefined ? { claimsEmail: data.claimsEmail || null } : {}) },
      include,
    });
  });

  // ------------------------------------------------- condiciones del convenio
  app.put('/:id/terms', { preHandler: [app.authorize('catalog:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = insurerTermsSchema.parse(req.body);

    const insurer = await prisma.insurer.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
    if (!insurer) throw notFound('Aseguradora no encontrada');

    const payload = { ...data, requiredDocuments: data.requiredDocuments as object, tenantId };
    await prisma.insurerTerms.upsert({
      where: { insurerId: id },
      create: { ...payload, insurerId: id },
      update: payload,
    });
    return prisma.insurer.findUniqueOrThrow({ where: { id }, include });
  });

  // ---------------------------------------------------------- contactos
  app.post('/:id/contacts', { preHandler: [app.authorize('catalog:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = insurerContactSchema.parse(req.body);
    reply.code(201);
    return prisma.insurerContact.create({ data: { ...data, email: data.email || null, tenantId, insurerId: id } });
  });

  app.delete('/contacts/:id', { preHandler: [app.authorize('catalog:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.insurerContact.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!found) throw notFound('Contacto no encontrado');
    await prisma.insurerContact.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ tablero
  app.get('/board/pending', { preHandler: [app.authorize('workorder:read')] }, async (req) => {
    const tenantId = req.scope();
    return prisma.insuranceCase.findMany({
      where: { tenantId, status: { in: ['SIN_ENVIAR', 'ENVIADO', 'EN_ANALISIS'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        insurer: { select: { id: true, name: true, logoFile: true } },
        workOrder: {
          select: {
            id: true, number: true, status: true, receivedAt: true,
            vehicle: { select: { plate: true, brand: true, model: true } },
          },
        },
      },
    });
  });
}

/** Expediente del siniestro dentro de la OT. Se monta en /api/work-orders. */
export async function insuranceCaseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  async function loadCase(workOrderId: string, tenantId: string) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId, deletedAt: null },
      select: { id: true, number: true, kind: true, grandTotal: true, currency: true },
    });
    if (!wo) throw notFound('OT no encontrada');
    return wo;
  }

  // GET /api/work-orders/:id/insurance
  app.get('/:id/insurance', { preHandler: [app.authorize('workorder:read', 'workorder:read:own')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    await loadCase(id, tenantId);

    const kase = await prisma.insuranceCase.findUnique({
      where: { workOrderId: id },
      include: { insurer: { include: { terms: true, contacts: true } } },
    });
    if (!kase) return null;

    // Estado de cumplimiento según las condiciones de la compañía
    const [photos, damages, quote] = await Promise.all([
      prisma.inspectionPhoto.count({ where: { inspection: { workOrderId: id } } }),
      prisma.damageMark.count({ where: { inspection: { workOrderId: id } } }),
      prisma.quote.findFirst({ where: { workOrderId: id, status: { notIn: ['ANULADO'] } }, select: { id: true } }),
    ]);

    const terms = kase.insurer.terms;
    const check = checkInsuranceReadiness({
      terms: terms
        ? {
            requiresClaimNumber: terms.requiresClaimNumber,
            requiresAdjuster: terms.requiresAdjuster,
            requiresPhotos: terms.requiresPhotos,
            minPhotos: terms.minPhotos,
            requiresDamageMap: terms.requiresDamageMap,
            requiredDocuments: (terms.requiredDocuments as string[]) ?? [],
            requiresPartsQuotes: terms.requiresPartsQuotes,
          }
        : null,
      claimNumber: kase.claimNumber,
      policyNumber: kase.policyNumber,
      adjusterName: kase.adjusterName,
      photoCount: photos,
      damageCount: damages,
      documents: (kase.documents as Record<string, unknown>) ?? {},
      hasQuote: !!quote,
    });

    return { ...kase, readiness: check, counts: { photos, damages } };
  });

  // PUT /api/work-orders/:id/insurance — crear o actualizar el expediente
  app.put('/:id/insurance', { preHandler: [app.authorize('workorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = insuranceCaseSchema.parse(req.body);
    const wo = await loadCase(id, tenantId);

    const insurer = await prisma.insurer.findFirst({
      where: { id: data.insurerId, OR: [{ tenantId: null }, { tenantId }] },
      include: { terms: true },
    });
    if (!insurer) throw notFound('Aseguradora no encontrada');

    // El reparto del monto sale de las condiciones: franquicia al cliente, resto a la compañía
    const total = Number(wo.grandTotal);
    const deductible = data.deductible ?? 0;
    const deductibleBy = data.deductibleBy ?? insurer.terms?.deductibleBy ?? 'TALLER';
    const customerAmount = deductibleBy === 'TALLER' ? Math.min(deductible, total) : 0;
    const insurerAmount = Math.max(0, total - customerAmount);

    const base = {
      insurerId: data.insurerId,
      policyNumber: data.policyNumber,
      claimNumber: data.claimNumber,
      claimDate: data.claimDate,
      adjusterName: data.adjusterName,
      adjusterPhone: data.adjusterPhone,
      adjusterVisitAt: data.adjusterVisitAt,
      deductible: data.deductible,
      deductibleBy: deductibleBy as never,
      customerAmount,
      insurerAmount,
      documents: (data.documents ?? {}) as object,
      notes: data.notes,
    };

    const saved = await prisma.insuranceCase.upsert({
      where: { workOrderId: id },
      create: { ...base, tenantId, workOrderId: id },
      update: base,
      include: { insurer: { include: { terms: true } } },
    });

    // Una OT con seguro es un siniestro: lo dejamos explícito
    if (wo.kind !== 'SINIESTRO') {
      await prisma.workOrder.update({ where: { id }, data: { kind: 'SINIESTRO' } });
    }

    emitWorkOrder(id, SOCKET_EVENTS.WORKORDER_UPDATED, { id });
    return saved;
  });

  // POST /api/work-orders/:id/insurance/submit — mandar a autorizar
  app.post('/:id/insurance/submit', { preHandler: [app.authorize('workorder:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { force } = (req.body ?? {}) as { force?: boolean };

    const kase = await prisma.insuranceCase.findUnique({
      where: { workOrderId: id },
      include: { insurer: { include: { terms: true } } },
    });
    if (!kase) throw notFound('La OT no tiene expediente de seguro');

    const [photos, damages, quote] = await Promise.all([
      prisma.inspectionPhoto.count({ where: { inspection: { workOrderId: id } } }),
      prisma.damageMark.count({ where: { inspection: { workOrderId: id } } }),
      prisma.quote.findFirst({ where: { workOrderId: id, status: { notIn: ['ANULADO'] } }, select: { id: true } }),
    ]);

    const terms = kase.insurer.terms;
    const check = checkInsuranceReadiness({
      terms: terms
        ? {
            requiresClaimNumber: terms.requiresClaimNumber,
            requiresAdjuster: terms.requiresAdjuster,
            requiresPhotos: terms.requiresPhotos,
            minPhotos: terms.minPhotos,
            requiresDamageMap: terms.requiresDamageMap,
            requiredDocuments: (terms.requiredDocuments as string[]) ?? [],
          }
        : null,
      claimNumber: kase.claimNumber,
      policyNumber: kase.policyNumber,
      adjusterName: kase.adjusterName,
      photoCount: photos,
      damageCount: damages,
      documents: (kase.documents as Record<string, unknown>) ?? {},
      hasQuote: !!quote,
    });

    if (!check.ready && !force) {
      throw badRequest(
        `Falta completar lo que pide ${kase.insurer.name}: ` +
          check.requirements.filter((r) => !r.ok).map((r) => r.label.toLowerCase()).join(', '),
      );
    }

    const updated = await prisma.insuranceCase.update({
      where: { workOrderId: id },
      data: { status: 'ENVIADO', sentAt: new Date() },
      include: { insurer: { select: { name: true } } },
    });

    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_UPDATED, { id, insurance: 'ENVIADO' });
    return { ...updated, readiness: check };
  });

  // POST /api/work-orders/:id/insurance/authorization — registrar la respuesta
  app.post('/:id/insurance/authorization', { preHandler: [app.authorize('quote:decide')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = authorizationSchema.parse(req.body);

    const kase = await prisma.insuranceCase.findUnique({ where: { workOrderId: id } });
    if (!kase) throw notFound('La OT no tiene expediente de seguro');

    const wo = await prisma.workOrder.findFirstOrThrow({
      where: { id, tenantId },
      select: { id: true, status: true, grandTotal: true },
    });

    const authorized = data.status === 'AUTORIZADO' || data.status === 'AUTORIZADO_PARCIAL';
    const total = Number(wo.grandTotal);
    const insurerAmount = authorized ? (data.authorizedAmount ?? Number(kase.insurerAmount) ?? total) : 0;
    const customerAmount = Math.max(0, total - insurerAmount);

    const saved = await prisma.$transaction(async (tx) => {
      const c = await tx.insuranceCase.update({
        where: { workOrderId: id },
        data: {
          status: data.status,
          authorizationRef: data.authorizationRef,
          authorizedAmount: data.authorizedAmount,
          authorizedBy: data.authorizedBy,
          authorizedAt: authorized ? new Date() : null,
          rejectionReason: data.status === 'RECHAZADO' ? data.rejectionReason : null,
          insurerAmount,
          customerAmount,
          notes: data.notes ?? kase.notes,
        },
        include: { insurer: { select: { name: true } } },
      });

      // La autorización de la compañía mueve la OT igual que la aprobación del cliente
      const next = authorized ? 'APROBADO' : data.status === 'RECHAZADO' ? 'RECHAZADO' : null;
      if (next && wo.status !== next) {
        await tx.workOrder.update({
          where: { id },
          data: {
            status: next as never,
            customerApproved: authorized,
            customerApprovedAt: authorized ? new Date() : null,
            rejectionReason: data.status === 'RECHAZADO' ? data.rejectionReason : null,
          },
        });
        await tx.workOrderStatusHistory.create({
          data: {
            tenantId, workOrderId: id, fromStatus: wo.status as never, toStatus: next as never,
            userId: req.currentUser!.id,
            note: `${c.insurer.name}: ${data.status.toLowerCase().replace(/_/g, ' ')}${data.authorizationRef ? ` · orden ${data.authorizationRef}` : ''}`,
          },
        });
      }
      return c;
    });

    emitTenant(tenantId, SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, { id, insurance: data.status });
    emitWorkOrder(id, SOCKET_EVENTS.WORKORDER_UPDATED, { id });
    return saved;
  });
}
