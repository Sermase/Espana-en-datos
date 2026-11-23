import { useEffect, useState } from 'react'

/** Aglomeración urbana atendida por una depuradora (reporte UWWTD a la UE). */
export type Agg = { c: string; n: string; pe: number | null; c1: number | null; c2: number | null; red: string | null; pct: number | null }
/** Depuradora (EDAR): capacidad y carga en habitantes equivalentes; t = 1 primario, 2 secundario, 3 más riguroso. */
export type Edar = { c: string; n: string; x: number; y: number; cap: number | null; load: number | null; t: number; e: string[]; ok: 0 | 1 | null; vol: number | null; nuts: string | null; ag: Agg[] }

/** Aglomeración urbana con su posición y las depuradoras (índices) a las que va su agua. */
export type AggPt = Agg & { x: number; y: number; sin: number | null; ed: number[]; nuts: string | null }
/**
 * Los nombres del reporte europeo llegan en mayúsculas y con guiones bajos («PRAT DE LLOBREGAT (EL)», «LOS LLANOS_EL PASO»):
 * se pasan a «El Prat de Llobregat», «Los Llanos / El Paso». Los que ya vienen bien escritos no se tocan.
 */
const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'i', 'a', 'en', "d'", "l'", 'des', 'dels'])
export function bonito(n: string) {
  if (!n || n !== n.toUpperCase()) return (n ?? '').replace(/_/g, ' / ')
  let t = n.toLowerCase().replace(/_/g, ' / ').replace(/\s+/g, ' ').trim()
  t = t.replace(/^(.*) \((el|la|los|las|l'|els|les|o|a|as|os)\)$/, (_, r, art) => `${art}${art.endsWith("'") ? '' : ' '}${r}`)
  const ws = t.split(' ')
  return ws.map((w, i) => {
    // «Madrid I (Sur)»: números romanos al final o antes de un paréntesis
    if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(w) && i > 0 && (i === ws.length - 1 || ws[i + 1].startsWith('('))) return w.toUpperCase()
    if (i > 0 && ws[i - 1] !== '/' && MENORES.has(w)) return w
    return w.replace(/(^|[-'(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
  }).join(' ')
}
let E: Edar[] | null = null
let A: AggPt[] | null = null
let pending: Promise<Edar[]> | null = null
const subs = new Set<() => void>()
export function loadEdar(): Promise<Edar[]> {
  pending ??= fetch('./data/depuradoras.json').then(r => r.json()).then((j: { edar: Edar[]; aggs?: AggPt[] }) => {
    for (const p of j.edar) { p.n = bonito(p.n); for (const a of p.ag) a.n = bonito(a.n) }
    for (const a of j.aggs ?? []) a.n = bonito(a.n)
    E = j.edar; A = j.aggs ?? []; subs.forEach(f => f()); return E
  })
    .catch(() => { pending = null; return [] as Edar[] })
  return pending
}
export const edarList = () => E
export const edarById = (i: number) => E?.[i] ?? null
export const aggList = () => A
export const aggById = (i: number) => A?.[i] ?? null
/** Se repinta cuando llegan las depuradoras; null mientras cargan. */
export function useEdar() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(x => x + 1); subs.add(f); void loadEdar(); return () => { subs.delete(f) } }, [])
  return E
}
export const TRATAMIENTO = ['Sin dato', 'Primario', 'Secundario (biológico)', 'Más riguroso'] as const
export const EXTRA: Record<string, string> = { N: 'quita nitrógeno', P: 'quita fósforo', UV: 'desinfecta con luz ultravioleta', Cl: 'desinfecta con cloro', O3: 'desinfecta con ozono', arena: 'filtra con arena', micro: 'microfiltración' }
export const RED: Record<string, string> = { C: 'unitaria (aguas residuales y de lluvia por el mismo tubo)', S: 'separativa (residuales y lluvia por tubos distintos)', B: 'mixta (parte unitaria, parte separativa)' }
/** Color del % recogido por colectores: 100 % cian; cuanto menos, más naranja y rojo. */
export const c1Color = (c1: number | null) => c1 == null ? '#5b7a86' : c1 >= 99.5 ? '#3fe6ff' : c1 >= 90 ? '#ffd166' : c1 >= 70 ? '#ff8a3d' : '#ff4d5e'
export const aggSize = (pe: number | null) => Math.max(2.6, Math.min(16, 2 + Math.sqrt(pe ?? 2000) / 60))
export const edarSize = (cap: number | null) => Math.max(3.2, Math.min(18, 2.6 + Math.sqrt(cap ?? 2000) / 55))
