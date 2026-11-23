import { useEffect, useState } from 'react'
import { project } from './geo'

/** Plano de referencia (Natural Earth): autovías, manchas urbanas y ciudades, ya proyectados. */
export type Ciudad = { n: string; xy: [number, number]; pob: number; cap: number }
export type Referencia = { vias: string[]; urbano: string; ciudades: Ciudad[] }
type Raw = { carreteras: { t: number; l: [number, number][] }[]; urbano: [number, number][][]; ciudades: { n: string; x: number; y: number; pob: number; cap: number }[] }

let R: Referencia | null = null
let pending: Promise<Referencia | null> | null = null
const subs = new Set<() => void>()
const linea = (l: [number, number][]) => 'M' + l.map(([x, y]) => project(x, y).map(v => v.toFixed(1)).join(' ')).join('L')
function load() {
  pending ??= fetch('./data/referencia.json').then(r => r.json()).then((j: Raw) => {
    R = {
      vias: [1, 2, 3].map(t => j.carreteras.filter(c => c.t === t).map(c => linea(c.l)).join('')),
      urbano: j.urbano.map(r => linea(r) + 'Z').join(''),
      ciudades: j.ciudades.map(c => ({ n: c.n, xy: project(c.x, c.y), pob: c.pob, cap: c.cap })),
    }
    subs.forEach(f => f()); return R
  }).catch(() => { pending = null; return null })
  return pending
}
/** Se carga la primera vez que una capa lo pide; null mientras tanto. */
export function useReferencia(on: boolean) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const f = () => tick(x => x + 1); subs.add(f); void load()
    return () => { subs.delete(f) }
  }, [on])
  return on ? R : null
}
