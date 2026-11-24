// Aire, casi en directo: últimas mediciones horarias de las estaciones españolas (datos E2a, provisionales) del servicio
// de descarga de la Agencia Europea de Medio Ambiente, y su índice con las bandas del Índice de Calidad del Aire nacional.
// Escribe public/aire/data/ahora.json (no se guarda en el repositorio: se rehace en cada despliegue) y fuentes/aire-ahora-log.json.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/aire-ahora'; mkdirSync(tmp, { recursive: true })
const OUT = here('../public/aire/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const API = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net'
const iso = (t) => new Date(t).toISOString().slice(0, 19) + 'Z'
const curl = (args, max = 240) => execFileSync('curl', ['-sSL', '--max-time', String(max), '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', ...args], { encoding: 'utf8', maxBuffer: 256e6 })

// Contaminantes (código de la Agencia Europea) y bandas del ICA (µg/m³): buena, razonablemente buena, regular,
// desfavorable, muy desfavorable, extremadamente desfavorable. Partículas: media de 24 horas; el resto, valor horario.
const POL = {
  8: { k: 'no2', n: 'NO2', b: [40, 90, 120, 230, 340] },
  7: { k: 'o3', n: 'O3', b: [50, 100, 130, 240, 380] },
  5: { k: 'pm10', n: 'PM10', b: [20, 40, 50, 100, 150], media: true },
  6001: { k: 'pm25', n: 'PM2.5', b: [10, 20, 25, 50, 75], media: true },
  1: { k: 'so2', n: 'SO2', b: [100, 200, 350, 500, 750] },
}
const cat = (b, v) => { let c = 1; for (const x of b) if (v > x) c++; return c }

// 1. Las últimas 30 horas de todas las estaciones, en un solo Parquet dentro de un zip
let filas = []
if (process.env.AIRE_FILAS) filas = JSON.parse(readFileSync(process.env.AIRE_FILAS, 'utf8')) // para probar sin red
else {
  const zip = `${tmp}/aire.zip`
  const body = JSON.stringify({ countries: ['ES'], cities: [], pollutants: Object.values(POL).map(p => p.n), dataset: 1, source: 'Api', dateTimeStart: iso(Date.now() - 30 * 3600e3), dateTimeEnd: iso(Date.now() + 3600e3), aggregationType: 'hour' })
  log.descarga = curl(['-X', 'POST', '-H', 'Content-Type: application/json', '--data', body, '-o', zip, '-w', '%{http_code} %{size_download}', `${API}/ParquetFile`])
  execFileSync('bash', ['-c', `cd ${tmp} && rm -rf E2a && unzip -o -q aire.zip`])
  const files = execFileSync('bash', ['-c', `find ${tmp} -name '*.parquet'`], { encoding: 'utf8' }).split('\n').filter(Boolean)
  for (const f of files) filas.push(...await parquetReadObjects({ file: await asyncBufferFromFile(f), columns: ['Samplingpoint', 'Pollutant', 'Start', 'Value', 'Validity'] }))
}
log.filas = filas.length
// 2. Por punto de muestreo: último valor válido y media de 24 horas
const sp = new Map()
for (const r of filas) {
  const p = POL[Number(r.Pollutant)]; if (!p || r.Value == null || r.Value < 0 || Number(r.Validity) < 1) continue
  const t = new Date(r.Start).getTime(), id = String(r.Samplingpoint)
  const x = sp.get(id) ?? sp.set(id, { pol: p, v: [] }).get(id)
  x.v.push([t, Number(r.Value)])
}
const ultimaHora = Math.max(...[...sp.values()].flatMap(x => x.v.map(v => v[0])))
log.ultimaHora = new Date(ultimaHora).toISOString()
// 3. Estación = código de 8 cifras dentro del punto de muestreo (provincia, municipio y número)
const est = new Map()
for (const [id, x] of sp) {
  const cod = id.match(/SP_(\d{8})/)?.[1]; if (!cod) continue
  x.v.sort((a, b) => a[0] - b[0])
  const [t, v] = x.v.at(-1)
  if (ultimaHora - t > 6 * 3600e3) continue // sin datos recientes
  const dia = x.v.filter(([tt]) => tt > t - 24 * 3600e3), media = dia.reduce((s, [, vv]) => s + vv, 0) / dia.length
  const valor = x.pol.media ? (dia.length >= 12 ? media : null) : v
  if (valor == null) continue
  const e = est.get(cod) ?? est.set(cod, { cod, m: {}, t: 0 }).get(cod)
  const prev = e.m[x.pol.k]
  if (!prev || prev[1] < valor) e.m[x.pol.k] = [cat(x.pol.b, valor), Math.round(valor * 10) / 10]
  e.t = Math.max(e.t, t)
  // serie de las últimas 24 horas del contaminante que manda en la estación (para la ficha)
  e.s ??= {}; e.s[x.pol.k] = x.v.filter(([tt]) => tt > ultimaHora - 24 * 3600e3).map(([tt, vv]) => [Math.round((tt - ultimaHora) / 3600e3), Math.round(vv)])
}
// 4. Coordenadas: metadatos de la Agencia Europea (se prueban varias direcciones); si ninguna responde, el centro del municipio
const coords = new Map(), nombres = new Map(), tipos = new Map()
const META = process.env.AIRE_FILAS ? [] : [
  'https://discomap.eea.europa.eu/map/fme/metadata/PanEuropean_metadata.csv',
  'https://discomap.eea.europa.eu/App/AQViewer/download?fqn=Airquality_Dissem.b2g.SamplingPoints&f=csv',
]
log.metadatos = []
for (const u of META) {
  if (coords.size) break
  try {
    const csv = curl([u], 120), lin = csv.split(/\r?\n/)
    const sep = ['\t', ';', ','].sort((x, y) => lin[0].split(y).length - lin[0].split(x).length)[0]
    const cab = lin[0].split(sep).map(c => c.replace(/"/g, '').trim().toLowerCase().replace(/\s+/g, ''))
    const ix = (...ns) => cab.findIndex(c => ns.some(n => c === n || c.endsWith(n)))
    const iLat = ix('latitude'), iLon = ix('longitude'), iT = ix('airqualitystationtype', 'stationtype'), iN = ix('airqualitystationname', 'stationname')
    for (const l of lin.slice(1)) {
      const cod = l.match(/SP_(\d{8})/)?.[1]; if (!cod || coords.has(cod)) continue
      const c = l.split(sep).map(x => x.replace(/"/g, '').trim()), lat = +c[iLat], lon = +c[iLon]
      if (!(lat > 27 && lat < 44.5 && lon > -18.5 && lon < 5)) continue
      coords.set(cod, [+lon.toFixed(4), +lat.toFixed(4)])
      if (iT >= 0 && c[iT]) tipos.set(cod, c[iT].split('/').at(-1)); if (iN >= 0 && c[iN]) nombres.set(cod, c[iN])
    }
    log.metadatos.push({ u, filas: lin.length, cabecera: cab.slice(0, 40), estaciones: coords.size })
  } catch (e) { log.metadatos.push({ u, error: String(e.message).slice(-160) }) }
}
const topoF = here('../public/poblacion/data/municipios.topo.json')
let cent = null
if (existsSync(topoF)) {
  // el mapa de municipios de Población ya trae el centro de cada uno (cx, cy)
  const topo = JSON.parse(readFileSync(topoF, 'utf8')), obj = Object.values(topo.objects)[0]
  cent = new Map(obj.geometries.map(g => [String(g.properties.id).padStart(5, '0'), [g.properties.cx, g.properties.cy]]))
}
const padron = JSON.parse(readFileSync(here('../public/poblacion/data/municipios.json'), 'utf8')).m
// «Coruña, A» → «A Coruña»; «Rozas de Madrid, Las» → «Las Rozas de Madrid»
const bonito = (n) => n.split('/').map(p => p.replace(/^(.*), (A|O|As|Os|El|La|Las|Los|Les|Els|Es|Sa|Ses|L')$/, (_, a, b) => b.endsWith("'") ? b + a : `${b} ${a}`)).join(' / ')
let sinCoord = 0
const porMuni = {}
const estaciones = [...est.values()].map(e => {
  const muni = e.cod.slice(0, 5), mm = padron[muni] ?? padron[String(+muni)]
  let xy = coords.get(e.cod), aprox = false
  if (!xy && cent?.get(muni)) { // varias estaciones en el mismo municipio: en corro alrededor del centro
    const k = (porMuni[muni] = (porMuni[muni] ?? -1) + 1), c = cent.get(muni)
    xy = k ? [+(c[0] + Math.cos(k * 2.4) * 0.012 * Math.sqrt(k)).toFixed(4), +(c[1] + Math.sin(k * 2.4) * 0.009 * Math.sqrt(k)).toFixed(4)] : [+c[0].toFixed(4), +c[1].toFixed(4)]
    aprox = true
  }
  if (!xy) sinCoord++
  const ica = Math.max(...Object.values(e.m).map(x => x[0]))
  const manda = Object.entries(e.m).sort((a, b) => b[1][0] - a[1][0])[0][0]
  return { c: e.cod, n: nombres.get(e.cod) ?? null, mu: mm?.[0] ? bonito(mm[0]) : null, ti: tipos.get(e.cod) ?? null, xy, aprox, ica, manda, m: e.m, s: e.s?.[manda] ?? [] }
}).filter(e => e.xy)
log.estaciones = estaciones.length; log.sinCoordenadas = sinCoord
const reparto = [1, 2, 3, 4, 5, 6].map(c => estaciones.filter(e => e.ica === c).length)
writeFileSync(`${OUT}/ahora.json`, JSON.stringify({ hora: new Date(ultimaHora).toISOString(), generado: new Date().toISOString(), reparto, estaciones }))
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/aire-ahora-log.json'), JSON.stringify(log, null, 1))
console.log(`Aire ahora: ${estaciones.length} estaciones, hora ${log.ultimaHora}, reparto ${reparto.join('/')}`)
