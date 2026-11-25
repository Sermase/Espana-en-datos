import { useState } from 'react'
import { motion } from 'motion/react'
import { nf } from '../graficos'
import { useInView, useWidth } from '../graficos/util'

export type Vida = { id: string; nombre: string; color: string; nacer: number; a65: number | null; ue: number | null; antes: number | null }

/**
 * La línea de la vida: una barra por sexo que crece hasta los años que se viven de media al nacer. Por delante, en
 * claro, lo que se llega a vivir si se cumplen los 65; una marca para la media de la UE y otra para cómo era en el
 * primer año de la serie. Al tocar una fila, su frase.
 */
export function LineaVida({ filas, desde }: { filas: Vida[]; desde: string }) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, visto] = useInView<HTMLDivElement>()
  const [sel, setSel] = useState<string | null>(null)
  const L = 8, R = 46, MAX = 95, fila = 58
  const x = (a: number) => L + (a / MAX) * Math.max(10, W - L - R)
  const H = filas.length * fila + 26
  const f = filas.find(v => v.id === sel)
  return <div className="lv" ref={view}>
    <div ref={wrap} style={{ height: H }}>
      {W > 0 && <svg width={W} height={H} role="img" aria-label={`Esperanza de vida al nacer: ${filas.map(v => `${v.nombre} ${nf(v.nacer, 1)} años`).join(', ')}`}>
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(a => <g key={a}>
          <line className="lv-grid" x1={x(a)} x2={x(a)} y1={4} y2={H - 20} />
          <text className="g-ax" x={x(a)} y={H - 6} textAnchor="middle">{a}</text>
        </g>)}
        <line className="lv-65" x1={x(65)} x2={x(65)} y1={4} y2={H - 20} />
        <text className="lv-65t" x={x(65) + 4} y={14}>65</text>
        {filas.map((v, i) => {
          const y = 18 + i * fila, h = 22, fin = v.a65 != null ? 65 + v.a65 : null, on = !sel || sel === v.id
          return <g key={v.id} className="lv-fila" style={{ opacity: on ? 1 : .35 }} role="button" tabIndex={0} aria-pressed={sel === v.id}
            onClick={() => setSel(s => (s === v.id ? null : v.id))} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(s => (s === v.id ? null : v.id)) } }}>
            <rect x={0} y={y - 14} width={W} height={fila - 6} fill="transparent" />
            <text className="lv-n" x={x(0) + 2} y={y - 4}>{v.nombre}</text>
            {fin != null && <motion.rect className="lv-mas" x={x(0)} y={y + 4} height={h - 8} rx={3} style={{ fill: v.color }} initial={{ width: 0 }} animate={{ width: visto ? x(fin) - x(0) : 0 }} transition={{ duration: 1.6, delay: .5 + i * .15, ease: [0.2, 0.8, 0.2, 1] }} />}
            <motion.rect x={x(0)} y={y} height={h} rx={4} style={{ fill: v.color }} initial={{ width: 0 }} animate={{ width: visto ? x(v.nacer) - x(0) : 0 }} transition={{ duration: 1.4, delay: i * .15, ease: [0.2, 0.8, 0.2, 1] }} />
            {v.antes != null && <motion.line className="lv-antes" x1={x(v.antes)} x2={x(v.antes)} y1={y - 3} y2={y + h + 3} initial={{ opacity: 0 }} animate={{ opacity: visto ? 1 : 0 }} transition={{ delay: 1.5 }} />}
            {v.ue != null && <motion.path className="lv-ue" d={`M${x(v.ue)} ${y + h + 2}l-4 7h8z`} initial={{ opacity: 0 }} animate={{ opacity: visto ? 1 : 0 }} transition={{ delay: 1.7 }} />}
            <motion.text className="lv-v" x={x(Math.max(v.nacer, fin ?? 0)) + 6} y={y + 16} initial={{ opacity: 0 }} animate={{ opacity: visto ? 1 : 0 }} transition={{ delay: 1.3 + i * .15 }}>{nf(v.nacer, 1)}</motion.text>
          </g>
        })}
      </svg>}
    </div>
    <ul className="lv-ley" aria-hidden>
      <li><i className="lv-k-bar" />Al nacer</li><li><i className="lv-k-mas" />Si llegas a los 65</li><li><i className="lv-k-antes" />En {desde}</li><li><i className="lv-k-ue" />Media de la UE</li>
    </ul>
    <p className="g-toque" role="status">{f ? <>{f.nombre}: al nacer, <b>{nf(f.nacer, 1)} años</b> de media{f.antes != null && <>, {nf(f.nacer - f.antes, 1)} más que en {desde}</>}.{f.a65 != null && <> Quien llega a los 65 vive, de media, otros {nf(f.a65, 1)} años: hasta los <b>{nf(65 + f.a65, 1)}</b>.</>}{f.ue != null && <> En la UE, {nf(f.ue, 1)}.</>}</> : 'Toca una barra para ver su frase.'}</p>
  </div>
}
