'use client';

import { useEffect, useState } from 'react';
import { Bell, Moon, Sun, Search, Wifi, WifiOff } from 'lucide-react';
import { getSocket, useSocketEvent } from '@/hooks/use-socket';
import { SOCKET_EVENTS } from '@taller/shared';
import { Badge } from '@/components/ui';

export function Topbar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [online, setOnline] = useState(false);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem('ts-theme');
      } catch {
        return null;
      }
    })();
    const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    const s = getSocket();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setOnline(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);

  useSocketEvent(SOCKET_EVENTS.NOTIFICATION, () => setNotifications((n) => n + 1));

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('ts-theme', next ? 'dark' : 'light');
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return (
    <header className="ts-topbar sticky top-0 z-20 flex h-16 items-center gap-4 px-6">
      <h1 className="text-[19px] font-extrabold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {actions}

        <Badge tone={online ? 'success' : 'danger'} className="hidden sm:inline-flex" title={online ? 'Telemetría en vivo' : 'Sin conexión en tiempo real'}>
          {online ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
          {online ? 'En vivo' : 'Offline'}
        </Badge>

        <button className="focus-ring relative rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Notificaciones" onClick={() => setNotifications(0)}>
          <Bell className="size-[18px]" aria-hidden />
          {notifications > 0 && (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-[var(--falla)] text-[9px] font-bold text-white">
              {notifications > 9 ? '9+' : notifications}
            </span>
          )}
        </button>

        <button onClick={toggleTheme} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Cambiar tema">
          {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
        </button>
      </div>
    </header>
  );
}

export { Search };
