// Seguridad: delitos conocidos por provincia (series anuales desde 2010) y el último balance trimestral, con los municipios
// de más de 20.000 habitantes, del Portal Estadístico de Criminalidad del Ministerio del Interior. Población del padrón (INE).
// Escribe public/seguridad/data/seguridad.json, public/seguridad/data/municipios.json y resumen.seguridad.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const tmp = '/tmp/seguridad'; mkdirSync(tmp, { recursive: true })
const OUT = here('../public/seguridad/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const MIR = 'https://estadisticasdecriminalidad.ses.mir.es'
const JAR = `${tmp}/cookies.txt`
let n = 0
function curl(url, max = 120) {
  const f = `${tmp}/${++n}`
  for (let i = 0; i < 3; i++) {
    try {
      execFileSync('curl', ['-sSL', '--max-time', String(max), '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-b', JAR, '-c', JAR, '-o', f, url], { timeout: (max + 10) * 1000 })
      if (statSync(f).size > 0) return readFileSync(f)
    } catch (e) { if (i === 2) throw e }
    execFileSync('sleep', ['3'])
  }
  throw new Error('vacío: ' + url)
}
// Interior dice ISO-8859-15 en la cabecera, pero los CSV vienen en UTF-8 con BOM
const latin = (b) => (b[0] === 0xef && b[1] === 0xbb ? new TextDecoder('utf-8').decode(b.subarray(3)) : new TextDecoder('iso-8859-15').decode(b))
/** JaxiPx guarda en la sesión la carpeta abierta: primero el índice, luego la tabla, luego la descarga. */
function indice(path) {
  const html = latin(curl(`${MIR}/sec/dynPx/inebase/index.htm?type=pcaxis&path=${path}&file=pcaxis`))
  return [...html.matchAll(/Tabla\.htm\?path=([^&"']+)&(?:amp;)?file=([\w.]+)[^>]*>([^<]+)</g)].map(m => ({ path: m[1], file: m[2], titulo: m[3].trim() }))
}
function tabla(t) {
  curl(`${MIR}/sec/jaxiPx/Tabla.htm?path=${t.path}&file=${t.file}&L=0`)
  const base = t.path.replace(/\/l0\/?$/, '').replace(/^\//, '')
  const txt = latin(curl(`${MIR}/sec/jaxiPx/files/_px/es/csv_bdsc/${base}/l0/${t.file.replace('.px', '.csv_bdsc')}?nocab=1`))
  if (/^<!DOCTYPE|<html/i.test(txt)) throw new Error('la descarga devolvió HTML: ' + t.file)
  const lin = txt.split(/\r?\n/).filter(Boolean), cab = lin.shift().split(';')
  return { cab, filas: lin.map(l => l.split(';')) }
}
const num = (s) => { if (s == null) return null; const t = s.trim(); if (!t || /^\.+$|^-$/.test(t)) return null; const v = Number(t.replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null }

// ---------- Provincias: nombre de Interior → código INE ----------
const PROV = { '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León', '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla' }
const OTROS = { araba: '01', alava: '01', alacant: '03', baleares: '07', balears: '07', castello: '12', coruna: '15', guipuzcoa: '20', gerona: '17', lerida: '25', orense: '32', vizcaya: '48', valencia: '46', 'santa cruz tenerife': '38', tenerife: '38', 'palmas': '35', rioja: '26', 'principado asturias': '33', 'navarra comunidad foral': '31' }
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^(provincia|municipio|isla) de\s+/, '').replace(/\((el|la|los|las|a|o|l'|illes)\)/g, ' ').replace(/\b(de|del|la|las|los|el|a|o|illes|les)\b/g, ' ').replace(/[^a-z/ ]/g, ' ').replace(/\s+/g, ' ').trim()
const IDX = new Map()
for (const [c, nom] of Object.entries(PROV)) for (const p of norm(nom).split('/')) IDX.set(p.trim(), c)
for (const [k, c] of Object.entries(OTROS)) IDX.set(k, c)
const codProv = (nombre) => {
  if (/total nacional|^espa/i.test(nombre)) return '00'
  for (const p of norm(nombre).split('/').map(x => x.trim())) { if (IDX.has(p)) return IDX.get(p); for (const [k, c] of IDX) if (p === k || p.startsWith(k + ' ') || p.endsWith(' ' + k)) return c }
  return null
}

// ---------- 1. Series anuales: hechos conocidos por provincia y tipología, desde 2010 ----------
indice('/Datos1/')
const serie = tabla({ path: '/Datos1/l0/', file: '01002.px' })
const tiposS = [], años = new Set(), datos = {}
const sinCod = new Set()
for (const [lugar, tip, per, v] of serie.filas) {
  const c = codProv(lugar); if (!c) { sinCod.add(lugar); continue }
  const t = tip.trim(); if (!tiposS.includes(t)) tiposS.push(t)
  años.add(+per); ((datos[c] ??= {})[t] ??= {})[per] = num(v)
}
const AÑOS = [...años].sort()
log.provinciasSinCodigo = [...sinCod]
log.tiposSerie = tiposS
// clave corta y jerarquía a partir de la numeración («1.», «1.1.-», «1.1.1.-»)
const clave = (t) => { const m = t.match(/^([\d.]+)[.\-\s]/); return m ? 's' + m[1].replace(/\.$/, '').replace(/\./g, '_') : t === 'TOTAL INFRACCIONES PENALES' || /^total/i.test(t) ? 'total' : 's_' + norm(t).replace(/ /g, '_').slice(0, 20) }
const limpia = (t) => { const s = t.replace(/^[\d.]+[.\-\s]+/, '').replace(/^-+/, '').trim(); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s }
const TIPOS = tiposS.map(t => ({ k: clave(t), n: limpia(t), nivel: (t.match(/^([\d.]+)/)?.[1].replace(/\.$/, '').split('.').length) ?? 0 }))
const prov = {}
for (const [c, d] of Object.entries(datos)) { prov[c] = {}; for (const [i, t] of tiposS.entries()) prov[c][TIPOS[i].k] = AÑOS.map(a => d[t]?.[a] ?? null) }

// ---------- Población por provincia y año: el padrón municipal que descarga scripts/poblacion.mjs (INE) ----------
const pob = {}
let PADRON = null
try {
  PADRON = JSON.parse(readFileSync(here('../public/poblacion/data/municipios.json'), 'utf8'))
  const col = (a) => PADRON.years.indexOf(a)
  for (const [cod, [, serie]] of Object.entries(PADRON.m)) {
    const c = cod.padStart(5, '0').slice(0, 2)
    pob[c] ??= AÑOS.map(() => 0)
    AÑOS.forEach((a, i) => { const j = col(a); if (j >= 0 && serie[j] != null) pob[c][i] += serie[j] })
  }
  pob['00'] = AÑOS.map((_, i) => Object.values(pob).reduce((s, v) => s + v[i], 0))
  for (const v of Object.values(pob)) v.forEach((x, i) => { if (!x) v[i] = null })
  log.poblacion = Object.keys(pob).length
} catch (e) { log.avisos.push('población: ' + String(e.message).slice(0, 200)) }
// nombre de municipio → código INE, buscándolo en el padrón dentro de su provincia
const normM = (s) => norm(s.replace(/^(.*?)\s*\((el|la|los|las|l'|els|les|o|a|as|os|s')\)$/i, '$2 $1').replace(/^(.*?),\s*(el|la|los|las|l'|els|les|o|a|as|os)$/i, '$2 $1')).replace(/\//g, ' ')
let MUNIS = null
function codMuni(nombre, prov) {
  if (!PADRON) return null
  MUNIS ??= Object.entries(PADRON.m).map(([c, [n]]) => ({ c: c.padStart(5, '0'), n: normM(n), partes: n.split('/').map(normM) }))
  const x = normM(nombre)
  const cand = MUNIS.filter(m => !prov || m.c.startsWith(prov))
  const en = (lista) => (lista.find(m => m.n === x || m.partes.includes(x)) ?? lista.find(m => m.n.startsWith(x + ' ') || x.startsWith(m.n + ' ')))?.c ?? null
  if (prov) return en(cand)
  // sin provincia, solo si el nombre es único en España
  const todos = MUNIS.filter(m => m.n === x || m.partes.includes(x))
  return todos.length === 1 ? todos[0].c : null
}

// ---------- 2. Balances trimestrales: el último publicado y los cuartos trimestres para los municipios ----------
const hoy = new Date(), ultimos = []
for (let a = hoy.getFullYear(); a >= hoy.getFullYear() - 1 && !ultimos.length; a--) for (let q = 4; q >= 1; q--) {
  const ts = indice(`/DatosBalanceAnt/${a}${q}/`)
  if (ts.length >= 3) { ultimos.push({ a, q, ts }); break }
}
const fila3 = (t) => tabla(t)
/** Clave estable de cada indicador del balance, por su nombre: la numeración y los nombres cambiaron en 2016, 2019 y 2022. */
function claveBalance(t) {
  const x = norm(t)
  const R = [
    ['total', /total infracciones|delitos y faltas/], ['restoConv', /resto criminalidad convencional/], ['conv', /criminalidad convencional/], ['ciber', /cibercriminalidad/],
    ['homicidio', /homicidios dolosos.*consumad/], ['tentativa', /tentativa/], ['lesiones', /lesiones/], ['secuestro', /secuestro/],
    ['penetracion', /penetracion/], ['restoSexual', /resto .*sexual/], ['sexual', /sexual/], ['violencia', /robos? con violencia/],
    ['domicilios', /fuerza en domicilios$/], ['fuerza', /robos con fuerza/], ['hurtos', /hurtos/], ['vehiculos', /sustraccion/],
    ['drogas', /trafico drogas/], ['estafas', /estafas informaticas/], ['otrosCiber', /otros ciberdelitos/], ['danos', /danos/],
    ['resto', /resto infracciones/],
  ]
  for (const [k, re] of R) if (re.test(x)) return k
  return 'x_' + x.replace(/ /g, '_').slice(0, 18)
}
function balance({ a, q, ts }) {
  // Tablas: comunidades, provincias, municipios. Columnas: lugar; tipología; periodo; valor
  const [, tp, tm] = ts
  const P = fila3(tp), M = fila3(tm)
  const periodos = [...new Set(P.filas.map(f => f[2]).filter(p => !/variaci/i.test(p)))]
  const tipos = [...new Set(P.filas.map(f => f[1].trim()))]
  const k2 = claveBalance
  const prov = {}, sinC = new Set()
  for (const [lugar, tip, per, v] of P.filas) {
    if (/variaci/i.test(per)) continue
    const c = codProv(lugar); if (!c) { sinC.add(lugar); continue }
    ((prov[c] ??= {})[k2(tip.trim())] ??= [null, null])[periodos.indexOf(per)] = num(v)
  }
  // municipios: desde 2024 traen el código INE delante («04013 Almería»); antes, «- Municipio de Almería» bajo «Provincia de ALMERÍA»
  const muni = {}, sinMuni = new Set()
  let provActual = null
  for (const [lugar, tip, per, v] of M.filas) {
    if (/variaci/i.test(per)) continue
    const l = lugar.trim()
    // «Provincia de X» o, en las comunidades de una sola provincia, la propia comunidad («PRINCIPADO DE ASTURIAS»)
    if (!/municipio|^\d{5}\s|^isla/i.test(l)) { provActual = codProv(l); continue }
    let cod = l.match(/^(\d{5})\s/)?.[1] ?? null
    if (!cod && /municipio de/i.test(l)) cod = codMuni(l.replace(/^-?\s*municipio de\s*/i, ''), provActual)
    if (!cod) { if (/municipio/i.test(l)) sinMuni.add(l); continue }
    ((muni[cod] ??= {})[k2(tip.trim())] ??= [null, null])[periodos.indexOf(per)] = num(v)
  }
  log['sinMunicipio ' + a + q] = [...sinMuni].slice(0, 40)
  log['balance ' + a + q] = { periodos, tipos, provinciasSinCodigo: [...sinC], municipiosEjemplo: Object.keys(muni).slice(0, 60), municipios: Object.keys(muni).length }
  return { a, q, periodos, tipos: tipos.map(t => ({ k: k2(t), n: limpia(t) })), prov, muni }
}
const ult = ultimos[0] ? balance(ultimos[0]) : null
// cuartos trimestres para la historia de los municipios (cada uno trae el año y el anterior)
const muniHist = {}
for (let a = (ult?.q === 4 ? ult.a : (ult?.a ?? hoy.getFullYear()) - 1); a >= 2016; a--) {
  try {
    const ts = indice(`/DatosBalanceAnt/${a}4/`); if (ts.length < 3) continue
    const b = a === ult?.a && ult.q === 4 ? ult : balance({ a, q: 4, ts })
    for (const [m, d] of Object.entries(b.muni)) for (const [k, [ant, act]] of Object.entries(d)) {
      const s = ((muniHist[m] ??= {})[k] ??= {})
      if (act != null) s[a] = act
      if (ant != null && s[a - 1] == null) s[a - 1] = ant
    }
  } catch (e) { log.avisos.push(`Q4 ${a}: ${String(e.message).slice(0, 200)}`) }
}

// ---------- Salida ----------
const fecha = new Date().toISOString().slice(0, 10)
writeFileSync(`${OUT}/seguridad.json`, JSON.stringify({ fecha, años: AÑOS, tipos: TIPOS, prov, pob, balance: ult && { año: ult.a, trimestre: ult.q, periodos: ult.periodos, tipos: ult.tipos, prov: ult.prov } }))
const MA = [...new Set(Object.values(muniHist).flatMap(d => Object.values(d).flatMap(s => Object.keys(s).map(Number))))].sort()
const mOut = {}
for (const [c, d] of Object.entries(muniHist)) {
  const p = PADRON?.m[c] ?? PADRON?.m[String(+c)]
  mOut[c] = { n: p?.[0] ?? c, pob: MA.map(a => p?.[1][PADRON.years.indexOf(a)] ?? null), d: Object.fromEntries(Object.entries(d).map(([k, s]) => [k, MA.map(a => s[a] ?? null)])) }
}
writeFileSync(`${OUT}/municipios.json`, JSON.stringify({ fecha, años: MA, balance: ult && { año: ult.a, trimestre: ult.q, periodos: ult.periodos, muni: ult.muni }, muni: mOut }))
const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
const tot = prov['00']?.total ?? prov['00']?.[TIPOS[0].k], i = AÑOS.length - 1
if (tot) res.seguridad = { año: AÑOS[i], total: tot[i], var: tot[i - 1] ? ((tot[i] - tot[i - 1]) / tot[i - 1]) * 100 : null, tasa: pob['00']?.[i] ? (tot[i] / pob['00'][i]) * 1000 : null }
writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/seguridad-log.json'), JSON.stringify(log, null, 1))
console.log(`Seguridad: ${Object.keys(prov).length} territorios, ${TIPOS.length} tipos, ${AÑOS[0]}-${AÑOS.at(-1)}; balance ${ult?.a}T${ult?.q}; ${Object.keys(muniHist).length} municipios`)
