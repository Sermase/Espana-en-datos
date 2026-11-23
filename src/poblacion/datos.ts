import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Piramides } from '../graficos'
import { CCAA_DE_PROV, PROV } from './geo'

export type Muni = {
  id: string; n: string; prov: string; ccaa: string
  pop: (number | null)[]; h: number | null; m: number | null
  km2: number; cx: number; cy: number
  edad?: number; envej?: number; nacidos?: number; vegetativo?: number
}
export type Serie = { n: string; d: [number, number][] }
export type Datos = {
  years: number[]
  munis: Muni[]
  byId: Map<string, Muni>
  geo: GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; n: string; km2: number; cx: number; cy: number }>
  series: Record<string, { id: number; series: Serie[] }>
  piramide: Piramides | null
  indAño: Partial<Record<'edad' | 'envej' | 'nacidos' | 'vegetativo', number>>
}

const j = (u: string) => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json() })
let cache: Promise<Datos> | null = null

export function useDatos() {
  const [d, setD] = useState<Datos | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    cache ??= Promise.all([
      j('./data/municipios.json'), j('./data/municipios.topo.json'),
      j('./data/indicadores.json').catch(() => ({})), j('./data/series.json').catch(() => ({})), j('./data/piramide.json').catch(() => null),
    ]).then(([mj, topo, ind, series, piramide]) => {
      const t = topo as Topology
      const obj = Object.values(t.objects)[0] as GeometryCollection
      const geo = feature(t, obj) as unknown as Datos['geo']
      const shape = new Map(geo.features.map(f => [f.properties.id, f.properties]))
      const munis: Muni[] = []
      for (const [id, [n, pop, h, m]] of Object.entries(mj.m as Record<string, [string, (number | null)[], number | null, number | null]>)) {
        const s = shape.get(id)
        const prov = id.slice(0, 2)
        const x: Muni = { id, n: nice(n), prov, ccaa: CCAA_DE_PROV[prov] ?? '', pop, h, m, km2: s?.km2 ?? 0, cx: s?.cx ?? NaN, cy: s?.cy ?? NaN }
        for (const k of ['edad', 'envej', 'nacidos', 'vegetativo'] as const) { const v = ind[k]?.v?.[id]; if (v != null) x[k] = v }
        munis.push(x)
      }
      const indAño = Object.fromEntries(Object.entries(ind as Record<string, { año: number }>).map(([k, v]) => [k, v.año]))
      return { years: mj.years, munis, byId: new Map(munis.map(m => [m.id, m])), geo, series, piramide, indAño }
    })
    cache.then(setD, () => { cache = null; setErr(true) })
  }, [])
  return { d, err }
}

/** «Palmas de Gran Canaria, Las» → «Las Palmas de Gran Canaria». */
export const nice = (n: string) => n.replace(/^(.*), (El|La|Los|Las|L'|Es|Sa|Ses|Els|A|O|As|Os|Lo|Les)$/i, (_, a, b) => `${b}${b.endsWith("'") ? '' : ' '}${a}`)
export const provName = (p: string) => PROV[p] ?? p
export const last = <T,>(a: T[]) => a[a.length - 1]
export const popNow = (m: Muni) => last(m.pop) ?? 0
export const popAt = (d: Datos, m: Muni, year: number) => m.pop[d.years.indexOf(year)] ?? null
