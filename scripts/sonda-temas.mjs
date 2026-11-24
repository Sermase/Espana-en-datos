// Sonda para los próximos temas (Hogares, Coches, Igualdad, Turismo, Sanidad): qué tablas del INE existen, qué dimensiones
// y años tienen las de Eurostat para España, y cómo vienen los microdatos de matriculaciones de la DGT.
// Escribe fuentes/sonda-temas.json. Solo se ejecuta al subir un commit con [sonda].
import { writeFileSync, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/sonda-temas'; mkdirSync(tmp, { recursive: true })
const out = { fecha: new Date().toISOString(), ine: {}, eurostat: {}, dgt: {} }
const j = async (u, t = 60) => { const r = await fetch(u, { signal: AbortSignal.timeout(t * 1000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }
const INE = 'https://servicios.ine.es/wstempus/js/ES'

// 1. INE: operaciones y sus tablas
try {
  const ops = await j(`${INE}/OPERACIONES_DISPONIBLES`)
  const re = /presupuestos familiares|condiciones de vida|estructura salarial|salarial|frontur|egatur|coyuntura tur|ocupaci.n hotelera|apartamentos|turismo de residentes|defunciones seg|mortalidad|sectores institucionales|mujeres y hombres|esperanza de vida|discapacidad|poblaci.n activa/i
  out.ine.operaciones = ops.filter(o => re.test(o.Nombre)).map(o => [o.Id, o.Codigo, o.Nombre])
  for (const [id, cod] of out.ine.operaciones) {
    try { out.ine[cod || id] = (await j(`${INE}/TABLAS_OPERACION/${id}`)).map(t => [t.Id, t.Nombre, t.Anyo_Periodo_ini, String(t.FechaRef_fin ?? '').slice(0, 10)]) } catch (e) { out.ine[cod || id] = String(e.message) }
  }
} catch (e) { out.ine.error = String(e.message) }
// muestra de series de algunas tablas candidatas de la EPF (nombres de las primeras series)
for (const t of [24900, 24904, 24908, 24909, 25146, 73987, 73991, 73787]) {
  try { const d = await j(`${INE}/DATOS_TABLA/${t}?nult=1&tip=A`); out.ine['muestra' + t] = { n: d.length, series: d.slice(0, 25).map(s => `${s.Nombre} = ${s.Data?.[0]?.Valor} (${s.Data?.[0]?.Anyo})`) } } catch (e) { out.ine['muestra' + t] = String(e.message) }
}

// 2. Eurostat: dimensiones, categorías (las primeras) y último año para España
const ES = ['nasa_10_ki', 'nasq_10_ki', 'nasa_10_f_bs', 'hbs_str_t211', 'hbs_str_t223', 'road_eqs_carpda', 'road_eqs_carage', 'road_eqs_carmot', 'road_eqr_carpda', 'road_eqs_carhab',
  'earn_gr_gpgr2', 'earn_gr_gpgr2ag', 'sdg_05_20', 'sdg_05_60', 'lfsa_ergaed', 'ilc_di12', 'ilc_li02', 'ilc_peps01n', 'tour_occ_nim', 'tour_occ_arnat', 'tour_dem_exstt',
  'demo_r_mlifexp', 'hlth_rs_prsrg', 'hlth_rs_bdsrg2', 'hlth_sha11_hf', 'hlth_cd_aro', 'env_bio4', 'env_ac_ainah_r2']
for (const c of ES) {
  try {
    const d = await j(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${c}?lang=en&geo=ES&lastTimePeriod=1`, 90)
    out.eurostat[c] = { label: d.label, dims: Object.fromEntries(d.id.map(k => { const cat = d.dimension[k].category, ids = Object.keys(cat.index); return [k, ids.length > 40 ? `${ids.length}: ${ids.slice(0, 40).map(i => `${i}=${cat.label[i]}`).join(' | ')}` : ids.map(i => `${i}=${cat.label[i]}`).join(' | ')] })), valores: Object.keys(d.value).length }
  } catch (e) { out.eurostat[c] = String(e.message) }
}

// 3. DGT: microdatos mensuales de matriculaciones (fichero de ancho fijo dentro de un zip)
const sh = (c) => execFileSync('bash', ['-c', c], { encoding: 'utf8', maxBuffer: 64e6 })
for (const [y, m] of [[2026, 10], [2026, 9], [2015, 1]]) {
  const u = `https://www.dgt.es/microdatos/salida/${y}/${m}/vehiculos/matriculaciones/export_mensual_mat_${y}${String(m).padStart(2, '0')}.zip`, z = `${tmp}/mat${y}${m}.zip`, k = `${y}-${m}`
  try {
    const st = sh(`curl -sSL --max-time 240 -A 'Mozilla/5.0' -o ${z} -w '%{http_code} %{size_download} %{content_type}' '${u}'`)
    out.dgt[k] = { st }
    if (st.startsWith('200')) {
      const d = `${tmp}/mat${y}${m}`; sh(`rm -rf ${d} && mkdir -p ${d} && cd ${d} && unzip -o -q ${z}`)
      const f = readdirSync(d).map(n => `${d}/${n}`).find(n => statSync(n).isFile())
      const raw = readFileSync(f), txt = raw.toString('latin1'), lin = txt.split(/\r?\n/)
      out.dgt[k].fichero = { nombre: f.split('/').pop(), bytes: raw.length, lineas: lin.length, largos: [...new Set(lin.slice(0, 200).map(l => l.length))].slice(0, 8), primeras: lin.slice(0, 4), utf8: /Ã[¡©­³º±]/.test(txt.slice(0, 200000)) }
    }
  } catch (e) { out.dgt[k] = String(e.message).slice(-300) }
}
// página de la DGT con los microdatos (enlaces que existan)
try {
  const h = sh(`curl -sSL --max-time 60 -A 'Mozilla/5.0' 'https://www.dgt.es/menusecundario/dgt-en-cifras/matraba-listados/'`)
  out.dgt.enlaces = [...new Set([...h.matchAll(/href="([^"]*(?:microdatos|parque|matraba|\.pdf|\.xlsx?)[^"]*)"/gi)].map(m => m[1]))].slice(0, 80)
} catch (e) { out.dgt.enlaces = String(e.message).slice(-200) }

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, null, 1))
console.log('Sonda temas:', Object.keys(out.ine).length, 'INE,', Object.values(out.eurostat).filter(v => typeof v === 'object').length, 'Eurostat,', Object.keys(out.dgt).length, 'DGT')
