import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useInView } from './util'

export type Fotograma = { t: string; items: { id: string; nombre: string; valor: number }[] }
const PALETA = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767']

/**
 * Carrera de barras: el ranking de cada periodo, uno tras otro. Las barras se reordenan deslizándose y la etiqueta del
 * periodo crece al fondo. Arranca sola al verse (salvo con menos movimiento, que enseña el último periodo) y se puede
 * parar, volver a empezar o mover con la barra de tiempo.
 */
export function Carrera({ fotogramas, top = 10, fmt, titulo, colores, ms = 1300, alto = 30 }: {
  fotogramas: Fotograma[]; top?: number; fmt: (v: number) => string; titulo: string; colores?: Record<string, string>; ms?: number; alto?: number
}) {
  const reduce = useReducedMotion()
  const [ref, visto] = useInView<HTMLDivElement>()
  const [i, setI] = useState(reduce ? fotogramas.length - 1 : 0)
  const [play, setPlay] = useState(false), arrancado = useRef(false)
  useEffect(() => { if (visto && !reduce && !arrancado.current) { arrancado.current = true; setPlay(true) } }, [visto, reduce])
  useEffect(() => {
    if (!play) return
    if (i >= fotogramas.length - 1) { setPlay(false); return }
    const t = setTimeout(() => setI(i + 1), ms); return () => clearTimeout(t)
  }, [play, i, fotogramas.length, ms])
  const color = useMemo(() => {
    const ids = [...new Set(fotogramas.flatMap(f => [...f.items].sort((a, b) => b.valor - a.valor).slice(0, top).map(x => x.id)))]
    return Object.fromEntries(ids.map((id, k) => [id, colores?.[id] ?? PALETA[k % PALETA.length]]))
  }, [fotogramas, top, colores])
  const f = fotogramas[i], filas = [...f.items].sort((a, b) => b.valor - a.valor).slice(0, top), max = filas[0]?.valor || 1
  const dur = reduce ? 0 : (ms / 1000) * 0.85
  return <figure className="carrera" ref={ref} aria-label={titulo}>
    <div className="cr-ctl">
      <button onClick={() => { if (i >= fotogramas.length - 1) setI(0); setPlay(!play) }} aria-label={play ? 'Pausar' : 'Reproducir'}>{play ? <Pause size={15} /> : i >= fotogramas.length - 1 ? <RotateCcw size={15} /> : <Play size={15} />}</button>
      <input type="range" min={0} max={fotogramas.length - 1} value={i} onChange={e => { setPlay(false); setI(+e.target.value) }} aria-label="Periodo" />
      <span>{f.t}</span>
    </div>
    <div className="cr-pista" style={{ height: top * alto }} role="img" aria-label={`${titulo}, ${f.t}: ${filas.map((x, k) => `${k + 1}. ${x.nombre}, ${fmt(x.valor)}`).join('; ')}`}>
      <div className="cr-marca" aria-hidden>{f.t}</div>
      {filas.map((x, k) => (
        <motion.div key={x.id} className="cr-fila" initial={false} animate={{ y: k * alto }} transition={{ duration: dur, ease: 'easeInOut' }} style={{ height: alto - 6 }}>
          <span className="cr-pos">{k + 1}</span>
          <div className="cr-barra-wrap">
            <motion.div className="cr-barra" initial={false} animate={{ width: `${(x.valor / max) * 100}%` }} transition={{ duration: dur, ease: 'linear' }} style={{ background: color[x.id] ?? '#6b7d86' }}>
              <span className="cr-n">{x.nombre}</span>
            </motion.div>
            <span className="cr-v">{fmt(x.valor)}</span>
          </div>
        </motion.div>
      ))}
    </div>
  </figure>
}
