'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  PhoneCall, Check, Star, Filter, Tag, MessageSquare, Plus, AlertTriangle, CalendarClock,
  User, Car, Smile,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Select, Textarea, Input, Skeleton, EmptyState, Table, Th, Td, Badge, Stat } from '@/components/ui';
import { Modal } from '@/components/modal';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, formatDate, relativeTime } from '@/lib/utils';
import { FOLLOWUP_KINDS, FOLLOWUP_LABELS, APPROVAL_CHANNELS, CHANNEL_LABELS, type Paginated, type FollowUpKind } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface FollowUp {
  id: string; kind: FollowUpKind; status: string; dueAt: string; doneAt: string | null;
  notes: string | null; rating: number | null;
  customer?: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null } | null;
  vehicle?: { plate: string; brand: string; model: string } | null;
  workOrder?: { id: string; number: string } | null;
}

interface Stats { pendientes: number; vencidos: number; hechosMes: number; satisfaccion: number | null; encuestas: number }
interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }
interface VehicleOpt { id: string; plate: string; brand: string; model: string }

export default function PostventaPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('PENDIENTE');
  const [kind, setKind] = useState('');
  const [closing, setClosing] = useState<FollowUp | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, refetch } = useApi<Paginated<FollowUp>>(`/follow-ups${qs({ page: 1, limit: 50, status, kind })}`);
  const stats = useApi<Stats>('/follow-ups/stats');
  const customers = useApi<Paginated<CustomerOpt>>(creating ? '/customers?page=1&limit=200' : null);

  const [draft, setDraft] = useState({ customerId: '', vehicleId: '', kind: 'SATISFACCION', dueAt: '', notes: '' });
  const vehicles = useApi<Paginated<VehicleOpt>>(draft.customerId ? `/vehicles?page=1&limit=100&customerId=${draft.customerId}` : null);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/follow-ups', {
        customerId: draft.customerId || undefined,
        vehicleId: draft.vehicleId || undefined,
        kind: draft.kind,
        dueAt: draft.dueAt,
        notes: draft.notes.trim() || undefined,
      });
      setCreating(false);
      setDraft({ customerId: '', vehicleId: '', kind: 'SATISFACCION', dueAt: '', notes: '' });
      refetch();
      stats.refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cerrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!closing) return;
    const fd = new FormData(e.currentTarget);
    await api.post(`/follow-ups/${closing.id}/close`, {
      status: fd.get('result'),
      channel: fd.get('channel') || undefined,
      rating: fd.get('rating') ? Number(fd.get('rating')) : undefined,
      notes: fd.get('notes') || undefined,
    });
    setClosing(null);
    refetch();
    stats.refetch();
  }

  const overdue = (f: FollowUp) => f.status === 'PENDIENTE' && new Date(f.dueAt) <= new Date();

  return (
    <>
      <Topbar
        title="Postventa"
        actions={can('followup:write') ? (
          <Button size="sm" onClick={() => setCreating(true)} tip="Agendar un llamado o recordatorio a mano">
            <Plus className="size-4" aria-hidden /> Nuevo seguimiento
          </Button>
        ) : undefined}
      />

      <div className="space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<PhoneCall className="size-4" aria-hidden />} label="Pendientes" value={String(stats.data?.pendientes ?? 0)} hint="Contactos por hacer" />
          <Stat icon={<AlertTriangle className="size-4" aria-hidden />} label="Vencidos" value={String(stats.data?.vencidos ?? 0)} hint="Ya pasó la fecha" tone={(stats.data?.vencidos ?? 0) > 0 ? 'danger' : 'ok'} />
          <Stat icon={<Check className="size-4" aria-hidden />} label="Hechos este mes" value={String(stats.data?.hechosMes ?? 0)} tone="ok" />
          <Stat
            icon={<Smile className="size-4" aria-hidden />}
            label="Satisfacción promedio"
            value={stats.data?.satisfaccion != null ? `${stats.data.satisfaccion} / 5` : '—'}
            hint={`${stats.data?.encuestas ?? 0} encuestas respondidas`}
            tone={(stats.data?.satisfaccion ?? 5) >= 4 ? 'ok' : 'warn'}
          />
        </div>
        {closing && (
          <Card>
            <CardHeader><CardTitle>Cerrar seguimiento · {FOLLOWUP_LABELS[closing.kind]}</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={cerrar} className="grid gap-4 md:grid-cols-4">
                <Select label="Resultado" name="result" icon={<Check className="size-3.5" aria-hidden />} defaultValue="HECHO">
                  <option value="HECHO">Contactado</option>
                  <option value="DESCARTADO">Descartar</option>
                </Select>
                <Select label="Canal" name="channel" icon={<PhoneCall className="size-3.5" aria-hidden />} defaultValue="TELEFONO">
                  {APPROVAL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </Select>
                {closing.kind === 'SATISFACCION' && (
                  <Select label="Satisfacción (1-5)" name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                  </Select>
                )}
                <div className="md:col-span-4"><Textarea label="Qué dijo el cliente" name="notes" icon={<MessageSquare className="size-3.5" aria-hidden />} rows={2} /></div>
                <div className="flex gap-2 md:col-span-4">
                  <Button type="submit" size="sm"><Check className="size-4" aria-hidden /> Guardar</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setClosing(null)}>Cancelar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select label="Estado" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDIENTE">Pendientes</option>
                <option value="HECHO">Hechos</option>
                <option value="DESCARTADO">Descartados</option>
                <option value="TODOS">Todos</option>
              </Select>
            </div>
            <div className="w-56">
              <Select label="Tipo" icon={<Tag className="size-3.5" aria-hidden />} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Todos</option>
                {FOLLOWUP_KINDS.map((k) => <option key={k} value={k}>{FOLLOWUP_LABELS[k]}</option>)}
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState
                icon={<PhoneCall className="size-8" aria-hidden />}
                title={status === 'PENDIENTE' ? 'No hay nada pendiente' : 'Sin seguimientos con ese filtro'}
                description="Al entregar un vehículo se agendan solos el llamado de satisfacción y el recordatorio del próximo service. También podés agendar uno a mano."
                action={can('followup:write') ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden /> Agendar un seguimiento
                  </Button>
                ) : undefined}
              />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Tipo</Th><Th>Cliente</Th><Th>Vehículo</Th><Th>Vence</Th><Th>Estado</Th><Th /></tr>
                </thead>
                <tbody>
                  {data!.rows.map((f) => (
                    <tr key={f.id}>
                      <Td>
                        <span className="font-medium">{FOLLOWUP_LABELS[f.kind]}</span>
                        {f.workOrder && (
                          <div className="text-[11.5px]">
                            <Link href={`/ordenes/${f.workOrder.id}`} className="focus-ring rounded text-[var(--brand)] hover:underline">{f.workOrder.number}</Link>
                          </div>
                        )}
                        {f.notes && <div className="max-w-xs truncate text-[11.5px] text-[var(--muted)]">{f.notes}</div>}
                      </Td>
                      <Td className="text-[13px]">
                        {f.customer ? customerName(f.customer) : '—'}
                        <div className="text-[11.5px] text-[var(--muted)]">{f.customer?.phone ?? ''}</div>
                      </Td>
                      <Td className="mono text-[13px]">{f.vehicle?.plate ?? '—'}</Td>
                      <Td className="text-[13px]">
                        {formatDate(f.dueAt)}
                        <div className={`text-[11.5px] ${overdue(f) ? 'text-[var(--falla)]' : 'text-[var(--muted)]'}`}>{relativeTime(f.dueAt)}</div>
                      </Td>
                      <Td>
                        {f.status === 'PENDIENTE'
                          ? <Badge tone={overdue(f) ? 'danger' : 'info'}>{overdue(f) ? 'Vencido' : 'Pendiente'}</Badge>
                          : <Badge tone={f.status === 'HECHO' ? 'success' : 'neutral'}>{f.status === 'HECHO' ? 'Hecho' : 'Descartado'}</Badge>}
                        {f.rating && (
                          <div className="mt-0.5 flex items-center gap-0.5 text-[var(--warn)]">
                            {Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" aria-hidden />)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right">
                        {can('followup:write') && f.status === 'PENDIENTE' && (
                          <Button size="sm" variant="secondary" onClick={() => setClosing(f)}>Registrar</Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo seguimiento"
        description="Para llamar a un cliente sin que venga de una entrega: garantía, cobranza, recordatorio."
        width="sm"
      >
        <form onSubmit={crear} className="space-y-3">
          <Select
            label="Cliente"
            icon={<User className="size-3.5" aria-hidden />}
            value={draft.customerId}
            onChange={(e) => setDraft({ ...draft, customerId: e.target.value, vehicleId: '' })}
            required
          >
            <option value="">Elegí el cliente…</option>
            {(customers.data?.rows ?? []).map((c) => (
              <option key={c.id} value={c.id}>{customerName(c)}</option>
            ))}
          </Select>

          <Select
            label="Vehículo"
            icon={<Car className="size-3.5" aria-hidden />}
            value={draft.vehicleId}
            onChange={(e) => setDraft({ ...draft, vehicleId: e.target.value })}
            disabled={!draft.customerId}
            tip="Opcional: si el seguimiento es por un vehículo puntual"
          >
            <option value="">Sin vehículo puntual</option>
            {(vehicles.data?.rows ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>
            ))}
          </Select>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Tipo" icon={<Tag className="size-3.5" aria-hidden />} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {FOLLOWUP_KINDS.map((k) => <option key={k} value={k}>{FOLLOWUP_LABELS[k]}</option>)}
            </Select>
            <Input
              label="Cuándo hay que contactarlo"
              type="date"
              icon={<CalendarClock className="size-3.5" aria-hidden />}
              value={draft.dueAt}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Motivo"
            icon={<MessageSquare className="size-3.5" aria-hidden />}
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Ej: avisarle que llegó el repuesto que estaba esperando."
          />

          {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" loading={busy} disabled={!draft.customerId || !draft.dueAt}>Agendar</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
