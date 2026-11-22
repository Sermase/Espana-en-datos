import { useEffect, useState } from 'react'

/** Serie histórica semanal (MITECO). Se carga aparte para que el mapa arranque rápido. */
export type History = {
  national: { d: string[]; a: number[]; c: number[] }
  rd: string[] // fechas de las series por embalse y cuenca (desde oct. 2015)
  res: Record<string, (number | null)[]>
  rec: Record<string, { max: [number, string]; min: [number, string]; since: string }>
  basins: Record<string, { c: number; a: (number | null)[] }>
}

let cache: Promise<History> | null = null
export function useHistory() {
  const [h, setH] = useState<History | null>(null)
  useEffect(() => {
    cache ??= fetch('./data/history.json').then(r => r.json())
    let live = true
    cache.then(x => live && setH(x)).catch(() => { cache = null })
    return () => { live = false }
  }, [])
  return h
}

const DAY = 864e5
export const toDate = (s: string) => new Date(s + 'T12:00:00')
/** Año hidrológico (1 oct – 30 sep) al que pertenece una fecha: devuelve el año de inicio. */
export const hydroYear = (d: Date) => (d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1)
export const hydroLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`
export const weekOf = (d: Date) => Math.min(52, Math.max(0, Math.floor((d.getTime() - new Date(hydroYear(d), 9, 1, 12).getTime()) / (7 * DAY))))

export type YearSeries = Map<number, (number | null)[]> // año → 53 semanas de %

/** Reparte una serie por años hidrológicos, en porcentaje. */
export function byHydroYear(dates: string[], vals: (number | null)[], cap: number | number[]): YearSeries {
  const out: YearSeries = new Map()
  dates.forEach((s, i) => {
    const v = vals[i]
    if (v == null) return
    const d = toDate(s), y = hydroYear(d)
    if (!out.has(y)) out.set(y, Array(53).fill(null))
    const c = Array.isArray(cap) ? cap[i] : cap
    out.get(y)![weekOf(d)] = (v / c) * 100
  })
  return out
}

/** Media, mínimo y máximo por semana de un conjunto de años. */
export function envelope(ys: YearSeries, years: number[]) {
  const avg: (number | null)[] = [], lo: (number | null)[] = [], hi: (number | null)[] = []
  for (let w = 0; w < 53; w++) {
    const v = years.map(y => ys.get(y)?.[w]).filter((x): x is number => x != null)
    avg.push(v.length >= Math.min(5, years.length) ? v.reduce((a, b) => a + b, 0) / v.length : null)
    lo.push(v.length ? Math.min(...v) : null)
    hi.push(v.length ? Math.max(...v) : null)
  }
  return { avg, lo, hi }
}

/** Valor más cercano a una fecha dentro de ±10 días. */
export function near(dates: string[], vals: (number | null)[], target: Date) {
  let best: number | null = null, bd = 10 * DAY
  dates.forEach((s, i) => {
    const v = vals[i]; if (v == null) return
    const dd = Math.abs(toDate(s).getTime() - target.getTime())
    if (dd <= bd) { bd = dd; best = v }
  })
  return best
}

export const MONTHS = ['oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep']
export const fechaCorta = (s: string) => toDate(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
