import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createPartSchema, updatePartSchema, stockMovementSchema, paginationSchema, idParamSchema, SOCKET_EVENTS } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { skipTake, toPaginated, safeOrderBy } from '../lib/pagination.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { emitTenant } from '../plugins/socket.js';

const SORTABLE = ['createdAt', 'name', 'sku', 'price'] as const;

export default async function inventoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ------------------------------------------------------------- repuestos
  app.get('/parts', { preHandler: [app.authorize('inventory:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { lowStock } = req.query as { lowStock?: string };

    const where: Prisma.PartWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { sku: { contains: q.q, mode: 'insensitive' } },
              { barcode: { contains: q.q } },
              { brand: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.part.findMany({
        where,
        ...skipTake(q.page, q.limit),
        orderBy: safeOrderBy(q.sort, q.order, SORTABLE, 'name'),
        include: { stock: { select: { quantity: true, warehouseId: true } }, supplier: { select: { id: true, name: true } } },
      }),
      prisma.part.count({ where }),
    ]);

    const mapped = rows.map((p) => {
      const onHand = p.stock.reduce((acc, s) => acc + Number(s.quantity), 0);
      return { ...p, onHand, isLow: onHand <= Number(p.minStock) };
    });

    const filtered = lowStock === 'true' ? mapped.filter((p) => p.isLow) : mapped;
    return toPaginated(filtered, lowStock === 'true' ? filtered.length : total, q.page, q.limit);
  });

  app.post('/parts', { preHandler: [app.authorize('inventory:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createPartSchema.parse(req.body);
    try {
      const part = await prisma.part.create({ data: { ...data, tenantId } });
      reply.code(201);
      return part;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Ya existe un repuesto con ese SKU');
      throw e;
    }
  });

  app.patch('/parts/:id', { preHandler: [app.authorize('inventory:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = updatePartSchema.parse(req.body);
    const found = await prisma.part.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Repuesto no encontrado');
    return prisma.part.update({
      where: { id },
      // Cadena vacía = el usuario quitó la foto
      data: { ...data, ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}) },
    });
  });

  app.delete('/parts/:id', { preHandler: [app.authorize('inventory:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const found = await prisma.part.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!found) throw notFound('Repuesto no encontrado');
    await prisma.part.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { ok: true };
  });

  // ------------------------------------------------------------ movimientos
  app.get('/movements', { preHandler: [app.authorize('inventory:read')] }, async (req) => {
    const tenantId = req.scope();
    const q = paginationSchema.parse(req.query);
    const { partId } = req.query as { partId?: string };
    const where: Prisma.StockMovementWhereInput = { tenantId, ...(partId ? { partId } : {}) };
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where, ...skipTake(q.page, q.limit), orderBy: { createdAt: 'desc' },
        include: {
          part: { select: { id: true, sku: true, name: true } },
          user: { select: { firstName: true, lastName: true } },
          workOrder: { select: { id: true, number: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return toPaginated(rows, total, q.page, q.limit);
  });

  app.post('/movements', { preHandler: [app.authorize('inventory:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = stockMovementSchema.parse(req.body);

    const part = await prisma.part.findFirst({ where: { id: data.partId, tenantId, deletedAt: null } });
    if (!part) throw notFound('Repuesto no encontrado');

    const warehouse = data.warehouseId
      ? await prisma.warehouse.findFirst({ where: { id: data.warehouseId, tenantId } })
      : (await prisma.warehouse.findFirst({ where: { tenantId, isDefault: true } })) ??
        (await prisma.warehouse.findFirst({ where: { tenantId } }));
    if (!warehouse) throw badRequest('No hay depósitos configurados para el taller');

    const signed = data.type === 'ENTRADA' || data.type === 'DEVOLUCION' ? data.quantity : -data.quantity;

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          tenantId, partId: data.partId, warehouseId: warehouse.id, type: data.type,
          quantity: data.quantity, unitCost: data.unitCost, workOrderId: data.workOrderId,
          userId: req.currentUser!.id, reference: data.reference, note: data.note,
        },
      });
      const stock = await tx.partStock.upsert({
        where: { partId_warehouseId: { partId: data.partId, warehouseId: warehouse.id } },
        create: { tenantId, partId: data.partId, warehouseId: warehouse.id, quantity: signed },
        update: { quantity: data.type === 'AJUSTE' ? data.quantity : { increment: signed } },
      });
      if (data.type === 'ENTRADA' && data.unitCost) {
        await tx.part.update({ where: { id: data.partId }, data: { cost: data.unitCost } });
      }
      return { movement, stock };
    });

    const onHand = Number(result.stock.quantity);
    emitTenant(tenantId, SOCKET_EVENTS.STOCK_MOVED, { partId: part.id, sku: part.sku, onHand, type: data.type });
    if (onHand <= Number(part.minStock)) {
      emitTenant(tenantId, SOCKET_EVENTS.STOCK_LOW, { partId: part.id, sku: part.sku, name: part.name, onHand, minStock: Number(part.minStock) });
    }

    reply.code(201);
    return result.movement;
  });

  // -------------------------------------------------------------- depósitos
  app.get('/warehouses', { preHandler: [app.authorize('inventory:read')] }, async (req) =>
    prisma.warehouse.findMany({ where: { tenantId: req.scope() }, orderBy: { name: 'asc' } }),
  );

  app.post('/warehouses', { preHandler: [app.authorize('inventory:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const { name, location, isDefault } = (req.body ?? {}) as { name?: string; location?: string; isDefault?: boolean };
    if (!name) throw badRequest('name requerido');
    if (isDefault) await prisma.warehouse.updateMany({ where: { tenantId }, data: { isDefault: false } });
    reply.code(201);
    return prisma.warehouse.create({ data: { tenantId, name, location, isDefault: !!isDefault } });
  });

  // ------------------------------------------------------------ proveedores
  app.get('/suppliers', { preHandler: [app.authorize('inventory:read')] }, async (req) =>
    prisma.supplier.findMany({ where: { tenantId: req.scope(), isActive: true }, orderBy: { name: 'asc' } }),
  );

  app.post('/suppliers', { preHandler: [app.authorize('inventory:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const body = (req.body ?? {}) as Record<string, string>;
    if (!body.name) throw badRequest('name requerido');
    reply.code(201);
    return prisma.supplier.create({
      data: { tenantId, name: body.name, taxId: body.taxId, email: body.email, phone: body.phone, address: body.address, notes: body.notes },
    });
  });
}
