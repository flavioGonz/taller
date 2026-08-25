'use client';

import { useState, type FormEvent } from 'react';
import { Hash, Wrench, Layers, Clock, DollarSign, Percent, StickyNote } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { api } from '@/lib/api';

export interface ServiceRecord {
  id?: string; code?: string | null; name?: string; description?: string | null;
  category?: string | null; estimatedHours?: string | number | null; price?: string | number; taxPct?: string | number;
}

export function ServiceForm({ value, onSaved, onCancel }: { value?: ServiceRecord; onSaved: () => void; onCancel?: () => void }) {
  const editing = !!value?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      code: fd.get('code') || undefined,
      name: fd.get('name'),
      description: fd.get('description') || undefined,
      category: fd.get('category') || undefined,
      estimatedHours: fd.get('estimatedHours') ? Number(fd.get('estimatedHours')) : undefined,
      price: Number(fd.get('price')),
      taxPct: Number(fd.get('taxPct') ?? 22),
    };
    setSaving(true);
    setError(null);
    try {
      if (editing) await api.patch(`/services/${value!.id}`, body);
      else await api.post('/services', body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
      <Input label="Código" name="code" icon={<Hash className="size-3.5" aria-hidden />} placeholder="SRV-010" defaultValue={value?.code ?? ''} />
      <div className="md:col-span-2">
        <Input label="Nombre" name="name" icon={<Wrench className="size-3.5" aria-hidden />} required defaultValue={value?.name ?? ''} />
      </div>
      <Input label="Categoría" name="category" icon={<Layers className="size-3.5" aria-hidden />} defaultValue={value?.category ?? ''} />
      <Input label="Horas estimadas" name="estimatedHours" type="number" step="0.25" min={0} icon={<Clock className="size-3.5" aria-hidden />} defaultValue={value?.estimatedHours ? String(value.estimatedHours) : ''} tip="Sirve para calcular la carga del taller y la mano de obra" />
      <Input label="Precio" name="price" type="number" step="0.01" min={0} icon={<DollarSign className="size-3.5" aria-hidden />} required defaultValue={value?.price ? String(value.price) : ''} />
      <Input label="IVA (%)" name="taxPct" type="number" step="0.01" min={0} max={100} icon={<Percent className="size-3.5" aria-hidden />} defaultValue={value?.taxPct ? String(value.taxPct) : '22'} />
      <div className="md:col-span-3">
        <Textarea label="Descripción" name="description" icon={<StickyNote className="size-3.5" aria-hidden />} rows={2} defaultValue={value?.description ?? ''} />
      </div>

      {error && <p role="alert" className="md:col-span-3 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}
      <div className="flex gap-2 md:col-span-3">
        <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Guardar servicio'}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}
