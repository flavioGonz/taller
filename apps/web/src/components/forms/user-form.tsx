'use client';

import { useState, type FormEvent } from 'react';
import { User, Mail, Phone, KeyRound, Wrench, DollarSign, ShieldCheck } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from '@taller/shared';

export interface UserRecord {
  id?: string; firstName?: string; lastName?: string; email?: string; phone?: string | null;
  role?: Role; specialty?: string | null; hourlyRate?: string | number | null; isActive?: boolean;
}

export function UserForm({ value, onSaved, onCancel }: { value?: UserRecord; onSaved: () => void; onCancel?: () => void }) {
  const editing = !!value?.id;
  const [role, setRole] = useState<Role>(value?.role ?? 'TECNICO');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      phone: fd.get('phone') || undefined,
      role,
      specialty: fd.get('specialty') || undefined,
      hourlyRate: fd.get('hourlyRate') ? Number(fd.get('hourlyRate')) : undefined,
      isActive: fd.get('isActive') === 'on',
      ...(editing ? {} : { password: fd.get('password') }),
    };
    setSaving(true);
    setError(null);
    try {
      if (editing) await api.patch(`/users/${value!.id}`, body);
      else await api.post('/users', body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
      <Input label="Nombre" name="firstName" icon={<User className="size-3.5" aria-hidden />} required defaultValue={value?.firstName ?? ''} />
      <Input label="Apellido" name="lastName" icon={<User className="size-3.5" aria-hidden />} required defaultValue={value?.lastName ?? ''} />
      <Input label="Email" name="email" type="email" icon={<Mail className="size-3.5" aria-hidden />} required defaultValue={value?.email ?? ''} />
      {!editing && (
        <Input label="Contraseña inicial" name="password" type="password" minLength={8} icon={<KeyRound className="size-3.5" aria-hidden />} required tip="El usuario deberá cambiarla en su primer ingreso" />
      )}
      <Input label="Teléfono" name="phone" icon={<Phone className="size-3.5" aria-hidden />} defaultValue={value?.phone ?? ''} />
      <Select label="Rol" name="role" icon={<ShieldCheck className="size-3.5" aria-hidden />} value={role} onChange={(e) => setRole(e.target.value as Role)} tip={ROLE_DESCRIPTIONS[role]}>
        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </Select>
      <Input label="Especialidad" name="specialty" icon={<Wrench className="size-3.5" aria-hidden />} defaultValue={value?.specialty ?? ''} />
      <Input label="Costo por hora" name="hourlyRate" type="number" step="0.01" min={0} icon={<DollarSign className="size-3.5" aria-hidden />} defaultValue={value?.hourlyRate ? String(value.hourlyRate) : ''} tip="Para calcular el costo real de la mano de obra" />
      <label className="flex items-end gap-2 pb-2 text-[13.5px]">
        <input type="checkbox" name="isActive" className="size-4" defaultChecked={value?.isActive ?? true} /> Usuario activo
      </label>

      <p className="md:col-span-3 rounded-[var(--r)] bg-[var(--info-bg)] px-3 py-2 text-[12.5px] text-[var(--info)]">
        {ROLE_DESCRIPTIONS[role]}
      </p>

      {error && <p role="alert" className="md:col-span-3 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}
      <div className="ts-form-actions md:col-span-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Crear usuario'}</Button>
      </div>
    </form>
  );
}
