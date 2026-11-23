import { useEffect, useMemo, useRef, useState } from 'react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoArea, geoPath } from 'd3-geo'
import type { FeatureCollection } from 'geojson'
import provRaw from '../provincias.json'

/** d3 dibuja en la esfera: si un anillo va en el sentido contrario, rellena «todo menos la provincia». Se corrige el sentido. */
const prov = (() => {
  const fc = JSON.parse(JSON.stringify(provRaw)) as FeatureCollection
  for (const f of fc.features) {
    const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] }
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
    for (const poly of polys) if (geoArea({ type: 'Polygon', coordinates: poly } as never) > 2 * Math.PI) poly.forEach(r => r.reverse())
  }
  return fc
})()

/**
 * La entrada de la portada: miles de puntos de datos llegan desde fuera y forman España;
 * cuando el mapa está montado se encienden las lecturas de cada tema en su sitio.
 * Canvas 2D, sin librerías de animación. Con «reducir movimiento» se pinta el estado final.
 */
export type Lectura = { id: string; lon: number; lat: number; color: string; valor: string; texto: string; href?: string }

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

export function Hero({ lecturas }: { lecturas: Lectura[] }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [fase, setFase] = useState(0) // 0 montando · 1 lecturas
  useEffect(() => {
    const el = wrap.current!; const ro = new ResizeObserver(() => { const w = el.clientWidth; setSize({ w, h: Math.round(w * (w >= 560 ? 0.66 : 0.8)) }) })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const ancho = (size?.w ?? 0) >= 560 // en pantallas anchas las lecturas van en dos columnas a los lados del mapa
  const margen = ancho ? Math.min(150, (size?.w ?? 0) * 0.19) : 6
  const proj = useMemo(() => size ? geoConicConformalSpain().fitExtent([[margen, 8], [size.w - margen, size.h - 8]], prov) : null, [size, margen])
  const anclas = useMemo(() => proj ? lecturas.map(l => ({ ...l, p: proj([l.lon, l.lat]) as [number, number] })) : [], [proj, lecturas])
  /** Columnas de lecturas: a la izquierda las del oeste, a la derecha las del este, repartidas sin pisarse. */
  const cajas = useMemo(() => {
    if (!size || !ancho) return []
    const out: { a: (typeof anclas)[number]; x: number; y: number; izq: boolean }[] = []
    for (const izq of [true, false]) {
      const g = anclas.filter(a => (a.p[0] < size.w / 2) === izq).sort((a, b) => a.p[1] - b.p[1])
      let y = -Infinity
      const ys = g.map(a => (y = Math.max(a.p[1], y + 68)))
      const sobra = (ys.at(-1) ?? 0) - (size.h - 34); if (sobra > 0) for (let i = 0; i < ys.length; i++) ys[i] -= sobra
      g.forEach((a, i) => out.push({ a, x: izq ? 0 : size.w, y: Math.max(26, ys[i]), izq }))
    }
    return out
  }, [anclas, size, ancho])

  useEffect(() => {
    if (!size || !proj) return
    const c = cv.current!, dpr = Math.min(2, devicePixelRatio || 1)
    c.width = size.w * dpr; c.height = size.h * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // 1) puntos dentro de España: se rellena la silueta en un lienzo auxiliar y se muestrea en rejilla
    const aux = document.createElement('canvas'); aux.width = size.w; aux.height = size.h
    const ax = aux.getContext('2d')!, path = geoPath(proj, ax)
    ax.fillStyle = '#fff'; ax.beginPath(); path(prov); ax.fill()
    ax.strokeStyle = '#000'; ax.lineWidth = 0.8; ax.beginPath(); path(prov); ax.stroke() // fronteras de provincia: huecos finos
    const img = ax.getImageData(0, 0, size.w, size.h).data
    const paso = size.w < 520 ? 4.6 : 5.4
    type P = { x: number; y: number; sx: number; sy: number; tx: number; ty: number; d: number; c: string; r: number; vx: number; vy: number; tw: number }
    const pts: P[] = []
    for (let y = paso / 2; y < size.h; y += paso) for (let x = paso / 2 + ((y / paso) % 2) * (paso / 2); x < size.w; x += paso) {
      if (img[(Math.floor(y) * size.w + Math.floor(x)) * 4] < 128) continue
      // color: el de la lectura más cercana, mezclado con el blanco azulado de la sala
      let best = anclas[0], bd = Infinity
      for (const a of anclas) { const dd = (a.p[0] - x) ** 2 + (a.p[1] - y) ** 2; if (dd < bd) { bd = dd; best = a } }
      const ang = Math.random() * Math.PI * 2, rad = Math.max(size.w, size.h) * (0.7 + Math.random() * 0.6)
      pts.push({ x: 0, y: 0, sx: size.w / 2 + Math.cos(ang) * rad, sy: size.h / 2 + Math.sin(ang) * rad, tx: x, ty: y, d: (x / size.w) * 0.9 + Math.random() * 0.5, c: best?.color ?? '#9fd8e8', r: 1.5 + Math.random() * 1.1, vx: 0, vy: 0, tw: Math.random() * Math.PI * 2 })
    }
    let raf = 0, t0 = performance.now(), last = 0, ptr: { x: number; y: number } | null = null, lanzado = false
    const DUR = 2.6
    const move = (e: PointerEvent) => { const r = c.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top } }
    const leave = () => { ptr = null }
    c.addEventListener('pointermove', move); c.addEventListener('pointerleave', leave)
    const frame = (now: number) => {
      const t = (now - t0) / 1000
      const montado = t > DUR + 0.6
      if (montado && now - last < 33) { raf = requestAnimationFrame(frame); return } // ya montado: 30 imágenes por segundo bastan
      last = now
      ctx.clearRect(0, 0, size.w, size.h)
      // barrido de escáner durante el montaje
      if (t < DUR + 0.4) {
        const sx = ease(t / (DUR + 0.4)) * size.w
        const g = ctx.createLinearGradient(sx - 60, 0, sx, 0); g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(1, 'rgba(120,230,255,.16)')
        ctx.fillStyle = g; ctx.fillRect(sx - 60, 0, 60, size.h)
      }
      for (const p of pts) {
        const k = ease((t - p.d) / (DUR - 0.9))
        let x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k
        if (montado) {
          // muelle: vuelve a su sitio; el dedo o el ratón los aparta
          if (ptr) { const dx = p.tx + p.vx - ptr.x, dy = p.ty + p.vy - ptr.y, d2 = dx * dx + dy * dy; if (d2 < 3600) { const f = (1 - Math.sqrt(d2) / 60) * 2.2; p.vx += (dx / (Math.sqrt(d2) || 1)) * f; p.vy += (dy / (Math.sqrt(d2) || 1)) * f } }
          p.vx *= 0.86; p.vy *= 0.86; x = p.tx + p.vx; y = p.ty + p.vy
        }
        const brillo = k < 1 ? 0.4 + k * 0.5 : 0.72 + 0.28 * Math.sin(t * 1.6 + p.tw)
        ctx.globalAlpha = brillo
        ctx.fillStyle = k < 1 ? '#bfefff' : p.c
        ctx.fillRect(x - p.r / 2, y - p.r / 2, p.r, p.r)
      }
      ctx.globalAlpha = 1
      if (!lanzado && t > DUR - 0.2) { lanzado = true; setFase(1) }
      raf = requestAnimationFrame(frame)
    }
    if (reduce()) { t0 = performance.now() - (DUR + 5) * 1000; frame(performance.now()); cancelAnimationFrame(raf); setFase(1) }
    else raf = requestAnimationFrame(frame)
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce()) raf = requestAnimationFrame(frame) }
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointermove', move); c.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', vis) }
  }, [size, proj, anclas])

  const Lect = ({ a, x, y, izq, i }: { a: (typeof anclas)[number]; x?: number; y?: number; izq?: boolean; i: number }) => {
    const Tag = a.href ? 'a' : 'div'
    return <Tag href={a.href} className={`lectura ${ancho ? (izq ? 'is-izq' : 'is-der') : 'is-lista'}`} style={{ ...(ancho ? { left: x, top: y } : {}), ['--c' as string]: a.color, ['--i' as string]: i }}>
      <b>{a.valor}</b><small>{a.texto}</small>
    </Tag>
  }
  return (
    <div className={`hero-mapa ${fase ? 'is-listo' : ''} ${ancho ? '' : 'is-estrecho'}`} ref={wrap}>
      <div className="hero-lienzo" style={{ height: size?.h }}>
        <canvas ref={cv} style={{ width: size?.w, height: size?.h }} aria-hidden />
        {ancho && <svg className="l-lineas" width={size?.w} height={size?.h} aria-hidden>
          {cajas.map(({ a, x, y, izq }, i) => { const xe = izq ? x + 150 : x - 150; return <polyline key={a.id} points={`${a.p[0]},${a.p[1]} ${xe + (izq ? 24 : -24)},${y} ${xe},${y}`} style={{ stroke: a.color, ['--i' as string]: i } as React.CSSProperties} /> })}
        </svg>}
        {anclas.map((a, i) => <i key={a.id} className="l-punto" style={{ left: a.p[0], top: a.p[1], ['--c' as string]: a.color, ['--i' as string]: i } as React.CSSProperties} />)}
        {ancho && cajas.map(({ a, x, y, izq }, i) => <Lect key={a.id} a={a} x={x} y={y} izq={izq} i={i} />)}
      </div>
      {!ancho && <div className="lecturas-lista">{anclas.map((a, i) => <Lect key={a.id} a={a} i={i} />)}</div>}
    </div>
  )
}
