import type { PrismaClient } from '@prisma/client';
import type { Tx } from './prisma.js';

/**
 * Numerador atómico por tenant. Usa un upsert + increment dentro de la misma
 * transacción de negocio, de modo que el número no se "quema" si la operación
 * falla y no hay condiciones de carrera entre recepcionistas concurrentes.
 */
export async function nextNumber(
  db: Tx | PrismaClient,
  tenantId: string,
  key: 'work_order' | 'presupuesto' | 'factura' | 'remito' | 'recibo' | 'pedido',
  opts: { prefix: string; period?: string; pad?: number } = { prefix: 'OT' },
): Promise<string> {
  const period = opts.period ?? String(new Date().getFullYear());
  const pad = opts.pad ?? 5;

  const counter = await db.counter.upsert({
    where: { tenantId_key_period: { tenantId, key, period } },
    create: { tenantId, key, period, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return `${opts.prefix}-${period}-${String(counter.value).padStart(pad, '0')}`;
}
