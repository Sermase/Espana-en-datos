// Sonda de fuentes para los temas nuevos (seguridad, aire, hogares, coches, igualdad, turismo, sanidad, naturaleza, cultura).
// Prueba cada dirección desde GitHub Actions y escribe fuentes/sonda-temas.json con estado, tamaño, un trozo y los enlaces útiles.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/sonda-temas'; mkdirSync(tmp, { recursive: true })
const out = {}
let n = 0
function get(url, { max = 90, cabeza = 2500, enlaces = null, cuerpo = false } = {}) {
  const f = `${tmp}/${++n}`
  try {
    const meta = execFileSync('curl', ['-sSL', '--max-time', String(max), '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-o', f, '-w', '%{http_code} %{content_type} %{url_effective}', url], { encoding: 'utf8', timeout: (max + 10) * 1000 })
    const [code, tipo, fin] = meta.split(' ')
    const size = statSync(f).size
    const r = { code: +code, tipo, size, fin: fin !== url ? fin : undefined }
    const bin = /zip|octet|excel|spreadsheet|pdf/.test(tipo ?? '') || /\.(zip|xlsx?|pdf|px)$/i.test(url)
    let txt = ''
    if (!bin || /\.px$/i.test(url)) { const b = readFileSync(f); txt = new TextDecoder(/charset=utf-8/i.test(tipo) ? 'utf-8' : 'latin1').decode(b) }
    if (txt) r.cabeza = txt.slice(0, cabeza)
    if (enlaces && txt) r.enlaces = [...new Set([...txt.matchAll(/(?:href|src)=["']([^"'#]+)["']/gi)].map(m => m[1]).filter(h => enlaces.test(h)))].slice(0, 80)
    if (cuerpo) r.cuerpo = txt
    return r
  } catch (e) { return { error: String(e.message).slice(-300) } }
}
const json = (url) => { const r = get(url, { cabeza: 0, cuerpo: true }); try { return JSON.parse(r.cuerpo) } catch { return { error: r.error ?? `HTTP ${r.code}`, cabeza: r.cuerpo?.slice(0, 300) } } }

// ---------- Seguridad: Portal Estadístico de Criminalidad (JaxiPx, como el antiguo INEbase) ----------
const MIR = 'https://estadisticasdecriminalidad.ses.mir.es'
const px = /\.px|Tabla\.htm|dlgExport|files\/|index\.htm\?/i
for (const p of ['/DatosBalanceAnt/20254/', '/DatosBalanceAnt/20164/', '/DatosBalanceAnt/20262/', '/Datos1/', '/Datos4/'])
  out['mir index ' + p] = get(`${MIR}/sec/dynPx/inebase/index.htm?type=pcaxis&path=${p}&file=pcaxis`, { cabeza: 1500, enlaces: px })
const tabla = '1509011.px'
for (const u of [
  `${MIR}/sec/jaxiPx/Tabla.htm?path=/DatosBalanceAnt/20254/l0/&file=${tabla}&L=0`,
  `${MIR}/sec/jaxiPx/dlgExport.htm?path=/DatosBalanceAnt/20254/l0/&file=${tabla}&nocab=1&L=0`,
  `${MIR}/sec/jaxiPx/files/_px/es/px/DatosBalanceAnt/20254/l0/${tabla}`,
  `${MIR}/sec/jaxiPx/files/_px/es/csv_bdsc/DatosBalanceAnt/20254/l0/${tabla}`,
  `${MIR}/sec/jaxiPx/files/_px/es/csv_c/DatosBalanceAnt/20254/l0/${tabla}`,
]) out['mir ' + u.replace(MIR, '')] = get(u, { cabeza: 3000, enlaces: px })

// ---------- INE: operaciones y sus tablas ----------
try {
  const ops = json('https://servicios.ine.es/wstempus/js/ES/OPERACIONES_DISPONIBLES')
  const quiero = /presupuestos familiares|frontur|egatur|ocupaci[oó]n (hotelera|en apartamentos)|estructura salarial|condiciones de vida|defunciones seg[uú]n la causa|condenados|movimientos tur[ií]sticos|encuesta de turismo de residentes|decil|salarios|brecha|morbilidad|centros sanitarios|esperanza/i
  out.ineOps = (Array.isArray(ops) ? ops : []).filter(o => quiero.test(o.Nombre)).map(o => ({ id: o.Id, cod: o.Codigo, n: o.Nombre }))
  for (const o of out.ineOps.slice(0, 18)) {
    const t = json(`https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/${o.id}`)
    out['ine tablas ' + o.n] = Array.isArray(t) ? t.map(x => `${x.Id} ${x.Nombre}`).slice(0, 120) : t
  }
} catch (e) { out.ineError = String(e.message) }

// ---------- Eurostat: comprobar que existen y qué dimensiones traen ----------
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
for (const [d, q] of [
  ['crim_gen_reg', 'geo=ES&lastTimePeriod=1'], ['crim_off_cat', 'geo=ES&lastTimePeriod=1'],
  ['env_air_gge', 'geo=ES&lastTimePeriod=1&unit=THS_T'], ['env_ac_ainah_r2', 'geo=ES&lastTimePeriod=1'], ['env_air_emis', 'geo=ES&lastTimePeriod=1'],
  ['nasa_10_ki', 'geo=ES&lastTimePeriod=3'], ['hbs_str_t223', 'geo=ES&lastTimePeriod=1'],
  ['road_eqs_carpda', 'geo=ES&lastTimePeriod=1'], ['road_eqs_carmot', 'geo=ES&lastTimePeriod=1'], ['road_eqs_carage', 'geo=ES&lastTimePeriod=1'],
  ['earn_gr_gpgr2', 'geo=ES&lastTimePeriod=1'], ['sdg_05_60', 'geo=ES&lastTimePeriod=1'], ['ilc_di12', 'geo=ES&lastTimePeriod=1'], ['lfsa_egais', 'geo=ES&lastTimePeriod=1'],
  ['tour_occ_nin2', 'geo=ES&lastTimePeriod=1'], ['tour_occ_nim', 'geo=ES&lastTimePeriod=1'],
  ['hlth_rs_physd', 'geo=ES&lastTimePeriod=1'], ['hlth_rs_bdsrg2', 'geo=ES&lastTimePeriod=1'], ['demo_r_mlifexp', 'geo=ES&lastTimePeriod=1'], ['hlth_sha11_hf', 'geo=ES&lastTimePeriod=1'],
  ['env_bio1', 'geo=ES&lastTimePeriod=1'], ['sdg_15_60', 'geo=ES&lastTimePeriod=1'], ['env_bio4', 'geo=ES&lastTimePeriod=1'],
  ['cult_emp_sex', 'geo=ES&lastTimePeriod=1'], ['isoc_ci_ac_i', 'geo=ES&lastTimePeriod=1'],
]) {
  const j = json(`${ES}${d}?format=JSON&lang=es&${q}`)
  out['eurostat ' + d] = j.error ? j : { label: j.label, updated: j.updated, dims: Object.fromEntries((j.id ?? []).map(k => [k, Object.keys(j.dimension[k].category.index).length > 30 ? Object.keys(j.dimension[k].category.index).length : Object.entries(j.dimension[k].category.label).map(([a, b]) => `${a}=${b}`)])), valores: Object.keys(j.value ?? {}).length }
}

// ---------- Aire: datos casi en directo de la Agencia Europea de Medio Ambiente y el ICA del ministerio ----------
for (const u of ['https://discomap.eea.europa.eu/map/fme/latest/ES_NO2.csv', 'https://discomap.eea.europa.eu/map/fme/latest/ES_PM10.csv', 'https://discomap.eea.europa.eu/map/fme/metadata/PanEuropean_metadata.csv',
  'https://ica.miteco.es/', 'https://www.miteco.gob.es/es/calidad-y-evaluacion-ambiental/temas/atmosfera-y-calidad-del-aire/calidad-del-aire/evaluacion-datos/datos/datos-oficiales-2024.html', 'https://prtr-es.es/'])
  out['aire ' + u] = get(u, { cabeza: 1200, enlaces: /\.(csv|zip|xlsx?|json)|api|datos/i })

// ---------- Coches: microdatos de la DGT ----------
for (const u of ['https://www.dgt.es/microdatos/salida/2026/9/vehiculos/matriculaciones/export_mensual_mat_202609.zip', 'https://www.dgt.es/microdatos/salida/2025/12/vehiculos/matriculaciones/export_mensual_mat_202512.zip',
  'https://www.dgt.es/menusecundario/dgt-en-cifras/matraba-listados/matriculaciones-automoviles-mensual.html', 'https://www.dgt.es/menusecundario/dgt-en-cifras/dgt-en-cifras-resultados/dgt-en-cifras-detalle/Microdatos-de-parque-de-vehiculos-mensual/'])
  out['dgt ' + u] = get(u, { max: 240, cabeza: 600, enlaces: /\.zip|parque|microdatos/i })
// un mes de matriculaciones: tamaño y primeras líneas
try {
  const z = `${tmp}/mat.zip`
  execFileSync('curl', ['-sSL', '--max-time', '300', '-o', z, 'https://www.dgt.es/microdatos/salida/2025/12/vehiculos/matriculaciones/export_mensual_mat_202512.zip'])
  out.dgtMuestra = execFileSync('bash', ['-c', `cd ${tmp} && unzip -o -q mat.zip && ls -la && f=$(ls -S | grep -iv zip | head -1) && wc -l "$f" && head -c 1500 "$f" | iconv -f latin1 -t utf-8`], { encoding: 'utf8' })
} catch (e) { out.dgtMuestraError = String(e.message).slice(-300) }

// ---------- Sanidad, cultura y naturaleza ----------
for (const u of ['https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm', 'https://www.sanidad.gob.es/estadEstudios/sanidadDatos/home.htm',
  'https://www.cultura.gob.es/servicios-al-ciudadano/estadisticas/cultura/mc/culturabase/portada.html', 'https://www.cultura.gob.es/cultura/areas/cine/datos.html',
  'https://api.gbif.org/v1/occurrence/search?country=ES&limit=0&facet=kingdomKey', 'https://www.miteco.gob.es/es/biodiversidad/temas/conservacion-de-especies/especies-proteccion-especial/ce-proteccion-listado-situacion.html'])
  out['otros ' + u] = get(u, { cabeza: 800, enlaces: /\.(xlsx?|csv|zip|json|px)|culturabase|jaxi|cine|listado|catalogo/i })

writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v?.code ?? (Array.isArray(v) ? v.length : '')} ${v?.size ?? ''}`).join('\n'))
