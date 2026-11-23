import L from 'leaflet'

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
