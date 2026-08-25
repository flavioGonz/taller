'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, Users, Car, Package, Receipt, Wrench,
  Activity, Settings, ChevronLeft, ChevronDown, Menu, LogOut, CalendarDays, FileText,
  Truck, PhoneCall, ShieldCheck, DoorOpen, FileWarning, LayoutList,
} from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useApi } from '@/hooks/use-api';
import { ROLE_LABELS, MENU_INTAKES, type Permission } from '@taller/shared';

const INTAKE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileWarning, Receipt, ShieldCheck,
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  /** Grupo desplegable: los hijos se muestran indentados. */
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; countKey?: string }[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operación',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays, permission: 'appointment:read' },
      {
        href: '/ingresos',
        label: 'Ingresos',
        icon: DoorOpen,
        children: [
          { href: '/ingresos', label: 'Todos los ingresos', icon: LayoutList },
          ...MENU_INTAKES.map((c) => ({
            href: `/ingresos/${c.slug}`,
            label: c.short,
            icon: INTAKE_ICONS[c.icon] ?? DoorOpen,
            countKey: c.slug,
          })),
        ],
      },
      { href: '/ordenes', label: 'Órdenes de trabajo', icon: ClipboardList },
      { href: '/presupuestos', label: 'Presupuestos', icon: FileText, permission: 'quote:read' },
    ],
  },
  {
    section: 'Clientes',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Users, permission: 'customer:read' },
      { href: '/vehiculos', label: 'Vehículos', icon: Car, permission: 'vehicle:read' },
      { href: '/postventa', label: 'Postventa', icon: PhoneCall, permission: 'followup:read' },
      { href: '/aseguradoras', label: 'Aseguradoras', icon: ShieldCheck, permission: 'catalog:read' },
    ],
  },
  {
    section: 'Taller',
    items: [
      { href: '/inventario', label: 'Inventario', icon: Package, permission: 'inventory:read' },
      { href: '/pedidos', label: 'Pedidos a proveedor', icon: Truck, permission: 'partsorder:read' },
      { href: '/servicios', label: 'Servicios', icon: Wrench, permission: 'service:read' },
      { href: '/facturacion', label: 'Facturación', icon: Receipt, permission: 'billing:read' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/sistema', label: 'Salud & Insights', icon: Activity, permission: 'insight:read' },
      { href: '/configuracion', label: 'Configuración', icon: Settings, permission: 'tenant:write' },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user, logout, can } = useAuth();

  // Contadores por canal de ingreso, para el badge de cada sub-ítem
  const counts = useApi<{ total: number; channels: Record<string, number> }>('/work-orders/intake-counts');

  // Los grupos desplegables recuerdan si quedaron abiertos
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ts-nav-open');
      if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* sin almacenamiento disponible */
    }
  }, []);
  const toggleGroup = (href: string) =>
    setOpen((prev) => {
      const next = { ...prev, [href]: !(prev[href] ?? true) };
      try {
        localStorage.setItem('ts-nav-open', JSON.stringify(next));
      } catch {
        /* sin almacenamiento disponible */
      }
      return next;
    });

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 268 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="ts-side sticky top-0 z-30 flex h-dvh shrink-0 flex-col overflow-hidden"
      aria-label="Navegación principal"
    >
      {/* Isotipo fijo en la cabecera del panel */}
      <div className="flex h-16 shrink-0 items-center gap-[10px] px-4">
        <div className="ts-brand-logo grid size-[38px] shrink-0 place-items-center rounded-[11px]">
          <Wrench className="size-5" aria-hidden />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0">
              <p className="truncate text-[17px] font-extrabold tracking-tight">{user?.tenant?.name ?? 'Taller Silver'}</p>
              <p className="-mt-0.5 truncate text-[11px] text-[var(--subtle)]">Core Engine</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 overflow-y-auto px-[14px] pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || can(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.section}>
              {!collapsed && <p className="ts-nav-section">{group.section}</p>}
              <ul className={cn('flex flex-col gap-[3px]', collapsed && 'mt-3')}>
                {items.map((item) => {
                  const inBranch = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  // --- grupo desplegable (Ingresos) ---
                  if (item.children && !collapsed) {
                    const expanded = open[item.href] ?? true;
                    return (
                      <li key={item.href}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(item.href)}
                          aria-expanded={expanded}
                          className={cn('ts-nav-item focus-ring w-full', inBranch && 'text-[var(--text)]')}
                          data-tooltip-id="ts-tip"
                          data-tooltip-content="Los vehículos agrupados por cómo entraron al taller"
                        >
                          <Icon className="size-[18px] shrink-0" aria-hidden />
                          <span className="truncate">{item.label}</span>
                          {counts.data?.total ? <span className="ts-nav-count">{counts.data.total}</span> : null}
                          <ChevronDown
                            className={cn('size-4 shrink-0 transition-transform duration-200', !expanded && '-rotate-90')}
                            aria-hidden
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden"
                            >
                              {item.children!.map((child) => {
                                const childActive = pathname === child.href;
                                const ChildIcon = child.icon;
                                const n = child.countKey ? counts.data?.channels?.[child.countKey] : undefined;
                                return (
                                  <li key={child.href} className="mt-[3px]">
                                    <Link
                                      href={child.href}
                                      aria-current={childActive ? 'page' : undefined}
                                      className="ts-nav-sub focus-ring"
                                    >
                                      <ChildIcon className="size-[15px] shrink-0" aria-hidden />
                                      <span className="truncate">{child.label}</span>
                                      {n !== undefined && n > 0 && <span className="ts-nav-count">{n}</span>}
                                    </Link>
                                  </li>
                                );
                              })}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={inBranch ? 'page' : undefined}
                        data-tooltip-id={collapsed ? 'ts-tip' : undefined}
                        data-tooltip-content={collapsed ? item.label : undefined}
                        data-tooltip-place="right"
                        className={cn('ts-nav-item focus-ring', collapsed && 'justify-center')}
                      >
                        {inBranch && (
                          <motion.span
                            layoutId="ts-nav-activo"
                            className="ts-nav-pill"
                            transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                            aria-hidden
                          />
                        )}
                        <Icon className="size-[18px] shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2', collapsed && 'justify-center')}>
          <div className="ts-brand-logo grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold">
            {initials(user?.firstName, user?.lastName)}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="truncate text-[11px] text-[var(--subtle)]">{user ? ROLE_LABELS[user.role] : ''}</p>
              </div>
              <button
                onClick={() => void logout()}
                className="focus-ring grid size-8 place-items-center rounded-lg text-[var(--subtle)] transition hover:bg-[var(--falla-bg)] hover:text-[var(--falla)]"
                aria-label="Cerrar sesión"
                data-tooltip-id="ts-tip"
                data-tooltip-content="Cerrar sesión"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>

        <button
          onClick={onToggle}
          className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[12px] text-[var(--subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          data-tooltip-id="ts-tip"
          data-tooltip-content={collapsed ? 'Expandir el menú' : 'Dejar sólo los íconos'}
        >
          {collapsed ? <Menu className="size-4" aria-hidden /> : <><ChevronLeft className="size-4" aria-hidden /> Colapsar</>}
        </button>

        {!collapsed && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--subtle)]">
            <kbd className="ts-kbd">Ctrl</kbd><kbd className="ts-kbd">K</kbd> para buscar ·
            <kbd className="ts-kbd">?</kbd> atajos
          </p>
        )}
      </div>
    </motion.aside>
  );
}
