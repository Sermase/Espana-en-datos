// Cuentas públicas: ingresos, gastos por función y por tipo, déficit y deuda de las administraciones públicas (Eurostat, SEC 2010).
// Escribe public/cuentas/data/cuentas.json y el resumen de la portada. Uso: node scripts/cuentas.mjs (Node 20+, sin dependencias)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/cuentas/data/cuentas.json')
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function get(url) {
  for (let i = 0; i < 5; i++) {
    await espera(1200)
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)', Accept: 'application/json' } })
      const txt = await r.text()
      if (r.status === 404 || r.status === 400) throw Object.assign(new Error(`HTTP ${r.status} ` + txt.slice(0, 200)), { final: true })
      if (!r.ok || txt.trimStart().startsWith('<')) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 120))
      return JSON.parse(txt)
    } catch (e) { if (e.final || i === 4) throw e; await espera(6000 * (i + 1)) }
  }
}
/** Eurostat JSON-stat → filas { dim: código, …, time, v } */
async function filas(code, filtros) {
  const qs = new URLSearchParams({ format: 'JSON', lang: 'EN' })
  for (const [k, v] of Object.entries(filtros)) for (const x of [].concat(v)) qs.append(k, x)
  const j = await get(`${ES}/${code}?${qs}`)
  const ids = j.id, size = j.size
  const cats = ids.map(d => Object.entries(j.dimension[d].category.index).sort((a, b) => a[1] - b[1]).map(([k]) => k))
  const stride = ids.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1))
  return Object.entries(j.value).map(([flat, v]) => {
    let rest = Number(flat); const f = { v: +Number(v).toFixed(1) }
    ids.forEach((d, i) => { const c = Math.floor(rest / stride[i]); rest %= stride[i]; f[d] = cats[i][c] })
    return f
  })
}
/** filas → { [a]: { [b]: { año: v } } } */
const anidar = (fs, ...claves) => {
  const o = {}
  for (const f of fs) { let n = o; for (const k of claves) n = (n[f[k]] ??= {}); n[f.time] = f.v }
  return o
}
let previo = {}; try { previo = JSON.parse(readFileSync(OUT, 'utf8')) } catch {}
const out = { fecha: new Date().toISOString().slice(0, 10) }
async function paso(id, fn) {
  try { out[id] = await fn(); log[id] = 'ok ' + JSON.stringify(out[id]).length + ' bytes' }
  catch (e) { log[id] = 'ERROR ' + String(e.message).slice(0, 300); if (previo[id]) { out[id] = previo[id]; log[id] += ' · se conserva lo anterior' } }
}
const SECT = ['S13', 'S1311', 'S1312', 'S1313', 'S1314']
const desde = { sinceTimePeriod: '1995' }

// Ingresos por tipo (consolidados del total de administraciones)
await paso('ing', async () => anidar(await filas('gov_10a_main', { geo: 'ES', unit: 'MIO_EUR', sector: 'S13', na_item: ['TR', 'D2REC', 'D5REC', 'D61REC', 'P11_P12_P131', 'D4REC', 'D7REC', 'D9REC', 'D39REC'], ...desde }), 'na_item'))
// Impuestos uno a uno
await paso('imp', async () => anidar(await filas('gov_10a_taxag', { geo: 'ES', unit: 'MIO_EUR', sector: 'S13', na_item: ['D2', 'D211', 'D214', 'D29', 'D5', 'D51A', 'D51B', 'D51A_C1', 'D51B_C2', 'D51C', 'D59', 'D91', 'D61', 'D611', 'D613'], ...desde }), 'na_item'))
// Gasto por tipo
await paso('eco', async () => anidar(await filas('gov_10a_main', { geo: 'ES', unit: 'MIO_EUR', sector: SECT, na_item: ['TE', 'D1PAY', 'P2', 'D62PAY', 'D632PAY', 'D41PAY', 'D3PAY', 'P51G', 'D7PAY', 'D9PAY', 'TR', 'B9'], ...desde }), 'sector', 'na_item'))
// Gasto por función: el total con todas las subfunciones; cada administración, las diez grandes
await paso('fun', async () => anidar(await filas('gov_10a_exp', { geo: 'ES', unit: 'MIO_EUR', sector: 'S13', na_item: 'TE', ...desde }), 'cofog99'))
await paso('funSec', async () => anidar(await filas('gov_10a_exp', { geo: 'ES', unit: 'MIO_EUR', sector: SECT.slice(1), na_item: 'TE', cofog99: ['TOTAL', 'GF01', 'GF02', 'GF03', 'GF04', 'GF05', 'GF06', 'GF07', 'GF08', 'GF09', 'GF10'], ...desde }), 'sector', 'cofog99'))
// Deuda por administración (en millones) y PIB
await paso('deuda', async () => anidar(await filas('gov_10dd_edpt1', { geo: 'ES', unit: 'MIO_EUR', sector: SECT, na_item: 'GD', ...desde }), 'sector'))
await paso('pib', async () => anidar(await filas('nama_10_gdp', { geo: 'ES', unit: 'CP_MEUR', na_item: 'B1GQ', ...desde }), 'geo').ES)
await paso('pob', async () => anidar(await filas('demo_gind', { geo: 'ES', indic_de: 'AVG', ...desde }), 'geo').ES)
// Europa: gasto por función, ingresos, gasto, déficit y deuda en % del PIB
const UE = ['ES', 'EU27_2020', 'DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'IE', 'EL', 'PL']
await paso('ueFun', async () => anidar(await filas('gov_10a_exp', { geo: UE, unit: 'PC_GDP', sector: 'S13', na_item: 'TE', cofog99: ['TOTAL', 'GF01', 'GF02', 'GF03', 'GF04', 'GF05', 'GF06', 'GF07', 'GF08', 'GF09', 'GF10'], sinceTimePeriod: '2015' }), 'geo', 'cofog99'))
await paso('ueTot', async () => anidar(await filas('gov_10a_main', { geo: UE, unit: 'PC_GDP', sector: 'S13', na_item: ['TR', 'TE', 'B9'], sinceTimePeriod: '2015' }), 'geo', 'na_item'))
await paso('ueDeuda', async () => anidar(await filas('gov_10dd_edpt1', { geo: UE, unit: 'PC_GDP', sector: 'S13', na_item: 'GD', sinceTimePeriod: '2015' }), 'geo'))

mkdirSync(here('../public/cuentas/data'), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))
// Resumen para la portada: el último año con gasto total
try {
  const te = out.eco?.S13?.TE ?? {}, tr = out.eco?.S13?.TR ?? {}
  const a = Object.keys(te).sort().at(-1)
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  res.cuentas = { año: a, gasto: te[a], ingreso: tr[a], pib: out.pib?.[a], deuda: out.deuda?.S13?.[Object.keys(out.deuda?.S13 ?? {}).sort().at(-1)] }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log._resumen = String(e.message) }
writeFileSync(here('../fuentes/cuentas-log.json'), JSON.stringify(log, null, 1))
console.log(log)
