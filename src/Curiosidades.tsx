import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import './curiosidades.css'

/** Bloque de «¿Sabías que…?»: frases sacadas del propio dato (nunca escritas a mano para un caso concreto). */
export function Curiosidades({ items, enlaces, titulo = 'Curiosidades' }: { items: (ReactNode | null | false | undefined)[]; enlaces?: { n: string; u: string }[]; titulo?: string }) {
  const ok = items.filter(Boolean)
  if (!ok.length && !enlaces?.length) return null
  return (
    <section className="curios">
      <h3><Sparkles size={15} aria-hidden /> {titulo}</h3>
      <ul>{ok.map((x, i) => <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i, duration: 0.35 }}>{x}</motion.li>)}</ul>
      {enlaces && enlaces.length > 0 && <p className="curios-links">{enlaces.map(e => <a key={e.u} href={e.u} target="_blank" rel="noopener noreferrer">{e.n} ↗</a>)}</p>}
    </section>
  )
}
