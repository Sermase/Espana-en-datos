// Coches: matriculaciones de turismos mes a mes desde diciembre de 2014, por combustible, marca y provincia, a partir de
// los microdatos de la DGT (un fichero de ancho fijo por mes, unos 16 MB comprimido); y el parque de turismos por
// combustible y por edad (Eurostat). Los meses ya agregados se guardan en public/coches/data/matriculaciones.json y
// solo se bajan los que faltan (como mucho MAX por ejecución) y los dos últimos, que la DGT aún corrige.
// No se guarda nada que identifique a nadie: solo recuentos.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/coches/data'); mkdirSync(OUT, { recursive: true })
const F = `${OUT}/matriculaciones.json`, tmp = '/tmp/coches'; mkdirSync(tmp, { recursive: true })
const MAX = Number(process.env.COCHES_MAX ?? 150)
const log = { avisos: [], propulsion: {}, catElec: {}, meses: [] }
const prev = existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : { meses: {} }

// Diseño de registro de los microdatos de matriculaciones (714 caracteres por línea)
const CAMPOS = [
  ['fecMat', 8], ['claseMat', 1], ['fecTram', 8], ['marca', 30], ['modelo', 22], ['procedencia', 1], ['bastidor', 21], ['tipo', 2], ['propulsion', 1], ['cilindrada', 5], ['potencia', 6], ['tara', 6], ['pesoMax', 6], ['plazas', 3],
  ['precinto', 2], ['embargo', 2], ['transmisiones', 2], ['titulares', 2], ['localidad', 24], ['provVeh', 2], ['provMat', 2], ['claveTramite', 1], ['fecTramite', 8], ['cp', 5], ['fecPrimMat', 8], ['nuevoUsado', 1], ['personaFJ', 1],
  ['codigoItv', 9], ['servicio', 3], ['muniIne', 5], ['municipio', 30], ['kw', 7], ['plazasMax', 3], ['co2', 5], ['renting', 1], ['tutela', 1], ['posesion', 1], ['bajaDef', 1], ['bajaTemp', 1], ['sustraccion', 1], ['bajaTelem', 11],
  ['tipoItv', 25], ['varianteItv', 25], ['versionItv', 35], ['fabricante', 70], ['masaOrden', 6], ['masaMax', 6], ['catHomol', 4], ['carroceria', 4], ['plazasPie', 3], ['euro', 8], ['consumo', 4], ['clasifReg', 4], ['catElec', 4], ['autonomia', 6],
]
const POS = {}; { let p = 0; for (const [k, n] of CAMPOS) { POS[k] = [p, p + n]; p += n } }
const campo = (l, k) => l.slice(POS[k][0], POS[k][1]).trim()

/** Combustible a partir del código de propulsión y de la categoría de vehículo eléctrico (BEV, PHEV, HEV…). */
function clase(prop, cat) {
  if (/^(BEV)$/.test(cat) || prop === '2') return 'electrico'
  if (/^(PHEV|REEV|EREV)$/.test(cat)) return 'enchufable'
  if (/^(FCEV|FCHV)$/.test(cat) || prop === '9') return 'hidrogeno'
  if (/HEV/.test(cat)) return 'hibrido'
  if (prop === '0') return 'gasolina'
  if (prop === '1') return 'diesel'
  if (prop === '4' || prop === '6') return 'glp'
  if (prop === '7' || prop === '8' || prop === 'A') return 'gas'
  return 'otros'
}
// Modelo comercial: la DGT guarda el nombre de la ficha técnica («FRONTERA GS 1.2 T XHT»); nos quedamos con la primera
// palabra, o las dos primeras cuando la primera sola no dice nada («MODEL Y», «CLASE A», «SERIE 3», «YARIS CROSS»).
const DOS = new Set(['MODEL', 'CLASE', 'CLASS', 'SERIE', 'SERIES', 'GRAND', 'RANGE', 'SANTA', 'LAND', 'ID.', 'EQ', 'DS', 'ALFA', 'TOYOTA', 'NISSAN', 'MERCEDES', 'CITROEN', 'PEUGEOT', 'KIA', 'BMW'])
const SEGUNDA = new Set(['CROSS', 'ROVER', 'FE', 'SPORT', 'EVOQUE', 'VELAR', 'ELECTRIC', 'TOURER', 'ALLSPACE', 'COUPE', 'ACTIVE'])
function modeloDe(raw, marca) {
  const t = raw.toUpperCase().replace(/[^A-Z0-9.\- ]/g, ' ').split(/\s+/).filter(Boolean)
  while (t.length > 1 && (marca.toUpperCase().split(/\s+/).includes(t[0]) || /^(NEW|NUEVO|NUEVA|THE)$/.test(t[0]))) t.shift() // «TOYOTA YARIS», «NUEVO C3» → «YARIS», «C3»
  if (t.length > 1 && /^[A-Z]$/.test(t[0]) && /^\d+[A-Z]?$/.test(t[1])) t.splice(0, 2, t[0] + t[1]) // «I 30» → «I30»
  if (!t.length) return null
  let m = t[0]
  if (t[1] && (DOS.has(t[0]) || (t[0].length <= 2 && !/\d/.test(t[0])) || SEGUNDA.has(t[1]))) m += ' ' + t[1]
  return m
}
const fecha = (s) => s.length === 8 ? new Date(Date.UTC(+s.slice(4), +s.slice(2, 4) - 1, +s.slice(0, 2))) : null

function agrega(fich) {
  const buf = readFileSync(fich), mods = {}, m = { n: 0, u: 0, comb: {}, combU: {}, marcas: {}, prov: {}, co2: [0, 0], kw: [0, 0], renting: 0, empresa: 0, edadU: [0, 0] }
  let ini = 0
  for (let i = 0; i <= buf.length; i++) {
    if (i < buf.length && buf[i] !== 10) continue
    const l = buf.toString('latin1', ini, buf[i - 1] === 13 ? i - 1 : i); ini = i + 1
    if (l.length < 600) continue
    const cat = campo(l, 'catHomol'), tipo = campo(l, 'tipo')
    if (!(cat === 'M1' || (!cat && tipo === '40'))) continue // solo turismos
    const prop = campo(l, 'propulsion'), ce = campo(l, 'catElec').toUpperCase()
    log.propulsion[prop] = (log.propulsion[prop] ?? 0) + 1; if (ce) log.catElec[ce] = (log.catElec[ce] ?? 0) + 1
    const c = clase(prop, ce), usado = campo(l, 'nuevoUsado') === 'U'
    if (usado) {
      m.u++; m.combU[c] = (m.combU[c] ?? 0) + 1
      const a = fecha(campo(l, 'fecMat')), b = fecha(campo(l, 'fecPrimMat'))
      if (a && b && b < a) { m.edadU[0] += (a - b) / 31557600000; m.edadU[1]++ }
      continue
    }
    m.n++; m.comb[c] = (m.comb[c] ?? 0) + 1
    const marca = campo(l, 'marca').replace(/\s+/g, ' '); if (marca) m.marcas[marca] = (m.marcas[marca] ?? 0) + 1
    const mo = marca && modeloDe(campo(l, 'modelo'), marca); if (mo) { const k = `${marca}|${mo}`, x = (mods[k] ??= [0, 0]); x[0]++; if (c === 'electrico' || c === 'enchufable') x[1]++ }
    const mu = campo(l, 'muniIne'), pv = /^\d{5}$/.test(mu) ? mu.slice(0, 2) : null
    if (pv) { const p = (m.prov[pv] ??= {}); p[c] = (p[c] ?? 0) + 1 }
    const co2 = +campo(l, 'co2'); if (co2 > 0 && co2 < 600) { m.co2[0] += co2; m.co2[1]++ }
    const kw = +campo(l, 'kw'); if (kw > 0 && kw < 1500) { m.kw[0] += kw; m.kw[1]++ }
    if (campo(l, 'renting') === 'S') m.renting++
    if (campo(l, 'personaFJ') === 'X') m.empresa++
  }
  // marcas pequeñas, juntas
  const marcas = {}, resto = Object.entries(m.marcas).reduce((t, [k, v]) => { if (v >= 10) marcas[k] = v; else t += v; return t }, 0)
  if (resto) marcas['(otras)'] = resto
  m.modelos = Object.fromEntries(Object.entries(mods).filter(([, v]) => v[0] >= 3))
  return { ...m, marcas, co2: m.co2[1] ? +(m.co2[0] / m.co2[1]).toFixed(1) : null, kw: m.kw[1] ? +(m.kw[0] / m.kw[1]).toFixed(1) : null, edadU: m.edadU[1] ? +(m.edadU[0] / m.edadU[1]).toFixed(2) : null }
}

// 1. Meses que faltan (del más reciente al más antiguo) y los dos últimos
const hoy = new Date(), todos = []
for (const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1)); d >= Date.UTC(2014, 11, 1); d.setUTCMonth(d.getUTCMonth() - 1)) todos.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
const FM = `${OUT}/modelos.json`, modelos = existsSync(FM) ? JSON.parse(readFileSync(FM, 'utf8')).meses : {}
const recientes = Object.keys(prev.meses).sort().slice(-2)
const cola = [...new Set([...todos.filter(k => !prev.meses[k] || !modelos[k]), ...recientes])].sort().reverse().slice(0, MAX)
let hechos = 0
for (const k of cola) {
  const [y, mo] = k.split('-'), u = `https://www.dgt.es/microdatos/salida/${y}/${+mo}/vehiculos/matriculaciones/export_mensual_mat_${y}${mo}.zip`, z = `${tmp}/m.zip`, d = `${tmp}/m`
  try {
    const st = execFileSync('curl', ['-sSL', '--max-time', '300', '-A', 'Mozilla/5.0 (espana-en-datos; GitHub Actions)', '-o', z, '-w', '%{http_code} %{size_download}', u], { encoding: 'utf8' })
    if (!st.startsWith('200') || readFileSync(z).subarray(0, 2).toString() !== 'PK') { log.meses.push(`${k}: ${st}`); continue }
    rmSync(d, { recursive: true, force: true }); mkdirSync(d)
    execFileSync('unzip', ['-o', '-q', z, '-d', d])
    // algunos zips traen el fichero dentro de una carpeta: se busca en todo el árbol
    const fs = execFileSync('find', [d, '-type', 'f'], { encoding: 'utf8' }).split('\n').filter(Boolean), f = fs.find(n => /\.txt$/i.test(n)) ?? fs.sort((x, y) => statSync(y).size - statSync(x).size)[0]
    const { modelos: mo, ...resto } = agrega(f); prev.meses[k] = resto; modelos[k] = mo; hechos++
    log.meses.push(`${k}: ${prev.meses[k].n} nuevos, ${prev.meses[k].u} usados importados`)
  } catch (e) { log.avisos.push(`${k}: ${String(e.message).slice(-200)}`) }
}

// 2. Parque de turismos por combustible y por edad, y matriculaciones anuales por combustible (Eurostat)
const EST = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function eurostat(ds, q) {
  const r = await fetch(`${EST}${ds}?format=JSON&lang=en&${q}`, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' }, signal: AbortSignal.timeout(90e3) })
  if (!r.ok) throw new Error(`${ds} HTTP ${r.status}`)
  const j = await r.json(), ids = j.id, size = j.size, inv = ids.map(d => Object.fromEntries(Object.entries(j.dimension[d].category.index).map(([k, v]) => [v, k])))
  const dim = ids.find(d => !['freq', 'unit', 'geo', 'time', 'leg_form'].includes(d)), out = {}
  for (const [pos, val] of Object.entries(j.value)) {
    let p = +pos; const c = {}
    for (let k = ids.length - 1; k >= 0; k--) { c[ids[k]] = inv[k][p % size[k]]; p = Math.floor(p / size[k]) }
    ((out[c.geo] ??= {})[dim ? c[dim] : 'total'] ??= {})[c.time] = val
  }
  return { out, labels: dim ? j.dimension[dim].category.label : {} }
}
const parque = {}
for (const [k, ds, q] of [
  ['combustible', 'road_eqs_carpda', 'unit=NR&leg_form=TOTAL&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&geo=PT'],
  ['edad', 'road_eqs_carage', 'unit=NR&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&geo=PT'],
  ['nuevosUE', 'road_eqr_carpda', 'unit=NR&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&geo=PT'],
  ['porHabitante', 'road_eqs_carhab', 'unit=NR&geo=ES&geo=EU27_2020&geo=DE&geo=FR&geo=IT&geo=PT'],
]) {
  try { const { out, labels } = await eurostat(ds, q); parque[k] = out; parque[k + 'Etiquetas'] = labels } catch (e) { log.avisos.push(String(e.message)) }
}

const meses = Object.fromEntries(Object.entries(prev.meses).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(F, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), meses }))
// los meses ya guardados pasan por la misma limpieza (cambios de nombre sin volver a bajar los ficheros)
for (const [k, mm] of Object.entries(modelos)) {
  const o = {}
  for (const [x, [n, e]] of Object.entries(mm)) { const [ma, mo] = x.split('|'), y = `${ma}|${modeloDe(mo, ma) ?? mo}`, t = (o[y] ??= [0, 0]); t[0] += n; t[1] += e }
  modelos[k] = o
}
writeFileSync(FM, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), meses: Object.fromEntries(Object.entries(modelos).sort(([a], [b]) => a.localeCompare(b))) }))
// para revisar la normalización: los 40 modelos que más venden en todo el periodo
{ const t = {}; for (const mm of Object.values(modelos)) for (const [k, v] of Object.entries(mm)) t[k] = (t[k] ?? 0) + v[0]; log.topModelos = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => `${k} ${v}`) }
writeFileSync(`${OUT}/parque.json`, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), ...parque }))
// resumen para la portada: últimos 12 meses completos
try {
  const ks = Object.keys(meses).slice(-12), n = ks.reduce((t, k) => t + meses[k].n, 0), e = ks.reduce((t, k) => t + (meses[k].comb.electrico ?? 0) + (meses[k].comb.enchufable ?? 0), 0)
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  res.coches = { hasta: ks.at(-1), nuevos: n, enchufables: n ? (e / n) * 100 : null }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log.avisos.push('resumen: ' + e.message) }
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/coches-log.json'), JSON.stringify(log, null, 1))
console.log(`Coches: ${hechos} meses nuevos; ${Object.keys(meses).length} en total (${Object.keys(meses)[0]} – ${Object.keys(meses).at(-1)})`)
