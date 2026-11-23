// Comercio exterior de España (bienes): con qué países y qué productos, desde Comext (Eurostat).
// Escribe public/comercio/data/comercio.json y fuentes/comercio-log.json. Si algo falla, conserva lo anterior.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
mkdirSync(here('../public/comercio/data/'), { recursive: true })
const OUT = here('../public/comercio/data/comercio.json')
const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return null } })()
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const CX = 'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/'

async function get(url) {
  for (let i = 0; i < 4; i++) {
    await espera(1500)
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      const t = await r.text()
      if (r.status === 404 || r.status === 400) throw Object.assign(new Error('HTTP ' + r.status + ' ' + t.slice(0, 160)), { final: true })
      if (!r.ok || t.trimStart().startsWith('<')) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 100))
      return JSON.parse(t)
    } catch (e) { if (e.final || i === 3) throw e; await espera(8000 * (i + 1)) }
  }
}
/** JSON-stat → filas { dims..., time, v } */
function filas(j) {
  const ids = j.id, size = j.size
  const cats = ids.map(d => Object.entries(j.dimension[d].category.index).sort((a, b) => a[1] - b[1]).map(([k]) => k))
  const stride = ids.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1)), out = []
  for (const [flat, val] of Object.entries(j.value ?? {})) {
    let r = Number(flat); const f = { v: Number(val) }
    ids.forEach((d, i) => { const q = Math.floor(r / stride[i]); r %= stride[i]; f[d] = cats[i][q] })
    out.push(f)
  }
  return { out, labels: Object.fromEntries(ids.map(d => [d, j.dimension[d].category.label])) }
}
async function consulta(ds, p) {
  const qs = new URLSearchParams({ format: 'JSON', lang: 'EN' })
  for (const [k, v] of Object.entries(p)) for (const x of [].concat(v)) qs.append(k, x)
  return filas(await get(CX + ds + '?' + qs))
}

const AÑO = new Date().getFullYear()
const años = Array.from({ length: 10 }, (_, i) => String(AÑO - 10 + i)) // los últimos años cerrados
// Pruebas de forma de consulta (Comext cambia a veces de convenciones); se queda la primera que da datos.
const formas = [
  { ds: 'DS-045409', p: { reporter: 'ES', product: 'TOTAL', flow: ['1', '2'], indicators: 'VALUE_IN_EUROS', freq: 'A', time: años.slice(-2) } },
  { ds: 'DS-045409', p: { reporter: 'ES', product: 'TOTAL', flow: ['1', '2'], indicators: 'VALUE_IN_EUROS', time: años.slice(-2).map(a => a + '52') } },
  { ds: 'DS-059341', p: { reporter: 'ES', product: 'TOTAL', flow: ['1', '2'], indicators: 'VALUE_IN_EUROS', freq: 'A', time: años.slice(-2) } },
  { ds: 'DS-045409', p: { reporter: 'ES', product: 'TOTAL', flow: ['1', '2'], indicators: 'VALUE_IN_EUROS', freq: 'M', sinceTimePeriod: `${AÑO - 1}-01` } },
]
let forma = null
for (const f of formas) {
  try { const r = await consulta(f.ds, f.p); log['prueba ' + f.ds + ' ' + JSON.stringify(f.p.time ?? f.p.sinceTimePeriod)] = `${r.out.length} filas · ej. ${JSON.stringify(r.out[0])}`; if (r.out.length > 20) { forma = f; break } }
  catch (e) { log['prueba ' + f.ds + ' ' + JSON.stringify(f.p.time ?? f.p.sinceTimePeriod)] = 'ERROR ' + String(e.message).slice(0, 200) }
}

let datos = null
if (forma) {
  try {
    const base = { ...forma.p }; delete base.time; delete base.sinceTimePeriod
    const anual = forma.p.freq === 'A' || !forma.p.freq
    const t = forma.p.freq === 'M' ? { sinceTimePeriod: `${AÑO - 10}-01` } : { time: forma.p.time[0].length > 4 ? años.map(a => a + '52') : años }
    // 1) por país: todos los socios, total de productos, 10 años
    const pais = await consulta(forma.ds, { ...base, ...t })
    // 2) por producto (capítulos HS2) con el mundo, últimos 3 años
    const capitulos = Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0')).filter(c => c !== '77')
    const prod = await consulta(forma.ds, { ...base, product: capitulos, partner: ['WORLD', 'EXT_EU27_2020', 'INT_EU27_2020'].slice(0, 1), ...(forma.p.freq === 'M' ? { sinceTimePeriod: `${AÑO - 3}-01` } : { time: t.time.slice(-3) }) }).catch(async e => { log.prod_world = String(e.message).slice(0, 120); return consulta(forma.ds, { ...base, product: capitulos, ...(forma.p.freq === 'M' ? { sinceTimePeriod: `${AÑO - 2}-01` } : { time: t.time.slice(-2) }) }) })
    const yr = (x) => String(x).slice(0, 4)
    // Agregar: años → { socio: { imp, exp } }
    const porPais = {}
    for (const f of pais.out) { if (f.indicators && f.indicators !== 'VALUE_IN_EUROS') continue; const y = yr(f.time); const o = ((porPais[y] ??= {})[f.partner] ??= { imp: 0, exp: 0 }); o[f.flow === '1' ? 'imp' : 'exp'] += f.v }
    const porProd = {}
    for (const f of prod.out) { if (f.indicators && f.indicators !== 'VALUE_IN_EUROS') continue; const y = yr(f.time); const o = ((porProd[y] ??= {})[f.product] ??= { imp: 0, exp: 0 }); o[f.flow === '1' ? 'imp' : 'exp'] += f.v }
    datos = { forma: forma.ds, anual, socios: pais.labels.partner, productos: prod.labels.product, porPais, porProd }
    log.resultado = { años: Object.keys(porPais), socios: Object.keys(porPais[Object.keys(porPais).at(-1)] ?? {}).length, productos: Object.keys(porProd[Object.keys(porProd).at(-1)] ?? {}).length }
  } catch (e) { log.error = String(e.message).slice(0, 300) }
}
const out = datos ? { fecha: new Date().toISOString(), ...datos } : prev
if (out) writeFileSync(OUT, JSON.stringify(out))
writeFileSync(here('../fuentes/comercio-log.json'), JSON.stringify(log, null, 1))
console.log('Comercio:', datos ? 'ok' : 'sin datos nuevos')
