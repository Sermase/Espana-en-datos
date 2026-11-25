import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CountUp } from './CountUp'
import { niceTicks, useInView, useWidth } from './util'
import { Leyenda, useOcultas } from './Leyenda'

export type Punto = [number, number]
export type Serie = {
  id: string
  nombre: string
  datos: Punto[]
  /** color de la marca; por defecto el acento del tema */
  color?: string
  /** relleno suave bajo la línea */
  area?: boolean
  /** serie de contexto: más fina y apagada */
  fondo?: boolean
}
export type Marca = { x: number; y: number; texto: string; tono?: 'bajo' | 'alto' }

type Props = {
  series: Serie[]
  alto?: number
  /** texto para lectores de pantalla y título del cuadro de datos */
  titulo: string
  fx: (v: number) => string
  fy: (v: number) => string
  /** formato de las marcas del eje x, si no es el mismo que el del cuadro */
  fxEje?: (v: number) => string
  /** marcas del eje x; si no, se reparten solas */
  ticksX?: number[]
  yMin?: number
  yMax?: number
  /** franja (por ejemplo, mínimo y máximo de diez años) */
  banda?: { nombre: string; lo: Punto[]; hi: Punto[] }
  marcas?: Marca[]
  /** línea vertical de «hoy» */
  ahora?: number
  /** etiqueta al final de cada serie principal */
  etiquetasFinal?: boolean
  pie?: ReactNode
}

/**
 * Gráfico de líneas común a toda la web: se dibuja al entrar en pantalla,
 * con cruz que sigue al dedo o al ratón (también con las flechas del teclado),
 * leyenda si hay varias series y la tabla de datos debajo.
 */
export function LineChart({ series: todas, alto = 200, titulo, fx, fy, fxEje, ticksX, yMin, yMax, banda, marcas = [], ahora, etiquetasFinal = true, pie }: Props) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [hx, setHx] = useState<number | null>(null)
  const { off, setOff } = useOcultas()
  const series = useMemo(() => todas.filter(s => !off.has(s.id)), [todas, off])
  const id = useId()
  const H = alto, L = 44, R = etiquetasFinal ? 58 : 12, T = 12, B = 24

  const all = series.flatMap(s => s.datos)
  const xs = useMemo(() => [...new Set(series.flatMap(s => s.datos.map(p => p[0])))].sort((a, b) => a - b), [series])
  const x0 = Math.min(...all.map(p => p[0]), ...(banda?.lo.map(p => p[0]) ?? [])), x1 = Math.max(...all.map(p => p[0]), ...(banda?.hi.map(p => p[0]) ?? []))
  const ys = [...all.map(p => p[1]), ...(banda ? [...banda.lo, ...banda.hi].map(p => p[1]) : [])]
  const ticksY = niceTicks(yMin ?? Math.min(...ys), yMax ?? Math.max(...ys))
  const y0 = Math.min(ticksY[0], yMin ?? Infinity), y1 = yMax ?? ticksY[ticksY.length - 1]
  const px = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * Math.max(10, W - L - R)
  const py = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B)
  const line = (d: Punto[]) => d.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`).join('')
  const tx = ticksX ?? niceTicks(x0, x1, Math.max(2, Math.floor(W / 110))).filter(v => v >= x0 && v <= x1)

  const near = (d: Punto[], x: number) => { let b = d[0]; for (const p of d) if (Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p; return b }
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), v = x0 + ((e.clientX - r.left) / r.width) * (x1 - x0)
    let b = xs[0]; for (const x of xs) if (Math.abs(x - v) < Math.abs(b - v)) b = x
    setHx(b)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = hx == null ? xs.length - 1 : xs.indexOf(hx)
    setHx(xs[Math.max(0, Math.min(xs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))])
  }
  const main = series.filter(s => !s.fondo)
  const tip = hx != null ? series.map(s => ({ s, p: near(s.datos, hx) })).filter(r => r.p && Math.abs(r.p[0] - hx) <= (x1 - x0) / 40) : []
  const ease = [0.2, 0.8, 0.2, 1] as const

  return (
    <figure className="g-fig" ref={view}>
      {todas.length > 1 && <Leyenda linea items={todas.map(s => ({ id: s.id, nombre: s.nombre, color: s.color, fondo: s.fondo }))} off={off} setOff={setOff} />}
      {banda && <ul className="g-legend" aria-hidden><li><i className="is-banda" />{banda.nombre}</li></ul>}
      <div className="g-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo}>
          <defs><linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          {ticksY.map(v => <g key={v}><line className="g-grid" x1={L} x2={W - R} y1={py(v)} y2={py(v)} /><text className="g-ax" x={L - 6} y={py(v) + 3.5} textAnchor="end">{fy(v)}</text></g>)}
          {tx.map(v => <text key={v} className="g-ax" x={px(v)} y={H - 6} textAnchor="middle">{(fxEje ?? fx)(v)}</text>)}
          {banda && <motion.path className="g-band" d={`${line(banda.hi)}L${[...banda.lo].reverse().map(p => `${px(p[0])} ${py(p[1])}`).join('L')}Z`} initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={{ duration: .8 }} />}
          {ahora != null && <line className="g-now" x1={px(ahora)} x2={px(ahora)} y1={T} y2={H - B} />}
          {series.map((s, i) => {
            const d = line(s.datos)
            return <g key={s.id} style={{ color: s.color }} className={s.fondo ? 'is-fondo' : ''}>
              {s.area && <motion.path d={`${d}L${px(s.datos[s.datos.length - 1][0])} ${py(y0)}L${px(s.datos[0][0])} ${py(y0)}Z`} fill={`url(#${id}a)`} initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={{ duration: 1, delay: .6 + i * .15 }} />}
              <motion.path d={d} className="g-line" initial={{ pathLength: 0 }} animate={{ pathLength: seen ? 1 : 0 }} transition={{ duration: s.fondo ? .9 : 1.4, delay: i * .15, ease }} />
            </g>
          })}
          {marcas.map((m, i) => <motion.g key={i} initial={{ opacity: 0, scale: .4 }} animate={{ opacity: seen ? 1 : 0, scale: seen ? 1 : .4 }} transition={{ delay: 1.2 + i * .1 }} style={{ originX: `${px(m.x)}px`, originY: `${py(m.y)}px` }}>
            <circle className={`g-mark ${m.tono === 'bajo' ? 'is-bajo' : ''}`} cx={px(m.x)} cy={py(m.y)} r={4.5} />
            <text className="g-mlabel" x={Math.min(W - R, Math.max(L, px(m.x)))} y={py(m.y) + (m.tono === 'bajo' ? 16 : -9)} textAnchor="middle">{m.texto}</text>
          </motion.g>)}
          {etiquetasFinal && main.map((s, i) => {
            const p = s.datos[s.datos.length - 1]
            return <motion.g key={s.id} initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={{ delay: 1.2 + i * .15 }}>
              <circle className="g-end" cx={px(p[0])} cy={py(p[1])} r={4.5} style={{ fill: s.color }} />
              <text className="g-endlabel" x={px(p[0]) + 9} y={py(p[1]) + 4}><CountUp value={p[1]} fmt={fy} start={seen} delay={.2} /></text>
            </motion.g>
          })}
          {hx != null && <g className="g-cross" aria-hidden>
            <line x1={px(hx)} x2={px(hx)} y1={T} y2={H - B} />
            {tip.map(({ s, p }) => <circle key={s.id} cx={px(p[0])} cy={py(p[1])} r={4.5} style={{ fill: s.color }} />)}
          </g>}
          <rect className="g-hit" x={L} y={0} width={Math.max(0, W - L - R)} height={H} tabIndex={0} aria-label={`${titulo}: usa las flechas para recorrer los datos`}
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={e => e.pointerType !== 'touch' && setHx(null)} onKeyDown={onKey} onBlur={() => setHx(null)} />
        </svg>}
        {hx != null && tip.length > 0 && W > 0 && <div className="g-tip" style={{ left: Math.min(W - 150, Math.max(0, px(hx) - 75)) }} role="status">
          <p className="g-tip-x">{fx(hx)}</p>
          {tip.map(({ s, p }) => <p key={s.id}><b>{fy(p[1])}</b><span><i style={{ background: s.color }} />{s.nombre}</span></p>)}
        </div>}
      </div>
      {pie && <figcaption className="g-cap">{pie}</figcaption>}
      <details className="g-table">
        <summary>Ver los datos</summary>
        <Tabla series={series} fx={fx} fy={fy} />
      </details>
    </figure>
  )
}

/** La tabla equivalente: hasta 60 filas repartidas por toda la serie. */
function Tabla({ series, fx, fy }: { series: Serie[]; fx: (v: number) => string; fy: (v: number) => string }) {
  const xs = [...new Set(series.flatMap(s => s.datos.map(p => p[0])))].sort((a, b) => a - b)
  const step = Math.max(1, Math.ceil(xs.length / 60))
  const rows = xs.filter((_, i) => i % step === 0 || i === xs.length - 1)
  const at = (s: Serie, x: number) => s.datos.find(p => p[0] === x)?.[1]
  return <table><thead><tr><th scope="col" /> {series.map(s => <th scope="col" key={s.id}>{s.nombre}</th>)}</tr></thead>
    <tbody>{rows.map(x => <tr key={x}><th scope="row">{fx(x)}</th>{series.map(s => { const v = at(s, x); return <td key={s.id}>{v == null ? '—' : fy(v)}</td> })}</tr>)}</tbody></table>
}
