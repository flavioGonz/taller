import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/errors.js';
import { raiseInsight, flushInsights } from '../lib/insights.js';
import { routeStats, queryStats } from '../plugins/observability.js';
import { idParamSchema } from '@taller/shared';
import { getIO } from '../plugins/socket.js';

/** Reporte que envía el Component Inspector desde el navegador. */
const reportSchema = z.object({
  findings: z
    .array(
      z.object({
        code: z.string().max(60),
        severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).default('WARN'),
        title: z.string().max(200),
        detail: z.string().max(2000).optional(),
        target: z.string().max(200).optional(),
        metrics: z.record(z.unknown()).optional(),
        suggestion: z.string().max(500).optional(),
      }),
    )
    .max(50),
});

export default async function observabilityRoutes(app: FastifyInstance) {
  // El inspector del frontend reporta con la sesión del usuario
  app.post('/report', { preHandler: [app.authenticate] }, async (req) => {
    const { findings } = reportSchema.parse(req.body);
    for (const f of findings) {
      raiseInsight({
        agent: 'COMPONENT_INSPECTOR',
        severity: f.severity,
        code: f.code,
        title: f.title,
        detail: f.detail,
        target: f.target,
        metrics: f.metrics,
        suggestion: f.suggestion,
        tenantId: req.currentUser?.tenantId ?? null,
      });
    }
    return { accepted: findings.length };
  });

  app.get('/insights', { preHandler: [app.authenticate, app.authorize('insight:read')] }, async (req) => {
    const { resolved, agent, severity } = req.query as { resolved?: string; agent?: string; severity?: string };
    await flushInsights();
    return prisma.systemInsight.findMany({
      where: {
        ...(resolved !== undefined ? { resolved: resolved === 'true' } : { resolved: false }),
        ...(agent ? { agent: agent as never } : {}),
        ...(severity ? { severity: severity as never } : {}),
      },
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
      take: 200,
    });
  });

  app.post('/insights/:id/resolve', { preHandler: [app.authenticate, app.authorize('insight:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return prisma.systemInsight.update({ where: { id }, data: { resolved: true } });
  });

  /**
   * Resolver varios de una. Se puede pasar una lista de ids, o `all` con los
   * mismos filtros del listado para cerrar todo un lote (por ejemplo, todos los
   * INFO de un agente después de arreglar la causa).
   */
  app.post('/insights/resolve', { preHandler: [app.authenticate, app.authorize('insight:write')] }, async (req) => {
    const body = (req.body ?? {}) as { ids?: string[]; all?: boolean; agent?: string; severity?: string; code?: string };

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { count } = await prisma.systemInsight.updateMany({
        where: { id: { in: body.ids.slice(0, 500) }, resolved: false },
        data: { resolved: true },
      });
      return { resolved: count };
    }

    if (!body.all) throw badRequest('Indicá qué hallazgos resolver');

    const { count } = await prisma.systemInsight.updateMany({
      where: {
        resolved: false,
        ...(body.agent ? { agent: body.agent as never } : {}),
        ...(body.severity ? { severity: body.severity as never } : {}),
        ...(body.code ? { code: body.code } : {}),
      },
      data: { resolved: true },
    });
    return { resolved: count };
  });

  /** Vuelve a abrir un hallazgo cerrado por error. */
  app.post('/insights/:id/reopen', { preHandler: [app.authenticate, app.authorize('insight:write')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return prisma.systemInsight.update({ where: { id }, data: { resolved: false } });
  });

  // Métricas en vivo del proceso (para el panel de salud del sistema)
  app.get('/metrics', { preHandler: [app.authenticate, app.authorize('insight:read')] }, async () => {
    const mem = process.memoryUsage();
    const routes = [...routeStats.entries()]
      .map(([route, s]) => ({ route, count: s.count, avgMs: Math.round(s.totalMs / s.count), maxMs: Math.round(s.maxMs), errors: s.errors }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 20);

    return {
      uptimeSec: Math.round(process.uptime()),
      memory: { rssMB: +(mem.rss / 1048576).toFixed(1), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(1) },
      sockets: getIO()?.engine.clientsCount ?? 0,
      queries: { ...queryStats },
      routes,
      node: process.version,
    };
  });
}
