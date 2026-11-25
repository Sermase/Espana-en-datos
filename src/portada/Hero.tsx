import { useEffect, useMemo, useRef, useState } from 'react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { PROVINCIAS as prov } from '../geo/provincias'

/**
 * La entrada de la portada: miles de puntos de datos llegan desde fuera y forman España;
 * cuando el mapa está montado se encienden las lecturas de cada tema en su sitio.
 * Canvas 2D, sin librerías de animación. Con «reducir movimiento» se pinta el estado final.
 */
export type Lectura = { id: string; lon: number; lat: number; color: string; valor: string; texto: string; href?: string }

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/** `foco`: la lectura que se está contando ahora; al cambiar, una onda de su color recorre el mapa desde su sitio. */
export function Hero({ lecturas, foco, onFoco, onListo }: { lecturas: Lectura[]; foco: number; onFoco: (i: number, fijo: boolean) => void; onListo?: () => void }) {
  const ondaRef = useRef<{ x: number; y: number; c: string; t: number } | null>(null), origen = useRef({ x: 0, y: 0 })
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
    // El lienzo ocupa toda la ventana (los puntos llegan desde cualquier sitio) y el mapa se monta en su hueco.
    const lz = c.parentElement!.getBoundingClientRect()
    const ox = lz.left + scrollX, oy = lz.top + scrollY
    origen.current = { x: ox, y: oy }
    const CW = document.documentElement.clientWidth, CH = Math.max(innerHeight, oy + size.h + 40)
    Object.assign(c.style, { left: `${-ox}px`, top: `${-oy}px`, width: `${CW}px`, height: `${CH}px` })
    c.width = CW * dpr; c.height = CH * dpr
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
      // salida: cualquier punto de la pantalla visible (y algunos desde fuera, por los bordes)
      const fuera = Math.random() < 0.25, ang = Math.random() * Math.PI * 2
      const sx = fuera ? CW / 2 + Math.cos(ang) * CW * 0.75 : Math.random() * CW, sy = fuera ? Math.min(CH, innerHeight) / 2 + Math.sin(ang) * innerHeight * 0.75 : Math.random() * Math.min(CH, innerHeight)
      pts.push({ x: 0, y: 0, sx, sy, tx: x + ox, ty: y + oy, d: (x / size.w) * 0.9 + Math.random() * 0.5, c: best?.color ?? '#9fd8e8', r: 1.5 + Math.random() * 1.1, vx: 0, vy: 0, tw: Math.random() * Math.PI * 2 })
    }
    let raf = 0, t0 = performance.now(), last = 0, ptr: { x: number; y: number } | null = null, lanzado = false
    const DUR = 2.6
    const move = (e: PointerEvent) => { const r = c.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top } }
    const leave = () => { ptr = null }
    addEventListener('pointermove', move); document.addEventListener('pointerleave', leave)
    const frame = (now: number) => {
      const t = (now - t0) / 1000
      const montado = t > DUR + 0.6
      if (montado && now - last < 33) { raf = requestAnimationFrame(frame); return } // ya montado: 30 imágenes por segundo bastan
      last = now
      ctx.clearRect(0, 0, CW, CH)
      for (const p of pts) {
        const k = ease((t - p.d) / (DUR - 0.9))
        let x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k
        if (montado) {
          // muelle: vuelve a su sitio; el dedo o el ratón los aparta
          if (ptr) { const dx = p.tx + p.vx - ptr.x, dy = p.ty + p.vy - ptr.y, d2 = dx * dx + dy * dy; if (d2 < 3600) { const f = (1 - Math.sqrt(d2) / 60) * 2.2; p.vx += (dx / (Math.sqrt(d2) || 1)) * f; p.vy += (dy / (Math.sqrt(d2) || 1)) * f } }
          p.vx *= 0.86; p.vy *= 0.86; x = p.tx + p.vx; y = p.ty + p.vy
        }
        let brillo = k < 1 ? 0.4 + k * 0.5 : 0.72 + 0.28 * Math.sin(t * 1.6 + p.tw), col = k < 1 ? '#bfefff' : p.c, r = p.r
        // onda del dato que se está contando: un anillo de su color que sale de su sitio y cruza el mapa
        const O = ondaRef.current
        if (montado && O) {
          const dt = (now - O.t) / 1000, d = Math.hypot(p.tx - O.x, p.ty - O.y), R = dt * 330, banda = Math.abs(d - R)
          if (dt < 2.4 && banda < 26) { const f = 1 - banda / 26; brillo = Math.min(1, brillo + f * 0.6); col = O.c; r = p.r + f * 1.6 }
          else if (d < 30 + Math.min(dt, 1) * 14) { col = O.c; brillo = 1 }
        }
        ctx.globalAlpha = brillo
        ctx.fillStyle = col
        ctx.fillRect(x - r / 2, y - r / 2, r, r)
      }
      ctx.globalAlpha = 1
      if (!lanzado && t > DUR - 0.2) { lanzado = true; setFase(1); onListo?.() }
      raf = requestAnimationFrame(frame)
    }
    if (reduce()) { t0 = performance.now() - (DUR + 5) * 1000; frame(performance.now()); cancelAnimationFrame(raf); setFase(1); onListo?.() }
    else raf = requestAnimationFrame(frame)
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce()) raf = requestAnimationFrame(frame) }
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', vis) }
  }, [size, proj, anclas])

  useEffect(() => {
    const a = anclas[foco]; if (!a || !fase) return
    ondaRef.current = { x: a.p[0] + origen.current.x, y: a.p[1] + origen.current.y, c: a.color, t: performance.now() }
  }, [foco, anclas, fase])
  const Lect = ({ a, x, y, izq, i }: { a: (typeof anclas)[number]; x?: number; y?: number; izq?: boolean; i: number }) => {
    const Tag = a.href ? 'a' : 'div'
    return <Tag href={a.href} onPointerEnter={() => onFoco(i, true)} onFocus={() => onFoco(i, true)} className={`lectura ${ancho ? (izq ? 'is-izq' : 'is-der') : 'is-lista'} ${foco === i ? 'is-foco' : ''}`} style={{ ...(ancho ? { left: x, top: y } : {}), ['--c' as string]: a.color, ['--i' as string]: i }}>
      <b>{a.valor}</b><small>{a.texto}</small>
    </Tag>
  }
  return (
    <div className={`hero-mapa ${fase ? 'is-listo' : ''} ${ancho ? '' : 'is-estrecho'}`} ref={wrap}>
      <div className="hero-lienzo" style={{ height: size?.h }}>
        <canvas ref={cv} className="hero-puntos" aria-hidden />
        {ancho && <svg className="l-lineas" width={size?.w} height={size?.h} aria-hidden>
          {cajas.map(({ a, x, y, izq }) => { const i = anclas.indexOf(a); const xe = izq ? x + 150 : x - 150; return <polyline key={a.id} points={`${a.p[0]},${a.p[1]} ${xe + (izq ? 24 : -24)},${y} ${xe},${y}`} className={foco === i ? 'is-foco' : ''} style={{ stroke: a.color, ['--i' as string]: i } as React.CSSProperties} /> })}
        </svg>}
        {anclas.map((a, i) => <i key={a.id} className={`l-punto ${foco === i ? 'is-foco' : ''}`} style={{ left: a.p[0], top: a.p[1], ['--c' as string]: a.color, ['--i' as string]: i } as React.CSSProperties} />)}
        {ancho && cajas.map(({ a, x, y, izq }) => <Lect key={a.id} a={a} x={x} y={y} izq={izq} i={anclas.indexOf(a)} />)}
      </div>
      {!ancho && <div className="lecturas-lista">{anclas.map((a, i) => <Lect key={a.id} a={a} i={i} />)}</div>}
    </div>
  )
}
