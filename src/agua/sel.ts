import { useCallback, useState } from 'react'
import { basinStats, consumo, data, depOrder, pct, type BasinStat, type Discharger, type Flow, type RainGauge, type RegionUse, type Reservoir } from './data'
import { riverById, riverList, type River } from './rivers'

/** Lo que el jugador tiene seleccionado en el mapa. */
export type Sel =
  | { k: 'res'; id: number }
  | { k: 'basin'; id: string }
  | { k: 'rain'; i: number }
  | { k: 'dis'; i: number }
  | { k: 'flow'; i: number }
  | { k: 'cons'; i: number }
  | { k: 'dep'; i: number }
  | { k: 'river'; id: number }

export const resById = new Map(data.reservoirs.map(r => [r.id, r]))
export const basinById = new Map(basinStats.map(b => [b.id, b]))

export const byCapacity = [...data.reservoirs].sort((a, b) => b.c - a.c)
export const rainOrder = data.rain.map((g, i) => ({ g, i })).sort((a, b) => b.g.p - a.g.p).map(x => x.i)
export const flowOrder = data.flows.map((f, i) => ({ f, i })).sort((a, b) => b.f.q - a.f.q).map(x => x.i)
export const disOrder = data.dischargers.map((d, i) => ({ d, i })).sort((a, b) => b.d.v - a.d.v).map(x => x.i)
export const resInBasin = (b: string) => byCapacity.filter(r => r.b === b)

export type Resolved =
  | { k: 'res'; r: Reservoir }
  | { k: 'basin'; b: BasinStat }
  | { k: 'rain'; g: RainGauge; i: number }
  | { k: 'dis'; d: Discharger; i: number }
  | { k: 'flow'; f: Flow; i: number }
  | { k: 'cons'; u: RegionUse; i: number }
  | { k: 'dep'; u: RegionUse; i: number }
  | { k: 'river'; v: River }

export function resolve(s: Sel | null): Resolved | null {
  if (!s) return null
  if (s.k === 'res') { const r = resById.get(s.id); return r ? { k: 'res', r } : null }
  if (s.k === 'basin') { const b = basinById.get(s.id); return b ? { k: 'basin', b } : null }
  if (s.k === 'rain') { const g = data.rain[s.i]; return g ? { k: 'rain', g, i: s.i } : null }
  if (s.k === 'flow') { const f = data.flows[s.i]; return f ? { k: 'flow', f, i: s.i } : null }
  if (s.k === 'cons') { const u = consumo.regions[s.i]; return u ? { k: 'cons', u, i: s.i } : null }
  if (s.k === 'dep') { const u = consumo.regions[s.i]; return u ? { k: 'dep', u, i: s.i } : null }
  if (s.k === 'river') { const v = riverById(s.id); return v ? { k: 'river', v } : null }
  const d = data.dischargers[s.i]; return d ? { k: 'dis', d, i: s.i } : null
}

/** La lista por la que se pasa con las flechas o deslizando, y la posición dentro de ella. */
export function sequence(s: Sel): { list: Sel[]; at: number; label: string } {
  if (s.k === 'res') {
    const r = resById.get(s.id)!
    const list = resInBasin(r.b).map(x => ({ k: 'res', id: x.id }) as Sel)
    return { list, at: list.findIndex(x => x.k === 'res' && x.id === s.id), label: `por tamaño en ${data.basins[r.b]}` }
  }
  if (s.k === 'basin') {
    const list = basinStats.map(b => ({ k: 'basin', id: b.id }) as Sel)
    return { list, at: list.findIndex(x => x.k === 'basin' && x.id === s.id), label: 'cuencas, de más llena a más seca' }
  }
  if (s.k === 'rain') {
    const list = rainOrder.map(i => ({ k: 'rain', i }) as Sel)
    return { list, at: rainOrder.indexOf(s.i), label: 'de más a menos lluvia' }
  }
  if (s.k === 'cons') {
    const list = consumo.regions.map((_, i) => ({ k: 'cons', i }) as Sel)
    return { list, at: s.i, label: 'de más a menos consumo' }
  }
  if (s.k === 'dep') {
    const list = depOrder.map(i => ({ k: 'dep', i }) as Sel)
    return { list, at: depOrder.indexOf(s.i), label: 'de más a menos agua reutilizada' }
  }
  if (s.k === 'river') {
    const list = (riverList() ?? []).map(v => ({ k: 'river', id: v.id }) as Sel)
    return { list, at: s.id, label: 'de más largo a más corto' }
  }
  if (s.k === 'flow') {
    const list = flowOrder.map(i => ({ k: 'flow', i }) as Sel)
    return { list, at: flowOrder.indexOf(s.i), label: 'de mayor a menor caudal' }
  }
  const list = disOrder.map(i => ({ k: 'dis', i }) as Sel)
  return { list, at: disOrder.indexOf(s.i), label: 'de mayor a menor vertido' }
}

export function selKey(s: Sel) {
  return s.k === 'res' ? `embalse-${s.id}` : s.k === 'basin' ? `cuenca-${s.id}` : s.k === 'rain' ? `lluvia-${s.i}` : s.k === 'flow' ? `rio-${s.i}` : s.k === 'cons' ? `consumo-${s.i}` : s.k === 'dep' ? `depuracion-${s.i}` : s.k === 'river' ? `cauce-${s.id}` : `vertido-${s.i}`
}
export function fromKey(key: string): Sel | null {
  const m = key.replace(/^#/, '').match(/^(embalse|cuenca|lluvia|vertido|rio|consumo|depuracion|cauce)-([A-Za-z0-9]+)$/)
  if (!m) return null
  // Los ríos llegan en un fichero aparte: su enlace vale aunque aún no hayan cargado.
  if (m[1] === 'cauce') return { k: 'river', id: Number(m[2]) }
  const s: Sel = m[1] === 'embalse' ? { k: 'res', id: Number(m[2]) } : m[1] === 'cuenca' ? { k: 'basin', id: m[2] } : m[1] === 'lluvia' ? { k: 'rain', i: Number(m[2]) } : m[1] === 'rio' ? { k: 'flow', i: Number(m[2]) } : m[1] === 'consumo' ? { k: 'cons', i: Number(m[2]) } : m[1] === 'depuracion' ? { k: 'dep', i: Number(m[2]) } : { k: 'dis', i: Number(m[2]) }
  return resolve(s) ? s : null
}
export const sameSel = (a: Sel | null, b: Sel | null) => !!a && !!b && selKey(a) === selKey(b)

/** Colección de lo que el jugador ya ha abierto. Vive en su navegador; si no hay almacenamiento, dura la sesión. */
const STORE = 'caudal-vistos-v1'
function load(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]')) } catch { return new Set() }
}
export type Milestone = { title: string; line: string }
const RES_MILESTONES = [1, 5, 10, 25, 50, 100, 200, 300, data.reservoirs.length]

export function useCollection() {
  const [seen, setSeen] = useState(load)
  const resSeen = [...seen].filter(k => k.startsWith('embalse-')).length
  const basinSeen = [...seen].filter(k => k.startsWith('cuenca-')).length

  const discover = useCallback((s: Sel): { fresh: boolean; milestone: Milestone | null } => {
    const key = selKey(s)
    if (seen.has(key)) return { fresh: false, milestone: null }
    const next = new Set(seen); next.add(key)
    setSeen(next)
    try { localStorage.setItem(STORE, JSON.stringify([...next])) } catch { /* sin almacenamiento */ }
    const nRes = [...next].filter(k => k.startsWith('embalse-')).length
    const nBas = [...next].filter(k => k.startsWith('cuenca-')).length
    let milestone: Milestone | null = null
    if (s.k === 'res' && RES_MILESTONES.includes(nRes)) {
      milestone = nRes === data.reservoirs.length
        ? { title: '¡Todos los embalses!', line: `Has abierto los ${nRes}. Red hidrológica completa.` }
        : nRes === 1 ? { title: 'Primer embalse descubierto', line: `Quedan ${data.reservoirs.length - 1}. Prueba el dado para saltar a uno al azar.` }
          : { title: `${nRes} embalses descubiertos`, line: `Llevas el ${Math.round((nRes / data.reservoirs.length) * 100)} % de la colección.` }
    }
    if (s.k === 'basin' && nBas === basinStats.length) milestone = { title: 'Todas las cuencas', line: `Has recorrido las ${nBas} demarcaciones de la península.` }
    return { fresh: true, milestone }
  }, [seen])

  return { seen, resSeen, basinSeen, discover }
}

/** Un embalse al azar, mejor si aún no lo has visto. */
export function randomSel(layer: string, seen: Set<string>): Sel {
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
  if (layer === 'lluvia') return { k: 'rain', i: pick(data.rain.map((_, i) => i)) }
  if (layer === 'vertidos') return { k: 'dis', i: pick(data.dischargers.map((_, i) => i)) }
  if (layer === 'consumo') return { k: 'cons', i: pick(consumo.regions.map((_, i) => i)) }
  if (layer === 'depuracion') return { k: 'dep', i: pick(depOrder) }
  if (layer === 'rios') return { k: 'flow', i: pick(data.flows.map((_, i) => i)) }
  const pool = data.reservoirs.filter(r => (layer !== 'energia' || r.ec > 0))
  const fresh = pool.filter(r => !seen.has(`embalse-${r.id}`))
  return { k: 'res', id: pick(fresh.length ? fresh : pool).id }
}

export const rankIn = (r: Reservoir) => {
  const same = data.reservoirs.filter(x => x.b === r.b).sort((a, b) => pct(b) - pct(a))
  return { pos: same.findIndex(x => x.id === r.id) + 1, of: same.length }
}
export const sizeRank = (r: Reservoir) => byCapacity.findIndex(x => x.id === r.id) + 1
