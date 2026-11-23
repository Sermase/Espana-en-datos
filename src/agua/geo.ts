import { geoBounds, geoConicConformal, geoPath, type GeoPath, type GeoProjection } from 'd3-geo'
import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiPolygon } from 'geojson'
import { PROVINCIAS } from '../geo/provincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { basins, land, rivers } from './data'

/**
 * Geografía común de todas las capas de Caudal: una proyección para la península, Baleares, Ceuta y Melilla
 * en su sitio, y Canarias en un recuadro a la misma escala aproximada (a la izquierda en pantallas anchas,
 * debajo en el móvil, donde sobra alto y falta ancho).
 */
export const W = 1000, H = 800
export const PHONE = typeof window !== 'undefined' && window.innerWidth < 980

const CEUTA: [number, number] = [-5.32, 35.888], MELILLA: [number, number] = [-2.94, 35.292]
const main = geoConicConformal().parallels([36, 43]).rotate([3.6, 0]).fitExtent([[24, 92], [W - 24, 712]], {
  type: 'FeatureCollection', features: [...land.features, { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: [CEUTA, MELILLA] } }],
} as FeatureCollection)
const CAN_AT: [number, number] = PHONE ? [400, 806] : [150, 686]
const can = geoConicConformal().parallels([27.6, 29.4]).rotate([15.8, 0]).center([0, 28.55]).scale(main.scale() * 0.8).translate(CAN_AT)

const enCanarias = (x: number, y: number) => x < -12.5 && y < 30.5
export const project = (x: number, y: number) => ((enCanarias(x, y) ? can : main)([x, y]) ?? [0, 0]) as [number, number]
const pMain = geoPath(main), pCan = geoPath(can)
/** El trazador que toca: el del recuadro si la figura está en Canarias. */
export const pathOf = (f: Feature | Geometry): GeoPath => { const [[x0, y0]] = geoBounds(f as Feature); return enCanarias(x0, y0) ? pCan : pMain }
export const pathMain = pMain
export const d = (f: Feature | Geometry) => pathOf(f)(f as Feature) ?? ''
export const boundsOf = (f: Feature | Geometry) => pathOf(f).bounds(f as Feature) as [[number, number], [number, number]]
export const projOf = (f: Feature | Geometry): GeoProjection => pathOf(f) === pCan ? can : main

/** Dónde poner la etiqueta de una figura: el punto interior más alejado del borde, aproximado en una rejilla. */
export function labelPoint(f: Feature): [number, number] {
  const proj = projOf(f), [[x0, y0], [x1, y1]] = boundsOf(f)
  const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] }
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
  const rings = polys.flatMap(p => p).map(r => r.map(([x, y]) => (proj([x, y]) ?? [0, 0]) as [number, number]))
  const inside = (px: number, py: number) => { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c } return c }
  const edge = (px: number, py: number) => { let m = Infinity; for (const r of rings) for (let i = 1; i < r.length; i++) { const [ax, ay] = r[i - 1], [bx, by] = r[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(ax + t * dx - px, ay + t * dy - py)) } return m }
  let best: [number, number] = pathOf(f).centroid(f) as [number, number], bd = -1
  for (let i = 1; i < 13; i++) for (let j = 1; j < 13; j++) {
    const px = x0 + ((x1 - x0) * i) / 13, py = y0 + ((y1 - y0) * j) / 13
    if (!inside(px, py)) continue
    const dd = edge(px, py); if (dd > bd) { bd = dd; best = [px, py] }
  }
  return best
}

/** Comunidades hechas uniendo las 52 provincias del IGN, con los nombres que usa el INE en sus tablas. */
const LARGO: Record<string, string> = { 'Asturias': 'Principado de Asturias', 'Madrid': 'Comunidad de Madrid', 'Murcia': 'Región de Murcia', 'Navarra': 'Comunidad Foral de Navarra', 'C. Valenciana': 'Comunitat Valenciana', 'Ceuta': 'Ceuta y Melilla', 'Melilla': 'Ceuta y Melilla' }
const topo = topology({ p: PROVINCIAS as never })
const geoms = (topo.objects.p as unknown as { geometries: { properties: { id: string } }[] }).geometries
const ccaaDe = (cod: string) => { const r = CCAA_DE_PROV[cod]; return r ? LARGO[r] ?? r : null }
const unir = (ok: (cod: string) => boolean) => merge(topo as never, geoms.filter(g => ok(g.properties.id)) as never) as MultiPolygon
export const CCAA: Feature<MultiPolygon, { name: string }>[] = [...new Set(geoms.map(g => ccaaDe(g.properties.id)).filter((x): x is string => !!x))]
  .map(name => ({ type: 'Feature', properties: { name }, geometry: unir(c => ccaaDe(c) === name) }))

const CAN_IDS = new Set(['35', '38']), CM_IDS = new Set(['51', '52'])
const tierraCan: Feature = { type: 'Feature', properties: {}, geometry: unir(c => CAN_IDS.has(c)) }
const tierraCM: Feature = { type: 'Feature', properties: {}, geometry: unir(c => CM_IDS.has(c)) }
const tierraProv: Feature = { type: 'Feature', properties: {}, geometry: unir(c => !CAN_IDS.has(c)) }
const canBox = pCan.bounds(tierraCan)

/** Todo lo que no cambia se proyecta una vez. */
export const SHAPES = {
  /** Contorno del boletín (península y Baleares), el que casa con cuencas y ríos */
  land: pMain(land) ?? '',
  /** Lo que el contorno del boletín no trae: Ceuta, Melilla y Canarias */
  landExtra: (pMain(tierraCM) ?? '') + (pCan(tierraCan) ?? ''),
  /** Contorno hecho con las provincias, para las capas por comunidad */
  landProv: (pMain(tierraProv) ?? '') + (pCan(tierraCan) ?? ''),
  basins: basins.features.map(f => ({ id: f.properties.id, name: f.properties.name, d: pMain(f) ?? '', bounds: pMain.bounds(f) as [[number, number], [number, number]] })),
  // Red completa del IGN en un trazo por clase: canales (4), afluentes (5, 6) y ejes principales (7).
  rivers: [4, 5, 6, 7].map(o => ({ o, d: rivers.features.filter(f => f.properties.o === o).map(f => pMain(f) ?? '').join('') })),
  ccaa: CCAA.map(f => ({ name: f.properties.name, d: d(f), bounds: boundsOf(f), at: labelPoint(f), area: (() => { const [[a, b], [c, e]] = boundsOf(f); return (c - a) * (e - b) })() })),
  /** Recuadro de Canarias, con margen */
  canarias: { x: canBox[0][0] - 12, y: canBox[0][1] - 22, w: canBox[1][0] - canBox[0][0] + 24, h: canBox[1][1] - canBox[0][1] + 32 },
  ceuta: project(...CEUTA), melilla: project(...MELILLA),
}
/** Lo que hay que ver entero al abrir: península, Baleares, Ceuta, Melilla y Canarias. */
export const CONTENIDO = (() => {
  const [[a, b], [c, e]] = pMain.bounds({ type: 'FeatureCollection', features: [...land.features, tierraCM] } as FeatureCollection)
  const k = SHAPES.canarias
  return [[Math.min(a, k.x), Math.min(b, k.y)], [Math.max(c, k.x + k.w), Math.max(e, k.y + k.h)]] as [[number, number], [number, number]]
})()
