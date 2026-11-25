import { motion } from 'motion/react'
import { useState } from 'react'
import { CountUp } from './CountUp'
import { useInView } from './util'

export type Barra = { id: string | number; nombre: string; sub?: string; valor: number; color?: string; destacado?: boolean; onClick?: () => void }

/**
 * Ranking en barras horizontales: crecen una tras otra al aparecer, con el valor en la punta.
 * Si `desde` no es 0 (precios), la barra mide la distancia al mínimo.
 * Se pueden tocar: sin `onClick` propio, tocar una barra la resalta y cuenta su puesto, su parte del total
 * (si todas son positivas) y cuánto está del primero; otro toque la suelta.
 */
export function Barras({ items, fmt, titulo, desde = 0, max, limite = 12 }: { items: Barra[]; fmt: (v: number) => string; titulo: string; desde?: number; max?: number; limite?: number }) {
  const [ref, seen] = useInView<HTMLUListElement>()
  const [all, setAll] = useState(false), [ojo, setOjo] = useState<Barra['id'] | null>(null)
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
      <ul className={`g-bars ${ojo != null ? 'is-ojo' : ''}`} ref={ref} aria-label={titulo}>
        {shown.map((it, i) => {
          const propio = !!it.onClick, mira = ojo === it.id
          return <li key={it.id} className={`${it.destacado ? 'is-dest' : ''} ${mira ? 'is-mira' : ''}`}>
            <button type="button" className="g-bar" aria-expanded={propio ? undefined : mira} onClick={propio ? it.onClick : () => setOjo(mira ? null : it.id)}>
              <span className="g-bar-n">{it.nombre}{it.sub && <small>{it.sub}</small>}</span>
              <span className={`g-bar-t ${neg ? 'is-div' : ''}`}>
                {neg && <span className="g-zero" style={{ left: `${(-lo / span) * 100}%` }} />}
                <motion.i className={it.valor < 0 ? 'is-neg' : ''} style={{ background: it.color, left: geo(it.valor).left }} initial={{ width: 0 }} animate={{ width: seen ? geo(it.valor).width : 0 }} transition={{ duration: .8, delay: Math.min(i, 14) * .05, ease: [0.2, 0.8, 0.2, 1] }} />
              </span>
              <b><CountUp value={it.valor} fmt={fmt} start={seen} delay={Math.min(i, 14) * .05} duration={.8} /></b>
            </button>
            {mira && <motion.p className="g-bar-ojo" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} role="status">{detalle(items, it, fmt)}</motion.p>}
          </li>
        })}
      </ul>
      {items.length > limite && <button className="g-more" onClick={() => setAll(a => !a)}>{all ? 'Ver menos' : `Ver los ${items.length}`}</button>}
    </>
  )
}

/** La frase del toque: puesto, parte del total y distancia al primero. Calculada con los datos de la lista. */
function detalle(items: Barra[], it: Barra, fmt: (v: number) => string) {
  const orden = [...items].sort((a, b) => b.valor - a.valor), k = orden.findIndex(x => x.id === it.id) + 1, n = items.length
  const pos = items.every(x => x.valor >= 0), tot = items.reduce((s, x) => s + x.valor, 0), lider = orden[0]
  const partes = [`Puesto ${k} de ${n}`]
  if (pos && tot > 0 && n > 2) partes.push(`${(it.valor / tot * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} % de la suma de la lista`)
  if (k > 1 && lider.valor > 0 && it.valor >= 0) {
    const r = it.valor / lider.valor
    partes.push(r >= 0.5 ? `${((1 - r) * 100).toLocaleString('es-ES', { maximumFractionDigits: 0 })} % menos que ${lider.nombre} (${fmt(lider.valor)})` : `${(lider.valor / (it.valor || 1)).toLocaleString('es-ES', { maximumFractionDigits: 1 })} veces menos que ${lider.nombre} (${fmt(lider.valor)})`)
  } else if (k === 1 && orden[1]) partes.push(`${fmt(it.valor - orden[1].valor)} más que ${orden[1].nombre}`)
  return partes.join(' · ')
}
