'use client';

import { Activity, Cpu, Database, Radio, CheckCircle2 } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { SOCKET_EVENTS } from '@taller/shared';

interface Insight {
  id: string; agent: string; severity: string; code: string; title: string; detail: string | null;
  target: string | null; suggestion: string | null; occurrences: number; lastSeenAt: string; resolved: boolean;
}
interface Metrics {
  uptimeSec: number; memory: { rssMB: number; heapUsedMB: number }; sockets: number;
  queries: { total: number; slow: number; maxMs: number };
  routes: { route: string; count: number; avgMs: number; maxMs: number; errors: number }[];
  node: string;
}

const AGENT_LABEL: Record<string, string> = {
  COMPONENT_INSPECTOR: 'Component Inspector',
  STATE_MUTATION_OBSERVER: 'State & Mutation Observer',
  REFACTOR_RECOMMENDER: 'Refactor Recommender',
};
const SEV_TONE: Record<string, 'neutral' | 'info' | 'warn' | 'danger'> = {
  INFO: 'info', WARN: 'warn', ERROR: 'danger', CRITICAL: 'danger',
};

export default function SistemaPage() {
  const insights = useApi<Insight[]>('/observability/insights');
  const metrics = useApi<Metrics>('/observability/metrics');

  useSocketEvent(SOCKET_EVENTS.INSIGHT_RAISED, () => insights.refetch());

  async function resolver(id: string) {
    await api.post(`/observability/insights/${id}/resolve`);
    insights.refetch();
  }

  const m = metrics.data;

  return (
    <>
      <Topbar
        title="Salud del sistema & auto-mejora"
        actions={<Button size="sm" variant="outline" onClick={() => { insights.refetch(); metrics.refetch(); }}>Actualizar</Button>}
      />

      <div className="space-y-4 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardBody className="flex items-center gap-3">
            <Cpu className="size-5 text-[var(--text-muted)]" aria-hidden />
            <div><p className="text-xs text-[var(--text-muted)]">Memoria RSS</p><p className="text-xl font-semibold tabular-nums">{m ? `${m.memory.rssMB} MB` : '—'}</p></div>
          </CardBody></Card>
          <Card><CardBody className="flex items-center gap-3">
            <Activity className="size-5 text-[var(--text-muted)]" aria-hidden />
            <div><p className="text-xs text-[var(--text-muted)]">Uptime</p><p className="text-xl font-semibold tabular-nums">{m ? `${Math.floor(m.uptimeSec / 3600)}h ${Math.floor((m.uptimeSec % 3600) / 60)}m` : '—'}</p></div>
          </CardBody></Card>
          <Card><CardBody className="flex items-center gap-3">
            <Radio className="size-5 text-[var(--text-muted)]" aria-hidden />
            <div><p className="text-xs text-[var(--text-muted)]">Sockets conectados</p><p className="text-xl font-semibold tabular-nums">{m?.sockets ?? '—'}</p></div>
          </CardBody></Card>
          <Card><CardBody className="flex items-center gap-3">
            <Database className="size-5 text-[var(--text-muted)]" aria-hidden />
            <div><p className="text-xs text-[var(--text-muted)]">Consultas lentas</p><p className="text-xl font-semibold tabular-nums">{m ? `${m.queries.slow}/${m.queries.total}` : '—'}</p></div>
          </CardBody></Card>
        </section>

        <Card>
          <CardHeader><CardTitle>Hallazgos de los agentes de observabilidad</CardTitle>
            <span className="text-xs text-[var(--text-muted)]">{insights.data?.length ?? 0} abiertos</span>
          </CardHeader>
          <CardBody className="p-0">
            {insights.loading && !insights.data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (insights.data?.length ?? 0) === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-8 text-emerald-500" aria-hidden />} title="Sin hallazgos abiertos" description="Los tres sub-agentes están observando: UI, transacciones y latencia. Cuando detecten algo aparecerá acá con una sugerencia de parche." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {insights.data!.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start gap-3 p-4">
                    <Badge tone={SEV_TONE[i.severity] ?? 'neutral'}>{i.severity}</Badge>
                    <div className="min-w-[240px] flex-1">
                      <p className="text-sm font-medium">{i.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {AGENT_LABEL[i.agent] ?? i.agent} · {i.code} · {i.occurrences}× · {relativeTime(i.lastSeenAt)}
                        {i.target ? ` · ${i.target}` : ''}
                      </p>
                      {i.suggestion && <p className="mt-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs">{i.suggestion}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void resolver(i.id)}>Resolver</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Endpoints más lentos (ventana actual)</CardTitle></CardHeader>
          <CardBody className="p-0">
            {(m?.routes.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-xs text-[var(--text-muted)]">Todavía no hay muestras en esta ventana de medición.</p>
            ) : (
              <Table>
                <thead><tr><Th>Ruta</Th><Th className="text-right">Llamadas</Th><Th className="text-right">Prom. (ms)</Th><Th className="text-right">Máx. (ms)</Th><Th className="text-right">5xx</Th></tr></thead>
                <tbody>
                  {m!.routes.map((r) => (
                    <tr key={r.route}>
                      <Td className="font-mono text-xs">{r.route}</Td>
                      <Td className="text-right tabular-nums">{r.count}</Td>
                      <Td className="text-right tabular-nums">{r.avgMs}</Td>
                      <Td className="text-right tabular-nums">{r.maxMs}</Td>
                      <Td className="text-right tabular-nums">{r.errors}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
