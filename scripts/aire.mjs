// Aire: emisiones de gases de efecto invernadero y de contaminantes por sector desde 1990 (Eurostat, inventarios
// que España envía a la ONU y a la UE). Escribe public/aire/data/emisiones.json, fuentes/aire-log.json y resumen.aire.
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/aire/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function eurostat(ds, q) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${ES}${ds}?format=JSON&lang=en&${q}`, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      if (r.ok) return await r.json()
      log.avisos.push(`${ds} HTTP ${r.status}`)
    } catch (e) { log.avisos.push(`${ds}: ${e.message}`) }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Eurostat no responde: ' + ds)
}
/** JSON-stat → { [dimA]: { [dimB]: { año: valor } } } según el orden de dimensiones pedido. */
function tabla(j, dims) {
  const ids = j.id, size = j.size, idx = ids.map(d => j.dimension[d].category.index)
  const inv = idx.map(m => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])))
  const out = {}
  for (const [pos, val] of Object.entries(j.value)) {
    let p = +pos; const c = {}
    for (let k = ids.length - 1; k >= 0; k--) { c[ids[k]] = inv[k][p % size[k]]; p = Math.floor(p / size[k]) }
    let o = out; for (const d of dims) o = (o[c[d]] ??= {})
    o[c.time] = val
  }
  return out
}
const etiquetas = (j, d) => j.dimension[d].category.label

// 1. Gases de efecto invernadero por sector (CRF), España y UE, todos los años
const gge = await eurostat('env_air_gge', 'geo=ES&geo=EU27_2020&airpol=GHG&unit=THS_T')
const G = tabla(gge, ['geo', 'src_crf'])
const LCRF = etiquetas(gge, 'src_crf')
log.crf = Object.entries(LCRF).map(([k, v]) => `${k} ${v}`)
// 2. Contaminantes del aire por sector (NFR), España y UE
const emi = await eurostat('env_air_emis', 'geo=ES&geo=EU27_2020&unit=T&airpol=NOX&airpol=SOX&airpol=PM2_5&airpol=PM10&airpol=NH3&airpol=NMVOC&airpol=CO')
const P = tabla(emi, ['geo', 'airpol', 'src_nfr'])
const LNFR = etiquetas(emi, 'src_nfr')
log.nfr = Object.entries(LNFR).map(([k, v]) => `${k} ${v}`)
// 3. Población para las cifras por habitante
const pob = await eurostat('demo_pjan', 'geo=ES&geo=EU27_2020&age=TOTAL&sex=T')
const POB = tabla(pob, ['geo'])

const años = [...new Set(Object.keys(G.ES?.[Object.keys(G.ES)[0]] ?? {}))].map(Number).sort()
const serie = (o) => años.map(a => o?.[a] ?? null)
const fecha = new Date().toISOString().slice(0, 10)
const datos = {
  fecha, años,
  gei: { es: Object.fromEntries(Object.entries(G.ES ?? {}).map(([k, v]) => [k, serie(v)])), ue: Object.fromEntries(Object.entries(G.EU27_2020 ?? {}).filter(([k]) => /^(TOTX4_MEMONIA|TOTX4_MEMO|TOTXMEMO|TOTX_MEMO)$/.test(k)).map(([k, v]) => [k, serie(v)])) },
  crf: LCRF,
  cont: { es: Object.fromEntries(Object.entries(P.ES ?? {}).map(([pol, s]) => [pol, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, serie(v)]))])), ue: Object.fromEntries(Object.entries(P.EU27_2020 ?? {}).map(([pol, s]) => [pol, serie(s.NFR_TOT_NAT ?? s.TOTX_NAT ?? Object.values(s)[0])])) },
  nfr: LNFR,
  pob: { es: serie(POB.ES), ue: serie(POB.EU27_2020) },
}
writeFileSync(`${OUT}/emisiones.json`, JSON.stringify(datos))
// resumen para la portada: emisiones totales del último año frente a 1990
const tot = datos.gei.es.TOTX4_MEMONIA ?? datos.gei.es.TOTX4_MEMO ?? Object.values(datos.gei.es)[0]
const i = tot.findLastIndex(v => v != null), i90 = años.indexOf(1990)
const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
res.aire = { ...(res.aire ?? {}), año: años[i], gei: tot[i], vs1990: i90 >= 0 && tot[i90] ? ((tot[i] - tot[i90]) / tot[i90]) * 100 : null }
writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')

// 4. Estaciones de calidad del aire (MITECO, capa de la evaluación anual): código nacional, nombre, tipo y coordenadas.
// La usa scripts/aire-ahora.mjs para situar cada estación; si no se puede bajar, se queda la de la vez anterior.
try {
  const tmp = '/tmp/aire-est', zip = `${tmp}/estaciones.zip`
  execFileSync('bash', ['-c', `rm -rf ${tmp} && mkdir -p ${tmp}`])
  log.estaciones = execFileSync('curl', ['-sSL', '--max-time', '120', '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-o', zip, '-w', '%{http_code} %{size_download} %{content_type}', 'https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=estaciones.zip'], { encoding: 'utf8' })
  if (readFileSync(zip).subarray(0, 2).toString() !== 'PK') throw new Error('no es un zip: ' + readFileSync(zip).subarray(0, 120).toString())
  execFileSync('bash', ['-c', `cd ${tmp} && unzip -o -q estaciones.zip`])
  const todos = execFileSync('bash', ['-c', `find ${tmp} -type f`], { encoding: 'utf8' }).split('\n').filter(Boolean)
  log.estacionesFicheros = todos.map(f => f.replace(tmp + '/', ''))
  const fShp = todos.find(f => /\.shp$/i.test(f)), fDbf = todos.find(f => /\.dbf$/i.test(f)), fPrj = todos.find(f => /\.prj$/i.test(f))
  log.estacionesPrj = fPrj ? readFileSync(fPrj, 'utf8').slice(0, 300) : null
  // DBF: cabecera, descriptores de campo de 32 bytes y registros de ancho fijo
  const dbf = readFileSync(fDbf), nReg = dbf.readUInt32LE(4), hLen = dbf.readUInt16LE(8), rLen = dbf.readUInt16LE(10)
  const campos = []; for (let o = 32; dbf[o] !== 0x0d && o < hLen; o += 32) campos.push({ n: dbf.subarray(o, o + 11).toString('latin1').replace(/\0.*$/, '').trim(), l: dbf[o + 16] })
  const utf8 = /utf-?8/i.test(todos.find(f => /\.cpg$/i.test(f)) ? readFileSync(todos.find(f => /\.cpg$/i.test(f)), 'utf8') : '')
  const regs = []
  for (let r = 0; r < nReg; r++) {
    let o = hLen + r * rLen + 1; const x = {}
    for (const c of campos) { x[c.n] = dbf.subarray(o, o + c.l).toString(utf8 ? 'utf8' : 'latin1').trim(); o += c.l }
    regs.push(x)
  }
  log.estacionesCampos = campos.map(c => c.n); log.estacionesMuestra = regs.slice(0, 3)
  // SHP de puntos: cabecera de 100 bytes y, por registro, 8 de cabecera + tipo + x + y
  const shp = readFileSync(fShp), xy = []
  for (let o = 100; o + 28 <= shp.length;) { const len = shp.readInt32BE(o + 4) * 2; const t = shp.readInt32LE(o + 8); xy.push(t === 1 || t === 11 || t === 21 ? [shp.readDoubleLE(o + 12), shp.readDoubleLE(o + 20)] : null); o += 8 + len }
  // UTM (huso de la cabecera .prj, por defecto 30) a geográficas, por si la capa viene proyectada
  const huso = Number(log.estacionesPrj?.match(/(?:UTM[^0-9]*zone[^0-9]*|_)(2[789]|3[01])N/i)?.[1] ?? 30)
  const utm = (E, N) => {
    const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), k0 = 0.9996, x = E - 500000, M = N / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64))
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
    const p = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    const ep = e2 / (1 - e2), C = ep * Math.cos(p) ** 2, T = Math.tan(p) ** 2, Nn = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), R = a * (1 - e2) / (1 - e2 * Math.sin(p) ** 2) ** 1.5, D = x / (Nn * k0)
    const lat = p - (Nn * Math.tan(p) / R) * (D ** 2 / 2 - (5 + 3 * T + 10 * C - 4 * C ** 2 - 9 * ep) * D ** 4 / 24)
    const lon = (D - (1 + 2 * T + C) * D ** 3 / 6) / Math.cos(p)
    return [((huso - 1) * 6 - 180 + 3) + lon * 180 / Math.PI, lat * 180 / Math.PI]
  }
  const k = (re) => campos.map(c => c.n).find(n => re.test(n))
  const kCod = campos.map(c => c.n).find(n => regs.slice(0, 50).filter(x => /^\d{8}$/.test(x[n])).length > 25)
  const kNom = k(/^(NOM|NOMBRE|ESTACION|NOM_EST|NOMBRE_EST)/i), kTipo = k(/TIPO/i), kLat = k(/^LAT/i), kLon = k(/^(LON|LNG)/i)
  const est = {}
  regs.forEach((x, n) => {
    const cod = kCod ? x[kCod] : null; if (!cod) return
    let p = kLat && kLon ? [+String(x[kLon]).replace(',', '.'), +String(x[kLat]).replace(',', '.')] : xy[n]
    if (p && Math.abs(p[0]) > 180) p = utm(p[0], p[1])
    if (!p || !(p[1] > 27 && p[1] < 44.5 && p[0] > -18.5 && p[0] < 5)) return
    est[cod] = [+p[0].toFixed(4), +p[1].toFixed(4), kNom ? x[kNom] : null, kTipo ? x[kTipo] : null]
  })
  log.estacionesN = Object.keys(est).length
  if (log.estacionesN > 100) writeFileSync(`${OUT}/estaciones.json`, JSON.stringify(est))
} catch (e) { log.avisos.push('estaciones MITECO: ' + String(e.message).slice(0, 300)) }

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/aire-log.json'), JSON.stringify(log, null, 1))
console.log(`Emisiones: ${años[0]}-${años[i]}, ${Object.keys(datos.gei.es).length} sectores CRF, ${Object.keys(datos.cont.es).length} contaminantes`)
