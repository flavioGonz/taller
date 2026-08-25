import type { FastifyInstance } from 'fastify';
import { createTenantSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';

/** Gestión SaaS de talleres. Sólo SUPER_ADMIN puede crear/listar todos. */
export default async function tenantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('tenant:create', 'tenant:read')] }, async (req) => {
    if (req.currentUser!.role === 'SUPER_ADMIN') {
      return prisma.tenant.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, workOrders: true, customers: true } } },
      });
    }
    const tenantId = req.scope();
    return prisma.tenant.findMany({ where: { id: tenantId } });
  });

  app.get('/current', async (req) => {
    const tenantId = req.scope();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw notFound('Taller no encontrado');
    return tenant;
  });

  app.patch('/current', { preHandler: [app.authorize('tenant:write')] }, async (req) => {
    const tenantId = req.scope();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = ['name', 'legalName', 'taxId', 'email', 'phone', 'address', 'city', 'logoUrl', 'currency', 'timezone', 'settings'];
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    return prisma.tenant.update({ where: { id: tenantId }, data });
  });

  // Alta de un taller nuevo (onboarding SaaS)
  app.post('/', { preHandler: [app.authorize('tenant:create')] }, async (req, reply) => {
    if (req.currentUser!.role !== 'SUPER_ADMIN') throw forbidden('Sólo SUPER_ADMIN');
    const data = createTenantSchema.parse(req.body);

    const exists = await prisma.tenant.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (exists) throw conflict('Ya existe un taller con ese slug');

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          slug: data.slug, name: data.name, legalName: data.legalName, taxId: data.taxId,
          email: data.email, phone: data.phone, address: data.address, city: data.city, plan: data.plan,
        },
      });
      await tx.user.create({
        data: {
          tenantId: t.id, email: data.admin.email.toLowerCase(), passwordHash: await hashPassword(data.admin.password),
          firstName: data.admin.firstName, lastName: data.admin.lastName, role: 'ADMIN_TALLER', mustChangePwd: true,
        },
      });
      await tx.warehouse.create({ data: { tenantId: t.id, name: 'Depósito principal', isDefault: true } });
      return t;
    });

    reply.code(201);
    return tenant;
  });

  app.post('/:id/suspend', { preHandler: [app.authorize('tenant:create')] }, async (req) => {
    if (req.currentUser!.role !== 'SUPER_ADMIN') throw forbidden('Sólo SUPER_ADMIN');
    const { id } = idParamSchema.parse(req.params);
    return prisma.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
  });

  app.post('/:id/activate', { preHandler: [app.authorize('tenant:create')] }, async (req) => {
    if (req.currentUser!.role !== 'SUPER_ADMIN') throw forbidden('Sólo SUPER_ADMIN');
    const { id } = idParamSchema.parse(req.params);
    return prisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
  });
}
