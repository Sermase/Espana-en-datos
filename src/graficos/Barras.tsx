import { motion } from 'motion/react'
import { useState } from 'react'
import { CountUp } from './CountUp'
import { useInView } from './util'

export type Barra = { id: string | number; nombre: string; sub?: string; valor: number; color?: string; destacado?: boolean; onClick?: () => void }

/**
 * Ranking en barras horizontales: crecen una tras otra al aparecer,
 * con el valor en la punta. Si `desde` no es 0 (precios), la barra mide la distancia al mínimo.
 */
export function Barras({ items, fmt, titulo, desde = 0, max, limite = 12 }: { items: Barra[]; fmt: (v: number) => string; titulo: string; desde?: number; max?: number; limite?: number }) {
  const [ref, seen] = useInView<HTMLUListElement>()
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, limite)
  const hi = max ?? Math.max(...items.map(i => i.valor))
  // con valores negativos, las barras salen de un cero común (divergentes)
  const neg = items.some(i => i.valor < 0)
  const lo = neg ? Math.min(0, ...items.map(i => i.valor)) : desde, top = neg ? Math.max(0, hi) : hi
  const span = top - lo || 1
  const geo = (v: number) => neg
    ? { left: `${((Math.min(0, v) - lo) / span) * 100}%`, width: `${Math.max(0.6, (Math.abs(v) / span) * 100)}%` }
    : { left: '0%', width: `${top > lo ? Math.max(2, ((v - lo) / span) * 100) : 100}%` }
  return (
    <>
      <ul className="g-bars" ref={ref} aria-label={titulo}>
        {shown.map((it, i) => {
          const Tag = it.onClick ? 'button' : 'div'
          return <li key={it.id} className={it.destacado ? 'is-dest' : ''}>
            <Tag className="g-bar" onClick={it.onClick} {...(it.onClick ? { type: 'button' as const } : {})}>
              <span className="g-bar-n">{it.nombre}{it.sub && <small>{it.sub}</small>}</span>
              <span className={`g-bar-t ${neg ? 'is-div' : ''}`}>
                {neg && <span className="g-zero" style={{ left: `${(-lo / span) * 100}%` }} />}
                <motion.i className={it.valor < 0 ? 'is-neg' : ''} style={{ background: it.color, left: geo(it.valor).left }} initial={{ width: 0 }} animate={{ width: seen ? geo(it.valor).width : 0 }} transition={{ duration: .8, delay: Math.min(i, 14) * .05, ease: [0.2, 0.8, 0.2, 1] }} />
              </span>
              <b><CountUp value={it.valor} fmt={fmt} start={seen} delay={Math.min(i, 14) * .05} duration={.8} /></b>
            </Tag>
          </li>
        })}
      </ul>
      {items.length > limite && <button className="g-more" onClick={() => setAll(a => !a)}>{all ? 'Ver menos' : `Ver los ${items.length}`}</button>}
    </>
  )
}
