'use client';

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg, EventInput, DatesSetArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';
import type { EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  CalendarDays, Plus, Car, Phone, User, Clock, Wrench, CheckCircle2, UserX, Trash2,
  ExternalLink, CarFront, KeyRound, Truck, ArrowUpFromLine, ArrowDownToLine, CalendarPlus,
  Wallet, CreditCard, Hash, Factory, ClipboardList, StickyNote, MessageSquare, Filter, CircleHelp,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, Select, Badge } from '@/components/ui';
import { Modal } from '@/components/modal';
import { AgendaDialog } from '@/components/agenda-dialog';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { customerName, formatDate, cn } from '@/lib/utils';
import {
  APPOINTMENT_LABELS, WORKORDER_KIND_DEFS, WORKORDER_KINDS, SOCKET_EVENTS, STATUS_LABELS,
  AGENDA_KIND_DEFS, readableAgendaKinds, writableAgendaKinds,
  type AgendaKind, type WorkOrderStatus,
} from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';
import './calendar.css';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CarFront, KeyRound, Truck, ArrowUpFromLine, ArrowDownToLine, CalendarPlus,
};
const Glyph = ({ name, className }: { name?: string; className?: string }) => {
  const Cmp = (name && ICONS[name]) || CircleHelp;
  return <Cmp className={className} />;
};

interface Appointment {
  id: string; kind: AgendaKind; scheduledAt: string; durationMin: number; status: string;
  reason: string | null; title: string | null; notes: string | null;
  customerId: string | null; vehicleId: string | null;
  contactName: string | null; contactPhone: string | null; plate: string | null;
  amount: number | string | null; currency: string | null; method: string | null; reference: string | null;
  customer?: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null } | null;
  vehicle?: { id: string; plate: string; brand: string; model: string } | null;
  workOrder?: { id: string; number: string; status: string } | null;
  supplier?: { id: string; name: string } | null;
  partsOrder?: { id: string; number: string; status: string } | null;
}
interface Promised {
  id: string; number: string; status: string; promisedAt: string | null;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean };
  vehicle: { plate: string; brand: string; model: string };
}

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', DEBITO: 'Débito', CREDITO: 'Crédito', CHEQUE: 'Cheque',
};

const plata = (v: number | string | null | undefined, cur?: string | null) =>
  v === null || v === undefined || v === ''
    ? null
    : `${cur ?? 'UYU'} ${Number(v).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Un evento cancelado o con ausencia se apaga; el color lo pone el tipo. */
function estadoTone(status: string) {
  if (status === 'CANCELADA') return { opacity: 0.42, dash: true };
  if (status === 'NO_ASISTIO') return { opacity: 0.72, dash: true };
  return { opacity: 1, dash: false };
}

export default function AgendaPage() {
  const { can } = useAuth();
  const router = useRouter();
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);

  const visibles = useMemo(() => readableAgendaKinds(can), [can]);
  const cargables = useMemo(() => writableAgendaKinds(can), [can]);

  const [range, setRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString(),
    };
  });
  const [ocultos, setOcultos] = useState<AgendaKind[]>([]);
  const [showPromised, setShowPromised] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ at: Date | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appts = useApi<Appointment[]>(`/appointments${qs({ from: range.from, to: range.to })}`);
  const promised = useApi<{ rows: Promised[] }>(
    showPromised ? `/work-orders${qs({ page: 1, limit: 200, promisedFrom: range.from, promisedTo: range.to })}` : null,
  );

  const reload = useCallback(() => {
    appts.refetch();
    promised.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts.refetch, promised.refetch]);
  useSocketEvent(SOCKET_EVENTS.APPOINTMENT_CHANGED, reload);
  useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATED, reload);

  const conteos = useMemo(() => {
    const m = {} as Record<AgendaKind, number>;
    for (const a of appts.data ?? []) m[a.kind] = (m[a.kind] ?? 0) + 1;
    return m;
  }, [appts.data]);

  // ------------------------------------------------------------- eventos
  const events = useMemo<EventInput[]>(() => {
    const list: EventInput[] = (appts.data ?? [])
      .filter((a) => visibles.includes(a.kind) && !ocultos.includes(a.kind))
      .map((a) => {
        const def = AGENDA_KIND_DEFS[a.kind] ?? AGENDA_KIND_DEFS.OTRO;
        const start = new Date(a.scheduledAt);
        const { opacity, dash } = estadoTone(a.status);
        return {
          id: a.id,
          title: tituloDe(a),
          start,
          end: new Date(start.getTime() + a.durationMin * 60000),
          backgroundColor: def.token,
          borderColor: def.token,
          textColor: '#fff',
          editable: a.status !== 'CANCELADA' && !a.workOrder,
          classNames: dash ? ['ts-ev-apagado'] : undefined,
          extendedProps: { kind: 'cita' as const, appointment: a, icon: def.icon, opacity },
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
          borderColor: 'var(--kind-reparacion)',
          textColor: 'var(--kind-reparacion)',
          extendedProps: { kind: 'entrega' as const, workOrder: w },
        });
      }
    }
    return list;
  }, [appts.data, promised.data, showPromised, ocultos, visibles]);

  // --------------------------------------------------------- interacción
  const onDatesSet = (arg: DatesSetArg) => {
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    if (from < range.from || to > range.to) setRange({ from, to });
  };

  const onSelect = (arg: DateSelectArg) => {
    if (cargables.length === 0) return;
    setCreating({ at: arg.start });
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

  /** Arrastrar o estirar el evento lo reprograma en el servidor. */
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

  /** Contenido propio del evento: icono del tipo + hora + texto. */
  const renderEvent = (arg: EventContentArg) => {
    const props = arg.event.extendedProps as { kind?: string; icon?: string; opacity?: number };
    if (arg.view.type.startsWith('list') || props.kind !== 'cita') return undefined;
    return (
      <div className="ts-ev-body" style={{ opacity: props.opacity ?? 1 }}>
        <Glyph name={props.icon} className="ts-ev-ic" />
        {arg.timeText && <span className="ts-ev-time">{arg.timeText}</span>}
        <span className="ts-ev-title">{arg.event.title}</span>
      </div>
    );
  };

  const toggleKind = (k: AgendaKind) =>
    setOcultos((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const defSel = selected ? (AGENDA_KIND_DEFS[selected.kind] ?? AGENDA_KIND_DEFS.OTRO) : null;

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
            {cargables.length > 0 && (
              <Button
                size="sm"
                tip="También podés arrastrar sobre el calendario para elegir el horario"
                onClick={() => setCreating({ at: null })}
              >
                <Plus className="size-4" aria-hidden /> Agendar
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        {/* ---------------------------------------------- filtros por tipo */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--subtle)]">
            <Filter className="size-3.5" aria-hidden /> Mostrar
          </span>
          {visibles.map((k, i) => {
            const def = AGENDA_KIND_DEFS[k];
            const on = !ocultos.includes(k);
            return (
              <motion.button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                aria-pressed={on}
                data-tooltip-id="ts-tip"
                data-tooltip-content={def.description}
                className={cn(
                  'focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition',
                  on
                    ? 'border-transparent text-[var(--on-kind)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] opacity-70 hover:opacity-100',
                )}
                style={on ? { background: def.token, color: '#fff' } : undefined}
              >
                <Glyph name={def.icon} className="size-3.5" />
                {def.short}
                {conteos[k] ? (
                  <span className={cn('rounded-full px-1.5 text-[10.5px] font-bold', on ? 'bg-white/25' : 'bg-[var(--surface-3)]')}>
                    {conteos[k]}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
          {ocultos.length > 0 && (
            <button type="button" onClick={() => setOcultos([])} className="focus-ring rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--brand-700)] underline-offset-2 hover:underline">
              Ver todo
            </button>
          )}
        </div>

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
              selectable={cargables.length > 0}
              selectMirror
              editable={cargables.length > 0}
              eventResizableFromStart
              events={events}
              eventContent={renderEvent}
              datesSet={onDatesSet}
              select={onSelect}
              eventClick={onEventClick}
              eventDrop={(arg) => void reschedule(arg)}
              eventResize={(arg) => void reschedule(arg)}
              noEventsText="Sin eventos en este período"
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--muted)]">
          <span className="font-semibold">Estados:</span>
          {Object.entries(APPOINTMENT_LABELS).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full border border-[var(--border-strong)]"
                style={{ opacity: estadoTone(k).opacity, background: 'var(--muted)' }}
                aria-hidden
              />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-[var(--kind-reparacion)]" aria-hidden /> Entrega comprometida (OT)
          </span>
          {cargables.length > 0 && <span className="ml-auto">Arrastrá sobre el calendario para agendar; estirá un evento para cambiar la duración.</span>}
        </div>
      </div>

      {/* ---------------------------------------------------- alta de evento */}
      <AgendaDialog
        open={!!creating}
        onClose={() => setCreating(null)}
        onSaved={reload}
        defaultAt={creating?.at ?? null}
      />

      {/* ------------------------------------------------ detalle del evento */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={defSel && selected ? `${defSel.label} · ${formatDate(selected.scheduledAt, true)}` : ''}
        description={defSel?.description}
        icon={<Glyph name={defSel?.icon} className="size-[19px]" />}
      >
        {selected && defSel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="ts-badge"
                style={{ background: `color-mix(in srgb, ${defSel.token} 14%, transparent)`, color: defSel.token }}
              >
                <Glyph name={defSel.icon} className="size-3.5" /> {defSel.short}
              </span>
              <Badge tone={selected.status === 'CONFIRMADA' ? 'success' : selected.status === 'NO_ASISTIO' ? 'danger' : selected.status === 'EN_TALLER' ? 'warn' : 'info'}>
                {APPOINTMENT_LABELS[selected.status as keyof typeof APPOINTMENT_LABELS]}
              </Badge>
              <span className="flex items-center gap-1 text-[12.5px] text-[var(--muted)]">
                <Clock className="size-3.5" aria-hidden /> {selected.durationMin} min
              </span>
            </div>

            <dl className="grid gap-x-6 gap-y-2.5 text-[13.5px] sm:grid-cols-2">
              {selected.title && <Row wide icon={<ClipboardList className="size-3.5" aria-hidden />} label="Detalle" value={selected.title} />}
              {(selected.customer || selected.contactName) && (
                <Row icon={<User className="size-3.5" aria-hidden />} label="Cliente" value={selected.customer ? customerName(selected.customer) : selected.contactName!} />
              )}
              {(selected.contactPhone || selected.customer?.phone) && (
                <Row icon={<Phone className="size-3.5" aria-hidden />} label="Teléfono" value={selected.contactPhone ?? selected.customer!.phone!} />
              )}
              {(selected.vehicle || selected.plate) && (
                <Row icon={<Car className="size-3.5" aria-hidden />} label="Vehículo" value={selected.vehicle ? `${selected.vehicle.plate} · ${selected.vehicle.brand} ${selected.vehicle.model}` : selected.plate!} />
              )}
              {selected.supplier && <Row icon={<Factory className="size-3.5" aria-hidden />} label="Proveedor" value={selected.supplier.name} />}
              {plata(selected.amount, selected.currency) && (
                <Row icon={<Wallet className="size-3.5" aria-hidden />} label="Importe" value={plata(selected.amount, selected.currency)!} />
              )}
              {selected.method && <Row icon={<CreditCard className="size-3.5" aria-hidden />} label="Forma" value={METODO_LABELS[selected.method] ?? selected.method} />}
              {selected.reference && <Row icon={<Hash className="size-3.5" aria-hidden />} label="Comprobante" value={selected.reference} />}
              {selected.reason && <Row wide icon={<MessageSquare className="size-3.5" aria-hidden />} label="Motivo" value={selected.reason} />}
              {selected.notes && <Row wide icon={<StickyNote className="size-3.5" aria-hidden />} label="Notas" value={selected.notes} />}
            </dl>

            {selected.workOrder ? (
              <Button variant="secondary" className="w-full" onClick={() => router.push(`/ordenes/${selected.workOrder!.id}`)}>
                <ExternalLink className="size-4" aria-hidden /> Ver OT {selected.workOrder.number} · {STATUS_LABELS[selected.workOrder.status as WorkOrderStatus]}
              </Button>
            ) : null}

            {can(defSel.write) && !selected.workOrder ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'PROGRAMADA' && (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => void act(() => api.patch(`/appointments/${selected.id}`, { status: 'CONFIRMADA' }).then(() => setSelected(null)))}>
                      <CheckCircle2 className="size-3.5" aria-hidden /> Confirmar
                    </Button>
                  )}
                  {selected.kind === 'INGRESO' && (
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => void act(() => api.patch(`/appointments/${selected.id}`, { status: 'NO_ASISTIO' }).then(() => setSelected(null)))}>
                      <UserX className="size-3.5" aria-hidden /> No vino
                    </Button>
                  )}
                  <Button size="sm" variant="danger" loading={busy} onClick={() => void act(() => api.del(`/appointments/${selected.id}`).then(() => setSelected(null)))}>
                    <Trash2 className="size-3.5" aria-hidden /> Cancelar
                  </Button>
                </div>

                {selected.kind === 'INGRESO' && can('workorder:write') && (
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
                {selected.kind === 'INGRESO' && !selected.customer && (
                  <p className="text-[12px] text-[var(--warn)]">
                    Para abrir la OT la cita necesita cliente y vehículo con ficha.
                  </p>
                )}
              </div>
            ) : !selected.workOrder ? (
              <p className="rounded-[var(--r)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px] text-[var(--muted)]">
                Tu rol puede ver este evento pero no modificarlo.
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}

/** Texto que se lee en el calendario según el tipo de evento. */
function tituloDe(a: Appointment): string {
  const plate = a.vehicle?.plate ?? a.plate ?? '';
  const quien = a.customer ? customerName(a.customer) : (a.contactName ?? '');
  switch (a.kind) {
    case 'INGRESO':
      return [plate, quien].filter(Boolean).join(' · ') || 'Ingreso';
    case 'ENTREGA':
      return [a.workOrder?.number, plate, quien].filter(Boolean).join(' · ') || 'Entrega';
    case 'ENTREGA_PROVEEDOR':
      return [a.supplier?.name, a.title].filter(Boolean).join(' · ') || 'Llegada de proveedor';
    case 'PAGO':
    case 'COBRO': {
      const monto = plata(a.amount, a.currency);
      return [a.title || quien, monto].filter(Boolean).join(' · ') || (a.kind === 'PAGO' ? 'Pago' : 'Cobro');
    }
    default:
      return a.title || quien || a.reason || 'Evento';
  }
}

function Row({ label, value, icon, wide }: { label: string; value: string; icon?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--subtle)]">{icon}{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
