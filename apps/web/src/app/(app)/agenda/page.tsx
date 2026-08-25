'use client';

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg, EventInput, DatesSetArg, DateSelectArg } from '@fullcalendar/core';
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  CalendarDays, Plus, X, Car, Phone, User, Hash, Clock, MessageSquare, StickyNote,
  Wrench, CheckCircle2, UserX, Trash2, ExternalLink,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Badge } from '@/components/ui';
import { Modal } from '@/components/modal';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import { APPOINTMENT_LABELS, WORKORDER_KIND_DEFS, WORKORDER_KINDS, SOCKET_EVENTS, STATUS_LABELS, type WorkOrderStatus } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';
import './calendar.css';

interface Appointment {
  id: string; scheduledAt: string; durationMin: number; status: string; reason: string | null;
  customerId: string | null; vehicleId: string | null;
  contactName: string | null; contactPhone: string | null; plate: string | null; notes: string | null;
  customer?: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null } | null;
  vehicle?: { id: string; plate: string; brand: string; model: string } | null;
  workOrder?: { id: string; number: string; status: string } | null;
}
interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }
interface VehicleOpt { id: string; plate: string; brand: string; model: string }
interface Promised {
  id: string; number: string; status: string; promisedAt: string | null;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  vehicle: { plate: string; brand: string; model: string };
}

/** Color de cada cita según su estado — el mismo criterio que los badges. */
const STATUS_COLOR: Record<string, string> = {
  PROGRAMADA: '#2563eb',
  CONFIRMADA: '#15803d',
  EN_TALLER: '#b45309',
  NO_ASISTIO: '#dc2626',
  CANCELADA: '#94a3b8',
};

export default function AgendaPage() {
  const { can } = useAuth();
  const router = useRouter();
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);

  const [range, setRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString(),
    };
  });
  const [showPromised, setShowPromised] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ start: Date; end: Date } | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appts = useApi<Appointment[]>(`/appointments${qs({ from: range.from, to: range.to })}`);
  const promised = useApi<{ rows: Promised[] }>(
    showPromised ? `/work-orders${qs({ page: 1, limit: 200, promisedFrom: range.from, promisedTo: range.to })}` : null,
  );
  const customers = useApi<CustomerOpt[]>('/customers');
  const vehicles = useApi<{ rows: VehicleOpt[] }>(customerId ? `/vehicles?page=1&limit=100&customerId=${customerId}` : null);

  const reload = useCallback(() => {
    appts.refetch();
    promised.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts.refetch, promised.refetch]);
  useSocketEvent(SOCKET_EVENTS.APPOINTMENT_CHANGED, reload);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATED, reload);

  // ------------------------------------------------------------- eventos
  const events = useMemo<EventInput[]>(() => {
    const list: EventInput[] = (appts.data ?? []).map((a) => {
      const start = new Date(a.scheduledAt);
      const title = a.customer ? customerName(a.customer) : (a.contactName ?? 'Sin nombre');
      const plate = a.vehicle?.plate ?? a.plate ?? '';
      return {
        id: a.id,
        title: plate ? `${plate} · ${title}` : title,
        start,
        end: new Date(start.getTime() + a.durationMin * 60000),
        backgroundColor: STATUS_COLOR[a.status] ?? '#2563eb',
        borderColor: STATUS_COLOR[a.status] ?? '#2563eb',
        editable: a.status !== 'CANCELADA' && !a.workOrder,
        extendedProps: { kind: 'cita' as const, appointment: a },
      };
    });

    if (showPromised) {
      for (const w of promised.data?.rows ?? []) {
        if (!w.promisedAt) continue;
        list.push({
          id: `wo-${w.id}`,
          title: `Entrega ${w.vehicle.plate} · ${w.number}`,
          start: new Date(w.promisedAt),
          allDay: false,
          display: 'list-item',
          editable: false,
          backgroundColor: 'transparent',
          borderColor: '#f97316',
          textColor: '#b45309',
          extendedProps: { kind: 'entrega' as const, workOrder: w },
        });
      }
    }
    return list;
  }, [appts.data, promised.data, showPromised]);

  // --------------------------------------------------------- interacción
  const onDatesSet = (arg: DatesSetArg) => {
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    if (from < range.from || to > range.to) setRange({ from, to });
  };

  const onSelect = (arg: DateSelectArg) => {
    if (!can('appointment:write')) return;
    setCreating({ start: arg.start, end: arg.end });
    calRef.current?.getApi().unselect();
  };

  const onEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as { kind: string; appointment?: Appointment; workOrder?: Promised };
    if (props.kind === 'entrega' && props.workOrder) {
      router.push(`/ordenes/${props.workOrder.id}`);
      return;
    }
    if (props.appointment) setSelected(props.appointment);
  };

  /** Arrastrar o estirar la cita la reprograma en el servidor. */
  async function reschedule(arg: EventDropArg | EventResizeDoneArg) {
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start) return arg.revert();
    const durationMin = end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) : undefined;
    try {
      await api.patch(`/appointments/${arg.event.id}`, {
        scheduledAt: start.toISOString(),
        ...(durationMin ? { durationMin } : {}),
      });
      reload();
    } catch (e) {
      setError((e as Error).message);
      arg.revert();
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('date'));
    const time = String(fd.get('time'));
    await act(async () => {
      await api.post('/appointments', {
        customerId: fd.get('customerId') || undefined,
        vehicleId: fd.get('vehicleId') || undefined,
        contactName: fd.get('contactName') || undefined,
        contactPhone: fd.get('contactPhone') || undefined,
        plate: fd.get('plate') || undefined,
        reason: fd.get('reason') || undefined,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        durationMin: Number(fd.get('durationMin') ?? 60),
        notes: fd.get('notes') || undefined,
      });
      setCreating(null);
      setCustomerId('');
    });
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <>
      <Topbar
        title="Agenda"
        actions={
          <>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]" data-tooltip-id="ts-tip" data-tooltip-content="Muestra también las OT con fecha de entrega comprometida">
              <input type="checkbox" className="size-4" checked={showPromised} onChange={(e) => setShowPromised(e.target.checked)} />
              Entregas comprometidas
            </label>
            {can('appointment:write') && (
              <Button
                size="sm"
                tip="También podés arrastrar sobre el calendario para elegir el horario"
                onClick={() => {
                  const start = new Date();
                  start.setMinutes(0, 0, 0);
                  start.setHours(start.getHours() + 1);
                  setCreating({ start, end: new Date(start.getTime() + 3600000) });
                }}
              >
                <Plus className="size-4" aria-hidden /> Nueva cita
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        <Card>
          <CardBody className="ts-cal">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              locale={esLocale}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next hoy',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              customButtons={{
                hoy: { text: 'Hoy', click: () => calRef.current?.getApi().today() },
              }}
              buttonText={{ month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' }}
              height="auto"
              nowIndicator
              slotMinTime="07:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              expandRows
              firstDay={1}
              weekNumbers={false}
              dayMaxEvents={4}
              businessHours={[
                { daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' },
                { daysOfWeek: [6], startTime: '08:00', endTime: '13:00' },
              ]}
              selectable={can('appointment:write')}
              selectMirror
              editable={can('appointment:write')}
              eventResizableFromStart
              events={events}
              datesSet={onDatesSet}
              select={onSelect}
              eventClick={onEventClick}
              eventDrop={(arg) => void reschedule(arg)}
              eventResize={(arg) => void reschedule(arg)}
              noEventsText="Sin citas en este período"
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--muted)]">
          <span className="font-semibold">Referencias:</span>
          {Object.entries(STATUS_COLOR).map(([k, color]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
              {APPOINTMENT_LABELS[k as keyof typeof APPOINTMENT_LABELS]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-[#f97316]" aria-hidden /> Entrega comprometida
          </span>
          {can('appointment:write') && <span className="ml-auto">Arrastrá una cita para reprogramarla; estirala para cambiar la duración.</span>}
        </div>
      </div>

      {/* ------------------------------------------------------ nueva cita */}
      <Modal open={!!creating} onClose={() => setCreating(null)} title="Nueva cita" width="lg">
        {creating && (
          <form onSubmit={crear} className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Select label="Cliente" name="customerId" icon={<User className="size-3.5" aria-hidden />} value={customerId} onChange={(e) => setCustomerId(e.target.value)} tip="Si es un cliente nuevo, dejalo vacío y anotá nombre y teléfono">
                <option value="">Sin ficha (cita rápida)</option>
                {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select label="Vehículo" name="vehicleId" icon={<Car className="size-3.5" aria-hidden />} disabled={!customerId}>
                <option value="">—</option>
                {(vehicles.data?.rows ?? []).map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
              </Select>
            </div>
            <Input label="Matrícula" name="plate" icon={<Hash className="size-3.5" aria-hidden />} className="uppercase" />
            <Input label="Contacto" name="contactName" icon={<User className="size-3.5" aria-hidden />} />
            <Input label="Teléfono" name="contactPhone" icon={<Phone className="size-3.5" aria-hidden />} />
            <Select label="Duración" name="durationMin" icon={<Clock className="size-3.5" aria-hidden />} defaultValue={String(Math.max(30, Math.round((creating.end.getTime() - creating.start.getTime()) / 60000)))}>
              <option value="30">30 min</option><option value="60">1 hora</option>
              <option value="120">2 horas</option><option value="240">Media jornada</option><option value="480">Jornada completa</option>
            </Select>
            <Input label="Fecha" name="date" type="date" icon={<CalendarDays className="size-3.5" aria-hidden />} required defaultValue={dateValue(creating.start)} />
            <Input label="Hora" name="time" type="time" icon={<Clock className="size-3.5" aria-hidden />} required defaultValue={timeValue(creating.start)} />
            <div className="md:col-span-2">
              <Input label="Motivo" name="reason" icon={<MessageSquare className="size-3.5" aria-hidden />} placeholder="Service de 10.000, ruido al frenar…" />
            </div>
            <div className="md:col-span-4"><Textarea label="Notas" name="notes" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} /></div>
            <div className="flex gap-2 md:col-span-4">
              <Button type="submit" loading={busy}>Agendar</Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(null)}>Cancelar</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --------------------------------------------------- detalle de cita */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Cita · ${formatDate(selected.scheduledAt, true)}` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selected.status === 'CONFIRMADA' ? 'success' : selected.status === 'NO_ASISTIO' ? 'danger' : selected.status === 'EN_TALLER' ? 'warn' : 'info'}>
                {APPOINTMENT_LABELS[selected.status as keyof typeof APPOINTMENT_LABELS]}
              </Badge>
              <span className="text-[12.5px] text-[var(--muted)]">{selected.durationMin} min</span>
            </div>

            <dl className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
              <Row label="Cliente" value={selected.customer ? customerName(selected.customer) : (selected.contactName ?? '—')} />
              <Row label="Teléfono" value={selected.contactPhone ?? selected.customer?.phone ?? '—'} />
              <Row label="Vehículo" value={selected.vehicle ? `${selected.vehicle.plate} · ${selected.vehicle.brand} ${selected.vehicle.model}` : (selected.plate ?? '—')} />
              <Row label="Motivo" value={selected.reason ?? '—'} />
              {selected.notes && <div className="sm:col-span-2"><Row label="Notas" value={selected.notes} /></div>}
            </dl>

            {selected.workOrder ? (
              <Button variant="secondary" className="w-full" onClick={() => router.push(`/ordenes/${selected.workOrder!.id}`)}>
                <ExternalLink className="size-4" aria-hidden /> Ver OT {selected.workOrder.number} · {STATUS_LABELS[selected.workOrder.status as WorkOrderStatus]}
              </Button>
            ) : can('appointment:write') ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'PROGRAMADA' && (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => void act(() => api.patch(`/appointments/${selected.id}`, { status: 'CONFIRMADA' }).then(() => setSelected(null)))}>
                      <CheckCircle2 className="size-3.5" aria-hidden /> Confirmar
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => void act(() => api.patch(`/appointments/${selected.id}`, { status: 'NO_ASISTIO' }).then(() => setSelected(null)))}>
                    <UserX className="size-3.5" aria-hidden /> No vino
                  </Button>
                  <Button size="sm" variant="danger" loading={busy} onClick={() => void act(() => api.del(`/appointments/${selected.id}`).then(() => setSelected(null)))}>
                    <Trash2 className="size-3.5" aria-hidden /> Cancelar cita
                  </Button>
                </div>

                {can('workorder:write') && (
                  <form
                    className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3"
                    onSubmit={(e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      const kind = new FormData(e.currentTarget).get('kind');
                      void act(async () => {
                        const wo = await api.post<{ id: string }>(`/appointments/${selected.id}/convert`, { kind });
                        router.push(`/ordenes/${wo.id}/recepcion`);
                      });
                    }}
                  >
                    <div className="min-w-[190px] flex-1">
                      <Select label="Tipo de ingreso" name="kind" defaultValue="REPARACION" icon={<Wrench className="size-3.5" aria-hidden />}>
                        {WORKORDER_KINDS.map((k) => <option key={k} value={k}>{WORKORDER_KIND_DEFS[k].label}</option>)}
                      </Select>
                    </div>
                    <Button type="submit" loading={busy} disabled={!selected.customerId && !selected.customer}>
                      <Car className="size-4" aria-hidden /> Recibir vehículo
                    </Button>
                  </form>
                )}
                {!selected.customer && (
                  <p className="text-[12px] text-[var(--warn)]">
                    Para abrir la OT la cita necesita cliente y vehículo con ficha.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--subtle)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
