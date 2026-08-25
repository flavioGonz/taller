'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, ChevronDown, Car, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Brand { id: string; name: string; slug: string; logoFile: string | null; _count?: { models: number } }
interface Model { id: string; name: string; bodyType: string | null; yearFrom: number | null }

export interface VehiclePick {
  brandId?: string;
  modelId?: string;
  brand: string;
  model: string;
}

/**
 * Marca y modelo del catálogo (NHTSA vPIC + altas propias), con buscador y logo.
 * Si el modelo no existe se escribe libre y queda dado de alta para el taller:
 * ningún auto se queda afuera por no estar en la lista.
 */
export function BrandModelPicker({ value, onChange }: { value: VehiclePick; onChange: (v: VehiclePick) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [brandQuery, setBrandQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [openBrand, setOpenBrand] = useState(false);
  const [openModel, setOpenModel] = useState(false);
  const [creating, setCreating] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Brand[]>('/catalog/brands').then(setBrands).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!value.brandId) { setModels([]); return; }
    api.get<Model[]>(`/catalog/brands/${value.brandId}/models`).then(setModels).catch(() => setModels([]));
  }, [value.brandId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!brandRef.current?.contains(e.target as Node)) setOpenBrand(false);
      if (!modelRef.current?.contains(e.target as Node)) setOpenModel(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const brand = brands.find((b) => b.id === value.brandId);

  const filteredBrands = useMemo(() => {
    const t = brandQuery.trim().toLowerCase();
    return t ? brands.filter((b) => b.name.toLowerCase().includes(t)) : brands;
  }, [brands, brandQuery]);

  const filteredModels = useMemo(() => {
    const t = modelQuery.trim().toLowerCase();
    return t ? models.filter((m) => m.name.toLowerCase().includes(t)) : models;
  }, [models, modelQuery]);

  async function createModel(name: string) {
    if (!value.brandId || !name.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<Model>('/catalog/models', { brandId: value.brandId, name: name.trim() });
      setModels((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange({ ...value, modelId: created.id, model: created.name });
      setOpenModel(false);
      setModelQuery('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* ------------------------------------------------------------ marca */}
      <div className="w-full" ref={brandRef}>
        <label className="ts-label flex items-center gap-1.5">
          <Car className="size-3.5 text-[var(--subtle)]" aria-hidden /> Marca
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenBrand((o) => !o)}
            aria-expanded={openBrand}
            aria-haspopup="listbox"
            className={cn('ts-input focus-ring flex items-center justify-between gap-2 text-left', openBrand && 'border-[var(--brand-500)]')}
          >
            <span className="flex min-w-0 items-center gap-2">
              {brand?.logoFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/brands/${brand.logoFile}`} alt="" className="size-6 shrink-0 rounded bg-white object-contain" />
              )}
              <span className={cn('truncate', !brand && 'text-[var(--subtle)]')}>{brand?.name ?? 'Buscar marca…'}</span>
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-[var(--subtle)] transition-transform', openBrand && 'rotate-180')} aria-hidden />
          </button>

          {openBrand && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh-lg)]">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                <Search className="size-4 shrink-0 text-[var(--subtle)]" aria-hidden />
                <input
                  autoFocus
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Escribí para filtrar…"
                  aria-label="Buscar marca"
                  className="w-full bg-transparent text-[14px] outline-none"
                />
                <span className="shrink-0 text-[11px] text-[var(--subtle)]">{filteredBrands.length}</span>
              </div>
              <ul className="grid max-h-72 grid-cols-2 gap-1 overflow-auto p-2 sm:grid-cols-3" role="listbox" aria-label="Marcas">
                {filteredBrands.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={b.id === value.brandId}
                      onClick={() => {
                        onChange({ brandId: b.id, brand: b.name, modelId: undefined, model: '' });
                        setOpenBrand(false);
                        setBrandQuery('');
                      }}
                      className={cn(
                        'focus-ring flex w-full flex-col items-center gap-1 rounded-[var(--r)] border border-transparent p-2 transition-colors hover:border-[var(--brand-200)] hover:bg-[var(--brand-soft)]',
                        b.id === value.brandId && 'border-[var(--brand-200)] bg-[var(--brand-soft)]',
                      )}
                    >
                      {b.logoFile ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/brands/${b.logoFile}`} alt="" className="h-8 w-full rounded bg-white object-contain" />
                      ) : (
                        <span className="grid h-8 w-full place-items-center rounded bg-[var(--surface-2)] text-[11px] font-bold text-[var(--subtle)]">
                          {b.name.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-[11.5px] font-medium">{b.name}</span>
                    </button>
                  </li>
                ))}
                {filteredBrands.length === 0 && (
                  <li className="col-span-full px-3 py-6 text-center text-[13px] text-[var(--subtle)]">Ninguna marca coincide</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------- modelo */}
      <div className="w-full" ref={modelRef}>
        <label className="ts-label flex items-center gap-1.5">
          <Car className="size-3.5 text-[var(--subtle)]" aria-hidden /> Modelo
        </label>
        <div className="relative">
          <button
            type="button"
            disabled={!value.brandId}
            onClick={() => setOpenModel((o) => !o)}
            aria-expanded={openModel}
            aria-haspopup="listbox"
            className={cn('ts-input focus-ring flex items-center justify-between gap-2 text-left disabled:opacity-60', openModel && 'border-[var(--brand-500)]')}
          >
            <span className={cn('truncate', !value.model && 'text-[var(--subtle)]')}>
              {value.model || (value.brandId ? 'Buscar modelo…' : 'Elegí la marca primero')}
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-[var(--subtle)] transition-transform', openModel && 'rotate-180')} aria-hidden />
          </button>

          {openModel && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh-lg)]">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                <Search className="size-4 shrink-0 text-[var(--subtle)]" aria-hidden />
                <input
                  autoFocus
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                  placeholder="Gol, Hilux, Onix…"
                  aria-label="Buscar modelo"
                  className="w-full bg-transparent text-[14px] outline-none"
                />
                <span className="shrink-0 text-[11px] text-[var(--subtle)]">{filteredModels.length}</span>
              </div>
              <ul className="max-h-64 overflow-auto p-1" role="listbox" aria-label="Modelos">
                {filteredModels.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={m.id === value.modelId}
                      onClick={() => {
                        onChange({ ...value, modelId: m.id, model: m.name });
                        setOpenModel(false);
                        setModelQuery('');
                      }}
                      className={cn(
                        'focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--r-sm)] px-3 py-2 text-left text-[13.5px] hover:bg-[var(--surface-2)]',
                        m.id === value.modelId && 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-700)]',
                      )}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.id === value.modelId && <Check className="size-4 shrink-0" aria-hidden />}
                    </button>
                  </li>
                ))}
                {modelQuery.trim() && !filteredModels.some((m) => m.name.toLowerCase() === modelQuery.trim().toLowerCase()) && (
                  <li>
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => void createModel(modelQuery)}
                      className="focus-ring flex w-full items-center gap-2 rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] text-[var(--brand-700)] hover:bg-[var(--brand-soft)]"
                    >
                      <Plus className="size-4 shrink-0" aria-hidden />
                      Agregar “{modelQuery.trim()}” al catálogo del taller
                    </button>
                  </li>
                )}
                {filteredModels.length === 0 && !modelQuery.trim() && (
                  <li className="px-3 py-6 text-center text-[13px] text-[var(--subtle)]">Esta marca no tiene modelos cargados</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
