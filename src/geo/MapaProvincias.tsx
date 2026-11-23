import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { useInView, useWidth } from '../graficos/util'
import { PROVINCIAS } from './provincias'
import './mapa-provincias.css'

/**
 * Mapa de provincias en SVG (sin teselas): cada provincia se pinta según su valor con una sola tinta (de tenue a intensa)
 * o, si `divergente`, con dos tintas alrededor de cero. Las provincias aparecen una tras otra de oeste a este.
 */
export function MapaProvincias({ valor, fmt, titulo, color, divergente, sel, onSel, nota }: {
  valor: (cod: string) => number | null; fmt: (v: number) => string; titulo: string; color: string; divergente?: [string, string]
  sel?: string | null; onSel?: (cod: string | null) => void; nota?: string
}) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [tip, setTip] = useState<{ x: number; y: number; cod: string } | null>(null)
  const H = Math.round(W * 0.74)
  const { path } = useMemo(() => ({ path: geoPath(geoConicConformalSpain().fitExtent([[6, 6], [W - 6, H - 6]], PROVINCIAS)) }), [W, H])
  const vals = PROVINCIAS.features.map(f => valor(f.properties.id)).filter((v): v is number => v != null)
  const lo = Math.min(...vals), hi = Math.max(...vals), amp = Math.max(Math.abs(lo), Math.abs(hi)) || 1
  const relleno = (v: number | null) => {
    if (v == null) return { fill: 'rgba(160,220,240,.05)' }
    if (divergente) return { fill: v >= 0 ? divergente[1] : divergente[0], fillOpacity: 0.15 + (Math.abs(v) / amp) * 0.8 }
    return { fill: color, fillOpacity: 0.12 + ((v - lo) / (hi - lo || 1)) * 0.85 }
  }
  const orden = useMemo(() => new Map([...PROVINCIAS.features].map(f => [f.properties.id, path.centroid(f)[0]] as const)), [path])
  const nombre = (cod: string) => PROVINCIAS.features.find(f => f.properties.id === cod)?.properties.n ?? cod
  return (
    <figure className="mp" ref={view}>
      <div className="mp-plot" ref={wrap} style={{ height: H }} onPointerLeave={() => setTip(null)}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo}>
          {PROVINCIAS.features.map(f => {
            const cod = f.properties.id, v = valor(cod)
            return <motion.path key={cod} d={path(f) ?? ''} className={`mp-prov ${sel === cod ? 'is-sel' : ''} ${v != null ? 'has-v' : ''}`} style={relleno(v)}
              initial={{ opacity: 0 }} animate={{ opacity: seen ? 1 : 0 }} transition={{ duration: .5, delay: ((orden.get(cod) ?? 0) / Math.max(1, W)) * 0.8 }}
              onPointerMove={e => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, cod }) }}
              onClick={() => onSel?.(sel === cod ? null : cod)} />
          })}
        </svg>}
        {tip && <div className="mp-tip" style={{ left: Math.min(W - 170, tip.x + 12), top: tip.y + 12 }} role="status"><strong>{nombre(tip.cod)}</strong><span>{valor(tip.cod) != null ? fmt(valor(tip.cod)!) : 'Sin dato'}</span></div>}
      </div>
      {vals.length > 0 && <figcaption className="mp-ley">
        <span>{fmt(divergente ? -amp : lo)}</span>
        <i style={{ background: divergente ? `linear-gradient(90deg, ${divergente[0]}, rgba(160,220,240,.15), ${divergente[1]})` : `linear-gradient(90deg, color-mix(in oklab, ${color} 15%, transparent), ${color})` }} />
        <span>{fmt(divergente ? amp : hi)}</span>
        {nota && <small>{nota}</small>}
      </figcaption>}
    </figure>
  )
}
