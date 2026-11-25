// Turismo: quién nos visita y cuánto gasta (FRONTUR y EGATUR del INE, mes a mes desde 2015), dónde duerme
// (Encuesta de Ocupación Hotelera del INE por provincia desde 1999 y por punto turístico), las viviendas turísticas
// por provincia (INE, experimental) y la comparación con Europa (Eurostat, noches de no residentes).
// Escribe public/turismo/data/turismo.json, resumen.turismo y fuentes/turismo-log.json (estructura de cada tabla).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/turismo/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES', EST = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function get(url) {
  for (let i = 0; i < 3; i++) {
    await espera(400)
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' }, signal: AbortSignal.timeout(180e3) }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json() }
    catch (e) { if (i === 2) throw new Error(`${url}: ${e.message}`); await espera(3000 * (i + 1)) }
  }
}
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const pad = (n) => String(n).padStart(2, '0')
/** Tabla del INE → series con el nombre partido y los datos por periodo («2026-10» si es mensual, «2026» si es anual). */
async function ine(id, nult) {
  const j = await get(`${INE}/DATOS_TABLA/${id}?nult=${nult}`)
  log['tabla' + id] = { series: j.length, muestra: j.slice(0, 8).map(s => s.Nombre).concat(j.slice(-4).map(s => s.Nombre)), periodos: [...new Set((j[0]?.Data ?? []).map(x => x.FK_Periodo))].slice(0, 15) }
  return j.map(s => ({
    nombre: s.Nombre, partes: s.Nombre.split('. ').map(x => x.replace(/\.\s*$/, '').trim()).filter(Boolean),
    d: Object.fromEntries((s.Data ?? []).filter(x => x.Valor != null).map(x => [x.FK_Periodo >= 1 && x.FK_Periodo <= 12 ? `${x.Anyo}-${pad(x.FK_Periodo)}` : String(x.Anyo), x.Valor])),
  }))
}
/** Varias versiones de la misma tabla (el INE las parte por bases): se unen, y manda la más reciente en cada periodo. */
async function ineUnidas(ids, nult) {
  const todas = []
  for (const id of ids) { try { todas.push(...(await ine(id, nult)).map(s => ({ ...s, tabla: id }))) } catch (e) { log.avisos.push(`tabla ${id}: ${String(e.message).slice(0, 160)}`) } }
  return todas
}
const esVariacion = (p) => p.some(x => /variaci|tasa|acumulad|porcentaje|distribuci/i.test(x))
const sumaAños = (d) => { const a = {}; for (const [k, v] of Object.entries(d)) if (k.length === 7) { const y = k.slice(0, 4); (a[y] ??= { s: 0, n: 0 }); a[y].s += v; a[y].n++ } return a }

// ---------- provincias ----------
const PROV = { '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León', '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla' }
const OTROS = { araba: '01', alava: '01', alacant: '03', alicante: '03', baleares: '07', balears: '07', castello: '12', castellon: '12', coruna: '15', guipuzcoa: '20', gerona: '17', lerida: '25', orense: '32', vizcaya: '48', valencia: '46', 'santa cruz tenerife': '38', tenerife: '38', palmas: '35', rioja: '26', asturias: '33', navarra: '31', cantabria: '39', madrid: '28', murcia: '30' }
const normP = (s) => norm(s).replace(/\b(de|del|la|las|los|el|a|o|illes|les|provincia|comunidad|region|principado|foral|valencia\/valencia)\b/g, ' ').replace(/\s+/g, ' ').trim()
const IDX = new Map()
for (const [c, nom] of Object.entries(PROV)) IDX.set(normP(nom), c)
for (const [k, c] of Object.entries(OTROS)) IDX.set(k, c)
const codProv = (nombre) => { const p = normP(nombre); if (IDX.has(p)) return IDX.get(p); for (const [k, c] of IDX) if (p.startsWith(k + ' ') || p.endsWith(' ' + k) || p.split(/[\/ ]/).includes(k)) return c; return null }

// ---------- comunidades ----------
const CCAA = { andalucia: 'Andalucía', aragon: 'Aragón', asturias: 'Asturias', balears: 'Illes Balears', baleares: 'Illes Balears', canarias: 'Canarias', cantabria: 'Cantabria', 'castilla y leon': 'Castilla y León', 'castilla la mancha': 'Castilla-La Mancha', cataluna: 'Cataluña', valenciana: 'C. Valenciana', extremadura: 'Extremadura', galicia: 'Galicia', madrid: 'Madrid', murcia: 'Murcia', navarra: 'Navarra', 'pais vasco': 'País Vasco', rioja: 'La Rioja', ceuta: 'Ceuta', melilla: 'Melilla' }
const ccaaDe = (s) => { const n = norm(s); const k = Object.keys(CCAA).find(k => n === k || n.includes(k)); return k ? CCAA[k] : null }

const datos = { fecha: new Date().toISOString().slice(0, 10) }
const GENERICO = /^(total|dato base|dato|turistas|n[uú]mero de turistas|visitantes|gasto|total nacional|nacional|personas|euros|total pa[ií]ses|todos los pa[ií]ses)$/i

/** De una tabla «por país» o «por comunidad» de FRONTUR/EGATUR: {clave: {medida: {periodo: valor}}}. */
function porClave(series, clave, medidaDe) {
  const out = {}
  for (const s of series) {
    if (esVariacion(s.partes)) continue
    const k = clave(s.partes); if (!k) continue
    const m = medidaDe(s.partes); if (!m) continue
    const dst = ((out[k] ??= {})[m] ??= {})
    for (const [p, v] of Object.entries(s.d)) dst[p] = v // la última tabla leída (la más reciente) manda
  }
  return out
}
const paisDe = (p) => { const r = p.filter(x => !GENERICO.test(x) && !/turista|gasto|duraci|medio|total$/i.test(x)); return r.length ? r.join(' · ') : p.some(x => /^total/i.test(x)) ? 'Total' : null }
const medidaGasto = (p) => { const t = norm(p.join(' ')); return /gasto medio diario/.test(t) ? 'diario' : /gasto medio por persona/.test(t) ? 'persona' : /duracion media/.test(t) ? 'dias' : /gasto total/.test(t) ? 'total' : /turistas/.test(t) ? 'turistas' : null }

// 1. FRONTUR: turistas por país de residencia y por comunidad de destino (mensual desde 2015)
try {
  const t = await ineUnidas([10822, 23984, 75719], 160)
  datos.paises = porClave(t, paisDe, () => 'turistas')
  log.paises = Object.keys(datos.paises)
} catch (e) { log.avisos.push('frontur países: ' + e.message) }
try {
  const t = await ineUnidas([10823, 23988, 75720], 160)
  datos.ccaa = porClave(t, p => p.some(x => /^total/i.test(x)) && !p.some(ccaaDe) ? 'Total' : (p.map(ccaaDe).find(Boolean) ?? null), () => 'turistas')
  log.ccaa = Object.keys(datos.ccaa)
} catch (e) { log.avisos.push('frontur ccaa: ' + e.message) }

// 2. EGATUR: gasto por país y por comunidad; partidas de gasto
try { const t = await ineUnidas([10838, 23994, 75715], 160); datos.gastoPais = porClave(t, paisDe, medidaGasto); log.gastoPais = Object.keys(datos.gastoPais) } catch (e) { log.avisos.push('egatur países: ' + e.message) }
try { const t = await ineUnidas([10839, 23998, 75714], 160); datos.gastoCcaa = porClave(t, p => p.map(ccaaDe).find(Boolean) ?? (p.some(x => /^total/i.test(x)) ? 'Total' : null), medidaGasto); log.gastoCcaa = Object.keys(datos.gastoCcaa) } catch (e) { log.avisos.push('egatur ccaa: ' + e.message) }
try {
  const t = await ineUnidas([13938, 23997, 75717], 30)
  datos.partidas = porClave(t, p => { const r = p.filter(x => !GENERICO.test(x) && !/^gasto|^partidas|medio|^total$/i.test(x)); return r.length ? r.join(' · ') : 'Total' }, p => (/gasto total|^total/i.test(p.join(' ')) || !/medio|variaci|distribu/i.test(p.join(' '))) ? 'total' : null)
  log.partidas = Object.keys(datos.partidas)
} catch (e) { log.avisos.push('egatur partidas: ' + e.message) }

// 3. Encuesta de Ocupación Hotelera: viajeros y pernoctaciones por provincia (mensual desde 1999)
try {
  const t = await ine(2074, 360)
  const nac = { esp: {}, ext: {}, viaj: {} }, prov = {}
  for (const s of t) {
    if (esVariacion(s.partes)) continue
    const n = s.nombre, pern = /pernoctaci/i.test(n), viaj = /viajeros/i.test(n)
    const quien = /residentes en espa/i.test(n) ? 'esp' : /extranjero/i.test(n) ? 'ext' : 'tot'
    const lugar = s.partes[0]
    if (/^nacional|total nacional/i.test(lugar)) {
      if (pern && quien !== 'tot') Object.assign(nac[quien], s.d)
      if (viaj && quien === 'tot') Object.assign(nac.viaj, s.d)
      continue
    }
    const c = codProv(lugar); if (!c || !pern) continue
    const a = sumaAños(s.d), dst = ((prov[c] ??= {})[quien] ??= {})
    for (const [y, { s: v, n: k }] of Object.entries(a)) dst[y] = { v, meses: k }
  }
  const meses = Object.keys(nac.esp).sort()
  datos.hotel = { meses, esp: meses.map(m => nac.esp[m] ?? null), ext: meses.map(m => nac.ext[m] ?? null), viajeros: meses.map(m => nac.viaj[m] ?? null) }
  const años = [...new Set(Object.values(prov).flatMap(p => Object.keys(p.tot ?? {})))].sort()
  datos.provincias = { años, completos: años.map(y => Math.max(...Object.values(prov).map(p => p.tot?.[y]?.meses ?? 0))), tot: {}, ext: {} }
  for (const [c, p] of Object.entries(prov)) for (const q of ['tot', 'ext']) datos.provincias[q][c] = años.map(y => p[q]?.[y]?.v ?? null)
  log.provinciasSinCodigo = [...new Set(t.map(s => s.partes[0]).filter(l => !/nacional/i.test(l) && !codProv(l) && !ccaaDe(l)))].slice(0, 30)
  log.hotel = { meses: meses.length, primero: meses[0], ultimo: meses.at(-1), provincias: Object.keys(prov).length }
} catch (e) { log.avisos.push('eoh provincias: ' + e.message) }

// 4. Ocupación, plazas y empleo hotelero por provincia (los últimos 12 meses)
try {
  const t = await ine(2066, 12), o = {}
  for (const s of t) {
    if (esVariacion(s.partes)) continue
    const lugar = s.partes[0], c = /nacional/i.test(lugar) ? '00' : codProv(lugar); if (!c) continue
    const n = norm(s.nombre), m = /grado de ocupacion por plazas$|grado de ocupacion por plazas dato|grado de ocupacion por plazas(?! en fin)/.test(n) && !/fin de semana/.test(n) ? 'ocup' : /numero de plazas/.test(n) ? 'plazas' : /personal empleado/.test(n) ? 'empleo' : /establecimientos/.test(n) ? 'hoteles' : null
    if (!m) continue
    const v = Object.values(s.d); if (!v.length) continue
    ;(o[c] ??= {})[m] = Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10
  }
  datos.ocupacion = o; log.ocupacion = Object.keys(o).length
} catch (e) { log.avisos.push('eoh ocupación: ' + e.message) }

// 5. Puntos turísticos: las ciudades y pueblos con más pernoctaciones hoteleras (últimos 12 meses)
try {
  const t = [...(await ine(2078, 14)), ...(await ine(75197, 14).catch(() => []))]
  const pts = {}
  for (const s of t) {
    if (esVariacion(s.partes) || !/pernoctaci/i.test(s.nombre)) continue
    const nombre = s.partes.find(x => !/^nacional$|pernoctaci|viajer|total categor|residentes|^dato/i.test(x)); if (!nombre) continue
    const quien = /residentes en espa/i.test(s.nombre) ? 'esp' : /extranjero/i.test(s.nombre) ? 'ext' : 'tot'
    Object.assign(((pts[nombre] ??= {})[quien] ??= {}), s.d)
  }
  const ultimo = [...new Set(Object.values(pts).flatMap(p => Object.keys({ ...p.tot, ...p.esp, ...p.ext })))].sort().at(-1)
  const doce = []; if (ultimo) { let [y, m] = ultimo.split('-').map(Number); for (let i = 0; i < 12; i++) { doce.push(`${y}-${pad(m)}`); if (--m === 0) { m = 12; y-- } } }
  const suma = (d) => d ? doce.reduce((a, k) => a + (d[k] ?? 0), 0) : 0
  datos.puntos = { hasta: ultimo, lista: Object.entries(pts).map(([n, p]) => { const esp = suma(p.esp), ext = suma(p.ext), tot = suma(p.tot) || esp + ext; return { n, tot, ext } }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot).slice(0, 60) }
  log.puntos = datos.puntos.lista.slice(0, 8)
} catch (e) { log.avisos.push('puntos turísticos: ' + e.message) }

// 6. Viviendas turísticas por provincia (estadística experimental del INE)
try {
  const t = await ine(46141, 6), v = {}
  for (const s of t) {
    const lugar = s.partes[0], c = /total nacional|^nacional/i.test(lugar) ? '00' : codProv(lugar); if (!c) continue
    const n = norm(s.nombre), m = /porcentaje/.test(n) ? 'pct' : /plazas por vivienda/.test(n) ? null : /plazas/.test(n) ? 'plazas' : /viviendas turisticas/.test(n) ? 'viv' : null
    if (!m) continue
    const k = Object.keys(s.d).sort().at(-1); if (!k) continue
    ;(v[c] ??= {})[m] = s.d[k]; v[c].per = k
  }
  datos.viviendas = v; log.viviendas = { n: Object.keys(v).length, nac: v['00'] }
} catch (e) { log.avisos.push('viviendas turísticas: ' + e.message) }

// 7. Europa: noches de no residentes en alojamientos turísticos, por país (Eurostat)
try {
  const d = await get(`${EST}tour_occ_ninat?lang=en&unit=NR&c_resid=FOR&nace_r2=I551-I553&sinceTimePeriod=2012`)
  const g = d.dimension.geo.category, t = d.dimension.time.category, gi = Object.keys(g.index), ti = Object.keys(t.index), nT = ti.length
  const ser = {}
  for (const [k, v] of Object.entries(d.value)) { const i = +k, geo = gi[Math.floor(i / nT) % gi.length], y = ti[i % nT]; (ser[geo] ??= {})[y] = v }
  const ult = ti.filter(y => Object.values(ser).filter(s => s[y] != null).length > 20).at(-1)
  const paises = Object.keys(ser).filter(k => k.length === 2 && ser[k][ult] != null).sort((a, b) => ser[b][ult] - ser[a][ult]).slice(0, 12)
  datos.europa = { años: ti, ultimo: ult, paises: paises.map(k => ({ id: k, nombre: g.label[k], v: ti.map(y => ser[k][y] ?? null) })) }
  log.europa = paises
} catch (e) { log.avisos.push('eurostat europa: ' + e.message) }

// ---------- población por provincia (padrón que descarga scripts/poblacion.mjs) ----------
try {
  const P = JSON.parse(readFileSync(here('../public/poblacion/data/municipios.json'), 'utf8')), j = P.years.length - 1, pob = {}
  for (const [cod, [, serie]] of Object.entries(P.m)) { const c = cod.padStart(5, '0').slice(0, 2); pob[c] = (pob[c] ?? 0) + (serie[j] ?? 0) }
  datos.poblacion = { año: P.years[j], p: pob }
} catch (e) { log.avisos.push('población: ' + String(e.message).slice(0, 150)) }

writeFileSync(`${OUT}/turismo.json`, JSON.stringify(datos))
// resumen para la portada: turistas internacionales del último año completo
try {
  const tot = datos.paises?.Total?.turistas ?? {}, años = sumaAños(tot), y = Object.keys(años).filter(a => años[a].n === 12).sort().at(-1)
  const g = sumaAños(datos.gastoPais?.Total?.total ?? {})
  const R = here('../src/resumen.json'), r = JSON.parse(readFileSync(R, 'utf8'))
  if (y) { r.turismo = { año: +y, turistas: años[y].s, gasto: g[y]?.n === 12 ? g[y].s : null }; writeFileSync(R, JSON.stringify(r, null, 2) + '\n') }
  log.resumen = r.turismo
} catch (e) { log.avisos.push('resumen: ' + e.message) }
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/turismo-log.json'), JSON.stringify(log, null, 1))
console.log('Turismo:', Object.keys(datos.paises ?? {}).length, 'países,', datos.hotel?.meses?.length ?? 0, 'meses de hoteles,', log.avisos.length, 'avisos')
