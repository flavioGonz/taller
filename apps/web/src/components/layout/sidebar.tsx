'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Users, Car, Package, Receipt, Wrench,
  Activity, Settings, ChevronLeft, Menu, LogOut, CalendarDays, FileText,
  Truck, PhoneCall, ShieldCheck,
} from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { ROLE_LABELS, type Permission } from '@taller/shared';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operación',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays, permission: 'appointment:read' },
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
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={cn('ts-nav-item focus-ring', collapsed && 'justify-center')}
                      >
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
              <button onClick={() => void logout()} className="focus-ring rounded-lg p-1.5 text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--falla)]" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>

        <button
          onClick={onToggle}
          className="focus-ring mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[12px] text-[var(--subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <Menu className="size-4" aria-hidden /> : <><ChevronLeft className="size-4" aria-hidden /> Colapsar</>}
        </button>
      </div>
    </motion.aside>
  );
}
