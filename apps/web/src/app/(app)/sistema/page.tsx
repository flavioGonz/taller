'use client';

import { useMemo, useState } from 'react';
import {
  Activity, Cpu, Database, Radio, CheckCircle2, ShieldAlert, Palette, Gauge as GaugeIcon,
  Filter, ListChecks, RefreshCw, CheckCheck, Layers, Eye, MousePointerClick, TriangleAlert,
  Info, CircleAlert,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Skeleton, EmptyState, Badge, Select, Stat,
} from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { ConfirmDialog } from '@/components/modal';
import { useToast } from '@/components/toast';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api } from '@/lib/api';
import { relativeTime, cn } from '@/lib/utils';
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
const SEV_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  INFO: Info, WARN: TriangleAlert, ERROR: CircleAlert, CRITICAL: ShieldAlert,
};
const SEV_ORDER: Record<string, number> = { CRITICAL: 4, ERROR: 3, WARN: 2, INFO: 1 };

/** Ícono por familia de hallazgo, para reconocerlo sin leer el código. */
const CODE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  A11Y_IMG_NO_ALT: Eye,
  A11Y_BUTTON_NO_NAME: MousePointerClick,
  A11Y_INPUT_NO_LABEL: ListChecks,
  A11Y_TOUCH_TARGET: MousePointerClick,
  DS_HARDCODED_COLOR: Palette,
  SLOW_QUERY: Database,
  SLOW_ROUTE: GaugeIcon,
};

export default function SistemaPage() {
  const toast = useToast();
  const [showResolved, setShowResolved] = useState(false);
  const [agent, setAgent] = useState('');
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const query = `/observability/insights?resolved=${showResolved}${agent ? `&agent=${agent}` : ''}${severity ? `&severity=${severity}` : ''}`;
  const insights = useApi<Insight[]>(query);
  const metrics = useApi<Metrics>('/observability/metrics');

  useSocketEvent(SOCKET_EVENTS.INSIGHT_RAISED, () => insights.refetch());

  const rows = useMemo(
    () => [...(insights.data ?? [])].sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0)),
    [insights.data],
  );

  const abiertos = rows.length;
  const porSeveridad = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.severity] = (c[r.severity] ?? 0) + 1;
    return c;
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  async function resolverSeleccion() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const r = await api.post<{ resolved: number }>('/observability/insights/resolve', { ids });
      toast.ok(
        r.resolved === 1 ? 'Hallazgo resuelto' : `${r.resolved} hallazgos resueltos`,
        'Si el agente vuelve a detectarlo, lo abre de nuevo.',
      );
      setSelected(new Set());
      insights.refetch();
    } catch (e) {
      toast.error('No se pudo resolver', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolverTodo() {
    setBusy(true);
    try {
      const r = await api.post<{ resolved: number }>('/observability/insights/resolve', {
        all: true,
        agent: agent || undefined,
        severity: severity || undefined,
      });
      toast.ok(`${r.resolved} hallazgos resueltos`, 'Quedó limpio el tablero con el filtro actual.');
      setConfirmAll(false);
      setSelected(new Set());
      insights.refetch();
    } catch (e) {
      toast.error('No se pudo resolver', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reabrir(id: string) {
    await api.post(`/observability/insights/${id}/reopen`).catch(() => undefined);
    toast.ok('Hallazgo reabierto');
    insights.refetch();
  }

  const columns: Column<Insight>[] = [
    {
      key: 'sel',
      width: '40px',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Seleccionar todos los hallazgos"
          className="size-3.5 accent-[var(--brand)]"
        />
      ),
      cell: (i) => (
        <input
          type="checkbox"
          checked={selected.has(i.id)}
          onChange={() => toggle(i.id)}
          aria-label={`Seleccionar: ${i.title}`}
          className="size-3.5 accent-[var(--brand)]"
        />
      ),
    },
    {
      key: 'hallazgo',
      header: 'Hallazgo',
      sortValue: (i) => i.title,
      cell: (i) => {
        const Icon = CODE_ICON[i.code] ?? ListChecks;
        const Sev = SEV_ICON[i.severity] ?? Info;
        return (
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px]',
              i.severity === 'INFO' && 'bg-[var(--info-bg)] text-[var(--info)]',
              i.severity === 'WARN' && 'bg-[var(--warn-bg)] text-[var(--warn)]',
              (i.severity === 'ERROR' || i.severity === 'CRITICAL') && 'bg-[var(--falla-bg)] text-[var(--falla)]')}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight">{i.title}</p>
              <p className="mono mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--muted)]">
                <Sev className="size-3" aria-hidden />
                {i.code}
                {i.target && <span className="text-[var(--subtle)]">· {i.target}</span>}
              </p>
              {i.suggestion && (
                <p className="mt-1.5 rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11.5px] text-[var(--muted)]">
                  {i.suggestion}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'agente',
      header: 'Agente',
      hideBelow: 'lg',
      sortValue: (i) => AGENT_LABEL[i.agent] ?? i.agent,
      cell: (i) => <span className="text-[12px] text-[var(--muted)]">{AGENT_LABEL[i.agent] ?? i.agent}</span>,
    },
    {
      key: 'sev',
      header: 'Severidad',
      align: 'center',
      sortValue: (i) => SEV_ORDER[i.severity] ?? 0,
      cell: (i) => <Badge tone={SEV_TONE[i.severity] ?? 'neutral'}>{i.severity}</Badge>,
    },
    {
      key: 'veces',
      header: 'Veces',
      align: 'right',
      hideBelow: 'sm',
      tip: 'Cuántas veces lo volvió a ver el agente',
      sortValue: (i) => i.occurrences,
      cell: (i) => (
        <div>
          <p className="mono text-[13px] font-semibold">{i.occurrences}</p>
          <p className="text-[10.5px] text-[var(--muted)]">{relativeTime(i.lastSeenAt)}</p>
        </div>
      ),
    },
    {
      key: 'accion',
      header: '',
      width: '104px',
      align: 'right',
      cell: (i) => showResolved ? (
        <Button size="xs" variant="ghost" onClick={() => void reabrir(i.id)} tip="Volver a abrirlo">Reabrir</Button>
      ) : (
        <Button
          size="xs"
          variant="secondary"
          onClick={() => { setSelected(new Set([i.id])); void resolverSeleccion(); }}
          tip="Marcarlo como atendido"
        >
          <CheckCircle2 className="size-3.5" aria-hidden /> Resolver
        </Button>
      ),
    },
  ];

  const m = metrics.data;

  return (
    <>
      <Topbar
        title="Salud del sistema & auto-mejora"
        description="Lo que ven los tres sub-agentes mientras se usa el taller"
        actions={
          <Button size="sm" variant="secondary" onClick={() => { insights.refetch(); metrics.refetch(); }}>
            <RefreshCw className="size-4" aria-hidden /> Actualizar
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<Cpu className="size-4" aria-hidden />} label="Memoria RSS" value={m ? `${m.memory.rssMB} MB` : '—'} hint={m ? `heap ${m.memory.heapUsedMB} MB` : ''} />
          <Stat icon={<Activity className="size-4" aria-hidden />} label="Tiempo en línea" value={m ? `${Math.floor(m.uptimeSec / 3600)} h ${Math.floor((m.uptimeSec % 3600) / 60)} min` : '—'} hint={m?.node} />
          <Stat icon={<Radio className="size-4" aria-hidden />} label="Puestos conectados" value={m?.sockets ?? '—'} hint="Sesiones con telemetría en vivo" tone="ok" />
          <Stat
            icon={<Database className="size-4" aria-hidden />}
            label="Consultas lentas"
            value={m ? `${m.queries.slow}/${m.queries.total}` : '—'}
            hint={m ? `pico ${Math.round(m.queries.maxMs)} ms` : ''}
            tone={(m?.queries.slow ?? 0) > 0 ? 'warn' : 'ok'}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[var(--brand)]" aria-hidden />
              Hallazgos de los agentes
            </CardTitle>
            <span className="flex flex-wrap items-center gap-1.5">
              {(['CRITICAL', 'ERROR', 'WARN', 'INFO'] as const).map((sv) =>
                porSeveridad[sv] ? (
                  <Badge key={sv} tone={SEV_TONE[sv]}>{porSeveridad[sv]} {sv.toLowerCase()}</Badge>
                ) : null,
              )}
            </span>
          </CardHeader>
          <CardBody className="p-0">
            {/* barra de selección */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--brand-soft)] px-4 py-2.5">
                <span className="text-[13px] font-semibold text-[var(--brand-700)]">
                  {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
                </span>
                <Button size="sm" loading={busy} onClick={() => void resolverSeleccion()}>
                  <CheckCheck className="size-4" aria-hidden /> Resolver los seleccionados
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Deseleccionar</Button>
              </div>
            )}

            <DataTable
              id="insights"
              rows={rows}
              loading={insights.loading}
              error={insights.error}
              onRetry={insights.refetch}
              columns={columns}
              getKey={(i) => i.id}
              zebra
              showDensityToggle={false}
              emptyIcon={<CheckCircle2 className="size-7 text-[var(--ok)]" aria-hidden />}
              emptyTitle={showResolved ? 'No hay hallazgos resueltos' : 'Sin hallazgos abiertos'}
              emptyDescription={showResolved
                ? 'Acá van quedando los que ya atendiste.'
                : 'Los tres sub-agentes están mirando la interfaz, las transacciones y la latencia. Cuando encuentren algo, aparece acá con la sugerencia de arreglo.'}
              toolbar={
                <>
                  <Select
                    aria-label="Agente"
                    icon={<Layers className="size-3.5" aria-hidden />}
                    value={agent}
                    onChange={(e) => { setAgent(e.target.value); setSelected(new Set()); }}
                    className="!w-56"
                  >
                    <option value="">Todos los agentes</option>
                    {Object.entries(AGENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                  <Select
                    aria-label="Severidad"
                    icon={<Filter className="size-3.5" aria-hidden />}
                    value={severity}
                    onChange={(e) => { setSeverity(e.target.value); setSelected(new Set()); }}
                    className="!w-44"
                  >
                    <option value="">Toda severidad</option>
                    {['CRITICAL', 'ERROR', 'WARN', 'INFO'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={showResolved}
                      onChange={(e) => { setShowResolved(e.target.checked); setSelected(new Set()); }}
                      className="size-3.5 accent-[var(--brand)]"
                    />
                    Ver resueltos
                  </label>
                  {!showResolved && abiertos > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmAll(true)}>
                      <CheckCheck className="size-3.5" aria-hidden /> Resolver todo lo filtrado
                    </Button>
                  )}
                </>
              }
              footer={<span>{abiertos} hallazgo{abiertos === 1 ? '' : 's'} {showResolved ? 'resueltos' : 'abiertos'}</span>}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GaugeIcon className="size-4 text-[var(--brand)]" aria-hidden /> Endpoints más lentos
            </CardTitle>
            <span className="text-[12px] text-[var(--muted)]">Ventana de medición actual</span>
          </CardHeader>
          <CardBody className="p-0">
            {metrics.loading && !m ? (
              <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (m?.routes.length ?? 0) === 0 ? (
              <EmptyState
                icon={<GaugeIcon className="size-6" aria-hidden />}
                title="Todavía no hay muestras"
                description="Las latencias se miden sobre el uso real; en cuanto haya tráfico aparecen acá."
              />
            ) : (
              <DataTable
                id="rutas-lentas"
                rows={m!.routes}
                getKey={(r) => r.route}
                showDensityToggle={false}
                initialSort={{ key: 'prom', dir: 'desc' }}
                columns={[
                  { key: 'ruta', header: 'Ruta', sortValue: (r) => r.route, cell: (r) => <span className="mono text-[12.5px]">{r.route}</span> },
                  { key: 'llamadas', header: 'Llamadas', align: 'right', sortValue: (r) => r.count, cell: (r) => <span className="mono">{r.count}</span> },
                  {
                    key: 'prom', header: 'Promedio', align: 'right', sortValue: (r) => r.avgMs,
                    cell: (r) => (
                      <span className={cn('mono font-semibold', r.avgMs > 400 ? 'text-[var(--falla)]' : r.avgMs > 150 ? 'text-[var(--warn)]' : 'text-[var(--ok)]')}>
                        {r.avgMs} ms
                      </span>
                    ),
                  },
                  { key: 'max', header: 'Máximo', align: 'right', hideBelow: 'sm', sortValue: (r) => r.maxMs, cell: (r) => <span className="mono text-[var(--muted)]">{r.maxMs} ms</span> },
                  {
                    key: 'errores', header: '5xx', align: 'right', sortValue: (r) => r.errors,
                    cell: (r) => r.errors > 0
                      ? <Badge tone="danger">{r.errors}</Badge>
                      : <span className="text-[var(--subtle)]">0</span>,
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => void resolverTodo()}
        loading={busy}
        tone="warn"
        title="Resolver todos los hallazgos filtrados"
        confirmLabel="Resolver todo"
        message={`Se marcan como atendidos los ${abiertos} hallazgos que estás viendo${agent || severity ? ' con el filtro actual' : ''}.`}
        detail="No se pierde nada: si el agente vuelve a detectar el mismo problema, lo abre otra vez con el contador en 1."
      />
    </>
  );
}
