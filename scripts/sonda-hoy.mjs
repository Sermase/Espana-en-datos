// Sonda para «España hoy»: ¿responden las fuentes sin clave desde Actions y con qué forma?
// Escribe fuentes/sonda-hoy.json. Solo se ejecuta al subir un commit con [sonda].
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const hoy = new Date().toISOString().slice(0, 10)
const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const aaaammdd = hoy.replaceAll('-', '')
const out = { fecha: new Date().toISOString(), pruebas: {} }

async function prueba(nombre, url, { accept, t = 45, largo = 900 } = {}) {
  const t0 = Date.now()
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'espana-en-datos/1.0 (sonda)', ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(t * 1000), redirect: 'follow' })
    const buf = Buffer.from(await r.arrayBuffer())
    out.pruebas[nombre] = { url, status: r.status, tipo: r.headers.get('content-type'), bytes: buf.length, ms: Date.now() - t0, inicio: buf.toString('utf8', 0, largo) }
    return buf
  } catch (e) { out.pruebas[nombre] = { url, error: String(e.cause?.code ?? e.message), ms: Date.now() - t0 } }
}

// Terremotos (IGN)
await prueba('ign-rss', 'https://www.ign.es/ign/RssTools/sismologia.xml')
await prueba('ign-ultimos', 'https://www.ign.es/web/ign/portal/ultimos-terremotos/-/ultimos-terremotos/get10dias')
await prueba('ign-ultimos-csv', 'https://www.ign.es/web/ign/portal/sis-catalogo-terremotos')
await prueba('usgs-espana', `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=26&maxlatitude=45&minlongitude=-20&maxlongitude=6&starttime=${ayer}&minmagnitude=2`, { largo: 600 })
await prueba('emsc-fdsn', `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=26&maxlat=45&minlon=-20&maxlon=6&start=${ayer}&limit=20`, { largo: 600 })

// Avisos meteorológicos
await prueba('meteoalarm-api', 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain', { largo: 1200 })
await prueba('meteoalarm-atom', 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain', { largo: 1200 })
await prueba('aemet-avisos-cap', 'https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_.rss', { largo: 600 })

// Temperatura frente a lo normal (Open-Meteo)
await prueba('om-actual', 'https://api.open-meteo.com/v1/forecast?latitude=40.42,41.39,37.39,43.26,39.47&longitude=-3.70,2.17,-5.98,-2.93,-0.38&current=temperature_2m,precipitation,wind_speed_10m&timezone=Europe%2FMadrid', { largo: 1200 })
await prueba('om-archivo', 'https://archive-api.open-meteo.com/v1/archive?latitude=40.42&longitude=-3.70&start_date=1991-11-20&end_date=1991-11-30&daily=temperature_2m_mean&timezone=Europe%2FMadrid', { largo: 600 })
await prueba('om-clima', 'https://climate-api.open-meteo.com/v1/climate?latitude=40.42&longitude=-3.70&start_date=2040-11-20&end_date=2040-11-21&models=EC_Earth3P_HR&daily=temperature_2m_mean', { largo: 400 })

// Tráfico (DGT)
await prueba('dgt-nap-v3', 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2.xml', { largo: 1500 })
await prueba('dgt-infocar', 'https://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml', { largo: 1500 })
await prueba('dgt-incidencias-geojson', 'https://infocar.dgt.es/etraffic/BuscarElementos?latNS=44&longNS=4&latSW=35&longSW=-10&zoom=6&accion=getElementos&Camaras=false&SensoresTrafico=false&SensoresMeteorologico=false&Paneles=false&Radares=false&IncidenciasRETENCION=true&IncidenciasOBRAS=false&IncidenciasMETEOROLOGICA=true&IncidenciasPUERTOS=false&IncidenciasOTROS=true&IncidenciasEVENTOS=false&IncidenciasRESTRICCIONES=false&niveles=true&caracter=acontecimiento', { largo: 800 })

// BOE
await prueba('boe-sumario', `https://www.boe.es/datosabiertos/api/boe/sumario/${aaaammdd}`, { accept: 'application/json', largo: 1500 })
await prueba('boe-sumario-ayer', `https://www.boe.es/datosabiertos/api/boe/sumario/${ayer.replaceAll('-', '')}`, { accept: 'application/json', largo: 300 })

// Mercado y energía del día (por si sirven para la cinta)
await prueba('ree-precio', `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${hoy}T00:00&end_date=${hoy}T23:59&time_trunc=hour`, { largo: 600 })
await prueba('ecb-euribor', 'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?lastNObservations=3&format=jsondata', { largo: 400 })
await prueba('ecb-cambio', 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=3&format=jsondata', { largo: 400 })

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-hoy.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out.pruebas).map(([k, v]) => `${k}: ${v.status ?? v.error} ${v.tipo ?? ''} ${v.bytes ?? ''}`).join('\n'))
