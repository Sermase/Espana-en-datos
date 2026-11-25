import { useEffect, useMemo, useRef, useState } from 'react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { PROVINCIAS as prov } from '../geo/provincias'

/**
 * España hecha de miles de puntos. Al entrar llegan desde toda la pantalla y forman el mapa; después toda España
 * toma el color del tema elegido y, al cambiar de tema, el nuevo color la recorre como una onda desde el centro.
 * El ratón o el dedo apartan los puntos. Canvas 2D; con «reducir movimiento» se pinta quieto y el color cambia sin onda.
 */
const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }

export function Hero({ color }: { color: string }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const tinta = useRef({ de: rgb(color), a: rgb(color), t: 0 })
  useEffect(() => {
    const el = wrap.current!; const ro = new ResizeObserver(() => { const w = el.clientWidth; setSize({ w, h: Math.round(w * 0.78) }) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  // cambio de color: se guarda de qué color venimos y cuándo empezó la onda
  useEffect(() => {
    // si la onda anterior no había acabado, se da por terminada y se parte de su color
    tinta.current = { de: tinta.current.a, a: rgb(color), t: reduce() ? 0 : performance.now() }
  }, [color])
  const proj = useMemo(() => size ? geoConicConformalSpain().fitExtent([[6, 6], [size.w - 6, size.h - 6]], prov) : null, [size])

  useEffect(() => {
    if (!size || !proj) return
    const c = cv.current!, dpr = Math.min(2, devicePixelRatio || 1)
    // El lienzo ocupa toda la ventana (los puntos llegan desde cualquier sitio) y el mapa se monta en su hueco.
    const lz = c.parentElement!.getBoundingClientRect()
    const ox = lz.left + scrollX, oy = lz.top + scrollY
    const CW = document.documentElement.clientWidth, CH = Math.max(innerHeight, oy + size.h + 40)
    Object.assign(c.style, { left: `${-ox}px`, top: `${-oy}px`, width: `${CW}px`, height: `${CH}px` })
    c.width = CW * dpr; c.height = CH * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // puntos dentro de España: silueta rellena en un lienzo auxiliar, muestreada en rejilla (sin fronteras: sin huecos)
    const aux = document.createElement('canvas'); aux.width = size.w; aux.height = size.h
    const ax = aux.getContext('2d')!, path = geoPath(proj, ax)
    ax.fillStyle = '#fff'; ax.strokeStyle = '#fff'; ax.lineWidth = 1.2; ax.beginPath(); path(prov); ax.fill(); ax.stroke()
    const img = ax.getImageData(0, 0, size.w, size.h).data
    const paso = size.w < 520 ? 4.4 : 5.2
    const cx = size.w * 0.42 + ox, cy = size.h * 0.4 + oy, rmax = Math.hypot(size.w, size.h) * 0.62
    type P = { sx: number; sy: number; tx: number; ty: number; d: number; r: number; vx: number; vy: number; tw: number; luz: number; dc: number }
    const pts: P[] = []
    for (let y = paso / 2; y < size.h; y += paso) for (let x = paso / 2 + ((Math.round(y / paso)) % 2) * (paso / 2); x < size.w; x += paso) {
      if (img[(Math.floor(y) * size.w + Math.floor(x)) * 4 + 3] < 100) continue
      const fuera = Math.random() < 0.25, ang = Math.random() * Math.PI * 2
      const sx = fuera ? CW / 2 + Math.cos(ang) * CW * 0.75 : Math.random() * CW, sy = fuera ? Math.min(CH, innerHeight) / 2 + Math.sin(ang) * innerHeight * 0.75 : Math.random() * Math.min(CH, innerHeight)
      const tx = x + ox, ty = y + oy
      pts.push({ sx, sy, tx, ty, d: (x / size.w) * 0.9 + Math.random() * 0.5, r: paso * 0.42 + Math.random() * paso * 0.22, vx: 0, vy: 0, tw: Math.random() * Math.PI * 2, luz: Math.random() * 0.45, dc: Math.hypot(tx - cx, ty - cy) / rmax + (Math.random() - 0.5) * 0.08 })
    }
    let raf = 0, t0 = performance.now(), last = 0, ptr: { x: number; y: number } | null = null
    const DUR = 2.6, ONDA = 1.1
    const move = (e: PointerEvent) => { const r = c.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top } }
    const leave = () => { ptr = null }
    addEventListener('pointermove', move); document.addEventListener('pointerleave', leave)
    const frame = (now: number) => {
      const t = (now - t0) / 1000
      const montado = t > DUR + 0.6
      if (montado && now - last < 33) { raf = requestAnimationFrame(frame); return } // ya montado: 30 imágenes por segundo bastan
      last = now
      ctx.clearRect(0, 0, CW, CH)
      const T = tinta.current, fo = T.t ? (now - T.t) / 1000 / ONDA : 9 // frente de la onda de color, de 0 (centro) a 1 (bordes)
      for (const p of pts) {
        const k = ease((t - p.d) / (DUR - 0.9))
        let x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k
        if (montado) {
          if (ptr) { const dx = p.tx + p.vx - ptr.x, dy = p.ty + p.vy - ptr.y, d2 = dx * dx + dy * dy; if (d2 < 3600) { const f = (1 - Math.sqrt(d2) / 60) * 2.2; p.vx += (dx / (Math.sqrt(d2) || 1)) * f; p.vy += (dy / (Math.sqrt(d2) || 1)) * f } }
          p.vx *= 0.86; p.vy *= 0.86; x = p.tx + p.vx; y = p.ty + p.vy
        }
        // color: el del tema, más o menos claro según el punto; la onda lo cambia y deja un destello al pasar
        const pasada = fo - p.dc, base = pasada >= 0 ? T.a : T.de, cresta = pasada >= 0 && pasada < 0.12 ? 1 - pasada / 0.12 : 0
        const l = Math.min(1, p.luz + cresta * 0.7)
        const R = base[0] + (255 - base[0]) * l, G = base[1] + (255 - base[1]) * l, B = base[2] + (255 - base[2]) * l
        ctx.globalAlpha = k < 1 ? 0.4 + k * 0.5 : Math.min(1, 0.68 + 0.26 * Math.sin(t * 1.6 + p.tw) + cresta * 0.4)
        ctx.fillStyle = k < 1 ? '#bfefff' : `rgb(${R | 0},${G | 0},${B | 0})`
        const r = p.r + cresta * 1.4
        ctx.fillRect(x - r / 2, y - r / 2, r, r)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    if (reduce()) { t0 = performance.now() - (DUR + 5) * 1000; const pinta = () => frame(performance.now() + 99999); pinta(); cancelAnimationFrame(raf); const iv = setInterval(() => { pinta(); cancelAnimationFrame(raf) }, 400); return () => { clearInterval(iv); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave) } }
    raf = requestAnimationFrame(frame)
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(frame) }
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', vis) }
  }, [size, proj])

  return <div className="hero-mapa" ref={wrap}>
    <div className="hero-lienzo" style={{ height: size?.h }}><canvas ref={cv} className="hero-puntos" aria-hidden /></div>
  </div>
}
