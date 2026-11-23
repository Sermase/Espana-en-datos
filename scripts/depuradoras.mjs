// Depuradoras (EDAR) y aglomeraciones urbanas de España, del reporte de la Directiva 91/271/CEE a la UE
// (cuestionario 2023, datos de 2022), tal como lo publica la Agencia Europea de Medio Ambiente (Waterbase UWWTD).
// Se bajan tres tablas CSV por el WebDAV de su enlace público y se cruzan: depuradora ↔ aglomeraciones que atiende.
// Escribe public/agua/data/depuradoras.json. Uso: node scripts/depuradoras.mjs (Node 20+, curl)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/agua/data/depuradoras.json')
const CARPETA = '/eea_t_uwwtd-final_p_2023_v10_r00/CSV/'
const DAV = 'https://sdi.eea.europa.eu/datashare/public.php/webdav'
const SHARE = 'sptXqwkQr5g7Bp5' // enlace público del almacén de datos de la AEMA
const tmp = join(tmpdir(), 'uwwtd'); mkdirSync(tmp, { recursive: true })
const log = {}

/** CSV con comillas (RFC 4180) → filas de objetos. */
function csv(txt) {
  const filas = []; let f = [], c = '', q = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch; continue }
    if (ch === '"') q = true
    else if (ch === ',') { f.push(c); c = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; f.push(c); filas.push(f); f = []; c = '' }
    else c += ch
  }
  if (c || f.length) { f.push(c); filas.push(f) }
  const cab = filas.shift().map(h => h.replace(/^﻿/, '').trim())
  return { cab, filas: filas.filter(r => r.length > 1).map(r => Object.fromEntries(cab.map((h, j) => [h, r[j] ?? ''])) ) }
}
function tabla(nombre) {
  const f = join(tmp, nombre)
  execFileSync('curl', ['-sSf', '--retry', '3', '--max-time', '600', '-u', `${SHARE}:`, '-o', f, `${DAV}${CARPETA}${nombre}`])
  const t = csv(readFileSync(f, 'utf8'))
  log[nombre] = { columnas: t.cab.join(','), filas: t.filas.length }
  return t.filas
}
const esp = (r, ...ks) => ks.some(k => String(r[k] ?? '').startsWith('ES'))
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }
const si = (v) => /^(true|yes|y|s|si|sí|1|-1)$/i.test(String(v ?? '').trim())

let previo = null; try { previo = JSON.parse(readFileSync(OUT, 'utf8')) } catch {}
try {
  const plantas = tabla('UWWTPS.csv').filter(r => esp(r, 'rptMStateKey', 'uwwCode') || r.rptMStateKey === 'ES')
  const aggs = tabla('Agglomerations.csv').filter(r => r.rptMStateKey === 'ES' || esp(r, 'aggCode'))
  const enlaces = tabla('UWWTPAgglos.csv').filter(r => Object.values(r).some(v => String(v).startsWith('ES')))
  log.espana = { plantas: plantas.length, aglomeraciones: aggs.length, enlaces: enlaces.length, ejemploPlanta: plantas[0], ejemploEnlace: enlaces[0] }

  // Aglomeraciones: carga generada (habitantes equivalentes), % recogido por colectores (aggC1) y por sistemas individuales (aggC2), tipo de red
  const AGG = new Map(aggs.filter(a => !/inactive/i.test(a.aggState ?? '') && a.aggState !== '0').map(a => [a.aggCode, {
    c: a.aggCode, n: (a.aggName ?? '').trim(), pe: num(a.aggGenerated), c1: num(a.aggC1), c2: num(a.aggC2), red: (a.aggSewageNetwork ?? '').trim() || null, sin: num(a.aggPercWithoutTreatment),
    x: num(a.aggLongitude), y: num(a.aggLatitude), nuts: a.aggNUTS ?? null,
  }]))
  // Enlace planta ↔ aglomeración (los nombres de columna cambian entre reportes: se buscan)
  const k = Object.keys(enlaces[0] ?? {})
  const kU = k.find(x => /uww.*code/i.test(x)), kA = k.find(x => /agg.*code/i.test(x)), kP = k.find(x => /perc|pct/i.test(x))
  log.enlaceCols = { kU, kA, kP }
  const porPlanta = new Map()
  for (const e of enlaces) { const l = porPlanta.get(e[kU]) ?? []; l.push([e[kA], kP ? num(e[kP]) : null]); porPlanta.set(e[kU], l) }

  const out = []
  for (const p of plantas) {
    if (/inactive/i.test(p.uwwState ?? '') || p.uwwState === '0') continue
    const x = num(p.uwwLongitude), y = num(p.uwwLatitude)
    if (x == null || y == null || Math.abs(x) < 0.0001) continue
    const trat = si(p.uwwNRemoval) || si(p.uwwPRemoval) || si(p.uwwOtherTreatment) ? 3 : si(p.uwwSecondaryTreatment) ? 2 : si(p.uwwPrimaryTreatment) ? 1 : 0
    const extra = [si(p.uwwNRemoval) && 'N', si(p.uwwPRemoval) && 'P', si(p.uwwUV) && 'UV', si(p.uwwChlorination) && 'Cl', si(p.uwwOzonation) && 'O3', si(p.uwwSandFiltration) && 'arena', si(p.uwwMicroFiltration) && 'micro'].filter(Boolean)
    if (p.uwwCollectingSystem && p.uwwCollectingSystem !== 'ISCON') continue // solo depuradoras reales conectadas a un colector
    // cumplimiento por parámetro: P = cumple, F = no cumple, NR = no se le exige
    const perf = ['uwwBOD5Perf', 'uwwCODPerf', 'uwwTSSPerf', 'uwwNTotPerf', 'uwwPTotPerf'].map(c => String(p[c] ?? '').trim().toUpperCase()).filter(v => v === 'P' || v === 'F')
    const ag = (porPlanta.get(p.uwwCode) ?? []).map(([c, pct]) => { const a = AGG.get(c); return a ? { c: a.c, n: a.n, pe: a.pe, c1: a.c1, c2: a.c2, red: a.red, pct } : null }).filter(Boolean)
    out.push({
      c: p.uwwCode, n: (p.uwwName ?? '').trim(), x: +x.toFixed(4), y: +y.toFixed(4), cap: num(p.uwwCapacity), load: num(p.uwwLoadEnteringUWWTP), t: trat, e: extra,
      ok: perf.length ? (perf.includes('F') ? 0 : 1) : null, vol: num(p.uwwWasteWaterTreated), nuts: p.uwwNUTS ?? null, ag,
    })
  }
  out.sort((a, b) => (b.cap ?? 0) - (a.cap ?? 0))
  // Aglomeraciones (capa Alcantarillado): todas las activas con coordenadas, y a qué depuradoras van
  const idxPlanta = new Map(out.map((p, i) => [p.c, i]))
  const aggOut = [...AGG.values()].filter(a => a.x != null && a.y != null && Math.abs(a.x) > 0.0001).map(a => ({
    ...a, x: +a.x.toFixed(4), y: +a.y.toFixed(4), ed: enlaces.filter(e => e[kA] === a.c).map(e => idxPlanta.get(e[kU])).filter(i => i != null),
  })).sort((p, q) => (q.pe ?? 0) - (p.pe ?? 0))
  const sueltas = aggOut.filter(a => !a.ed.length)
  writeFileSync(OUT, JSON.stringify({ fuente: 'Agencia Europea de Medio Ambiente, Waterbase UWWTD (cuestionario 2023, datos de 2022)', fecha: new Date().toISOString().slice(0, 10), edar: out, aggs: aggOut }))
  log.guardado = `${out.length} depuradoras, ${aggOut.length} aglomeraciones (${sueltas.length} sin depuradora enlazada)`
  log.trat = [0, 1, 2, 3].map(t => out.filter(p => p.t === t).length)
  log.ok = [1, 0, null].map(v => out.filter(p => p.ok === v).length)
} catch (e) { log.error = String(e.message).slice(-400); if (previo) log.conserva = 'se conserva depuradoras.json anterior' }
writeFileSync(here('../fuentes/depuradoras-log.json'), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log, null, 1).slice(0, 6000))
