import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { fmt, INFO } from './data'
import { MONTHS } from './history'
import { LineChart, useInView, type Punto, type Serie } from '../graficos'

/** Barra que crece hasta su valor la primera vez que se ve. */
export function Bar({ value, max, tone = 'water' }: { value: number; max: number; tone?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  return <span ref={ref} className={`bar bar-${tone}`}><motion.i initial={{ width: 0 }} animate={{ width: seen ? `${Math.max(0, Math.min(100, (value / max) * 100))}%` : 0 }} transition={{ duration: .8, ease: [0.2, 0.8, 0.2, 1] }} /></span>
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

export type YearLine = { key: string; label: string; vals: (number | null)[]; cls: string }

const LINE_COLOR: Record<string, string> = {
  'ln-cur': '#3fe6ff', 'ln-prev': '#d6e9ef', 'ln-old': '#8fa6ae', 'ln-avg': '#ffb02e',
  // años extra: tonos categóricos validados para fondo oscuro
  'ln-x0': '#3987e5', 'ln-x1': '#d55181', 'ln-x2': '#9085e9', 'ln-x3': '#199e70',
}
const colorOf = (cls: string) => LINE_COLOR[cls.split(' ').reverse().find(c => LINE_COLOR[c]) ?? 'ln-prev']

/** Año hidrológico: semanas de octubre a septiembre, con varias líneas y la banda de mínimos y máximos. */
export function HydroChart({ lines, band, now, height = 210 }: {
  lines: YearLine[]; band?: { lo: (number | null)[]; hi: (number | null)[] }; now?: { w: number; v: number }; height?: number
}) {
  const pts = (v: (number | null)[]): Punto[] => v.flatMap((y, i) => (y == null ? [] : [[i, y] as Punto]))
  const series: Serie[] = lines.map(l => ({ id: l.key, nombre: l.label, datos: pts(l.vals), color: colorOf(l.cls), fondo: l.cls.includes('ln-old') || l.cls.includes('ln-x') || l.cls.includes('ln-prev'), area: l.cls.includes('ln-cur') })).filter(s => s.datos.length > 1)
  const ticks = MONTHS.map((_, i) => i * 4.35 + 2)
  return (
    <LineChart titulo="Evolución semanal del agua embalsada por año hidrológico" series={series} alto={height} yMin={0} yMax={100}
      fx={v => `Semana ${Math.round(v) + 1} · ${MONTHS[Math.min(11, Math.floor(v / 4.35))]}`} fxEje={v => MONTHS[Math.min(11, Math.floor(v / 4.35))]} fy={v => `${fmt(v)} %`} ticksX={ticks}
      banda={band ? { nombre: 'Rango 10 años', lo: pts(band.lo), hi: pts(band.hi) } : undefined} ahora={now?.w}
      marcas={now && !series.some(s => s.id === 'cur') ? [{ x: now.w, y: now.v, texto: `ahora ${fmt(now.v)} %` }] : []} />
  )
}

/** Serie larga en el tiempo (porcentaje), con lectura al deslizar. */
export function TimeChart({ pts, height = 170, marks = [], label }: {
  pts: { t: number; v: number | null }[]; height?: number; marks?: { t: number; v: number; label: string; cls: string }[]; label: string
}) {
  const datos = pts.flatMap(p => (p.v == null ? [] : [[p.t, p.v] as Punto]))
  if (datos.length < 2) return null
  const d = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <LineChart titulo={label} series={[{ id: 'v', nombre: label, datos, color: '#3fe6ff', area: true }]} alto={height} yMin={0} yMax={100}
      fx={v => (Math.abs(v - datos[0][0]) > 2e9 && new Date(v).getMonth() === 0 && new Date(v).getDate() < 8 ? String(new Date(v).getFullYear()) : d(v))}
      ticksX={(() => { const y0 = new Date(datos[0][0]).getFullYear() + 1, y1 = new Date(datos[datos.length - 1][0]).getFullYear(); const st = Math.max(1, Math.ceil((y1 - y0) / 6)); const out: number[] = []; for (let y = y0; y <= y1; y += st) out.push(new Date(y, 0, 1).getTime()); return out })()}
      fy={v => `${fmt(v)} %`} etiquetasFinal={!marks.some(m => m.cls === 'mk-now')}
      marcas={marks.map(m => ({ x: m.t, y: m.v, texto: m.cls === 'mk-min' ? `mín. ${fmt(m.v)} %` : m.cls === 'mk-max' ? `máx. ${fmt(m.v)} %` : `${fmt(m.v)} %`, tono: m.cls === 'mk-min' ? 'bajo' as const : 'alto' as const }))} />
  )
}
