// Energía: sistema eléctrico desde la API pública de REE (REData), sin clave.
// Escribe public/energia/data/hoy.json (hoy por horas) e historia.json (meses y años),
// y un resumen pequeño para la portada. Si una consulta falla, se conserva lo anterior.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DIR = here('../public/energia/data/')
mkdirSync(DIR, { recursive: true })
const API = 'https://apidatos.ree.es/es/datos/'
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const leer = (f) => { try { return JSON.parse(readFileSync(DIR + f, 'utf8')) } catch { return null } }

/** Llama a REE y aplana `included` (y su `content` anidado) en { título: { color, tipo, v: [[fecha, valor, %]] } }. */
async function ree(ruta, desde, hasta, trunc, extra = {}) {
  const qs = new URLSearchParams({ start_date: desde, end_date: hasta, time_trunc: trunc, ...extra })
  for (let i = 0; i < 3; i++) {
    await espera(800)
    try {
      const r = await fetch(API + ruta + '?' + qs, { headers: { Accept: 'application/json', Origin: 'https://sermase.github.io' } })
      if (i === 0 && !log._cors) log._cors = r.headers.get('access-control-allow-origin') ?? 'sin cabecera CORS'
      const txt = await r.text()
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160))
      const j = JSON.parse(txt), out = {}
      const meter = (it, grupo) => {
        const a = it.attributes ?? {}
        if (a.values?.length) out[a.title] = { color: a.color, tipo: a.type ?? grupo ?? null, ...(a.composite ? { total: true } : {}), v: a.values.map(x => [x.datetime.slice(0, 16), Math.round(x.value * 100) / 100, x.percentage != null ? Math.round(x.percentage * 1000) / 1000 : null]) }
        for (const c of a.content ?? it.content ?? []) meter(c, a.title ?? it.type)
      }
      for (const it of j.included ?? []) meter(it)
      return out
    } catch (e) { if (i === 2) throw e; await espera(4000 * (i + 1)) }
  }
}
async function paso(id, fn) {
  try { const r = await fn(); log[id] = Object.fromEntries(Object.entries(r).slice(0, 30).map(([k, s]) => [k, `${s.v.length} datos · ${s.v[0]?.[0]} → ${s.v.at(-1)?.join(' ')}`])); return r }
  catch (e) { log[id] = 'ERROR ' + String(e.message).slice(0, 300); return null }
}
/** Une tramos (REE limita el rango de cada consulta). */
async function tramos(ruta, años, trunc, extra) {
  const out = {}
  const fallos = []
  for (const a of años) {
    const fin = a === HOY.getFullYear() ? `${iso(HOY)}T23:59` : `${a}-12-31T23:59`
    let r
    try { r = await ree(ruta, `${a}-01-01T00:00`, fin, trunc, extra) } catch (e) { fallos.push(a + ': ' + String(e.message).slice(0, 60)); continue }
    for (const [k, s] of Object.entries(r)) { out[k] ??= { ...s, v: [] }; out[k].v.push(...s.v) }
  }
  if (!Object.keys(out).length) throw new Error(fallos.join(' | '))
  if (fallos.length) log['_fallos_' + ruta] = fallos
  for (const s of Object.values(out)) { const m = new Map(s.v.map(x => [x[0], x])); s.v = [...m.values()].sort((a, b) => a[0].localeCompare(b[0])) }
  return out
}
const HOY = new Date()
const iso = (d) => new Date(d.getTime() + 3600e3).toISOString().slice(0, 10) // día en España (aprox.)
const ayer = new Date(HOY - 864e5), mañana = new Date(+HOY + 864e5)
const AÑOS = Array.from({ length: HOY.getFullYear() - 2007 + 1 }, (_, i) => 2007 + i)

// ---------- sonda: generación en tiempo real (la web de seguimiento de la demanda de REE) ----------
try {
  const r = await fetch(`https://demanda.ree.es/WSvisionaMovilesPeninsulaRest/resources/demandaGeneracionPeninsula?callback=cb&curva=DEMANDA&fecha=${iso(HOY)}`, { headers: { Origin: 'https://sermase.github.io' } })
  const txt = await r.text()
  log._sonda_tr = { status: r.status, cors: r.headers.get('access-control-allow-origin'), inicio: txt.slice(0, 700) }
} catch (e) { log._sonda_tr = 'ERROR ' + e.message }
for (const [id, ruta] of [['_h_estructura', 'generacion/estructura-generacion'], ['_h_renovable', 'generacion/evolucion-renovable-no-renovable']]) {
  try { const r = await ree(ruta, `${iso(HOY)}T00:00`, `${iso(HOY)}T23:59`, 'hour', { geo_trunc: 'electric_system', geo_limit: 'peninsular', geo_ids: '8741' }); log[id] = Object.keys(r).join(', ') + ' · ' + Object.values(r)[0]?.v.length } catch (e) { log[id] = 'ERROR ' + String(e.message).slice(0, 160) }
}

// ---------- hoy ----------
const hoy = { fecha: HOY.toISOString() }
hoy.mix = await paso('mix_hora', () => ree('generacion/estructura-generacion', `${iso(ayer)}T00:00`, `${iso(HOY)}T23:59`, 'hour'))
hoy.demanda = await paso('demanda_tr', () => ree('demanda/demanda-tiempo-real', `${iso(HOY)}T00:00`, `${iso(HOY)}T23:59`, 'hour'))
hoy.precios = await paso('precios_hora', () => ree('mercados/precios-mercados-tiempo-real', `${iso(ayer)}T00:00`, `${iso(mañana)}T23:59`, 'hour'))
hoy.balance = await paso('balance_dia', () => ree('balance/balance-electrico', `${iso(ayer)}T00:00`, `${iso(ayer)}T23:59`, 'day'))
hoy.co2 = await paso('co2_dia', () => ree('generacion/no-renovables-detalle-emisiones-CO2', `${iso(new Date(HOY - 30 * 864e5))}T00:00`, `${iso(HOY)}T23:59`, 'day'))
hoy.mix30 = await paso('mix_30d', () => ree('generacion/estructura-generacion', `${iso(new Date(HOY - 30 * 864e5))}T00:00`, `${iso(HOY)}T23:59`, 'day'))
const prevHoy = leer('hoy.json')
for (const k of ['mix', 'demanda', 'precios', 'balance', 'co2', 'mix30']) if (!hoy[k]) hoy[k] = prevHoy?.[k] ?? null
writeFileSync(DIR + 'hoy.json', JSON.stringify(hoy))

// ---------- historia (una vez al día basta; los meses pasados no cambian) ----------
const prev = leer('historia.json') ?? {}
const historia = { fecha: HOY.toISOString() }
const H = [
  ['mix_mes', 'generacion/estructura-generacion', 'month'],
  ['renovable_mes', 'generacion/evolucion-renovable-no-renovable', 'month'],
  ['demanda_mes', 'demanda/evolucion', 'month'],
  ['co2_mes', 'generacion/no-renovables-detalle-emisiones-CO2', 'month'],
  ['intercambios_mes', 'intercambios/todas-fronteras-fisicos', 'month'],
]
for (const [id, ruta, trunc] of H) historia[id] = (await paso(id, () => tramos(ruta, AÑOS, trunc))) ?? prev[id] ?? null
historia.precio_dia = (await paso('precio_dia', () => tramos('mercados/precios-mercados-tiempo-real', AÑOS.filter(a => a >= 2014), 'day'))) ?? prev.precio_dia ?? null
historia.potencia = (await paso('potencia', () => tramos('generacion/potencia-instalada', AÑOS, 'year'))) ?? prev.potencia ?? null
writeFileSync(DIR + 'historia.json', JSON.stringify(historia))
writeFileSync(here('../fuentes/energia-log.json'), JSON.stringify(log, null, 1))

// ---------- resumen para la portada ----------
try {
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  const ren = hoy.mix30?.['Renovable'] ?? hoy.mix30?.['Generación renovable']
  const pvpc = hoy.precios?.['PVPC (€/MWh)'] ?? Object.values(hoy.precios ?? {})[0]
  res.energia = { ren: ren?.v.at(-1)?.[2] ?? null, precio: pvpc?.v.at(-1)?.[1] ?? null, fecha: iso(HOY) }
  writeFileSync(RES, JSON.stringify(res, null, 1))
} catch (e) { log._resumen = String(e.message) }
console.log('Energía:', Object.entries(log).filter(([, v]) => typeof v === 'string' && v.startsWith('ERROR')).map(([k]) => k).join(', ') || 'todo bien')
