import { useMemo, useState } from 'react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { useInView, useWidth } from '../graficos/util'
import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
import type { Feature, MultiPolygon } from 'geojson'
import { PROVINCIAS } from './provincias'

/** Une provincias en regiones (p. ej. comunidades) para pintar el dato al nivel al que existe, sin fronteras internas. */
const topo = topology({ p: PROVINCIAS as never })
const cacheGrupos = new Map<string, Feature<MultiPolygon, { id: string; n: string }>[]>()
export function unir(grupo: (cod: string) => string | null, clave: string) {
  if (cacheGrupos.has(clave)) return cacheGrupos.get(clave)!
  const geoms = (topo.objects.p as unknown as { geometries: { properties: { id: string } }[] }).geometries
  const ids = [...new Set(geoms.map(g => grupo(g.properties.id)).filter((x): x is string => !!x))]
  const out = ids.map(id => ({ type: 'Feature' as const, properties: { id, n: id }, geometry: merge(topo as never, geoms.filter(g => grupo(g.properties.id) === id) as never) as MultiPolygon }))
  cacheGrupos.set(clave, out); return out
}
/** Escala «cuanto más, peor»: de apagado (casi el fondo) a rojo oscuro pasando por oro y naranja. */
export const ESCALA_CALOR = ['#24434b', '#ffd166', '#f08c3a', '#d9412b', '#8f0f1e']
export const colorEscala = (stops: string[], f: number) => mezcla(stops, f)
function mezcla(stops: string[], f: number) {
  const x = Math.max(0, Math.min(1, f)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), k = x - i
  const a = stops[i].match(/\w\w/g)!.map(h => parseInt(h, 16)), b = stops[i + 1].match(/\w\w/g)!.map(h => parseInt(h, 16))
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`
}
import './mapa-provincias.css'

/**
 * Mapa de provincias en SVG (sin teselas): cada provincia se pinta según su valor con una sola tinta (de tenue a intensa)
 * o, si `divergente`, con dos tintas alrededor de cero. Las provincias aparecen una tras otra de oeste a este
 * con una animación CSS (si no puede correr, el mapa se ve igual: la animación solo parte de transparente).
 */
export function MapaProvincias({ valor, fmt, titulo, color, divergente, sel, onSel, nota, grupo, claveGrupo = 'g', escala }: {
  valor: (cod: string) => number | null; fmt: (v: number) => string; titulo: string; color: string; divergente?: [string, string]
  sel?: string | null; onSel?: (cod: string | null) => void; nota?: string
  /** si el dato es de comunidad (u otra región), cada provincia → su región: se pintan las regiones enteras y `valor` recibe la región */
  grupo?: (cod: string) => string | null; claveGrupo?: string
  /** paradas de color para una escala secuencial propia (de menos a más) */
  escala?: string[]
}) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [tip, setTip] = useState<{ x: number; y: number; cod: string } | null>(null)
  const H = Math.round(W * 0.74)
  const { path } = useMemo(() => ({ path: geoPath(geoConicConformalSpain().fitExtent([[6, 6], [W - 6, H - 6]], PROVINCIAS)) }), [W, H])
  const feats = useMemo(() => grupo ? unir(grupo, claveGrupo) : PROVINCIAS.features, [grupo, claveGrupo])
  const vals = feats.map(f => valor(f.properties.id)).filter((v): v is number => v != null)
  const lo = Math.min(...vals), hi = Math.max(...vals), amp = Math.max(Math.abs(lo), Math.abs(hi)) || 1
  const relleno = (v: number | null) => {
    if (v == null) return { fill: 'rgba(160,220,240,.05)' }
    if (divergente) return { fill: v >= 0 ? divergente[1] : divergente[0], fillOpacity: 0.15 + (Math.abs(v) / amp) * 0.8 }
    if (escala) return { fill: mezcla(escala, (v - lo) / (hi - lo || 1)) }
    return { fill: color, fillOpacity: 0.12 + ((v - lo) / (hi - lo || 1)) * 0.85 }
  }
  const orden = useMemo(() => new Map(feats.map(f => [f.properties.id, path.centroid(f as never)[0]] as const)), [path, feats])
  const nombre = (cod: string) => feats.find(f => f.properties.id === cod)?.properties.n ?? cod
  return (
    <figure className={`mp ${seen ? 'is-seen' : ''}`} ref={view}>
      <div className="mp-plot" ref={wrap} style={{ height: H }} onPointerLeave={e => e.pointerType !== 'touch' && setTip(null)}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={titulo}>
          {feats.map(f => {
            const cod = f.properties.id, v = valor(cod)
            return <path key={cod} d={path(f as never) ?? ''} className={`mp-prov mp-area ${sel === cod ? 'is-sel' : ''} ${v != null ? 'has-v' : ''}`}
              style={{ ...relleno(v), animationDelay: `${(((orden.get(cod) ?? 0) / Math.max(1, W)) * 0.8).toFixed(2)}s` }}
              onPointerMove={e => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, cod }) }}
              onClick={() => onSel?.(sel === cod ? null : cod)} />
          })}
          {/* Ceuta y Melilla son tan pequeñas que no se ven: se marcan con un círculo que también se puede tocar */}
          {feats.filter(f => /^(51|52)$/.test(f.properties.id) || ['Ceuta', 'Melilla'].includes(f.properties.id)).map(f => {
            const cod = f.properties.id, v = valor(cod), [cx, cy] = path.centroid(f as never)
            if (!isFinite(cx)) return null
            return <g key={'ciudad' + cod} className={`mp-ciudad ${sel === cod ? 'is-sel' : ''}`} onClick={() => onSel?.(sel === cod ? null : cod)}
              onPointerMove={e => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, cod }) }}>
              <circle cx={cx} cy={cy} r={Math.max(5, W / 110)} className="mp-prov has-v" style={relleno(v)} />
              <text x={cx + Math.max(8, W / 80)} y={cy + 4} className="mp-ciudad-n">{f.properties.n}</text>
            </g>
          })}
        </svg>}
        {tip && <div className="mp-tip" style={{ left: Math.min(W - 170, tip.x + 12), top: tip.y + 12 }} role="status"><strong>{nombre(tip.cod)}</strong><span>{valor(tip.cod) != null ? fmt(valor(tip.cod)!) : 'Sin dato'}</span></div>}
      </div>
      {vals.length > 0 && <figcaption className="mp-ley">
        <span>{fmt(divergente ? -amp : lo)}</span>
        <i style={{ background: divergente ? `linear-gradient(90deg, ${divergente[0]}, rgba(160,220,240,.15), ${divergente[1]})` : escala ? `linear-gradient(90deg, ${escala.join(', ')})` : `linear-gradient(90deg, color-mix(in oklab, ${color} 15%, transparent), ${color})` }} />
        <span>{fmt(divergente ? amp : hi)}</span>
        {nota && <small>{nota}</small>}
      </figcaption>}
    </figure>
  )
}
