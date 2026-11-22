// Descarga los datos oficiales y regenera src/data/snapshot.json y public/data/history.json.
// Uso: node scripts/update-data.mjs [--sin-historico]   (Node 20+; sin dependencias)
//
// Fuentes (servicios ArcGIS públicos del Ministerio para la Transición Ecológica):
//   Embalses_Mapa       estado semanal de cada embalse (Boletín Hidrológico)
//   Embalses_Total      serie semanal de cada embalse desde 1988
//   Pluviometros_Mapa   lluvia semanal en observatorios de AEMET
//   Caudales_Mapa       caudal semanal en estaciones de aforo
//   UP_Presas_y_embalses  río y altura de cada presa
//   Censo_Nacional_de_Vertidos__CNV_  volumen anual autorizado
// y REData de Red Eléctrica (producción hidráulica diaria). Si REE falla, se conserva el dato anterior.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../src/agua/data/snapshot.json')
const HIST = here('../public/agua/data/history.json')
const LAM = here('../public/agua/data/laminas.json')
const BASINS = JSON.parse(readFileSync(here('../src/agua/data/basins.json'), 'utf8'))
const ARC = 'https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services'
const withHistory = !process.argv.includes('--sin-historico')

async function arcgis(service, params, label = service) {
  const out = []
  for (let offset = 0; ; offset += 2000) {
    const body = new URLSearchParams({ f: 'json', where: '1=1', outSR: '4326', resultOffset: String(offset), resultRecordCount: '2000', ...params })
    let json
    for (let tries = 0; ; tries++) {
      try {
        const res = await fetch(`${ARC}/${service}/FeatureServer/0/query`, { method: 'POST', body })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        json = await res.json()
        if (json.error) throw new Error(json.error.message)
        break
      } catch (e) { if (tries >= 3) throw new Error(`${label}: ${e.message}`); await new Promise(r => setTimeout(r, 2000 * (tries + 1))) }
    }
    out.push(...json.features)
    if (!json.exceededTransferLimit || !json.features.length) return out
  }
}

// --- demarcación de cada punto ---
const polys = BASINS.features.map(f => ({ id: f.properties.id, rings: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates }))
function inPoly(x, y, poly) {
  let inside = false
  for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j]
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}
function basinOf(x, y) {
  for (const p of polys) for (const poly of p.rings) if (inPoly(x, y, poly)) return p.id
  let best = null, bd = Infinity
  for (const p of polys) for (const poly of p.rings) for (const [px, py] of poly[0]) {
    const d = (px - x) ** 2 + (py - y) ** 2
    if (d < bd) { bd = d; best = p.id }
  }
  return best
}
const tidy = (n) => n.trim().replace(/^(.*), (El|La|Los|Las|A|As|Os|O)$/, '$2 $1')
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '')
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return null } })()

// --- embalses ---
const resRaw = await arcgis('Embalses_Mapa', { outFields: 'EMBALSE_ID,embalse_nombre,agua_actual,agua_total,energia_actual,energia_total,Variacion_Reserva,Uso,boletin_anyo,boletin_num,fecha' })
const reservoirs = resRaw.map(({ attributes: a, geometry: g }) => ({
  id: a.EMBALSE_ID, n: tidy(a.embalse_nombre), raw: a.embalse_nombre, x: +g.x.toFixed(3), y: +g.y.toFixed(3),
  a: a.agua_actual ?? 0, c: a.agua_total ?? 0, e: a.energia_actual ?? 0, ec: a.energia_total ?? 0,
  d: a.Variacion_Reserva ?? 0, h: a.Uso === 'Hidroeléctrico' ? 1 : 0, b: basinOf(g.x, g.y),
}))
const first = resRaw[0].attributes
const fecha = iso(first.fecha)
const A = reservoirs.reduce((t, r) => t + r.a, 0), C = reservoirs.reduce((t, r) => t + r.c, 0)

// --- presas: río y altura (se cruza por nombre; si no casa, se conserva lo anterior) ---
try {
  const pres = await arcgis('UP_Presas_y_embalses', { where: 'CAST(NMN_CAPAC AS FLOAT)>=5', outFields: 'NOMBRE,CAUCE,ALT_CIMIEN', returnGeometry: 'false' }, 'Presas')
  const byName = new Map()
  for (const { attributes: p } of pres) {
    const n = p.NOMBRE ?? '', m = n.match(/^(.*), (EL|LA|LOS|LAS)$/)
    for (const k of [norm(n), m ? norm(m[2] + m[1]) : null]) if (k && !byName.has(k)) byName.set(k, p)
  }
  const old = new Map((prev?.reservoirs ?? []).map(r => [r.id, r]))
  for (const r of reservoirs) {
    const p = [r.n, r.raw, r.raw.split(' - ')[0], r.raw.split('(')[0]].map(norm).map(k => byName.get(k)).find(Boolean)
    const riv = p?.CAUCE?.trim().replace(/^R[IÍ]O\s+/i, '').replace(/\s+/g, ' ')
    const hm = Number(p?.ALT_CIMIEN)
    r.riv = riv ? riv.charAt(0) + riv.slice(1).toLowerCase() : old.get(r.id)?.riv
    r.hm = hm > 5 ? Math.round(hm) : old.get(r.id)?.hm
  }
} catch (e) { console.warn('Presas:', e.message) }
for (const r of reservoirs) { delete r.raw; if (!r.riv) delete r.riv; if (!r.hm) delete r.hm }

// --- histórico semanal ---
let national = prev?.meta?.national
if (withHistory) {
  const rows = await arcgis('Embalses_Total', { outFields: 'EMBALSE_ID,fecha,agua_actual,agua_total', returnGeometry: 'false', orderByFields: 'OBJECTID_12_13_14_15_16_17' }, 'Histórico')
  console.log(`Histórico: ${rows.length} registros`)
  const byDate = new Map(), byRes = new Map()
  for (const { attributes: a } of rows) {
    if (a.fecha == null || a.agua_actual == null) continue
    const d = iso(a.fecha)
    const t = byDate.get(d) ?? { a: 0, c: 0 }; t.a += a.agua_actual; t.c += a.agua_total ?? 0; byDate.set(d, t)
    if (!byRes.has(a.EMBALSE_ID)) byRes.set(a.EMBALSE_ID, new Map())
    byRes.get(a.EMBALSE_ID).set(d, [a.agua_actual, a.agua_total])
  }
  const dates = [...byDate.keys()].filter(d => byDate.get(d).c >= 20000).sort()
  const nat = { d: dates, a: dates.map(d => Math.round(byDate.get(d).a)), c: dates.map(d => Math.round(byDate.get(d).c)) }
  const rd = dates.filter(d => d >= '2015-10-01')
  const res = {}, rec = {}
  for (const r of reservoirs) {
    const m = byRes.get(r.id) ?? new Map()
    res[r.id] = rd.map(d => (m.has(d) ? Math.round(m.get(d)[0]) : null))
    const s = [...m.entries()].sort().map(([d, [a, c]]) => [d, c ? (a / c) * 100 : null]).filter(x => x[1] != null)
    const k = s.findIndex(x => x[1] >= 50), s2 = s.slice(k < 0 ? Math.min(156, s.length - 1) : k)
    if (s2.length) {
      const mx = s2.reduce((b, x) => (x[1] >= b[1] ? x : b)), mn = s2.reduce((b, x) => (x[1] <= b[1] ? x : b))
      rec[r.id] = { max: [Math.round(Math.min(mx[1], 100) * 10) / 10, mx[0]], min: [Math.round(mn[1] * 10) / 10, mn[0]], since: s[0][0] }
    }
  }
  const basinsH = {}
  for (const b of new Set(reservoirs.map(r => r.b))) {
    const ids = reservoirs.filter(r => r.b === b), capb = ids.reduce((t, r) => t + r.c, 0)
    basinsH[b] = { c: Math.round(capb), a: rd.map((_, k) => {
      const have = ids.filter(r => res[r.id][k] != null), cov = have.reduce((t, r) => t + r.c, 0)
      return cov >= 0.8 * capb ? Math.round((have.reduce((t, r) => t + res[r.id][k], 0) * capb) / cov) : null
    }) }
  }
  writeFileSync(HIST, JSON.stringify({ national: nat, rd, res, rec, basins: basinsH }))
  // comparativas: misma semana hace un año y media de los diez años anteriores (±3 días)
  const near = (target) => { const t = new Date(target).getTime(); return dates.find(d => Math.abs(new Date(d).getTime() - t) <= 3 * 864e5) }
  const at = (yearsBack) => { const d = new Date(fecha); d.setFullYear(d.getFullYear() - yearsBack); const k = near(d); return k ? byDate.get(k).a : null }
  const ago = Array.from({ length: 10 }, (_, i) => at(i + 1)).filter(v => v != null)
  const lastWeek = byDate.get(near(new Date(new Date(fecha).getTime() - 7 * 864e5)))?.a
  national = { a: Math.round(A), c: Math.round(C), d: Math.round(lastWeek != null ? A - lastWeek : reservoirs.reduce((t, r) => t + r.d, 0)), prevYear: Math.round(at(1) ?? 0), avg10: Math.round(ago.reduce((t, v) => t + v, 0) / ago.length) }
} else {
  national = { ...national, a: Math.round(A), c: Math.round(C), d: Math.round(reservoirs.reduce((t, r) => t + r.d, 0)) }
}

// --- siluetas: se añaden las de los embalses que aún no tienen (las del IGN se conservan) ---
try {
  const lam = (() => { try { return JSON.parse(readFileSync(LAM, 'utf8')) } catch { return {} } })()
  const missing = reservoirs.filter(r => !lam[r.id])
  if (missing.length) {
    // El servicio rechaza algunas combinaciones de parámetros: se prueban de más ligera a más básica.
    let feats = null, lastErr = null
    for (const extra of [{ outFields: '*', maxAllowableOffset: '0.0015' }, { outFields: '*', resultRecordCount: '500' }, { outFields: '*', where: '1=1', resultOffset: undefined }]) {
      try { feats = await arcgis('L%C3%A1minas_Embalses', Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)), 'Láminas'); break } catch (e) { lastErr = e; console.warn('Láminas, otro intento:', e.message) }
    }
    if (!feats) throw lastErr
    const inRing = (x, y, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
    const shapes = feats.filter(f => f.geometry?.rings?.length).map(f => {
      const pts = f.geometry.rings.flat()
      return { rings: f.geometry.rings, bb: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] }
    })
    let added = 0
    for (const r of missing) {
      // La presa suele estar en la orilla: vale si cae dentro o a menos de ~3 km de la lámina.
      let best = null, bd = 0.03
      for (const s of shapes) {
        if (r.x < s.bb[0] - bd || r.x > s.bb[2] + bd || r.y < s.bb[1] - bd || r.y > s.bb[3] + bd) continue
        if (s.rings.some(ring => inRing(r.x, r.y, ring))) { best = s; break }
        for (const [px, py] of s.rings.flat()) { const d = Math.hypot(px - r.x, (py - r.y)); if (d < bd) { bd = d; best = s } }
      }
      if (best) { lam[r.id] = [best.rings.map(ring => ring.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]))]; added++ }
    }
    writeFileSync(LAM, JSON.stringify(lam))
    console.log(`Siluetas: ${added} nuevas, ${Object.keys(lam).length} en total.`)
  }
} catch (e) { console.warn('Láminas no respondió; se mantienen las siluetas que había:', e.message) }

// --- lluvia ---
const rainRaw = await arcgis('Pluviometros_Mapa', { outFields: 'pluviometro_nombre,zona_nombre,Precipitacion' })
const rain = rainRaw.map(({ attributes: a, geometry: g }) => ({ n: a.pluviometro_nombre.replace(' (A)', ''), z: a.zona_nombre, p: a.Precipitacion ?? 0, x: +g.x.toFixed(3), y: +g.y.toFixed(3) }))

// --- caudales ---
const flowRaw = await arcgis('Caudales_Mapa', { where: 'caudal IS NOT NULL', outFields: 'Nombre,Rio,Situacion,caudal,caudal_ant' })
const flows = flowRaw.map(({ attributes: a, geometry: g }) => ({ n: a.Nombre, r: a.Rio, e: a.Situacion === 'Embalse' ? 1 : 0, q: a.caudal, qa: a.caudal_ant ?? null, x: +g.x.toFixed(3), y: +g.y.toFixed(3) }))

// --- vertidos de más de 20 hm³/año ---
const cnvRaw = await arcgis('Censo_Nacional_de_Vertidos__CNV_', { where: 'Volumen_An > 20000000', outFields: 'Razon_Soci,Municipio,Provincia,Volumen_An,CNAE,Tipvertido' })
const seen = new Set()
const dischargers = cnvRaw.map(({ attributes: a, geometry: g }) => ({
  n: a.Razon_Soci, m: a.Municipio, pr: a.Provincia, v: Math.round(a.Volumen_An / 1e5) / 10, c: a.CNAE ?? '', t: a.Tipvertido ?? '', x: +g.x.toFixed(3), y: +g.y.toFixed(3),
})).filter(d => {
  if (/persona f[ií]sica/i.test(d.n)) return false // no se publica a particulares
  const k = `${d.n}|${d.x}|${d.y}|${d.v}`
  if (seen.has(k)) return false
  seen.add(k); return true
})

// --- producción hidráulica de REE, últimos 30 días ---
let hydro
try {
  const end = new Date(), start = new Date(end - 30 * 864e5)
  const url = `https://apidatos.ree.es/es/datos/generacion/estructura-generacion?start_date=${iso(start)}T00:00&end_date=${iso(end)}T23:59&time_trunc=day`
  const json = await (await fetch(url, { headers: { Accept: 'application/json' } })).json()
  const s = json.included.find(i => i.attributes.title === 'Hidráulica')
  hydro = { days: s.attributes.values.map(v => ({ d: v.datetime.slice(0, 10), mwh: Math.round(v.value) })) }
} catch (e) {
  console.warn('REE no respondió; se mantiene el dato anterior:', e.message)
  hydro = prev?.hydro
}

const basins = Object.fromEntries(BASINS.features.map(f => [f.properties.id, f.properties.name]))
const snapshot = {
  meta: { boletin: `${first.boletin_num}/${first.boletin_anyo}`, fecha, national, note: 'Boletín Hidrológico semanal de MITECO.' },
  basins, reservoirs, rain, dischargers, flows, ...(hydro ? { hydro } : {}),
}
writeFileSync(OUT, JSON.stringify(snapshot))
// Resumen mínimo para la portada, para que no cargue los datos completos del tema.
{
  const RES = here('../src/resumen.json')
  const r = (() => { try { return JSON.parse(readFileSync(RES, 'utf8')) } catch { return {} } })()
  r.agua = { fecha: snapshot.meta.fecha, a: snapshot.meta.national.a, c: snapshot.meta.national.c }
  writeFileSync(RES, JSON.stringify(r, null, 1))
}
console.log(`Boletín ${snapshot.meta.boletin} (${fecha}): ${reservoirs.length} embalses, ${Math.round(A)} de ${Math.round(C)} hm³; ${rain.length} pluviómetros; ${flows.length} aforos; ${dischargers.length} vertidos; REE ${hydro?.days.length ?? 0} días.`)
