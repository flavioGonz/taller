'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui';
import { WorkOrdersView } from '@/components/work-orders-view';

export default function OrdenesPage() {
  return (
    <>
      <Topbar
        title="Órdenes de trabajo"
        description="Todo lo que hay en el taller, en tablero, fichas o tabla"
        actions={
          <Link href="/ordenes/nueva">
            <Button size="sm" tip="Abrir una orden nueva eligiendo cliente, vehículo y tipo de ingreso">
              <Plus className="size-4" aria-hidden /> Nueva OT
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        <WorkOrdersView storageKey="todas" />
      </div>
    </>
  );
}
