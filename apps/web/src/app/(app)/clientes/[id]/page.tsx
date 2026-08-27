'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, User, Building2, Phone, Mail, MapPin, IdCard, Pencil, Car, ClipboardList,
  FileText, Receipt, CalendarDays, PhoneCall, Wallet, Plus, StickyNote, AlertTriangle,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { LoadError } from '@/components/load-error';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Skeleton, Badge, Table, Th, Td, EmptyState, Stat,
} from '@/components/ui';
import { Modal } from '@/components/modal';
import { CustomerForm, type CustomerRecord } from '@/components/forms/customer-form';
import { VehicleThumb, PlateTag } from '@/components/vehicle-bits';
import { StatusBadge } from '@/components/status-badge';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { customerName, formatDate, cn } from '@/lib/utils';
import {
  formatMoney, QUOTE_STATUS_LABELS, APPOINTMENT_LABELS, FOLLOWUP_LABELS, WORKORDER_KIND_DEFS,
  type QuoteStatus, type AppointmentStatus, type FollowUpKind, type WorkOrderStatus, type WorkOrderKind,
} from '@taller/shared';

interface Vehicle {
  id: string; plate: string; brand: string; model: string; year: number | null; color: string | null;
  photoUrl: string | null; mileage: number | null;
  brandRef: { id: string; name: string; logoFile: string | null } | null;
  _count: { workOrders: number };
}
interface Detail extends CustomerRecord {
  id: string; code: string | null; isActive: boolean; createdAt: string;
  vehicles: Vehicle[];
  workOrders: {
    id: string; number: string; kind: WorkOrderKind; status: WorkOrderStatus; receivedAt: string;
    deliveredAt: string | null; grandTotal: string; currency: string;
    vehicle: { id: string; plate: string; brand: string; model: string };
  }[];
  quotes: {
    id: string; number: string; version: number; status: QuoteStatus; total: string;
    approvedTotal: string; createdAt: string; currency: string;
    workOrder: { id: string; number: string; vehicle: { plate: string } };
  }[];
  documents: {
    id: string; type: string; number: string; issueDate: string; dueDate: string | null;
    total: string; paid: string; status: string; currency: string;
  }[];
  appointments: { id: string; scheduledAt: string; status: AppointmentStatus; reason: string | null; vehicle: { plate: string } | null }[];
  followUps: { id: string; kind: FollowUpKind; dueAt: string; doneAt: string | null; notes: string | null; workOrderId: string | null }[];
  account: { invoiced: number; paid: number; balance: number; workOrdersTotal: number };
}

const QUOTE_TONE: Record<QuoteStatus, 'neutral' | 'info' | 'success' | 'warn' | 'danger'> = {
  BORRADOR: 'neutral', ENVIADO: 'info', APROBADO: 'success', APROBADO_PARCIAL: 'warn',
  RECHAZADO: 'danger', VENCIDO: 'danger', ANULADO: 'neutral', SUPERSEDIDO: 'neutral',
};

const TABS = [
  { key: 'vehiculos', label: 'Vehículos', icon: Car },
  { key: 'ordenes', label: 'Órdenes', icon: ClipboardList },
  { key: 'presupuestos', label: 'Presupuestos', icon: FileText },
  { key: 'cuenta', label: 'Cuenta', icon: Receipt },
  { key: 'contactos', label: 'Citas y postventa', icon: CalendarDays },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { data, loading, refetch, error } = useApi<Detail>(`/customers/${id}`);
  const [tab, setTab] = useState<Tab>('vehiculos');
  const [editing, setEditing] = useState(false);

  if (loading && !data) {
    return (<><Topbar title="Cliente" /><div className="space-y-4 p-6"><Skeleton className="h-28" /><Skeleton className="h-96" /></div></>);
  }
  if (!data) return <LoadError title="Cliente" error={error} onRetry={refetch} backHref="/clientes" backLabel="Volver a clientes" />;

  const nombre = customerName(data);
  const abiertas = data.workOrders.filter((w) => !['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(w.status)).length;

  return (
    <>
      <Topbar
        title={nombre}
        actions={
          <>
            {!data.isActive && <Badge tone="warn">Inactivo</Badge>}
            {can('customer:write') && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)} tip="Editar los datos del cliente">
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            )}
            {can('workorder:write') && (
              <Button size="sm" onClick={() => { window.location.href = `/ordenes/nueva?customerId=${data.id}`; }} tip="Abrir una orden de trabajo para este cliente">
                <Plus className="size-4" aria-hidden /> Nueva OT
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href="/clientes" className="focus-ring inline-flex min-h-[24px] items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Clientes
        </Link>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* ------------------------------------------------ ficha */}
          <aside className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[var(--r)] bg-[var(--brand-soft)] text-[var(--brand-700)]">
                    {data.isCompany ? <Building2 className="size-6" aria-hidden /> : <User className="size-6" aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-tight">{nombre}</p>
                    <p className="text-[12px] text-[var(--muted)]">{data.isCompany ? 'Empresa' : 'Particular'}{data.code ? ` · ${data.code}` : ''}</p>
                    <p className="text-[11.5px] text-[var(--subtle)]">Cliente desde {formatDate(data.createdAt)}</p>
                  </div>
                </div>

                <dl className="space-y-1.5 text-[12.5px]">
                  {data.docNumber && <div className="flex items-center gap-2"><IdCard className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd className="mono">{data.docType ?? 'Doc.'} {data.docNumber}</dd></div>}
                  {data.phone && <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd><a href={`tel:${data.phone}`} className="focus-ring rounded hover:text-[var(--brand)]">{data.phone}</a></dd></div>}
                  {data.phoneAlt && <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd className="text-[var(--muted)]">{data.phoneAlt}</dd></div>}
                  {data.email && <div className="flex items-center gap-2"><Mail className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd className="truncate"><a href={`mailto:${data.email}`} className="focus-ring rounded hover:text-[var(--brand)]">{data.email}</a></dd></div>}
                  {(data.address || data.city) && <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden /><dd>{[data.address, data.city].filter(Boolean).join(', ')}</dd></div>}
                </dl>

                {data.notes && (
                  <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--surface-2)] px-2.5 py-2 text-[12px] text-[var(--muted)]">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {data.notes}
                  </p>
                )}
              </CardBody>
            </Card>

            <div className="grid gap-3">
              <Stat icon={<Car className="size-4" aria-hidden />} label="Vehículos" value={String(data.vehicles.length)} />
              <Stat icon={<ClipboardList className="size-4" aria-hidden />} label="Órdenes abiertas" value={String(abiertas)} hint={`${data.workOrders.length} en total`} tone={abiertas > 0 ? 'warn' : 'ok'} />
              <Stat icon={<Wallet className="size-4" aria-hidden />} label="Saldo pendiente" value={formatMoney(data.account.balance)} hint={`Facturado ${formatMoney(data.account.invoiced)}`} tone={data.account.balance > 0 ? 'danger' : 'ok'} />
            </div>

            {data.creditLimit && Number(data.creditLimit) > 0 && data.account.balance > Number(data.creditLimit) && (
              <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12px] text-[var(--falla)]">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                El saldo supera el límite de crédito ({formatMoney(data.creditLimit)}).
              </p>
            )}
          </aside>

          {/* ------------------------------------------------ historia */}
          <div className="space-y-4">
            <div role="tablist" aria-label="Secciones del cliente" className="flex flex-wrap gap-1 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'focus-ring flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[13px] font-medium text-[var(--muted)] transition',
                    tab === t.key && 'bg-[var(--brand-soft)] text-[var(--brand-700)]',
                  )}
                >
                  <t.icon className="size-3.5" aria-hidden /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'vehiculos' && (
              <Card>
                <CardHeader><CardTitle>Vehículos del cliente</CardTitle><span className="text-[12px] text-[var(--muted)]">{data.vehicles.length}</span></CardHeader>
                <CardBody>
                  {data.vehicles.length === 0 ? (
                    <EmptyState icon={<Car className="size-6" aria-hidden />} title="Sin vehículos" description="Todavía no hay vehículos asociados a este cliente." />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {data.vehicles.map((v) => (
                        <Link key={v.id} href={`/vehiculos/${v.id}`} className="focus-ring flex items-center gap-3 rounded-[var(--r)] border border-[var(--border)] p-3 transition hover:border-[var(--brand)] hover:shadow-[var(--sh-md)]">
                          <VehicleThumb v={v} size={56} />
                          <div className="min-w-0 flex-1">
                            <PlateTag plate={v.plate} />
                            <p className="mt-1 truncate text-[13px] font-semibold">{v.brand} {v.model}</p>
                            <p className="truncate text-[11.5px] text-[var(--muted)]">
                              {[v.year, v.color, v.mileage ? `${v.mileage.toLocaleString('es-UY')} km` : null].filter(Boolean).join(' · ')}
                            </p>
                            {v._count.workOrders > 0 && <p className="text-[11px] text-[var(--subtle)]">{v._count.workOrders} orden{v._count.workOrders === 1 ? '' : 'es'}</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {tab === 'ordenes' && (
              <Card>
                <CardHeader><CardTitle>Órdenes de trabajo</CardTitle><span className="text-[12px] text-[var(--muted)]">{data.workOrders.length}</span></CardHeader>
                <CardBody className="p-0">
                  {data.workOrders.length === 0 ? (
                    <div className="p-6"><EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title="Sin órdenes" description="Cuando ingrese un vehículo van a aparecer acá." /></div>
                  ) : (
                    <Table>
                      <thead><tr><Th>OT</Th><Th>Vehículo</Th><Th>Tipo</Th><Th>Estado</Th><Th className="text-right">Total</Th></tr></thead>
                      <tbody>
                        {data.workOrders.map((w) => (
                          <tr key={w.id}>
                            <Td>
                              <Link href={`/ordenes/${w.id}`} className="focus-ring rounded font-medium hover:text-[var(--brand)]">{w.number}</Link>
                              <div className="text-[11.5px] text-[var(--muted)]">{formatDate(w.receivedAt)}</div>
                            </Td>
                            <Td className="mono text-[12.5px]">{w.vehicle.plate}<div className="truncate text-[11px] text-[var(--muted)]">{w.vehicle.brand} {w.vehicle.model}</div></Td>
                            <Td><span className="text-[12px]">{WORKORDER_KIND_DEFS[w.kind]?.short ?? w.kind}</span></Td>
                            <Td><StatusBadge status={w.status} /></Td>
                            <Td className="mono text-right font-semibold">{formatMoney(w.grandTotal, w.currency)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            )}

            {tab === 'presupuestos' && (
              <Card>
                <CardHeader><CardTitle>Presupuestos</CardTitle><span className="text-[12px] text-[var(--muted)]">{data.quotes.length}</span></CardHeader>
                <CardBody className="p-0">
                  {data.quotes.length === 0 ? (
                    <div className="p-6"><EmptyState icon={<FileText className="size-6" aria-hidden />} title="Sin presupuestos" description="Todavía no se le presupuestó nada a este cliente." /></div>
                  ) : (
                    <Table>
                      <thead><tr><Th>Presupuesto</Th><Th>OT / vehículo</Th><Th>Estado</Th><Th className="text-right">Total</Th><Th className="text-right">Aprobado</Th></tr></thead>
                      <tbody>
                        {data.quotes.map((q) => (
                          <tr key={q.id}>
                            <Td>
                              <Link href={`/presupuestos/${q.id}`} className="focus-ring rounded font-medium hover:text-[var(--brand)]">{q.number}</Link>
                              <div className="text-[11.5px] text-[var(--muted)]">v{q.version} · {formatDate(q.createdAt)}</div>
                            </Td>
                            <Td className="text-[12.5px]">{q.workOrder.number}<div className="mono text-[11.5px] text-[var(--muted)]">{q.workOrder.vehicle.plate}</div></Td>
                            <Td><Badge tone={QUOTE_TONE[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge></Td>
                            <Td className="mono text-right">{formatMoney(q.total, q.currency)}</Td>
                            <Td className="mono text-right font-semibold text-[var(--ok)]">{Number(q.approvedTotal) > 0 ? formatMoney(q.approvedTotal, q.currency) : '—'}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            )}

            {tab === 'cuenta' && (
              <Card>
                <CardHeader>
                  <CardTitle>Estado de cuenta</CardTitle>
                  <span className={cn('text-[12.5px] font-semibold', data.account.balance > 0 ? 'text-[var(--falla)]' : 'text-[var(--ok)]')}>
                    Saldo {formatMoney(data.account.balance)}
                  </span>
                </CardHeader>
                <CardBody className="p-0">
                  {data.documents.length === 0 ? (
                    <div className="p-6"><EmptyState icon={<Receipt className="size-6" aria-hidden />} title="Sin comprobantes" description="No hay facturas ni recibos emitidos a este cliente." /></div>
                  ) : (
                    <>
                      <Table>
                        <thead><tr><Th>Comprobante</Th><Th>Fecha</Th><Th>Estado</Th><Th className="text-right">Total</Th><Th className="text-right">Pagado</Th><Th className="text-right">Saldo</Th></tr></thead>
                        <tbody>
                          {data.documents.map((d) => {
                            const saldo = Number(d.total) - Number(d.paid);
                            return (
                              <tr key={d.id}>
                                <Td><span className="font-medium">{d.type} {d.number}</span></Td>
                                <Td className="text-[12.5px]">{formatDate(d.issueDate)}</Td>
                                <Td><Badge tone={saldo <= 0 ? 'success' : d.dueDate && new Date(d.dueDate) < new Date() ? 'danger' : 'warn'}>{saldo <= 0 ? 'Pagado' : d.status.toLowerCase()}</Badge></Td>
                                <Td className="mono text-right">{formatMoney(d.total, d.currency)}</Td>
                                <Td className="mono text-right text-[var(--ok)]">{formatMoney(d.paid, d.currency)}</Td>
                                <Td className={cn('mono text-right font-semibold', saldo > 0 && 'text-[var(--falla)]')}>{formatMoney(saldo, d.currency)}</Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                      <dl className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-[13.5px]">
                        <div className="flex justify-between text-[var(--muted)]"><dt>Facturado</dt><dd className="mono">{formatMoney(data.account.invoiced)}</dd></div>
                        <div className="flex justify-between text-[var(--muted)]"><dt>Cobrado</dt><dd className="mono">{formatMoney(data.account.paid)}</dd></div>
                        <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold"><dt>Saldo pendiente</dt><dd className={cn('mono', data.account.balance > 0 && 'text-[var(--falla)]')}>{formatMoney(data.account.balance)}</dd></div>
                      </dl>
                    </>
                  )}
                </CardBody>
              </Card>
            )}

            {tab === 'contactos' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden /> Citas</CardTitle></CardHeader>
                  <CardBody className="space-y-2">
                    {data.appointments.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--muted)]">Sin citas registradas.</p>
                    ) : data.appointments.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 rounded-[var(--r)] border border-[var(--border)] p-2.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">{formatDate(a.scheduledAt, true)}</p>
                          <p className="truncate text-[11.5px] text-[var(--muted)]">{a.reason ?? 'Sin motivo cargado'}{a.vehicle ? ` · ${a.vehicle.plate}` : ''}</p>
                        </div>
                        <Badge tone={a.status === 'CANCELADA' || a.status === 'NO_ASISTIO' ? 'danger' : a.status === 'EN_TALLER' ? 'success' : 'info'}>{APPOINTMENT_LABELS[a.status]}</Badge>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><PhoneCall className="size-4" aria-hidden /> Postventa</CardTitle></CardHeader>
                  <CardBody className="space-y-2">
                    {data.followUps.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--muted)]">Sin seguimientos pendientes.</p>
                    ) : data.followUps.map((f) => (
                      <div key={f.id} className="flex items-start justify-between gap-2 rounded-[var(--r)] border border-[var(--border)] p-2.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">{FOLLOWUP_LABELS[f.kind]}</p>
                          <p className="text-[11.5px] text-[var(--muted)]">Para el {formatDate(f.dueAt)}{f.notes ? ` · ${f.notes}` : ''}</p>
                        </div>
                        <Badge tone={f.doneAt ? 'success' : new Date(f.dueAt) < new Date() ? 'warn' : 'neutral'}>
                          {f.doneAt ? 'Hecho' : new Date(f.dueAt) < new Date() ? 'Vencido' : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar cliente"
        description="Datos de contacto, documento y condiciones comerciales"
        icon={<User className="size-[19px]" aria-hidden />}
        width="md"
      >
        <CustomerForm
          value={data}
          onSaved={() => { setEditing(false); refetch(); }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}
