import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';

interface SeedInsurer {
  slug: string;
  name: string;
  legalName?: string;
  website?: string;
  worksAuto: boolean;
  notes?: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carga las aseguradoras que operan en Uruguay con condiciones por defecto.
 * Los datos vienen de fuentes públicas: cada taller ajusta las condiciones
 * reales de su convenio desde la pantalla de Aseguradoras.
 */
export async function seedInsurers(prisma: PrismaClient, tenantId: string) {
  const file = path.join(here, 'data', 'insurers-uy.json');
  const list: SeedInsurer[] = JSON.parse(readFileSync(file, 'utf8'));

  let created = 0;
  for (const i of list) {
    const existing = await prisma.insurer.findFirst({ where: { slug: i.slug, tenantId }, select: { id: true } });
    if (existing) continue;

    await prisma.insurer.create({
      data: {
        tenantId,
        slug: i.slug,
        name: i.name,
        legalName: i.legalName,
        website: i.website,
        worksAuto: i.worksAuto,
        notes: i.notes ?? 'Condiciones por confirmar con la compañía.',
        source: 'catalog',
        // Condiciones de arranque: conservadoras y editables
        terms: {
          create: {
            tenantId,
            requiresAuthorization: true,
            authorizationChannel: 'EMAIL',
            requiresClaimNumber: true,
            requiresAdjuster: true,
            requiresPhotos: true,
            minPhotos: 6,
            requiresDamageMap: true,
            requiredDocuments: ['denuncia', 'cedula', 'libreta', 'poliza', 'fotos_dano', 'presupuesto'],
            partsPolicy: 'MIXTO',
            partsSuppliedBy: 'TALLER',
            invoiceTo: 'ASEGURADORA',
            deductibleBy: 'TALLER',
            paymentTermDays: 30,
            warrantyDays: 90,
            notes: 'Valores por defecto: ajustalos según el convenio real con la compañía.',
          },
        },
      },
    });
    created += 1;
  }
  return { total: list.length, created };
}
