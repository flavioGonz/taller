'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Input, Select, Skeleton, EmptyState, Table, Th, Td } from '@/components/ui';
import { StatusBadge, PriorityDot } from '@/components/status-badge';
import { ProcessBar } from '@/components/process-stepper';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import { SOCKET_EVENTS, WORKORDER_STATUSES, STATUS_LABELS, formatMoney, WORKORDER_KIND_DEFS, WORKORDER_KINDS, type Paginated, type WorkOrderKind } from '@taller/shared';

interface Row {
  id: string; number: string; kind: WorkOrderKind; status: string; priority: string; receivedAt: string; promisedAt: string | null;
  grandTotal: string;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  vehicle: { plate: string; brand: string; model: string };
  technician?: { id: string; firstName: string; lastName: string } | null;
}

import { BOARD_STATUSES } from '@taller/shared';
const BOARD_COLUMNS = BOARD_STATUSES;

export default function OrdenesPage() {
  const [view, setView] = useState<'list' | 'board'>('board');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const listPath = `/work-orders${qs({ page, limit: 25, q, status })}`;
  const list = useApi<Paginated<Row>>(view === 'list' ? listPath : null);
  const board = useApi<Row[]>(view === 'board' ? '/work-orders/board' : null);

  const refetch = () => {
    list.refetch();
    board.refetch();
  };
  useSocketEvent(SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, refetch);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_CREATED, refetch);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATED, refetch);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const col of BOARD_COLUMNS) map.set(col, []);
    for (const wo of board.data ?? []) map.get(wo.status)?.push(wo);
    return map;
  }, [board.data]);

  return (
    <>
      <Topbar
        title="Órdenes de trabajo"
        actions={
          <>
            <div className="hidden items-center rounded-[var(--radius-app)] border border-[var(--border)] p-0.5 md:flex" role="group" aria-label="Cambiar vista">
              <button onClick={() => setView('board')} aria-pressed={view === 'board'} aria-label="Vista tablero" className={`focus-ring rounded-lg p-1.5 ${view === 'board' ? 'bg-[var(--surface-2)]' : ''}`}>
                <LayoutGrid className="size-4" aria-hidden />
              </button>
              <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="Vista lista" className={`focus-ring rounded-lg p-1.5 ${view === 'list' ? 'bg-[var(--surface-2)]' : ''}`}>
                <List className="size-4" aria-hidden />
              </button>
            </div>
            <Link href="/ordenes/nueva">
              <Button size="sm">
                <Plus className="size-4" aria-hidden /> Nueva OT
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-4 p-6">
        {view === 'list' && (
          <Card>
            <CardBody className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-[var(--text-muted)]" aria-hidden />
                <Input label="Buscar" name="q" className="pl-9" placeholder="Nº de OT, matrícula o cliente" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              </div>
              <div className="w-52">
                <Select label="Estado" name="status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">Todos</option>
                  {WORKORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </Select>
              </div>
            </CardBody>
          </Card>
        )}

        {view === 'board' ? (
          board.loading && !board.data ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {BOARD_COLUMNS.map((c) => <Skeleton key={c} className="h-64 w-72 shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {BOARD_COLUMNS.map((col) => {
                const items = grouped.get(col) ?? [];
                return (
                  <section key={col} className="flex w-72 shrink-0 flex-col rounded-[var(--radius-app)] bg-[var(--surface-2)]/60 p-2" aria-label={STATUS_LABELS[col]}>
                    <header className="flex items-center justify-between px-2 py-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{STATUS_LABELS[col]}</h2>
                      <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold tabular-nums">{items.length}</span>
                    </header>
                    <div className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {items.map((wo) => (
                          <motion.div key={wo.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}>
                            <Link href={`/ordenes/${wo.id}`} className="focus-ring block rounded-[var(--radius-app)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-shadow hover:shadow-md">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-semibold">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ background: WORKORDER_KIND_DEFS[wo.kind]?.color ?? 'var(--brand)' }}
                                    data-tooltip-id="ts-tip"
                                    data-tooltip-content={WORKORDER_KIND_DEFS[wo.kind]?.label}
                                    aria-label={WORKORDER_KIND_DEFS[wo.kind]?.label}
                                  />
                                  {wo.number}
                                </span>
                                <PriorityDot priority={wo.priority} />
                              </div>
                              <p className="mt-1 truncate text-sm">{customerName(wo.customer)}</p>
                              <p className="truncate text-[11px] text-[var(--text-muted)]">
                                <span className="font-mono">{wo.vehicle.plate}</span> · {wo.vehicle.brand} {wo.vehicle.model}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                                <span>{wo.technician ? `${wo.technician.firstName}` : 'Sin asignar'}</span>
                                <span className="mono">{formatMoney(wo.grandTotal)}</span>
                              </div>
                              <div className="mt-2"><ProcessBar kind={wo.kind} status={wo.status as never} /></div>
                            </Link>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {items.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-[var(--text-muted)]">Vacío</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          )
        ) : (
          <Card>
            <CardBody className="p-0">
              {list.loading && !list.data ? (
                <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (list.data?.rows.length ?? 0) === 0 ? (
                <EmptyState title="No hay órdenes que coincidan" description="Probá con otro filtro o creá una nueva orden de trabajo." action={<Link href="/ordenes/nueva"><Button size="sm"><Plus className="size-4" aria-hidden /> Nueva OT</Button></Link>} />
              ) : (
                <>
                  <Table>
                    <thead>
                      <tr><Th>OT</Th><Th>Cliente</Th><Th>Vehículo</Th><Th>Técnico</Th><Th>Estado</Th><Th>Ingreso</Th><Th className="text-right">Total</Th></tr>
                    </thead>
                    <tbody>
                      {list.data!.rows.map((w) => (
                        <tr key={w.id} className="transition-colors hover:bg-[var(--surface-2)]">
                          <Td>
                            <Link href={`/ordenes/${w.id}`} className="focus-ring rounded font-medium hover:underline">{w.number}</Link>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><PriorityDot priority={w.priority} /> {w.priority.toLowerCase()}</div>
                          </Td>
                          <Td className="max-w-[200px] truncate">{customerName(w.customer)}</Td>
                          <Td><span className="font-mono text-xs">{w.vehicle.plate}</span><div className="text-[11px] text-[var(--text-muted)]">{w.vehicle.brand} {w.vehicle.model}</div></Td>
                          <Td className="text-xs">{w.technician ? `${w.technician.firstName} ${w.technician.lastName}` : '—'}</Td>
                          <Td><StatusBadge status={w.status} /></Td>
                          <Td className="text-xs">{formatDate(w.receivedAt)}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(w.grandTotal)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-muted)]">
                    <span>{list.data!.total} órdenes · página {list.data!.page} de {list.data!.pages}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                      <Button variant="outline" size="sm" disabled={page >= (list.data!.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
