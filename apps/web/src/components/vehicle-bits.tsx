'use client';

import { Car } from 'lucide-react';
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
