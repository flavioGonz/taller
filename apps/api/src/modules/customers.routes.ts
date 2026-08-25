import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createCustomerSchema, updateCustomerSchema, paginationSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { skipTake, toPaginated, safeOrderBy } from '../lib/pagination.js';
import { conflict, notFound } from '../lib/errors.js';

const SORTABLE = ['createdAt', 'lastName', 'companyName', 'city'] as const;

export default async function customerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/customers  (?page&limit ⇒ paginado; sin page ⇒ array plano para selects)
  app.get('/', { preHandler: [app.authorize('customer:read')] }, async (req) => {
    const tenantId = req.scope();
    const query = paginationSchema.parse(req.query);
    const raw = req.query as Record<string, unknown>;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { companyName: { contains: query.q, mode: 'insensitive' } },
              { docNumber: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (raw.page === undefined) {
      return prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, docNumber: true, phone: true },
      });
    }

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        ...skipTake(query.page, query.limit),
        orderBy: safeOrderBy(query.sort, query.order, SORTABLE, 'createdAt'),
        include: { _count: { select: { vehicles: true, workOrders: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    return toPaginated(rows, total, query.page, query.limit);
  });

  // GET /api/customers/:id
  app.get('/:id', { preHandler: [app.authorize('customer:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vehicles: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            brandRef: { select: { id: true, name: true, logoFile: true } },
            _count: { select: { workOrders: true } },
          },
        },
        workOrders: {
          where: { deletedAt: null },
          orderBy: { receivedAt: 'desc' },
          take: 30,
          select: {
            id: true, number: true, kind: true, status: true, receivedAt: true, deliveredAt: true,
            grandTotal: true, currency: true,
            vehicle: { select: { id: true, plate: true, brand: true, model: true } },
          },
        },
        appointments: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
          select: { id: true, scheduledAt: true, status: true, reason: true, vehicle: { select: { plate: true } } },
        },
        followUps: {
          orderBy: { dueAt: 'desc' },
          take: 10,
          select: { id: true, kind: true, dueAt: true, doneAt: true, notes: true, workOrderId: true },
        },
      },
    });
    if (!customer) throw notFound('Cliente no encontrado');

    // Ficha comercial: presupuestos, facturación y saldo
    const [quotes, documents, agg] = await Promise.all([
      prisma.quote.findMany({
        where: { tenantId, workOrder: { customerId: id } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true, number: true, version: true, status: true, total: true, approvedTotal: true,
          createdAt: true, currency: true,
          workOrder: { select: { id: true, number: true, vehicle: { select: { plate: true } } } },
        },
      }),
      prisma.document.findMany({
        where: { tenantId, customerId: id },
        orderBy: { issueDate: 'desc' },
        take: 15,
        select: { id: true, type: true, number: true, issueDate: true, dueDate: true, total: true, paid: true, status: true, currency: true },
      }),
      prisma.document.aggregate({
        where: { tenantId, customerId: id, status: { notIn: ['ANULADO'] } },
        _sum: { total: true, paid: true },
      }),
    ]);

    const facturado = Number(agg._sum?.total ?? 0);
    const cobrado = Number(agg._sum?.paid ?? 0);
    const saldo = Math.max(0, facturado - cobrado);
    const gastoEnOts = customer.workOrders.reduce((a: number, w: { grandTotal: unknown }) => a + Number(w.grandTotal), 0);

    return {
      ...customer,
      quotes,
      documents,
      account: { invoiced: facturado, paid: cobrado, balance: saldo, workOrdersTotal: gastoEnOts },
    };
  });

  // POST /api/customers
  app.post('/', { preHandler: [app.authorize('customer:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createCustomerSchema.parse(req.body);
    try {
      const customer = await prisma.customer.create({
        data: { ...data, email: data.email || null, tenantId },
      });
      reply.code(201);
      return customer;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict('Ya existe un cliente con ese documento');
      }
      throw e;
    }
  });

  // PATCH /api/customers/:id
  app.patch('/:id', { preHandler: [app.authorize('customer:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const data = updateCustomerSchema.parse(req.body);
    const tenantId = req.scope();
    const found = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Cliente no encontrado');
    return prisma.customer.update({ where: { id }, data: { ...data, email: data.email || null } });
  });

  // DELETE /api/customers/:id  (baja lógica)
  app.delete('/:id', { preHandler: [app.authorize('customer:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Cliente no encontrado');
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { ok: true };
  });
}
