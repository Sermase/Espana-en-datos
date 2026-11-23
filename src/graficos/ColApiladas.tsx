import { useState } from 'react'
import { motion } from 'motion/react'
import { niceTicks, useInView, useWidth } from './util'

export type Tramo = { id: string; nombre: string; color: string; v: number[] }

/**
 * Columnas apiladas (p. ej. el precio de la luz partido en mercado y ajustes, o el consumo por sectores):
 * cada tramo crece desde la base, con un filo del color del fondo entre tramos; admite valores negativos
 * (se apilan hacia abajo) y muestra el desglose de la columna al pasar por encima.
 */
export function ColApiladas({ xs, tramos, titulo, fy, alto = 220, cadaX = 1, total = true }: { xs: string[]; tramos: Tramo[]; titulo: string; fy: (v: number) => string; alto?: number; cadaX?: number; total?: boolean }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)
  const H = alto, L = 52, R = 8, T = 10, B = 22
  const pos = xs.map((_, i) => tramos.reduce((s, t) => s + Math.max(0, t.v[i] ?? 0), 0))
  const neg = xs.map((_, i) => tramos.reduce((s, t) => s + Math.min(0, t.v[i] ?? 0), 0))
  const ticks = niceTicks(Math.min(0, ...neg), Math.max(0, ...pos))
  const y0 = ticks[0], y1 = ticks[ticks.length - 1]
  const py = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B)
  const band = (W - L - R) / Math.max(1, xs.length), bw = Math.min(28, Math.max(2, band - (band > 8 ? 3 : 1)))
  const paso = Math.max(cadaX, Math.ceil((Math.max(...xs.map(x => x.length)) * 6.4 + 10) / Math.max(1, band)))
  return (
    <figure className="g-fig" ref={view}>
      <ul className="g-legend">{tramos.map(t => <li key={t.id}><i style={{ background: t.color, height: 8 }} />{t.nombre}</li>)}</ul>
      <div className="g-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo}>
          {ticks.map(v => <g key={v}><line className="g-grid" x1={L} x2={W - R} y1={py(v)} y2={py(v)} /><text className="g-ax" x={L - 6} y={py(v) + 3.5} textAnchor="end">{fy(v)}</text></g>)}
          {xs.map((x, i) => {
            let up = 0, dn = 0
            const cx = L + i * band + (band - bw) / 2
            return <g key={x} className={`g-colst ${hi === i ? 'is-hover' : ''}`}>
              <motion.g style={{ originY: `${py(0)}px` }} initial={{ scaleY: 0 }} animate={{ scaleY: seen ? 1 : 0 }} transition={{ duration: .7, delay: Math.min(.8, i * (0.8 / xs.length)), ease: [0.2, 0.8, 0.2, 1] }}>
                {tramos.map(t => {
                  const v = t.v[i] ?? 0; if (!v) return null
                  const a = v > 0 ? up : dn, b = a + v; if (v > 0) up = b; else dn = b
                  return <rect key={t.id} x={cx} width={bw} y={Math.min(py(a), py(b))} height={Math.max(0.5, Math.abs(py(a) - py(b)) - 1)} style={{ fill: t.color }} />
                })}
              </motion.g>
              {i % paso === 0 && <text className="g-ax" x={cx + bw / 2} y={H - 6} textAnchor="middle">{x}</text>}
              <rect className="g-hit" x={L + i * band} y={T} width={band} height={H - T - B} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)} onPointerDown={() => setHi(i)} />
            </g>
          })}
          <line className="g-grid" x1={L} x2={W - R} y1={py(0)} y2={py(0)} style={{ stroke: 'rgba(160,220,240,.35)' }} />
        </svg>}
        {hi != null && W > 0 && <div className="g-tip g-tip-wide" style={{ left: Math.min(W - 190, Math.max(0, L + hi * band - 90)) }} role="status">
          <p className="g-tip-x">{xs[hi]}{total && <> · total {fy(pos[hi] + neg[hi])}</>}</p>
          {[...tramos].reverse().filter(t => t.v[hi]).map(t => <p key={t.id}><b>{fy(t.v[hi])}</b><span><i style={{ background: t.color, height: 8 }} />{t.nombre}</span></p>)}
        </div>}
      </div>
      <details className="g-table"><summary>Ver los datos</summary>
        <table><thead><tr><th scope="col" />{tramos.map(t => <th key={t.id} scope="col">{t.nombre}</th>)}</tr></thead>
          <tbody>{xs.map((x, i) => <tr key={x}><th scope="row">{x}</th>{tramos.map(t => <td key={t.id}>{fy(t.v[i] ?? 0)}</td>)}</tr>)}</tbody></table>
      </details>
    </figure>
  )
}
