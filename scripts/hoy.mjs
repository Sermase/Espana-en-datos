// España hoy: terremotos (IGN), avisos meteorológicos (MeteoAlarm/AEMET), temperatura frente a lo normal (Open-Meteo),
// lo que publica hoy el BOE, el euro y el mercado eléctrico (BCE y Red Eléctrica).
// Escribe public/hoy/data/hoy.json y public/hoy/data/cinta.json (pequeño, para la cinta de la portada) y fuentes/hoy-log.json.
// Ninguno de los dos se guarda en el repositorio: se rehacen en cada despliegue. Para probar sin red: HOY_SIN_RED=1.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CAPITALES } from './capitales.mjs'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/hoy/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const A = (x) => x == null ? [] : Array.isArray(x) ? x : [x]
const UA = { 'user-agent': 'espana-en-datos/1.0 (https://sermase.github.io/Espana-en-datos/)' }
async function pide(url, { accept, texto, t = 60000, intentos = 3 } = {}) {
  let err
  for (let k = 0; k < intentos; k++) {
    try { const r = await fetch(url, { headers: { ...UA, ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(t) }); if (!r.ok) throw new Error('HTTP ' + r.status); return texto ? r.text() : r.json() } catch (e) { err = e; await new Promise(r => setTimeout(r, 2000 * (k + 1))) }
  }
  throw err
}
const ahora = Date.now()
const out = { actualizado: new Date(ahora).toISOString() }

// 1. Terremotos de los últimos diez días (IGN, GeoRSS). Las horas del IGN son UTC.
try {
  const xml = await pide('https://www.ign.es/ign/RssTools/sismologia.xml', { texto: true })
  const lista = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], g = (k) => it.match(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`))?.[1]?.trim() ?? ''
    const f = g('title').match(/(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+)/), d = g('description').match(/magnitud ([\d.,]+) en (.+?) en la fecha/)
    if (!f || !d) continue
    const t = Date.UTC(+f[3], +f[2] - 1, +f[1], +f[4], +f[5], +f[6])
    lista.push({ t: new Date(t).toISOString().slice(0, 19) + 'Z', m: Number(d[1].replace(',', '.')), lugar: d[2].replace(/\.[A-Z]{2,3}$/, ''), lat: Number(g('geo:lat')), lon: Number(g('geo:long')), url: g('link').replace('http://', 'https://') })
  }
  lista.sort((a, b) => b.t.localeCompare(a.t))
  const h24 = lista.filter(x => ahora - Date.parse(x.t) < 864e5)
  out.sismos = { n10d: lista.length, n24h: h24.length, magMax: lista.length ? Math.max(...lista.map(x => x.m)) : null, magMax24h: h24.length ? Math.max(...h24.map(x => x.m)) : null, lista: lista.slice(0, 400) }
} catch (e) { log.sismos = String(e.message) }

// 2. Avisos vigentes (AEMET, a través de MeteoAlarm). Solo amarillo, naranja y rojo.
const TIPO = { 1: 'Viento', 2: 'Nieve y hielo', 3: 'Tormentas', 4: 'Nieblas', 5: 'Temperaturas máximas', 6: 'Temperaturas mínimas', 7: 'Fenómenos costeros', 8: 'Incendios forestales', 9: 'Aludes', 10: 'Lluvias', 11: 'Inundaciones', 12: 'Lluvia e inundaciones' }
try {
  const j = await pide('https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain', { t: 120000 })
  const grupos = new Map(); let vigentes = 0
  for (const w of A(j.warnings)) for (const inf of A(w.alert?.info)) {
    if (!/^es/i.test(inf.language ?? '')) continue
    const fin = Date.parse(inf.expires), ini = Date.parse(inf.onset)
    if (!(fin > ahora)) continue
    const par = Object.fromEntries(A(inf.parameter).map(p => [p.valueName, String(p.value)]))
    const nivel = Number((par.awareness_level ?? '').split(';')[0]), tipo = Number((par.awareness_type ?? '').split(';')[0])
    if (!(nivel >= 2)) continue
    vigentes++
    const k = `${tipo}|${nivel}`, g = grupos.get(k) ?? { tipo, nombre: TIPO[tipo] ?? 'Otros', nivel, zonas: new Set(), desde: ini, hasta: fin, texto: inf.description ?? '' }
    for (const a of A(inf.area)) g.zonas.add(a.areaDesc)
    g.desde = Math.min(g.desde, ini); g.hasta = Math.max(g.hasta, fin)
    if ((inf.description ?? '').length > g.texto.length) g.texto = inf.description
    grupos.set(k, g)
  }
  const lg = [...grupos.values()].sort((a, b) => b.nivel - a.nivel || b.zonas.size - a.zonas.size).map(g => ({ tipo: g.tipo, nombre: g.nombre, nivel: g.nivel, zonas: [...g.zonas].sort((a, b) => a.localeCompare(b, 'es')), desde: new Date(g.desde).toISOString(), hasta: new Date(g.hasta).toISOString(), texto: g.texto.slice(0, 280) }))
  out.avisos = { vigentes, grupos: lg, naranjaOMas: lg.filter(g => g.nivel >= 3).reduce((s, g) => s + g.zonas.length, 0), zonas: lg.reduce((s, g) => s + g.zonas.length, 0) }
} catch (e) { log.avisos = String(e.message) }

// 3. Temperatura de hoy en las 52 capitales frente a lo normal (media 1991-2020 de estos días)
try {
  const cods = Object.keys(CAPITALES)
  const lat = cods.map(c => CAPITALES[c][1]).join(','), lon = cods.map(c => CAPITALES[c][2]).join(',')
  const r = await pide(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min&timezone=Europe%2FMadrid&forecast_days=1`)
  const arr = Array.isArray(r) ? r : [r]
  const normales = existsSync(OUT + '/normales.json') ? JSON.parse(readFileSync(OUT + '/normales.json', 'utf8')) : null
  const hoyMadrid = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }), [, mm, dd] = hoyMadrid.split('-').map(Number)
  const idx = Math.floor((Date.UTC(2000, mm - 1, dd) - Date.UTC(2000, 0, 1)) / 864e5)
  const ciudades = cods.map((c, k) => {
    const x = arr[k], media = x.daily.temperature_2m_mean[0], normal = normales?.n?.[c]?.[idx] ?? null
    return { cod: c, n: CAPITALES[c][0], ahora: x.current.temperature_2m, media, max: x.daily.temperature_2m_max[0], min: x.daily.temperature_2m_min[0], normal, anom: normal != null && media != null ? Math.round((media - normal) * 10) / 10 : null }
  })
  const an = ciudades.map(c => c.anom).filter(v => v != null)
  out.tiempo = { fecha: hoyMadrid, ref: normales?.ref ?? null, ciudades, anomMedia: an.length ? Math.round((an.reduce((s, v) => s + v, 0) / an.length) * 10) / 10 : null }
} catch (e) { log.tiempo = String(e.message) }

// 4. El BOE de hoy (si hoy no hay, el último de los tres días anteriores)
try {
  let j = null, fecha = null
  for (let k = 0; k < 4 && !j; k++) {
    const f = new Date(ahora - k * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).replaceAll('-', '')
    try { j = await pide(`https://www.boe.es/datosabiertos/api/boe/sumario/${f}`, { accept: 'application/json', intentos: 1 }); fecha = f } catch { /* sin BOE ese día */ }
  }
  if (!j) throw new Error('sin sumario')
  const d = A(j.data.sumario.diario)[0], items = []
  for (const s of A(d.seccion)) for (const dep of A(s.departamento)) {
    for (const it of A(dep.item)) items.push({ s: s.codigo, dep: dep.nombre, ep: '', it })
    for (const ep of A(dep.epigrafe)) for (const it of A(ep.item)) items.push({ s: s.codigo, dep: dep.nombre, ep: ep.nombre, it })
  }
  const sec = (c) => items.filter(x => x.s === c)
  const noPersona = (t) => !/\b(don|doña|dña\.?|d\.)\s+[A-ZÁÉÍÓÚÑ]/.test(t)
  const corta = (t) => { t = t.replace(/\s+/g, ' '); if (t.length <= 230) return t; const c = t.slice(0, 230), k = c.lastIndexOf(' '); return c.slice(0, k > 150 ? k : 230).replace(/[,;:\s]+$/, '') + '…' }
  const fmt = (x) => ({ t: corta(x.it.titulo), dep: x.dep.replace(/^MINISTERIO D(E|EL|E LA|E LOS) /i, ''), u: x.it.url_html ?? x.it.url_pdf?.texto })
  const ayudasRe = /subvenci|ayuda|becas?\b|bases reguladoras|convocatoria de/i
  out.boe = {
    fecha: `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6)}`, url: d.sumario_diario?.url_pdf?.texto ?? null, total: items.length,
    secciones: A(d.seccion).map(s => ({ c: s.codigo, n: s.nombre, total: items.filter(x => x.s === s.codigo).length })),
    disposiciones: sec('1').filter(x => noPersona(x.it.titulo)).slice(0, 8).map(fmt),
    empleo: sec('2B').filter(x => noPersona(x.it.titulo)).slice(0, 8).map(fmt),
    ayudas: items.filter(x => ['1', '3', '5B'].includes(x.s) && ayudasRe.test(x.it.titulo) && noPersona(x.it.titulo)).slice(0, 8).map(fmt),
    contratos: sec('5A').length,
  }
} catch (e) { log.boe = String(e.message) }

// 5. Euro y mercado eléctrico
out.mercado = {}
try {
  const t = await pide('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=2&format=csvdata', { texto: true })
  const f = t.trim().split('\n'), h = f[0].split(','), fi = f.slice(1).map(l => l.split(',')), ix = (k) => h.indexOf(k)
  const v = fi.map(c => ({ f: c[ix('TIME_PERIOD')], v: Number(c[ix('OBS_VALUE')]) }))
  out.mercado.eurusd = { v: v.at(-1).v, f: v.at(-1).f, antes: v.length > 1 ? v[0].v : null }
} catch (e) { log.eurusd = String(e.message) }
try {
  const dia = new Date(ahora).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
  const j = await pide(`https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=${dia}T00:00&end_date=${dia}T23:59&time_trunc=hour`)
  log.ree = A(j.included).map(x => `${x.type}: ${x.attributes?.values?.length}`)
  const sp = A(j.included).find(x => /spot/i.test(x.type + ' ' + (x.attributes?.title ?? ''))) ?? A(j.included).find(x => !/pvpc/i.test(x.type))
  const pv = A(j.included).find(x => /pvpc/i.test(x.type))
  // el mercado mayorista ya publica por cuartos de hora: se pasa a la media de cada hora
  const serie = (x) => { const por = new Map(); for (const v of A(x?.attributes?.values)) { const h = v.datetime.slice(0, 13), a = por.get(h) ?? { h: h + ':00', s: 0, n: 0 }; a.s += v.value; a.n++; por.set(h, a) } return [...por.values()].map(a => ({ h: a.h, v: Math.round((a.s / a.n) * 100) / 100 })) }
  if (sp) out.mercado.spot = { titulo: sp.attributes?.title ?? sp.type, horas: serie(sp) }
  if (pv) out.mercado.pvpc = { titulo: pv.attributes?.title ?? pv.type, horas: serie(pv) }
} catch (e) { log.ree = String(e.message) }

// 6. La cinta de la portada: lo llamativo del día
const cinta = [], es = (v, d = 0) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
if (out.sismos) { cinta.push({ n: 'Terremotos 24 h', v: String(out.sismos.n24h) }); if (out.sismos.magMax24h != null) cinta.push({ n: 'Mayor sismo hoy', v: `M ${es(out.sismos.magMax24h, 1)}` }) }
if (out.avisos) cinta.push({ n: 'Zonas con aviso naranja o rojo', v: String(out.avisos.naranjaOMas) })
if (out.tiempo?.anomMedia != null) cinta.push({ n: 'Temperatura frente a lo normal', v: `${out.tiempo.anomMedia > 0 ? '+' : ''}${es(out.tiempo.anomMedia, 1)} °C`, cambio: out.tiempo.anomMedia })
if (out.mercado.eurusd) cinta.push({ n: 'Euro', v: `${es(out.mercado.eurusd.v, 4)} $`, cambio: out.mercado.eurusd.antes != null ? out.mercado.eurusd.v - out.mercado.eurusd.antes : undefined })
if (out.boe) cinta.push({ n: 'BOE de hoy', v: `${out.boe.total} textos` })
writeFileSync(OUT + '/hoy.json', JSON.stringify(out))
writeFileSync(OUT + '/cinta.json', JSON.stringify({ actualizado: out.actualizado, items: cinta, num: { sismos24h: out.sismos?.n24h, magMax24h: out.sismos?.magMax24h, naranja: out.avisos?.naranjaOMas, anom: out.tiempo?.anomMedia } }))
mkdirSync(here('../fuentes'), { recursive: true }); writeFileSync(here('../fuentes/hoy-muestra.json'), JSON.stringify(out)); writeFileSync(here('../fuentes/hoy-log.json'), JSON.stringify({ ...log, fecha: out.actualizado, claves: Object.keys(out) }, null, 1))
console.log('hoy:', Object.keys(out).join(' '), Object.keys(log).length > 1 ? 'AVISOS ' + JSON.stringify(log) : '')
