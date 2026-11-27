// Segunda sonda de «España hoy»: la forma exacta de cada respuesta (el sandbox no llega a estas webs).
// Escribe fuentes/sonda-forma.json. Solo se ejecuta al subir un commit con [sonda].
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const hoy = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const out = {}
const get = async (u, accept) => { const r = await fetch(u, { headers: { 'user-agent': 'espana-en-datos/1.0 (sonda)', ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r }
const forma = (v, d = 0) => Array.isArray(v) ? `[${v.length}] ` + (v.length ? forma(v[0], d + 1) : '') : v && typeof v === 'object' ? (d > 5 ? '{…}' : '{' + Object.entries(v).map(([k, x]) => k + ': ' + forma(x, d + 1)).join(', ') + '}') : JSON.stringify(v)?.slice(0, 60)

try { out.ign = (await (await get('https://www.ign.es/ign/RssTools/sismologia.xml')).text()).slice(0, 5200) } catch (e) { out.ign = String(e.message) }

try {
  const j = await (await get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain')).json()
  const w = j.warnings ?? []
  out.meteoalarm = { claves: Object.keys(j), n: w.length, forma: forma(w[0]).slice(0, 3500), ejemplos: w.slice(0, 2).map(x => JSON.stringify(x).slice(0, 1800)) }
  const campos = {}
  for (const x of w) for (const inf of x.alert?.info ?? []) {
    for (const p of inf.parameter ?? []) (campos[p.valueName] ??= new Set()).add(String(p.value).slice(0, 40))
    campos.severity = (campos.severity ?? new Set()).add(inf.severity)
    campos.event = (campos.event ?? new Set()).add(inf.event)
    campos.lang = (campos.lang ?? new Set()).add(inf.language)
  }
  out.meteoalarm.valores = Object.fromEntries(Object.entries(campos).map(([k, s]) => [k, [...s].slice(0, 25)]))
  out.meteoalarm.geo = w.slice(0, 3).map(x => JSON.stringify(x.alert?.info?.[0]?.area ?? x.alert?.info?.[0]?.area?.[0]).slice(0, 500))
  out.meteoalarm.conGeometria = w.filter(x => JSON.stringify(x).includes('polygon')).length
} catch (e) { out.meteoalarm = String(e.message) }

try {
  const j = await (await get(`https://www.boe.es/datosabiertos/api/boe/sumario/${hoy}`, 'application/json')).json()
  const d = j.data.sumario.diario[0]
  out.boe = { forma: forma(d).slice(0, 3500), claves: Object.keys(d) }
  const secs = d.seccion ?? []
  out.boe.secciones = secs.map(s => [s.codigo, s.nombre, (s.departamento ?? []).map(x => x.nombre + ' (' + (x.epigrafe ?? []).length + ')').slice(0, 6)])
  const it = secs.find(s => s.codigo === '2B')?.departamento?.[0]?.epigrafe?.[0]
  out.boe.ejemplo2B = JSON.stringify(it).slice(0, 1500)
  out.boe.ejemplo1 = JSON.stringify(secs.find(s => s.codigo === '1')?.departamento?.[0]?.epigrafe?.[0]).slice(0, 1200)
} catch (e) { out.boe = String(e.message) }

try {
  const j = await (await get('https://api.open-meteo.com/v1/forecast?latitude=40.42&longitude=-3.70&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=Europe%2FMadrid&forecast_days=3')).json()
  out.openmeteo = j
  const a = await (await get('https://archive-api.open-meteo.com/v1/archive?latitude=40.42&longitude=-3.70&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean&timezone=Europe%2FMadrid')).json()
  out.openmeteoArchivo = { n: a.daily?.time?.length, ini: a.daily?.time?.[0], fin: a.daily?.time?.at(-1), tamano: JSON.stringify(a).length }
} catch (e) { out.openmeteo = String(e.message) }

for (const [k, u] of Object.entries({
  dgtInfocar: 'https://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml',
  dgtInfocarHttp: 'http://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml',
  dgtNap: 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2.xml',
  dgtNapIni: 'https://nap.dgt.es/',
  dgtEtraffic: 'https://infocar.dgt.es/etraffic/',
  dgtEtrafficApi: 'https://infocar.dgt.es/etraffic/BuscarElementos?latNS=44&longNS=4&latSW=35&longSW=-10&zoom=6&accion=getElementos&Camaras=false&SensoresTrafico=false&SensoresMeteorologico=false&Paneles=false&Radares=false&IncidenciasRETENCION=true&IncidenciasOBRAS=false&IncidenciasMETEOROLOGICA=true&IncidenciasPUERTOS=false&IncidenciasOTROS=true&IncidenciasEVENTOS=false&IncidenciasRESTRICCIONES=false&niveles=true&caracter=acontecimiento',
  dgtWms: 'https://infocar.dgt.es/etraffic/Incidencias?latNS=44&longNS=4&latSW=35&longSW=-10&zoom=6',
})) {
  try { const r = await get(u); const t = await r.text(); out[k] = { tipo: r.headers.get('content-type'), bytes: t.length, inicio: t.slice(0, 700) } } catch (e) { out[k] = String(e.message) }
}

for (const [k, u] of Object.entries({
  euribor: 'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?lastNObservations=3&format=csvdata',
  cambio: 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=3&format=csvdata',
  ree: `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${hoy.slice(0, 4)}-${hoy.slice(4, 6)}-${hoy.slice(6)}T00:00&end_date=${hoy.slice(0, 4)}-${hoy.slice(4, 6)}-${hoy.slice(6)}T23:59&time_trunc=hour`,
})) {
  try { const t = await (await get(u)).text(); out[k] = t.slice(0, k === 'ree' ? 2500 : 800) } catch (e) { out[k] = String(e.message) }
}

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-forma.json'), JSON.stringify(out, null, 1))
console.log('ok', Object.keys(out).join(' '))
