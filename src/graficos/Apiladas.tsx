import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { motion } from 'motion/react'
import { niceTicks, useInView, useWidth } from './util'
import { Leyenda, useOcultas } from './Leyenda'

export type Capa = { id: string; nombre: string; color: string; v: number[] }

/**
 * Áreas apiladas (el gráfico de «de dónde sale la electricidad»): capas que crecen
 * desde abajo al aparecer, separadas por un filo del color del fondo; cruz con el
 * desglose de ese instante, y en «%» cada columna suma 100.
 */
export function Apiladas({ xs, capas: todas, titulo, fx, fxEje, ticksX, fy, alto = 240, pct = false, sel, onSel }: {
  xs: number[]; capas: Capa[]; titulo: string; fx: (t: number) => string; fxEje?: (t: number) => string; ticksX?: number[]
  fy: (v: number) => string; alto?: number; pct?: boolean; sel?: string | null; onSel?: (id: string) => void
}) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)
  const { off, setOff } = useOcultas()
  const capas = useMemo(() => (onSel ? todas : todas.filter(c => !off.has(c.id))), [todas, off, onSel])
  const H = alto, L = 46, R = 10, T = 10, B = 24
  const tot = useMemo(() => xs.map((_, i) => capas.reduce((s, c) => s + Math.max(0, c.v[i] ?? 0), 0)), [xs, capas])
  const val = (c: Capa, i: number) => { const v = Math.max(0, c.v[i] ?? 0); return pct ? (tot[i] ? (v / tot[i]) * 100 : 0) : v }
  const ymax = pct ? 100 : Math.max(...tot)
  const ticks = pct ? [0, 25, 50, 75, 100] : niceTicks(0, ymax)
  const y1 = ticks[ticks.length - 1]
  const x0 = xs[0], x1 = xs[xs.length - 1]
  const px = (t: number) => L + ((t - x0) / (x1 - x0 || 1)) * Math.max(10, W - L - R)
  const py = (v: number) => T + (1 - v / (y1 || 1)) * (H - T - B)
  const bandas = useMemo(() => {
    const acc = xs.map(() => 0)
    return capas.map(c => {
      const lo = acc.slice(), up = xs.map((_, i) => (acc[i] += val(c, i)))
      return { c, lo, up }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, capas, pct, tot])
  const path = (lo: number[], up: number[]) => `M${xs.map((t, i) => `${px(t).toFixed(1)} ${py(up[i]).toFixed(1)}`).join('L')}L${xs.map((t, i) => [t, i] as const).reverse().map(([t, i]) => `${px(t).toFixed(1)} ${py(lo[i]).toFixed(1)}`).join('L')}Z`
  const tx = (ticksX ?? niceTicks(x0, x1, Math.max(2, Math.floor(W / 110)))).filter(v => v >= x0 && v <= x1)
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), t = x0 + ((e.clientX - r.left) / r.width) * (x1 - x0)
    let b = 0; xs.forEach((x, i) => { if (Math.abs(x - t) < Math.abs(xs[b] - t)) b = i }); setHi(b)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault(); const i = hi ?? xs.length - 1; setHi(Math.max(0, Math.min(xs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))))
  }
  const fmtV = (c: Capa, i: number) => pct ? `${val(c, i).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : fy(c.v[i] ?? 0)
  return (
    <figure className="g-fig" ref={view}>
      {onSel ? <ul className="g-legend g-legend-sel">{todas.map(c => <li key={c.id}>
        <button className={sel === c.id ? 'is-on' : ''} onClick={() => onSel(c.id)} aria-pressed={sel === c.id}><i style={{ background: c.color, height: 8 }} />{c.nombre}</button>
      </li>)}</ul> : <Leyenda items={todas.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }))} off={off} setOff={setOff} />}
      <div className="g-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo}>
          {ticks.map(v => <g key={v}><line className="g-grid" x1={L} x2={W - R} y1={py(v)} y2={py(v)} /><text className="g-ax" x={L - 6} y={py(v) + 3.5} textAnchor="end">{pct ? `${v} %` : fy(v)}</text></g>)}
          {tx.map(v => <text key={v} className="g-ax" x={px(v)} y={H - 6} textAnchor="middle">{(fxEje ?? fx)(v)}</text>)}
          <motion.g style={{ originY: `${py(0)}px` }} initial={{ scaleY: 0 }} animate={{ scaleY: seen ? 1 : 0 }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}>
            {bandas.map(({ c, lo, up }) => <path key={c.id} className="g-capa" d={path(lo, up)} style={{ fill: c.color, opacity: sel && sel !== c.id ? 0.5 : 0.92 }} onClick={() => onSel?.(c.id)} />)}
          </motion.g>
          {hi != null && <line className="g-cross-l" x1={px(xs[hi])} x2={px(xs[hi])} y1={T} y2={H - B} />}
          <rect className="g-hit" x={L} y={0} width={Math.max(0, W - L - R)} height={H} tabIndex={0} aria-label={`${titulo}: usa las flechas para recorrer los datos`}
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={e => e.pointerType !== 'touch' && setHi(null)} onKeyDown={onKey} onBlur={() => setHi(null)} />
        </svg>}
        {hi != null && W > 0 && <div className="g-tip g-tip-wide" style={{ left: px(xs[hi]) > W / 2 ? Math.max(0, px(xs[hi]) - 200) : Math.min(W - 190, px(xs[hi]) + 12) }} role="status">
          <p className="g-tip-x">{fx(xs[hi])}{!pct && <> · total {fy(tot[hi])}</>}</p>
          {[...capas].reverse().filter(c => (c.v[hi] ?? 0) > 0).map(c => <p key={c.id}><b>{fmtV(c, hi)}</b><span><i style={{ background: c.color, height: 8 }} />{c.nombre}</span></p>)}
        </div>}
      </div>
      <details className="g-table"><summary>Ver los datos</summary>
        <table><thead><tr><th scope="col" />{capas.map(c => <th key={c.id} scope="col">{c.nombre}</th>)}</tr></thead>
          <tbody>{xs.map((t, i) => [t, i] as const).filter(([, i]) => i % Math.max(1, Math.ceil(xs.length / 60)) === 0 || i === xs.length - 1).map(([t, i]) => <tr key={t}><th scope="row">{fx(t)}</th>{capas.map(c => <td key={c.id}>{fmtV(c, i)}</td>)}</tr>)}</tbody></table>
      </details>
    </figure>
  )
}
