import type { NextConfig } from 'next';

const API_INTERNAL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  // Build standalone: mínimo footprint para el LXC (sin node_modules completo)
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },
  // Evita que Next redirija /socket.io/ → /socket.io con un 308 (el cliente de
  // Socket.io siempre pide la barra final y el redirect le rompe el handshake).
  skipTrailingSlashRedirect: true,

  // Sólo para DESARROLLO: en producción el nginx del contenedor enruta /api y
  // /socket.io directo a la API — el proxy de rewrites de Next no hace upgrade
  // a WebSocket, así que allí la telemetría en vivo caería a polling.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_INTERNAL}/api/:path*` },
      { source: '/socket.io', destination: `${API_INTERNAL}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${API_INTERNAL}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
