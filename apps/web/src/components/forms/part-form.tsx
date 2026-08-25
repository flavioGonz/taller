'use client';

import { useState, type FormEvent } from 'react';
import { Hash, Tag, Factory, Layers, Coins, DollarSign, TriangleAlert, Barcode, MapPin, Percent } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';

export interface PartRecord {
  id?: string; sku?: string; barcode?: string | null; name?: string; brand?: string | null;
  category?: string | null; unit?: string; cost?: string | number; price?: string | number;
  taxPct?: string | number; minStock?: string | number; location?: string | null; supplierId?: string | null;
}
interface SupplierOpt { id: string; name: string }

export function PartForm({
  value, suppliers = [], onSaved, onCancel,
}: {
  value?: PartRecord; suppliers?: SupplierOpt[]; onSaved: () => void; onCancel?: () => void;
}) {
  const editing = !!value?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      sku: fd.get('sku'),
      barcode: fd.get('barcode') || undefined,
      name: fd.get('name'),
      brand: fd.get('brand') || undefined,
      category: fd.get('category') || undefined,
      unit: fd.get('unit') || 'UN',
      cost: Number(fd.get('cost') ?? 0),
      price: Number(fd.get('price') ?? 0),
      taxPct: Number(fd.get('taxPct') ?? 22),
      minStock: Number(fd.get('minStock') ?? 0),
      location: fd.get('location') || undefined,
      supplierId: fd.get('supplierId') || undefined,
    };
    setSaving(true);
    setError(null);
    try {
      if (editing) await api.patch(`/inventory/parts/${value!.id}`, body);
      else await api.post('/inventory/parts', body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4">
      <Input label="SKU" name="sku" icon={<Hash className="size-3.5" aria-hidden />} required defaultValue={value?.sku ?? ''} tip="Código interno único del repuesto" />
      <div className="md:col-span-2">
        <Input label="Nombre" name="name" icon={<Tag className="size-3.5" aria-hidden />} required defaultValue={value?.name ?? ''} />
      </div>
      <Input label="Código de barras" name="barcode" icon={<Barcode className="size-3.5" aria-hidden />} defaultValue={value?.barcode ?? ''} />
      <Input label="Marca" name="brand" icon={<Factory className="size-3.5" aria-hidden />} defaultValue={value?.brand ?? ''} />
      <Input label="Categoría" name="category" icon={<Layers className="size-3.5" aria-hidden />} defaultValue={value?.category ?? ''} />
      <Select label="Proveedor" name="supplierId" icon={<Factory className="size-3.5" aria-hidden />} defaultValue={value?.supplierId ?? ''}>
        <option value="">Sin definir</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Input label="Ubicación" name="location" icon={<MapPin className="size-3.5" aria-hidden />} defaultValue={value?.location ?? ''} tip="Estante o caja donde está guardado" />
      <Input label="Costo" name="cost" type="number" step="0.01" min={0} icon={<Coins className="size-3.5" aria-hidden />} defaultValue={value?.cost ? String(value.cost) : '0'} tip="Se actualiza solo al recibir un pedido del proveedor" />
      <Input label="Precio de venta" name="price" type="number" step="0.01" min={0} icon={<DollarSign className="size-3.5" aria-hidden />} defaultValue={value?.price ? String(value.price) : '0'} />
      <Input label="IVA (%)" name="taxPct" type="number" step="0.01" min={0} max={100} icon={<Percent className="size-3.5" aria-hidden />} defaultValue={value?.taxPct ? String(value.taxPct) : '22'} />
      <Input label="Stock mínimo" name="minStock" type="number" step="1" min={0} icon={<TriangleAlert className="size-3.5" aria-hidden />} defaultValue={value?.minStock ? String(value.minStock) : '0'} tip="Por debajo de este valor aparece en el tablero" />
      <Select label="Unidad" name="unit" defaultValue={value?.unit ?? 'UN'} icon={<Layers className="size-3.5" aria-hidden />}>
        <option value="UN">Unidad</option><option value="LT">Litro</option><option value="KG">Kilo</option>
        <option value="MT">Metro</option><option value="JG">Juego</option>
      </Select>

      {error && <p role="alert" className="md:col-span-4 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}
      <div className="flex gap-2 md:col-span-4">
        <Button type="submit" loading={saving}>{editing ? 'Guardar cambios' : 'Guardar repuesto'}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}
