'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Mail, MessageCircle, ClipboardCheck, Send, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import { Button, Input, Textarea } from '@/components/ui';
import { PdfLink } from '@/components/pdf-link';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/utils';

type Channel = 'EMAIL' | 'WHATSAPP' | 'PRESENCIAL';

interface Channels {
  email: boolean;
  whatsapp: boolean;
}

interface DeliveryResult {
  delivery: { channel: string; target: string; ok: boolean } | null;
}

const OPTIONS: {
  value: Channel;
  label: string;
  hint: string;
  icon: typeof Mail;
  needs: keyof Channels | null;
}[] = [
  { value: 'EMAIL', label: 'Correo', hint: 'Adjunta el PDF y manda el mail al cliente', icon: Mail, needs: 'email' },
  { value: 'WHATSAPP', label: 'WhatsApp', hint: 'Manda el PDF por WhatsApp al teléfono del cliente', icon: MessageCircle, needs: 'whatsapp' },
  { value: 'PRESENCIAL', label: 'Sólo registrar', hint: 'Se lo mostrás en persona: sólo queda marcado como enviado', icon: ClipboardCheck, needs: null },
];

/**
 * Diálogo de envío del presupuesto: elige canal, revisa el destinatario,
 * escribe un mensaje y dispara el envío real del PDF.
 */
export function QuoteSendDialog({
  open,
  onClose,
  quoteId,
  quoteNumber,
  customerEmail,
  customerPhone,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteNumber: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  onSent: () => void;
}) {
  const toast = useToast();
  const [channels, setChannels] = useState<Channels | null>(null);
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Qué canales están realmente configurados en esta instalación
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(null);
    api.get<Channels>('/quotes/delivery/channels')
      .then((c) => {
        setChannels(c);
        setChannel(c.email && customerEmail ? 'EMAIL' : c.whatsapp && customerPhone ? 'WHATSAPP' : c.email ? 'EMAIL' : c.whatsapp ? 'WHATSAPP' : 'PRESENCIAL');
      })
      .catch(() => setChannels({ email: false, whatsapp: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // El destinatario por defecto depende del canal
  useEffect(() => {
    setTo(channel === 'EMAIL' ? (customerEmail ?? '') : channel === 'WHATSAPP' ? (customerPhone ?? '') : '');
  }, [channel, customerEmail, customerPhone]);

  const configured = channel === 'PRESENCIAL' || (channel === 'EMAIL' ? channels?.email : channels?.whatsapp);
  const missingTarget = channel !== 'PRESENCIAL' && !to.trim();

  const blocker = useMemo(() => {
    if (channels === null) return null;
    if (!configured) {
      return channel === 'EMAIL'
        ? 'El correo saliente todavía no está configurado en el servidor (SMTP_HOST). Podés registrar el envío igual eligiendo "Sólo registrar".'
        : 'WhatsApp todavía no está conectado (WAHA_URL). Podés registrar el envío igual eligiendo "Sólo registrar".';
    }
    if (missingTarget) {
      return channel === 'EMAIL' ? 'Escribí un correo de destino.' : 'Escribí un teléfono de destino (con o sin +598).';
    }
    return null;
  }, [channels, configured, missingTarget, channel]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<DeliveryResult>(`/quotes/${quoteId}/send`, {
        channel,
        to: channel === 'PRESENCIAL' ? undefined : to.trim(),
        message: message.trim() || undefined,
        deliver: channel !== 'PRESENCIAL',
      });
      const msg = res.delivery
        ? `Presupuesto enviado a ${res.delivery.target}`
        : 'Presupuesto marcado como enviado';
      setDone(msg);
      toast.ok(msg, res.delivery
        ? 'El cliente recibió el PDF con el detalle completo.'
        : 'Queda registrado que se lo entregaste en mano.');
      onSent();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError((e as Error).message);
      toast.error('No se pudo enviar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enviar presupuesto ${quoteNumber}`}
      description="El cliente recibe el PDF con el detalle de repuestos, mano de obra, plazos y garantía."
      icon={<Send className="size-[19px]" aria-hidden />}
      width="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <PdfLink
            path={`/quotes/${quoteId}/pdf`}
            label="Ver el PDF antes"
            tip="Abrilo en una pestaña nueva para revisarlo antes de mandarlo"
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => void send()} loading={busy} disabled={busy || !!blocker || !!done}>
              <Send className="size-4" aria-hidden /> Enviar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">Cómo se lo mandamos</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((o) => {
              const ready = o.needs === null || channels?.[o.needs];
              const active = channel === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setChannel(o.value)}
                  aria-pressed={active}
                  data-tooltip-id="ts-tip"
                  data-tooltip-content={ready ? o.hint : `${o.hint} — sin configurar en el servidor`}
                  className={cn(
                    'focus-ring flex flex-col items-start gap-1 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition',
                    active && 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-[var(--sh-sm)]',
                    !ready && 'opacity-70',
                  )}
                >
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <o.icon className={cn('size-4', active ? 'text-[var(--brand)]' : 'text-[var(--subtle)]')} aria-hidden />
                    {o.label}
                  </span>
                  <span className="text-[11.5px] leading-tight text-[var(--muted)]">
                    {ready ? o.hint : 'Sin configurar'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {channel !== 'PRESENCIAL' && (
          <Input
            label={channel === 'EMAIL' ? 'Correo del cliente' : 'WhatsApp del cliente'}
            icon={channel === 'EMAIL' ? <Mail className="size-3.5" aria-hidden /> : <MessageCircle className="size-3.5" aria-hidden />}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={channel === 'EMAIL' ? 'cliente@correo.com' : '099 123 456'}
            tip={channel === 'EMAIL' ? 'Se toma del cliente, pero podés cambiarlo para este envío' : 'Si no lleva prefijo se asume Uruguay (+598)'}
          />
        )}

        <Textarea
          label="Mensaje que acompaña al PDF"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Opcional. Ej: Te paso el presupuesto, el repuesto lo tenemos en plaza y podríamos empezar el lunes."
          tip="Si lo dejás vacío se manda un texto estándar del taller"
        />

        {blocker && (
          <p className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] text-[var(--warn)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {blocker}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[12.5px] text-[var(--falla)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
        {done && (
          <p className="flex items-center gap-2 rounded-[var(--r)] bg-[var(--ok-bg)] px-3 py-2 text-[12.5px] text-[var(--ok)]">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {done}
          </p>
        )}
        {busy && (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Generando el PDF y enviando…
          </p>
        )}
      </div>
    </Modal>
  );
}
