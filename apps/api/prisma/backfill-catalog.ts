import type { PrismaClient } from '@prisma/client';

/**
 * Vincula los vehículos cargados antes del catálogo (o a mano) con su marca y
 * modelo, para que muestren el logo y entren en los reportes por modelo.
 */
export async function backfillVehicleCatalog(prisma: PrismaClient) {
  const pending = await prisma.vehicle.findMany({
    where: { brandId: null, deletedAt: null },
    select: { id: true, tenantId: true, brand: true, model: true },
  });

  let linked = 0;
  for (const v of pending) {
    const brand = await prisma.vehicleBrand.findFirst({
      where: { name: { equals: v.brand, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId: v.tenantId }] },
      select: { id: true },
    });
    if (!brand) continue;

    const model = await prisma.vehicleModel.findFirst({
      where: { brandId: brand.id, name: { equals: v.model, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId: v.tenantId }] },
      select: { id: true },
    });

    await prisma.vehicle.update({ where: { id: v.id }, data: { brandId: brand.id, modelId: model?.id ?? null } });
    linked += 1;
  }
  return { checked: pending.length, linked };
}
