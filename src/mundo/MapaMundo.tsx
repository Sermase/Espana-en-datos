import { useEffect, useMemo, useState } from 'react'
import { geoCentroid, geoInterpolate, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useInView, useWidth } from '../graficos/util'
import './mundo.css'

type Props = { a2: string | null; n: string }
let cache: Promise<FeatureCollection<Geometry, Props>> | null = null
/** Comext y Eurostat usan EL para Grecia y UK para Reino Unido; ISO usa GR y GB. */
export const isoDe = (c: string) => (c === 'EL' ? 'GR' : c === 'UK' ? 'GB' : c)
const nombres = new Intl.DisplayNames(['es'], { type: 'region' })
export const nombrePais = (c: string) => { try { return nombres.of(isoDe(c)) ?? c } catch { return c } }

export type Flujo = { pais: string; valor: number }
/**
 * Mapa del mundo de la sala de control: cada país se ilumina según su valor (una sola tinta, de tenue a intensa),
 * y de los principales salen arcos animados hacia España (o desde España, si `sentido` es "sale").
 */
export function MapaMundo({ datos, color, fmt, titulo, rutas = 10, sentido = 'entra', sel, onSel, alto }: {
  datos: Flujo[]; color: string; fmt: (v: number) => string; titulo: string; rutas?: number; sentido?: 'entra' | 'sale'; sel?: string | null; onSel?: (pais: string | null) => void; alto?: number
}) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, Props> | null>(null)
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLDivElement>()
  const [tip, setTip] = useState<{ x: number; y: number; n: string; v?: number } | null>(null)
  useEffect(() => {
    cache ??= fetch('../mundo.json').then(r => r.json()).then(t => feature(t, t.objects.countries) as unknown as FeatureCollection<Geometry, Props>)
    cache.then(setGeo, () => { cache = null })
  }, [])
  const H = alto ?? Math.round(W * 0.52)
  const { path, proj } = useMemo(() => {
    const proj = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' } as never)
    return { proj, path: geoPath(proj) }
  }, [W, H])
  const val = useMemo(() => new Map(datos.map(d => [isoDe(d.pais), d.valor])), [datos])
  const max = Math.max(1, ...datos.map(d => d.valor))
  const top = useMemo(() => [...datos].sort((a, b) => b.valor - a.valor).slice(0, rutas), [datos, rutas])
  const es = proj([-3.7, 40.4])
  const centro = useMemo(() => new Map((geo?.features ?? []).map(f => [f.properties.a2, geoCentroid(f as Feature)])), [geo])
  return (
    <figure className="mm" ref={view}>
      <div className="mm-plot" ref={wrap} style={{ height: H }} onPointerLeave={() => setTip(null)}>
        {W > 0 && geo && <svg width={W} height={H} role="img" aria-label={titulo}>
          <path className="mm-sphere" d={path({ type: 'Sphere' } as never) ?? ''} />
          {geo.features.map((f, i) => {
            const v = f.properties.a2 ? val.get(f.properties.a2) : undefined
            const k = v ? Math.pow(v / max, 0.45) : 0
            return <path key={i} d={path(f) ?? ''} className={`mm-pais ${v ? 'has-v' : ''} ${sel && isoDe(sel) === f.properties.a2 ? 'is-sel' : ''} ${f.properties.a2 === 'ES' ? 'is-es' : ''}`}
              style={v ? { fill: color, fillOpacity: 0.12 + k * 0.78 } : undefined}
              onPointerMove={e => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, n: f.properties.a2 ? nombrePais(f.properties.a2) : f.properties.n, v }) }}
              onClick={() => onSel?.(f.properties.a2 && v ? (sel === f.properties.a2 ? null : f.properties.a2) : null)} />
          })}
          {es && top.map((d, i) => {
            const c = centro.get(isoDe(d.pais)); if (!c || isoDe(d.pais) === 'ES') return null
            const ip = geoInterpolate(c, [-3.7, 40.4]), pts = Array.from({ length: 25 }, (_, k) => proj(ip(k / 24))).filter(Boolean) as [number, number][]
            // arco levantado: se empuja hacia arriba en el centro, más cuanto más lejos
            const lift = Math.min(80, Math.hypot(pts[0][0] - es[0], pts[0][1] - es[1]) * 0.22)
            const dd = pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${(y - Math.sin((k / 24) * Math.PI) * lift).toFixed(1)}`).join('')
            const w = 1 + (d.valor / max) * 3.5
            return <g key={d.pais} className="mm-ruta" style={{ ['--d' as string]: `${i * 0.12}s` }}>
              <path d={dd} className={`mm-arco ${seen ? 'is-on' : ''}`} style={{ stroke: color, strokeWidth: w }} />
              <path d={dd} className={`mm-pulso ${sentido === 'sale' ? 'is-sale' : ''}`} style={{ stroke: '#fff', strokeWidth: Math.max(1.5, w * 0.6), animationDelay: `${i * 0.37}s` }} />
            </g>
          })}
          {es && <g className="mm-es" transform={`translate(${es[0]} ${es[1]})`}><circle r="9" /><circle r="3.5" /></g>}
        </svg>}
        {tip && <div className="mm-tip" style={{ left: Math.min(W - 160, tip.x + 12), top: tip.y + 12 }} role="status"><strong>{tip.n}</strong>{tip.v != null ? <span>{fmt(tip.v)}</span> : <span>Sin datos</span>}</div>}
      </div>
    </figure>
  )
}
