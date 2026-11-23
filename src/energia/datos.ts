import { useEffect, useState } from 'react'

/** Serie aplanada de REE: [fecha ISO hasta minutos, valor, fracción del total o null]. */
export type S = { color?: string; tipo?: string | null; total?: boolean; v: [string, number, number | null][] }
export type Grupo = Record<string, S>
export type FilaTR = Record<string, number | string> & { ts: string; dem: number }
export type Hoy = { fecha: string; tr?: FilaTR[] | null; demanda: Grupo | null; precios: Grupo | null; balance: Grupo | null; co2: Grupo | null; mix30: Grupo | null; mix?: Grupo | null }
export type Historia = { fecha: string; mix_mes: Grupo | null; renovable_mes: Grupo | null; demanda_mes: Grupo | null; co2_mes: Grupo | null; intercambios_mes?: Grupo | null; precio_dia?: Grupo | null; potencia?: Grupo | null }

const get = <T,>(f: string) => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.json() as Promise<T> })
export function useEnergia() {
  const [hoy, setHoy] = useState<Hoy | null>(null), [hist, setHist] = useState<Historia | null>(null), [err, setErr] = useState(false)
  useEffect(() => {
    get<Hoy>('./data/hoy.json').then(setHoy, () => setErr(true))
    get<Historia>('./data/historia.json').then(setHist, () => {})
  }, [])
  return { hoy, hist, err, setHoy }
}

// ---- lo de hoy, en directo desde la API pública de REE (permite pedirla desde el navegador) ----
const API = 'https://apidatos.ree.es/es/datos/'
export async function ree(ruta: string, desde: string, hasta: string, trunc: string): Promise<Grupo> {
  const r = await fetch(`${API}${ruta}?start_date=${desde}&end_date=${hasta}&time_trunc=${trunc}`)
  if (!r.ok) throw new Error(String(r.status))
  const j = await r.json(), out: Grupo = {}
  const meter = (it: { attributes?: { title: string; color?: string; values?: { datetime: string; value: number; percentage?: number }[]; content?: unknown[] }; content?: unknown[] }) => {
    const a = it.attributes
    if (a?.values?.length) out[a.title] = { color: a.color, v: a.values.map(x => [x.datetime.slice(0, 16), x.value, x.percentage ?? null]) }
    for (const c of (a?.content ?? it.content ?? []) as typeof it[]) meter(c)
  }
  for (const it of j.included ?? []) meter(it)
  return out
}
export const dia = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(d)
/** Generación peninsular cada 10 minutos: REE la sirve en JSONP (sin CORS), así que se pide con una etiqueta script. */
export function tiempoReal(fecha: string) {
  return new Promise<FilaTR[]>((ok, ko) => {
    const cb = `__ree${Date.now()}`, sc = document.createElement('script')
    const fin = () => { delete (window as never as Record<string, unknown>)[cb]; sc.remove() }
    ;(window as never as Record<string, unknown>)[cb] = (j: { valoresHorariosGeneracion?: FilaTR[] }) => { fin(); ok((j.valoresHorariosGeneracion ?? []).filter(f => f.ts.startsWith(fecha))) }
    sc.onerror = () => { fin(); ko(new Error('REE')) }
    sc.src = `https://demanda.ree.es/WSvisionaMovilesPeninsulaRest/resources/demandaGeneracionPeninsula?callback=${cb}&curva=DEMANDAAU&fecha=${fecha}`
    document.head.appendChild(sc)
    setTimeout(() => { fin(); ko(new Error('tiempo')) }, 15000)
  })
}
/** Columnas de la web de REE que forman cada tecnología (sol ya suma fotovoltaica y térmica). */
const TR: Record<Tec, string[]> = { eolica: ['eol'], solar: ['sol'], hidraulica: ['hid', 'turb'], otras_ren: ['bio', 'termRenov'], nuclear: ['nuc'], ciclo: ['cc'], cogeneracion: ['cogenResto'], carbon: ['car'], resto: ['gf', 'vap'] }
export function agruparTR(f: FilaTR[] | null | undefined) {
  if (!f?.length) return null
  const filas = f.filter(x => TEC.some(t => TR[t.id].some(k => Number(x[k]) > 0)))
  if (filas.length < 2) return null
  const xs = filas.map(x => Date.parse(x.ts.replace(' ', 'T') + ':00Z'))
  const capas = TEC.map(t => ({ ...t, v: filas.map(x => TR[t.id].reduce((s, k) => s + Math.max(0, Number(x[k]) || 0), 0)) })).filter(c => c.v.some(v => v > 0))
  return { xs, capas, dem: filas.map(x => Number(x.dem)) }
}

/** Refresca demanda y precios cada 5 minutos; si REE no responde, se queda lo descargado por el robot. */
export function useVivo(setHoy: (f: (h: Hoy | null) => Hoy | null) => void) {
  const [vivo, setVivo] = useState<Date | null>(null)
  useEffect(() => {
    let parar = false
    const tick = async () => {
      const hoy = dia(new Date()), ayer = dia(new Date(Date.now() - 864e5)), mañana = dia(new Date(Date.now() + 864e5))
      try {
        const [demanda, precios, tr] = await Promise.all([
          ree('demanda/demanda-tiempo-real', `${hoy}T00:00`, `${hoy}T23:59`, 'hour'),
          ree('mercados/precios-mercados-tiempo-real', `${ayer}T00:00`, `${mañana}T23:59`, 'hour'),
          tiempoReal(hoy).catch(() => null),
        ])
        if (parar) return
        setHoy(h => h && { ...h, demanda: Object.keys(demanda).length ? demanda : h.demanda, precios: Object.keys(precios).length ? precios : h.precios, tr: tr?.length ? tr : h.tr })
        setVivo(new Date())
      } catch { /* se queda la copia */ }
    }
    tick(); const id = setInterval(tick, 5 * 60e3)
    return () => { parar = true; clearInterval(id) }
  }, [setHoy])
  return vivo
}

// ---- tecnologías, agrupadas para que el gráfico se lea (REE da ~17) ----
export type Tec = 'eolica' | 'solar' | 'hidraulica' | 'nuclear' | 'ciclo' | 'cogeneracion' | 'carbon' | 'otras_ren' | 'resto'
export const TEC: { id: Tec; nombre: string; color: string; ren: boolean; de: string[] }[] = [
  { id: 'eolica', nombre: 'Eólica', color: '#2fc6b3', ren: true, de: ['Eólica', 'Hidroeólica'] },
  { id: 'solar', nombre: 'Solar', color: '#f5c518', ren: true, de: ['Solar fotovoltaica', 'Solar térmica'] },
  { id: 'hidraulica', nombre: 'Hidráulica', color: '#3987e5', ren: true, de: ['Hidráulica', 'Turbinación bombeo'] },
  { id: 'otras_ren', nombre: 'Otras renovables', color: '#199e70', ren: true, de: ['Otras renovables', 'Residuos renovables'] },
  { id: 'nuclear', nombre: 'Nuclear', color: '#9085e9', ren: false, de: ['Nuclear'] },
  { id: 'ciclo', nombre: 'Ciclo combinado (gas)', color: '#d95926', ren: false, de: ['Ciclo combinado'] },
  { id: 'cogeneracion', nombre: 'Cogeneración', color: '#d55181', ren: false, de: ['Cogeneración'] },
  { id: 'carbon', nombre: 'Carbón', color: '#8b939c', ren: false, de: ['Carbón'] },
  { id: 'resto', nombre: 'Resto no renovable', color: '#5d6f7a', ren: false, de: ['Motores diésel', 'Turbina de gas', 'Turbina de vapor', 'Fuel + Gas', 'Residuos no renovables'] },
]
/** Agrupa un Grupo de REE por tecnología: { xs (fechas), capas por Tec }. */
export function agrupar(g: Grupo | null) {
  if (!g) return null
  const fechas = [...new Set(Object.values(g).flatMap(s => s.v.map(x => x[0])))].sort()
  const idx = new Map(fechas.map((f, i) => [f, i]))
  const capas = TEC.map(t => {
    const v = fechas.map(() => 0)
    for (const n of t.de) for (const [f, x] of g[n]?.v ?? []) v[idx.get(f)!] += x
    return { ...t, v }
  }).filter(c => c.v.some(x => x > 0))
  return { fechas, xs: fechas.map(t => Date.parse(t + ':00Z')), capas }
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
export const fMes = (t: number) => { const d = new Date(t); return `${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const fDia = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}` }
export const fHora = (t: number) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
/** REE manda la hora local de España con su desfase; la pasamos a "UTC falsa" para pintar la hora tal cual. */
export const tLocal = (iso: string) => Date.parse(iso.slice(0, 16) + ':00Z')
