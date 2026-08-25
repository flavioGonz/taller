'use client';

import { useState, type FormEvent } from 'react';
import { User, Building2, IdCard, Phone, Mail, MapPin, Home, StickyNote, Wallet } from 'lucide-react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';

export interface CustomerRecord {
  id?: string;
  isCompany: boolean;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  docType?: string | null;
  docNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  creditLimit?: string | number | null;
}

/** Alta y edición de clientes: el mismo formulario para los dos casos. */
export function CustomerForm({
  value,
  onSaved,
  onCancel,
}: {
  value?: CustomerRecord;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const editing = !!value?.id;
  const [isCompany, setIsCompany] = useState(value?.isCompany ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      isCompany,
      firstName: fd.get('firstName') || undefined,
      lastName: fd.get('lastName') || undefined,
      companyName: fd.get('companyName') || undefined,
      docType: fd.get('docType') || undefined,
      docNumber: fd.get('docNumber') || undefined,
      phone: fd.get('phone') || undefined,
      phoneAlt: fd.get('phoneAlt') || undefined,
      email: fd.get('email') || undefined,
      address: fd.get('address') || undefined,
      city: fd.get('city') || undefined,
      notes: fd.get('notes') || undefined,
      creditLimit: fd.get('creditLimit') ? Number(fd.get('creditLimit')) : undefined,
    };

    setSaving(true);
    setError(null);
    try {
      if (editing) await api.patch(`/customers/${value!.id}`, body);
      else await api.post('/customers', body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
      <Select
        label="Tipo"
        name="type"
        icon={isCompany ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
        value={isCompany ? 'empresa' : 'persona'}
        onChange={(e) => setIsCompany(e.target.value === 'empresa')}
        tip="Una empresa se identifica por razón social y RUT; una persona por nombre y cédula"
      >
        <option value="persona">Persona</option>
        <option value="empresa">Empresa</option>
      </Select>

      {isCompany ? (
        <div className="md:col-span-2">
          <Input label="Razón social" name="companyName" icon={<Building2 className="size-3.5" aria-hidden />} defaultValue={value?.companyName ?? ''} required />
        </div>
      ) : (
        <>
          <Input label="Nombre" name="firstName" icon={<User className="size-3.5" aria-hidden />} defaultValue={value?.firstName ?? ''} required />
          <Input label="Apellido" name="lastName" icon={<User className="size-3.5" aria-hidden />} defaultValue={value?.lastName ?? ''} required />
        </>
      )}

      <Select label="Tipo de documento" name="docType" icon={<IdCard className="size-3.5" aria-hidden />} defaultValue={value?.docType ?? 'CI'}>
        <option value="CI">CI</option><option value="RUT">RUT</option><option value="DNI">DNI</option>
      </Select>
      <Input label="Documento" name="docNumber" icon={<IdCard className="size-3.5" aria-hidden />} defaultValue={value?.docNumber ?? ''} tip="Es único por taller: evita fichas duplicadas del mismo cliente" />
      <Input label="Teléfono" name="phone" icon={<Phone className="size-3.5" aria-hidden />} defaultValue={value?.phone ?? ''} tip="Por acá se avisa el presupuesto y la entrega" />
      <Input label="Teléfono alternativo" name="phoneAlt" icon={<Phone className="size-3.5" aria-hidden />} defaultValue={value?.phoneAlt ?? ''} />
      <Input label="Email" name="email" type="email" icon={<Mail className="size-3.5" aria-hidden />} defaultValue={value?.email ?? ''} />
      <Input label="Dirección" name="address" icon={<Home className="size-3.5" aria-hidden />} defaultValue={value?.address ?? ''} />
      <Input label="Ciudad" name="city" icon={<MapPin className="size-3.5" aria-hidden />} defaultValue={value?.city ?? 'Montevideo'} />
      <Input label="Límite de crédito" name="creditLimit" type="number" step="0.01" min={0} icon={<Wallet className="size-3.5" aria-hidden />} defaultValue={value?.creditLimit ? String(value.creditLimit) : ''} tip="Para clientes de cuenta corriente; dejalo vacío si no aplica" />

      <div className="md:col-span-3">
        <Textarea label="Notas" name="notes" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} defaultValue={value?.notes ?? ''} />
      </div>

      {error && <p role="alert" className="md:col-span-3 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

      <div className="ts-form-actions md:col-span-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Crear cliente'}</Button>
      </div>
    </form>
  );
}
