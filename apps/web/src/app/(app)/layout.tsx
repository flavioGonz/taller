'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from 'react-tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { PageTransition } from '@/components/page-transition';
import { ToastProvider } from '@/components/toast';
import { CommandPalette } from '@/components/command-palette';
import { Shortcuts } from '@/components/shortcuts';
import { ComponentInspector } from '@/components/observability/component-inspector';
import { useAuth } from '@/hooks/use-auth';
import { SettingsProvider } from '@/hooks/use-settings';
import { Skeleton } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('ts-sidebar') === 'collapsed');
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('ts-sidebar', next ? 'collapsed' : 'expanded');
      } catch {
        /* sin almacenamiento */
      }
      return next;
    });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh">
        <div className="ts-side hidden w-[268px] shrink-0 flex-col gap-2 p-4 md:flex">
          <Skeleton className="h-10 w-40" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        </div>
        <div className="flex-1">
          <div className="ts-topbar flex h-16 items-center gap-4 px-5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="ml-auto h-9 w-56" />
            <Skeleton className="size-9 !rounded-full" />
          </div>
          <div className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <SettingsProvider>
      <CommandPalette>
        <div className="flex min-h-dvh">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
          <div className="flex min-w-0 flex-1 flex-col">
            <main id="contenido" className="flex min-w-0 flex-1 flex-col">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <ComponentInspector route={pathname} />
          <Shortcuts />
          {/* Un solo tooltip para toda la app: los componentes sólo marcan data-tooltip-* */}
          <Tooltip
            id="ts-tip"
            place="top"
            delayShow={280}
            offset={9}
            className="!z-[100] !max-w-xs !rounded-[10px] !bg-[var(--text)] !px-2.5 !py-1.5 !text-[12px] !font-medium !leading-snug !opacity-100 !shadow-[var(--sh-lg)]"
          />
        </div>
      </CommandPalette>
      </SettingsProvider>
    </ToastProvider>
  );
}
