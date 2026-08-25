'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, LayoutGrid, List, Columns3, Filter, X, Clock, AlertTriangle,
  Car, Wrench, Package, Fingerprint, User, ShieldCheck, CircleDollarSign, Timer, RefreshCw,
} from 'lucide-react';
import { Button, Card, CardBody, Input, Select, Skeleton, Badge, Stat, Segmented, EmptyState } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { WorkOrderCard, KindChip, type WorkOrderRow } from '@/components/work-order-card';
import { ProcessDots, ProcessBar } from '@/components/process-stepper';
import { VehicleIdentity } from '@/components/vehicle-bits';
import { StatusBadge, PriorityDot } from '@/components/status-badge';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { qs } from '@/lib/api';
import { customerName, formatDate, relativeTime, cn } from '@/lib/utils';
import {
  SOCKET_EVENTS, WORKORDER_STATUSES, STATUS_LABELS, BOARD_STATUSES,
  WORKORDER_KIND_DEFS, WORKORDER_KINDS, formatMoney,
  type Paginated, type WorkOrderKind, type WorkOrderStatus,
} from '@taller/shared';

type View = 'board' | 'cards' | 'table';

const VIEWS: { key: View; label: string; icon: typeof List; tip: string }[] = [
  { key: 'board', label: 'Tablero', icon: Columns3, tip: 'Kanban por etapa: se ve dónde está trabado el taller' },
  { key: 'cards', label: 'Fichas', icon: LayoutGrid, tip: 'Fichas con foto del vehículo, color y avance' },
  { key: 'table', label: 'Tabla', icon: List, tip: 'Listado denso, ordenable y con todos los datos' },
];

/**
 * Vista de órdenes de trabajo reutilizable: la usan /ordenes y cada página de
 * /ingresos. Recibe filtros fijos (por ejemplo, sólo siniestros) y ofrece
 * tablero, fichas y tabla sobre el mismo conjunto.
 */
export function WorkOrdersView({
  storageKey,
  fixedQuery = {},
  accent,
  hideKindFilter = false,
}: {
  storageKey: string;
  /** Filtros que no puede cambiar el usuario (los que definen la página). */
  fixedQuery?: Record<string, string>;
  accent?: string;
  hideKindFilter?: boolean;
}) {
  const [view, setView] = useState<View>('board');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [tech, setTech] = useState('');
  const [lateOnly, setLateOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ts-wo-view:${storageKey}`) as View | null;
      if (saved) setView(saved);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [storageKey]);

  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(`ts-wo-view:${storageKey}`, v);
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  // El tablero y las fichas usan /board: devuelve todo lo abierto sin paginar,
  // así ninguna orden queda afuera. La tabla sí pagina.
  const openPath = `/work-orders/board${qs({ ...fixedQuery, q })}`;
  const tablePath = `/work-orders${qs({ ...fixedQuery, page, limit: 25, q, status, kind, technicianId: tech })}`;

  const open = useApi<WorkOrderRow[]>(view !== 'table' ? openPath : null);
  const table = useApi<Paginated<WorkOrderRow>>(view === 'table' ? tablePath : null);
  const techs = useApi<{ rows: { id: string; firstName: string; lastName: string }[] }>('/users?page=1&limit=100&role=TECNICO');

  const reload = () => { open.refetch(); table.refetch(); };
  useSocketEvent(SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, reload);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_CREATED, reload);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATED, reload);

  const rows = useMemo(() => {
    let list = open.data ?? [];
    if (kind) list = list.filter((r) => r.kind === kind);
    if (tech) list = list.filter((r) => r.technician?.id === tech);
    if (status) list = list.filter((r) => r.status === status);
    if (lateOnly) list = list.filter((r) => r.promisedAt && new Date(r.promisedAt) < new Date() && r.status !== 'ENTREGADO');
    return list;
  }, [open.data, kind, tech, status, lateOnly]);

  const activas = rows.filter((r) => !['ENTREGADO', 'CANCELADO'].includes(r.status));
  const atrasadas = activas.filter((r) => r.promisedAt && new Date(r.promisedAt) < new Date());
  const enTaller = activas.filter((r) => ['EN_PROCESO', 'CONTROL_CALIDAD', 'LAVADO'].includes(r.status));
  const facturable = activas.reduce((a, r) => a + Number(r.grandTotal), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkOrderRow[]>();
    for (const col of BOARD_STATUSES) map.set(col, []);
    for (const wo of rows) map.get(wo.status)?.push(wo);
    return map;
  }, [rows]);

  const filtersOn = !!(q || status || kind || tech || lateOnly);
  const loadError = view === 'table' ? table.error : open.error;
  const clear = () => { setQ(''); setStatus(''); setKind(''); setTech(''); setLateOnly(false); setPage(1); };

  /* ------------------------------------------------------------- columnas */
  const columns: Column<WorkOrderRow>[] = [
    {
      key: 'ot',
      header: 'OT',
      width: '190px',
      sortValue: (r) => r.number,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/ordenes/${r.id}`} className="focus-ring mono rounded text-[13px] font-bold hover:text-[var(--brand)]">
            {r.number}
          </Link>
          {r.auditId && (
            <div
              className="mono flex items-center gap-1 text-[10.5px] text-[var(--subtle)]"
              data-tooltip-id="ts-tip"
              data-tooltip-content="ID de auditoría de la reparación"
            >
              <Fingerprint className="size-3 shrink-0" aria-hidden /> {r.auditId}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <PriorityDot priority={r.priority} /> {r.priority.toLowerCase()}
          </div>
        </div>
      ),
    },
    {
      key: 'vehiculo',
      header: 'Vehículo',
      sortValue: (r) => r.vehicle.plate,
      cell: (r) => <VehicleIdentity vehicle={r.vehicle} size={44} />,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      hideBelow: 'md',
      sortValue: (r) => customerName(r.customer),
      cell: (r) => (
        <div className="min-w-0 max-w-[200px]">
          <p className="truncate text-[13px]">{customerName(r.customer)}</p>
          {r.customer.phone && <p className="mono truncate text-[11px] text-[var(--muted)]">{r.customer.phone}</p>}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Ingreso',
      hideBelow: 'lg',
      sortValue: (r) => WORKORDER_KIND_DEFS[r.kind]?.short ?? r.kind,
      cell: (r) => (
        <div className="space-y-1">
          <KindChip kind={r.kind} size="sm" />
          {r.insuranceCase && (
            <p className="flex items-center gap-1 truncate text-[10.5px] text-[var(--muted)]">
              <ShieldCheck className="size-3 shrink-0" aria-hidden /> {r.insuranceCase.insurer.name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'proceso',
      header: 'Proceso',
      width: '190px',
      sortValue: (r) => r.status,
      cell: (r) => (
        <div className="space-y-1.5">
          <ProcessDots kind={r.kind} status={r.status} />
          <StatusBadge status={r.status} />
        </div>
      ),
    },
    {
      key: 'tecnico',
      header: 'Técnico',
      hideBelow: 'xl',
      sortValue: (r) => (r.technician ? `${r.technician.firstName} ${r.technician.lastName}` : 'zzz'),
      cell: (r) => (
        <span className="flex items-center gap-1.5 text-[12.5px]">
          <Wrench className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
          {r.technician ? `${r.technician.firstName} ${r.technician.lastName}` : <span className="text-[var(--subtle)]">sin asignar</span>}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Ítems',
      align: 'right',
      hideBelow: 'xl',
      tip: 'Repuestos y mano de obra cargados',
      sortValue: (r) => r._count?.items ?? 0,
      cell: (r) => (
        <span className="mono inline-flex items-center gap-1 text-[12.5px] text-[var(--muted)]">
          <Package className="size-3.5" aria-hidden /> {r._count?.items ?? 0}
        </span>
      ),
    },
    {
      key: 'tiempo',
      header: 'En taller',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => new Date(r.receivedAt).getTime(),
      cell: (r) => {
        const dias = Math.max(0, Math.floor((Date.now() - new Date(r.receivedAt).getTime()) / 86_400_000));
        const late = !!r.promisedAt && new Date(r.promisedAt) < new Date() && r.status !== 'ENTREGADO';
        return (
          <span
            className={cn('mono text-[12.5px]', late && 'font-semibold text-[var(--falla)]')}
            data-tooltip-id="ts-tip"
            data-tooltip-content={r.promisedAt ? `Prometido para ${formatDate(r.promisedAt, true)}` : `Ingresó ${relativeTime(r.receivedAt)}`}
          >
            {dias === 0 ? 'hoy' : `${dias} d`}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (r) => Number(r.grandTotal),
      cell: (r) => (
        <div>
          <p className="mono text-[13px] font-bold">{formatMoney(r.grandTotal, r.currency)}</p>
          {r.partsTotal !== undefined && (
            <p className="mono text-[10.5px] text-[var(--muted)]">
              rep. {formatMoney(r.partsTotal, r.currency)}
            </p>
          )}
        </div>
      ),
    },
  ];

  const loading = view === 'table' ? table.loading && !table.data : open.loading && !open.data;

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- resumen */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Car className="size-4" aria-hidden />} label="Vehículos en el taller" value={String(activas.length)} hint="Órdenes abiertas" />
        <Stat icon={<Timer className="size-4" aria-hidden />} label="En reparación ahora" value={String(enTaller.length)} hint="En proceso, calidad o lavado" tone="ok" />
        <Stat icon={<AlertTriangle className="size-4" aria-hidden />} label="Pasadas de fecha" value={String(atrasadas.length)} hint="Se prometieron y siguen acá" tone={atrasadas.length > 0 ? 'danger' : 'ok'} />
        <Stat icon={<CircleDollarSign className="size-4" aria-hidden />} label="Trabajo en curso" value={formatMoney(facturable)} hint="Suma de las órdenes abiertas" />
      </div>

      {/* --------------------------------------------------------- filtros */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Buscar"
              icon={<Search className="size-3.5" aria-hidden />}
              placeholder="Nº de OT, ID de auditoría, matrícula o cliente"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              tip="También busca por el ID de auditoría de la reparación"
            />
          </div>
          <div className="w-48">
            <Select label="Etapa" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {WORKORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </Select>
          </div>
          {!hideKindFilter && (
            <div className="w-48">
              <Select label="Tipo de ingreso" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {WORKORDER_KINDS.map((k) => <option key={k} value={k}>{WORKORDER_KIND_DEFS[k].short}</option>)}
              </Select>
            </div>
          )}
          <div className="w-44">
            <Select label="Técnico" icon={<Wrench className="size-3.5" aria-hidden />} value={tech} onChange={(e) => { setTech(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {(techs.data?.rows ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setLateOnly((v) => !v)}
            aria-pressed={lateOnly}
            data-tooltip-id="ts-tip"
            data-tooltip-content="Sólo las que ya pasaron la fecha prometida"
            className={cn(
              'focus-ring mb-0.5 inline-flex h-9 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--border)] px-3 text-[13px] font-medium transition',
              lateOnly ? 'border-[var(--falla-bd)] bg-[var(--falla-bg)] text-[var(--falla)]' : 'text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]',
            )}
          >
            <Clock className="size-4" aria-hidden /> Atrasadas
          </button>

          {filtersOn && (
            <Button variant="ghost" size="sm" className="mb-0.5" onClick={clear}>
              <X className="size-3.5" aria-hidden /> Limpiar
            </Button>
          )}

          <Segmented
            className="mb-0.5 ml-auto"
            label="Cambiar vista"
            value={view}
            onChange={changeView}
            options={VIEWS.map((v) => ({ value: v.key, label: v.label, icon: v.icon, tip: v.tip }))}
          />
        </CardBody>
      </Card>

      {loadError && (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-3 !border-[var(--falla-bd)] bg-[var(--falla-bg)]">
            <AlertTriangle className="size-5 shrink-0 text-[var(--falla)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-[var(--falla)]">
                No se pudieron cargar las órdenes
              </span>
              <span className="block text-[12px] text-[var(--muted)]">{loadError.message}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={reload}>
              <RefreshCw className="size-3.5" aria-hidden /> Reintentar
            </Button>
          </CardBody>
        </Card>
      )}

      {/* --------------------------------------------------------- contenido */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          {view === 'board' && (
            loading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {BOARD_STATUSES.map((c) => <Skeleton key={c} className="h-72 w-[290px] shrink-0" />)}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-4">
                {BOARD_STATUSES.map((col) => {
                  const items = grouped.get(col) ?? [];
                  const monto = items.reduce((a, r) => a + Number(r.grandTotal), 0);
                  return (
                    <section
                      key={col}
                      className="flex w-[290px] shrink-0 flex-col rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)]/70 p-2"
                      aria-label={STATUS_LABELS[col]}
                    >
                      <header className="flex items-center justify-between gap-2 px-1.5 py-1.5">
                        <h2 className="truncate text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                          {STATUS_LABELS[col]}
                        </h2>
                        <span className="flex items-center gap-1.5">
                          {monto > 0 && <span className="mono hidden text-[10.5px] text-[var(--subtle)] sm:inline">{formatMoney(monto)}</span>}
                          <span className="ts-nav-count !ml-0">{items.length}</span>
                        </span>
                      </header>
                      <div className="flex flex-col gap-2">
                        <AnimatePresence initial={false}>
                          {items.map((wo) => (
                            <motion.div
                              key={wo.id}
                              layout
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ duration: 0.18 }}
                            >
                              <WorkOrderCard row={wo} compact />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {items.length === 0 && (
                          <p className="rounded-[var(--r)] border border-dashed border-[var(--border-strong)] px-2 py-7 text-center text-[11.5px] text-[var(--subtle)]">
                            Sin vehículos acá
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )
          )}

          {view === 'cards' && (
            loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
              </div>
            ) : rows.length === 0 ? (
              <Card>
                <CardBody>
                  <EmptyState
                    icon={<Car className="size-7" aria-hidden />}
                    title={filtersOn ? 'Ninguna orden coincide con el filtro' : 'No hay vehículos en el taller'}
                    description={filtersOn
                      ? 'Probá aflojando algún filtro: etapa, tipo de ingreso, técnico o atrasadas.'
                      : 'Cuando ingrese un vehículo va a aparecer acá con su foto y su recorrido.'}
                    action={filtersOn
                      ? <Button size="sm" variant="secondary" onClick={clear}><X className="size-4" aria-hidden /> Limpiar filtros</Button>
                      : <Link href="/ordenes/nueva"><Button size="sm"><Plus className="size-4" aria-hidden /> Registrar un ingreso</Button></Link>}
                  />
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {rows.map((wo) => <WorkOrderCard key={wo.id} row={wo} />)}
              </div>
            )
          )}

          {view === 'table' && (
            <Card>
              <CardBody className="p-0">
                <DataTable
                  id={`work-orders:${storageKey}`}
                  rows={table.data?.rows}
                  loading={table.loading}
                  columns={columns}
                  getKey={(r) => r.id}
                  rowHref={(r) => `/ordenes/${r.id}`}
                  zebra
                  emptyIcon={<Car className="size-6" aria-hidden />}
                  emptyTitle="No hay órdenes que coincidan"
                  emptyDescription="Probá con otro filtro o abrí una orden nueva."
                  emptyAction={<Link href="/ordenes/nueva"><Button size="sm"><Plus className="size-4" aria-hidden /> Nueva OT</Button></Link>}
                  initialSort={{ key: 'tiempo', dir: 'desc' }}
                  footer={
                    <>
                      <span>{table.data?.total ?? 0} órdenes · página {table.data?.page ?? 1} de {table.data?.pages ?? 1}</span>
                      <span className="flex gap-2">
                        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                        <Button variant="secondary" size="sm" disabled={page >= (table.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                      </span>
                    </>
                  }
                />
              </CardBody>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
