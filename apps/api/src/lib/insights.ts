import { prisma } from './prisma.js';
import type { InsightAgent, InsightSeverity } from '@prisma/client';
import { SOCKET_EVENTS } from '@taller/shared';
import { getIO } from '../plugins/socket.js';

export interface RaiseInsightInput {
  agent: InsightAgent;
  severity?: InsightSeverity;
  code: string;
  title: string;
  detail?: string;
  target?: string;
  metrics?: Record<string, unknown>;
  suggestion?: string;
  tenantId?: string | null;
}

/** Cola en memoria: agrupa insights repetidos y los persiste en lote. */
const buffer = new Map<string, RaiseInsightInput & { count: number }>();
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_MS = 10_000;

export function raiseInsight(input: RaiseInsightInput) {
  const key = `${input.agent}|${input.code}|${input.target ?? ''}`;
  const existing = buffer.get(key);
  if (existing) {
    existing.count += 1;
    existing.metrics = { ...existing.metrics, ...input.metrics };
  } else {
    buffer.set(key, { ...input, count: 1 });
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushInsights();
    }, FLUSH_MS);
    flushTimer.unref?.();
  }

  if ((input.severity ?? 'INFO') === 'CRITICAL') void flushInsights();
}

export async function flushInsights() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.size === 0) return;

  const batch = [...buffer.values()];
  buffer.clear();

  for (const item of batch) {
    try {
      const row = await prisma.systemInsight.upsert({
        where: { agent_code_target: { agent: item.agent, code: item.code, target: item.target ?? '' } },
        create: {
          agent: item.agent,
          severity: item.severity ?? 'INFO',
          code: item.code,
          title: item.title,
          detail: item.detail,
          target: item.target ?? '',
          metrics: (item.metrics ?? {}) as object,
          suggestion: item.suggestion,
          occurrences: item.count,
          tenantId: item.tenantId ?? null,
        },
        update: {
          severity: item.severity ?? 'INFO',
          title: item.title,
          detail: item.detail,
          metrics: (item.metrics ?? {}) as object,
          suggestion: item.suggestion,
          occurrences: { increment: item.count },
          lastSeenAt: new Date(),
          resolved: false,
        },
      });

      getIO()?.emit(SOCKET_EVENTS.INSIGHT_RAISED, {
        agent: row.agent,
        severity: row.severity,
        code: row.code,
        title: row.title,
        target: row.target,
        suggestion: row.suggestion,
      });
    } catch {
      // la observabilidad nunca debe tumbar la app
    }
  }
}
