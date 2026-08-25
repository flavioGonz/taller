'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard } from 'lucide-react';
import { Modal } from '@/components/modal';

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'En cualquier lado',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Abrir el buscador universal' },
      { keys: ['/'], label: 'Buscar (atajo corto)' },
      { keys: ['?'], label: 'Ver esta ayuda' },
      { keys: ['Esc'], label: 'Cerrar lo que esté abierto' },
      { keys: ['Ctrl', 'J'], label: 'Cambiar entre tema claro y oscuro' },
    ],
  },
  {
    title: 'Ir a',
    items: [
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'A'], label: 'Agenda' },
      { keys: ['G', 'I'], label: 'Ingresos' },
      { keys: ['G', 'O'], label: 'Órdenes de trabajo' },
      { keys: ['G', 'P'], label: 'Presupuestos' },
      { keys: ['G', 'C'], label: 'Clientes' },
      { keys: ['G', 'V'], label: 'Vehículos' },
      { keys: ['G', 'S'], label: 'Aseguradoras' },
    ],
  },
  {
    title: 'Crear',
    items: [{ keys: ['N', 'O'], label: 'Orden de trabajo nueva' }],
  },
];

const GO: Record<string, string> = {
  d: '/dashboard', a: '/agenda', i: '/ingresos', o: '/ordenes',
  p: '/presupuestos', c: '/clientes', v: '/vehiculos', s: '/aseguradoras',
};

/**
 * Atajos de teclado de toda la app, más la ayuda que los explica.
 * Se escriben "de a dos" (G luego O) como en las herramientas que ya conocen.
 */
export function Shortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let prefix: string | null = null;
    let timer = 0;

    const clear = () => { prefix = null; window.clearTimeout(timer); };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable;
      if (typing) return;

      if ((e.key === 'j' || e.key === 'J') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const dark = document.documentElement.dataset.theme === 'dark';
        document.documentElement.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('ts-theme', dark ? 'light' : 'dark'); } catch { /* sin almacenamiento */ }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') { e.preventDefault(); setHelp(true); return; }

      const k = e.key.toLowerCase();
      if (prefix === 'g' && GO[k]) { e.preventDefault(); clear(); router.push(GO[k]!); return; }
      if (prefix === 'n' && k === 'o') { e.preventDefault(); clear(); router.push('/ordenes/nueva'); return; }

      if (k === 'g' || k === 'n') {
        prefix = k;
        window.clearTimeout(timer);
        timer = window.setTimeout(clear, 1200);
        return;
      }
      clear();
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer); };
  }, [router]);

  return (
    <Modal
      open={help}
      onClose={() => setHelp(false)}
      title="Atajos de teclado"
      description="Para moverse por el sistema sin soltar el teclado."
      icon={<Keyboard className="size-[19px]" aria-hidden />}
      width="md"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <p className="ts-pop-label !px-0 !pt-0">{g.title}</p>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--muted)]">{it.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {it.keys.map((k) => <kbd key={k} className="ts-kbd">{k}</kbd>)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 text-[12px] text-[var(--muted)]">
        Los de dos teclas se escriben uno después del otro: soltás <kbd className="ts-kbd">G</kbd> y tocás{' '}
        <kbd className="ts-kbd">O</kbd>. No funcionan mientras estás escribiendo en un campo.
      </p>
    </Modal>
  );
}
