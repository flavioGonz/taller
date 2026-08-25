import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export interface SearchHit {
  type: 'ot' | 'cliente' | 'vehiculo' | 'presupuesto';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

const nombre = (c: { isCompany: boolean; companyName?: string | null; firstName?: string | null; lastName?: string | null }) =>
  c.isCompany ? (c.companyName ?? 'Empresa') : [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';

/**
 * Búsqueda transversal para el buscador universal (Ctrl+K): órdenes por número
 * o ID de auditoría, clientes, vehículos por matrícula y presupuestos.
 */
export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const tenantId = req.scope();
    const { q } = req.query as { q?: string };
    const term = (q ?? '').trim();
    if (term.length < 2) return { hits: [] as SearchHit[] };

    const like = { contains: term, mode: 'insensitive' as const };
    const upper = term.toUpperCase();

    const [ots, clientes, vehiculos, presupuestos] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          tenantId, deletedAt: null,
          OR: [
            { number: like },
            { auditId: { contains: upper } },
            { vehicle: { plate: { contains: upper } } },
            { customer: { lastName: like } },
            { customer: { companyName: like } },
          ],
        },
        orderBy: { receivedAt: 'desc' },
        take: 6,
        select: {
          id: true, number: true, auditId: true, status: true,
          vehicle: { select: { plate: true, brand: true, model: true } },
          customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true } },
        },
      }),
      prisma.customer.findMany({
        where: {
          tenantId, deletedAt: null,
          OR: [{ firstName: like }, { lastName: like }, { companyName: like }, { docNumber: like }, { phone: like }],
        },
        take: 5,
        select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true, phone: true, docNumber: true },
      }),
      prisma.vehicle.findMany({
        where: {
          tenantId, deletedAt: null,
          OR: [{ plate: { contains: upper } }, { brand: like }, { model: like }, { vin: { contains: upper } }],
        },
        take: 5,
        select: {
          id: true, plate: true, brand: true, model: true, year: true, color: true,
          customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true } },
        },
      }),
      prisma.quote.findMany({
        where: { tenantId, number: like },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          id: true, number: true, version: true, status: true,
          workOrder: { select: { vehicle: { select: { plate: true } } } },
        },
      }),
    ]);

    const hits: SearchHit[] = [
      ...ots.map((o) => ({
        type: 'ot' as const,
        id: o.id,
        title: `${o.number} · ${o.vehicle.plate}`,
        subtitle: `${nombre(o.customer)} — ${o.vehicle.brand} ${o.vehicle.model}${o.auditId ? ` · ${o.auditId}` : ''}`,
        href: `/ordenes/${o.id}`,
        badge: o.status,
      })),
      ...vehiculos.map((v) => ({
        type: 'vehiculo' as const,
        id: v.id,
        title: `${v.plate} · ${v.brand} ${v.model}`,
        subtitle: [v.year, v.color, v.customer ? nombre(v.customer) : null].filter(Boolean).join(' · '),
        href: `/vehiculos/${v.id}`,
      })),
      ...clientes.map((c) => ({
        type: 'cliente' as const,
        id: c.id,
        title: nombre(c),
        subtitle: [c.docNumber, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto',
        href: `/clientes/${c.id}`,
      })),
      ...presupuestos.map((p) => ({
        type: 'presupuesto' as const,
        id: p.id,
        title: `${p.number} v${p.version}`,
        subtitle: p.workOrder?.vehicle.plate ?? '',
        href: `/presupuestos/${p.id}`,
        badge: p.status,
      })),
    ];

    return { hits };
  });
}
