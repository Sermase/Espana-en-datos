import { useEffect, useState } from 'react'
import { data } from './data'

/** Un río con nombre de la red del IGN (escala 1:3 millones), preparado por scripts/build-rivers.py. */
export type River = {
  id: number
  n: string
  /** 1 eje principal, 2 afluente, 3 menor, 4 canal */
  t: number
  /** km cartografiados en España (cauce principal) */
  km: number
  /** longitud total oficial (CEDEX), si se conoce */
  L?: number
  /** desembocadura según la tabla oficial */
  m?: string
  b: string | null
  /** río al que desemboca, si toca otro de la red */
  into: string | null
  /** embalses: [id, km desde el nacimiento o null si no está en el cauce principal] */
  res: [number, number | null][]
  /** nombres de sus estaciones de aforo */
  fl: string[]
  /** perfil: [km, altitud m] del nacimiento a la salida */
  prof: [number, number][]
  /** cauce principal, del nacimiento a la salida */
  line: [number, number][]
  /** todos sus tramos */
  g: [number, number][][]
}

let RIV: River[] | null = null
let pending: Promise<River[]> | null = null
const subs = new Set<() => void>()

export function loadRivers(): Promise<River[]> {
  pending ??= fetch('./data/rios.json').then(r => r.json()).then((j: { rivers: River[] }) => {
    RIV = j.rivers
    subs.forEach(f => f())
    return RIV
  }).catch(() => { pending = null; return [] as River[] })
  return pending
}
export const riverList = () => RIV
export const riverById = (id: number) => RIV?.[id] ?? null

/** Se repinta cuando llegan los ríos; devuelve la lista o null mientras carga. */
export function useRivers() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick(x => x + 1)
    subs.add(f); void loadRivers()
    return () => { subs.delete(f) }
  }, [])
  return RIV
}

export const riverLen = (r: River) => r.L ?? r.km
export function riverStats(r: River) {
  const res = r.res.map(([id, d]) => ({ r: data.reservoirs.find(x => x.id === id)!, d })).filter(x => x.r)
  const a = res.reduce((t, x) => t + x.r.a, 0), c = res.reduce((t, x) => t + x.r.c, 0)
  const flows = r.fl.map(n => data.flows.findIndex(f => f.n === n)).filter(i => i >= 0).map(i => ({ f: data.flows[i], i }))
  const qMax = flows.reduce((m, x) => Math.max(m, x.f.q), 0)
  const top = r.prof[0]?.[1] ?? 0, bottom = r.prof[r.prof.length - 1]?.[1] ?? 0
  return { res, a, c, flows, qMax, top, bottom, drop: top - bottom }
}
/** Hacia dónde va: «Afluente del Duero», «Desemboca en el Mediterráneo»… */
export function riverMouth(r: River) {
  const m = r.m ?? (r.into ? `Río ${r.into}` : null)
  if (!m) return 'Tramo final fuera del mapa'
  return m.startsWith('Río ') ? `Afluente del ${m.slice(4)}` : `Desemboca en el ${m}`
}
