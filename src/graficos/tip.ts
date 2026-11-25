import type { CSSProperties } from 'react'

/**
 * Coloca el cartel al lado de la línea vertical, en la mitad con más sitio,
 * y arriba o abajo según dónde no estén los puntos señalados: nunca los tapa.
 */
export function sitioTip(W: number, H: number, x: number, ys: number[], T: number, B: number, hueco = 14): CSSProperties {
  const der = x <= W / 2
  const sitio = (der ? W - x : x) - hueco - 2
  const medio = (T + H - B) / 2
  const abajo = ys.length > 0 && ys.reduce((a, b) => a + b, 0) / ys.length < medio
  return {
    ...(der ? { left: x + hueco } : { right: W - x + hueco }),
    maxWidth: Math.max(96, sitio),
    ...(abajo ? { top: 'auto', bottom: B + 2 } : { top: T }),
  }
}
