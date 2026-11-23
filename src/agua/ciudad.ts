import { consumo, fmt, type RegionUse } from './data'

/** Las tres capas del agua en la ciudad, en el orden en que el agua las recorre. */
export type Urb = 'consumo' | 'alcantarillado' | 'depuracion'
export const URB: Urb[] = ['consumo', 'alcantarillado', 'depuracion']
export const isUrb = (l: string): l is Urb => (URB as string[]).includes(l)
export const SEL_URB = { consumo: 'cons', alcantarillado: 'alc', depuracion: 'dep' } as const

/** Habitantes de una comunidad, deducidos del agua de los hogares y los litros por persona que el INE calcula con el padrón. */
export const habitantes = (u: RegionUse) => (u.households && u.l ? (u.households * 1e9) / (u.l * 365) : null)
/** Metros de alcantarillado por habitante. */
export const metrosPorHab = (u: RegionUse) => { const h = habitantes(u); return h && u.sewerKm ? (u.sewerKm * 1000) / h : null }

const hex = (h: string) => h.match(/\w\w/g)!.map(x => parseInt(x, 16))
function rampa(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), k = x - i
  const a = hex(stops[i]), b = hex(stops[i + 1])
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`
}

export type Metrica = {
  valor: (u: RegionUse) => number | null
  /** cifra corta para el mapa */
  num: (v: number) => string
  unidad: string
  /** la cifra contada en una frase, para la etiqueta flotante */
  frase: (v: number) => string
  /** de menos a más */
  rampa: string[]
  /** reparto del color: raíz para que los valores pequeños se distingan */
  curva?: (t: number) => number
  bajo: string; alto: string
}
const M: Record<Urb, Metrica> = {
  consumo: { valor: u => u.l, num: v => fmt(v), unidad: 'l/hab/día', frase: v => `${fmt(v)} litros por persona y día`, rampa: ['#125c68', '#3c7a6e', '#b0662a'], bajo: 'gasta menos', alto: 'gasta más' },
  alcantarillado: { valor: metrosPorHab, num: v => fmt(v, 1), unidad: 'm/hab', frase: v => `${fmt(v, 1)} m de alcantarillado por habitante`, rampa: ['#1b3346', '#5a5a74', '#c9a06a'], bajo: 'menos tubo', alto: 'más tubo' },
  depuracion: { valor: u => u.reusePct ?? null, num: v => `${fmt(v, v < 10 ? 1 : 0)} %`, unidad: 'reutilizada', frase: v => `Reutiliza el ${fmt(v, 1)} % del agua que depura`, rampa: ['#14344a', '#1f7f86', '#3df5b0'], curva: Math.sqrt, bajo: 'se reutiliza poco', alto: 'mucho' },
}
const DOM = Object.fromEntries((Object.keys(M) as Urb[]).map(k => {
  const vs = consumo.regions.map(M[k].valor).filter((v): v is number => v != null)
  return [k, [Math.min(...vs), Math.max(...vs)]]
})) as Record<Urb, [number, number]>

export const metrica = (l: Urb) => M[l]
export const dominio = (l: Urb) => DOM[l]
export function colorDe(l: Urb, v: number | null) {
  if (v == null) return 'var(--land-neutral)'
  const [lo, hi] = DOM[l], m = M[l], t = (v - lo) / (hi - lo || 1)
  return rampa(m.rampa, m.curva ? m.curva(Math.max(0, t)) : t)
}
/** Degradado CSS de la leyenda, con el mismo reparto que el mapa. */
export function degradado(l: Urb) {
  const [lo, hi] = DOM[l]
  return `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => colorDe(l, lo + ((hi - lo) * i) / 8)).join(', ')})`
}
/** Comunidades de mayor a menor valor (las que lo tienen). */
export const orden = (l: Urb) => consumo.regions.map((u, i) => ({ u, i, v: M[l].valor(u) })).filter((x): x is { u: RegionUse; i: number; v: number } => x.v != null).sort((a, b) => b.v - a.v)

/** Región NUTS 2 de Eurostat → nombre de la comunidad en las tablas del INE (para los datos de la Agencia Europea). */
export const NUTS: Record<string, string> = {
  ES11: 'Galicia', ES12: 'Principado de Asturias', ES13: 'Cantabria', ES21: 'País Vasco', ES22: 'Comunidad Foral de Navarra', ES23: 'La Rioja', ES24: 'Aragón',
  ES30: 'Comunidad de Madrid', ES41: 'Castilla y León', ES42: 'Castilla-La Mancha', ES43: 'Extremadura', ES51: 'Cataluña', ES52: 'Comunitat Valenciana', ES53: 'Illes Balears',
  ES61: 'Andalucía', ES62: 'Región de Murcia', ES63: 'Ceuta y Melilla', ES64: 'Ceuta y Melilla', ES70: 'Canarias',
}
export const regionDeNuts = (nuts: string | null) => (nuts ? NUTS[nuts.slice(0, 4)] ?? null : null)
