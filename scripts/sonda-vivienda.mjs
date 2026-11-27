// Sonda para las nuevas secciones de Vivienda: Censo 2021 (viviendas vacías y tenencia), ECV/ETDP/EPF (tenencia, otras viviendas, compradores
// personas jurídicas), Eurostat (tenencia) y Catastro (titulares). Escribe fuentes/sonda-vivienda.json. Solo con un commit [sonda].
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = { fecha: new Date().toISOString(), censo: {}, ops: {}, eurostat: {}, catastro: {} }
const get = async (u, t = 60) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (espana-en-datos; sonda)' }, signal: AbortSignal.timeout(t * 1000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r }
const INE = 'https://servicios.ine.es/wstempus/js/ES'

// 1. Censo 2021: tablas 59500-59560, primeras series
for (let t = 59500; t <= 59560; t++) {
  try {
    const d = await (await get(`${INE}/DATOS_TABLA/${t}?nult=1`, 40)).json()
    out.censo[t] = { n: d.length, series: d.slice(0, 4).map(s => `${s.Nombre} = ${s.Data?.[0]?.Valor} (${s.Data?.[0]?.Anyo})`) }
  } catch (e) { out.censo[t] = String(e.message) }
}
// 2. Operaciones que hablan de vivienda, tenencia o compradores
try {
  const ops = await (await get(`${INE}/OPERACIONES_DISPONIBLES`)).json()
  const re = /vivienda|condiciones de vida|presupuestos familiares|transmisiones|hogares|censo|catastro|construcci/i
  for (const o of ops.filter(o => re.test(o.Nombre))) {
    try {
      const ts = await (await get(`${INE}/TABLAS_OPERACION/${o.Id}`, 40)).json()
      out.ops[`${o.Id} ${o.Codigo} ${o.Nombre}`] = ts.filter(t => /tenencia|propiedad|otras? vivienda|vac[ií]a|persona jur[ií]dica|segunda|jur[ií]dic|nacionalidad del (comprador|adquirente)|pa[ií]s de residencia|n[úu]mero de viviendas|iniciadas|terminadas|visados|licencias|alquiler/i.test(t.Nombre)).slice(0, 40).map(t => [t.Id, t.Nombre, t.Anyo_Periodo_ini, String(t.FechaRef_fin ?? '').slice(0, 10)])
    } catch (e) { out.ops[`${o.Id} ${o.Codigo}`] = String(e.message) }
  }
} catch (e) { out.ops = String(e.message) }
// 3. Eurostat: dimensiones de los conjuntos de tenencia y vivienda
for (const c of ['ilc_lvho02', 'ilc_lvho01', 'ilc_lvho03', 'ilc_lvho05a', 'ilc_lvho07a', 'ilc_lvho15', 'ilc_lvho50a', 'ilc_mded01', 'cens_21dwoc', 'cens_21dwtp', 'cens_21hhtn', 'cens_21ho', 'hbs_exp_t121', 'prc_hpi_a']) {
  try {
    const d = await (await get(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${c}?lang=en&geo=ES&lastTimePeriod=1`, 90)).json()
    out.eurostat[c] = { label: d.label, dims: Object.fromEntries(d.id.map(k => { const cat = d.dimension[k].category, ids = Object.keys(cat.index); return [k, ids.slice(0, 40).map(i => `${i}=${cat.label[i]}`).join(' | ') + (ids.length > 40 ? ` …(${ids.length})` : '')] })), valores: Object.keys(d.value ?? {}).length }
  } catch (e) { out.eurostat[c] = String(e.message) }
}
// 4. Catastro: páginas de estadística y enlaces a CSV de titulares
for (const u of ['https://www.catastro.hacienda.gob.es/esp/estadisticas.asp', 'https://www.catastro.hacienda.gob.es/webinet/estadisticas.htm', 'https://datos.gob.es/en/catalogo/e05250001-estadisticas-catastrales-catastro-inmobiliario-titulares', 'https://www.catastro.hacienda.gob.es/documentos/estadisticas/metodologia_titulares.pdf']) {
  try {
    const r = await get(u, 60), t = await r.text()
    const enlaces = [...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => /csv|xls|zip|titular|propiedad|altas|estadistic/i.test(h)).slice(0, 80)
    out.catastro[u] = { tipo: r.headers.get('content-type'), bytes: t.length, enlaces, inicio: /pdf/.test(u) ? '' : t.replace(/\s+/g, ' ').slice(0, 300) }
  } catch (e) { out.catastro[u] = String(e.message) }
}
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-vivienda.json'), JSON.stringify(out, null, 1))
console.log('ok')
