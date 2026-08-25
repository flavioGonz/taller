import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: { default: 'Taller Silver — Core Engine', template: '%s · Taller Silver' },
  description: 'Gestión integral de taller: órdenes de trabajo, clientes, vehículos, inventario y facturación en tiempo real.',
  applicationName: 'Taller Silver',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#12141a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" suppressHydrationWarning>
      <body>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2">
          Saltar al contenido
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
