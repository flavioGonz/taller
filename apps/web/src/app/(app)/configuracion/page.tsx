'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Table, Th, Td, Badge, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Paginated, type Role } from '@taller/shared';
import { useAuth } from '@/hooks/use-auth';

interface Tenant { id: string; slug: string; name: string; legalName: string | null; taxId: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; currency: string; plan: string; status: string }
interface UserRow { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; specialty: string | null }

export default function ConfiguracionPage() {
  const { can } = useAuth();
  const tenant = useApi<Tenant>('/tenants/current');
  const users = useApi<Paginated<UserRow>>('/users?page=1&limit=100');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<Tenant>>({});

  useEffect(() => {
    if (tenant.data) setForm(tenant.data);
  }, [tenant.data]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    await api.patch('/tenants/current', {
      name: form.name, legalName: form.legalName, taxId: form.taxId,
      email: form.email, phone: form.phone, address: form.address, city: form.city,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    tenant.refetch();
  }

  async function crearUsuario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.post('/users', {
      email: fd.get('email'), password: fd.get('password'),
      firstName: fd.get('firstName'), lastName: fd.get('lastName'),
      role: fd.get('role'), specialty: fd.get('specialty') || undefined,
    });
    (e.target as HTMLFormElement).reset();
    users.refetch();
  }

  if (tenant.loading && !tenant.data) {
    return (<><Topbar title="Configuración" /><div className="space-y-4 p-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></>);
  }

  return (
    <>
      <Topbar title="Configuración" />

      <div className="space-y-4 p-6">
        <Card>
          <CardHeader><CardTitle>Datos del taller</CardTitle>
            {saved && <Badge tone="success">Guardado</Badge>}
          </CardHeader>
          <CardBody>
            <form onSubmit={guardar} className="grid gap-4 md:grid-cols-3">
              <Input label="Nombre comercial" name="name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Razón social" name="legalName" value={form.legalName ?? ''} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
              <Input label="RUT" name="taxId" value={form.taxId ?? ''} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              <Input label="Email" name="email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Teléfono" name="phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Ciudad" name="city" value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <div className="md:col-span-3"><Input label="Dirección" name="address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="flex items-center gap-3 md:col-span-3">
                <Button type="submit" disabled={!can('tenant:write')}>Guardar cambios</Button>
                <span className="text-xs text-[var(--text-muted)]">Plan {tenant.data?.plan} · slug <code className="font-mono">{tenant.data?.slug}</code></span>
              </div>
            </form>
          </CardBody>
        </Card>

        {can('user:write') && (
          <Card>
            <CardHeader><CardTitle>Nuevo usuario</CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={crearUsuario} className="grid gap-4 md:grid-cols-3">
                <Input label="Nombre" name="firstName" required />
                <Input label="Apellido" name="lastName" required />
                <Input label="Email" name="email" type="email" required />
                <Input label="Contraseña inicial" name="password" type="password" minLength={8} required />
                <Select label="Rol" name="role" defaultValue="TECNICO">
                  {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
                <Input label="Especialidad (técnicos)" name="specialty" />
                <div className="md:col-span-3"><Button type="submit">Crear usuario</Button></div>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Usuarios del taller</CardTitle></CardHeader>
          <CardBody className="p-0">
            <Table>
              <thead><tr><Th>Usuario</Th><Th>Email</Th><Th>Rol</Th><Th>Estado</Th></tr></thead>
              <tbody>
                {(users.data?.rows ?? []).map((u) => (
                  <tr key={u.id}>
                    <Td className="font-medium">{u.firstName} {u.lastName}<div className="text-[11px] font-normal text-[var(--text-muted)]">{u.specialty ?? ''}</div></Td>
                    <Td className="text-xs">{u.email}</Td>
                    <Td>
                      <Badge tone="neutral">{ROLE_LABELS[u.role as Role] ?? u.role}</Badge>
                      <div className="max-w-xs text-[11px] text-[var(--muted)]">{ROLE_DESCRIPTIONS[u.role as Role] ?? ''}</div>
                    </Td>
                    <Td><Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
