// Segunda sonda de Vivienda: estructura de las tablas útiles y enlaces de titulares del Catastro. Escribe fuentes/sonda-vivienda2.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const INE = 'https://servicios.ine.es/wstempus/js/ES'
const get = async (u, t = 90) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (espana-en-datos; sonda)' }, signal: AbortSignal.timeout(t * 1000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r }
const out = {}
// 59531: nombres sin municipios (los que no empiezan por 5 dígitos ni 7)
try {
  const d = await (await get(`${INE}/DATOS_TABLA/59531?nult=1`, 120)).json()
  const nombres = d.map(s => s.Nombre)
  out.t59531 = { n: d.length, noMuni: nombres.filter(n => !/^\d{5}/.test(n) && !/^\d{7}/.test(n)).slice(0, 400), ejemploMuni: nombres.filter(n => /^\d{5} /.test(n)).slice(0, 12), data: d.slice(0, 2).map(s => s.Data) }
} catch (e) { out.t59531 = String(e.message) }
for (const t of [59523, 59525, 9997, 76845, 9994, 60181]) {
  try { const d = await (await get(`${INE}/DATOS_TABLA/${t}?nult=3`, 90)).json(); out['t' + t] = { n: d.length, nombres: d.slice(0, 60).map(s => s.Nombre + ' | ' + JSON.stringify((s.Data || []).slice(-3).map(x => [x.Anyo, x.FK_Periodo, x.Valor]))) } } catch (e) { out['t' + t] = String(e.message) }
}
// Catastro en datos.gob.es: distribuciones
for (const u of ['https://datos.gob.es/es/catalogo/e05250001-estadisticas-catastrales-catastro-inmobiliario-titulares', 'https://datos.gob.es/es/catalogo/e05250001-estadisticas-catastrales-catastro-inmobiliario-bienes-inmuebles-urbanos', 'https://www.catastro.hacienda.gob.es/estadisticas/estadisticas.html', 'https://www.catastro.hacienda.gob.es/esp/estadisticas.asp']) {
  try {
    const t = await (await get(u)).text()
    out[u] = [...new Set([...t.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]))].filter(h => /catastro|\.csv|\.xls|\.zip|\.json|distribution|download/i.test(h) && !/linkedin|twitter|x\.com|wa\.me/.test(h)).slice(0, 120)
  } catch (e) { out[u] = String(e.message) }
}
for (const u of ['https://www.catastro.hacienda.gob.es/estadisticas/estadisticas.html']) {
  try { const t = await (await get(u)).text(); out.catastroHtml = t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000) } catch (e) { out.catastroHtml = String(e.message) }
}
writeFileSync(here('../fuentes/sonda-vivienda2.json'), JSON.stringify(out, null, 1))
console.log('ok')
