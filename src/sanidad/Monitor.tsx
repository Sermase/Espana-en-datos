import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { nf } from '../graficos'
import { useInView, useWidth } from '../graficos/util'

export type Latido = { s: string; v: number; media: number }

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** Lunes de una semana ISO («2026-W44»). */
export function lunes(s: string) {
  const y = +s.slice(0, 4), w = +s.slice(6), e = new Date(Date.UTC(y, 0, 4)), d = (e.getUTCDay() + 6) % 7
  return new Date(Date.UTC(y, 0, 4 - d + (w - 1) * 7))
}
export const semanaLarga = (s: string) => {
  const a = lunes(s), b = new Date(a.getTime() + 6 * 864e5)
  return `${a.getUTCDate()} ${MES[a.getUTCMonth()]} – ${b.getUTCDate()} ${MES[b.getUTCMonth()]} ${b.getUTCFullYear()}`
}

/**
 * El monitor: cada semana es un latido, y su pico sube con las muertes de esa semana frente a lo normal para esa
 * época del año (la media de 2015 a 2019). Los latidos por encima de lo normal en más de un 10 % salen en rojo.
 * La línea se dibuja como en un monitor de hospital; al tocar un latido, su semana.
 */
export function Monitor({ semanas, acento }: { semanas: Latido[]; acento: string }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, visto] = useInView<HTMLDivElement>()
  const reduce = useReducedMotion()
  const n = W && W < 560 ? 26 : 52
  const datos = semanas.slice(-n)
  const [sel, setSel] = useState<number | null>(null)
  const H = 190, base = 128, paso = W / Math.max(1, datos.length)
  const alto = (r: number) => Math.max(14, Math.min(118, 18 + (r - .8) * 260))
  const tramos = datos.map((d, i) => {
    const x0 = i * paso, r = d.v / d.media, h = alto(r), u = paso / 20
    const p = `M${x0} ${base}h${u * 4}q${u * 1.5} -9 ${u * 3} 0h${u * 2}l${u * .8} 7l${u * 1.4} ${-h - 7}l${u * 1.6} ${h + 20}l${u} -13h${u * 1.6}q${u * 2} -14 ${u * 4} 0H${x0 + paso}`
    return { p, r, alto: r >= 1.1 }
  })
  const k = sel ?? datos.length - 1, d = datos[k], r = d ? d.v / d.media : 1
  const largo = Math.max(1, W * 2.4)
  return <div className="mon" ref={view}>
    <div className="mon-lectura" role="status">
      <span className="mon-k">{sel == null ? 'Última semana con datos' : 'Semana elegida'} · {d && semanaLarga(d.s)}</span>
      <b className={r >= 1.1 ? 'is-alto' : ''}>{d ? nf(d.v, 0) : '—'}</b>
      <span>muertes · <em className={r >= 1.1 ? 'is-alto' : r < 1 ? 'is-bajo' : ''}>{r >= 1 ? '+' : '−'}{nf(Math.abs(r - 1) * 100, 0)} %</em> frente a lo normal ({d ? nf(d.media, 0) : '—'})</span>
    </div>
    <div ref={wrap} className="mon-pant" style={{ height: H }}>
      {W > 0 && <svg width={W} height={H} role="img" aria-label={`Muertes de las últimas ${datos.length} semanas frente a la media de 2015 a 2019`}>
        <defs><filter id="mon-brillo"><feGaussianBlur stdDeviation="2.2" /></filter></defs>
        {Array.from({ length: Math.ceil(W / 24) }, (_, i) => <line key={'v' + i} className="mon-grid" x1={i * 24} x2={i * 24} y1={0} y2={H} />)}
        {Array.from({ length: Math.ceil(H / 24) }, (_, i) => <line key={'h' + i} className="mon-grid" x1={0} x2={W} y1={i * 24} y2={i * 24} />)}
        <g className={visto && !reduce ? 'mon-traza is-on' : 'mon-traza'} style={{ ['--largo' as string]: largo }}>
          {tramos.map((t, i) => <path key={i} d={t.p} className={t.alto ? 'is-alto' : ''} style={{ stroke: t.alto ? acento : undefined, opacity: sel != null && sel !== i ? .35 : 1, animationDelay: `${(i / tramos.length) * 2.6}s` }} />)}
          {tramos.map((t, i) => t.alto ? <path key={'b' + i} d={t.p} className="mon-halo" style={{ stroke: acento, animationDelay: `${(i / tramos.length) * 2.6}s` }} filter="url(#mon-brillo)" /> : null)}
        </g>
        {d && <circle className="mon-punto" cx={(k + 1) * paso - 1} cy={base} r={3.5} />}
        {datos.map((x, i) => <rect key={x.s} x={i * paso} y={0} width={paso} height={H} fill="transparent" className="mon-hit"
          onPointerDown={() => setSel(s => (s === i ? null : i))} onPointerEnter={e => e.pointerType === 'mouse' && setSel(i)} onPointerLeave={e => e.pointerType === 'mouse' && setSel(null)}>
          <title>{semanaLarga(x.s)}: {nf(x.v, 0)} muertes</title>
        </rect>)}
        {sel != null && <line className="mon-sel" x1={(sel + .5) * paso} x2={(sel + .5) * paso} y1={0} y2={H} />}
      </svg>}
    </div>
    <p className="mon-pie">{datos[0] && semanaLarga(datos[0].s).split(' – ')[0]} {datos[0] && lunes(datos[0].s).getUTCFullYear()} → {d && semanaLarga(datos.at(-1)!.s).split(' – ')[1]}. En rojo, las semanas con más de un 10 % de muertes por encima de lo normal.</p>
  </div>
}
