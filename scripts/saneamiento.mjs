// Caudal, después del grifo: abastecimiento, saneamiento y depuración.
//  · INE, Estadística sobre el suministro y saneamiento del agua (tablas 53440–53460, por comunidad, cada dos años)
//    → src/agua/data/consumo.json (capa Abastecimiento y resumen de Depuración)
//  · MITECO, depuradoras de la Directiva 91/271/CEE (cuestionario Q2023, situación a diciembre de 2022)
//    → public/agua/data/depuradoras.json (capa Depuración)
// Uso: node scripts/saneamiento.mjs   (Node 20+, curl y unzip en el sistema)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const CONS = here('../src/agua/data/consumo.json'), EDAR = here('../public/agua/data/depuradoras.json')
const log = { ine: {}, edar: {} }
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function json(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' } }); const t = await r.text(); if (!r.ok || t.startsWith('<')) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 100)); return JSON.parse(t) }
    catch (e) { if (i === 3) throw e; await espera(4000 * (i + 1)) }
  }
}

// ---------- INE ----------
const INE = 'https://servicios.ine.es/wstempus/js/ES'
// «Asturias, Principado de» → «Principado de Asturias», como en el mapa
const giro = (n) => { const m = n.match(/^(.*), (.*)$/); return m ? `${m[2]} ${m[1]}` : n }
const REG = (n) => { const g = giro(n.trim()); return /^ceuta|^melilla/i.test(g) ? 'Ceuta y Melilla' : g === 'Total Nacional' || g === 'Total' ? 'España' : g }
/** Todas las series de una tabla como { comunidad: { concepto: { año: valor } } }, más la unidad de cada concepto. */
async function tabla(id) {
  const j = await json(`${INE}/DATOS_TABLA/${id}?nult=6&tip=AM`)
  const out = {}, uds = {}
  if (id === 53450) log.ine._serieCruda = JSON.stringify({ ...j[0], Data: j[0]?.Data?.slice(0, 1) }).slice(0, 900)
  for (const s of j) {
    const partes = s.Nombre.split(/,\s*(?=[A-Z0-9-]|\d\.)/).map(x => x.trim()).filter(Boolean)
    // el primer trozo (o los dos primeros, si la comunidad lleva coma) es el territorio
    let terr = partes[0], resto = partes.slice(1)
    if (resto[0] && /^(Principado|Illes|Comunidad|Región|La)\b/.test(resto[0])) { terr = partes[0] + ', ' + resto[0]; resto = resto.slice(1) }
    const concepto = (resto.join(', ') || terr).replace(/^[-\d.\s]+/, '').trim()
    const t = resto.length ? REG(terr) : 'España'
    uds[concepto] = UNI[s.FK_Unidad] ?? s.Unidad?.Nombre ?? s.FK_Unidad ?? ''
    // Ceuta y Melilla van juntas en el mapa: se suman los volúmenes y se promedian los porcentajes
    const media = /porcent|tanto|litro|euros? ?(\/|por)|€\/|por habitante/i.test(String(uds[concepto]) + ' ' + concepto)
    for (const d of s.Data ?? []) if (d.Valor != null) {
      const o = ((out[t] ??= {})[concepto] ??= {}), y = String(d.Anyo ?? d.NombrePeriodo)
      o[y] = o[y] != null && t === 'Ceuta y Melilla' ? (media ? (o[y] + d.Valor) / 2 : o[y] + d.Valor) : d.Valor
    }
  }
  return { out, uds }
}
let UNI = {}
try { UNI = Object.fromEntries((await json(`${INE}/UNIDADES`)).map(u => [u.Id, u.Nombre])) } catch (e) { log.ine._unidades = String(e.message) }
const T = {}
for (let id = 53430; id <= 53459; id++) {
  try { const r = await tabla(id); T[id] = r; log.ine[id] = Object.keys(Object.values(r.out)[0] ?? {}).slice(0, 12).map(c => `${c} [${r.uds[c]}]`).join(' | ') }
  catch (e) { log.ine[id] = 'ERROR ' + String(e.message).slice(0, 120) }
  await espera(400)
}
/** Busca en todas las tablas el concepto que encaja con la expresión. */
function buscar(re) {
  for (const [id, { out, uds }] of Object.entries(T)) for (const c of Object.keys(out['España'] ?? Object.values(out)[0] ?? {})) if (re.test(c)) return { id: +id, c, u: uds[c], val: (terr, a) => out[terr]?.[c]?.[a], terrs: Object.keys(out) }
  return null
}
const C = {
  supplied: buscar(/^Volumen de agua suministrada a la red/i), registered: buscar(/^Volumen total de agua registrada y distribuida/i), lossReal: buscar(/^Pérdidas reales/i), lossApparent: buscar(/^Pérdidas aparentes/i),
  households: buscar(/^Hogares$/i), treated: buscar(/^Volumen de aguas residuales tratadas/i), reused: buscar(/^Volumen total de agua reutilizada/i), reusePct: buscar(/^Agua reutilizada$/i),
  sewerKm: buscar(/^Longitud de la red de alcantarillado/i), supplyKm: buscar(/^Longitud de la red de suministro/i), sludge: buscar(/^Volumen de lodos/i),
  l: buscar(/consumo medio.*hogares|litros por habitante/i), cost: buscar(/coste unitario|valor unitario|precio medio/i),
  billSan: buscar(/^Importe facturado por alcantarillado/i), billSup: buscar(/^Importe facturado por el agua suministrada/i),
  sup: buscar(/superficiales/i), sub: buscar(/subterráneas/i),
}
log.conceptos = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, v ? `${v.id}: ${v.c} [${v.u}]` : 'NO ENCONTRADO']))
const DEST = ['Al mar', 'A un cauce fluvial', 'Agua reutilizada', 'Infiltraciones al terreno', 'Otros'].map(c => [c, buscar(new RegExp('^' + c + '$', 'i'))])
const USOS = ['Agricultura', 'Industria', 'Jardines y zonas deportivas de ocio', 'Limpieza de alcantarillado y baldeo de calles', 'Otros usos'].map(c => [c, buscar(new RegExp('^' + c + '$', 'i'))])

let previo = null; try { previo = JSON.parse(readFileSync(CONS, 'utf8')) } catch {}
// Población por comunidad (padrón, de Población) para calcular los litros por habitante si el INE no da la tabla
const POB = {}
try {
  const m = JSON.parse(readFileSync(here('../public/poblacion/data/municipios.json'), 'utf8'))
  const PROV_CCAA = { '04': 'Andalucía', '11': 'Andalucía', '14': 'Andalucía', '18': 'Andalucía', '21': 'Andalucía', '23': 'Andalucía', '29': 'Andalucía', '41': 'Andalucía', '22': 'Aragón', '44': 'Aragón', '50': 'Aragón', '33': 'Principado de Asturias', '07': 'Illes Balears', '35': 'Canarias', '38': 'Canarias', '39': 'Cantabria', '05': 'Castilla y León', '09': 'Castilla y León', '24': 'Castilla y León', '34': 'Castilla y León', '37': 'Castilla y León', '40': 'Castilla y León', '42': 'Castilla y León', '47': 'Castilla y León', '49': 'Castilla y León', '02': 'Castilla-La Mancha', '13': 'Castilla-La Mancha', '16': 'Castilla-La Mancha', '19': 'Castilla-La Mancha', '45': 'Castilla-La Mancha', '08': 'Cataluña', '17': 'Cataluña', '25': 'Cataluña', '43': 'Cataluña', '03': 'Comunitat Valenciana', '12': 'Comunitat Valenciana', '46': 'Comunitat Valenciana', '06': 'Extremadura', '10': 'Extremadura', '15': 'Galicia', '27': 'Galicia', '32': 'Galicia', '36': 'Galicia', '28': 'Comunidad de Madrid', '30': 'Región de Murcia', '31': 'Comunidad Foral de Navarra', '01': 'País Vasco', '20': 'País Vasco', '48': 'País Vasco', '26': 'La Rioja', '51': 'Ceuta y Melilla', '52': 'Ceuta y Melilla' }
  for (const [c, v] of Object.entries(m.m)) for (const [i, y] of m.years.entries()) { const r = PROV_CCAA[c.padStart(5, '0').slice(0, 2)]; if (!r) continue; const p = v[1][i] ?? 0; ((POB[r] ??= {})[y] = (POB[r][y] ?? 0) + p); ((POB['España'] ??= {})[y] = (POB['España'][y] ?? 0) + p) }
} catch (e) { log.ine._poblacion = String(e.message) }
const litros = (terr, y) => { const h = C.households?.val(terr, y), p = POB[terr]?.[y] ?? POB[terr]?.[+y + 1]; return h && p ? (h * 1e6) / p / 365 : null }
if (C.supplied && C.treated) {
  const años = Object.keys(T[C.supplied.id].out['España'][C.supplied.c]).sort()
  const a = años.at(-1), b = años.at(-2)
  const r1 = (v, d = 1) => v == null || !isFinite(v) ? null : +v.toFixed(d)
  const fila = (terr) => {
    const g = (k, y = a) => C[k]?.val(terr, y) ?? null
    const pctP = (y) => g('supplied', y) ? (g('lossReal', y) / g('supplied', y)) * 100 : null
    const reu = (y) => C.reusePct?.val(terr, y) ?? (g('treated', y) ? (g('reused', y) / g('treated', y)) * 100 : null)
    const prevReg = previo?.regions?.find(x => x.n === terr)
    return {
      n: terr,
      l: r1(g('l') ?? litros(terr, a), 0), v: (() => { const x = g('l') ?? litros(terr, a), y0 = g('l', b) ?? litros(terr, b); return x && y0 ? r1((x / y0 - 1) * 100) : null })(), cost: r1(g('cost'), 2) ?? prevReg?.cost ?? null,
      supplied: r1(g('supplied') / 1000), registered: r1(g('registered') / 1000), lossReal: r1(g('lossReal') / 1000), lossApparent: r1(g('lossApparent') / 1000),
      lossPct: r1(pctP(a)), lossPctPrev: r1(pctP(b)), households: r1(g('households') / 1000),
      treated: g('treated'), reused: g('reused'), reusePct: r1(reu(a)), reusePctPrev: r1(reu(b)),
      dest: Object.fromEntries(DEST.map(([c, s]) => [c, r1(s?.val(terr, a))])), usos: Object.fromEntries(USOS.map(([c, s]) => [c, r1(s?.val(terr, a))])),
      sewerKm: g('sewerKm'), supplyKm: g('supplyKm'), sludge: g('sludge'), billSan: g('billSan'), billSup: g('billSup'),
    }
  }
  const terrs = C.supplied.terrs.filter(t => t !== 'España')
  const N = fila('España')
  const out = {
    year: +a, prevYear: +b, unidades: { treated: C.treated.u, reused: C.reused?.u, sewerKm: C.sewerKm?.u, sludge: C.sludge?.u, bill: C.billSan?.u },
    tablas: Object.fromEntries(Object.entries(C).filter(([, v]) => v).map(([k, v]) => [k, v.id])),
    litrosCalculados: !C.l,
    national: { ...N, cost: N.cost ?? previo?.national?.cost, households: N.households ?? previo?.national?.households, origin: (() => { const o = T[C.sup?.id]?.out['España'], y = a; if (!o) return previo?.national?.origin; const tot = o['Total']?.[y] ?? 0, su = o[C.sup.c]?.[y] ?? 0, sb = o[C.sub?.c]?.[y] ?? 0; return tot > 100 ? { sup: r1((su / tot) * 100), sub: r1((sb / tot) * 100), otras: r1(100 - ((su + sb) / tot) * 100) } : { sup: r1(su), sub: r1(sb), otras: r1(100 - su - sb) } })() },
    regions: terrs.map(fila).sort((x, y) => (y.l ?? 0) - (x.l ?? 0)),
  }
  writeFileSync(CONS, JSON.stringify(out, null, 1) + '\n')
  log.ine._ok = `${a} (y ${b}), ${out.regions.length} territorios`
} else log.ine._ok = 'faltan conceptos: se conserva consumo.json'

// ---------- MITECO: depuradoras ----------
/** El área de descargas del MITECO sirve cada fichero tras un formulario (botón «Descargar fichero» con token): se hace lo mismo. */
function descargaMiteco(f, dest) {
  const jar = dest + '.cookies', base = 'https://gis.miteco.gob.es/descargas/app/DescargaFichero'
  const h = execFileSync('curl', ['-sSfL', '-c', jar, '-A', 'Mozilla/5.0 espana-en-datos', `${base}?f=${f}`], { encoding: 'utf8', timeout: 120000 })
  const tok = (h.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) ?? [])[1]
  if (!tok) throw new Error('sin token en la página de descarga de ' + f)
  execFileSync('curl', ['-sSfL', '-b', jar, '-c', jar, '-A', 'Mozilla/5.0 espana-en-datos', '-e', `${base}?f=${f}`, '--data-urlencode', `f=${f}`, '--data-urlencode', `__RequestVerificationToken=${tok}`, '-o', dest, `${base}?handler=Download`], { timeout: 600000 })
  if (readFileSync(dest).subarray(0, 2).toString() !== 'PK') throw new Error(f + ': la descarga no es un zip')
}
const tmp = join(tmpdir(), 'edar'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
let zip = null
try { descargaMiteco('depuradorasq2023.zip', join(tmp, 'edar.zip')); zip = 'https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=depuradorasq2023.zip' } catch (e) { log.edar.descarga = String(e.message).slice(-300) }
const shp = []
if (zip) {
  log.edar.descarga = readFileSync(join(tmp, 'edar.zip')).length + ' bytes'
  try {
    execFileSync('unzip', ['-o', '-q', join(tmp, 'edar.zip'), '-d', tmp])
    const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.zip$/i.test(f.name) && p !== join(tmp, 'edar.zip')) { execFileSync('unzip', ['-o', '-q', p, '-d', d]); } } }
    walk(tmp)
    const walk2 = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk2(p); else if (/\.shp$/i.test(f.name)) shp.push(p) } }
    walk2(tmp)
    log.edar.archivos = shp.map(p => p.slice(tmp.length))
  } catch (e) { log.edar.unzip = String(e.message).slice(0, 200) }
}
if (shp.length) {
  const { open } = await import('shapefile')
  const leer = async (p) => { const s = await open(p, undefined, { encoding: 'utf-8' }); const fs = []; for (let r = await s.read(); !r.done; r = await s.read()) fs.push(r.value); return fs }
  const p = shp.find(x => /depur|edar|uwwtp/i.test(x)) ?? shp[0]
  const feats = await leer(p)
  const props = feats[0]?.properties ?? {}
  log.edar.campos = Object.entries(props).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
  log.edar.n = feats.length
  // los campos se buscan por nombre, que el shapefile recorta a 10 letras
  const campo = (...res) => Object.keys(props).find(k => res.some(re => re.test(k)))
  const K = {
    code: campo(/^uwwCode$/i, /^uwwcode/i), name: campo(/^uwwName$/i, /^uwwname/i), cap: campo(/capac/i), load: campo(/LoadEnte|loadent/i), coll: campo(/CollSy|collect/i),
    agg: campo(/^aggCode$/i, /aggcod/i), aggName: campo(/aggName/i), prim: campo(/Primar/i), sec: campo(/Second/i), n: campo(/NRemov/i), p: campo(/PRemov/i), uv: campo(/^uwwUV/i), cl: campo(/Chlor/i), oz: campo(/Ozon/i),
    sand: campo(/Sand/i), micro: campo(/Micro/i), other: campo(/OtherTr/i), comp: campo(/Complian|^uwwCompli/i), bod: campo(/BOD5Perf|BODPer/i), muni: campo(/munic|ine/i), prov: campo(/prov/i), ccaa: campo(/ccaa|auton/i),
  }
  log.edar.mapeo = K
  const si = (v) => v === true || /^(true|1|s|si|sí|yes|y|t)$/i.test(String(v ?? '').trim())
  const out = []
  for (const f of feats) {
    const q = f.properties, g = f.geometry
    if (!g || g.type !== 'Point') continue
    if (K.coll && q[K.coll] && !/ISCON|CON/i.test(String(q[K.coll]))) continue // solo depuradoras conectadas a un sistema colector
    const trat = si(q[K.n]) || si(q[K.p]) ? 'más riguroso' : si(q[K.sec]) ? 'secundario' : si(q[K.prim]) ? 'primario' : null
    const extra = [si(q[K.n]) && 'nitrógeno', si(q[K.p]) && 'fósforo', si(q[K.uv]) && 'ultravioleta', si(q[K.cl]) && 'cloración', si(q[K.oz]) && 'ozono', si(q[K.sand]) && 'filtro de arena', si(q[K.micro]) && 'microfiltración'].filter(Boolean)
    out.push({
      c: q[K.code] ?? null, n: String(q[K.name] ?? '').trim(), x: +g.coordinates[0].toFixed(4), y: +g.coordinates[1].toFixed(4),
      cap: Number(q[K.cap]) || null, load: Number(q[K.load]) || null, t: trat, e: extra, agg: q[K.agg] ?? null, aggN: K.aggName ? q[K.aggName] ?? null : null,
      ok: K.comp ? String(q[K.comp] ?? '') || null : null,
    })
  }
  writeFileSync(EDAR, JSON.stringify({ fuente: zip, version: 'Q2023 (situación a diciembre de 2022)', fecha: new Date().toISOString().slice(0, 10), edar: out }))
  log.edar.guardadas = out.length
} else log.edar._ok = 'sin shapefile: se conserva depuradoras.json si existía'

// Aglomeraciones (para Alcantarillado): de momento solo se mira qué campos trae
try {
  const z = join(tmp, 'agg.zip'), d = join(tmp, 'agg'); descargaMiteco('aauuq2023.zip', z)
  mkdirSync(d, { recursive: true }); execFileSync('unzip', ['-o', '-q', z, '-d', d])
  const lista = []; const w = (x) => { for (const e of readdirSync(x, { withFileTypes: true })) { const p = join(x, e.name); if (e.isDirectory()) w(p); else lista.push(p) } }; w(d)
  log.agg = { archivos: lista.map(p => p.slice(d.length)) }
  const sp = lista.find(p => /\.shp$/i.test(p))
  if (sp) { const { open } = await import('shapefile'); const so = await open(sp, undefined, { encoding: 'utf-8' }); const r = await so.read(); log.agg.campos = Object.entries(r.value?.properties ?? {}).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`); log.agg.geom = r.value?.geometry?.type }
} catch (e) { log.agg = String(e.message).slice(-300) }
writeFileSync(here('../fuentes/saneamiento-log.json'), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log, null, 1).slice(0, 4000))
