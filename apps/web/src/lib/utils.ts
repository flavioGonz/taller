import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function customerName(c?: {
  isCompany?: boolean; firstName?: string | null; lastName?: string | null; companyName?: string | null;
} | null): string {
  if (!c) return '—';
  if (c.isCompany) return c.companyName ?? '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

export function formatDate(value?: string | Date | null, withTime = false): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es-UY', { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}

export const initials = (first?: string | null, last?: string | null) =>
  `${(first ?? '?')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase();
