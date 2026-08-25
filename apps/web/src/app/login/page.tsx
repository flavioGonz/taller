'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Wrench, LogIn } from 'lucide-react';
import { Button, Card, CardBody, Input } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import type { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="ts-brand-logo grid size-14 place-items-center rounded-2xl">
            <Wrench className="size-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Taller Silver</h1>
            <p className="text-xs text-[var(--text-muted)]">Core Engine · Gestión de taller</p>
          </div>
        </div>

        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Input
                label="Correo electrónico"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tallersilver.uy"
              />
              <Input
                label="Contraseña"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              {error && (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                <LogIn className="size-4" aria-hidden />
                Ingresar
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">
          Infratec · Taller Silver Core Engine v0.1
        </p>
      </motion.div>
    </main>
  );
}
