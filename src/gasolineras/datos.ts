import { useEffect, useState } from 'react'

export type Fuel = 'g95' | 'dsl' | 'g98' | 'dslp' | 'glp'
export const FUEL_NAME: Record<Fuel, string> = { g95: 'Gasolina 95', dsl: 'Diésel', g98: 'Gasolina 98', dslp: 'Diésel premium', glp: 'Autogás (GLP)' }
export const FUEL_SHORT: Record<Fuel, string> = { g95: '95', dsl: 'Diésel', g98: '98', dslp: 'Diésel+', glp: 'GLP' }

type Stats = Partial<Record<Fuel, number | null>>
export type Hoy = {
  fecha: string
  fuels: Fuel[]
  cols: string[]
  marcas: string[]
  provincias: Record<string, { n: string; c: string; cnt: number } & Stats>
  espana: Stats & { n: number }
  /** [id, lat, lon, marca, municipio, prov, g95, dsl, g98, dslp, glp, h24, dir, restringida] */
  rows: (string | number | null)[][]
}
export type Station = {
  id: number; lat: number; lon: number; marca: string; mun: string; prov: string
  p: Record<Fuel, number | null>; h24: boolean; dir: string; restr: boolean
}
export type Historia = { dias: { d: string; es: Record<Fuel, number | null>; p: Record<string, [number | null, number | null]> }[] }

export type Datos = { hoy: Hoy; st: Station[]; byId: Map<number, Station>; hist: Historia | null }

/** «Palmas (Las)» → «Las Palmas», como se escribe normalmente. */
export const nice = (n: string) => n.replace(/^(.*?) \((.+)\)$/, (_, a, b) => `${b}${/'$/.test(b) ? '' : ' '}${a}`)

function unpack(h: Hoy): Station[] {
  for (const p of Object.values(h.provincias)) p.n = nice(p.n)
  return h.rows.map(r => ({
    id: r[0] as number, lat: r[1] as number, lon: r[2] as number, marca: h.marcas[r[3] as number], mun: nice(r[4] as string), prov: r[5] as string,
    p: Object.fromEntries(h.fuels.map((f, i) => [f, r[6 + i] as number | null])) as Record<Fuel, number | null>,
    h24: r[6 + h.fuels.length] === 1, dir: r[7 + h.fuels.length] as string, restr: r[8 + h.fuels.length] === 1,
  }))
}

let cache: Promise<Datos> | null = null
export function useDatos() {
  const [d, setD] = useState<Datos | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    cache ??= Promise.all([
      fetch('./data/hoy.json').then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Hoy> }),
      fetch('./data/historia.json').then(r => r.ok ? r.json() as Promise<Historia> : null).catch(() => null),
    ]).then(([hoy, hist]) => { const st = unpack(hoy); return { hoy, st, byId: new Map(st.map(s => [s.id, s])), hist } })
    cache.then(setD, () => { cache = null; setErr(true) })
  }, [])
  return { d, err }
}

const nf = (n: number, d = 3) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
export const eur = (v: number | null | undefined, d = 3) => v == null ? '—' : nf(v, d)
export const cents = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v * 100), 1)} cént.`
export const int = (n: number) => n.toLocaleString('es-ES', { useGrouping: true })
export const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) + ' · ' + iso.slice(11, 16)

/** Color por diferencia con la mediana de su provincia: verde barato, rojo caro. */
export function priceColor(diff: number | null) {
  if (diff == null) return '#4a5a63'
  const t = Math.max(-1, Math.min(1, diff / 0.08))
  if (t < 0) { const a = -t; return `rgb(${Math.round(120 - 59 * a)},${Math.round(180 + 65 * a)},${Math.round(190 - 14 * a)})` }
  return `rgb(${Math.round(200 + 55 * t)},${Math.round(180 - 103 * t)},${Math.round(190 - 96 * t)})`
}
/** Escala de la provincia frente a España, en el mismo código de color. */
export const provColor = (v: number | null | undefined, es: number | null | undefined) => v == null || es == null ? '#16242c' : priceColor((v - es) * 1.6)

export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
