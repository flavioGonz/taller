'use client';

import { useState, type FormEvent } from 'react';
import { User, Hash, Calendar, Gauge, Fuel, Cog, IdCard, ShieldCheck, Camera, X } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { BrandModelPicker, type VehiclePick } from '@/components/brand-model-picker';
import { ColorPicker } from '@/components/color-picker';
import { Checklist, type ChecklistValue } from '@/components/checklist';
import { api } from '@/lib/api';
import { uploadPhoto } from '@/lib/upload';
import { customerName } from '@/lib/utils';
import { VEHICLE_FEATURES } from '@taller/shared';

export interface VehicleRecord {
  id?: string;
  customerId?: string;
  plate?: string;
  brandId?: string | null;
  modelId?: string | null;
  brand?: string;
  model?: string;
  year?: number | null;
  color?: string | null;
  vin?: string | null;
  engineNumber?: string | null;
  fuel?: string;
  transmission?: string | null;
  mileage?: number | null;
  insurance?: string | null;
  policyNumber?: string | null;
  features?: Record<string, unknown>;
}

interface CustomerOpt { id: string; firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean }

/** Alta y edición del vehículo, con catálogo, color, detalles y fotos. */
export function VehicleForm({
  value,
  customers,
  onSaved,
  onCancel,
  withPhotos = true,
}: {
  value?: VehicleRecord;
  customers: CustomerOpt[];
  onSaved: (vehicleId: string) => void;
  onCancel?: () => void;
  withPhotos?: boolean;
}) {
  const editing = !!value?.id;
  const [pick, setPick] = useState<VehiclePick>({
    brandId: value?.brandId ?? undefined,
    modelId: value?.modelId ?? undefined,
    brand: value?.brand ?? '',
    model: value?.model ?? '',
  });
  const [color, setColor] = useState(value?.color ?? '');
  const [features, setFeatures] = useState<ChecklistValue>((value?.features as ChecklistValue) ?? {});
  const [shots, setShots] = useState<{ url: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subirFotos(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const up = await uploadPhoto(f);
      setShots((prev) => [...prev, { url: up.url, name: f.name }]);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pick.brand || !pick.model) { setError('Elegí marca y modelo'); return; }
    const fd = new FormData(e.currentTarget);

    const body = {
      ...(editing ? {} : { customerId: fd.get('customerId') }),
      plate: fd.get('plate'),
      brandId: pick.brandId, modelId: pick.modelId, brand: pick.brand, model: pick.model,
      year: fd.get('year') ? Number(fd.get('year')) : undefined,
      color: color || undefined,
      vin: fd.get('vin') || undefined,
      engineNumber: fd.get('engineNumber') || undefined,
      fuel: fd.get('fuel') || 'NAFTA',
      transmission: fd.get('transmission') || undefined,
      mileage: fd.get('mileage') ? Number(fd.get('mileage')) : undefined,
      insurance: fd.get('insurance') || undefined,
      policyNumber: fd.get('policyNumber') || undefined,
      features,
      ...(shots[0] && !editing ? { photoUrl: shots[0].url } : {}),
    };

    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await api.patch<{ id: string }>(`/vehicles/${value!.id}`, body)
        : await api.post<{ id: string }>('/vehicles', body);

      for (const [i, s] of shots.entries()) {
        await api.post(`/vehicles/${saved.id}/photos`, { url: s.url, angle: 'OTRO', isPrimary: !editing && i === 0 });
      }
      setShots([]);
      onSaved(saved.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {!editing && (
          <div className="md:col-span-3">
            <Select label="Cliente" name="customerId" icon={<User className="size-3.5" aria-hidden />} defaultValue={value?.customerId ?? ''} required tip="Dueño del vehículo">
              <option value="">Seleccionar…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
            </Select>
          </div>
        )}

        <BrandModelPicker value={pick} onChange={setPick} />

        <Input label="Matrícula" name="plate" icon={<Hash className="size-3.5" aria-hidden />} required placeholder="SAB1234" className="uppercase" defaultValue={value?.plate ?? ''} tip="Se guarda en mayúsculas y es única por taller" />
        <Input label="Año" name="year" type="number" min={1900} max={2100} icon={<Calendar className="size-3.5" aria-hidden />} defaultValue={value?.year ?? ''} />
        <Input label="Kilometraje" name="mileage" type="number" min={0} icon={<Gauge className="size-3.5" aria-hidden />} defaultValue={value?.mileage ?? ''} tip="Se actualiza solo en cada ingreso" />
        <Select label="Combustible" name="fuel" defaultValue={value?.fuel ?? 'NAFTA'} icon={<Fuel className="size-3.5" aria-hidden />}>
          <option>NAFTA</option><option>DIESEL</option><option>GNC</option><option>ELECTRICO</option><option>HIBRIDO</option><option>OTRO</option>
        </Select>
        <Select label="Transmisión" name="transmission" defaultValue={value?.transmission ?? ''} icon={<Cog className="size-3.5" aria-hidden />}>
          <option value="">—</option><option value="Manual">Manual</option><option value="Automática">Automática</option><option value="CVT">CVT</option>
        </Select>
        <Input label="VIN / Chasis" name="vin" icon={<IdCard className="size-3.5" aria-hidden />} defaultValue={value?.vin ?? ''} tip="17 caracteres; sirve para pedir el repuesto exacto" />
        <Input label="Nº de motor" name="engineNumber" icon={<Cog className="size-3.5" aria-hidden />} defaultValue={value?.engineNumber ?? ''} />
        <Input label="Aseguradora" name="insurance" icon={<ShieldCheck className="size-3.5" aria-hidden />} defaultValue={value?.insurance ?? ''} />
        <Input label="Nº de póliza" name="policyNumber" icon={<ShieldCheck className="size-3.5" aria-hidden />} defaultValue={value?.policyNumber ?? ''} />
      </div>

      <ColorPicker value={color} onChange={setColor} />

      {withPhotos && (
        <div>
          <p className="ts-label flex items-center gap-1.5">
            <Camera className="size-3.5 text-[var(--subtle)]" aria-hidden /> Relevamiento fotográfico
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {shots.map((s, i) => (
              <div key={s.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={s.name} className="size-20 rounded-[var(--r)] border border-[var(--border)] object-cover" />
                {i === 0 && !editing && <span className="absolute left-1 top-1 rounded bg-[var(--brand)] px-1 text-[9px] font-bold text-white">Portada</span>}
                <button type="button" onClick={() => setShots((p) => p.filter((x) => x.url !== s.url))} className="focus-ring absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--falla)] text-white" aria-label={`Quitar ${s.name}`}>
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            ))}
            <label className="focus-ring grid size-20 cursor-pointer place-items-center rounded-[var(--r)] border border-dashed border-[var(--border-strong)] text-[var(--subtle)] hover:border-[var(--brand-200)] hover:text-[var(--brand)]">
              <Camera className="size-5" aria-hidden />
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void subirFotos(e.target.files)} aria-label="Agregar fotos del vehículo" />
            </label>
          </div>
          <p className="mt-1 text-[11.5px] text-[var(--muted)]">Quedan en la ficha del vehículo, no en una orden puntual.</p>
        </div>
      )}

      <div>
        <p className="ts-label">Detalles visuales aparentes</p>
        <Checklist items={VEHICLE_FEATURES} value={features} onChange={setFeatures} />
      </div>

      {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

      <div className="ts-form-actions">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Guardar vehículo'}</Button>
      </div>
    </form>
  );
}
