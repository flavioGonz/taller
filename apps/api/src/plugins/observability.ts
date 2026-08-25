import fp from 'fastify-plugin';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { raiseInsight, flushInsights } from '../lib/insights.js';

/**
 * ============================================================================
 *  CAPA DE OBSERVABILIDAD Y AUTO-MEJORA CONTINUA
 * ============================================================================
 *  · State & Mutation Observer  → queries lentas, transacciones, endpoints lentos
 *  · Refactor & Evolution Recommender → agrega patrones y propone el parche
 *  (El Component Inspector vive en el frontend y reporta vía POST /api/observability/report)
 */

interface RouteStat {
  count: number;
  totalMs: number;
  maxMs: number;
  errors: number;
}

export const routeStats = new Map<string, RouteStat>();
export const queryStats = { total: 0, slow: 0, maxMs: 0 };

export default fp(async (app) => {
  if (!env.OBSERVABILITY_ENABLED) {
    app.log.warn('Observabilidad deshabilitada (OBSERVABILITY_ENABLED=false)');
    return;
  }

  // ---------------- State & Mutation Observer: capa Prisma ----------------
  const anyPrisma = prisma as unknown as {
    $on: (e: string, cb: (ev: { query?: string; duration?: number; message?: string; target?: string }) => void) => void;
  };

  anyPrisma.$on('query', (e) => {
    const ms = e.duration ?? 0;
    queryStats.total += 1;
    queryStats.maxMs = Math.max(queryStats.maxMs, ms);
    if (ms >= env.SLOW_QUERY_MS) {
      queryStats.slow += 1;
      const sql = (e.query ?? '').slice(0, 220);
      raiseInsight({
        agent: 'STATE_MUTATION_OBSERVER',
        severity: ms >= env.SLOW_QUERY_MS * 4 ? 'ERROR' : 'WARN',
        code: 'SLOW_QUERY',
        title: `Consulta lenta (${ms} ms)`,
        detail: sql,
        target: sql.split(' ').slice(0, 6).join(' '),
        metrics: { durationMs: ms, threshold: env.SLOW_QUERY_MS },
        suggestion:
          'Revisar índices sobre las columnas del WHERE/ORDER BY, evitar N+1 usando include/select y considerar paginación server-side.',
      });
    }
  });

  anyPrisma.$on('error', (e) => {
    raiseInsight({
      agent: 'STATE_MUTATION_OBSERVER',
      severity: 'ERROR',
      code: 'PRISMA_ERROR',
      title: 'Error de Prisma',
      detail: (e.message ?? '').slice(0, 500),
      target: e.target ?? 'prisma',
      suggestion: 'Verificar constraints, transacciones abiertas y disponibilidad del pool de conexiones.',
    });
  });

  // ---------------- State & Mutation Observer: latencia HTTP ----------------
  app.addHook('onRequest', async (req) => {
    (req as unknown as { _startAt: bigint })._startAt = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as unknown as { _startAt?: bigint })._startAt;
    if (!start) return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const key = `${req.method} ${req.routeOptions?.url ?? req.url}`;

    const stat = routeStats.get(key) ?? { count: 0, totalMs: 0, maxMs: 0, errors: 0 };
    stat.count += 1;
    stat.totalMs += ms;
    stat.maxMs = Math.max(stat.maxMs, ms);
    if (reply.statusCode >= 500) stat.errors += 1;
    routeStats.set(key, stat);

    if (ms >= env.SLOW_ENDPOINT_MS) {
      raiseInsight({
        agent: 'STATE_MUTATION_OBSERVER',
        severity: ms >= env.SLOW_ENDPOINT_MS * 3 ? 'ERROR' : 'WARN',
        code: 'SLOW_ENDPOINT',
        title: `Endpoint lento: ${key} (${ms.toFixed(0)} ms)`,
        target: key,
        metrics: { durationMs: Math.round(ms), threshold: env.SLOW_ENDPOINT_MS, status: reply.statusCode },
        suggestion:
          'Mover trabajo pesado fuera del request (cola/worker), cachear agregados del dashboard y limitar los include de Prisma a lo que la vista realmente muestra.',
      });
    }
  });

  // ---------------- Refactor & Evolution Recommender ----------------
  const RECOMMEND_EVERY_MS = 5 * 60 * 1000;
  const timer = setInterval(() => {
    // 1. Endpoints con latencia media alta y tráfico significativo
    for (const [route, stat] of routeStats) {
      const avg = stat.totalMs / stat.count;
      if (stat.count >= 20 && avg >= env.SLOW_ENDPOINT_MS * 0.75) {
        raiseInsight({
          agent: 'REFACTOR_RECOMMENDER',
          severity: 'WARN',
          code: 'ENDPOINT_AVG_LATENCY',
          title: `${route} promedia ${avg.toFixed(0)} ms en ${stat.count} llamadas`,
          target: route,
          metrics: { avgMs: Math.round(avg), maxMs: Math.round(stat.maxMs), count: stat.count, errors: stat.errors },
          suggestion:
            'Candidato a refactor: extraer la consulta a una vista materializada o a un `select` acotado; medir con `EXPLAIN ANALYZE` antes y después.',
        });
      }
      if (stat.errors > 0 && stat.errors / stat.count > 0.05) {
        raiseInsight({
          agent: 'REFACTOR_RECOMMENDER',
          severity: 'ERROR',
          code: 'ENDPOINT_ERROR_RATE',
          title: `${route} con ${(100 * stat.errors / stat.count).toFixed(1)}% de errores 5xx`,
          target: route,
          metrics: { errors: stat.errors, count: stat.count },
          suggestion: 'Revisar manejo de errores y validación de entrada; agregar test de regresión para el caso que falla.',
        });
      }
    }

    // 2. Salud del pool de queries
    if (queryStats.total > 100 && queryStats.slow / queryStats.total > 0.1) {
      raiseInsight({
        agent: 'REFACTOR_RECOMMENDER',
        severity: 'WARN',
        code: 'QUERY_HEALTH',
        title: `${((100 * queryStats.slow) / queryStats.total).toFixed(1)}% de las consultas superan ${env.SLOW_QUERY_MS} ms`,
        target: 'prisma',
        metrics: { ...queryStats },
        suggestion: 'Revisar índices del schema y activar PgBouncer en modo transaction para reducir el coste de conexión.',
      });
    }

    routeStats.clear();
    queryStats.total = 0;
    queryStats.slow = 0;
    queryStats.maxMs = 0;
    void flushInsights();
  }, RECOMMEND_EVERY_MS);
  timer.unref?.();

  app.addHook('onClose', async () => {
    clearInterval(timer);
    await flushInsights();
  });

  app.log.info('🛰️  Capa de observabilidad activa (Prisma + HTTP + Socket.io)');
});
