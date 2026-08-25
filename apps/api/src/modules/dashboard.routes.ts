import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/dashboard/summary — métricas del panel analítico
  app.get('/summary', { preHandler: [app.authorize('dashboard:read')] }, async (req) => {
    const tenantId = req.scope();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const [byStatus, openCount, todayIn, todayOut, monthRevenue, pendingAmount, lowStock, topServices, recent, techLoad] =
      await Promise.all([
        prisma.workOrder.groupBy({ by: ['status'], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
        prisma.workOrder.count({ where: { tenantId, deletedAt: null, status: { notIn: ['ENTREGADO', 'CANCELADO'] } } }),
        prisma.workOrder.count({ where: { tenantId, deletedAt: null, receivedAt: { gte: startOfDay } } }),
        prisma.workOrder.count({ where: { tenantId, deletedAt: null, deliveredAt: { gte: startOfDay } } }),
        prisma.document.aggregate({
          where: { tenantId, type: 'FACTURA', status: { in: ['EMITIDO', 'PAGADO', 'PARCIAL'] }, issueDate: { gte: startOfMonth } },
          _sum: { total: true },
        }),
        prisma.document.aggregate({
          where: { tenantId, type: 'FACTURA', status: { in: ['EMITIDO', 'PARCIAL', 'VENCIDO'] } },
          _sum: { total: true, paid: true },
        }),
        prisma.$queryRaw<{ id: string; sku: string; name: string; onhand: number; minstock: number }[]>`
          SELECT p.id, p.sku, p.name,
                 COALESCE(SUM(s.quantity), 0)::float AS onhand,
                 p."minStock"::float AS minstock
          FROM parts p
          LEFT JOIN part_stock s ON s."partId" = p.id
          WHERE p."tenantId" = ${tenantId} AND p."deletedAt" IS NULL AND p."isActive" = true
          GROUP BY p.id
          HAVING COALESCE(SUM(s.quantity), 0) <= p."minStock"
          ORDER BY onhand ASC
          LIMIT 10`,
        prisma.$queryRaw<{ description: string; cnt: number; total: number }[]>`
          SELECT i.description, COUNT(*)::int AS cnt, SUM(i.total)::float AS total
          FROM work_order_items i
          JOIN work_orders w ON w.id = i."workOrderId"
          WHERE i."tenantId" = ${tenantId} AND w."receivedAt" >= ${last30} AND w."deletedAt" IS NULL
          GROUP BY i.description
          ORDER BY cnt DESC
          LIMIT 8`,
        prisma.workOrder.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { receivedAt: 'desc' },
          take: 8,
          select: {
            id: true, number: true, status: true, receivedAt: true, grandTotal: true,
            vehicle: { select: { plate: true, brand: true, model: true } },
            customer: { select: { firstName: true, lastName: true, companyName: true, isCompany: true } },
          },
        }),
        prisma.workOrder.groupBy({
          by: ['technicianId'],
          where: { tenantId, deletedAt: null, status: { notIn: ['ENTREGADO', 'CANCELADO'] }, technicianId: { not: null } },
          _count: { _all: true },
        }),
      ]);

    // --- Indicadores del flujo completo ---
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);
    const [appointmentsToday, quotesWaiting, partsInTransit, followUpsDue, warrantyExpiring, avgCycle] = await Promise.all([
      prisma.appointment.count({
        where: { tenantId, scheduledAt: { gte: startOfDay, lt: endOfDay }, status: { in: ['PROGRAMADA', 'CONFIRMADA'] } },
      }),
      prisma.quote.count({ where: { tenantId, status: 'ENVIADO' } }),
      prisma.partsOrder.count({ where: { tenantId, status: { in: ['SOLICITADO', 'CONFIRMADO', 'EN_TRANSITO', 'RECIBIDO_PARCIAL'] } } }),
      prisma.followUp.count({ where: { tenantId, status: 'PENDIENTE', dueAt: { lte: now } } }),
      prisma.workOrder.count({
        where: { tenantId, deletedAt: null, warrantyUntil: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 3600 * 1000) } },
      }),
      // Tiempo medio de ciclo (recepción → entrega) de los últimos 30 días, en horas
      prisma.$queryRaw<{ hours: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (w."deliveredAt" - w."receivedAt")) / 3600)::float AS hours
        FROM work_orders w
        WHERE w."tenantId" = ${tenantId} AND w."deletedAt" IS NULL
          AND w."deliveredAt" IS NOT NULL AND w."deliveredAt" >= ${last30}`,
    ]);

    const technicians = await prisma.user.findMany({
      where: { tenantId, role: 'TECNICO', isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    // Ingresos por día de los últimos 30 días (serie para el gráfico)
    const series = await prisma.$queryRaw<{ day: Date; total: number; count: number }[]>`
      SELECT date_trunc('day', w."receivedAt") AS day,
             COALESCE(SUM(w."grandTotal"), 0)::float AS total,
             COUNT(*)::int AS count
      FROM work_orders w
      WHERE w."tenantId" = ${tenantId} AND w."deletedAt" IS NULL AND w."receivedAt" >= ${last30}
      GROUP BY 1 ORDER BY 1 ASC`;

    return {
      kpis: {
        openWorkOrders: openCount,
        todayIn,
        todayOut,
        monthRevenue: Number(monthRevenue._sum.total ?? 0),
        receivables: Number(pendingAmount._sum.total ?? 0) - Number(pendingAmount._sum.paid ?? 0),
        appointmentsToday,
        quotesWaiting,
        partsInTransit,
        followUpsDue,
        warrantyExpiring,
        avgCycleHours: avgCycle[0]?.hours ? Math.round(avgCycle[0].hours) : null,
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      series,
      lowStock,
      topServices,
      recent,
      technicianLoad: techLoad.map((t) => ({
        technicianId: t.technicianId,
        name: technicians.find((x) => x.id === t.technicianId)
          ? `${technicians.find((x) => x.id === t.technicianId)!.firstName} ${technicians.find((x) => x.id === t.technicianId)!.lastName}`
          : '—',
        open: t._count._all,
      })),
      generatedAt: new Date().toISOString(),
    };
  });
}
