'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Moon, Sun, Monitor, Search, Wifi, WifiOff, ChevronRight, LogOut,
  Settings, Keyboard, User as UserIcon, Check, CircleDot,
} from 'lucide-react';
import { getSocket, useSocketEvent } from '@/hooks/use-socket';
import { SOCKET_EVENTS, ROLE_LABELS } from '@taller/shared';
import { Menu, MenuItem, MenuSeparator, MenuLabel } from '@/components/menu';
import { useCommandPalette } from '@/components/command-palette';
import { useAuth } from '@/hooks/use-auth';
import { cn, initials } from '@/lib/utils';

type ThemeMode = 'light' | 'dark' | 'system';

const THEMES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Claro', icon: Sun },
  { key: 'dark', label: 'Oscuro', icon: Moon },
  { key: 'system', label: 'Sistema', icon: Monitor },
];

/** Aplica el tema elegido; en "sistema" sigue lo que diga el equipo. */
function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Etiquetas legibles para las migas de pan. */
const CRUMBS: Record<string, string> = {
  dashboard: 'Dashboard', agenda: 'Agenda', ingresos: 'Ingresos', ordenes: 'Órdenes de trabajo',
  presupuestos: 'Presupuestos', clientes: 'Clientes', vehiculos: 'Vehículos', aseguradoras: 'Aseguradoras',
  postventa: 'Postventa', inventario: 'Inventario', pedidos: 'Pedidos a proveedor', servicios: 'Servicios',
  facturacion: 'Facturación', sistema: 'Salud & Insights', configuracion: 'Configuración',
  nueva: 'Nueva', recepcion: 'Recepción', siniestros: 'Siniestros', particulares: 'Particulares',
  aseguradora: 'Por compañía',
};

export function Topbar({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const palette = useCommandPalette();

  const [mode, setMode] = useState<ThemeMode>('system');
  const [online, setOnline] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; text: string; at: Date }[]>([]);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    let saved: ThemeMode = 'system';
    try {
      saved = (localStorage.getItem('ts-theme') as ThemeMode | null) ?? 'system';
    } catch {
      /* sin almacenamiento */
    }
    setMode(saved);
    applyTheme(saved);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (saved === 'system') applyTheme('system'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setOnline(s.connected);
    return () => { s.off('connect', on); s.off('disconnect', off); };
  }, []);

  useSocketEvent(SOCKET_EVENTS.NOTIFICATION, (p: unknown) => {
    const text = typeof p === 'object' && p && 'message' in p ? String((p as { message: unknown }).message) : 'Novedad en el taller';
    setNotifications((prev) => [{ id: Date.now(), text, at: new Date() }, ...prev].slice(0, 12));
  });
  useSocketEvent(SOCKET_EVENTS.WORKORDER_STATUS_CHANGED, () => {
    setNotifications((prev) => [{ id: Date.now(), text: 'Una orden cambió de etapa', at: new Date() }, ...prev].slice(0, 12));
  });

  function pickTheme(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
    try { localStorage.setItem('ts-theme', next); } catch { /* sin almacenamiento */ }
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.slice(0, 2).map((seg, i) => ({
    label: CRUMBS[seg] ?? (seg.length > 18 ? '…' : seg),
    href: '/' + segments.slice(0, i + 1).join('/'),
    last: i === Math.min(segments.length, 2) - 1,
  }));

  const ThemeIcon = THEMES.find((t) => t.key === mode)?.icon ?? Monitor;

  return (
    <header className="ts-topbar sticky top-0 z-20 flex h-16 items-center gap-4 px-5">
      <div className="min-w-0">
        {crumbs.length > 1 && (
          <nav aria-label="Ruta" className="mb-0.5 flex items-center gap-1 text-[11.5px] text-[var(--subtle)]">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1">
                {c.last ? (
                  <span className="truncate">{c.label}</span>
                ) : (
                  <>
                    <Link href={c.href} className="focus-ring truncate rounded hover:text-[var(--brand)]">{c.label}</Link>
                    <ChevronRight className="size-3 shrink-0" aria-hidden />
                  </>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {description && <p className="truncate text-[12px] text-[var(--muted)]">{description}</p>}
      </div>

      {/* buscador universal */}
      <button
        type="button"
        onClick={palette.open}
        className="focus-ring ml-auto hidden h-9 min-w-[230px] items-center gap-2 rounded-[var(--r)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--subtle)] transition hover:border-[var(--brand-200)] hover:text-[var(--muted)] lg:flex"
        aria-label="Buscar en todo el sistema"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Buscar OT, matrícula, cliente…</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <kbd className="ts-kbd">{mac ? '⌘' : 'Ctrl'}</kbd><kbd className="ts-kbd">K</kbd>
        </span>
      </button>

      <div className={cn('flex items-center gap-1.5', crumbs.length <= 1 && 'lg:ml-0', 'ml-auto lg:ml-0')}>
        {actions}

        <button
          type="button"
          onClick={palette.open}
          className="focus-ring grid size-9 place-items-center rounded-[var(--r-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] lg:hidden"
          aria-label="Buscar"
        >
          <Search className="size-[18px]" aria-hidden />
        </button>

        <span
          className={cn('hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex',
            online ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--falla-bg)] text-[var(--falla)]')}
          data-tooltip-id="ts-tip"
          data-tooltip-content={online ? 'Los cambios de otros puestos llegan solos' : 'Sin conexión en tiempo real: recargá para ver novedades'}
        >
          {online
            ? <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 2.2, repeat: Infinity }} className="grid place-items-center"><CircleDot className="size-3" aria-hidden /></motion.span>
            : <WifiOff className="size-3" aria-hidden />}
          {online ? 'En vivo' : 'Offline'}
        </span>

        {/* notificaciones */}
        <Menu
          label="Novedades"
          width={310}
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="Novedades"
              data-tooltip-id="ts-tip"
              data-tooltip-content="Novedades del taller en vivo"
              className="focus-ring relative grid size-9 place-items-center rounded-[var(--r-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <Bell className="size-[18px]" aria-hidden />
              <AnimatePresence>
                {notifications.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[var(--falla)] text-[9px] font-bold text-white"
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Novedades</MenuLabel>
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12.5px] text-[var(--muted)]">
                  Nada nuevo por ahora. Acá van a aparecer los cambios de otros puestos.
                </p>
              ) : (
                <>
                  <ul className="max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id} className="flex items-start gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 hover:bg-[var(--surface-2)]">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] leading-snug">{n.text}</span>
                          <span className="block text-[11px] text-[var(--subtle)]">
                            {n.at.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <MenuSeparator />
                  <MenuItem onClick={() => { setNotifications([]); close(); }}>Marcar todo como visto</MenuItem>
                </>
              )}
            </>
          )}
        </Menu>

        {/* tema */}
        <Menu
          label="Tema"
          width={190}
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="Tema de la interfaz"
              data-tooltip-id="ts-tip"
              data-tooltip-content="Tema claro, oscuro o el del sistema (Ctrl+J)"
              className="focus-ring grid size-9 place-items-center rounded-[var(--r-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <ThemeIcon className="size-[18px]" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Tema</MenuLabel>
              {THEMES.map((t) => (
                <MenuItem
                  key={t.key}
                  icon={<t.icon className="size-4" aria-hidden />}
                  onClick={() => { pickTheme(t.key); close(); }}
                >
                  <span className="flex items-center justify-between gap-2">
                    {t.label}
                    {mode === t.key && <Check className="size-3.5 text-[var(--brand)]" aria-hidden />}
                  </span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>

        {/* usuario */}
        <Menu
          label="Tu cuenta"
          width={230}
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="Tu cuenta"
              className="focus-ring ts-brand-logo grid size-9 shrink-0 place-items-center rounded-full text-[11.5px] font-bold"
            >
              {initials(user?.firstName, user?.lastName)}
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 pb-2 pt-1">
                <p className="truncate text-[13.5px] font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="truncate text-[11.5px] text-[var(--muted)]">{user?.email}</p>
                <p className="mt-1 inline-flex rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--brand-700)]">
                  {user ? ROLE_LABELS[user.role] : ''}
                </p>
              </div>
              <MenuSeparator />
              <MenuItem icon={<Settings className="size-4" aria-hidden />} onClick={() => { close(); window.location.assign('/configuracion'); }}>
                Configuración
              </MenuItem>
              <MenuItem
                icon={<Keyboard className="size-4" aria-hidden />}
                shortcut="?"
                onClick={() => {
                  close();
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
                }}
              >
                Atajos de teclado
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut className="size-4" aria-hidden />} danger onClick={() => { close(); void logout(); }}>
                Cerrar sesión
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

export { Search, UserIcon, Wifi };
