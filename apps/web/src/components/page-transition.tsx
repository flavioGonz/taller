'use client';

import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Transición entre rutas: la pantalla que entra sube unos píxeles y aparece.
 *
 * A propósito **no hay animación de salida ni `AnimatePresence`**. Con el App
 * Router los `children` se reemplazan antes de que termine la salida, así que un
 * `AnimatePresence mode="wait"` se quedaba con el contenido nuevo dentro del
 * envoltorio que se estaba yendo —y si la navegación se interrumpía, ese
 * envoltorio nunca terminaba de salir y la pantalla quedaba en `opacity: 0`—.
 * Eso era la página en blanco que se arreglaba con F5.
 *
 * Con sólo animación de entrada el final siempre es visible: aunque la
 * animación se corte, el estado al que llega es opacidad 1.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const quieto = useReducedMotion();

  if (quieto) return <div className="flex flex-1 flex-col">{children}</div>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
