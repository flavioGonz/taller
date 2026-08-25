'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  CarFront, KeyRound, Truck, ArrowUpFromLine, ArrowDownToLine, CalendarPlus,
  User, Car, Phone, Hash, MessageSquare, Wrench, Warehouse, StickyNote, Package,
  Factory, Wallet, CreditCard, FileText, ClipboardList, ArrowRight, ArrowLeft,
  CalendarClock, Timer, CircleHelp, Lock,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/toast';
import { customerName, cn } from '@/lib/utils';
import {
  AGENDA_KIND_DEFS, AGENDA_KIND_LIST, writableAgendaKinds,
  type AgendaField, type AgendaKind,
} from '@taller/shared';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CarFront, KeyRound, Truck, ArrowUpFromLine, ArrowDownToLine, CalendarPlus,
  User, Car, Phone, Hash, MessageSquare, Wrench, Warehouse, StickyNote, Package,
  Factory, Wallet, CreditCard, FileText, ClipboardList,
};
const Glyph = ({ name, className }: { name?: string; className?: string }) => {
  const Cmp = (name && ICONS[name]) || CircleHelp;
  return <Cmp className={className} />;
};

type Values = Record<string, string>;

interface Opt { id: string; label: string; sub?: string }

/**
 * Alta de un evento de agenda. Primero se elige qué se está agendando —un
 * ingreso no pide lo mismo que un cobro— y recién entonces aparecen los campos
 * de ese tipo. Sólo se ofrecen los tipos que el rol puede cargar.
 */
export function AgendaDialog({
  open,
  onClose,
  onSaved,
  defaultAt,
  defaultKind,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Fecha y hora preseleccionadas (al arrastrar sobre el calendario). */
  defaultAt?: Date | null;
  defaultKind?: AgendaKind;
}) {
  const { can } = useAuth();
  const toast = useToast();

  const permitidos = useMemo(() => writableAgendaKinds(can), [can]);
  const [kind, setKind] = useState<AgendaKind | null>(null);
  const [values, setValues] = useState<Values>({});
  const [at, setAt] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = kind ? AGENDA_KIND_DEFS[kind] : null;

  // catálogos que necesitan los campos del tipo elegido
  const needs = (k: AgendaField['kind']) => !!def?.fields.some((f) => f.kind === k);
  const customers = useApi<{ rows: { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }[] }>(
    open && needs('cliente') ? '/customers?page=1&limit=200' : null);
  const vehicles = useApi<{ rows: { id: string; plate: string; brand: string; model: string; customerId: string }[] }>(
    open && needs('vehiculo') ? '/vehicles?page=1&limit=200' : null);
  const techs = useApi<{ rows: { id: string; firstName: string; lastName: string }[] }>(
    open && needs('tecnico') ? '/users?page=1&limit=100&role=TECNICO' : null);
  const bays = useApi<{ id: string; name: string; isActive: boolean }[]>(
    open && needs('bahia') ? '/users/bays' : null);
  const suppliers = useApi<{ rows: { id: string; name: string }[] } | { id: string; name: string }[]>(
    open && needs('proveedor') ? '/inventory/suppliers' : null);
  const orders = useApi<{ rows: { id: string; number: string; status: string; vehicle: { plate: string } }[] }>(
    open && needs('orden') ? '/work-orders?page=1&limit=100' : null);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind && permitidos.includes(defaultKind) ? defaultKind : permitidos.length === 1 ? permitidos[0]! : null);
    setValues({});
    setTouched(false);
    setError(null);
    const base = defaultAt ?? new Date(Date.now() + 3600_000);
    const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
    setAt(local.toISOString().slice(0, 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAt, defaultKind]);

  // al elegir el tipo se precargan sus valores por defecto (forma de pago, etc.)
  useEffect(() => {
    if (!def) return;
    setMinutes(String(def.defaultMinutes));
    setValues((prev) => {
      const next = { ...prev };
      for (const f of def.fields) {
        if (f.defaultValue !== undefined && next[f.name] === undefined) next[f.name] = String(f.defaultValue);
      }
      return next;
    });
  }, [def]);

  const faltantes = useMemo(
    () => (def?.fields ?? []).filter((f) => f.required && !String(values[f.name] ?? '').trim()),
    [def, values],
  );

  const set = (name: string, v: string) => setValues((p) => ({ ...p, [name]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!def || faltantes.length > 0 || !at) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        kind: def.kind,
        scheduledAt: new Date(at).toISOString(),
        durationMin: Number(minutes) || def.defaultMinutes,
      };
      for (const f of def.fields) {
        const v = values[f.name];
        if (v === undefined || v === '') continue;
        body[f.name] = f.kind === 'money' || f.kind === 'number' ? Number(v) : v;
      }
      await api.post('/appointments', body);
      toast.ok(`${def.label} agendado`, 'Ya aparece en el calendario del taller.');
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      toast.error('No se pudo agendar', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function optionsFor(f: AgendaField): Opt[] {
    switch (f.kind) {
      case 'cliente':
        return (customers.data?.rows ?? []).map((c) => ({ id: c.id, label: customerName(c) }));
      case 'vehiculo': {
        const list = vehicles.data?.rows ?? [];
        const cliente = values.customerId;
        return list
          .filter((v) => !cliente || v.customerId === cliente)
          .map((v) => ({ id: v.id, label: `${v.plate} · ${v.brand} ${v.model}` }));
      }
      case 'tecnico':
        return (techs.data?.rows ?? []).map((t) => ({ id: t.id, label: `${t.firstName} ${t.lastName}` }));
      case 'bahia':
        return (bays.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, label: b.name }));
      case 'proveedor': {
        const raw = suppliers.data;
        const list = Array.isArray(raw) ? raw : (raw?.rows ?? []);
        return list.map((p) => ({ id: p.id, label: p.name }));
      }
      case 'orden':
        return (orders.data?.rows ?? []).map((o) => ({ id: o.id, label: `${o.number} · ${o.vehicle.plate}` }));
      default:
        return (f.options ?? []).map((o) => ({ id: o.value, label: o.label }));
    }
  }

  function renderField(f: AgendaField) {
    const invalid = touched && f.required && !String(values[f.name] ?? '').trim();
    const icon = <Glyph name={f.icon} className="size-3.5" />;
    const selectLike = ['select', 'cliente', 'vehiculo', 'tecnico', 'bahia', 'proveedor', 'orden'].includes(f.kind);

    if (f.kind === 'textarea') {
      return (
        <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
          <Textarea
            label={f.label} icon={icon} rows={2} hint={f.hint} placeholder={f.placeholder}
            required={f.required}
            error={invalid ? 'Falta este dato' : undefined}
            value={values[f.name] ?? ''}
            onChange={(e) => set(f.name, e.target.value)}
          />
        </div>
      );
    }

    if (selectLike) {
      return (
        <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
          <Select
            label={f.label} icon={icon} hint={f.hint} required={f.required}
            error={invalid ? 'Elegí una opción' : undefined}
            value={values[f.name] ?? ''}
            onChange={(e) => set(f.name, e.target.value)}
          >
            <option value="">{f.required ? 'Elegí…' : 'Sin especificar'}</option>
            {optionsFor(f).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </div>
      );
    }

    return (
      <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
        <Input
          label={f.label} icon={icon} hint={f.hint} placeholder={f.placeholder}
          required={f.required}
          type={f.kind === 'money' || f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text'}
          min={f.kind === 'money' || f.kind === 'number' ? 0 : undefined}
          suffix={f.kind === 'money' ? '$' : f.suffix}
          error={invalid ? 'Falta este dato' : undefined}
          value={values[f.name] ?? ''}
          onChange={(e) => set(f.name, e.target.value)}
        />
      </div>
    );
  }

  /* ------------------------------------------------- paso 1: qué se agenda */
  if (open && !kind) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="¿Qué querés agendar?"
        description="Cada tipo de evento pide datos distintos; elegí uno y aparecen sus campos."
        icon={<CalendarPlus className="size-[19px]" aria-hidden />}
        width="md"
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {AGENDA_KIND_LIST.map((k, i) => {
            const puede = permitidos.includes(k.kind);
            return (
              <motion.button
                key={k.kind}
                type="button"
                disabled={!puede}
                onClick={() => setKind(k.kind)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                data-tooltip-id={!puede ? 'ts-tip' : undefined}
                data-tooltip-content={!puede ? 'Tu rol no puede agendar este tipo de evento' : undefined}
                className={cn(
                  'focus-ring flex items-start gap-3 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition',
                  puede ? 'hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--sh-md)]' : 'cursor-not-allowed opacity-55',
                )}
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-[11px]"
                  style={{ background: `color-mix(in srgb, ${k.token} 13%, transparent)`, color: k.token }}
                >
                  <Glyph name={k.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold leading-tight">{k.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--muted)]">{k.description}</span>
                </span>
                {puede
                  ? <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--subtle)]" aria-hidden />
                  : <Lock className="mt-1 size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />}
              </motion.button>
            );
          })}
        </div>
        {permitidos.length === 0 && (
          <p className="mt-4 rounded-[var(--r)] bg-[var(--warn-bg)] px-3 py-2.5 text-[12.5px] text-[var(--warn)]">
            Tu rol no puede agendar nada por ahora. Consultá con el jefe de taller.
          </p>
        )}
      </Modal>
    );
  }

  if (!def) return null;

  /* ------------------------------------------- paso 2: los campos del tipo */
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={def.label}
      description={def.description}
      icon={<Glyph name={def.icon} className="size-[19px]" />}
      width="md"
      persistent
      footer={
        <>
          {permitidos.length > 1 && (
            <Button variant="ghost" className="mr-auto" onClick={() => setKind(null)} disabled={busy}>
              <ArrowLeft className="size-4" aria-hidden /> Cambiar tipo
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={(e) => void guardar(e as unknown as FormEvent)} loading={busy}>
            Agendar
          </Button>
        </>
      }
    >
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input
            label="Cuándo"
            icon={<CalendarClock className="size-3.5" aria-hidden />}
            type="datetime-local"
            required
            value={at}
            onChange={(e) => setAt(e.target.value)}
            error={touched && !at ? 'Elegí fecha y hora' : undefined}
          />
          <Input
            label="Duración"
            icon={<Timer className="size-3.5" aria-hidden />}
            type="number"
            min={15}
            step={15}
            suffix="min"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            hint="Cuánto bloquea en el calendario"
          />
          {def.fields.map(renderField)}
        </div>

        {error && (
          <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">{error}</p>
        )}

        <button type="submit" className="sr-only" aria-hidden tabIndex={-1}>Agendar</button>
      </form>
    </Modal>
  );
}
