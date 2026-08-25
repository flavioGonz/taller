import type { FastifyInstance } from 'fastify';
import { saveInspectionSchema, addPhotoSchema, idParamSchema, SOCKET_EVENTS } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { emitTenant, emitWorkOrder } from '../plugins/socket.js';

const include = {
  photos: { orderBy: { position: 'asc' as const } },
  damages: true,
};

/**
 * Inspección de ingreso y de egreso: fotos reales del vehículo con marcadores
 * de daño encima (x/y relativos a la foto), inventario y firma del cliente.
 */
export default async function inspectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  async function assertWorkOrder(id: string, tenantId: string) {
    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
    if (!wo) throw notFound('OT no encontrada');
    return wo;
  }

  // GET /api/inspections/:workOrderId?kind=INGRESO
  app.get('/:id', { preHandler: [app.authorize('inspection:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { kind = 'INGRESO' } = req.query as { kind?: 'INGRESO' | 'EGRESO' };
    await assertWorkOrder(id, tenantId);
    return prisma.inspection.findUnique({ where: { workOrderId_kind: { workOrderId: id, kind } }, include });
  });

  // PUT /api/inspections/:workOrderId — crea o reemplaza la inspección completa
  app.put('/:id', { preHandler: [app.authorize('inspection:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = saveInspectionSchema.parse(req.body);
    await assertWorkOrder(id, tenantId);

    const saved = await prisma.$transaction(async (tx) => {
      const base = {
        mileage: data.mileage,
        fuelLevel: data.fuelLevel,
        checklist: data.checklist as object,
        observations: data.observations,
        signatureUrl: data.signatureUrl,
        signedName: data.signedName,
        signedDoc: data.signedDoc,
        signedAt: data.signatureUrl ? new Date() : null,
        performedById: req.currentUser!.id,
      };

      const inspection = await tx.inspection.upsert({
        where: { workOrderId_kind: { workOrderId: id, kind: data.kind } },
        create: { tenantId, workOrderId: id, kind: data.kind, ...base },
        update: base,
      });

      // Los marcadores se reemplazan en bloque: la UI manda siempre la lista completa
      await tx.damageMark.deleteMany({ where: { inspectionId: inspection.id } });
      if (data.damages.length > 0) {
        await tx.damageMark.createMany({
          data: data.damages.map((d) => ({ ...d, tenantId, inspectionId: inspection.id })),
        });
      }

      // El kilometraje de ingreso actualiza la ficha del vehículo y la OT
      if (data.kind === 'INGRESO' && data.mileage) {
        const wo = await tx.workOrder.update({
          where: { id },
          data: { mileageIn: data.mileage, fuelLevel: data.fuelLevel, checklistIn: data.checklist as object },
          select: { vehicleId: true },
        });
        await tx.vehicle.update({ where: { id: wo.vehicleId }, data: { mileage: data.mileage } });
      }

      return tx.inspection.findUniqueOrThrow({ where: { id: inspection.id }, include });
    });

    emitWorkOrder(id, SOCKET_EVENTS.INSPECTION_SAVED, { workOrderId: id, kind: data.kind });
    emitTenant(tenantId, SOCKET_EVENTS.INSPECTION_SAVED, { workOrderId: id, kind: data.kind });
    return saved;
  });

  // POST /api/inspections/:workOrderId/photos
  app.post('/:id/photos', { preHandler: [app.authorize('inspection:write')] }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const data = addPhotoSchema.parse(req.body);
    const { kind = 'INGRESO' } = req.query as { kind?: 'INGRESO' | 'EGRESO' };
    await assertWorkOrder(id, tenantId);

    const inspection = await prisma.inspection.upsert({
      where: { workOrderId_kind: { workOrderId: id, kind } },
      create: { tenantId, workOrderId: id, kind, performedById: req.currentUser!.id },
      update: {},
    });

    const photo = await prisma.inspectionPhoto.create({ data: { ...data, tenantId, inspectionId: inspection.id } });

    // La foto de frente de la recepción queda como la foto del vehículo:
    // el listado deja de ser una grilla de texto y pasa a mostrar el auto real.
    if (data.angle === 'FRENTE') {
      const wo = await prisma.workOrder.findUnique({ where: { id }, select: { vehicleId: true } });
      if (wo) await prisma.vehicle.update({ where: { id: wo.vehicleId }, data: { photoUrl: data.url } });
    }

    reply.code(201);
    return photo;
  });

  // DELETE /api/inspections/photos/:photoId
  app.delete('/photos/:id', { preHandler: [app.authorize('inspection:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const photo = await prisma.inspectionPhoto.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!photo) throw notFound('Foto no encontrada');
    await prisma.inspectionPhoto.delete({ where: { id } });
    return { ok: true };
  });

  // GET /api/inspections/:workOrderId/damages — historial de daños del vehículo
  app.get('/:id/history', { preHandler: [app.authorize('inspection:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const wo = await prisma.workOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { vehicleId: true } });
    if (!wo) throw notFound('OT no encontrada');

    return prisma.damageMark.findMany({
      where: { tenantId, inspection: { workOrder: { vehicleId: wo.vehicleId } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        inspection: {
          select: { kind: true, createdAt: true, workOrder: { select: { id: true, number: true, receivedAt: true } } },
        },
      },
    });
  });
}
