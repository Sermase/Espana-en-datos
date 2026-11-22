import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { fmt, INFO } from './data'
import { MONTHS } from './history'

export function Bar({ value, max, tone = 'water' }: { value: number; max: number; tone?: string }) {
  return <span className={`bar bar-${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></span>
}

/** Número que corre hasta su valor, como un marcador. */
export function CountUp({ value, decimals = 0, ms = 900 }: { value: number; decimals?: number; ms?: number }) {
  const reduce = useReducedMotion()
  const [v, setV] = useState(reduce ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) { setV(value); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3)
      setV(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, ms, reduce])
  return <>{fmt(v, decimals)}</>
}

/** Indicador circular con marcas, como el de una consola. */
export function Ring({ p, tone = 'water', label, unit = '%', shown, size = 104 }: { p: number; tone?: string; label: string; unit?: string; shown?: number; size?: number }) {
  const ticks = Array.from({ length: 40 }, (_, i) => i)
  return (
    <div className={`ring-gauge tone-${tone}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="47" className="rg-orbit" />
        {ticks.map(i => {
          const a = (i / 40) * Math.PI * 2 - Math.PI / 2, on = i / 40 < p / 100
          return <line key={i} x1={50 + Math.cos(a) * 41} y1={50 + Math.sin(a) * 41} x2={50 + Math.cos(a) * 44} y2={50 + Math.sin(a) * 44} className={on ? 'rg-tick on' : 'rg-tick'} />
        })}
        <circle cx="50" cy="50" r="35" className="rg-track" />
        <motion.circle cx="50" cy="50" r="35" className="rg-arc" pathLength={100} transform="rotate(-90 50 50)"
          initial={{ strokeDasharray: '0 100' }} animate={{ strokeDasharray: `${Math.max(0, Math.min(100, p))} 100` }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }} />
      </svg>
      <span className="rg-num"><CountUp value={shown ?? p} decimals={(shown ?? p) < 10 && unit !== '%' ? 1 : 0} /><small>{unit}</small></span>
    </div>
  )
}

/** Botón «i» con una explicación corta. */
export function Info({ k }: { k: keyof typeof INFO | string }) {
  const it = INFO[k]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, up: false })
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const w = Math.min(300, innerWidth - 24)
    setPos({ x: Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12), y: r.bottom + 8, up: r.bottom > innerHeight * 0.62 })
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (!(e.target as HTMLElement).closest?.(`[data-info="${id}"]`)) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('pointerdown', close, true); addEventListener('keydown', esc); addEventListener('scroll', () => setOpen(false), { once: true, capture: true })
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', esc) }
  }, [open, id])
  if (!it) return null
  return (
    <>
      <button ref={btn} type="button" className={`info-btn ${open ? 'is-on' : ''}`} data-info={id} aria-expanded={open} aria-label={`Qué significa: ${it.t}`} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>i</button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="info-pop" data-info={id} role="tooltip"
              style={pos.up ? { left: pos.x, bottom: innerHeight - (btn.current?.getBoundingClientRect().top ?? 0) + 8 } : { left: pos.x, top: pos.y }}
              initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <b>{it.t}</b><p>{it.b}</p>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </>
  )
}

export function Head({ children, info, right }: { children: ReactNode; info?: string; right?: ReactNode }) {
  return <h3 className="hd"><span>{children}</span>{info && <Info k={info} />}{right && <span className="hd-right">{right}</span>}</h3>
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320)); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const pathOf = (pts: ([number, number] | null)[]) => {
  let d = '', pen = false
  for (const p of pts) {
    if (!p) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`; pen = true
  }
  return d
}

export type YearLine = { key: string; label: string; vals: (number | null)[]; cls: string }

/** Año hidrológico: semanas de octubre a septiembre, con varias líneas y la banda de mínimos y máximos. */
export function HydroChart({ lines, band, now, height = 210 }: {
  lines: YearLine[]; band?: { lo: (number | null)[]; hi: (number | null)[] }; now?: { w: number; v: number }; height?: number
}) {
  const [ref, W] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = height, L = 30, R = 8, T = 10, B = 22
  const x = (w: number) => L + (w / 52) * (W - L - R), y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const bandPath = band ? (() => {
    const up: string[] = [], dn: string[] = []
    band.hi.forEach((v, i) => { if (v != null && band.lo[i] != null) { up.push(`${x(i).toFixed(1)} ${y(v).toFixed(1)}`); dn.unshift(`${x(i).toFixed(1)} ${y(band.lo[i]!).toFixed(1)}`) } })
    return up.length ? `M${up.join('L')}L${dn.join('L')}Z` : ''
  })() : ''
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    setHover(Math.max(0, Math.min(52, Math.round(((e.clientX - r.left - L) / (W - L - R)) * 52))))
  }
  const hv = hover ?? now?.w ?? null
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Evolución semanal del agua embalsada por año hidrológico">
        {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {MONTHS.map((m, i) => (W > 340 || i % 2 === 0) && <text key={m} x={x(i * 4.35 + 2)} y={H - 6} className="axis" textAnchor="middle">{m}</text>)}
        {bandPath && <path d={bandPath} className="band" />}
        {lines.map(l => <path key={l.key} d={pathOf(l.vals.map((v, i) => (v == null ? null : [x(i), y(v)])))} className={`ln ${l.cls}`} pathLength={1} />)}
        {now && <g className="now-dot" transform={`translate(${x(now.w)} ${y(now.v)})`}><circle r="9" className="halo" /><circle r="4" /></g>}
        {hv != null && <line x1={x(hv)} x2={x(hv)} y1={T} y2={H - B} className="cross" />}
      </svg>
      <ul className="legend">
        {lines.map(l => {
          const v = hv != null ? l.vals[hv] : null
          return <li key={l.key} className={l.cls}><i />{l.label}<b>{v != null ? `${fmt(v)} %` : '—'}</b></li>
        })}
        {band && <li className="band-key"><i />Rango 10 años<b>{hv != null && band.lo[hv] != null ? `${fmt(band.lo[hv]!)}–${fmt(band.hi[hv]!)} %` : '—'}</b></li>}
      </ul>
      {hv != null && <p className="chart-week">Semana {hv + 1} del año hidrológico · {MONTHS[Math.min(11, Math.floor(hv / 4.35))]}</p>}
    </div>
  )
}

/** Serie larga en el tiempo (porcentaje), con lectura al deslizar. */
export function TimeChart({ pts, height = 170, marks = [], label }: {
  pts: { t: number; v: number | null }[]; height?: number; marks?: { t: number; v: number; label: string; cls: string }[]; label: string
}) {
  const [ref, W] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  const H = height, L = 30, R = 8, T = 10, B = 22
  const valid = pts.filter(p => p.v != null)
  if (!valid.length) return null
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R), y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const line = pathOf(pts.map(p => (p.v == null ? null : [x(p.t), y(p.v)])))
  const area = (() => {
    let d = '', open: number | null = null, last = 0
    pts.forEach(p => {
      if (p.v == null) { if (open != null) { d += `L${x(last).toFixed(1)} ${y(0)}Z`; open = null } return }
      if (open == null) { d += `M${x(p.t).toFixed(1)} ${y(0)}L${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`; open = p.t } else d += `L${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`
      last = p.t
    })
    if (open != null) d += `L${x(last).toFixed(1)} ${y(0)}Z`
    return d
  })()
  const y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear()
  const step = Math.max(1, Math.ceil((y1 - y0) / (W < 400 ? 4 : 8)))
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).filter(yy => (yy - y0) % step === 0 && yy > y0)
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const t = t0 + ((e.clientX - r.left - L) / (W - L - R)) * (t1 - t0)
    let bi = 0, bd = Infinity
    pts.forEach((p, i) => { if (p.v != null && Math.abs(p.t - t) < bd) { bd = Math.abs(p.t - t); bi = i } })
    setHover(bi)
  }
  const hp = hover != null ? pts[hover] : null
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={label}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="ar-top" /><stop offset="1" className="ar-bot" /></linearGradient></defs>
        {[0, 50, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}</text></g>)}
        {years.map(yy => <text key={yy} x={x(new Date(yy, 0, 1).getTime())} y={H - 6} className="axis" textAnchor="middle">{yy}</text>)}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} className="ln ln-main" pathLength={1} />
        {marks.map(m => <g key={m.label} className={`mark ${m.cls}`} transform={`translate(${x(m.t)} ${y(m.v)})`}><circle r="4.5" /></g>)}
        {hp && hp.v != null && <g><line x1={x(hp.t)} x2={x(hp.t)} y1={T} y2={H - B} className="cross" /><circle cx={x(hp.t)} cy={y(hp.v)} r="4" className="cross-dot" /></g>}
      </svg>
      <p className="chart-read">{hp && hp.v != null ? <><b>{fmt(hp.v)} %</b> el {new Date(hp.t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</> : 'Desliza sobre el gráfico para leer cada semana'}</p>
    </div>
  )
}
