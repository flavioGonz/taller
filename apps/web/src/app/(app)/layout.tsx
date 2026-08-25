'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tooltip } from 'react-tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { PageTransition } from '@/components/page-transition';
import { ComponentInspector } from '@/components/observability/component-inspector';
import { useAuth } from '@/hooks/use-auth';
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
        <Skeleton className="h-dvh w-[260px] rounded-none" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="contenido" className="flex min-w-0 flex-1 flex-col">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <ComponentInspector route={pathname} />
      {/* Un solo tooltip para toda la app: los componentes sólo marcan data-tooltip-* */}
      <Tooltip
        id="ts-tip"
        place="top"
        delayShow={250}
        className="!z-[100] !max-w-xs !rounded-lg !bg-[var(--text)] !px-2.5 !py-1.5 !text-[12px] !leading-snug !opacity-100 !shadow-lg"
      />
    </div>
  );
}
