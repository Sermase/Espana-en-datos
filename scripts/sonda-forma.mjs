// Tercera sonda de «España hoy»: BOE (forma), zonas de aviso de MeteoAlarm y normales de Open-Meteo.
// Escribe fuentes/sonda-forma.json. Solo se ejecuta al subir un commit con [sonda].
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const hoy = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const out = {}
const get = async (u, accept, t = 90) => { const r = await fetch(u, { headers: { 'user-agent': 'espana-en-datos/1.0 (sonda)', ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(t * 1000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r }
const A = (x) => x == null ? [] : Array.isArray(x) ? x : [x]
const forma = (v, d = 0) => Array.isArray(v) ? `[${v.length}] ` + (v.length ? forma(v[0], d + 1) : '') : v && typeof v === 'object' ? (d > 6 ? '{…}' : '{' + Object.entries(v).map(([k, x]) => k + ': ' + forma(x, d + 1)).join(', ') + '}') : JSON.stringify(v)?.slice(0, 70)

try {
  const j = await (await get(`https://www.boe.es/datosabiertos/api/boe/sumario/${hoy}`, 'application/json')).json()
  const d = A(j.data.sumario.diario)[0]
  out.boe = { claves: Object.keys(d), forma: forma(d).slice(0, 4000) }
  out.boe.secciones = A(d.seccion).map(s => [s.codigo, s.nombre, A(s.departamento).map(x => x.nombre + ' (' + A(x.epigrafe).length + ')').slice(0, 8)])
  const sec = (c) => A(d.seccion).find(s => s.codigo === c)
  const primero = (c) => { const dep = A(sec(c)?.departamento)[0]; return dep ? JSON.stringify({ dep: dep.nombre, ep: A(dep.epigrafe)[0] ?? null, item: dep.item ?? null }).slice(0, 1800) : null }
  out.boe.s1 = primero('1'); out.boe.s2A = primero('2A'); out.boe.s2B = primero('2B'); out.boe.s3 = primero('3')
  out.boe.departamentos2B = A(sec('2B')?.departamento).map(x => x.nombre)
} catch (e) { out.boe = String(e.message) }

try {
  const j = await (await get('https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain', null, 120)).json()
  const ahora = Date.now()
  const zonas = new Map()
  let vivos = 0
  for (const w of j.warnings) for (const inf of A(w.alert?.info)) {
    if (!/^es/i.test(inf.language ?? '')) continue
    const fin = Date.parse(inf.expires), ini = Date.parse(inf.onset)
    if (fin < ahora) continue
    vivos++
    for (const a of A(inf.area)) for (const g of A(a.geocode)) zonas.set(g.value, a.areaDesc)
  }
  out.meteoalarm = { vivos, zonas: [...zonas].sort() }
  const e = j.warnings.find(w => A(w.alert?.info).some(i => Date.parse(i.expires) > ahora && /^es/i.test(i.language ?? '') && /naranja|rojo/i.test(i.event)))
  out.meteoalarm.ejemploNaranja = e ? JSON.stringify(e).slice(0, 2500) : null
  out.meteoalarm.geocodes = [...new Set(j.warnings.flatMap(w => A(w.alert?.info).flatMap(i => A(i.area).flatMap(a => A(a.geocode).map(g => g.valueName)))))]
} catch (e) { out.meteoalarm = String(e.message) }

for (const [k, u] of Object.entries({
  emma1: 'https://feeds.meteoalarm.org/api/v1/geocodes/ES',
  emma2: 'https://geoportal.meteoalarm.org/arcgis/rest/services',
  emma3: 'https://meteoalarm.org/en/live/',
})) { try { const r = await get(u, null, 30); const t = await r.text(); out[k] = { tipo: r.headers.get('content-type'), bytes: t.length, inicio: t.slice(0, 500) } } catch (e) { out[k] = String(e.message) } }

// Normales climáticas: 1991-2020 de una ciudad, en tramos de 10 años y con reintentos
const tramos = []
for (const [a, b] of [[1991, 2000], [2001, 2010], [2011, 2020]]) {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await (await get(`https://archive-api.open-meteo.com/v1/archive?latitude=40.42&longitude=-3.70&start_date=${a}-01-01&end_date=${b}-12-31&daily=temperature_2m_mean&timezone=Europe%2FMadrid`, null, 120)).json()
      tramos.push({ a, b, n: r.daily?.time?.length, muestra: r.daily?.temperature_2m_mean?.slice(0, 3) }); break
    } catch (e) { tramos.push({ a, b, intento: k, error: String(e.cause?.code ?? e.message) }); await new Promise(r => setTimeout(r, 5000)) }
  }
}
out.normales = tramos
try { out.openmeteo = await (await get('https://api.open-meteo.com/v1/forecast?latitude=40.42&longitude=-3.70&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=Europe%2FMadrid&forecast_days=3')).json() } catch (e) { out.openmeteo = String(e.message) }

mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/sonda-forma.json'), JSON.stringify(out, null, 1))
console.log('ok', Object.keys(out).join(' '))
