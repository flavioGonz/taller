'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import {
  ClipboardList, LogIn, LogOut, Wallet, TriangleAlert, ArrowRight,
  CalendarDays, FileText, Truck, PhoneCall, ShieldCheck, Timer,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Card, CardBody, CardHeader, CardTitle, Skeleton, EmptyState, Table, Th, Td } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { SOCKET_EVENTS, formatMoney, STATUS_LABELS, type WorkOrderStatus } from '@taller/shared';
import { customerName, formatDate } from '@/lib/utils';

interface Summary {
  kpis: {
    openWorkOrders: number; todayIn: number; todayOut: number; monthRevenue: number; receivables: number;
    appointmentsToday: number; quotesWaiting: number; partsInTransit: number;
    followUpsDue: number; warrantyExpiring: number; avgCycleHours: number | null;
  };
  byStatus: { status: string; count: number }[];
  series: { day: string; total: number; count: number }[];
  lowStock: { id: string; sku: string; name: string; onhand: number; minstock: number }[];
  topServices: { description: string; cnt: number; total: number }[];
  recent: {
    id: string; number: string; status: string; receivedAt: string; grandTotal: string;
    vehicle: { plate: string; brand: string; model: string };
    customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  }[];
  technicianLoad: { technicianId: string; name: string; open: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  RECEPCION: '#8590a7', DIAGNOSTICO: '#0ea5e9', PRESUPUESTADO: '#f59e0b', APROBADO: '#38bdf8',
  EN_PROCESO: '#fbbf24', ESPERA_REPUESTO: '#ef4444', CONTROL_CALIDAD: '#818cf8',
  FINALIZADO: '#10b981', ENTREGADO: '#059669', CANCELADO: '#9ca3af',
};

function Kpi({ icon, label, value, hint, tone = 'neutral' }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'neutral' | 'accent' | 'danger' }) {
  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <div className={`ts-stat-ic size-11 rounded-xl ${tone === 'danger' ? 'danger' : tone === 'accent' ? '' : 'ok'}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function MiniKpi({ icon, label, value, href, alert }: { icon: React.ReactNode; label: string; value: number | string; href?: string; alert?: boolean }) {
  const body = (
    <div className={`ts-stat flex items-center gap-3 ${alert ? '!border-[var(--warn-bd)]' : ''}`}>
      <span className={`ts-stat-ic size-8 ${alert ? 'warn' : ''}`}>{icon}</span>
      <div className="min-w-0">
        <p className="mono text-[18px] font-extrabold leading-none">{value}</p>
        <p className="truncate text-[11.5px] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="focus-ring rounded-[var(--r)]">{body}</Link> : body;
}

export default function DashboardPage() {
  const { data, loading, refetch } = useApi<Summary>('/dashboard/summary');

  // Telemetría en vivo: cualquier cambio de OT refresca los indicadores
  useSocketEvent(SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, () => refetch());
  useSocketEvent(SOCKET_EVENTS.WORKORDER_CREATED, () => refetch());

  const series = useMemo(
    () => (data?.series ?? []).map((s) => ({ ...s, label: formatDate(s.day).slice(0, 5) })),
    [data],
  );

  if (loading && !data) {
    return (
      <>
        <Topbar title="Dashboard" />
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          <Skeleton className="h-80 md:col-span-2 xl:col-span-3" />
          <Skeleton className="h-80" />
        </div>
      </>
    );
  }

  const k = data?.kpis;

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="space-y-4 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
          <Kpi icon={<ClipboardList className="size-5" aria-hidden />} label="OT abiertas" value={String(k?.openWorkOrders ?? 0)} hint="En taller ahora" tone="accent" />
          <Kpi icon={<LogIn className="size-5" aria-hidden />} label="Ingresos hoy" value={String(k?.todayIn ?? 0)} hint="Vehículos recibidos" />
          <Kpi icon={<LogOut className="size-5" aria-hidden />} label="Entregas hoy" value={String(k?.todayOut ?? 0)} hint="Vehículos entregados" />
          <Kpi icon={<Wallet className="size-5" aria-hidden />} label="Facturado del mes" value={formatMoney(k?.monthRevenue ?? 0)} hint={`Por cobrar: ${formatMoney(k?.receivables ?? 0)}`} tone={(k?.receivables ?? 0) > 0 ? 'danger' : 'neutral'} />
        </section>

        {/* Lo que necesita atención hoy */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Pendientes del día">
          <MiniKpi href="/agenda" icon={<CalendarDays className="size-4" aria-hidden />} label="Citas hoy" value={k?.appointmentsToday ?? 0} />
          <MiniKpi href="/presupuestos" icon={<FileText className="size-4" aria-hidden />} label="Esperando respuesta" value={k?.quotesWaiting ?? 0} alert={(k?.quotesWaiting ?? 0) > 0} />
          <MiniKpi href="/pedidos" icon={<Truck className="size-4" aria-hidden />} label="Repuestos en camino" value={k?.partsInTransit ?? 0} />
          <MiniKpi href="/postventa" icon={<PhoneCall className="size-4" aria-hidden />} label="Seguimientos vencidos" value={k?.followUpsDue ?? 0} alert={(k?.followUpsDue ?? 0) > 0} />
          <MiniKpi href="/ordenes" icon={<ShieldCheck className="size-4" aria-hidden />} label="Garantías por vencer" value={k?.warrantyExpiring ?? 0} />
          <MiniKpi icon={<Timer className="size-4" aria-hidden />} label="Ciclo medio" value={k?.avgCycleHours != null ? `${k.avgCycleHours} h` : '—'} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Ingresos de vehículos · últimos 30 días</CardTitle>
            </CardHeader>
            <CardBody className="h-72">
              {series.length === 0 ? (
                <EmptyState title="Sin datos todavía" description="Cuando ingreses las primeras órdenes vas a ver la evolución acá." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <defs>
                      <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={54} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number, name) => (name === 'total' ? [formatMoney(v), 'Facturado'] : [v, 'OT'])}
                    />
                    <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} fill="url(#gTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OT por estado</CardTitle>
            </CardHeader>
            <CardBody className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.byStatus ?? []} layout="vertical" margin={{ left: 40, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={110}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => STATUS_LABELS[v as WorkOrderStatus] ?? v}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [v, 'OT']}
                    labelFormatter={(v: string) => STATUS_LABELS[v as WorkOrderStatus] ?? v}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {(data?.byStatus ?? []).map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? '#8590a7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Últimas órdenes</CardTitle>
              <Link href="/ordenes" className="focus-ring inline-flex items-center gap-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
                Ver todas <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </CardHeader>
            <CardBody className="p-0">
              {(data?.recent ?? []).length === 0 ? (
                <EmptyState title="Todavía no hay órdenes" description="Creá la primera OT desde el módulo de órdenes de trabajo." />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>OT</Th><Th>Cliente</Th><Th>Vehículo</Th><Th>Estado</Th><Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.recent.map((w) => (
                      <tr key={w.id} className="transition-colors hover:bg-[var(--surface-2)]">
                        <Td>
                          <Link href={`/ordenes/${w.id}`} className="focus-ring rounded font-medium hover:underline">
                            {w.number}
                          </Link>
                          <div className="text-[11px] text-[var(--text-muted)]">{formatDate(w.receivedAt)}</div>
                        </Td>
                        <Td className="max-w-[180px] truncate">{customerName(w.customer)}</Td>
                        <Td>
                          <span className="font-mono text-xs">{w.vehicle.plate}</span>
                          <div className="text-[11px] text-[var(--text-muted)]">{w.vehicle.brand} {w.vehicle.model}</div>
                        </Td>
                        <Td><StatusBadge status={w.status} /></Td>
                        <Td className="text-right tabular-nums">{formatMoney(w.grandTotal)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-amber-500" aria-hidden /> Stock bajo
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 p-4">
                {(data?.lowStock ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--text-muted)]">Todo el inventario está por encima del mínimo.</p>
                ) : (
                  data!.lowStock.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">{p.sku}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-600">{p.onhand} / {p.minstock}</span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Carga por técnico</CardTitle></CardHeader>
              <CardBody className="space-y-2 p-4">
                {(data?.technicianLoad ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-muted)]">Sin OT asignadas.</p>
                ) : (
                  data!.technicianLoad.map((t) => (
                    <div key={t.technicianId} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs">{t.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full rounded-full bg-[var(--brand-500)]" style={{ width: `${Math.min(100, t.open * 20)}%` }} />
                      </div>
                      <span className="w-6 text-right text-xs tabular-nums">{t.open}</span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
