// Sanidad y salud: cuánto vivimos (Eurostat, España, comunidades y Europa), de qué morimos (INE, defunciones por
// causa desde 1980), las muertes semana a semana (Eurostat, a partir de la EDeS del INE) y el exceso de mortalidad,
// y el sistema: médicos y camas por comunidad, gasto sanitario y quién se queda sin consulta por la lista de espera.
// Escribe public/sanidad/data/sanidad.json, resumen.sanidad y fuentes/sanidad-log.json (estructura de cada tabla).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/sanidad/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES', EST = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function get(url) {
  for (let i = 0; i < 3; i++) {
    await espera(400)
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' }, signal: AbortSignal.timeout(240e3) }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json() }
    catch (e) { if (i === 2) throw new Error(`${url}: ${e.message}`); await espera(4000 * (i + 1)) }
  }
}
const r1 = (v, d = 1) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d

// ---------- Eurostat (JSON-stat) → filas {dimensión: código, time, v} ----------
async function est(nombre, code, q) {
  const d = await get(`${EST}${code}?lang=en&${q}`)
  const ids = d.id, cats = ids.map(k => Object.keys(d.dimension[k].category.index)), size = d.size
  const filas = []
  for (const [k, v] of Object.entries(d.value)) {
    let i = +k; const f = { v }
    for (let j = ids.length - 1; j >= 0; j--) { f[ids[j]] = cats[j][i % size[j]]; i = Math.floor(i / size[j]) }
    filas.push(f)
  }
  log[nombre] = { filas: filas.length, dims: Object.fromEntries(ids.filter(k => k !== 'time').map((k, j) => [k, cats[ids.indexOf(k)].slice(0, 25)])), tiempos: [cats[ids.indexOf('time')][0], cats[ids.indexOf('time')].at(-1)] }
  return { filas, etiqueta: (dim, c) => d.dimension[dim]?.category.label[c] ?? c }
}
/** {geo: {time: v}} de las filas que cumplen `filtro`. */
const porGeo = (filas, filtro = () => true) => { const o = {}; for (const f of filas) if (filtro(f)) (o[f.geo] ??= {})[f.time] = f.v; return o }
const UE = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
const CCAA = { ES11: 'Galicia', ES12: 'Asturias', ES13: 'Cantabria', ES21: 'País Vasco', ES22: 'Navarra', ES23: 'La Rioja', ES24: 'Aragón', ES30: 'Madrid', ES41: 'Castilla y León', ES42: 'Castilla-La Mancha', ES43: 'Extremadura', ES51: 'Cataluña', ES52: 'C. Valenciana', ES53: 'Illes Balears', ES61: 'Andalucía', ES62: 'Murcia', ES63: 'Ceuta', ES64: 'Melilla', ES70: 'Canarias' }
/** El último periodo con dato para al menos `n` de las claves. */
const ultimo = (o, n) => { const ts = [...new Set(Object.values(o).flatMap(s => Object.keys(s)))].sort(); return ts.filter(t => Object.values(o).filter(s => s[t] != null).length >= n).at(-1) }
/** Europa en un periodo: lista ordenada de los países de la UE (y la media de la UE aparte). */
const europa = (o, t) => ({ año: t, ue: r1(o.EU27_2020?.[t] ?? null, 2), paises: UE.filter(g => o[g]?.[t] != null).map(g => ({ id: g, v: r1(o[g][t], 2) })).sort((a, b) => b.v - a.v) })
const serie = (s, ts) => ts.map(t => r1(s?.[t] ?? null, 2))

const datos = { fecha: new Date().toISOString().slice(0, 10) }

// 1. Esperanza de vida: España por sexo al nacer y a los 65, la UE, y cada comunidad
try {
  const { filas } = await est('vida', 'demo_mlexpec', 'unit=YR&age=Y_LT1&age=Y65&sex=T&sex=M&sex=F&sinceTimePeriod=1975')
  const k = (g, s, a) => porGeo(filas, f => f.sex === s && f.age === a)[g] ?? {}
  const años = [...new Set(filas.filter(f => f.geo === 'ES').map(f => f.time))].sort()
  datos.vida = { años, T: serie(k('ES', 'T', 'Y_LT1'), años), M: serie(k('ES', 'M', 'Y_LT1'), años), F: serie(k('ES', 'F', 'Y_LT1'), años), T65: serie(k('ES', 'T', 'Y65'), años), M65: serie(k('ES', 'M', 'Y65'), años), F65: serie(k('ES', 'F', 'Y65'), años), ue: serie(k('EU27_2020', 'T', 'Y_LT1'), años) }
  const tot = porGeo(filas, f => f.sex === 'T' && f.age === 'Y_LT1'), t = ultimo(Object.fromEntries(UE.map(g => [g, tot[g] ?? {}])), 22)
  const M = porGeo(filas, f => f.sex === 'M' && f.age === 'Y_LT1'), F = porGeo(filas, f => f.sex === 'F' && f.age === 'Y_LT1')
  datos.vidaUE = { ...europa(tot, t), sexo: Object.fromEntries([...UE, 'EU27_2020'].map(g => [g, [r1(M[g]?.[t] ?? null), r1(F[g]?.[t] ?? null)]])) }
} catch (e) { log.avisos.push('vida: ' + e.message) }
try {
  const { filas } = await est('vidaCcaa', 'demo_r_mlifexp', `unit=YR&age=Y_LT1&sex=T&sex=M&sex=F&sinceTimePeriod=2005&${Object.keys(CCAA).map(g => 'geo=' + g).join('&')}`)
  const años = [...new Set(filas.map(f => f.time))].sort()
  const o = {}
  for (const s of ['T', 'M', 'F']) { const g = porGeo(filas, f => f.sex === s); for (const [c, n] of Object.entries(CCAA)) (o[n] ??= {})[s] = serie(g[c], años) }
  datos.vidaCcaa = { años, ccaa: o }
} catch (e) { log.avisos.push('vida ccaa: ' + e.message) }

// 2. De qué morimos: capítulos de causas (INE, desde 1980) y las causas concretas del último año
const SEXO = { Total: 'T', Hombres: 'M', Mujeres: 'F' }
const partes = (n) => n.split('. ').map(x => x.replace(/\.\s*$/, '').trim()).filter(Boolean)
async function ine(id, nult) {
  const j = await get(`${INE}/DATOS_TABLA/${id}?nult=${nult}`)
  log['tabla' + id] = { series: j.length, muestra: j.slice(0, 10).map(s => s.Nombre).concat(j.slice(-6).map(s => s.Nombre)) }
  return j.map(s => ({ p: partes(s.Nombre), d: Object.fromEntries((s.Data ?? []).filter(x => x.Valor != null).map(x => [String(x.Anyo), x.Valor])) }))
}
try {
  const t = await ine(73035, 50)
  const caps = {}
  for (const s of t) {
    if (!s.p.includes('Total Nacional') || !s.p.includes('Todas las edades')) continue
    const cap = s.p.find(x => /^[IVXL]+(-[IVXL]+)?\s*\./.test(x)), sx = SEXO[s.p.find(x => SEXO[x])]
    if (!cap || !sx) continue
    const [cod, ...nom] = cap.split('.'); (caps[cod.trim()] ??= { id: cod.trim(), nombre: nom.join('.').trim() })[sx] = s.d
  }
  const años = [...new Set(Object.values(caps).flatMap(c => Object.keys(c.T ?? {})))].sort()
  datos.causas = { años, capitulos: Object.values(caps).map(c => ({ id: c.id, nombre: c.nombre, T: serie(c.T, años), M: serie(c.M, años), F: serie(c.F, años) })) }
  log.capitulos = Object.values(caps).map(c => `${c.id} ${c.nombre}`)
} catch (e) { log.avisos.push('causas: ' + e.message) }
try {
  const t = await ine(7947, 3)
  const c = {}
  for (const s of t) {
    if (!s.p.includes('Todas las edades')) continue
    const sx = SEXO[s.p.find(x => SEXO[x])], causa = s.p.find(x => /^\d{3}/.test(x) || /^[IVXL]+(-[IVXL]+)?\s*\./.test(x))
    if (!sx || !causa) continue
    (c[causa] ??= {})[sx] = s.d
  }
  const año = Object.keys(c[Object.keys(c).find(k => /Todas las causas/i.test(k))]?.T ?? {}).sort().at(-1)
  datos.top = { año, lista: Object.entries(c).filter(([k]) => /^\d{3}/.test(k)).map(([k, v]) => ({ n: k.replace(/^\d{3}(-\d{3})?\s*/, ''), cod: k.slice(0, 3), T: v.T?.[año] ?? null, M: v.M?.[año] ?? null, F: v.F?.[año] ?? null })).filter(x => x.T).sort((a, b) => b.T - a.T) }
  log.top = datos.top.lista.slice(0, 30).map(x => `${x.cod} ${x.n} ${x.T}`)
} catch (e) { log.avisos.push('top causas: ' + e.message) }

// 3. El latido: muertes semana a semana y exceso de mortalidad mensual
try {
  const { filas } = await est('semanas', 'demo_r_mwk_ts', 'geo=ES&sex=T&unit=NR&sinceTimePeriod=2010-W01')
  const s = Object.fromEntries(filas.map(f => [f.time, f.v]))
  const sem = Object.keys(s).sort()
  datos.semanas = { s: sem, v: sem.map(k => s[k]) }
} catch (e) { log.avisos.push('semanas: ' + e.message) }
try {
  const { filas } = await est('exceso', 'demo_mexrt', 'unit=PC&sinceTimePeriod=2020-01')
  const o = porGeo(filas), ms = [...new Set(filas.map(f => f.time))].sort()
  const t = ultimo(Object.fromEntries(UE.map(g => [g, o[g] ?? {}])), 20)
  datos.exceso = { meses: ms, ES: serie(o.ES, ms), ue: serie(o.EU27_2020, ms), europa: europa(o, t) }
} catch (e) { log.avisos.push('exceso: ' + e.message) }

// 4. El sistema: médicos y camas (comunidades y Europa), gasto y listas de espera
for (const [k, code] of [['medicos', 'hlth_rs_physreg'], ['camas', 'hlth_rs_bdsrg2']]) {
  try {
    const { filas } = await est(k, code, 'unit=P_HTHAB&sinceTimePeriod=2005')
    const o = porGeo(filas)
    const tR = ultimo(Object.fromEntries(Object.keys(CCAA).map(g => [g, o[g] ?? {}])), 15)
    const tE = ultimo(Object.fromEntries(UE.map(g => [g, o[g] ?? {}])), 18)
    const años = [...new Set(filas.filter(f => f.geo === 'ES').map(f => f.time))].sort()
    datos[k] = { año: tR, ccaa: Object.fromEntries(Object.entries(CCAA).filter(([g]) => o[g]?.[tR] != null).map(([g, n]) => [n, r1(o[g][tR])])), años, ES: serie(o.ES, años), ueSerie: serie(o.EU27_2020, años), europa: europa(o, tE) }
  } catch (e) { log.avisos.push(k + ': ' + e.message) }
}
try {
  const { filas } = await est('gasto', 'hlth_sha11_hf', 'unit=EUR_HAB&unit=PC_GDP&unit=PC_CHE&unit=PPS_HAB&icha11_hf=TOT_HF&icha11_hf=HF1&icha11_hf=HF2&icha11_hf=HF3&sinceTimePeriod=2012')
  const g = (u, h) => porGeo(filas, f => f.unit === u && f.icha11_hf === h)
  const años = [...new Set(filas.filter(f => f.geo === 'ES').map(f => f.time))].sort()
  const hab = g('EUR_HAB', 'TOT_HF'), pib = g('PC_GDP', 'TOT_HF'), pps = g('PPS_HAB', 'TOT_HF'), pub = g('PC_CHE', 'HF1'), vol = g('PC_CHE', 'HF2'), bol = g('PC_CHE', 'HF3')
  const t = ultimo(Object.fromEntries(UE.map(x => [x, pps[x] ?? {}])), 18)
  datos.gasto = {
    años, hab: serie(hab.ES, años), pib: serie(pib.ES, años), publico: serie(pub.ES, años), seguros: serie(vol.ES, años), bolsillo: serie(bol.ES, años),
    ue: { hab: serie(hab.EU27_2020, años), pib: serie(pib.EU27_2020, años), publico: serie(pub.EU27_2020, años), bolsillo: serie(bol.EU27_2020, años) },
    europa: { ...europa(pps, t), pib: Object.fromEntries(UE.map(x => [x, r1(pib[x]?.[t] ?? null)])), bolsillo: Object.fromEntries(UE.map(x => [x, r1(bol[x]?.[t] ?? null)])) },
  }
} catch (e) { log.avisos.push('gasto: ' + e.message) }
try {
  const { filas } = await est('espera', 'hlth_silc_08', 'unit=PC&sex=T&age=Y_GE16&reason=WLIST&reason=TXP&reason=TFAR&reason=TXP_TFAR_WLIST&sinceTimePeriod=2008')
  const g = (r, q = 'TOTAL') => porGeo(filas, f => f.reason === r && f.quant_inc === q)
  const años = [...new Set(filas.filter(f => f.geo === 'ES').map(f => f.time))].sort()
  const w = g('WLIST'), t = ultimo(Object.fromEntries(UE.map(x => [x, w[x] ?? {}])), 20)
  const tq = años.at(-1)
  datos.espera = {
    años, ES: serie(w.ES, años), ue: serie(w.EU27_2020, años), caro: serie(g('TXP').ES, años), lejos: serie(g('TFAR').ES, años),
    quintiles: { año: tq, v: ['QU1', 'QU2', 'QU3', 'QU4', 'QU5'].map(q => r1(g('WLIST', q).ES?.[tq] ?? null)) },
    europa: europa(w, t),
  }
} catch (e) { log.avisos.push('espera: ' + e.message) }

writeFileSync(`${OUT}/sanidad.json`, JSON.stringify(datos))
// resumen para la portada: esperanza de vida y la última semana de muertes frente a la media de 2015-2019
try {
  const R = here('../src/resumen.json'), r = JSON.parse(readFileSync(R, 'utf8'))
  const V = datos.vida, i = V ? V.T.findLastIndex(v => v != null) : -1
  const S = datos.semanas, j = S ? S.v.findLastIndex(v => v != null) : -1
  const sem = j >= 0 ? S.s[j].slice(5) : null
  const base = sem ? S.s.map((s, k) => (+s.slice(0, 4) >= 2015 && +s.slice(0, 4) <= 2019 && s.slice(5) === sem ? S.v[k] : null)).filter(v => v != null) : []
  r.sanidad = { año: i >= 0 ? +V.años[i] : null, vida: i >= 0 ? V.T[i] : null, hombres: i >= 0 ? V.M[i] : null, mujeres: i >= 0 ? V.F[i] : null, semana: j >= 0 ? S.s[j] : null, muertes: j >= 0 ? S.v[j] : null, media: base.length ? Math.round(base.reduce((a, b) => a + b, 0) / base.length) : null, ultimas: j >= 0 ? S.v.slice(Math.max(0, j - 25), j + 1) : [] }
  writeFileSync(R, JSON.stringify(r, null, 2) + '\n'); log.resumen = r.sanidad
} catch (e) { log.avisos.push('resumen: ' + e.message) }
log.tamaño = JSON.stringify(datos).length
writeFileSync(here('../fuentes/sanidad-log.json'), JSON.stringify(log, null, 1))
console.log('sanidad:', log.avisos.length ? log.avisos : 'sin avisos', log.tamaño)
