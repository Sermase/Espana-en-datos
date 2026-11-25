import L from 'leaflet'
import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
import type { MultiPolygon } from 'geojson'
import provRaw from './provincias.json'

/**
 * Fondo de calles y carreteras común a los mapas de la web: el gris oscuro de Esri (sin clave)
 * con su capa de nombres encima. Los temas pintan sus datos entre las dos.
 */
export function fondo(m: L.Map) {
  m.createPane('nombres')
  const p = m.getPane('nombres')!
  p.style.zIndex = '650'; p.style.pointerEvents = 'none'
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 16, className: 'fondo-calles',
    attribution: 'Mapa: Esri, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(m)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 16, pane: 'nombres', className: 'fondo-nombres',
  }).addTo(m)
  // Si el mapa nace en una pestaña oculta mide 0 px: se recoloca en cuanto tiene tamaño.
  const ro = new ResizeObserver(() => m.invalidateSize({ pan: false }))
  ro.observe(m.getContainer())
  m.on('unload', () => ro.disconnect())
}

/** Ejecuta `fn` cuando el mapa ya tiene tamaño (si no, los encuadres salen a zoom 18 en mitad del mar). */
export function cuandoVisible(m: L.Map, fn: () => void) {
  m.invalidateSize({ pan: false })
  if (m.getSize().x > 0 && m.getSize().y > 0) return fn()
  const el = m.getContainer()
  const ro = new ResizeObserver(() => { if (el.clientWidth > 0 && el.clientHeight > 0) { ro.disconnect(); m.invalidateSize({ pan: false }); fn() } })
  ro.observe(el)
}

/**
 * Silueta de España: tapa con el color de fondo todo lo que no es España (mar, Portugal, Francia, África)
 * y deja ver las calles y carreteras solo dentro. Las provincias son simplificadas (~1 km), así que al
 * acercarse la máscara se desvanece para no comerse la costa.
 */
export function silueta(m: L.Map, color = '#03090f') {
  m.createPane('mascara')
  const p = m.getPane('mascara')!
  p.style.zIndex = '660'; p.style.pointerEvents = 'none'
  const topo = topology({ p: provRaw as never })
  const es = merge(topo as never, (topo.objects.p as unknown as { geometries: never[] }).geometries) as MultiPolygon
  const huecos = es.coordinates.map(pol => pol[0].map(([x, y]) => [y, x] as L.LatLngTuple))
  const mundo: L.LatLngTuple[] = [[-85, -180], [-85, 180], [85, 180], [85, -180]]
  const renderer = L.svg({ pane: 'mascara', padding: 0.5 })
  const fuera = L.polygon([mundo, ...huecos], { renderer, pane: 'mascara', interactive: false, stroke: false, fillColor: color, fillOpacity: 1, fillRule: 'evenodd' }).addTo(m)
  // borde de la silueta con brillo, como en Caudal
  const halo = L.polygon(huecos, { renderer, pane: 'mascara', interactive: false, fill: false, color: '#3fe6ff', weight: 6, opacity: 0.18, className: 'silueta-halo' }).addTo(m)
  const borde = L.polygon(huecos, { renderer, pane: 'mascara', interactive: false, fill: false, color: '#7fefff', weight: 1.4, opacity: 0.85 }).addTo(m)
  const ajusta = () => {
    const z = m.getZoom(), k = z <= 9 ? 1 : z >= 11 ? 0 : (11 - z) / 2
    fuera.setStyle({ fillOpacity: k }); borde.setStyle({ opacity: 0.85 * k }); halo.setStyle({ opacity: 0.18 * k })
  }
  m.on('zoomend', ajusta); ajusta()
  m.setMaxBounds([[25.5, -21], [46, 7]])
}
