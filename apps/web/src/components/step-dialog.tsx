'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ClipboardList, Stethoscope, FileText, ThumbsUp, ThumbsDown, PackageSearch, Wrench,
  ShieldCheck, Droplets, PartyPopper, KeyRound, Ban, MessageSquare, Gauge, Fuel,
  Warehouse, CalendarClock, Timer, Package, Factory, Truck, User, IdCard, StickyNote,
  Send, Bell, Armchair, Car, ArrowRight, Info, CircleHelp,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/utils';
import {
  stepFormFor, STATUS_LABELS, WORKORDER_KIND_DEFS,
  type StepField, type WorkOrderStatus, type WorkOrderKind,
} from '@taller/shared';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList, Stethoscope, FileText, ThumbsUp, ThumbsDown, PackageSearch, Wrench,
  ShieldCheck, Droplets, PartyPopper, KeyRound, Ban, MessageSquare, Gauge, Fuel,
  Warehouse, CalendarClock, Timer, Package, Factory, Truck, User, IdCard, StickyNote,
  Send, Bell, Armchair, Car,
};
const Glyph = ({ name, className }: { name?: string; className?: string }) => {
  const Cmp = (name && ICONS[name]) || CircleHelp;
  return <Cmp className={className} />;
};

type Values = Record<string, string | boolean>;

/**
 * Diálogo de un paso del recorrido. Cada etapa pide lo suyo: al recibir se
 * anota el relato del cliente y el kilometraje, al diagnosticar el hallazgo,
 * al entregar quién retira. Los campos salen de `STEP_FORMS` en el paquete
 * compartido, así el servidor valida exactamente lo mismo que se muestra.
 */
export function StepDialog({
  open,
  onClose,
  workOrderId,
  workOrderKind,
  status,
  current,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  workOrderKind: WorkOrderKind;
  /** Etapa a la que se quiere mover la OT. */
  status: WorkOrderStatus | null;
  /** Valores que ya tiene la OT, para no volver a pedirlos. */
  current?: Partial<Record<string, unknown>>;
  onDone: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const def = status ? stepFormFor(status) : undefined;

  const techs = useApi<{ rows: { id: string; firstName: string; lastName: string }[] }>(
    open && def?.fields.some((f) => f.kind === 'tecnico') ? '/users?page=1&limit=100&role=TECNICO' : null,
  );
  const bays = useApi<{ id: string; name: string; isActive: boolean }[]>(
    open && def?.fields.some((f) => f.kind === 'bahia') ? '/users/bays' : null,
  );

  const [values, setValues] = useState<Values>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Al abrir, se precargan los datos que la OT ya tiene
  useEffect(() => {
    if (!open || !def) return;
    const init: Values = {};
    for (const f of def.fields) {
      const actual = current?.[f.name];
      if (actual !== undefined && actual !== null && actual !== '') {
        init[f.name] = f.kind === 'bool' ? Boolean(actual) : String(actual).slice(0, f.kind === 'date' ? 10 : f.kind === 'datetime' ? 16 : undefined);
      } else if (f.defaultValue !== undefined) {
        init[f.name] = typeof f.defaultValue === 'boolean' ? f.defaultValue : String(f.defaultValue);
      }
    }
    setValues(init);
    setNote('');
    setError(null);
    setTouched(false);
  }, [open, def, current]);

  const faltantes = useMemo(
    () => (def?.fields ?? []).filter((f) => f.required && !String(values[f.name] ?? '').trim()),
    [def, values],
  );

  if (!def || !status) return null;

  const permitido = can(def.permission);
  const set = (name: string, v: string | boolean) => setValues((p) => ({ ...p, [name]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (faltantes.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/work-orders/${workOrderId}/status`, {
        status,
        note: note.trim() || undefined,
        fields: values,
      });
      toast.ok(`La OT pasó a ${STATUS_LABELS[status!]}`, def!.title);
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      toast.error('No se pudo mover la orden', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kindDef = WORKORDER_KIND_DEFS[workOrderKind];

  function renderField(f: StepField) {
    const invalid = touched && f.required && !String(values[f.name] ?? '').trim();
    const icon = <Glyph name={f.icon} className="size-3.5" />;

    if (f.kind === 'bool') {
      const on = values[f.name] === true;
      return (
        <label
          key={f.name}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] p-3 transition',
            on && 'border-[var(--brand)] bg-[var(--brand-soft)]',
            f.wide && 'sm:col-span-2',
          )}
        >
          <input type="checkbox" checked={on} onChange={(e) => set(f.name, e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[13px] font-medium leading-tight">{icon}{f.label}</span>
            {f.hint && <span className="mt-0.5 block text-[11.5px] leading-tight text-[var(--muted)]">{f.hint}</span>}
          </span>
        </label>
      );
    }

    if (f.kind === 'textarea') {
      return (
        <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
          <Textarea
            label={f.label}
            icon={icon}
            rows={3}
            required={f.required}
            hint={f.hint}
            error={invalid ? 'Este dato es obligatorio en este paso' : undefined}
            placeholder={f.placeholder}
            value={String(values[f.name] ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
          />
        </div>
      );
    }

    if (f.kind === 'select' || f.kind === 'tecnico' || f.kind === 'bahia') {
      const options = f.kind === 'tecnico'
        ? (techs.data?.rows ?? []).map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))
        : f.kind === 'bahia'
          ? (bays.data ?? []).filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))
          : (f.options ?? []);
      return (
        <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
          <Select
            label={f.label}
            icon={icon}
            required={f.required}
            hint={f.hint}
            error={invalid ? 'Elegí una opción' : undefined}
            value={String(values[f.name] ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
          >
            <option value="">{f.kind === 'tecnico' ? 'Sin asignar' : f.kind === 'bahia' ? 'Sin bahía' : 'Elegí…'}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      );
    }

    const type = f.kind === 'number' || f.kind === 'money' ? 'number'
      : f.kind === 'date' ? 'date'
      : f.kind === 'datetime' ? 'datetime-local'
      : 'text';

    return (
      <div key={f.name} className={cn(f.wide && 'sm:col-span-2')}>
        <Input
          label={f.label}
          icon={icon}
          type={type}
          min={f.min}
          max={f.max}
          required={f.required}
          hint={f.hint}
          suffix={f.suffix}
          error={invalid ? 'Este dato es obligatorio en este paso' : undefined}
          placeholder={f.placeholder}
          value={String(values[f.name] ?? '')}
          onChange={(e) => set(f.name, e.target.value)}
        />
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={def.title}
      description={def.description}
      icon={<Glyph name={def.icon} className="size-[19px]" />}
      tone={status === 'CANCELADO' || status === 'RECHAZADO' ? 'danger' : 'brand'}
      width="md"
      persistent
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            <span className="size-2 rounded-full" style={{ background: kindDef.token }} aria-hidden />
            {kindDef.short} · pasa a <strong className="text-[var(--text)]">{STATUS_LABELS[status]}</strong>
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            onClick={(e) => void guardar(e as unknown as FormEvent)}
            loading={busy}
            disabled={!permitido || busy}
            variant={status === 'CANCELADO' || status === 'RECHAZADO' ? 'danger' : 'primary'}
          >
            {def.confirmLabel} <ArrowRight className="size-4" aria-hidden />
          </Button>
        </>
      }
    >
      {!permitido ? (
        <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13px] text-[var(--warn)]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tu rol no puede ejecutar este paso. Pedíselo a alguien con el permiso correspondiente.
        </p>
      ) : (
        <form onSubmit={guardar} className="space-y-4">
          {def.notice && (
            <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--info-bg)] px-3 py-2.5 text-[12.5px] text-[var(--info)]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {def.notice.text}
                {def.notice.href && (
                  <Link href={def.notice.href(workOrderId)} className="focus-ring ml-1 rounded font-semibold underline">
                    {def.notice.linkLabel ?? 'Abrir'}
                  </Link>
                )}
              </span>
            </p>
          )}

          <div className="grid gap-3.5 sm:grid-cols-2">
            {def.fields.map(renderField)}
          </div>

          <Textarea
            label="Nota para el historial"
            icon={<StickyNote className="size-3.5" aria-hidden />}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opcional: cualquier cosa que convenga dejar escrita de este paso."
          />

          {error && (
            <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">{error}</p>
          )}

          <button type="submit" className="sr-only" aria-hidden tabIndex={-1}>Guardar</button>
        </form>
      )}
    </Modal>
  );
}
