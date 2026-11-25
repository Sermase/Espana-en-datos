import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useInView } from './util'

export type Fotograma = { t: string; items: { id: string; nombre: string; valor: number }[] }
const PALETA = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767']

/**
 * Carrera de barras: el ranking de cada periodo, uno tras otro. Las barras se reordenan deslizándose y la etiqueta del
 * periodo crece al fondo. Arranca sola al verse (salvo con menos movimiento, que enseña el último periodo) y se puede
 * parar, volver a empezar o mover con la barra de tiempo. Tocar una barra la «sigue»: se queda iluminada y se
 * cuenta su puesto en cada periodo, aunque salga del ranking.
 */
export function Carrera({ fotogramas, top = 10, fmt, titulo, colores, ms = 1300, alto = 30 }: {
  fotogramas: Fotograma[]; top?: number; fmt: (v: number) => string; titulo: string; colores?: Record<string, string>; ms?: number; alto?: number
}) {
  const reduce = useReducedMotion()
  const [ref, visto] = useInView<HTMLDivElement>()
  const [i, setI] = useState(reduce ? fotogramas.length - 1 : 0)
  const [play, setPlay] = useState(false), arrancado = useRef(false), [sigue, setSigue] = useState<string | null>(null)
  useEffect(() => { if (visto && !reduce && !arrancado.current) { arrancado.current = true; setPlay(true) } }, [visto, reduce])
  useEffect(() => {
    if (!play) return
    if (i >= fotogramas.length - 1) { setPlay(false); return }
    const t = setTimeout(() => setI(i + 1), ms); return () => clearTimeout(t)
  }, [play, i, fotogramas.length, ms])
  const color = useMemo(() => {
    // Los 8 que más tiempo pasan en cabeza llevan cada uno su color; el resto, gris (el nombre va en la barra).
    const peso = new Map<string, number>()
    for (const f of fotogramas) [...f.items].sort((a, b) => b.valor - a.valor).slice(0, top).forEach((x, k) => peso.set(x.id, (peso.get(x.id) ?? 0) + top - k))
    const ids = [...peso.keys()].sort((a, b) => peso.get(b)! - peso.get(a)!)
    return Object.fromEntries(ids.map((id, k) => [id, colores?.[id] ?? PALETA[k] ?? '#5b6b74']))
  }, [fotogramas, top, colores])
  const f = fotogramas[i], filas = [...f.items].sort((a, b) => b.valor - a.valor).slice(0, top), max = filas[0]?.valor || 1
  const dur = reduce ? 0 : (ms / 1000) * 0.85
  const todos = [...f.items].sort((a, b) => b.valor - a.valor), ks = sigue ? todos.findIndex(x => x.id === sigue) : -1, xs = ks >= 0 ? todos[ks] : null
  const nombreSigue = sigue ? fotogramas.flatMap(g => g.items).find(x => x.id === sigue)?.nombre : null
  return <figure className="carrera" ref={ref} aria-label={titulo}>
    <div className="cr-ctl">
      <button onClick={() => { if (i >= fotogramas.length - 1) setI(0); setPlay(!play) }} aria-label={play ? 'Pausar' : 'Reproducir'}>{play ? <Pause size={15} /> : i >= fotogramas.length - 1 ? <RotateCcw size={15} /> : <Play size={15} />}</button>
      <input type="range" min={0} max={fotogramas.length - 1} value={i} onChange={e => { setPlay(false); setI(+e.target.value) }} aria-label="Periodo" />
      <span>{f.t}</span>
    </div>
    {sigue && <p className="cr-sigue" role="status"><i style={{ background: color[sigue] ?? '#6b7d86' }} /><span>Sigues a <b>{nombreSigue}</b>: {xs ? <>puesto {ks + 1} en {f.t}, {fmt(xs.valor)}{ks >= top && ' (fuera del ranking)'}</> : <>sin dato en {f.t}</>}</span><button onClick={() => setSigue(null)} aria-label="Dejar de seguir">✕</button></p>}
    <div className={`cr-pista ${sigue ? 'is-sigue' : ''}`} style={{ height: top * alto }} role="group" aria-label={`${titulo}, ${f.t}: ${filas.map((x, k) => `${k + 1}. ${x.nombre}, ${fmt(x.valor)}`).join('; ')}`}>
      <div className="cr-marca" aria-hidden>{f.t}</div>
      {filas.map((x, k) => (
        <motion.div key={x.id} className={`cr-fila ${sigue === x.id ? 'is-sigue' : ''}`} onClick={() => setSigue(sigue === x.id ? null : x.id)} role="button" tabIndex={0} aria-pressed={sigue === x.id} aria-label={`Seguir a ${x.nombre}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSigue(sigue === x.id ? null : x.id) } }} initial={false} animate={{ y: k * alto }} transition={{ duration: dur, ease: 'easeInOut' }} style={{ height: alto - 6 }}>
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
