import { useEffect, useRef, useState } from 'react'

/** Ancho real del contenedor, para dibujar en píxeles y que el texto no se deforme. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el); setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Se pone a true la primera vez que el gráfico entra en pantalla: ahí empieza su animación. */
export function useInView<T extends Element>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin: margin })
    io.observe(el); return () => io.disconnect()
  }, [seen, margin])
  return [ref, seen] as const
}

export const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Marcas redondas del eje: 0 / 200 / 400… */
export function niceTicks(lo: number, hi: number, n = 4) {
  if (hi === lo) { hi = lo + 1 }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p
  const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step
  const out: number[] = []
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(10))
  return out
}

export const nf = (v: number, d = 0) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' } as Intl.NumberFormatOptions)
/** 1.284 / 12,9 mil / 4,2 M */
export function compact(v: number) {
  const a = Math.abs(v)
  if (a >= 1e6) return nf(v / 1e6, a >= 1e7 ? 0 : 1) + ' M'
  if (a >= 1e4) return nf(v / 1e3, 0) + ' mil'
  return nf(v, a < 10 && a % 1 ? 1 : 0)
}
