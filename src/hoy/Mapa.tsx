import { useMemo } from 'react'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { geoPath } from 'd3-geo'
import { PROVINCIAS } from '../geo/provincias'
import { useInView, useWidth } from '../graficos/util'
import { nf } from '../graficos'

export type Sismo = { t: string; m: number; lugar: string; lat: number; lon: number; url: string }
export type Ciudad = { cod: string; n: string; ahora: number | null; media: number | null; max: number | null; min: number | null; normal: number | null; anom: number | null }

export const FRIO = '#3987e5', CALOR = '#d95926', SISMO = '#ff5fd2'
const HORA = 3600e3

/** Solo se dibuja lo que cae sobre España: la península y Baleares, y el recuadro de Canarias. Lo demás (mar abierto, Marruecos, Argelia, Portugal) va en la lista. */
export const enMapa = (s: { lat: number; lon: number }) => (s.lat >= 35.2 && s.lat <= 44.2 && s.lon >= -10 && s.lon <= 5.2) || (s.lat >= 27.3 && s.lat <= 29.6 && s.lon >= -18.6 && s.lon <= -13.2)
const MENOR = new Set(['DE', 'DEL', 'LA', 'EL', 'LAS', 'LOS', 'Y', 'EN']), PUNTOS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NNE', 'NNW', 'SSE', 'SSW', 'ENE', 'ESE', 'WNW', 'WSW'])
/** Nombres del IGN en MAYÚSCULAS («SW CABO DE SAN VICENTE») → «SW Cabo de San Vicente». */
export const lugarBonito = (t: string) => t.split(' ').map((w, i) => w.split('-').map(x => PUNTOS.has(x) ? x : (i > 0 && MENOR.has(x)) ? x.toLowerCase() : x.charAt(0) + x.slice(1).toLowerCase()).join('-')).join(' ')

/** Antigüedad del sismo → opacidad: lo de hoy brilla, lo de hace días se apaga. */
export const opacidad = (t: string, ahora: number) => { const h = (ahora - Date.parse(t)) / HORA; return h < 24 ? 0.95 : h < 72 ? 0.6 : 0.32 }
export const radio = (m: number) => 2.5 + Math.max(0, m) * 2.3

/**
 * España de provincias en SVG. Capa «temp»: cada provincia se tiñe con la desviación de la temperatura de hoy en su capital frente a lo normal.
 * Capa «sismos»: el mapa se apaga y los terremotos aparecen como círculos (tamaño = magnitud, brillo = lo recientes que son).
 */
export function Mapa({ capa, ciudades, sismos, ahora, sel, onSel, selCiudad, onCiudad }: {
  capa: 'temp' | 'sismos'; ciudades: Ciudad[]; sismos: Sismo[]; ahora: number
  sel: string | null; onSel: (t: string | null) => void; selCiudad: string | null; onCiudad: (c: string | null) => void
}) {
  const [wrap, W] = useWidth<HTMLDivElement>()
  const [view, seen] = useInView<HTMLElement>()
  const H = Math.round(W * 0.76)
  const proj = useMemo(() => geoConicConformalSpain().fitExtent([[6, 6], [W - 6, H - 6]], PROVINCIAS), [W, H])
  const path = useMemo(() => geoPath(proj), [proj])
  const por = useMemo(() => new Map(ciudades.map(c => [c.cod, c])), [ciudades])
  const amp = Math.max(5, Math.ceil(Math.max(0, ...ciudades.map(c => Math.abs(c.anom ?? 0)))))
  const relleno = (cod: string) => {
    if (capa !== 'temp') return { fill: 'rgba(160,220,240,.07)' }
    const v = por.get(cod)?.anom
    if (v == null) return { fill: 'rgba(160,220,240,.05)' }
    return { fill: v >= 0 ? CALOR : FRIO, fillOpacity: 0.12 + (Math.min(Math.abs(v), amp) / amp) * 0.8 }
  }
  const puntos = useMemo(() => capa === 'sismos' ? [...sismos].filter(enMapa).sort((a, b) => b.m - a.m).map(s => ({ s, p: proj([s.lon, s.lat]) })).filter((x): x is { s: Sismo; p: [number, number] } => !!x.p) : [], [capa, sismos, proj])
  return (
    <figure className={`hmapa ${seen ? 'is-seen' : ''}`} ref={view}>
      <div className="hmapa-plot" ref={wrap} style={{ height: H }}>
        {W > 0 && <svg width={W} height={H} role="img" aria-label={capa === 'temp' ? 'Temperatura de hoy frente a lo normal, por provincia' : 'Terremotos de los últimos días'}>
          {PROVINCIAS.features.map(f => {
            const cod = f.properties.id
            return <path key={cod} d={path(f as never) ?? ''} className={`hm-prov ${capa === 'temp' ? 'es-temp' : ''} ${selCiudad === cod ? 'is-sel' : ''}`} style={relleno(cod)}
              onClick={() => capa === 'temp' && onCiudad(selCiudad === cod ? null : cod)}>
              {capa === 'temp' && por.get(cod) && <title>{`${por.get(cod)!.n}: ${por.get(cod)!.anom != null ? (por.get(cod)!.anom! > 0 ? '+' : '') + nf(por.get(cod)!.anom!, 1) + ' °C frente a lo normal' : 'sin dato'}`}</title>}
            </path>
          })}
          {capa === 'temp' && ['51', '52'].map(cod => {
            const f = PROVINCIAS.features.find(x => x.properties.id === cod); if (!f) return null
            const [cx, cy] = path.centroid(f as never); if (!isFinite(cx)) return null
            return <g key={cod} className={`hm-ciudad ${selCiudad === cod ? 'is-sel' : ''}`} onClick={() => onCiudad(selCiudad === cod ? null : cod)}>
              <circle cx={cx} cy={cy} r={Math.max(5, W / 110)} style={relleno(cod)} /><text x={cx + 9} y={cy + 4}>{f.properties.n}</text>
            </g>
          })}
          {puntos.map(({ s, p }, k) => {
            const reciente = ahora - Date.parse(s.t) < 24 * HORA, on = sel === s.t
            return <g key={s.t + k} className={`hm-sismo ${on ? 'is-sel' : ''}`} onClick={() => onSel(on ? null : s.t)} transform={`translate(${p[0]},${p[1]})`}>
              {reciente && s.m >= 3 && <circle r={radio(s.m)} className="hm-onda" style={{ animationDelay: `${(k % 5) * 0.4}s` }} />}
              <circle r={radio(s.m)} fill={SISMO} fillOpacity={opacidad(s.t, ahora)} className="hm-pto" />
              <circle r={Math.max(12, radio(s.m) + 6)} fill="transparent" />
              <title>{`M ${nf(s.m, 1)} · ${lugarBonito(s.lugar)}`}</title>
            </g>
          })}
        </svg>}
      </div>
      {capa === 'temp'
        ? <div className="hm-ley"><span>Más fría de lo normal</span><i style={{ background: `linear-gradient(90deg, ${FRIO}, rgba(160,220,240,.12) 50%, ${CALOR})` }} /><span>Más cálida</span><small>De −{amp} a +{amp} °C. Toca una provincia para ver su capital.</small></div>
        : <div className="hm-ley"><span>Tamaño: magnitud</span><i className="hm-escala"><b style={{ opacity: .32 }} /><b style={{ opacity: .6 }} /><b style={{ opacity: .95 }} /></i><span>Brillo: más reciente</span><small>Brillante, últimas 24 h · medio, 3 días · tenue, 10 días.</small></div>}
    </figure>
  )
}
