// Sonda de fuentes para los temas nuevos, segunda vuelta: Interior con sesión (JaxiPx), Eurostat en inglés
// y las direcciones de datos que usa por dentro el visor del Índice de Calidad del Aire. Escribe fuentes/sonda-temas.json.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/sonda-temas'; mkdirSync(tmp, { recursive: true })
const out = {}
let n = 0
const JAR = `${tmp}/cookies.txt`
function get(url, { max = 90, cabeza = 2500, enlaces = null, cuerpo = false, jar = false } = {}) {
  const f = `${tmp}/${++n}`
  try {
    const args = ['-sSL', '--max-time', String(max), '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-o', f, '-w', '%{http_code} %{content_type} %{url_effective}']
    if (jar) args.push('-b', JAR, '-c', JAR)
    const meta = execFileSync('curl', [...args, url], { encoding: 'utf8', timeout: (max + 10) * 1000 })
    const [code, tipo, fin] = meta.split(' ')
    const size = statSync(f).size
    const r = { code: +code, tipo, size, fin: fin !== url ? fin : undefined, f }
    const b = readFileSync(f)
    const txt = new TextDecoder(/utf-8/i.test(tipo) ? 'utf-8' : 'latin1').decode(b.subarray(0, 400000))
    if (!/zip|excel|spreadsheet|pdf/.test(tipo ?? '')) r.cabeza = txt.slice(0, cabeza)
    if (enlaces) r.enlaces = [...new Set([...txt.matchAll(/(?:href|src|action)=["']([^"'#]+)["']/gi)].map(m => m[1].replace(/&amp;/g, '&')).filter(h => enlaces.test(h)))].slice(0, 80)
    if (cuerpo) r.cuerpo = txt
    return r
  } catch (e) { return { error: String(e.message).slice(-300) } }
}
const json = (url) => { const r = get(url, { cabeza: 0, cuerpo: true }); try { return JSON.parse(r.cuerpo) } catch { return { error: r.error ?? `HTTP ${r.code}`, cabeza: r.cuerpo?.slice(0, 300) } } }

// ---------- Seguridad: JaxiPx necesita la sesión que abre el índice ----------
const MIR = 'https://estadisticasdecriminalidad.ses.mir.es'
const JX = /jaxiPx|\.px|files\/|export|descarga/i
for (const [path, file] of [['/DatosBalanceAnt/20254/', '1509011.px'], ['/Datos1/', '01002.px'], ['/Datos1/', '01001.px']]) {
  const k = `mir ${path}${file}`
  const idx = get(`${MIR}/sec/dynPx/inebase/index.htm?type=pcaxis&path=${path}&file=pcaxis`, { jar: true, cuerpo: true })
  out[k + ' titulos'] = [...(idx.cuerpo ?? '').matchAll(/<a[^>]+Tabla\.htm[^>]*>([^<]+)<\/a>/gi)].map(m => m[1].trim())
  const base = path.split('/').filter(Boolean)[0]
  const tabla = get(`${MIR}/sec/jaxiPx/Tabla.htm?path=/${base}/l0/&file=${file}&L=0`, { jar: true, enlaces: JX, cabeza: 1500 })
  out[k + ' tabla'] = { code: tabla.code, size: tabla.size, enlaces: tabla.enlaces, cabeza: tabla.cabeza?.replace(/\s+/g, ' ').slice(0, 1500) }
  const dlg = get(`${MIR}/sec/jaxiPx/dlgExport.htm?path=/${base}//&file=${file}&nocab=1&L=0`, { jar: true, enlaces: JX, cuerpo: true })
  out[k + ' dlg'] = { code: dlg.code, size: dlg.size, enlaces: dlg.enlaces, texto: dlg.cuerpo?.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500) }
  const prueba = [...(dlg.enlaces ?? []), ...(tabla.enlaces ?? [])].filter(h => /files\/|\.px|csv/i.test(h)).slice(0, 6)
  for (const h of prueba) {
    const u = h.startsWith('http') ? h : MIR + (h.startsWith('/') ? h : '/sec/jaxiPx/' + h)
    const r = get(u, { jar: true, cabeza: 2500 })
    out[k + ' bajar ' + h] = { code: r.code, tipo: r.tipo, size: r.size, cabeza: r.cabeza }
  }
  for (const fmt of ['px', 'csv_bdsc', 'csv_bd', 'csv_c']) {
    const r = get(`${MIR}/sec/jaxiPx/files/_px/es/${fmt}/${base}/l0/${file.replace('.px', fmt === 'px' ? '.px' : '.' + fmt)}?nocab=1`, { jar: true, cabeza: 1500 })
    out[k + ' prueba ' + fmt] = { code: r.code, tipo: r.tipo, size: r.size, cabeza: r.cabeza }
  }
}

// ---------- Eurostat (el idioma tiene que ser en, fr o de) ----------
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
for (const [d, q] of [
  ['crim_gen_reg', 'geo=ES&lastTimePeriod=1'], ['crim_off_cat', 'geo=ES&lastTimePeriod=1'],
  ['env_air_gge', 'geo=ES&lastTimePeriod=1&unit=THS_T'], ['env_ac_ainah_r2', 'geo=ES&lastTimePeriod=1'], ['env_air_emis', 'geo=ES&lastTimePeriod=1'],
  ['nasa_10_ki', 'geo=ES&lastTimePeriod=3'], ['nasq_10_ki', 'geo=ES&lastTimePeriod=3'],
  ['road_eqs_carpda', 'geo=ES&lastTimePeriod=1'], ['road_eqs_carmot', 'geo=ES&lastTimePeriod=1'], ['road_eqs_carage', 'geo=ES&lastTimePeriod=1'],
  ['earn_gr_gpgr2', 'geo=ES&lastTimePeriod=1'], ['sdg_05_60', 'geo=ES&lastTimePeriod=1'], ['ilc_di12', 'geo=ES&lastTimePeriod=1'], ['lfsa_egais', 'geo=ES&lastTimePeriod=1'],
  ['tour_occ_nin2', 'geo=ES&lastTimePeriod=1'], ['tour_occ_nim', 'geo=ES&lastTimePeriod=1'],
  ['hlth_rs_physd', 'geo=ES&lastTimePeriod=1'], ['hlth_rs_bdsrg2', 'geo=ES&lastTimePeriod=1'], ['demo_r_mlifexp', 'geo=ES&lastTimePeriod=1'], ['hlth_sha11_hf', 'geo=ES&lastTimePeriod=1'],
  ['env_bio1', 'geo=ES&lastTimePeriod=1'], ['sdg_15_60', 'geo=ES&lastTimePeriod=1'], ['env_bio4', 'geo=ES&lastTimePeriod=1'],
  ['cult_emp_sex', 'geo=ES&lastTimePeriod=1'],
]) {
  const j = json(`${ES}${d}?format=JSON&lang=en&${q}`)
  out['eurostat ' + d] = j.error ? j : { label: j.label, updated: j.updated, dims: Object.fromEntries((j.id ?? []).map(k => [k, Object.keys(j.dimension[k].category.index).length > 40 ? Object.keys(j.dimension[k].category.index).length : Object.entries(j.dimension[k].category.label).map(([a, b]) => `${a}=${b}`)])), valores: Object.keys(j.value ?? {}).length, tiempo: Object.keys(j.dimension?.time?.category?.index ?? {}) }
}

// ---------- Aire: el visor del ICA es una aplicación Angular; sus datos salen de un API que aparece en el JS ----------
const ica = get('https://ica.miteco.es/', { enlaces: /\.js$/i })
out.icaJs = ica.enlaces
for (const js of (ica.enlaces ?? []).filter(x => /main|chunk/i.test(x)).slice(0, 4)) {
  const r = get(js.startsWith('http') ? js : 'https://ica.miteco.es/' + js.replace(/^\//, ''), { cuerpo: true, cabeza: 0 })
  out['icaApi ' + js] = [...new Set([...(r.cuerpo ?? '').matchAll(/["'`](https?:\/\/[^"'`\s]+|\/api\/[^"'`\s]*)["'`]/g)].map(m => m[1]))].slice(0, 60)
}
for (const u of ['https://discomap.eea.europa.eu/map/fme/latest/ES_NO2.csv', 'https://eeadmz1-downloads-api-appservice.azurewebsites.net/swagger/index.html',
  'https://www.datosabiertos.miteco.gob.es/es.html'])
  out['aire ' + u] = (({ f, ...r }) => r)(get(u, { cabeza: 800, enlaces: /\.(csv|zip|json)|api|calidad|aire/i }))

writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, null, 1))
console.log(Object.keys(out).join('\n'))
