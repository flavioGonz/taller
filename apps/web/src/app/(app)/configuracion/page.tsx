'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2, Clock, FileText, Receipt, Bell, Users, Server, Save, Plus, Pencil, Trash2,
  KeyRound, ShieldCheck, Wrench, Warehouse, Hash, Mail, Phone, MapPin, IdCard, Globe,
  Coins, Percent, CalendarClock, Timer, Gauge, MessageCircle, CheckCircle2, AlertTriangle,
  Image as ImageIcon, Building, Info, Database, Activity, RefreshCw,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Textarea, Badge, Skeleton, Stat,
} from '@/components/ui';
import { Tabs, TabPanel, type TabDef } from '@/components/tabs';
import { DataTable, type Column } from '@/components/data-table';
import { Modal, ConfirmDialog } from '@/components/modal';
import { RowMenu } from '@/components/row-menu';
import { ImagePicker } from '@/components/image-picker';
import { UserForm, type UserRecord } from '@/components/forms/user-form';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { cn, formatDate } from '@/lib/utils';
import {
  ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS,
  withSettingsDefaults, WEEKDAYS, TIMEZONES, CURRENCIES, formatMoney,
  type WorkshopSettings, type Paginated, type Role,
} from '@taller/shared';

/* --------------------------------------------------------------- tipos */

interface Tenant {
  id: string; slug: string; name: string; legalName: string | null; taxId: string | null;
  email: string | null; phone: string | null; address: string | null; city: string | null;
  country: string; timezone: string; currency: string; locale: string; logoUrl: string | null;
  plan: string; status: string; settings: unknown; createdAt: string;
}
interface UserRow extends UserRecord {
  id: string; firstName: string; lastName: string; email: string; role: Role;
  isActive: boolean; specialty: string | null; lastLoginAt: string | null; createdAt: string;
}
interface Bay { id: string; name: string; kind: string | null; isActive: boolean; _count: { workOrders: number } }
interface Counter { id: string; key: string; period: string; value: number }

type TabKey = 'taller' | 'operacion' | 'presupuestos' | 'facturacion' | 'notificaciones' | 'usuarios' | 'sistema';

const TABS: TabDef<TabKey>[] = [
  { key: 'taller', label: 'Taller', icon: Building2, tip: 'Datos que salen en presupuestos, facturas y correos' },
  { key: 'operacion', label: 'Operación', icon: Clock, tip: 'Horarios, capacidad y bahías de trabajo' },
  { key: 'presupuestos', label: 'Presupuestos', icon: FileText, tip: 'Validez, garantía, valor hora y condiciones' },
  { key: 'facturacion', label: 'Facturación', icon: Receipt, tip: 'IVA, plazos de pago y numeración' },
  { key: 'notificaciones', label: 'Avisos', icon: Bell, tip: 'Qué se le manda al cliente y cuándo' },
  { key: 'usuarios', label: 'Usuarios y roles', icon: Users, tip: 'Quién entra al sistema y qué puede hacer' },
  { key: 'sistema', label: 'Sistema', icon: Server, tip: 'Estado del servidor y datos técnicos' },
];

/* ------------------------------------------------------------- piezas */

function Section({
  icon, title, description, children, action,
}: {
  icon: React.ReactNode; title: string; description?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-[var(--brand)]">{icon}</span> {title}
        </CardTitle>
        {action ?? (description && <span className="hidden text-[12px] text-[var(--muted)] sm:block">{description}</span>)}
      </CardHeader>
      <CardBody className="space-y-4">
        {description && <p className="text-[12.5px] text-[var(--muted)] sm:hidden">{description}</p>}
        {children}
      </CardBody>
    </Card>
  );
}

function Toggle({
  label, hint, checked, onChange, disabled, icon,
}: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: React.ReactNode;
}) {
  return (
    <label className={cn(
      'flex cursor-pointer items-start gap-2.5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] p-3 transition',
      checked && 'border-[var(--brand)] bg-[var(--brand-soft)]',
      disabled && 'cursor-default opacity-70',
    )}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-medium leading-tight">
          {icon}{label}
        </span>
        {hint && <span className="mt-0.5 block text-[11.5px] leading-tight text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------ página */

export default function ConfiguracionPage() {
  const { can } = useAuth();
  const editable = can('tenant:write');

  const [tab, setTab] = useState<TabKey>('taller');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tenant = useApi<Tenant>('/tenants/current');
  const users = useApi<Paginated<UserRow>>('/users?page=1&limit=200');
  const bays = useApi<Bay[]>(tab === 'operacion' ? '/users/bays' : null);
  const counters = useApi<Counter[]>(tab === 'facturacion' ? '/users/counters' : null);
  const health = useApi<{ status: string; db: string; dbLatencyMs: number; uptimeSec: number; version: string; env: string }>(
    tab === 'sistema' ? '/health' : null,
  );

  const [form, setForm] = useState<Partial<Tenant>>({});
  const [cfg, setCfg] = useState<WorkshopSettings>(withSettingsDefaults(undefined));

  // usuarios
  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [removingUser, setRemovingUser] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [newPass, setNewPass] = useState('');

  // bahías
  const [bayOpen, setBayOpen] = useState(false);
  const [bayDraft, setBayDraft] = useState({ id: '', name: '', kind: '' });
  const [removingBay, setRemovingBay] = useState<Bay | null>(null);

  useEffect(() => {
    if (!tenant.data) return;
    setForm(tenant.data);
    setCfg(withSettingsDefaults(tenant.data.settings));
  }, [tenant.data]);

  function flash(msg: string) {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2600);
  }

  async function save(patch: Record<string, unknown>, msg: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/tenants/current', patch);
      tenant.refetch();
      flash(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveDatos = () => save({
    name: form.name, legalName: form.legalName, taxId: form.taxId,
    email: form.email, phone: form.phone, address: form.address, city: form.city,
    logoUrl: form.logoUrl, currency: form.currency, timezone: form.timezone,
  }, 'Datos del taller guardados');

  const saveCfg = (msg: string) => save({ settings: cfg }, msg);

  const set = <S extends keyof WorkshopSettings>(section: S, patch: Partial<WorkshopSettings[S]>) =>
    setCfg((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  /* ------------------------------------------------- columnas de usuarios */
  const userColumns: Column<UserRow>[] = [
    {
      key: 'usuario',
      header: 'Usuario',
      sortValue: (u) => `${u.lastName} ${u.firstName}`,
      cell: (u) => (
        <span className="flex items-center gap-2.5">
          <span className="ts-brand-logo grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold">
            {(u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold">{u.firstName} {u.lastName}</span>
            <span className="block truncate text-[11.5px] text-[var(--muted)]">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      sortValue: (u) => ROLE_LABELS[u.role] ?? u.role,
      cell: (u) => (
        <span
          className="block max-w-[260px]"
          data-tooltip-id="ts-tip"
          data-tooltip-content={ROLE_DESCRIPTIONS[u.role] ?? ''}
        >
          <Badge tone="info">{ROLE_LABELS[u.role] ?? u.role}</Badge>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
            {(ROLE_PERMISSIONS[u.role] ?? []).length} permisos
          </span>
        </span>
      ),
    },
    {
      key: 'especialidad',
      header: 'Especialidad',
      hideBelow: 'lg',
      sortValue: (u) => u.specialty ?? '',
      cell: (u) => <span className="text-[12.5px] text-[var(--muted)]">{u.specialty ?? '—'}</span>,
    },
    {
      key: 'ultimo',
      header: 'Último ingreso',
      hideBelow: 'xl',
      align: 'right',
      sortValue: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0),
      cell: (u) => (
        <span className="text-[12px] text-[var(--muted)]">
          {u.lastLoginAt ? formatDate(u.lastLoginAt, true) : 'nunca entró'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'right',
      sortValue: (u) => (u.isActive ? 1 : 0),
      cell: (u) => <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'acciones',
      header: '',
      width: '48px',
      align: 'right',
      cell: (u) => can('user:write') ? (
        <RowMenu
          label={`Acciones de ${u.firstName} ${u.lastName}`}
          actions={[
            { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => setEditingUser(u) },
            { label: 'Restablecer contraseña', icon: <KeyRound className="size-3.5" aria-hidden />, onClick: () => { setResetting(u); setNewPass(''); } },
            { label: u.isActive ? 'Desactivar' : 'Reactivar', icon: <ShieldCheck className="size-3.5" aria-hidden />, onClick: () => void api.patch(`/users/${u.id}`, { isActive: !u.isActive }).then(() => users.refetch()) },
            { label: 'Eliminar', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemovingUser(u) },
          ]}
        />
      ) : null,
    },
  ];

  const bayColumns: Column<Bay>[] = [
    {
      key: 'nombre',
      header: 'Bahía',
      sortValue: (b) => b.name,
      cell: (b) => (
        <span className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] bg-[var(--surface-2)] text-[var(--subtle)]">
            <Warehouse className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold">{b.name}</span>
            <span className="block text-[11.5px] text-[var(--muted)]">{b.kind ?? 'uso general'}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'uso',
      header: 'Órdenes',
      align: 'right',
      tip: 'Cuántas OT pasaron por esta bahía',
      sortValue: (b) => b._count.workOrders,
      cell: (b) => <span className="mono text-[12.5px]">{b._count.workOrders}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'right',
      cell: (b) => <Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Activa' : 'Fuera de servicio'}</Badge>,
    },
    {
      key: 'acciones',
      header: '',
      width: '48px',
      align: 'right',
      cell: (b) => editable ? (
        <RowMenu
          label={`Acciones de ${b.name}`}
          actions={[
            { label: 'Editar', icon: <Pencil className="size-3.5" aria-hidden />, onClick: () => { setBayDraft({ id: b.id, name: b.name, kind: b.kind ?? '' }); setBayOpen(true); } },
            { label: b.isActive ? 'Poner fuera de servicio' : 'Reactivar', icon: <Wrench className="size-3.5" aria-hidden />, onClick: () => void api.patch(`/users/bays/${b.id}`, { isActive: !b.isActive }).then(() => bays.refetch()) },
            { label: 'Eliminar', icon: <Trash2 className="size-3.5" aria-hidden />, danger: true, onClick: () => setRemovingBay(b) },
          ]}
        />
      ) : null,
    },
  ];

  const activos = (users.data?.rows ?? []).filter((u) => u.isActive).length;
  const tecnicos = (users.data?.rows ?? []).filter((u) => u.role === 'TECNICO').length;
  const uptime = useMemo(() => {
    const s = health.data?.uptimeSec ?? 0;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  }, [health.data]);

  if (tenant.loading && !tenant.data) {
    return (<><Topbar title="Configuración" /><div className="space-y-4 p-6"><Skeleton className="h-12" /><Skeleton className="h-72" /></div></>);
  }

  return (
    <>
      <Topbar
        title="Configuración"
        actions={
          <>
            {saved && <Badge tone="success"><CheckCircle2 className="size-3.5" aria-hidden /> {saved}</Badge>}
            {!editable && <Badge tone="warn">Sólo lectura</Badge>}
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Secciones de configuración" />

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}

        <TabPanel tabKey={tab}>
          {/* ============================================================ TALLER */}
          {tab === 'taller' && (
            <div className="space-y-4">
              <Section
                icon={<Building2 className="size-4" aria-hidden />}
                title="Datos del taller"
                description="Salen impresos en presupuestos, facturas y correos al cliente."
              >
                <div className="flex flex-wrap items-start gap-5">
                  <div className="flex flex-col items-center gap-2">
                    <ImagePicker
                      value={form.logoUrl}
                      onChange={(url) => setForm({ ...form, logoUrl: url })}
                      size={96}
                      label="Logo del taller"
                      disabled={!editable}
                      fallback={<ImageIcon className="size-8" aria-hidden />}
                    />
                    <span className="text-[11px] text-[var(--muted)]">Logo</span>
                  </div>

                  <div className="grid min-w-[280px] flex-1 gap-4 md:grid-cols-3">
                    <Input label="Nombre comercial" icon={<Building className="size-3.5" aria-hidden />} value={form.name ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, name: e.target.value })} tip="Como lo conoce el cliente" />
                    <Input label="Razón social" icon={<IdCard className="size-3.5" aria-hidden />} value={form.legalName ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                    <Input label="RUT" icon={<Hash className="size-3.5" aria-hidden />} value={form.taxId ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                    <Input label="Correo" icon={<Mail className="size-3.5" aria-hidden />} type="email" value={form.email ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input label="Teléfono" icon={<Phone className="size-3.5" aria-hidden />} value={form.phone ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Input label="Ciudad" icon={<MapPin className="size-3.5" aria-hidden />} value={form.city ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    <div className="md:col-span-3">
                      <Input label="Dirección" icon={<MapPin className="size-3.5" aria-hidden />} value={form.address ?? ''} disabled={!editable} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Select label="Moneda" icon={<Coins className="size-3.5" aria-hidden />} value={form.currency ?? 'UYU'} disabled={!editable} onChange={(e) => setForm({ ...form, currency: e.target.value })} tip="Moneda con la que se presupuesta y factura">
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                  <Select label="Zona horaria" icon={<Globe className="size-3.5" aria-hidden />} value={form.timezone ?? 'America/Montevideo'} disabled={!editable} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <Input label="Identificador interno" value={tenant.data?.slug ?? ''} readOnly tip="No se cambia: lo usan los enlaces y los archivos del taller" />
                </div>

                {editable && (
                  <div className="flex justify-end border-t border-[var(--border)] pt-3">
                    <Button loading={busy} onClick={() => void saveDatos()}><Save className="size-4" aria-hidden /> Guardar datos</Button>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ========================================================= OPERACIÓN */}
          {tab === 'operacion' && (
            <div className="space-y-4">
              <Section
                icon={<Clock className="size-4" aria-hidden />}
                title="Horarios y capacidad"
                description="Definen la grilla de la agenda y cuántos vehículos se pueden tomar por día."
              >
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">Días que abre el taller</p>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                      const on = cfg.operation.workDays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          disabled={!editable}
                          aria-pressed={on}
                          onClick={() => set('operation', {
                            workDays: on
                              ? cfg.operation.workDays.filter((x) => x !== d.value)
                              : [...cfg.operation.workDays, d.value].sort(),
                          })}
                          data-tooltip-id="ts-tip"
                          data-tooltip-content={on ? `${d.label}: abierto` : `${d.label}: cerrado`}
                          className={cn(
                            'focus-ring grid h-10 w-12 place-items-center rounded-[var(--r)] border text-[13px] font-bold transition',
                            on
                              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-700)]'
                              : 'border-[var(--border)] text-[var(--subtle)] hover:border-[var(--border-strong)]',
                          )}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Input label="Abre" type="time" icon={<Clock className="size-3.5" aria-hidden />} value={cfg.operation.opensAt} disabled={!editable} onChange={(e) => set('operation', { opensAt: e.target.value })} />
                  <Input label="Cierra" type="time" icon={<Clock className="size-3.5" aria-hidden />} value={cfg.operation.closesAt} disabled={!editable} onChange={(e) => set('operation', { closesAt: e.target.value })} />
                  <Input label="Corte desde" type="time" value={cfg.operation.lunchFrom ?? ''} disabled={!editable} onChange={(e) => set('operation', { lunchFrom: e.target.value || null })} tip="Horario de almuerzo: se bloquea en la agenda" />
                  <Input label="Corte hasta" type="time" value={cfg.operation.lunchTo ?? ''} disabled={!editable} onChange={(e) => set('operation', { lunchTo: e.target.value || null })} />
                  <Input label="Duración del turno (min)" type="number" min={15} step={15} icon={<Timer className="size-3.5" aria-hidden />} value={String(cfg.operation.slotMinutes)} disabled={!editable} onChange={(e) => set('operation', { slotMinutes: Number(e.target.value) })} tip="Cada cuánto se ofrece un turno en la agenda" />
                  <Input label="Capacidad diaria" type="number" min={1} icon={<Gauge className="size-3.5" aria-hidden />} value={String(cfg.operation.dailyCapacity)} disabled={!editable} onChange={(e) => set('operation', { dailyCapacity: Number(e.target.value) })} tip="Cuántos vehículos se pueden recibir por día sin saturar" />
                  <Input label="Entrega estándar (días hábiles)" type="number" min={0} icon={<CalendarClock className="size-3.5" aria-hidden />} value={String(cfg.operation.defaultLeadDays)} disabled={!editable} onChange={(e) => set('operation', { defaultLeadDays: Number(e.target.value) })} />
                </div>

                {editable && (
                  <div className="flex justify-end border-t border-[var(--border)] pt-3">
                    <Button loading={busy} onClick={() => void saveCfg('Horarios guardados')}><Save className="size-4" aria-hidden /> Guardar horarios</Button>
                  </div>
                )}
              </Section>

              <Section
                icon={<Warehouse className="size-4" aria-hidden />}
                title="Bahías de trabajo"
                description="Los puestos físicos donde se trabaja: elevadores, alineación, cabina de pintura."
                action={editable ? (
                  <Button size="sm" variant="secondary" onClick={() => { setBayDraft({ id: '', name: '', kind: '' }); setBayOpen(true); }}>
                    <Plus className="size-3.5" aria-hidden /> Nueva bahía
                  </Button>
                ) : undefined}
              >
                <div className="-mx-4 -mb-4">
                  <DataTable
                    id="bahias"
                    rows={bays.data ?? undefined}
                    loading={bays.loading}
                    columns={bayColumns}
                    getKey={(b) => b.id}
                    showDensityToggle={false}
                    emptyIcon={<Warehouse className="size-6" aria-hidden />}
                    emptyTitle="Todavía no hay bahías"
                    emptyDescription="Cargá los puestos de trabajo para poder asignar vehículos y ver la ocupación del taller."
                    emptyAction={editable ? (
                      <Button size="sm" onClick={() => { setBayDraft({ id: '', name: '', kind: '' }); setBayOpen(true); }}>
                        <Plus className="size-4" aria-hidden /> Nueva bahía
                      </Button>
                    ) : undefined}
                  />
                </div>
              </Section>
            </div>
          )}

          {/* ====================================================== PRESUPUESTOS */}
          {tab === 'presupuestos' && (
            <Section
              icon={<FileText className="size-4" aria-hidden />}
              title="Presupuestos"
              description="Valores con los que arranca cada presupuesto nuevo y el texto que sale en el PDF."
            >
              <div className="grid gap-4 md:grid-cols-4">
                <Input label="Validez (días)" type="number" min={1} icon={<CalendarClock className="size-3.5" aria-hidden />} value={String(cfg.quotes.validityDays)} disabled={!editable} onChange={(e) => set('quotes', { validityDays: Number(e.target.value) })} tip="Cuántos días vale el precio ofrecido" />
                <Input label="Garantía por defecto (días)" type="number" min={0} icon={<ShieldCheck className="size-3.5" aria-hidden />} value={String(cfg.quotes.defaultWarrantyDays)} disabled={!editable} onChange={(e) => set('quotes', { defaultWarrantyDays: Number(e.target.value) })} />
                <Input label="Entrega por defecto (días)" type="number" min={0} icon={<Timer className="size-3.5" aria-hidden />} value={String(cfg.quotes.defaultEstimatedDays)} disabled={!editable} onChange={(e) => set('quotes', { defaultEstimatedDays: Number(e.target.value) })} />
                <Input label="Valor hora de mano de obra" type="number" min={0} icon={<Coins className="size-3.5" aria-hidden />} value={String(cfg.quotes.laborRate)} disabled={!editable} onChange={(e) => set('quotes', { laborRate: Number(e.target.value) })} tip="Se usa para cotizar la mano de obra por horas" />
              </div>

              <Toggle
                label="Exigir la descripción de la rotura antes de enviar"
                hint="No deja mandar el presupuesto si no está explicado en criollo qué tiene el vehículo."
                icon={<Info className="size-3.5" aria-hidden />}
                checked={cfg.quotes.requireSummary}
                disabled={!editable}
                onChange={(v) => set('quotes', { requireSummary: v })}
              />

              <Textarea
                label="Condiciones impresas en el PDF"
                rows={4}
                value={cfg.quotes.terms}
                disabled={!editable}
                onChange={(e) => set('quotes', { terms: e.target.value })}
                tip="Aparece al pie del presupuesto, arriba de las firmas"
              />

              {editable && (
                <div className="flex justify-end border-t border-[var(--border)] pt-3">
                  <Button loading={busy} onClick={() => void saveCfg('Presupuestos guardados')}><Save className="size-4" aria-hidden /> Guardar</Button>
                </div>
              )}
            </Section>
          )}

          {/* ======================================================= FACTURACIÓN */}
          {tab === 'facturacion' && (
            <div className="space-y-4">
              <Section
                icon={<Receipt className="size-4" aria-hidden />}
                title="Facturación"
                description="Impuestos, plazos de cobro y cómo se numeran los comprobantes."
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <Input label="IVA por defecto (%)" type="number" min={0} max={100} icon={<Percent className="size-3.5" aria-hidden />} value={String(cfg.billing.taxPct)} disabled={!editable} onChange={(e) => set('billing', { taxPct: Number(e.target.value) })} tip="Se aplica a los ítems nuevos del presupuesto" />
                  <Input label="Plazo de pago (días)" type="number" min={0} icon={<CalendarClock className="size-3.5" aria-hidden />} value={String(cfg.billing.paymentTermDays)} disabled={!editable} onChange={(e) => set('billing', { paymentTermDays: Number(e.target.value) })} tip="0 = se cobra contra entrega" />
                  <Input label="Serie de facturación" icon={<Hash className="size-3.5" aria-hidden />} value={cfg.billing.invoicePrefix} disabled={!editable} onChange={(e) => set('billing', { invoicePrefix: e.target.value.toUpperCase().slice(0, 4) })} />
                  <Select label="Moneda" icon={<Coins className="size-3.5" aria-hidden />} value={form.currency ?? 'UYU'} disabled={!editable} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                </div>

                <Toggle
                  label="Redondear los totales"
                  hint="Deja los importes sin centavos al cerrar el comprobante."
                  icon={<Coins className="size-3.5" aria-hidden />}
                  checked={cfg.billing.roundTotals}
                  disabled={!editable}
                  onChange={(v) => set('billing', { roundTotals: v })}
                />

                {editable && (
                  <div className="flex justify-end border-t border-[var(--border)] pt-3">
                    <Button loading={busy} onClick={() => void save({ settings: cfg, currency: form.currency }, 'Facturación guardada')}>
                      <Save className="size-4" aria-hidden /> Guardar
                    </Button>
                  </div>
                )}
              </Section>

              <Section
                icon={<Hash className="size-4" aria-hidden />}
                title="Numeración"
                description="En qué número va cada contador. Se maneja solo; está acá para control."
              >
                {(counters.data ?? []).length === 0 ? (
                  <p className="text-[12.5px] text-[var(--muted)]">Todavía no se emitió ningún documento.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {(counters.data ?? []).map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-[var(--r)] border border-[var(--border)] px-3 py-2">
                        <span>
                          <span className="block text-[13px] font-medium">{c.key.replace(/_/g, ' ')}</span>
                          <span className="block text-[11px] text-[var(--muted)]">período {c.period}</span>
                        </span>
                        <span className="mono text-[16px] font-bold">{c.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ==================================================== NOTIFICACIONES */}
          {tab === 'notificaciones' && (
            <div className="space-y-4">
              <Section
                icon={<Bell className="size-4" aria-hidden />}
                title="Avisos al cliente"
                description="Qué se le manda automáticamente y por dónde."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <Toggle label="Presupuesto por correo" hint="Manda el PDF al correo del cliente." icon={<Mail className="size-3.5" aria-hidden />} checked={cfg.notifications.quoteByEmail} disabled={!editable} onChange={(v) => set('notifications', { quoteByEmail: v })} />
                  <Toggle label="Presupuesto por WhatsApp" hint="Manda el PDF al teléfono del cliente." icon={<MessageCircle className="size-3.5" aria-hidden />} checked={cfg.notifications.quoteByWhatsapp} disabled={!editable} onChange={(v) => set('notifications', { quoteByWhatsapp: v })} />
                  <Toggle label="Avisar cuando está pronto" hint="Mensaje automático al pasar la OT a finalizada." icon={<CheckCircle2 className="size-3.5" aria-hidden />} checked={cfg.notifications.notifyOnReady} disabled={!editable} onChange={(v) => set('notifications', { notifyOnReady: v })} />
                </div>
                <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--info-bg)] px-3 py-2 text-[12px] text-[var(--info)]">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Estos interruptores deciden qué se ofrece. Para que salga de verdad hay que tener cargado el
                  correo saliente (SMTP) o WhatsApp en el servidor.
                </p>
              </Section>

              <Section
                icon={<CalendarClock className="size-4" aria-hidden />}
                title="Postventa"
                description="Cuándo se agenda solo el seguimiento después de entregar el vehículo."
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Input label="Encuesta a los (días)" type="number" min={0} value={String(cfg.notifications.satisfactionAfterDays)} disabled={!editable} onChange={(e) => set('notifications', { satisfactionAfterDays: Number(e.target.value) })} tip="Días después de la entrega para llamar y preguntar cómo anda" />
                  <Input label="Recordatorio de service (meses)" type="number" min={1} value={String(cfg.notifications.serviceReminderMonths)} disabled={!editable} onChange={(e) => set('notifications', { serviceReminderMonths: Number(e.target.value) })} />
                  <Input label="Aviso antes de vencer la garantía (días)" type="number" min={0} value={String(cfg.notifications.warrantyReminderDays)} disabled={!editable} onChange={(e) => set('notifications', { warrantyReminderDays: Number(e.target.value) })} />
                </div>
                {editable && (
                  <div className="flex justify-end border-t border-[var(--border)] pt-3">
                    <Button loading={busy} onClick={() => void saveCfg('Avisos guardados')}><Save className="size-4" aria-hidden /> Guardar</Button>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ========================================================= USUARIOS */}
          {tab === 'usuarios' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat icon={<Users className="size-4" aria-hidden />} label="Usuarios" value={String(users.data?.total ?? 0)} hint={`${activos} activos`} />
                <Stat icon={<Wrench className="size-4" aria-hidden />} label="Técnicos" value={String(tecnicos)} tone="ok" />
                <Stat icon={<ShieldCheck className="size-4" aria-hidden />} label="Roles disponibles" value={String(ASSIGNABLE_ROLES.length)} hint="Con permisos distintos" />
              </div>

              <Section
                icon={<Users className="size-4" aria-hidden />}
                title="Usuarios del taller"
                description="Quién entra al sistema y con qué rol."
                action={can('user:write') ? (
                  <Button size="sm" variant="secondary" onClick={() => setUserOpen(true)}>
                    <Plus className="size-3.5" aria-hidden /> Nuevo usuario
                  </Button>
                ) : undefined}
              >
                <div className="-mx-4 -mb-4">
                  <DataTable
                    id="usuarios"
                    rows={users.data?.rows}
                    loading={users.loading}
                    columns={userColumns}
                    getKey={(u) => u.id}
                    zebra
                    initialSort={{ key: 'usuario', dir: 'asc' }}
                    emptyIcon={<Users className="size-6" aria-hidden />}
                    emptyTitle="Sin usuarios"
                    emptyDescription="Creá los usuarios del taller para que cada uno entre con su rol."
                  />
                </div>
              </Section>

              <Section
                icon={<ShieldCheck className="size-4" aria-hidden />}
                title="Qué puede hacer cada rol"
                description="Los permisos son fijos: se asignan eligiendo el rol del usuario."
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <div key={r} className="rounded-[var(--r)] border border-[var(--border)] p-3">
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-bold">{ROLE_LABELS[r]}</span>
                        <Badge tone="neutral">{(ROLE_PERMISSIONS[r] ?? []).length}</Badge>
                      </p>
                      <p className="mt-1 text-[11.5px] leading-snug text-[var(--muted)]">{ROLE_DESCRIPTIONS[r]}</p>
                      <p className="mt-2 flex flex-wrap gap-1">
                        {(ROLE_PERMISSIONS[r] ?? []).slice(0, 6).map((p) => (
                          <span key={p} className="mono rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{p}</span>
                        ))}
                        {(ROLE_PERMISSIONS[r] ?? []).length > 6 && (
                          <span className="text-[10px] text-[var(--subtle)]">+{(ROLE_PERMISSIONS[r] ?? []).length - 6} más</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ========================================================== SISTEMA */}
          {tab === 'sistema' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat icon={<Activity className="size-4" aria-hidden />} label="Estado" value={health.data?.status === 'ok' ? 'En línea' : '—'} hint={health.data?.env ?? ''} tone={health.data?.status === 'ok' ? 'ok' : 'warn'} />
                <Stat icon={<Database className="size-4" aria-hidden />} label="Base de datos" value={health.data?.db === 'up' ? 'Conectada' : '—'} hint={health.data ? `${health.data.dbLatencyMs} ms` : ''} tone={health.data?.db === 'up' ? 'ok' : 'danger'} />
                <Stat icon={<Timer className="size-4" aria-hidden />} label="Tiempo en línea" value={uptime} hint="Desde el último reinicio" />
                <Stat icon={<Server className="size-4" aria-hidden />} label="Versión" value={health.data?.version ?? '—'} hint="Taller Silver Core Engine" />
              </div>

              <Section
                icon={<Info className="size-4" aria-hidden />}
                title="Datos de la instalación"
                description="Lo que hay que tener a mano cuando algo no anda."
                action={
                  <Button size="sm" variant="ghost" onClick={() => health.refetch()}>
                    <RefreshCw className="size-3.5" aria-hidden /> Actualizar
                  </Button>
                }
              >
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['Taller', tenant.data?.name ?? '—'],
                    ['Identificador', tenant.data?.slug ?? '—'],
                    ['Plan', tenant.data?.plan ?? '—'],
                    ['Estado de la cuenta', tenant.data?.status ?? '—'],
                    ['Zona horaria', tenant.data?.timezone ?? '—'],
                    ['Moneda', tenant.data?.currency ?? '—'],
                    ['En funcionamiento desde', tenant.data ? formatDate(tenant.data.createdAt) : '—'],
                    ['Entorno', health.data?.env ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[var(--r)] border border-[var(--border)] px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{k}</dt>
                      <dd className="mono text-[13.5px] font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </div>
          )}
        </TabPanel>
      </div>

      {/* ------------------------------------------------------------ modales */}
      <Modal open={userOpen} onClose={() => setUserOpen(false)} title="Nuevo usuario" width="md">
        <UserForm onSaved={() => { setUserOpen(false); users.refetch(); }} onCancel={() => setUserOpen(false)} />
      </Modal>

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={editingUser ? `Editar · ${editingUser.firstName} ${editingUser.lastName}` : ''} width="md">
        {editingUser && <UserForm value={editingUser} onSaved={() => { setEditingUser(null); users.refetch(); }} onCancel={() => setEditingUser(null)} />}
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title="Restablecer contraseña"
        description={resetting ? `Se le asigna una contraseña nueva a ${resetting.firstName}. Tiene que cambiarla al entrar.` : ''}
        width="sm"
      >
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!resetting) return;
            setBusy(true);
            void api.post(`/users/${resetting.id}/reset-password`, { password: newPass })
              .then(() => { setResetting(null); flash('Contraseña restablecida'); })
              .catch((err) => setError((err as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          <Input label="Contraseña nueva" type="password" minLength={8} value={newPass} onChange={(e) => setNewPass(e.target.value)} required autoFocus tip="Mínimo 8 caracteres" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setResetting(null)}>Cancelar</Button>
            <Button type="submit" loading={busy} disabled={newPass.length < 8}>Restablecer</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removingUser}
        onClose={() => setRemovingUser(null)}
        loading={busy}
        title="Eliminar usuario"
        message={removingUser ? `${removingUser.firstName} ${removingUser.lastName} deja de tener acceso. Su historial de trabajo se conserva.` : ''}
        onConfirm={() => {
          if (!removingUser) return;
          setBusy(true);
          void api.del(`/users/${removingUser.id}`)
            .then(() => { setRemovingUser(null); users.refetch(); })
            .finally(() => setBusy(false));
        }}
      />

      <Modal open={bayOpen} onClose={() => setBayOpen(false)} title={bayDraft.id ? 'Editar bahía' : 'Nueva bahía'} width="sm">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setBusy(true);
            const body = { name: bayDraft.name.trim(), kind: bayDraft.kind.trim() };
            const req = bayDraft.id ? api.patch(`/users/bays/${bayDraft.id}`, body) : api.post('/users/bays', body);
            void req
              .then(() => { setBayOpen(false); bays.refetch(); })
              .catch((err) => setError((err as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          <Input label="Nombre" icon={<Warehouse className="size-3.5" aria-hidden />} value={bayDraft.name} onChange={(e) => setBayDraft({ ...bayDraft, name: e.target.value })} required autoFocus placeholder="Ej: Elevador 1" />
          <Input label="Tipo de trabajo" icon={<Wrench className="size-3.5" aria-hidden />} value={bayDraft.kind} onChange={(e) => setBayDraft({ ...bayDraft, kind: e.target.value })} placeholder="Elevador, alineación, cabina de pintura…" tip="Sirve para saber qué se puede hacer en esa bahía" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBayOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={busy} disabled={!bayDraft.name.trim()}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removingBay}
        onClose={() => setRemovingBay(null)}
        loading={busy}
        title="Eliminar bahía"
        message={removingBay ? (removingBay._count.workOrders > 0
          ? `${removingBay.name} tiene ${removingBay._count.workOrders} órdenes en su historial, así que no se borra: queda fuera de servicio y no se va a poder asignar más.`
          : `Se elimina la bahía ${removingBay.name}.`) : ''}
        onConfirm={() => {
          if (!removingBay) return;
          setBusy(true);
          void api.del(`/users/bays/${removingBay.id}`)
            .then(() => { setRemovingBay(null); bays.refetch(); })
            .finally(() => setBusy(false));
        }}
      />
    </>
  );
}
