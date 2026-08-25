'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus, X, Car, Phone, ArrowRight, User, Hash, Clock, MessageSquare, StickyNote } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Skeleton, EmptyState, Badge } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useSocketEvent } from '@/hooks/use-socket';
import { api, qs } from '@/lib/api';
import { customerName, formatDate } from '@/lib/utils';
import { APPOINTMENT_LABELS, SOCKET_EVENTS } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Appointment {
  id: string; scheduledAt: string; durationMin: number; status: string; reason: string | null;
  contactName: string | null; contactPhone: string | null; plate: string | null; notes: string | null;
  customer?: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null } | null;
  vehicle?: { id: string; plate: string; brand: string; model: string } | null;
  workOrder?: { id: string; number: string; status: string } | null;
}
interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }
interface VehicleOpt { id: string; plate: string; brand: string; model: string }

const TONE: Record<string, 'neutral' | 'info' | 'success' | 'warn' | 'danger'> = {
  PROGRAMADA: 'info', CONFIRMADA: 'success', EN_TALLER: 'warn', NO_ASISTIO: 'danger', CANCELADA: 'neutral',
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function AgendaPage() {
  const { can } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');

  const from = weekStart.toISOString();
  const to = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const { data, loading, refetch } = useApi<Appointment[]>(`/appointments${qs({ from, to })}`);
  const customers = useApi<CustomerOpt[]>('/customers');
  const vehicles = useApi<{ rows: VehicleOpt[] }>(customerId ? `/vehicles?page=1&limit=100&customerId=${customerId}` : null);

  useSocketEvent(SOCKET_EVENTS.APPOINTMENT_CHANGED, () => refetch());

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 24 * 3600 * 1000)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const d of days) map.set(d.toDateString(), []);
    for (const a of data ?? []) {
      const key = new Date(a.scheduledAt).toDateString();
      map.get(key)?.push(a);
    }
    return map;
  }, [data, days]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('date'));
    const time = String(fd.get('time'));
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
    setOpen(false);
    setCustomerId('');
    refetch();
  }

  async function cambiarEstado(id: string, status: string) {
    await api.patch(`/appointments/${id}`, { status });
    refetch();
  }

  const today = new Date().toDateString();

  return (
    <>
      <Topbar
        title="Agenda"
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 864e5))}>‹</Button>
              <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 864e5))}>›</Button>
            </div>
            {can('appointment:write') && (
              <Button size="sm" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {open ? 'Cerrar' : 'Nueva cita'}
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-6">
        {open && (
          <Card>
            <CardHeader><CardTitle>Nueva cita</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={crear} className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Select label="Cliente" name="customerId" icon={<User className="size-3.5" aria-hidden />} value={customerId} onChange={(e) => setCustomerId(e.target.value)} tip="Si es un cliente nuevo, dejalo vacío y anotá nombre y teléfono">
                    <option value="">Sin ficha (cita rápida)</option>
                    {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                  </Select>
                </div>
                <Select label="Vehículo" name="vehicleId" icon={<Car className="size-3.5" aria-hidden />} disabled={!customerId}>
                  <option value="">—</option>
                  {(vehicles.data?.rows ?? []).map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                </Select>
                <Input label="Matrícula (si no tiene ficha)" name="plate" icon={<Hash className="size-3.5" aria-hidden />} className="uppercase" />
                <Input label="Nombre de contacto" name="contactName" icon={<User className="size-3.5" aria-hidden />} />
                <Input label="Teléfono" name="contactPhone" icon={<Phone className="size-3.5" aria-hidden />} />
                <Input label="Fecha" name="date" type="date" icon={<CalendarDays className="size-3.5" aria-hidden />} required defaultValue={new Date().toISOString().slice(0, 10)} />
                <Input label="Hora" name="time" type="time" icon={<Clock className="size-3.5" aria-hidden />} required defaultValue="09:00" />
                <div className="md:col-span-2">
                  <Input label="Motivo" name="reason" icon={<MessageSquare className="size-3.5" aria-hidden />} placeholder="Service de 10.000, ruido en tren delantero…" />
                </div>
                <Select label="Duración" name="durationMin" icon={<Clock className="size-3.5" aria-hidden />} defaultValue="60" tip="Reserva el espacio en la agenda del día">
                  <option value="30">30 min</option><option value="60">1 hora</option>
                  <option value="120">2 horas</option><option value="240">Media jornada</option><option value="480">Jornada completa</option>
                </Select>
                <div className="md:col-span-4"><Textarea label="Notas" name="notes" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} /></div>
                <div className="md:col-span-4"><Button type="submit">Agendar</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        {loading && !data ? (
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            {days.map((d) => <Skeleton key={d.toISOString()} className="h-64" />)}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {days.map((day) => {
              const items = byDay.get(day.toDateString()) ?? [];
              const isToday = day.toDateString() === today;
              return (
                <section
                  key={day.toISOString()}
                  className={`rounded-[var(--r-lg)] border p-2 ${isToday ? 'border-[var(--brand-200)] bg-[var(--brand-soft)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}
                  aria-label={formatDate(day)}
                >
                  <header className="flex items-baseline justify-between px-1.5 py-1">
                    <p className={`text-[12px] font-bold uppercase ${isToday ? 'text-[var(--brand-700)]' : 'text-[var(--subtle)]'}`}>
                      {day.toLocaleDateString('es-UY', { weekday: 'short' })}
                    </p>
                    <p className="mono text-[15px] font-extrabold">{day.getDate()}</p>
                  </header>

                  <div className="space-y-1.5">
                    {items.length === 0 && <p className="px-1.5 py-4 text-center text-[11.5px] text-[var(--subtle)]">Libre</p>}
                    {items.map((a) => (
                      <div key={a.id} className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--sh-xs)]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="mono text-[12px] font-bold">
                            {new Date(a.scheduledAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Badge tone={TONE[a.status] ?? 'neutral'} className="!px-1.5 !py-0 !text-[10px]">
                            {APPOINTMENT_LABELS[a.status as keyof typeof APPOINTMENT_LABELS]}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-[13px] font-medium">
                          {a.customer ? customerName(a.customer) : a.contactName ?? 'Sin nombre'}
                        </p>
                        {(a.vehicle || a.plate) && (
                          <p className="flex items-center gap-1 truncate text-[11.5px] text-[var(--muted)]">
                            <Car className="size-3" aria-hidden />
                            <span className="mono">{a.vehicle?.plate ?? a.plate}</span>
                            {a.vehicle ? ` · ${a.vehicle.brand}` : ''}
                          </p>
                        )}
                        {a.reason && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--muted)]">{a.reason}</p>}
                        {(a.contactPhone ?? a.customer?.phone) && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--subtle)]">
                            <Phone className="size-3" aria-hidden /> {a.contactPhone ?? a.customer?.phone}
                          </p>
                        )}

                        {a.workOrder ? (
                          <Link href={`/ordenes/${a.workOrder.id}`} className="focus-ring mt-1.5 inline-flex items-center gap-1 rounded text-[11.5px] font-semibold text-[var(--brand)]">
                            {a.workOrder.number} <ArrowRight className="size-3" aria-hidden />
                          </Link>
                        ) : can('appointment:write') && a.status !== 'CANCELADA' ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {a.status === 'PROGRAMADA' && (
                              <button className="ts-chip !px-2 !py-0.5 !text-[11px]" onClick={() => void cambiarEstado(a.id, 'CONFIRMADA')}>Confirmar</button>
                            )}
                            <Link href={`/ordenes/nueva?customerId=${a.customer ? '' : ''}${a.vehicle?.id ?? ''}`} className="ts-chip !px-2 !py-0.5 !text-[11px]">Abrir OT</Link>
                            <button className="ts-chip !px-2 !py-0.5 !text-[11px]" onClick={() => void cambiarEstado(a.id, 'NO_ASISTIO')}>No vino</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {(data?.length ?? 0) === 0 && !loading && (
          <EmptyState
            icon={<CalendarDays className="size-8" aria-hidden />}
            title="Semana sin citas"
            description="Agendá los turnos y el taller sabe de antemano qué entra cada día."
          />
        )}
      </div>
    </>
  );
}

