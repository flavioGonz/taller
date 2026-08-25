'use client';

/** Logo de la compañía; si todavía no lo cargamos, sus iniciales. */
export function InsurerAvatar({ name, logoFile, size = 40 }: { name: string; logoFile?: string | null; size?: number }) {
  if (logoFile) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`/insurers/${logoFile}`}
        alt=""
        className="shrink-0 rounded-[var(--r-sm)] border border-[var(--border)] bg-white object-contain p-1"
        style={{ width: size, height: size }}
      />
    );
  }
  const ini = name
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[var(--r-sm)] bg-[var(--brand-soft)] font-bold text-[var(--brand-700)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {ini || '?'}
    </span>
  );
}
