import { useEffect, useState } from 'react'

export type Serie = { nombre: string; unidad: string; frec: 'M' | 'T' | 'S' | 'A'; fuente: string; d: [string, number][] }
export type Datos = { fecha: string; nombres: Record<string, Record<string, string>>; temas: Record<string, Record<string, Serie>> }

let cache: Promise<Datos> | null = null
export function useDatos() {
  const [d, setD] = useState<Datos | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    cache ??= fetch('./data/series.json').then(r => { if (!r.ok) throw new Error(); return r.json() })
    cache.then(setD, () => { cache = null; setErr(true) })
  }, [])
  return { d, err }
}

/** «2024-Q3», «2024-07», «2024-S1», «2024» → milisegundos (a mitad del periodo). */
export function toT(p: string) {
  const [y, r] = p.split('-'), Y = Number(y)
  if (!r) return Date.UTC(Y, 6, 1)
  if (r[0] === 'Q') return Date.UTC(Y, (Number(r[1]) - 1) * 3 + 1, 15)
  if (r[0] === 'S') return Date.UTC(Y, r[1] === '1' ? 3 : 9, 1)
  return Date.UTC(Y, Number(r) - 1, 15)
}
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
/** Etiqueta legible del periodo: «3.er trim. 2024», «jul 2024», «2024». */
export function periodo(p: string) {
  const [y, r] = p.split('-')
  if (!r) return y
  if (r[0] === 'Q') return `${r[1]}.º trim. ${y}`
  if (r[0] === 'S') return `${r[1]}.º sem. ${y}`
  return `${MES[Number(r) - 1]} ${y}`
}
export function fechaDe(t: number, frec: Serie['frec']) {
  const d = new Date(t)
  if (frec === 'A') return String(d.getUTCFullYear())
  if (frec === 'T') return `${Math.floor(d.getUTCMonth() / 3) + 1}.º trim. ${d.getUTCFullYear()}`
  return `${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
