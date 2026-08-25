import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';

interface CatalogBrand {
  slug: string;
  name: string;
  logo: string | null;
  models: string[];
}

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carga el catálogo global de marcas y modelos (tenantId = null).
 * Es idempotente: sólo agrega lo que falta, nunca pisa las altas del taller.
 */
export async function seedCatalog(prisma: PrismaClient) {
  const file = path.join(here, 'data', 'vehicle-catalog.json');
  const brands: CatalogBrand[] = JSON.parse(readFileSync(file, 'utf8'));

  let newBrands = 0;
  let newModels = 0;

  for (const b of brands) {
    const existing = await prisma.vehicleBrand.findFirst({
      where: { slug: b.slug, tenantId: null },
      select: { id: true },
    });

    const brand =
      existing ??
      (await prisma.vehicleBrand.create({
        data: { tenantId: null, slug: b.slug, name: b.name, logoFile: b.logo, source: 'catalog' },
        select: { id: true },
      }));
    if (!existing) newBrands += 1;

    const have = new Set(
      (await prisma.vehicleModel.findMany({ where: { brandId: brand.id }, select: { name: true } })).map((m) => m.name),
    );
    const missing = b.models.filter((m) => !have.has(m));
    if (missing.length > 0) {
      await prisma.vehicleModel.createMany({
        data: missing.map((name) => ({ tenantId: null, brandId: brand.id, name, source: 'catalog' })),
        skipDuplicates: true,
      });
      newModels += missing.length;
    }
  }

  return { brands: brands.length, newBrands, newModels };
}
