import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import { nf, reduced, useInView, useWidth } from './util'

export type Piramides = Record<string, { h: number[]; m: number[] }>
const HOMBRES = '#3987e5', MUJERES = '#d95926' // huecos 1 y 2 de la paleta categórica validada para fondo oscuro

/**
 * Pirámide de población por tramos de 5 años que se mueve año a año.
 * Al aparecer arranca sola desde el primer año; el control permite pararla y elegir año.
 * La silueta fina es el año de comparación (el primero de la serie).
 */
export function Piramide({ datos, titulo }: { datos: Piramides; titulo: string }) {
  const años = useMemo(() => Object.keys(datos).map(Number).sort((a, b) => a - b), [datos])
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [i, setI] = useState(años.length - 1)
  const [play, setPlay] = useState(false)
  const started = useRef(false)
  // la primera vez que se ve, recorre la historia entera
  useEffect(() => { if (seen && !started.current && !reduced()) { started.current = true; setI(0); setPlay(true) } }, [seen])
  useEffect(() => {
    if (!play) return
    const t = setInterval(() => setI(x => { if (x >= años.length - 1) { setPlay(false); return x } return x + 1 }), 260)
    return () => clearInterval(t)
  }, [play, años.length])

  const group = (a: number[]) => Array.from({ length: 21 }, (_, g) => a.slice(g * 5, g === 20 ? 101 : g * 5 + 5).reduce((t, v) => t + v, 0))
  const all = useMemo(() => Object.fromEntries(años.map(y => [y, { h: group(datos[y].h), m: group(datos[y].m) }])), [años, datos])
  const max = useMemo(() => Math.max(...años.flatMap(y => [...all[y].h, ...all[y].m])), [años, all])
  const y = años[i], cur = all[y], base = all[años[0]]
  const tot = cur.h.reduce((t, v) => t + v, 0) + cur.m.reduce((t, v) => t + v, 0)
  const ages = datos[y]
  const media = (ages.h.reduce((t, v, a) => t + v * (a + 0.5), 0) + ages.m.reduce((t, v, a) => t + v * (a + 0.5), 0)) / tot
  const mayores = (ages.h.slice(65).reduce((t, v) => t + v, 0) + ages.m.slice(65).reduce((t, v) => t + v, 0)) / tot

  const H = 21 * 15 + 26, mid = W / 2, gap = 30, half = Math.max(10, W / 2 - gap - 6)
  const row = (g: number) => 6 + (20 - g) * 15
  const w = (v: number) => (v / max) * half
  const ghost = (side: 'h' | 'm') => {
    const sgn = side === 'h' ? -1 : 1, x0 = mid + sgn * gap
    // contorno escalonado: sube por el borde de cada tramo y pasa al siguiente en horizontal
    return 'M' + base[side].map((v, g) => `${(x0 + sgn * w(v)).toFixed(1)} ${row(g) + 14}L${(x0 + sgn * w(v)).toFixed(1)} ${row(g) - 1}`).join('L')
  }
  return (
    <figure className="g-fig g-pyr" ref={view}>
      <ul className="g-legend"><li><i style={{ background: HOMBRES, height: 8 }} />Hombres</li><li><i style={{ background: MUJERES, height: 8 }} />Mujeres</li><li><i className="is-ghost" />{años[0]}</li></ul>
      <div className="g-pyr-read" aria-live="polite">
        <b>{y}</b>
        <span><strong>{nf(tot / 1e6, 1)} M</strong> habitantes</span>
        <span><strong>{nf(media, 1)}</strong> años de media</span>
        <span><strong>{nf(mayores * 100, 1)} %</strong> con 65 o más</span>
      </div>
      <div className="g-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={`${titulo}, ${y}`}>
          {cur.h.map((v, g) => <g key={g}>
            <motion.rect y={row(g)} height={13} rx={3} fill={HOMBRES} initial={false} animate={{ x: mid - gap - w(v), width: w(v) }} transition={{ duration: play ? .24 : .5, ease: 'linear' }} />
            <motion.rect x={mid + gap} y={row(g)} height={13} rx={3} fill={MUJERES} initial={false} animate={{ width: w(cur.m[g]) }} transition={{ duration: play ? .24 : .5, ease: 'linear' }} />
            {g % 2 === 0 && <text className="g-ax" x={mid} y={row(g) + 10} textAnchor="middle">{g === 20 ? '100+' : g * 5}</text>}
          </g>)}
          {años.length > 1 && <><path d={ghost('h')} className="g-ghost" /><path d={ghost('m')} className="g-ghost" /></>}
          <text className="g-ax" x={mid} y={H - 4} textAnchor="middle">edad</text>
        </svg>}
      </div>
      <div className="g-time">
        <button type="button" onClick={() => { if (i >= años.length - 1) setI(0); setPlay(p => !p) }} aria-label={play ? 'Pausar' : 'Reproducir la evolución'}>{play ? <Pause size={16} /> : <Play size={16} />}</button>
        <input type="range" min={0} max={años.length - 1} value={i} onChange={e => { setPlay(false); setI(Number(e.target.value)) }} aria-label="Año" />
        <span>{años[0]}–{años[años.length - 1]}</span>
      </div>
    </figure>
  )
}
