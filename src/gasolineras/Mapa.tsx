import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cuandoVisible, fondo } from '../mapa-base'
import provRaw from '../provincias.json'
import { priceColor, provColor, type Datos, type Fuel, type Station } from './datos'

/**
 * Mapa de calles (CARTO sobre OpenStreetMap) con las provincias coloreadas de lejos
 * y cada gasolinera como un punto de cerca. Si el mapa de fondo no carga, quedan
 * las provincias y los puntos.
 */
type ProvFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; n: string }>
const PROVS = provRaw as unknown as ProvFC
const PENINSULA: L.LatLngBoundsExpression = [[35.9, -9.4], [43.85, 4.4]]
const CANARIAS: L.LatLngBoundsExpression = [[27.6, -18.2], [29.5, -13.3]]
const DOTS_FROM = 7 // zoom a partir del que se ven las gasolineras una a una

export type MapaApi = { flyStation: (s: Station) => void; flyProv: (id: string) => void; reset: () => void; canarias: () => void; locate: (lat: number, lon: number) => void }
type Props = {
  datos: Datos; fuel: Fuel; selId: number | null; selProv: string | null; near: { lat: number; lon: number } | null
  /** gasolineras resaltadas; null = todas por igual */
  destacadas: Set<number> | null
  onStation: (s: Station) => void; onProv: (id: string) => void; onEmpty: () => void; api: Ref<MapaApi>
}

const isPhone = () => window.innerWidth < 900

export function Mapa({ datos, fuel, selId, selProv, near, destacadas, onStation, onProv, onEmpty, api }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const provLayer = useRef<L.GeoJSON | null>(null)
  const dots = useRef<{ s: Station; m: L.CircleMarker }[]>([])
  const dotLayer = useRef<L.LayerGroup | null>(null)
  const selMark = useRef<L.CircleMarker | null>(null)
  const nearMark = useRef<L.CircleMarker | null>(null)
  const cb = useRef({ onStation, onProv, onEmpty }); cb.current = { onStation, onProv, onEmpty }
  const state = useRef({ fuel, selProv, destacadas }); state.current = { fuel, selProv, destacadas }

  const provStyle = (id: string): L.PathOptions => {
    const z = map.current?.getZoom() ?? 6, p = datos.hoy.provincias[id], f = state.current.fuel
    // con gasolineras resaltadas, las provincias se apagan para que los puntos destaquen
    const op = (z < 7 ? 0.62 : z < DOTS_FROM ? 0.4 : z < 10 ? 0.12 : 0) * (state.current.destacadas ? 0.35 : 1)
    const sel = state.current.selProv === id
    return { fillColor: provColor(p?.[f], datos.hoy.espana[f]), fillOpacity: op, color: sel ? '#ffffff' : '#03090f', weight: sel ? 2.5 : z < DOTS_FROM ? 1 : 0.6, opacity: sel ? 0.9 : 0.6 }
  }
  const radius = (z: number) => z < 10 ? 3 : z < 13 ? 4.5 : 6.5
  /** Pinta cada punto según combustible, zoom y resaltado. */
  const paint = () => {
    const m = map.current; if (!m) return
    const z = m.getZoom(), { fuel: f, destacadas: hl } = state.current, close = z >= DOTS_FROM
    const show = close || !!hl
    if (show && !m.hasLayer(dotLayer.current!)) dotLayer.current!.addTo(m)
    if (!show && m.hasLayer(dotLayer.current!)) m.removeLayer(dotLayer.current!)
    if (!show) return
    const r = radius(z)
    for (const { s, m: mk } of dots.current) {
      const v = s.p[f], med = datos.hoy.provincias[s.prov]?.[f]
      const col = v == null ? '#3a464d' : priceColor(med == null ? null : v - med)
      if (!hl) { mk.setRadius(r); mk.setStyle({ fillColor: col, fillOpacity: v == null ? 0.35 : 0.95, weight: 0 }); continue }
      if (hl.has(s.id)) { mk.setRadius(close ? r + 2.5 : 4.5); mk.setStyle({ fillColor: '#3df5b0', fillOpacity: 1, weight: 1.5, color: '#03090f' }); mk.bringToFront() }
      else { mk.setRadius(close ? Math.max(2, r - 1) : 0); mk.setStyle({ fillColor: '#5b6b73', fillOpacity: close ? 0.45 : 0, weight: 0 }) }
    }
  }

  // montar el mapa una vez
  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, preferCanvas: true, minZoom: 5, maxZoom: 18, zoomSnap: 0.25 })
    map.current = m
    m.setView([40.2, -3.7], 6)
    cuandoVisible(m, () => m.fitBounds(PENINSULA, { padding: [10, 10] }))
    fondo(m)
    m.attributionControl.addAttribution('IGN · MITECO')
    const renderer = L.canvas({ tolerance: isPhone() ? 10 : 4 })
    provLayer.current = L.geoJSON(PROVS, {
      style: f => provStyle(f!.properties.id),
      onEachFeature: (f, layer) => layer.on('click', e => { L.DomEvent.stopPropagation(e); cb.current.onProv(f.properties.id) }),
    }).addTo(m)
    dotLayer.current = L.layerGroup()
    dots.current = datos.st.map(s => {
      const mk = L.circleMarker([s.lat, s.lon], { renderer, radius: 3, weight: 0, fillOpacity: 0.95, bubblingMouseEvents: false })
      mk.on('click', () => cb.current.onStation(s))
      return { s, m: mk }
    })
    dots.current.forEach(d => d.m.addTo(dotLayer.current!))
    const onZoom = () => {
      const z = m.getZoom()
      provLayer.current?.setStyle(f => provStyle(f!.properties.id))
      paint()
      el.current?.classList.toggle('is-close', z >= DOTS_FROM || !!state.current.destacadas)
    }
    m.on('zoomend', onZoom); onZoom()
    m.on('click', () => cb.current.onEmpty())
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])

  // colores al cambiar de combustible o de provincia elegida
  useEffect(() => {
    provLayer.current?.setStyle(f => provStyle(f!.properties.id))
    paint()
    el.current?.classList.toggle('is-close', (map.current?.getZoom() ?? 0) >= DOTS_FROM || !!destacadas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuel, selProv, datos, destacadas])

  // gasolinera elegida: anillo coral
  useEffect(() => {
    const m = map.current; if (!m) return
    selMark.current?.remove(); selMark.current = null
    const s = selId != null ? datos.byId.get(selId) : null
    if (s) selMark.current = L.circleMarker([s.lat, s.lon], { radius: 13, color: '#ff5f7e', weight: 3, fill: false, interactive: false }).addTo(m)
  }, [selId, datos])
  useEffect(() => {
    const m = map.current; if (!m) return
    nearMark.current?.remove(); nearMark.current = null
    if (near) nearMark.current = L.circleMarker([near.lat, near.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#4da3ff', fillOpacity: 1, interactive: false }).addTo(m)
  }, [near])

  // En el móvil la ficha tapa la mitad de abajo: el punto se coloca arriba.
  const flyTo = (lat: number, lon: number, z: number) => {
    const m = map.current!; const size = m.getSize()
    const dy = isPhone() ? size.y * 0.22 : 0
    const target = m.unproject(m.project([lat, lon], z).add([0, dy]), z)
    m.flyTo(target, z, { duration: 0.9 })
  }
  useImperativeHandle(api, () => ({
    flyStation: s => cuandoVisible(map.current!, () => flyTo(s.lat, s.lon, Math.max(map.current!.getZoom(), 15))),
    flyProv: id => cuandoVisible(map.current!, () => {
      const layer = provLayer.current?.getLayers().find(l => ((l as L.Polygon).feature as GeoJSON.Feature | undefined)?.properties?.id === id) as L.Polygon | undefined
      if (layer) map.current!.flyToBounds(layer.getBounds(), { paddingTopLeft: [20, 20], paddingBottomRight: [20, isPhone() ? Math.round(window.innerHeight * 0.3) : 20], duration: 0.9 })
    }),
    reset: () => map.current!.flyToBounds(PENINSULA, { duration: 0.8 }),
    canarias: () => map.current!.flyToBounds(CANARIAS, { duration: 0.9 }),
    locate: (lat, lon) => cuandoVisible(map.current!, () => flyTo(lat, lon, 13)),
  }))

  return <div ref={el} className="mapa" role="application" aria-label="Mapa de gasolineras" />
}
