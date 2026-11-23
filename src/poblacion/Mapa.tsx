import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cuandoVisible, fondo } from '../mapa-base'
import { type Datos, type Muni } from './datos'
import { METRICAS, colorDe, type Metrica } from './metricas'

const PENINSULA: L.LatLngBoundsExpression = [[35.9, -9.4], [43.85, 4.4]]
const CANARIAS: L.LatLngBoundsExpression = [[27.6, -18.2], [29.5, -13.3]]
const isPhone = () => window.innerWidth < 900

export type MapaApi = { flyMuni: (m: Muni) => void; reset: () => void; canarias: () => void }

/**
 * Municipios coloreados por la métrica elegida. Para los habitantes, que son un recuento,
 * se usan círculos proporcionales en el núcleo principal de cada municipio.
 */
export function Mapa({ d, metrica, selId, onMuni, onEmpty, api }: { d: Datos; metrica: Metrica; selId: string | null; onMuni: (m: Muni) => void; onEmpty: () => void; api: Ref<MapaApi> }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const polys = useRef<L.GeoJSON | null>(null)
  const dots = useRef<{ m: Muni; c: L.CircleMarker }[]>([])
  const dotLayer = useRef<L.LayerGroup | null>(null)
  const st = useRef({ metrica, selId }); st.current = { metrica, selId }
  const cb = useRef({ onMuni, onEmpty }); cb.current = { onMuni, onEmpty }

  const radius = (pop: number, z: number) => Math.max(1.2, Math.min(90, Math.sqrt(pop) * 0.018 * Math.pow(1.65, z - 6)))
  const polyStyle = (id: string): L.PathOptions => {
    const m = d.byId.get(id), { metrica: k, selId: s } = st.current, z = map.current?.getZoom() ?? 6
    const sel = s === id
    if (k === 'hab') return { fillColor: '#1b2a33', fillOpacity: 0.35, color: sel ? '#fff' : '#0b1a22', weight: sel ? 2.5 : z < 8 ? 0.2 : 0.6, opacity: sel ? 1 : 0.8 }
    return { fillColor: m ? colorDe(k, m) : '#1b2a33', fillOpacity: z < 11 ? 0.85 : 0.45, color: sel ? '#fff' : '#03090f', weight: sel ? 2.5 : z < 8 ? 0.15 : 0.5, opacity: sel ? 1 : 0.7 }
  }

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, preferCanvas: true, minZoom: 5, maxZoom: 16, zoomSnap: 0.25 })
    map.current = m
    m.setView([40.2, -3.7], 6)
    cuandoVisible(m, () => m.fitBounds(PENINSULA, { padding: [10, 10] }))
    fondo(m)
    m.attributionControl.addAttribution('IGN · INE')
    const renderer = L.canvas({ tolerance: isPhone() ? 6 : 2 })
    polys.current = L.geoJSON(d.geo, {
      renderer,
      style: f => polyStyle(f!.properties.id),
      onEachFeature: (f, layer) => layer.on('click', e => { L.DomEvent.stopPropagation(e); const x = d.byId.get(f.properties.id); if (x) cb.current.onMuni(x) }),
    } as L.GeoJSONOptions).addTo(m)
    dotLayer.current = L.layerGroup()
    const dotRenderer = L.canvas({ tolerance: isPhone() ? 8 : 3 })
    dots.current = d.munis.filter(x => Number.isFinite(x.cx)).sort((a, b) => (b.pop.at(-1) ?? 0) - (a.pop.at(-1) ?? 0)).map(x => {
      const c = L.circleMarker([x.cy, x.cx], { renderer: dotRenderer, radius: 2, color: '#03090f', weight: 0.6, fillColor: '#c49bff', fillOpacity: 0.75, bubblingMouseEvents: false })
      c.on('click', () => cb.current.onMuni(x))
      return { m: x, c }
    })
    dots.current.forEach(x => x.c.addTo(dotLayer.current!))
    const onZoom = () => {
      polys.current?.setStyle(f => polyStyle(f!.properties.id))
      if (st.current.metrica === 'hab') { const z = m.getZoom(); dots.current.forEach(x => x.c.setRadius(radius(x.m.pop.at(-1) ?? 0, z))) }
    }
    m.on('zoomend', onZoom)
    m.on('click', () => cb.current.onEmpty())
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])

  useEffect(() => {
    const m = map.current; if (!m) return
    polys.current?.setStyle(f => polyStyle(f!.properties.id))
    if (metrica === 'hab') {
      if (!m.hasLayer(dotLayer.current!)) dotLayer.current!.addTo(m)
      const z = m.getZoom(); dots.current.forEach(x => { x.c.setRadius(radius(x.m.pop.at(-1) ?? 0, z)); x.c.setStyle({ fillColor: x.m.id === selId ? '#ffffff' : '#c49bff' }) })
    } else if (m.hasLayer(dotLayer.current!)) m.removeLayer(dotLayer.current!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrica, selId, d])

  const flyTo = (lat: number, lon: number, z: number) => {
    const m = map.current!, dy = isPhone() ? m.getSize().y * 0.22 : 0
    m.flyTo(m.unproject(m.project([lat, lon], z).add([0, dy]), z), z, { duration: 0.9 })
  }
  useImperativeHandle(api, () => ({
    flyMuni: x => cuandoVisible(map.current!, () => {
      const layer = polys.current?.getLayers().find(l => ((l as L.Polygon).feature as GeoJSON.Feature | undefined)?.properties?.id === x.id) as L.Polygon | undefined
      if (layer) {
        const b = layer.getBounds(), z = Math.min(12, Math.max(9, map.current!.getBoundsZoom(b, false, L.point(60, 60))))
        flyTo(b.getCenter().lat, b.getCenter().lng, z)
      } else if (Number.isFinite(x.cy)) flyTo(x.cy, x.cx, 11)
    }),
    reset: () => map.current!.flyToBounds(PENINSULA, { duration: 0.8 }),
    canarias: () => map.current!.flyToBounds(CANARIAS, { duration: 0.9 }),
  }))

  return <div ref={el} className="mapa" role="application" aria-label={`Mapa de municipios: ${METRICAS[metrica].nombre}`} />
}
