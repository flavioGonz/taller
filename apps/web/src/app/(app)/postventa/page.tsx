'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PhoneCall, Check, Star, Filter, Tag, MessageSquare } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Select, Textarea, Skeleton, EmptyState, Table, Th, Td, Badge } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api, qs } from '@/lib/api';
import { customerName, formatDate, relativeTime } from '@/lib/utils';
import { FOLLOWUP_KINDS, FOLLOWUP_LABELS, APPROVAL_CHANNELS, CHANNEL_LABELS, type Paginated, type FollowUpKind } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface FollowUp {
  id: string; kind: FollowUpKind; status: string; dueAt: string; doneAt: string | null;
  notes: string | null; rating: number | null;
  customer?: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; phone?: string | null } | null;
  vehicle?: { plate: string; brand: string; model: string } | null;
  workOrder?: { id: string; number: string } | null;
}

export default function PostventaPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('PENDIENTE');
  const [kind, setKind] = useState('');
  const [closing, setClosing] = useState<FollowUp | null>(null);
  const { data, loading, refetch } = useApi<Paginated<FollowUp>>(`/follow-ups${qs({ page: 1, limit: 50, status, kind })}`);

  async function cerrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!closing) return;
    const fd = new FormData(e.currentTarget);
    await api.post(`/follow-ups/${closing.id}/close`, {
      status: fd.get('result'),
      channel: fd.get('channel') || undefined,
      rating: fd.get('rating') ? Number(fd.get('rating')) : undefined,
      notes: fd.get('notes') || undefined,
    });
    setClosing(null);
    refetch();
  }

  const overdue = (f: FollowUp) => f.status === 'PENDIENTE' && new Date(f.dueAt) <= new Date();

  return (
    <>
      <Topbar title="Postventa" />

      <div className="space-y-4 p-6">
        {closing && (
          <Card>
            <CardHeader><CardTitle>Cerrar seguimiento · {FOLLOWUP_LABELS[closing.kind]}</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={cerrar} className="grid gap-4 md:grid-cols-4">
                <Select label="Resultado" name="result" icon={<Check className="size-3.5" aria-hidden />} defaultValue="HECHO">
                  <option value="HECHO">Contactado</option>
                  <option value="DESCARTADO">Descartar</option>
                </Select>
                <Select label="Canal" name="channel" icon={<PhoneCall className="size-3.5" aria-hidden />} defaultValue="TELEFONO">
                  {APPROVAL_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </Select>
                {closing.kind === 'SATISFACCION' && (
                  <Select label="Satisfacción (1-5)" name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                  </Select>
                )}
                <div className="md:col-span-4"><Textarea label="Qué dijo el cliente" name="notes" icon={<MessageSquare className="size-3.5" aria-hidden />} rows={2} /></div>
                <div className="flex gap-2 md:col-span-4">
                  <Button type="submit" size="sm"><Check className="size-4" aria-hidden /> Guardar</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setClosing(null)}>Cancelar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select label="Estado" icon={<Filter className="size-3.5" aria-hidden />} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDIENTE">Pendientes</option>
                <option value="HECHO">Hechos</option>
                <option value="DESCARTADO">Descartados</option>
                <option value="TODOS">Todos</option>
              </Select>
            </div>
            <div className="w-56">
              <Select label="Tipo" icon={<Tag className="size-3.5" aria-hidden />} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Todos</option>
                {FOLLOWUP_KINDS.map((k) => <option key={k} value={k}>{FOLLOWUP_LABELS[k]}</option>)}
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0">
            {loading && !data ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <EmptyState
                icon={<PhoneCall className="size-8" aria-hidden />}
                title="Nada pendiente"
                description="Al entregar un vehículo se agenda solo el llamado de satisfacción y el recordatorio del próximo service."
              />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Tipo</Th><Th>Cliente</Th><Th>Vehículo</Th><Th>Vence</Th><Th>Estado</Th><Th /></tr>
                </thead>
                <tbody>
                  {data!.rows.map((f) => (
                    <tr key={f.id}>
                      <Td>
                        <span className="font-medium">{FOLLOWUP_LABELS[f.kind]}</span>
                        {f.workOrder && (
                          <div className="text-[11.5px]">
                            <Link href={`/ordenes/${f.workOrder.id}`} className="focus-ring rounded text-[var(--brand)] hover:underline">{f.workOrder.number}</Link>
                          </div>
                        )}
                        {f.notes && <div className="max-w-xs truncate text-[11.5px] text-[var(--muted)]">{f.notes}</div>}
                      </Td>
                      <Td className="text-[13px]">
                        {f.customer ? customerName(f.customer) : '—'}
                        <div className="text-[11.5px] text-[var(--muted)]">{f.customer?.phone ?? ''}</div>
                      </Td>
                      <Td className="mono text-[13px]">{f.vehicle?.plate ?? '—'}</Td>
                      <Td className="text-[13px]">
                        {formatDate(f.dueAt)}
                        <div className={`text-[11.5px] ${overdue(f) ? 'text-[var(--falla)]' : 'text-[var(--muted)]'}`}>{relativeTime(f.dueAt)}</div>
                      </Td>
                      <Td>
                        {f.status === 'PENDIENTE'
                          ? <Badge tone={overdue(f) ? 'danger' : 'info'}>{overdue(f) ? 'Vencido' : 'Pendiente'}</Badge>
                          : <Badge tone={f.status === 'HECHO' ? 'success' : 'neutral'}>{f.status === 'HECHO' ? 'Hecho' : 'Descartado'}</Badge>}
                        {f.rating && (
                          <div className="mt-0.5 flex items-center gap-0.5 text-[var(--warn)]">
                            {Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" aria-hidden />)}
                          </div>
                        )}
                      </Td>
                      <Td className="text-right">
                        {can('followup:write') && f.status === 'PENDIENTE' && (
                          <Button size="sm" variant="secondary" onClick={() => setClosing(f)}>Registrar</Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
