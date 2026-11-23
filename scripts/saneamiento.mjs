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
  const j = await json(`${INE}/DATOS_TABLA/${id}?nult=6&tip=A`)
  const out = {}, uds = {}
  for (const s of j) {
    const partes = s.Nombre.split(/,\s*(?=[A-Z0-9-]|\d\.)/).map(x => x.trim()).filter(Boolean)
    // el primer trozo (o los dos primeros, si la comunidad lleva coma) es el territorio
    let terr = partes[0], resto = partes.slice(1)
    if (resto[0] && /^(Principado|Illes|Comunidad|Región|La)\b/.test(resto[0])) { terr = partes[0] + ', ' + resto[0]; resto = resto.slice(1) }
    const concepto = (resto.join(', ') || terr).replace(/^[-\d.\s]+/, '').trim()
    const t = resto.length ? REG(terr) : 'España'
    uds[concepto] = s.Unidad?.Nombre ?? s.FK_Unidad ?? ''
    // Ceuta y Melilla van juntas en el mapa: se suman los volúmenes y se promedian los porcentajes
    const media = /porcent|tanto|litro|euros? ?(\/|por)|€\/|por habitante/i.test(String(uds[concepto]) + ' ' + concepto)
    for (const d of s.Data ?? []) if (d.Valor != null) {
      const o = ((out[t] ??= {})[concepto] ??= {}), y = String(d.Anyo ?? d.NombrePeriodo)
      o[y] = o[y] != null && t === 'Ceuta y Melilla' ? (media ? (o[y] + d.Valor) / 2 : o[y] + d.Valor) : d.Valor
    }
  }
  return { out, uds }
}
const T = {}
for (let id = 53440; id <= 53460; id++) {
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
      l: r1(g('l'), 0) ?? prevReg?.l ?? null, v: g('l') && g('l', b) ? r1((g('l') / g('l', b) - 1) * 100) : prevReg?.v ?? null, cost: r1(g('cost'), 2) ?? prevReg?.cost ?? null,
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
    national: { ...N, l: N.l ?? previo?.national?.l, cost: N.cost ?? previo?.national?.cost, households: N.households ?? previo?.national?.households, origin: C.sup && C.sub ? { sup: r1(C.sup.val('España', a)), sub: r1(C.sub.val('España', a)), otras: r1(100 - C.sup.val('España', a) - C.sub.val('España', a)) } : previo?.national?.origin },
    regions: terrs.map(fila).sort((x, y) => (y.l ?? 0) - (x.l ?? 0)),
  }
  writeFileSync(CONS, JSON.stringify(out, null, 1) + '\n')
  log.ine._ok = `${a} (y ${b}), ${out.regions.length} territorios`
} else log.ine._ok = 'faltan conceptos: se conserva consumo.json'

// ---------- MITECO: depuradoras ----------
const tmp = join(tmpdir(), 'edar'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
const URLS = ['https://www.mapa.gob.es/app/descargas/descargafichero.aspx?f=depuradorasq2023.zip', 'https://www.miteco.gob.es/app/descargas/descargafichero.aspx?f=depuradorasq2023.zip']
let zip = null
for (const u of URLS) {
  try { execFileSync('curl', ['-sSfL', '--retry', '3', '-A', 'Mozilla/5.0 espana-en-datos', '-o', join(tmp, 'edar.zip'), u], { timeout: 180000 }); zip = u; break }
  catch (e) { log.edar['curl ' + u] = String(e.message).slice(0, 200) }
}
const shp = []
if (zip) {
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

writeFileSync(here('../fuentes/saneamiento-log.json'), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log, null, 1).slice(0, 4000))
