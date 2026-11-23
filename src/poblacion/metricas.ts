import { nf } from '../graficos'
import type { Muni } from './datos'

export type Metrica = 'hab' | 'dens' | 'cambio' | 'pico' | 'ratio'

/** Rampa secuencial de un solo tono (violeta), de oscuro (poco) a claro (mucho) sobre el fondo oscuro. */
const SEQ = ['#2b2340', '#3f2f66', '#57408f', '#7254b6', '#9170d6', '#b398ec', '#dcc9ff']
/** Divergente: pierde (naranja) · neutro gris · gana (azul). */
const DIV = ['#d95926', '#a85434', '#6e4c44', '#4a5560', '#30577f', '#3168ad', '#3987e5']

type Def = { nombre: string; corto: string; unidad: string; cortes: number[]; colores: string[]; valor: (m: Muni, base: number, years?: number[]) => number | null; fmt: (v: number) => string; nota: string }
const pct = (v: number) => `${v > 0 ? '+' : ''}${nf(v, 1)} %`

export const METRICAS: Record<Metrica, Def> = {
  hab: { nombre: 'Habitantes', corto: 'Habitantes', unidad: 'hab.', cortes: [], colores: [], valor: m => m.pop.at(-1) ?? null, fmt: v => nf(v), nota: 'Un círculo por municipio, en su núcleo principal; el área es proporcional a la población.' },
  dens: { nombre: 'Densidad', corto: 'Densidad', unidad: 'hab./km²', cortes: [10, 25, 50, 100, 500, 2000], colores: SEQ, valor: m => (m.km2 > 0 ? (m.pop.at(-1) ?? 0) / m.km2 : null), fmt: v => nf(v, v < 10 ? 1 : 0), nota: 'Habitantes por kilómetro cuadrado. Por debajo de 10 la UE habla de zona escasamente poblada.' },
  cambio: { nombre: 'Cambio desde 2000', corto: 'Cambio', unidad: '%', cortes: [-30, -15, -5, 5, 15, 30], colores: DIV, valor: (m, base) => { const a = m.pop[base], b = m.pop.at(-1); return a && b != null ? ((b - a) / a) * 100 : null }, fmt: pct, nota: 'Cuánto ha crecido o se ha vaciado cada municipio desde el padrón de 2000.' },
  pico: { nombre: 'Año con más vecinos', corto: 'Su mejor año', unidad: '', cortes: [2001, 2009, 2013, 2020, 2024], colores: ['#2b2340', '#4a3778', '#6c4fb0', '#9170d6', '#c4a8f4', '#efe4ff'], valor: (m, _b, years?: number[]) => { let bi = -1, bv = -1; m.pop.forEach((v, i) => { if (v != null && v >= bv) { bv = v; bi = i } }); return bi < 0 ? null : (years ?? YEARS)[bi] }, fmt: v => String(v), nota: 'El año en que el municipio tuvo más habitantes desde 1996. Los más oscuros llevan décadas perdiendo gente; los más claros siguen creciendo.' },
  ratio: { nombre: 'Hombres por cada 100 mujeres', corto: 'Hombres/mujeres', unidad: 'hombres por 100 mujeres', cortes: [92, 97, 103, 110, 120, 140], colores: ['#d95926', '#a85434', '#4a5560', '#30577f', '#3168ad', '#3987e5', '#7fb3ff'], valor: m => (m.h && m.m ? (m.h / m.m) * 100 : null), fmt: v => nf(v, 0), nota: 'En los pueblos que se vacían suelen quedar más hombres: las mujeres jóvenes se marchan antes.' },
}

let BASE = 4 // índice del año 2000 en la serie (1996 = 0); se fija al cargar
let YEARS: number[] = []
export const setYears = (y: number[]) => { YEARS = y; BASE = Math.max(0, y.indexOf(2000)) }
export const valorDe = (k: Metrica, m: Muni) => METRICAS[k].valor(m, BASE)
export function colorDe(k: Metrica, m: Muni) {
  const def = METRICAS[k], v = def.valor(m, BASE)
  if (v == null || !def.colores.length) return '#1b2a33'
  let i = 0; while (i < def.cortes.length && v >= def.cortes[i]) i++
  return def.colores[i]
}
