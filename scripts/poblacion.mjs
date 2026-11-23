// Población: padrón municipal desde 1996, indicadores por municipio y series nacionales del INE.
// Escribe public/poblacion/data/{municipios,indicadores,series}.json y el resumen de la portada.
// Uso: node scripts/poblacion.mjs        (Node 20+; sin dependencias)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DIR = here('../public/poblacion/data/')
const API = 'https://servicios.ine.es/wstempus/js/ES'
const CSV = (id) => `https://www.ine.es/jaxiT3/files/t/es/csv_bd/${id}.csv`

async function get(url, as = 'json') {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return as === 'json' ? await r.json() : await r.text()
    } catch (e) { console.warn('Reintento', url, e.message); await new Promise(s => setTimeout(s, 4000 * (i + 1))) }
  }
  throw new Error('No responde: ' + url)
}
const num = (s) => { const v = parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null }
const log = {}

// ---- 1. Padrón por municipio (tabla 29005): población total cada 1 de enero desde 1996 ----
{
  const txt = await get(CSV(29005), 'text')
  const lines = txt.split(/\r?\n/)
  const head = lines[0].split('\t')
  const years = new Set(), tot = new Map(), sexo = new Map()
  for (const l of lines.slice(1)) {
    const c = l.split('\t'); if (c.length < 4) continue
    const m = c[0].match(/^(\d{5}) (.+)$/); if (!m) continue
    const [, id, name] = m, y = Number(c[2]), v = num(c[3])
    if (!Number.isFinite(y) || v == null) continue
    years.add(y)
    if (/^Total/i.test(c[1])) { if (!tot.has(id)) tot.set(id, { n: name, v: {} }); tot.get(id).v[y] = v }
    else { if (!sexo.has(id)) sexo.set(id, {}); sexo.get(id)[`${/^Hombre/i.test(c[1]) ? 'h' : 'm'}${y}`] = v }
  }
  const Y = [...years].sort((a, b) => a - b), last = Y[Y.length - 1]
  const out = { years: Y, cols: ['n', 'pop[]', 'h', 'm'], m: {} }
  for (const [id, { n, v }] of tot) {
    const s = sexo.get(id) ?? {}
    out.m[id] = [n, Y.map(y => v[y] ?? null), s[`h${last}`] ?? null, s[`m${last}`] ?? null]
  }
  writeFileSync(DIR + 'municipios.json', JSON.stringify(out))
  log.padron = { cabecera: head, municipios: tot.size, años: [Y[0], last] }
  const es = [...tot.values()].reduce((t, x) => t + (x.v[last] ?? 0), 0)
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  res.poblacion = { año: last, total: es, municipios: tot.size }
  writeFileSync(RES, JSON.stringify(res, null, 1))
  console.log(`Padrón ${last}: ${tot.size} municipios, ${es} habitantes`)
}

// ---- 2. Indicadores por municipio (último año): edad media, envejecimiento, nacidos fuera ----
const IND_MUNI = { 30699: 'edad', 30702: 'envej', 34982: 'nacidos', 30696: 'vegetativo' }
{
  const out = {}
  for (const [id, key] of Object.entries(IND_MUNI)) {
    try {
      const j = await get(`${API}/DATOS_TABLA/${id}?nult=1&tip=AM`)
      log[`muni_${key}`] = { series: j.length, ejemplos: j.slice(0, 6).map(s => [s.Nombre, s.MetaData?.map(m => `${m.Variable?.Codigo ?? m.T3_Variable}:${m.Codigo}:${m.Nombre}`), s.Data?.[0]?.Anyo, s.Data?.[0]?.Valor]) }
      out[key] = { año: null, v: {} }
      for (const s of j) {
        const md = s.MetaData ?? []
        const muni = md.find(m => /^\d{5}$/.test(m.Codigo ?? ''))
        if (!muni) continue
        // nos quedamos con «ambos sexos / total» cuando la tabla trae más cortes
        const extra = md.filter(m => m !== muni).map(m => m.Nombre).join(' ')
        if (/hombre|mujer|extranjer|españ/i.test(extra) && !/total|ambos/i.test(extra)) continue
        const d = s.Data?.[0]; if (!d || d.Valor == null) continue
        if (out[key].v[muni.Codigo] != null && !/total|ambos/i.test(extra)) continue
        out[key].v[muni.Codigo] = d.Valor; out[key].año = d.Anyo
        out[key].ej ??= s.Nombre
      }
    } catch (e) { log[`muni_${key}`] = String(e.message) }
  }
  writeFileSync(DIR + 'indicadores.json', JSON.stringify(out))
}

// ---- 3. Series nacionales anuales (todas las series de cada tabla, con su nombre) ----
const NAC = {
  vida: 1414, natalidad: 1381, mortalidad: 1411, vegetativo: 1416, fecundidad: 1407, maternidad: 1579,
  edadMedia: 3197, envejecimiento: 1418, nacidosFuera: 5230, migracion: 5860, migracion21: 61546, dependencia: 1419,
}
{
  const out = {}
  for (const [key, id] of Object.entries(NAC)) {
    try {
      const j = await get(`${API}/DATOS_TABLA/${id}?nult=80`)
      out[key] = { id, series: j.map(s => ({ n: s.Nombre.replace(/\.\s*$/, '').trim(), d: (s.Data ?? []).filter(d => d.Valor != null).map(d => [d.Anyo, +Number(d.Valor).toFixed(3)]).sort((a, b) => a[0] - b[0]) })).filter(s => s.d.length) }
      log[`nac_${key}`] = out[key].series.slice(0, 40).map(s => s.n)
    } catch (e) { log[`nac_${key}`] = String(e.message) }
  }
  writeFileSync(DIR + 'series.json', JSON.stringify(out))
}

// ---- 4. Pirámide: población residente por sexo y edad desde 1971 (tabla 56934) ----
{
  try {
    const txt = await get(CSV(56934), 'text')
    const lines = txt.split(/\r?\n/)
    log.piramide = { cabecera: lines[0], ejemplos: lines.slice(1, 8) }
    const head = lines[0].split('\t')
    const iSex = head.findIndex(h => /sexo/i.test(h)), iAge = head.findIndex(h => /edad/i.test(h)), iPer = head.findIndex(h => /periodo/i.test(h)), iVal = head.length - 1
    const py = {}
    for (const l of lines.slice(1)) {
      const c = l.split('\t'); if (c.length < head.length) continue
      // solo el 1 de enero de cada año
      const per = c[iPer]; const m = per.match(/^1 de enero de (\d{4})$/i) || per.match(/^(\d{4})M01$/) || per.match(/^(\d{4})-01-01/)
      if (!m) continue
      const year = Number(m[1]), sex = /hombre/i.test(c[iSex]) ? 'h' : /mujer/i.test(c[iSex]) ? 'm' : null
      if (!sex) continue
      const am = c[iAge].match(/^(\d+)/); if (!am) continue
      const age = Math.min(100, Number(am[1])), v = num(c[iVal]); if (v == null) continue
      py[year] ??= { h: Array(101).fill(0), m: Array(101).fill(0) }
      py[year][sex][age] += v
    }
    log.piramide.años = Object.keys(py).length
    writeFileSync(DIR + 'piramide.json', JSON.stringify(py))
  } catch (e) { log.piramide = String(e.message) }
}

writeFileSync(here('../fuentes/poblacion-log.json'), JSON.stringify(log, null, 1))
console.log('Población: listo')
