// Vivienda: precios de compra, alquiler, compraventas e hipotecas, por comunidad, provincia y municipio.
// Fuentes: INE (API JSON) y Ministerio de Vivienda (valor tasado, Excel). Primera pasada: también registra
// la estructura de cada fuente en fuentes/vivienda-log.json para ajustar filtros.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
mkdirSync(here('../public/vivienda/data/'), { recursive: true })
const OUT = here('../public/vivienda/data/vivienda.json')
const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return {} } })()
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES'

async function get(url, tipo = 'json') {
  for (let i = 0; i < 3; i++) {
    await espera(700)
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return tipo === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer())
    } catch (e) { if (i === 2) throw e; await espera(3000 * (i + 1)) }
  }
}
/** Tabla del INE → [{ nombre, datos: [[periodo, valor]] }] */
async function tabla(id, nult = 200) {
  const j = await get(`${INE}/DATOS_TABLA/${id}?nult=${nult}`)
  return j.map(s => ({ nombre: s.Nombre, datos: (s.Data ?? []).filter(d => d.Valor != null).map(d => [periodo(d), +Number(d.Valor).toFixed(3)]).reverse() }))
}
const periodo = (d) => { const a = d.Anyo, p = d.FK_Periodo; if (p >= 1 && p <= 12) return `${a}-${String(p).padStart(2, '0')}`; if (p >= 19 && p <= 22) return `${a}-T${p - 18}`; return String(a) }

// --- 1) Sondas de tablas del INE candidatas: nombre de las primeras series ---
const candidatas = { ipv_ccaa: [25171, 25168, 25173], compraventas: [6150, 6151, 6149], hipotecas: [13896, 3200, 13894], alquiler: [59057, 59058, 59059, 59060, 59061, 59062] }
const ok = {}
for (const [k, ids] of Object.entries(candidatas)) for (const id of ids) {
  try {
    const t = await tabla(id, 1)
    log[`sonda ${k} ${id}`] = `${t.length} series · ${t.slice(0, 4).map(s => s.nombre).join(' | ')}`
    ok[k] ??= []; ok[k].push(id)
  } catch (e) { log[`sonda ${k} ${id}`] = 'ERROR ' + e.message }
}

// --- 2) Ministerio de Vivienda: valor tasado medio de la vivienda libre (€/m²) ---
for (const [k, url] of [['tasado_prov', 'https://apps.fomento.gob.es/BoletinOnline2/sedal/35101000.XLS'], ['tasado_mun', 'https://apps.fomento.gob.es/BoletinOnline2/sedal/35103500.XLS']]) {
  try {
    const wb = XLSX.read(await get(url, 'bin'))
    log['_' + k] = Object.fromEntries(wb.SheetNames.slice(0, 4).map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }).slice(0, 18).map(f => f.slice(0, 12).join(' | ')).join('\n')]))
    log['_' + k + '_hojas'] = wb.SheetNames.length + ': ' + wb.SheetNames.slice(0, 40).join(', ')
  } catch (e) { log['_' + k] = 'ERROR ' + e.message }
}

// --- 3) Descarga de lo que ya sabemos usar (las tablas que hayan respondido) ---
const datos = { fecha: new Date().toISOString() }
for (const [k, ids] of Object.entries(ok)) {
  try { const t = await tabla(ids[0], 400); datos[k] = { tabla: ids[0], series: t }; log[k] = `${ids[0]}: ${t.length} series, ${t[0]?.datos.length} datos, último ${JSON.stringify(t[0]?.datos.at(-1))}` }
  catch (e) { datos[k] = prev[k] ?? null; log[k] = 'ERROR ' + e.message }
}
writeFileSync(OUT, JSON.stringify(datos))
writeFileSync(here('../fuentes/vivienda-log.json'), JSON.stringify(log, null, 1))
console.log('Vivienda:', Object.keys(ok).join(', '))
