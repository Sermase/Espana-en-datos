import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Dices, Search, X } from 'lucide-react'
import { TEMAS } from '../temas'
import { PREGUNTAS, buscar, type Pregunta as P } from './preguntas'

const tema = (id: string) => TEMAS.find(t => t.id === id)

/** El texto de ayuda se escribe solo, pregunta a pregunta, para enseñar lo que se puede preguntar. */
function usePista(activa: boolean) {
  const reduce = useReducedMotion()
  const [txt, setTxt] = useState(PREGUNTAS[0]?.q ?? '')
  useEffect(() => {
    if (!activa || reduce || !PREGUNTAS.length) return
    let i = 0, k = 0, borrando = false, t: ReturnType<typeof setTimeout>
    const paso = () => {
      const q = PREGUNTAS[i % PREGUNTAS.length].q
      if (!borrando) { k++; setTxt(q.slice(0, k)); if (k >= q.length) { borrando = true; t = setTimeout(paso, 1700); return } }
      else { k -= 3; setTxt(q.slice(0, Math.max(0, k))); if (k <= 0) { borrando = false; k = 0; i++ } }
      t = setTimeout(paso, borrando ? 18 : 42)
    }
    t = setTimeout(paso, 900)
    return () => clearTimeout(t)
  }, [activa, reduce])
  return txt
}

/**
 * «¿Qué quieres saber?»: se escribe una pregunta (o media palabra) y responde al momento con el dato de hoy,
 * con un enlace al tema. Sin escribir nada, enseña las respuestas más útiles del día. «Sorpréndeme» elige una al azar.
 */
export function Pregunta() {
  const [q, setQ] = useState(''), [foco, setFoco] = useState(false), [azar, setAzar] = useState<P | null>(null)
  const inp = useRef<HTMLInputElement>(null)
  const pista = usePista(!foco && !q)
  const res = azar ? [azar] : buscar(q)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); inp.current?.focus() } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])
  const sorprende = () => { const otras = PREGUNTAS.filter(p => p.id !== azar?.id); const p = otras[Math.floor(Math.random() * otras.length)]; setAzar(p); setQ('') }
  const ir = (p?: P) => { const r = p && tema(p.tema)?.ruta; if (r) location.href = r }
  return <section className="pregunta" aria-labelledby="pq-t">
    <h2 id="pq-t">¿Qué quieres saber?</h2>
    <div className={`pq-caja ${foco ? 'is-foco' : ''}`}>
      <Search size={20} aria-hidden />
      <input ref={inp} value={q} onChange={e => { setQ(e.target.value); setAzar(null) }} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
        onKeyDown={e => { if (e.key === 'Enter') ir(res[0]); if (e.key === 'Escape') { setQ(''); setAzar(null) } }}
        placeholder={pista} aria-label="Pregunta lo que quieras saber de España" enterKeyHint="go" autoComplete="off" />
      {(q || azar) && <button className="pq-borrar" onClick={() => { setQ(''); setAzar(null); inp.current?.focus() }} aria-label="Borrar"><X size={17} /></button>}
      <button className="pq-azar" onClick={sorprende} title="Una pregunta al azar"><Dices size={18} /><span>Sorpréndeme</span></button>
    </div>
    <ul className="pq-res" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {res.map((p, i) => { const t = tema(p.tema)!; return <motion.li key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * .04 } }} exit={{ opacity: 0, transition: { duration: .12 } }}>
          <a href={t.ruta} style={{ '--c': t.color } as CSSProperties}>
            <span className="pq-q">{p.q}</span>
            <b className="pq-r">{p.r}</b>
            <small>{p.nota}</small>
            <span className="pq-tema"><i />{t.nombre}<ArrowUpRight size={14} /></span>
          </a>
        </motion.li> })}
      </AnimatePresence>
      {!res.length && <li className="pq-nada">No encuentro esa pregunta todavía. Prueba con «luz», «paro», «turistas» o elige un tema abajo.</li>}
    </ul>
  </section>
}
