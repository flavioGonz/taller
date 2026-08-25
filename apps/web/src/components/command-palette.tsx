'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, CornerDownLeft, ArrowUp, ArrowDown, ClipboardList, Car, User, FileText,
  LayoutDashboard, CalendarDays, DoorOpen, ShieldCheck, Package, Truck, Wrench, Receipt,
  PhoneCall, Settings, Activity, Plus, Moon, Sun, Keyboard,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/* --------------------------------------------------------------- modelo */

interface Hit {
  type: 'ot' | 'cliente' | 'vehiculo' | 'presupuesto';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

interface Row {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

/** Compara sin acentos ni mayúsculas: "or" encuentra "Órdenes". */
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const HIT_ICON = { ot: ClipboardList, cliente: User, vehiculo: Car, presupuesto: FileText } as const;
const HIT_GROUP = { ot: 'Órdenes', cliente: 'Clientes', vehiculo: 'Vehículos', presupuesto: 'Presupuestos' } as const;

const PAGES: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; keywords?: string }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: 'inicio tablero resumen' },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, keywords: 'citas turnos calendario' },
  { label: 'Ingresos', href: '/ingresos', icon: DoorOpen, keywords: 'siniestros particulares aseguradora entradas' },
  { label: 'Órdenes de trabajo', href: '/ordenes', icon: ClipboardList, keywords: 'ot trabajos taller' },
  { label: 'Presupuestos', href: '/presupuestos', icon: FileText, keywords: 'cotizaciones precios' },
  { label: 'Clientes', href: '/clientes', icon: User, keywords: 'personas empresas' },
  { label: 'Vehículos', href: '/vehiculos', icon: Car, keywords: 'autos matriculas' },
  { label: 'Aseguradoras', href: '/aseguradoras', icon: ShieldCheck, keywords: 'seguros companias siniestros' },
  { label: 'Postventa', href: '/postventa', icon: PhoneCall, keywords: 'seguimiento encuestas garantia' },
  { label: 'Inventario', href: '/inventario', icon: Package, keywords: 'repuestos stock' },
  { label: 'Pedidos a proveedor', href: '/pedidos', icon: Truck, keywords: 'compras proveedores' },
  { label: 'Servicios', href: '/servicios', icon: Wrench, keywords: 'catalogo precios mano de obra' },
  { label: 'Facturación', href: '/facturacion', icon: Receipt, keywords: 'facturas cobros pagos' },
  { label: 'Salud & Insights', href: '/sistema', icon: Activity, keywords: 'observabilidad estado' },
  { label: 'Configuración', href: '/configuracion', icon: Settings, keywords: 'ajustes usuarios bahias' },
];

/* ------------------------------------------------------------ contexto */

const Ctx = createContext<{ open: () => void } | null>(null);
export const useCommandPalette = () => useContext(Ctx) ?? { open: () => undefined };

/* -------------------------------------------------------------- panel */

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Ctrl/⌘ + K abre; también la barra "/" cuando no se está escribiendo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQ(''); setHits([]); setActive(0); return; }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // búsqueda con freno, para no pegarle a la API en cada tecla
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = window.setTimeout(() => {
      api.get<{ hits: Hit[] }>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => setHits(r.hits))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
    try { localStorage.setItem('ts-theme', isDark ? 'light' : 'dark'); } catch { /* sin almacenamiento */ }
    setOpen(false);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const term = plain(q);

    const acciones: Row[] = [
      { key: 'a-ot', group: 'Acciones', title: 'Abrir una orden de trabajo nueva', icon: Plus, run: () => go('/ordenes/nueva'), keywords: 'nueva ot alta ingreso vehiculo' },
      { key: 'a-cita', group: 'Acciones', title: 'Ir a la agenda del día', icon: CalendarDays, run: () => go('/agenda'), keywords: 'cita turno' },
      { key: 'a-tema', group: 'Acciones', title: 'Cambiar entre tema claro y oscuro', icon: document.documentElement.dataset.theme === 'dark' ? Sun : Moon, run: toggleTheme, keywords: 'tema oscuro claro noche' },
    ];

    const paginas: Row[] = PAGES.map((p) => ({
      key: `p-${p.href}`,
      group: 'Ir a',
      title: p.label,
      icon: p.icon,
      run: () => go(p.href),
      keywords: p.keywords,
    }));

    const resultados: Row[] = hits.map((h) => ({
      key: `h-${h.type}-${h.id}`,
      group: HIT_GROUP[h.type],
      title: h.title,
      subtitle: h.subtitle,
      icon: HIT_ICON[h.type],
      run: () => go(h.href),
    }));

    if (!term) return [...acciones, ...paginas];

    const match = (r: Row) => plain(r.title).includes(term) || plain(r.keywords ?? '').includes(term);

    return [...resultados, ...paginas.filter(match), ...acciones.filter(match)];
  }, [q, hits, go, toggleTheme]);

  useEffect(() => { setActive(0); }, [q, hits.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[active]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  // mantener a la vista la fila activa
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastGroup = '';

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                className="ts-scrim !z-[70]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="pointer-events-none fixed inset-0 z-[71] flex items-start justify-center p-4 pt-[12vh]">
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Buscador"
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="ts-cmd pointer-events-auto"
                >
                  <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
                    {loading
                      ? <Loader2 className="size-[18px] shrink-0 animate-spin text-[var(--brand)]" aria-hidden />
                      : <Search className="size-[18px] shrink-0 text-[var(--subtle)]" aria-hidden />}
                    <input
                      ref={inputRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={onKeyDown}
                      className="ts-cmd-input"
                      placeholder="Buscar OT, matrícula, cliente, ID de auditoría… o ir a una sección"
                      aria-label="Buscar"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <span className="ts-kbd shrink-0">Esc</span>
                  </div>

                  <div ref={listRef} className="ts-cmd-list">
                    {rows.length === 0 && (
                      <p className="px-4 py-10 text-center text-[13px] text-[var(--muted)]">
                        {q.trim().length < 2
                          ? 'Escribí al menos dos letras.'
                          : `No encontré nada con “${q.trim()}”.`}
                      </p>
                    )}
                    {rows.map((r, i) => {
                      const showGroup = r.group !== lastGroup;
                      lastGroup = r.group;
                      const Icon = r.icon;
                      return (
                        <div key={r.key}>
                          {showGroup && <p className="ts-pop-label">{r.group}</p>}
                          <button
                            type="button"
                            data-active={i === active}
                            onMouseEnter={() => setActive(i)}
                            onClick={r.run}
                            className="ts-cmd-item focus-ring"
                          >
                            <span className="ts-cmd-ic"><Icon className="size-4" aria-hidden /></span>
                            <span className="min-w-0 flex-1">
                              <span className="ts-cmd-title block truncate">{r.title}</span>
                              {r.subtitle && <span className="ts-cmd-sub block truncate">{r.subtitle}</span>}
                            </span>
                            {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ts-cmd-foot">
                    <span className="flex items-center gap-1.5"><ArrowUp className="size-3" aria-hidden /><ArrowDown className="size-3" aria-hidden /> moverse</span>
                    <span className="flex items-center gap-1.5"><CornerDownLeft className="size-3" aria-hidden /> abrir</span>
                    <span className="ml-auto flex items-center gap-1.5"><Keyboard className="size-3" aria-hidden /> <span className="ts-kbd">Ctrl</span><span className="ts-kbd">K</span></span>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
