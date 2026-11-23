// Energía, lo que va más allá del sistema eléctrico diario:
// · componentes del precio (mercado diario, intradiario, servicios de ajuste, capacidad) — REE, mensual
// · intercambios de electricidad por país (Francia, Portugal, Marruecos, Andorra) — REE, mensual
// · índice de consumo de los grandes consumidores (industria, servicios) — REE, mensual
// · consumo de electricidad por sectores (hogares, industria, servicios, transporte) — Eurostat, anual
// · importaciones de gas natural y de crudo por país de origen — Eurostat (mensual) y CORES
// Escribe public/energia/data/extra.json. Lo que falle conserva lo de la última vez.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/energia/data/extra.json')
const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return {} } })()
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const HOY = new Date(), AÑO = HOY.getFullYear()

async function json(url, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    await espera(900)
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      const t = await r.text()
      if (!r.ok || t.trimStart().startsWith('<')) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120))
      return JSON.parse(t)
    } catch (e) { if (i === intentos - 1 || /HTTP 4/.test(e.message)) throw e; await espera(4000 * (i + 1)) }
  }
}
/** REE: { grupo/título: [[AAAA-MM, valor]] } uniendo años. */
async function ree(ruta, desde, trunc = 'month') {
  const out = {}
  for (let a = desde; a <= AÑO; a++) {
    try {
      const j = await json(`https://apidatos.ree.es/es/datos/${ruta}?start_date=${a}-01-01T00:00&end_date=${a === AÑO ? HOY.toISOString().slice(0, 10) : a + '-12-31'}T23:59&time_trunc=${trunc}`)
      const meter = (it, pre) => {
        const at = it.attributes ?? {}, nom = pre ? `${pre}/${at.title}` : at.title
        if (at.values?.length) for (const v of at.values) (out[nom] ??= []).push([v.datetime.slice(0, 7), Math.round(v.value * 100) / 100])
        for (const c of at.content ?? []) meter(c, at.title ?? it.type)
      }
      for (const it of j.included ?? []) meter(it)
    } catch (e) { (log['_fallos_' + ruta] ??= []).push(a + ': ' + String(e.message).slice(0, 60)) }
  }
  if (!Object.keys(out).length) throw new Error('sin datos')
  return out
}
/** Eurostat JSON-stat → { clave de `varia`: [[periodo, valor]] }. */
async function eurostat(code, filtros, varia) {
  const qs = new URLSearchParams({ format: 'JSON', lang: 'EN' })
  for (const [k, v] of Object.entries(filtros)) for (const x of [].concat(v)) qs.append(k, x)
  const j = await json(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${code}?${qs}`)
  const ids = j.id, size = j.size, pos = (d) => Object.entries(j.dimension[d].category.index).sort((a, b) => a[1] - b[1]).map(([k]) => k)
  const T = pos('time'), C = pos(varia), iT = ids.indexOf('time'), iV = ids.indexOf(varia)
  const stride = ids.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1)), out = {}
  for (const [flat, val] of Object.entries(j.value)) {
    let r = Number(flat); const c = ids.map((_, i) => { const q = Math.floor(r / stride[i]); r %= stride[i]; return q })
    ;(out[C[c[iV]]] ??= []).push([T[c[iT]], +Number(val).toFixed(2)])
  }
  for (const k in out) out[k].sort((a, b) => a[0].localeCompare(b[0]))
  out._labels = j.dimension[varia].category.label
  return out
}
const extra = { fecha: HOY.toISOString() }
async function paso(id, fn) {
  try { extra[id] = await fn(); log[id] = Object.fromEntries(Object.entries(extra[id]).filter(([k]) => k !== '_labels').slice(0, 14).map(([k, v]) => [k, `${v.length} · ${v[0]?.[0]} → ${v.at(-1)?.join(' ')}`])) }
  catch (e) { extra[id] = prev[id] ?? null; log[id] = 'ERROR ' + String(e.message).slice(0, 200) + (prev[id] ? ' · se conserva lo anterior' : '') }
}

await paso('precio_componentes', () => ree('mercados/componentes-precio-energia-cierre-desglose', 2014))
await paso('intercambios', () => ree('intercambios/todas-fronteras-programados', 2010))
await paso('ire', async () => { const g = await ree('demanda/ire-general', 2010), i = await ree('demanda/ire-industria', 2010), s = await ree('demanda/ire-servicios', 2010); return { ...g, ...i, ...s } })
await paso('sectores', () => eurostat('nrg_bal_c', { geo: 'ES', siec: 'E7000', unit: 'GWH', nrg_bal: ['FC_OTH_HH_E', 'FC_IND_E', 'FC_OTH_CP_E', 'FC_TRA_E', 'FC_OTH_AF_E', 'FC_E'], sinceTimePeriod: '2000' }, 'nrg_bal'))
await paso('gas_origen', () => eurostat('nrg_ti_gasm', { geo: 'ES', siec: 'G3000', unit: 'MIO_M3', sinceTimePeriod: '2015-01' }, 'partner'))
await paso('crudo_origen', async () => {
  try { const m = await eurostat('nrg_ti_oilm', { geo: 'ES', siec: 'O4100_TOT', unit: 'THS_T', sinceTimePeriod: '2015-01' }, 'partner'); if (Object.keys(m).length > 3) return m } catch (e) { log._crudo_mensual = String(e.message).slice(0, 100) }
  return eurostat('nrg_ti_oil', { geo: 'ES', siec: 'O4100_TOT', unit: 'THS_T', sinceTimePeriod: '2005' }, 'partner')
})

// CORES: hojas de cálculo oficiales (gas por gasoducto o barco; crudo por país). De momento se registra su estructura.
for (const [id, url] of [['cores_crudo', 'https://www.cores.es/sites/default/files/archivos/estadisticas/importaciones-crudo.xlsx'], ['cores_gas', `https://www.cores.es/sites/default/files/archivos/estadisticas/est-gas-cdm-${AÑO}.xls`], ['cores_gas_ant', `https://www.cores.es/sites/default/files/archivos/estadisticas/est-gas-cdm-${AÑO - 1}.xls`]]) {
  try {
    await espera(1000)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos)' } })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const wb = XLSX.read(Buffer.from(await r.arrayBuffer()))
    log['_' + id] = Object.fromEntries(wb.SheetNames.slice(0, 12).map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }).slice(0, 14).map(f => f.slice(0, 16).join(' | ')).join('\n')]))
  } catch (e) { log['_' + id] = 'ERROR ' + e.message }
}

writeFileSync(OUT, JSON.stringify(extra))
writeFileSync(here('../fuentes/energia-extra-log.json'), JSON.stringify(log, null, 1))
console.log('Energía extra:', Object.entries(log).filter(([, v]) => typeof v === 'string' && v.startsWith('ERROR')).map(([k]) => k).join(', ') || 'todo bien')
