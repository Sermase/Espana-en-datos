// Sonda para Turismo (y Sanidad): operaciones y tablas del INE, muestras de series y dimensiones de Eurostat.
// Escribe fuentes/sonda-turismo.json. Solo se ejecuta al subir un commit con [sonda].
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = { fecha: new Date().toISOString(), ops: [], tablas: {}, muestras: {}, eurostat: {} }
const j = async (u, t = 60) => { const r = await fetch(u, { signal: AbortSignal.timeout(t * 1000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }
const INE = 'https://servicios.ine.es/wstempus/js/ES'

try {
  const ops = await j(`${INE}/OPERACIONES_DISPONIBLES`)
  out.todas = ops.length
  const re = /tur|fronter|hotel|camping|alojamiento|albergue|rural|defunc|mortal|salud|hospital|sanitari|morbilidad|esperanza de vida/i
  out.ops = ops.filter(o => re.test(o.Nombre) || /FRONTUR|EGATUR|EOH|EOAC|EOAP|EOTR|EOAL|ETR|IPAP|ECM|EMH/i.test(o.Codigo ?? '')).map(o => [o.Id, o.Codigo, o.Nombre])
  for (const [id, cod] of out.ops) {
    try { out.tablas[`${id} ${cod}`] = (await j(`${INE}/TABLAS_OPERACION/${id}`)).map(t => [t.Id, t.Nombre, t.Anyo_Periodo_ini, String(t.FechaRef_fin ?? '').slice(0, 10)]) } catch (e) { out.tablas[`${id} ${cod}`] = String(e.message) }
  }
  // muestras: las tablas de FRONTUR, EGATUR, EOH, apartamentos, campings, rural y viviendas turísticas que hablan de país, comunidad o gasto
  const cand = []
  for (const [k, ts] of Object.entries(out.tablas)) {
    if (!Array.isArray(ts) || !/FRONTUR|EGATUR|EOH|EOAP|EOAC|EOTR|EOAL|ETR|ECM|tur/i.test(k)) continue
    for (const t of ts) if (/pa[ií]s|comunidad|gasto|residencia|provinc|total nacional|puntos tur|v[ií]a de acceso|motivo|alojamiento|plazas|causa|grupos de causas/i.test(t[1])) cand.push(t[0])
  }
  out.candidatas = cand.length
  for (const t of cand.slice(0, 45)) {
    try { const d = await j(`${INE}/DATOS_TABLA/${t}?nult=1`); out.muestras[t] = { n: d.length, series: d.slice(0, 18).map(s => `${s.Nombre} = ${s.Data?.[0]?.Valor} (${s.Data?.[0]?.Anyo}${s.Data?.[0]?.FK_Periodo ? '/' + s.Data[0].FK_Periodo : ''})`) } } catch (e) { out.muestras[t] = String(e.message) }
  }
} catch (e) { out.error = String(e.message) }

const ES = ['tour_occ_nim', 'tour_occ_ninat', 'tour_occ_nin2', 'tour_occ_arn2', 'tour_occ_arnraw', 'tour_occ_ninraw', 'tour_cap_nat', 'tour_cap_nuts2', 'tour_dem_tttot', 'tour_dem_extot', 'tour_dem_ttmd', 'tour_ce_omr', 'tour_ce_oan', 'tour_ce_omn12', 'tour_ce_oarn',
  'demo_r_mlifexp', 'demo_mlexpec', 'hlth_cd_aro', 'hlth_cd_asdr2', 'hlth_rs_prsrg', 'hlth_rs_physreg', 'hlth_rs_bdsrg2', 'hlth_rs_bds1', 'hlth_sha11_hf', 'hlth_silc_08', 'hlth_ehis_bm1e', 'hlth_co_disch2', 'hlth_cd_apr']
for (const c of ES) {
  try {
    const d = await j(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${c}?lang=en&geo=ES&lastTimePeriod=1`, 90)
    out.eurostat[c] = { label: d.label, dims: Object.fromEntries(d.id.map(k => { const cat = d.dimension[k].category, ids = Object.keys(cat.index); return [k, ids.length > 30 ? `${ids.length}: ${ids.slice(0, 30).map(i => `${i}=${cat.label[i]}`).join(' | ')}` : ids.map(i => `${i}=${cat.label[i]}`).join(' | ')] })), valores: Object.keys(d.value).length }
  } catch (e) { out.eurostat[c] = String(e.message) }
}
// comparación europea: noches de no residentes por país (último año)
try {
  const d = await j(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tour_occ_ninat?lang=en&unit=NR&c_resid=FOR&nace_r2=I551-I553&lastTimePeriod=1`, 90)
  const g = d.dimension.geo.category, n = Object.keys(g.index).length
  out.europa = Object.entries(d.value).map(([k, v]) => [g.label[Object.keys(g.index)[+k % n]], v]).sort((a, b) => b[1] - a[1]).slice(0, 15)
} catch (e) { out.europa = String(e.message) }

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-turismo.json'), JSON.stringify(out, null, 1))
console.log('Sonda turismo:', out.ops.length, 'operaciones,', Object.keys(out.muestras).length, 'muestras,', Object.keys(out.eurostat).length, 'Eurostat')
