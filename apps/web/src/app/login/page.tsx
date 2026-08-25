'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench, LogIn, Mail, KeyRound, Eye, EyeOff, AlertCircle, Moon, Sun,
  ShieldCheck, Car, ClipboardList,
} from 'lucide-react';
import { Button, Card, CardBody, Input } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import type { ApiError } from '@/lib/api';

const HIGHLIGHTS = [
  { icon: Car, text: 'Cada vehículo con su foto, su color y su recorrido' },
  { icon: ClipboardList, text: 'Presupuestos versionados, aprobados ítem por ítem' },
  { icon: ShieldCheck, text: 'Siniestros con las condiciones de cada compañía' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('ts-theme'); } catch { /* sin almacenamiento */ }
    const isDark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('ts-theme', next ? 'dark' : 'light'); } catch { /* sin almacenamiento */ }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      const status = (err as ApiError).status;
      setError(status === 401
        ? 'El correo o la contraseña no coinciden.'
        : (err as ApiError).message ?? 'No se pudo iniciar sesión.');
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Cambiar tema"
        className="focus-ring absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-[var(--r-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
      </button>

      {/* ------------------------------------------------ presentación */}
      <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] p-12 lg:flex lg:flex-col lg:justify-between">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 size-[520px] rounded-full opacity-[0.13]"
          style={{ background: 'radial-gradient(circle, var(--brand-500), transparent 62%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-24 size-[460px] rounded-full opacity-[0.10]"
          style={{ background: 'radial-gradient(circle, var(--brand-700), transparent 62%)' }}
        />

        <div className="relative flex items-center gap-3">
          <span className="ts-brand-logo grid size-11 place-items-center rounded-[13px]">
            <Wrench className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-[17px] font-extrabold tracking-tight">Taller Silver</span>
            <span className="block text-[11.5px] text-[var(--subtle)]">Core Engine</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-[30px] font-extrabold leading-[1.15] tracking-tight"
          >
            Desde que el auto entra<br />hasta que se lo lleva.
          </motion.h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
            Recepción con fotos y daños marcados, presupuesto que el cliente aprueba ítem por ítem,
            repuestos, control de calidad y entrega con garantía. Todo en un solo lugar.
          </p>

          <ul className="mt-7 space-y-3">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.09, duration: 0.4 }}
                className="flex items-center gap-3 text-[13.5px]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--brand)] shadow-[var(--sh-xs)]">
                  <h.icon className="size-4" aria-hidden />
                </span>
                {h.text}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11.5px] text-[var(--subtle)]">Infratec · Uruguay</p>
      </section>

      {/* ------------------------------------------------ formulario */}
      <section className="grid place-items-center bg-[var(--bg)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-7 flex flex-col items-center gap-3 text-center lg:hidden">
            <span className="ts-brand-logo grid size-14 place-items-center rounded-2xl">
              <Wrench className="size-7" aria-hidden />
            </span>
            <span>
              <span className="block text-xl font-extrabold tracking-tight">Taller Silver</span>
              <span className="block text-[12px] text-[var(--muted)]">Core Engine · Gestión de taller</span>
            </span>
          </div>

          <Card>
            <CardBody className="p-6">
              <h1 className="text-[19px] font-extrabold tracking-tight">Entrá al taller</h1>
              <p className="mb-5 mt-0.5 text-[13px] text-[var(--muted)]">
                Con tu usuario y contraseña del sistema.
              </p>

              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <Input
                  label="Correo electrónico"
                  icon={<Mail className="size-3.5" aria-hidden />}
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tunombre@tallersilver.uy"
                />

                <Input
                  label="Contraseña"
                  icon={<KeyRound className="size-3.5" aria-hidden />}
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-[var(--subtle)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                    >
                      {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  }
                />

                {error && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2.5 text-[12.5px] text-[var(--falla)]"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                  </motion.p>
                )}

                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  {!loading && <LogIn className="size-4" aria-hidden />}
                  {loading ? 'Entrando…' : 'Ingresar'}
                </Button>
              </form>
            </CardBody>
          </Card>

          <p className="mt-6 text-center text-[11px] text-[var(--subtle)]">
            Taller Silver Core Engine v0.1 · Infratec
          </p>
        </motion.div>
      </section>
    </main>
  );
}
