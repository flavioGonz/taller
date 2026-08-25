import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createVehicleSchema, updateVehicleSchema, paginationSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { skipTake, toPaginated, safeOrderBy } from '../lib/pagination.js';
import { conflict, notFound } from '../lib/errors.js';

const SORTABLE = ['createdAt', 'plate', 'brand', 'year'] as const;

/**
 * Enlaza el texto libre de marca/modelo con el catálogo cuando se puede.
 * Así un vehículo cargado a mano igual muestra el logo y entra en los reportes
 * por modelo, sin obligar a nadie a elegir de la lista.
 */
async function linkCatalog(
  tenantId: string,
  data: { brandId?: string; modelId?: string; brand?: string; model?: string },
) {
  const out: { brandId?: string; modelId?: string } = {};

  let brandId = data.brandId;
  if (!brandId && data.brand) {
    const brand = await prisma.vehicleBrand.findFirst({
      where: { name: { equals: data.brand, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId }] },
      select: { id: true },
    });
    if (brand) brandId = brand.id;
  }
  if (brandId) out.brandId = brandId;

  if (!data.modelId && brandId && data.model) {
    const model = await prisma.vehicleModel.findFirst({
      where: { brandId, name: { equals: data.model, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId }] },
      select: { id: true },
    });
    if (model) out.modelId = model.id;
  }
  return out;
}

export default async function vehicleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', { preHandler: [app.authorize('vehicle:read')] }, async (req) => {
    const tenantId = req.scope();
    const query = paginationSchema.parse(req.query);
    const { customerId } = req.query as { customerId?: string };

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(query.q
        ? {
            OR: [
              { plate: { contains: query.q.toUpperCase() } },
              { vin: { contains: query.q, mode: 'insensitive' } },
              { brand: { contains: query.q, mode: 'insensitive' } },
              { model: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        ...skipTake(query.page, query.limit),
        orderBy: safeOrderBy(query.sort, query.order, SORTABLE, 'createdAt'),
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true } },
          brandRef: { select: { id: true, name: true, logoFile: true } },
          workOrders: {
            where: { deletedAt: null },
            orderBy: { receivedAt: 'desc' },
            take: 1,
            select: { id: true, number: true, status: true, receivedAt: true },
          },
          _count: { select: { workOrders: true } },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);
    return toPaginated(rows, total, query.page, query.limit);
  });

  // GET /api/vehicles/:id — ficha profesional del vehículo
  app.get('/:id', { preHandler: [app.authorize('vehicle:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();

    const vehicle = await prisma.vehicle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        brandRef: { select: { id: true, name: true, logoFile: true } },
        modelRef: { select: { id: true, name: true, bodyType: true } },
        photos: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        workOrders: {
          where: { deletedAt: null },
          orderBy: { receivedAt: 'desc' },
          select: {
            id: true, number: true, kind: true, status: true, receivedAt: true, deliveredAt: true,
            mileageIn: true, grandTotal: true, diagnosis: true, workPerformed: true, warrantyUntil: true,
            technician: { select: { firstName: true, lastName: true } },
            items: { select: { id: true, kind: true, description: true, total: true } },
          },
        },
      },
    });
    if (!vehicle) throw notFound('Vehículo no encontrado');

    // Historial de daños relevados sobre este vehículo, de todas sus visitas
    const damages = await prisma.damageMark.findMany({
      where: { tenantId, inspection: { workOrder: { vehicleId: id } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        photo: { select: { id: true, url: true, angle: true } },
        inspection: { select: { kind: true, createdAt: true, workOrder: { select: { id: true, number: true } } } },
      },
    });

    const spent = vehicle.workOrders.reduce((acc, w) => acc + Number(w.grandTotal), 0);
    const lastDelivery = await prisma.delivery.findFirst({
      where: { tenantId, workOrder: { vehicleId: id } },
      orderBy: { deliveredAt: 'desc' },
      select: { deliveredAt: true, warrantyUntil: true, nextServiceKm: true, nextServiceAt: true },
    });

    return {
      ...vehicle,
      damages,
      stats: {
        visits: vehicle.workOrders.length,
        spent,
        lastVisit: vehicle.workOrders[0]?.receivedAt ?? null,
        openOrders: vehicle.workOrders.filter((w) => !['ENTREGADO', 'CANCELADO'].includes(w.status)).length,
        nextService: lastDelivery ? { km: lastDelivery.nextServiceKm, at: lastDelivery.nextServiceAt } : null,
        warrantyUntil: lastDelivery?.warrantyUntil ?? null,
      },
    };
  });

  // ------------------------------------------- relevamiento fotográfico
  app.post('/:id/photos', { preHandler: [app.authorize('vehicle:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const body = (req.body ?? {}) as { url?: string; angle?: string; caption?: string; isPrimary?: boolean; workOrderId?: string };
    if (!body.url) throw notFound('Falta la URL de la foto');

    const vehicle = await prisma.vehicle.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, photoUrl: true } });
    if (!vehicle) throw notFound('Vehículo no encontrado');

    const photo = await prisma.vehiclePhoto.create({
      data: {
        tenantId, vehicleId: id, url: body.url,
        angle: (body.angle ?? 'OTRO') as never,
        caption: body.caption, isPrimary: !!body.isPrimary, workOrderId: body.workOrderId,
      },
    });

    // La primera foto (o la marcada como principal) es la portada de la ficha
    if (body.isPrimary || !vehicle.photoUrl) {
      if (body.isPrimary) await prisma.vehiclePhoto.updateMany({ where: { vehicleId: id, id: { not: photo.id } }, data: { isPrimary: false } });
      await prisma.vehicle.update({ where: { id }, data: { photoUrl: body.url } });
    }

    reply.code(201);
    return photo;
  });

  app.delete('/photos/:id', { preHandler: [app.authorize('vehicle:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const photo = await prisma.vehiclePhoto.findFirst({ where: { id, tenantId }, select: { id: true, vehicleId: true, url: true } });
    if (!photo) throw notFound('Foto no encontrada');
    await prisma.vehiclePhoto.delete({ where: { id } });

    const vehicle = await prisma.vehicle.findUnique({ where: { id: photo.vehicleId }, select: { photoUrl: true } });
    if (vehicle?.photoUrl === photo.url) {
      const next = await prisma.vehiclePhoto.findFirst({ where: { vehicleId: photo.vehicleId }, orderBy: { createdAt: 'desc' } });
      await prisma.vehicle.update({ where: { id: photo.vehicleId }, data: { photoUrl: next?.url ?? null } });
    }
    return { ok: true };
  });

  app.post('/', { preHandler: [app.authorize('vehicle:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createVehicleSchema.parse(req.body);
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, tenantId, deletedAt: null }, select: { id: true } });
    if (!customer) throw notFound('Cliente no encontrado');
    try {
      const linked = await linkCatalog(tenantId, data);
      const vehicle = await prisma.vehicle.create({
        data: { ...data, ...linked, features: (data.features ?? {}) as object, tenantId },
      });
      reply.code(201);
      return vehicle;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Ya existe un vehículo con esa matrícula');
      throw e;
    }
  });

  app.patch('/:id', { preHandler: [app.authorize('vehicle:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updateVehicleSchema.parse(req.body);
    const found = await prisma.vehicle.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Vehículo no encontrado');
    const linked = await linkCatalog(tenantId, data);
    return prisma.vehicle.update({
      where: { id },
      data: { ...data, ...linked, ...(data.features ? { features: data.features as object } : {}) },
    });
  });

  app.delete('/:id', { preHandler: [app.authorize('vehicle:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.vehicle.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Vehículo no encontrado');
    await prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { ok: true };
  });
}
