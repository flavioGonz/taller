'use client';

import { Car } from 'lucide-react';
import { colorHex } from '@taller/shared';
import { cn } from '@/lib/utils';

/** Matrícula con aspecto de chapa: se lee de un golpe en cualquier listado. */
export function PlateTag({ plate, className }: { plate: string; className?: string }) {
  return (
    <span className={cn('mono inline-flex items-center rounded-[6px] border-2 border-[var(--text)] bg-[var(--surface)] px-2 py-0.5 text-[13px] font-extrabold tracking-wider', className)}>
      {plate}
    </span>
  );
}

/** Foto real del vehículo; si no hay, el logo de la marca; si no, un ícono. */
export function VehicleThumb({
  v,
  size = 44,
}: {
  v: { photoUrl?: string | null; brandRef?: { logoFile: string | null } | null; brand?: string };
  size?: number;
}) {
  const box = { width: size, height: size };
  if (v.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={v.photoUrl} alt="" className="shrink-0 rounded-[var(--r-sm)] border border-[var(--border)] object-cover" style={box} />;
  }
  if (v.brandRef?.logoFile) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/brands/${v.brandRef.logoFile}`} alt="" className="shrink-0 rounded-[var(--r-sm)] border border-[var(--border)] bg-white object-contain p-1" style={box} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--subtle)]" style={box}>
      <Car className="size-1/2" aria-hidden />
    </span>
  );
}

/** Muestra de color del vehículo: el dato que más rápido identifica un auto en el playón. */
export function ColorDot({ color, size = 14 }: { color?: string | null; size?: number }) {
  const hex = colorHex(color);
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]"
      data-tooltip-id="ts-tip"
      data-tooltip-content={`Color: ${color}`}
    >
      <span
        className="inline-block shrink-0 rounded-full border border-[var(--border-strong)]"
        style={{ width: size, height: size, background: hex ?? 'var(--surface-2)' }}
        data-color-source="vehiculo"
        aria-hidden
      />
      <span className="truncate">{color}</span>
    </span>
  );
}

/** Logo de la marca solo, para cuando ya se muestra la foto del vehículo. */
export function BrandMark({
  brandRef,
  brand,
  size = 20,
}: {
  brandRef?: { logoFile: string | null; name?: string } | null;
  brand?: string;
  size?: number;
}) {
  if (brandRef?.logoFile) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`/brands/${brandRef.logoFile}`}
        alt=""
        title={brandRef.name ?? brand}
        className="shrink-0 rounded bg-white object-contain p-[1px]"
        style={{ width: size, height: size }}
      />
    );
  }
  return null;
}

/**
 * Identidad completa del vehículo: foto (o logo), matrícula, marca, modelo,
 * año y color. Es el bloque que se repite en tarjetas, tablas y fichas.
 */
export function VehicleIdentity({
  vehicle,
  size = 52,
  showColor = true,
  className,
}: {
  vehicle: {
    plate: string; brand: string; model: string; year?: number | null; color?: string | null;
    photoUrl?: string | null; brandRef?: { logoFile: string | null; name?: string } | null;
  };
  size?: number;
  showColor?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span className="relative shrink-0">
        <VehicleThumb v={vehicle} size={size} />
        {vehicle.photoUrl && vehicle.brandRef?.logoFile && (
          <span className="absolute -bottom-1 -right-1 rounded bg-[var(--surface)] p-[1px] shadow-[var(--sh-xs)]">
            <BrandMark brandRef={vehicle.brandRef} size={16} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <PlateTag plate={vehicle.plate} />
        <span className="mt-0.5 block truncate text-[12.5px] font-semibold">
          {vehicle.brand} {vehicle.model}
        </span>
        <span className="flex items-center gap-2">
          {vehicle.year && <span className="text-[11.5px] text-[var(--muted)]">{vehicle.year}</span>}
          {showColor && <ColorDot color={vehicle.color} size={11} />}
        </span>
      </span>
    </span>
  );
}
