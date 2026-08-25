'use client';

import { useMemo, useRef, useState } from 'react';
import { Camera, Trash2, X, Plus, ImageOff } from 'lucide-react';
import { Button, Select, Textarea, Badge } from '@/components/ui';
import {
  VEHICLE_PARTS, partLabel, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DAMAGE_SEVERITIES,
  SEVERITY_LABELS, SEVERITY_COLORS, ANGLE_LABELS, REQUIRED_ANGLES, PHOTO_ANGLES,
  partsByZone, ZONE_LABELS, PART_ZONES,
  type PhotoAngle, type DamageType, type DamageSeverity,
} from '@taller/shared';
import { uploadPhoto } from '@/lib/upload';
import { cn } from '@/lib/utils';

export interface Photo {
  id: string;
  url: string;
  angle: PhotoAngle;
  width?: number | null;
  height?: number | null;
}

export interface DamageDraft {
  id?: string;
  photoId?: string;
  x: number;
  y: number;
  partCode: string;
  type: DamageType;
  severity: DamageSeverity;
  preexisting: boolean;
  note?: string;
}

const ZONED = partsByZone();

/**
 * Peritaje sobre la foto real del vehículo: se toca la foto donde está el daño
 * y ahí queda el pin. x/y se guardan relativos (0..1), así el marcador cae en el
 * mismo punto en cualquier pantalla y en el PDF de recepción.
 */
export function PhotoAnnotator({
  photos,
  damages,
  onDamagesChange,
  onPhotoAdded,
  onPhotoRemoved,
  readOnly = false,
}: {
  photos: Photo[];
  damages: DamageDraft[];
  onDamagesChange: (next: DamageDraft[]) => void;
  onPhotoAdded?: (file: File, angle: PhotoAngle) => Promise<void>;
  onPhotoRemoved?: (photoId: string) => void;
  readOnly?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(photos[0]?.id ?? null);
  const [angle, setAngle] = useState<PhotoAngle>('FRENTE');
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = photos.find((p) => p.id === activeId) ?? photos[0] ?? null;
  const activePhotoId = active?.id;

  const onPhoto = useMemo(
    () => damages.map((d, i) => ({ d, i })).filter(({ d }) => d.photoId === activePhotoId),
    [damages, activePhotoId],
  );

  const missingAngles = REQUIRED_ANGLES.filter((a) => !photos.some((p) => p.angle === a));

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !onPhotoAdded) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await onPhotoAdded(file, angle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function addMark(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const next = [...damages, { photoId: active.id, x, y, partCode: 'paragolpes_del', type: 'RAYON' as DamageType, severity: 'LEVE' as DamageSeverity, preexisting: true }];
    onDamagesChange(next);
    setEditing(next.length - 1);
  }

  const update = (idx: number, patch: Partial<DamageDraft>) =>
    onDamagesChange(damages.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const remove = (idx: number) => {
    onDamagesChange(damages.filter((_, i) => i !== idx));
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- barra de fotos */}
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Select label="Ángulo de la próxima foto" value={angle} onChange={(e) => setAngle(e.target.value as PhotoAngle)}>
              {PHOTO_ANGLES.map((a) => <option key={a} value={a}>{ANGLE_LABELS[a]}</option>)}
            </Select>
          </div>
          <Button type="button" variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" aria-hidden /> Tomar / subir foto
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
            aria-label="Subir foto del vehículo"
          />
          {missingAngles.length > 0 && (
            <p className="text-[12px] text-[var(--warn)]">
              Faltan: {missingAngles.map((a) => ANGLE_LABELS[a]).join(', ')}
            </p>
          )}
          {error && <p className="text-[12px] text-[var(--falla)]">{error}</p>}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-6 py-12 text-center">
          <ImageOff className="size-7 text-[var(--subtle)]" aria-hidden />
          <p className="text-[13px] font-medium">Todavía no hay fotos del vehículo</p>
          <p className="max-w-xs text-[12px] text-[var(--muted)]">
            Sacá al menos frente, trasera, ambos laterales y el tablero. Después tocá sobre la foto para marcar cada daño.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[132px_1fr]">
          {/* miniaturas */}
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setActiveId(p.id); setEditing(null); }}
                className={cn(
                  'focus-ring relative shrink-0 overflow-hidden rounded-[var(--r)] border-2 transition-colors',
                  p.id === active?.id ? 'border-[var(--brand-500)]' : 'border-[var(--border)]',
                )}
                aria-label={`Ver foto ${ANGLE_LABELS[p.angle]}`}
                aria-pressed={p.id === active?.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={ANGLE_LABELS[p.angle]} className="h-20 w-28 object-cover lg:w-full" />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] font-medium text-white">
                  {ANGLE_LABELS[p.angle]}
                </span>
                {damages.some((d) => d.photoId === p.id) && (
                  <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-[var(--falla)] text-[9px] font-bold text-white">
                    {damages.filter((d) => d.photoId === p.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* foto grande con los pines */}
          <div className="space-y-3">
            {active && (
              <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-black/5">
                <div className="relative select-none" onClick={addMark} role="presentation">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={active.url} alt={`Vista ${ANGLE_LABELS[active.angle]}`} className="w-full" draggable={false} />
                  {onPhoto.map(({ d, i }, n) => (
                    <button
                      key={d.id ?? `n${i}`}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(editing === i ? null : i); }}
                      style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, background: SEVERITY_COLORS[d.severity] }}
                      className={cn(
                        'focus-ring absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md transition-transform',
                        editing === i && 'scale-125 ring-2 ring-white',
                      )}
                      aria-label={`Daño ${n + 1}: ${partLabel(d.partCode)}`}
                    >
                      {n + 1}
                    </button>
                  ))}
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[12px] text-[var(--muted)]">
                      Tocá la foto donde está el daño para agregar un marcador
                    </p>
                    {onPhotoRemoved && (
                      <button
                        type="button"
                        onClick={() => { onPhotoRemoved(active.id); setActiveId(null); }}
                        className="focus-ring rounded-lg p-1.5 text-[var(--falla)] hover:bg-[var(--falla-bg)]"
                        aria-label="Eliminar esta foto"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* editor del pin seleccionado */}
            {editing !== null && damages[editing] && !readOnly && (
              <div className="ts-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Daño #{onPhoto.findIndex(({ i }) => i === editing) + 1}</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => remove(editing)} className="focus-ring rounded-lg p-1.5 text-[var(--falla)] hover:bg-[var(--falla-bg)]" aria-label="Eliminar daño">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="focus-ring rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]" aria-label="Cerrar">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Select
                    label="Parte"
                    value={damages[editing].partCode}
                    onChange={(e) => update(editing, { partCode: e.target.value })}
                  >
                    {PART_ZONES.map((z) => (
                      <optgroup key={z} label={ZONE_LABELS[z]}>
                        {ZONED[z].map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                      </optgroup>
                    ))}
                  </Select>

                  <Select
                    label="Tipo de daño"
                    value={damages[editing].type}
                    onChange={(e) => update(editing, { type: e.target.value as DamageType })}
                  >
                    {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{DAMAGE_TYPE_LABELS[t]}</option>)}
                  </Select>

                  <Select
                    label="Severidad"
                    value={damages[editing].severity}
                    onChange={(e) => update(editing, { severity: e.target.value as DamageSeverity })}
                  >
                    {DAMAGE_SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
                  </Select>

                  <div className="md:col-span-2">
                    <Textarea
                      label="Nota"
                      rows={2}
                      value={damages[editing].note ?? ''}
                      onChange={(e) => update(editing, { note: e.target.value })}
                      placeholder="Rayón de unos 10 cm, no llega a la chapa…"
                    />
                  </div>

                  <label className="flex items-end gap-2 pb-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={damages[editing].preexisting}
                      onChange={(e) => update(editing, { preexisting: e.target.checked })}
                    />
                    Ya venía así al ingresar
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------- resumen de daños */}
      {damages.length > 0 && (
        <div className="ts-card overflow-hidden">
          <div className="ts-card-head">
            <span className="ts-card-title">Daños registrados</span>
            <Badge tone="neutral">{damages.length}</Badge>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {damages.map((d, i) => (
              <li key={d.id ?? `d${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[d.severity] }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{partLabel(d.partCode)}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">
                    {DAMAGE_TYPE_LABELS[d.type]} · {SEVERITY_LABELS[d.severity]}
                    {d.preexisting ? ' · preexistente' : ' · detectado en el taller'}
                    {d.note ? ` — ${d.note}` : ''}
                  </p>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => remove(i)} className="focus-ring rounded-lg p-1.5 text-[var(--falla)] hover:bg-[var(--falla-bg)]" aria-label={`Quitar daño en ${partLabel(d.partCode)}`}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && photos.length > 0 && damages.length === 0 && (
        <p className="flex items-center gap-2 rounded-[var(--r)] bg-[var(--info-bg)] px-3 py-2 text-[12.5px] text-[var(--info)]">
          <Plus className="size-3.5" aria-hidden />
          Sin daños marcados. Si el vehículo ingresa sin novedades, dejalo así y firmá igual.
        </p>
      )}
    </div>
  );
}

export { VEHICLE_PARTS };
