import { useEffect, useMemo, useRef, useState } from 'react'
import { geoIdentity, geoPath } from 'd3-geo'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cuandoVisible, fondo } from '../mapa-base'
import { unir } from '../geo/MapaProvincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { consumo, fmt } from './data'
import { aggList, c1Color, edarList, TRATAMIENTO, useEdar } from './edar'
import { resolve, type Sel } from './sel'

/**
 * Mapa de calles para las capas de saneamiento: depuradoras y núcleos urbanos sobre el plano real,
 * con todo el territorio (Canarias, Ceuta y Melilla incluidas) y botones para saltar a cada zona.
 */
const ZONAS: [string, L.LatLngBoundsExpression][] = [
  ['Península', [[35.9, -9.4], [43.85, 4.4]]], ['Baleares', [[38.6, 1.1], [40.15, 4.4]]], ['Canarias', [[27.6, -18.2], [29.5, -13.3]]],
  ['Ceuta', [[35.86, -5.38], [35.92, -5.27]]], ['Melilla', [[35.26, -2.97], [35.32, -2.92]]],
]
const COL_T = ['#ffb02e', '#ffb02e', '#3fe6ff', '#3df5b0']
const isPhone = () => window.innerWidth < 980
type RegFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>
const reuMax = Math.max(1, ...consumo.regions.map(u => u.reusePct ?? 0))
/** NUTS 2 → nombre de comunidad del mapa */
const NUTS: Record<string, string> = { ES11: 'Galicia', ES12: 'Principado de Asturias', ES13: 'Cantabria', ES21: 'País Vasco', ES22: 'Comunidad Foral de Navarra', ES23: 'La Rioja', ES24: 'Aragón', ES30: 'Comunidad de Madrid', ES41: 'Castilla y León', ES42: 'Castilla-La Mancha', ES43: 'Extremadura', ES51: 'Cataluña', ES52: 'Comunitat Valenciana', ES53: 'Illes Balears', ES61: 'Andalucía', ES62: 'Región de Murcia', ES63: 'Ceuta y Melilla', ES64: 'Ceuta y Melilla', ES70: 'Canarias' }
/** Zoom a partir del que se ven los puntos uno a uno; de lejos, solo las comunidades con su cifra. */
const CERCA = 7.4
/** «12 %», «0,4 %»; en alcantarillado, «>99,9 %» si casi llega pero no del todo */
const etq = (v: number, layer: string) => layer === 'depuracion' ? `${fmt(v, v < 10 ? 1 : 0)} %` : v < 100 && v >= 99.95 ? '>99,9 %' : `${fmt(v, 1)} %`
// Comunidades hechas uniendo las 52 provincias, con Canarias, Ceuta y Melilla (el contorno viejo no las tenía)
const LARGO: Record<string, string> = { 'Asturias': 'Principado de Asturias', 'Illes Balears': 'Illes Balears', 'Madrid': 'Comunidad de Madrid', 'Murcia': 'Región de Murcia', 'Navarra': 'Comunidad Foral de Navarra', 'C. Valenciana': 'Comunitat Valenciana', 'Ceuta': 'Ceuta y Melilla', 'Melilla': 'Ceuta y Melilla' }
const REGIONES: RegFC = { type: 'FeatureCollection', features: unir(c => { const r = CCAA_DE_PROV[c]; return r ? LARGO[r] ?? r : null }, 'ccaa-largo').map(f => ({ ...f, properties: { name: f.properties.id } })) as never }
const regionsRaw = REGIONES
const CAN = REGIONES.features.filter(f => f.properties.name === 'Canarias')
const mezcla = (t: number, a: number[], b: number[]) => `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * Math.max(0, Math.min(1, t)))).join(',')})`

export function MapaCalles({ layer, sel, onPick }: { layer: 'depuracion' | 'alcantarillado'; sel: Sel | null; onPick: (s: Sel | null) => void }) {
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null)
  const puntos = useRef<L.LayerGroup | null>(null), regiones = useRef<L.GeoJSON | null>(null), marca = useRef<L.CircleMarker | null>(null)
  const cb = useRef(onPick); cb.current = onPick
  const edars = useEdar()
  const [zoom, setZoom] = useState(6)

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, preferCanvas: true, minZoom: 4, maxZoom: 18, zoomSnap: 0.25, attributionControl: true })
    map.current = m; fondo(m)
    cuandoVisible(m, () => m.fitBounds(ZONAS[0][1], { padding: [10, 10] }))
    m.on('zoomend', () => setZoom(m.getZoom()))
    m.on('click', () => cb.current(null))
    return () => { m.remove(); map.current = null }
  }, [])

  // De lejos: cada comunidad con su color y su cifra grande. De cerca: las comunidades se apagan y mandan los puntos.
  const etiquetas = useRef<L.LayerGroup | null>(null)
  const lejos = zoom < CERCA
  const { val, color } = useMemo(() => {
    // valor por comunidad: reutilización (INE) o % de la carga que recogen los colectores (media ponderada de sus núcleos)
    const val = new Map<string, number>()
    if (layer === 'depuracion') consumo.regions.forEach(u => { if (u.reusePct != null) val.set(u.n, u.reusePct) })
    else if (edars) { const acc = new Map<string, [number, number]>(); for (const a of aggList() ?? []) { const r = NUTS[(a.nuts ?? '').slice(0, 4)]; if (!r || a.c1 == null || !a.pe) continue; const x = acc.get(r) ?? [0, 0]; x[0] += a.c1 * a.pe; x[1] += a.pe; acc.set(r, x) } acc.forEach(([s1, s2], r) => val.set(r, s1 / s2)) }
    const vs = [...val.values()], lo = Math.min(...vs), hi = Math.max(...vs)
    const color = (v: number | undefined) => v == null ? '#1a2a33' : layer === 'depuracion' ? mezcla(Math.sqrt(v / reuMax), [20, 52, 74], [61, 245, 176]) : mezcla((v - lo) / ((hi - lo) || 1), [255, 77, 94], [63, 230, 255])
    return { val, color }
  }, [layer, edars])
  useEffect(() => {
    const m = map.current; if (!m) return
    regiones.current?.remove(); etiquetas.current?.remove(); regiones.current = null
    const idx = new Map(consumo.regions.map((u, i) => [u.n, i]))
    const fc = regionsRaw as unknown as RegFC
    regiones.current = L.geoJSON(fc, {
      style: f => ({ fillColor: color(val.get(f?.properties.name ?? '')), fillOpacity: lejos ? 0.78 : 0.05, color: lejos ? '#03090f' : '#3fe6ff', weight: lejos ? 1.2 : 0.6, opacity: lejos ? 0.9 : 0.3 }),
      onEachFeature: (f, ly) => {
        ly.on('click', e => {
          L.DomEvent.stopPropagation(e)
          const i = idx.get(f.properties.name)
          if (layer === 'depuracion' && i != null) cb.current({ k: 'dep', i })
          else m.flyToBounds((ly as L.Polygon).getBounds(), { padding: [30, 30], duration: 0.8 })
        })
      },
    }).addTo(m)
    regiones.current.bringToBack()
    if (lejos) {
      const g = L.layerGroup()
      for (const f of fc.features) {
        const v = val.get(f.properties.name); if (v == null || f.properties.name === 'Ceuta y Melilla') continue
        const c = L.geoJSON(f).getBounds().getCenter()
        const txt = etq(v, layer)
        const bb = L.geoJSON(f).getBounds(), chica = bb.getEast() - bb.getWest() < 1.4
        L.marker(c, { interactive: false, icon: L.divIcon({ className: 'mc-et', html: `<b>${txt}</b>${chica ? '' : `<span>${f.properties.name.replace(/^(Comunidad (Foral )?de |Principado de |Región de |Comunitat )/, '')}</span>`}`, iconSize: [0, 0] }) }).addTo(g)
      }
      g.addTo(m); etiquetas.current = g
    }
  }, [layer, lejos, val, color])

  // Depuradoras o núcleos, como puntos en un canvas (son miles)
  useEffect(() => {
    const m = map.current; if (!m || !edars) return
    puntos.current?.remove(); puntos.current = null
    if (zoom < CERCA) return
    const renderer = L.canvas({ tolerance: isPhone() ? 10 : 4 }), g = L.layerGroup()
    const k = Math.max(0.7, Math.min(2.2, (zoom - 4) / 3))
    if (layer === 'depuracion') edars.forEach((p, i) => {
      const r = Math.max(2.5, Math.min(14, (1.8 + Math.sqrt(p.cap ?? 2000) / 90) * k))
      L.circleMarker([p.y, p.x], { renderer, radius: r, color: p.ok === 0 ? '#ff4d5e' : COL_T[p.t], weight: p.ok === 0 ? 2 : 1.4, dashArray: p.ok === 0 ? '3 2' : undefined, fillColor: COL_T[p.t], fillOpacity: 0.25, bubblingMouseEvents: false })
        .bindTooltip(`EDAR ${p.n} · ${TRATAMIENTO[p.t]}${p.cap ? ` · ${fmt(p.cap)} h-e` : ''}${p.ok === 0 ? ' · no cumple' : ''}`, { className: 'mc-tip' })
        .on('click', () => cb.current({ k: 'edar', i })).addTo(g)
    })
    else (aggList() ?? []).forEach((a, i) => {
      const r = Math.max(2.5, Math.min(13, (1.6 + Math.sqrt(a.pe ?? 2000) / 100) * k))
      L.circleMarker([a.y, a.x], { renderer, radius: r, color: '#03090f', weight: 0.8, fillColor: c1Color(a.c1), fillOpacity: 0.9, bubblingMouseEvents: false })
        .bindTooltip(`${a.n} · ${a.c1 != null ? `${fmt(a.c1, a.c1 % 1 ? 1 : 0)} % recogido por colectores` : 'sin dato'}`, { className: 'mc-tip' })
        .on('click', () => cb.current({ k: 'agg', i })).addTo(g)
    })
    g.addTo(m); puntos.current = g
  }, [edars, layer, zoom])

  // Lo elegido: anillo blanco y vuelo hasta allí
  useEffect(() => {
    const m = map.current; if (!m) return
    marca.current?.remove(); marca.current = null
    const it = resolve(sel)
    const ll = it?.k === 'edar' ? [it.p.y, it.p.x] : it?.k === 'agg' ? [it.a.y, it.a.x] : null
    if (ll) {
      marca.current = L.circleMarker(ll as L.LatLngTuple, { radius: 16, color: '#fff', weight: 2, fill: false, interactive: false, className: 'mc-sel' }).addTo(m)
      const z = Math.max(m.getZoom(), 12)
      cuandoVisible(m, () => {
        // que no quede tapado por la ficha (a la derecha en ordenador, abajo en móvil)
        const pt = m.project(ll as L.LatLngTuple, z), off = isPhone() ? L.point(0, window.innerHeight * 0.22) : L.point(0, 0)
        m.flyTo(m.unproject(pt.add(off), z), z, { duration: 0.9 })
      })
    } else if (it?.k === 'dep') {
      const f = (regionsRaw as unknown as RegFC).features.find(x => x.properties.name === it.u.n)
      if (f) m.flyToBounds(L.geoJSON(f).getBounds(), { padding: [30, 30], paddingBottomRight: [30, isPhone() ? Math.round(window.innerHeight * 0.45) : 30], duration: 0.9 })
    }
  }, [sel, edars])

  const total = layer === 'depuracion' ? edarList()?.length : aggList()?.length
  return (
    <div className="board-wrap mapa-calles">
      <div ref={el} className="mc-mapa" />
      <nav className="mc-zonas" aria-label="Ir a">
        {ZONAS.map(([n, b]) => <button key={n} onClick={() => map.current?.flyToBounds(b, { padding: [20, 20], duration: 0.8 })}>{n}</button>)}
      </nav>
      <div className="mc-zoom">
        <button onClick={() => map.current?.zoomIn()} aria-label="Acercar">+</button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Alejar">−</button>
      </div>
      {lejos && CAN.length > 0 && (() => {
        const W = 170, H = 80, pr = geoIdentity().reflectY(true).fitExtent([[6, 6], [W - 6, H - 18]], { type: 'FeatureCollection', features: CAN } as never), pa = geoPath(pr), v = val.get('Canarias')
        return <button className="mc-can" onClick={() => map.current?.flyToBounds(ZONAS[2][1], { padding: [20, 20], duration: 0.8 })} aria-label="Ir a Canarias">
          <svg width={W} height={H}>{CAN.map((f, i) => <path key={i} d={pa(f as never) ?? ''} fill={color(v)} stroke="#03090f" strokeWidth={0.8} />)}<text x={W - 8} y={H - 5} textAnchor="end" className="mc-can-t">Canarias {v != null ? etq(v, layer) : ''}</text></svg>
        </button>
      })()}
      <div className="mc-ley">
        {lejos ? <>
          <b>{layer === 'depuracion' ? 'Agua depurada que se reutiliza' : 'Contaminación que recogen las alcantarillas'}</b>
          <i className={`mc-grad ${layer}`} />
          <span className="mc-ext"><small>{layer === 'depuracion' ? 'poca' : 'menos'}</small><small>{layer === 'depuracion' ? 'mucha' : '100 %'}</small></span>
          <small>Acércate o toca una comunidad para ver {layer === 'depuracion' ? 'sus depuradoras' : 'sus núcleos'}.</small>
        </> : layer === 'depuracion' ? <>
          <b>Depuradoras, por tratamiento</b>
          <span><i style={{ background: '#3df5b0' }} />Más riguroso (quita nitrógeno o fósforo)</span>
          <span><i style={{ background: '#3fe6ff' }} />Secundario (biológico)</span>
          <span><i style={{ background: '#ffb02e' }} />Primario</span>
          <span><i className="no" />Borde rojo: no cumple</span>
          <small>El tamaño es su capacidad.</small>
        </> : <>
          <b>Núcleos urbanos: lo que recogen las alcantarillas</b>
          <span><i style={{ background: '#3fe6ff' }} />Todo</span>
          <span><i style={{ background: '#ffd166' }} />90–99 %</span>
          <span><i style={{ background: '#ff8a3d' }} />70–90 %</span>
          <span><i style={{ background: '#ff4d5e' }} />Menos del 70 %</span>
          <small>El tamaño es la contaminación que genera.</small>
        </>}
      </div>
      {!edars ? <p className="mc-estado">Cargando {layer === 'depuracion' ? 'depuradoras' : 'núcleos urbanos'}…</p>
        : !lejos ? <p className="mc-estado">{fmt(total ?? 0)} {layer === 'depuracion' ? 'depuradoras' : 'núcleos urbanos'} · toca uno para ver su ficha</p> : null}
    </div>
  )
}
