// Hogares: en qué gastan (Encuesta de Presupuestos Familiares del INE, por comunidad, edad y quintil), cuánto ahorran
// (tasa de ahorro de Eurostat), en qué guardan el dinero (balance financiero de los hogares, Eurostat) y cuántos no
// pueden afrontar un gasto imprevisto o llegan con dificultad a fin de mes (Encuesta de Condiciones de Vida del INE).
// Escribe public/hogares/data/hogares.json, resumen.hogares y fuentes/hogares-log.json (estructura de cada tabla).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/hogares/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES', EST = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function get(url) {
  for (let i = 0; i < 3; i++) {
    await espera(500)
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' }, signal: AbortSignal.timeout(120e3) }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json() }
    catch (e) { if (i === 2) throw new Error(`${url}: ${e.message}`); await espera(3000 * (i + 1)) }
  }
}
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Tabla del INE → series con el nombre partido en trozos y los datos por año. */
async function ine(id, nult = 25) {
  const j = await get(`${INE}/DATOS_TABLA/${id}?nult=${nult}`)
  log['tabla' + id] = { series: j.length, muestra: j.slice(0, 6).map(s => s.Nombre).concat(j.slice(-3).map(s => s.Nombre)) }
  return j.map(s => ({ partes: s.Nombre.split('. ').map(x => x.replace(/\.\s*$/, '').trim()).filter(Boolean), d: Object.fromEntries((s.Data ?? []).filter(x => x.Valor != null).map(x => [x.Anyo, x.Valor])) }))
}

// Grupos de gasto (COICOP 2018 de la EPF), en el orden del INE, con nombre corto
const GRUPOS = [
  ['alimentos', /^alimentos/, 'Comida y bebida'], ['alcohol', /^bebidas alcoh/, 'Alcohol y tabaco'], ['ropa', /^vestido/, 'Ropa y calzado'],
  ['vivienda', /^vivienda/, 'Vivienda y suministros'], ['muebles', /^muebles/, 'Muebles y hogar'], ['sanidad', /^sanidad|^salud/, 'Salud'],
  ['transporte', /^transporte/, 'Transporte'], ['comunicaciones', /^(informaci|comunicac)/, 'Móvil e internet'], ['ocio', /^(actividades recreativas|ocio)/, 'Ocio y cultura'],
  ['educacion', /^(servicios de )?educaci/, 'Educación'], ['restaurantes', /^restaurantes/, 'Bares, restaurantes y hoteles'], ['seguros', /^seguros/, 'Seguros y banca'],
  ['otros', /^(cuidado personal|otros bienes)/, 'Cuidado personal y otros'],
]
const grupoDe = (p) => p.find(x => /^[ií]ndice general$/i.test(x)) ? 'total' : GRUPOS.find(([, re]) => p.some(x => re.test(norm(x))))?.[0]
const MEDIDA = { 'gasto medio por hogar': 'gmh', 'gasto medio por persona': 'gmp', 'distribucion porcentual': 'dist', 'gasto total': 'tot', 'gasto medio por unidad de consumo': 'gmuc' }
const medidaDe = (p) => { for (const x of p) { const m = MEDIDA[norm(x)]; if (m) return m } }
const esBase = (p) => p.some(x => /^dato base$/i.test(x)) || !p.some(x => /variaci/i.test(x))
/** Lo que queda del nombre al quitar grupo, medida y «dato base»: la región, la edad, el quintil… */
const resto = (p) => p.filter(x => !/^dato base$|variaci|^base 20|^anual$/i.test(x) && !MEDIDA[norm(x)] && !/^[ií]ndice general$/i.test(x) && !GRUPOS.some(([, re]) => re.test(norm(x))))

const CCAA = {
  andalucia: 'Andalucía', aragon: 'Aragón', asturias: 'Asturias', balears: 'Illes Balears', canarias: 'Canarias', cantabria: 'Cantabria', 'castilla y leon': 'Castilla y León',
  'castilla la mancha': 'Castilla-La Mancha', cataluna: 'Cataluña', valenciana: 'C. Valenciana', extremadura: 'Extremadura', galicia: 'Galicia', madrid: 'Madrid', murcia: 'Murcia',
  navarra: 'Navarra', 'pais vasco': 'País Vasco', rioja: 'La Rioja', ceuta: 'Ceuta', melilla: 'Melilla', 'total nacional': 'España', nacional: 'España',
}
const ccaaDe = (s) => { const n = norm(s); const k = Object.keys(CCAA).find(k => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k) || n.includes(k)); return k ? CCAA[k] : null }

const datos = { fecha: new Date().toISOString().slice(0, 10), grupos: Object.fromEntries(GRUPOS.map(([k, , n]) => [k, n])) }

// 1. EPF por comunidad y grupo (incluye el total nacional)
try {
  const t = await ine(73991)
  const años = [...new Set(t.flatMap(s => Object.keys(s.d)))].map(Number).sort()
  const serie = (d) => años.map(a => d[a] ?? null)
  const reg = {}
  for (const s of t) {
    if (!esBase(s.partes)) continue
    const g = grupoDe(s.partes), m = medidaDe(s.partes), c = ccaaDe(resto(s.partes).join(' ') || 'Total Nacional')
    if (!g || !m || !c || !['gmh', 'gmp', 'dist'].includes(m)) continue
    ((reg[c] ??= {})[m] ??= {})[g] = serie(s.d)
  }
  datos.epf = { años, reg }
  log.epfRegiones = Object.keys(reg); log.epfGrupos = Object.keys(reg.España?.gmh ?? {})
} catch (e) { log.avisos.push('EPF CCAA: ' + e.message) }

// 2. EPF por edad del sustentador principal, por quintil de gasto y por nivel de ingresos: grupos del último año
async function porCorte(id, clave, filtro) {
  try {
    const t = await ine(id, 3), out = {}
    for (const s of t) {
      if (!esBase(s.partes)) continue
      const g = grupoDe(s.partes), m = medidaDe(s.partes), r = resto(s.partes).filter(x => !/^total nacional$|^ambos sexos$/i.test(x))
      if (!g || !m || !['gmh', 'dist', 'gmp'].includes(m)) continue
      const k = r.filter(filtro).join(' · ') || 'Total'
      if (r.some(x => /^(hombre|mujer)/i.test(x))) continue // sin partir por sexo
      const a = Math.max(...Object.keys(s.d).map(Number)); if (!isFinite(a)) continue
      ((out[k] ??= {})[m] ??= {})[g] = s.d[a]; out[k].año = a
    }
    datos[clave] = out; log[clave + 'Cortes'] = Object.keys(out)
  } catch (e) { log.avisos.push(`EPF ${clave}: ${e.message}`) }
}
await porCorte(73801, 'edad', x => /años|edades/i.test(x))
await porCorte(73828, 'quintil', x => /quintil/i.test(x))
await porCorte(73809, 'ingresos', x => /euros|ingresos|menos de|más de/i.test(x))
await porCorte(73806, 'tamano', x => /miembro|persona/i.test(x))

// 3. Encuesta de Condiciones de Vida: gastos imprevistos, vacaciones y llegar a fin de mes, por edad (total de sexos)
async function ecv(id, clave, re) {
  try {
    const t = await ine(id, 25), out = {}
    for (const s of t) {
      const p = s.partes; if (!p.some(x => /ambos sexos|^total$/i.test(x)) && p.some(x => /hombre|mujer/i.test(x))) continue
      const item = p.find(x => re.test(norm(x))); if (!item) continue
      const edad = p.find(x => /años|total$/i.test(x) && !re.test(norm(x))) ?? 'Total'
      out[item] ??= {}; out[item][edad] = Object.entries(s.d).map(([a, v]) => [+a, v]).sort((a, b) => a[0] - b[0])
    }
    datos[clave] = out; log[clave + 'Items'] = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v)]))
  } catch (e) { log.avisos.push(`ECV ${clave}: ${e.message}`) }
}
await ecv(9967, 'carencias', /imprevist|vacaciones|calefaccion|comida de carne|retraso/)
await ecv(9985, 'finDeMes', /dificultad|facilidad/)

// 4. Eurostat: tasa de ahorro de los hogares (anual y trimestral) y su riqueza financiera por instrumento
const PAISES = ['ES', 'EU27_2020', 'DE', 'FR', 'IT', 'PT']
async function eurostat(ds, q) {
  const j = await get(`${EST}${ds}?format=JSON&lang=en&${q}`)
  const ids = j.id, size = j.size, inv = ids.map(d => Object.fromEntries(Object.entries(j.dimension[d].category.index).map(([k, v]) => [v, k])))
  const filas = []
  for (const [pos, val] of Object.entries(j.value)) { let p = +pos; const c = {}; for (let k = ids.length - 1; k >= 0; k--) { c[ids[k]] = inv[k][p % size[k]]; p = Math.floor(p / size[k]) } filas.push({ ...c, v: val }) }
  return { filas, labels: Object.fromEntries(ids.map(d => [d, j.dimension[d].category.label])) }
}
try {
  const a = await eurostat('nasa_10_ki', `na_item=SRG_S14_S15&sector=S14_S15&unit=PC&${PAISES.map(g => 'geo=' + g).join('&')}`)
  const años = [...new Set(a.filas.map(f => +f.time))].sort()
  datos.ahorro = { años, geo: Object.fromEntries(PAISES.map(g => [g, años.map(t => a.filas.find(f => f.geo === g && +f.time === t)?.v ?? null)])) }
  const q = await eurostat('nasq_10_ki', 'na_item=SRG_S14_S15&sector=S14_S15&unit=PC&s_adj=SCA&geo=ES&geo=EU27_2020&sinceTimePeriod=2005-Q1')
  const tq = [...new Set(q.filas.map(f => f.time))].sort()
  datos.ahorroTrim = { t: tq, es: tq.map(t => q.filas.find(f => f.geo === 'ES' && f.time === t)?.v ?? null), ue: tq.map(t => q.filas.find(f => f.geo === 'EU27_2020' && f.time === t)?.v ?? null) }
} catch (e) { log.avisos.push('Ahorro: ' + e.message) }
const INSTR = ['F2', 'F3', 'F511', 'F512', 'F519', 'F52', 'F6', 'F4', 'F', 'BF90']
try {
  const b = await eurostat('nasa_10_f_bs', `unit=MIO_EUR&co_nco=NCO&sector=S14_S15&${INSTR.map(n => 'na_item=' + n).join('&')}&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&sinceTimePeriod=1999`)
  const años = [...new Set(b.filas.map(f => +f.time))].sort()
  const s = (g, fp, n) => años.map(t => b.filas.find(f => f.geo === g && f.finpos === fp && f.na_item === n && +f.time === t)?.v ?? null)
  datos.riqueza = { años, instr: Object.fromEntries(INSTR.map(n => [n, b.labels.na_item[n]])), geo: Object.fromEntries(['ES', 'EU27_2020', 'DE', 'FR', 'IT'].map(g => [g, { a: Object.fromEntries(INSTR.filter(n => n !== 'F4' && n !== 'BF90').map(n => [n, s(g, 'ASS', n)])), deuda: s(g, 'LIAB', 'F4'), neta: s(g, 'ASS', 'BF90').some(v => v != null) ? s(g, 'ASS', 'BF90') : s(g, 'LIAB', 'BF90') }])) }
  const p = await eurostat('demo_pjan', 'age=TOTAL&sex=T&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&sinceTimePeriod=1999')
  datos.pob = Object.fromEntries(['ES', 'EU27_2020', 'DE', 'FR', 'IT'].map(g => [g, años.map(t => p.filas.find(f => f.geo === g && +f.time === t)?.v ?? null)]))
} catch (e) { log.avisos.push('Riqueza: ' + e.message) }

writeFileSync(`${OUT}/hogares.json`, JSON.stringify(datos))
// resumen para la portada
try {
  const E = datos.epf, k = E.años.length - 1, g = E.reg.España.gmh.total
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  const A = datos.ahorro, ka = A ? A.geo.ES.findLastIndex(v => v != null) : -1
  res.hogares = { año: E.años[k], gasto: g[k], var: g[k - 1] ? ((g[k] - g[k - 1]) / g[k - 1]) * 100 : null, ahorro: ka >= 0 ? A.geo.ES[ka] : null, añoAhorro: ka >= 0 ? A.años[ka] : null }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log.avisos.push('resumen: ' + e.message) }
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/hogares-log.json'), JSON.stringify(log, null, 1))
console.log('Hogares:', datos.epf?.años?.at(-1), Object.keys(datos.epf?.reg ?? {}).length, 'regiones;', log.avisos.length, 'avisos')
