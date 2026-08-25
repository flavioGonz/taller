import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';

/* ----------------------------------------------------------------- correo */

let transporter: Transporter | null = null;

export const mailConfigured = () => !!env.SMTP_HOST && !!env.SMTP_USER;

function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface MailAttachment { filename: string; content: Buffer; contentType?: string }

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}) {
  if (!mailConfigured()) throw new Error('El correo no está configurado (SMTP_HOST / SMTP_USER en el entorno)');
  const info = await getTransport().sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    ...opts,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

/* --------------------------------------------------------------- WhatsApp */

export const whatsappConfigured = () => !!env.WAHA_URL;

/** Normaliza a formato internacional de Uruguay: 099123456 → 59899123456 */
export function normalizePhone(raw: string, countryCode = '598'): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith(countryCode)) return digits;
  return countryCode + digits.replace(/^0+/, '');
}

async function waha(path: string, body: unknown) {
  const res = await fetch(`${env.WAHA_URL!.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.WAHA_API_KEY ? { 'X-Api-Key': env.WAHA_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp respondió ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Envío por WhatsApp usando OpenWA/WAHA. La sesión y la URL se configuran por
 * entorno; si no están, el sistema lo dice en lugar de fallar en silencio.
 */
export async function sendWhatsAppText(phone: string, text: string) {
  if (!whatsappConfigured()) throw new Error('WhatsApp no está configurado (WAHA_URL en el entorno)');
  return waha('/api/sendText', {
    session: env.WAHA_SESSION,
    chatId: `${normalizePhone(phone)}@c.us`,
    text,
  });
}

export async function sendWhatsAppFile(phone: string, file: { filename: string; content: Buffer; mimetype?: string }, caption?: string) {
  if (!whatsappConfigured()) throw new Error('WhatsApp no está configurado (WAHA_URL en el entorno)');
  return waha('/api/sendFile', {
    session: env.WAHA_SESSION,
    chatId: `${normalizePhone(phone)}@c.us`,
    file: {
      mimetype: file.mimetype ?? 'application/pdf',
      filename: file.filename,
      data: file.content.toString('base64'),
    },
    caption,
  });
}
