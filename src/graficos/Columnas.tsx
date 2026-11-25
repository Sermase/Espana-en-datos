import { motion } from 'motion/react'
import { useState } from 'react'
import { niceTicks, useInView, useWidth } from './util'
import { sitioTip } from './tip'

export type Columna = { x: string; valor: number; color?: string; destacado?: boolean }

/**
 * Columnas verticales (años, tramos de precio…): suben desde la base al aparecer,
 * con el valor de cada una al pasar por encima y la columna destacada etiquetada.
 */
export function Columnas({ items, fmt, titulo, alto = 170, cadaX = 1, etiqueta }: { items: Columna[]; fmt: (v: number) => string; titulo: string; alto?: number; cadaX?: number; etiqueta?: (c: Columna) => string }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = alto, L = 40, R = 8, T = 16, B = 22
  const lo = Math.min(0, ...items.map(i => i.valor)), hi = Math.max(0, ...items.map(i => i.valor))
  const ticks = niceTicks(lo, hi, 3)
  const y0 = ticks[0], y1 = ticks[ticks.length - 1]
  const py = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B)
  const band = (W - L - R) / Math.max(1, items.length)
  // que las etiquetas del eje no se pisen: se salta las que hagan falta según el ancho disponible
  const anchoEt = Math.max(...items.map(c => String(c.x).length)) * 6.4 + 10
  const paso = Math.max(cadaX, Math.ceil(anchoEt / Math.max(1, band)))
  const bw = Math.min(24, Math.max(2, band - 2))
  return (
    <figure className="g-fig" ref={view}>
      <div className="g-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo} onPointerMove={e => { const i = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left - L) / band); if (i >= 0 && i < items.length) setHover(i) }}>
          {ticks.map(v => <g key={v}><line className="g-grid" x1={L} x2={W - R} y1={py(v)} y2={py(v)} /><text className="g-ax" x={L - 6} y={py(v) + 3.5} textAnchor="end">{fmt(v)}</text></g>)}
          {items.map((c, i) => {
            const x = L + i * band + (band - bw) / 2, top = py(Math.max(0, c.valor)), base = py(0), h = Math.abs(base - py(c.valor))
            const r = Math.min(4, bw / 2, h)
            const neg = c.valor < 0
            // extremo de datos redondeado, base recta
            const d = neg
              ? `M${x} ${base}h${bw}v${h - r}q0 ${r} ${-r} ${r}h${-(bw - 2 * r)}q${-r} 0 ${-r} ${-r}Z`
              : `M${x} ${base}v${-(h - r)}q0 ${-r} ${r} ${-r}h${bw - 2 * r}q${r} 0 ${r} ${r}v${h - r}Z`
            return <g key={c.x} className={`g-col ${c.destacado ? 'is-dest' : ''} ${hover === i ? 'is-hover' : ''}`}>
              <motion.path d={d} style={{ fill: c.color, originY: `${base}px` }} initial={{ scaleY: 0 }} animate={{ scaleY: seen ? 1 : 0 }} transition={{ duration: .7, delay: Math.min(.9, i * (0.9 / items.length)), ease: [0.2, 0.8, 0.2, 1] }} />
              {(i % paso === 0 || (c.destacado && paso === cadaX)) && <text className="g-ax" x={x + bw / 2} y={H - 6} textAnchor="middle">{c.x}</text>}
              {c.destacado && etiqueta && <text className="g-mlabel" x={x + bw / 2} y={(neg ? base + h + 12 : top - 5)} textAnchor="middle">{etiqueta(c)}</text>}
              <rect className="g-hit" x={L + i * band} y={T} width={band} height={H - T - B} tabIndex={-1} onPointerEnter={() => setHover(i)} onPointerLeave={e => e.pointerType !== 'touch' && setHover(null)} />
            </g>
          })}
        </svg>}
        {hover != null && W > 0 && <div className="g-tip" style={sitioTip(W, H, L + (hover + .5) * band, [py(items[hover].valor)], T, B, band / 2 + 8)} role="status">
          <p className="g-tip-x">{items[hover].x}</p><p><b>{fmt(items[hover].valor)}</b></p>
        </div>}
      </div>
      <details className="g-table"><summary>Ver los datos</summary>
        <table><tbody>{items.map(c => <tr key={c.x}><th scope="row">{c.x}</th><td>{fmt(c.valor)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  )
}
