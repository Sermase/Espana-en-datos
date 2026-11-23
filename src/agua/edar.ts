import { useEffect, useState } from 'react'

/** Aglomeración urbana atendida por una depuradora (reporte UWWTD a la UE). */
export type Agg = { c: string; n: string; pe: number | null; c1: number | null; c2: number | null; red: string | null; pct: number | null }
/** Depuradora (EDAR): capacidad y carga en habitantes equivalentes; t = 1 primario, 2 secundario, 3 más riguroso. */
export type Edar = { c: string; n: string; x: number; y: number; cap: number | null; load: number | null; t: number; e: string[]; ok: 0 | 1 | null; vol: number | null; nuts: string | null; ag: Agg[] }

let E: Edar[] | null = null
let pending: Promise<Edar[]> | null = null
const subs = new Set<() => void>()
export function loadEdar(): Promise<Edar[]> {
  pending ??= fetch('./data/depuradoras.json').then(r => r.json()).then((j: { edar: Edar[] }) => { E = j.edar; subs.forEach(f => f()); return E })
    .catch(() => { pending = null; return [] as Edar[] })
  return pending
}
export const edarList = () => E
export const edarById = (i: number) => E?.[i] ?? null
/** Se repinta cuando llegan las depuradoras; null mientras cargan. */
export function useEdar() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(x => x + 1); subs.add(f); void loadEdar(); return () => { subs.delete(f) } }, [])
  return E
}
export const TRATAMIENTO = ['Sin dato', 'Primario', 'Secundario (biológico)', 'Más riguroso'] as const
export const EXTRA: Record<string, string> = { N: 'quita nitrógeno', P: 'quita fósforo', UV: 'desinfecta con luz ultravioleta', Cl: 'desinfecta con cloro', O3: 'desinfecta con ozono', arena: 'filtra con arena', micro: 'microfiltración' }
export const RED: Record<string, string> = { C: 'unitaria (aguas residuales y de lluvia por el mismo tubo)', S: 'separativa (residuales y lluvia por tubos distintos)', B: 'mixta (parte unitaria, parte separativa)' }
export const edarSize = (cap: number | null) => Math.max(3.2, Math.min(18, 2.6 + Math.sqrt(cap ?? 2000) / 55))
