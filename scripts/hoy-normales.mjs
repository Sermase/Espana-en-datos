// Lo normal de cada día del año en cada capital: media de la temperatura media diaria de 1991 a 2020 (reanálisis ERA5 de Open-Meteo),
// suavizada con una ventana de ±3 días. Se calcula una vez; se rehace al subir un commit con [normales].
// Escribe public/hoy/data/normales.json.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CAPITALES } from './capitales.mjs'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const cods = Object.keys(CAPITALES)
const espera = (ms) => new Promise(r => setTimeout(r, ms))
async function pide(url) {
  for (let k = 0; k < 6; k++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(150000) }); if (r.ok) return r.json(); if (r.status === 429) await espera(65000) } catch { /* reintento */ }
    await espera(4000 * (k + 1))
  }
  throw new Error('sin respuesta: ' + url.slice(0, 120))
}
const dia = (iso) => { const [, m, d] = iso.split('-').map(Number); return Math.floor((Date.UTC(2000, m - 1, d) - Date.UTC(2000, 0, 1)) / 864e5) }
const suma = Object.fromEntries(cods.map(c => [c, new Float64Array(366)])), cuenta = Object.fromEntries(cods.map(c => [c, new Float64Array(366)]))
const LOTE = 4
for (let i = 0; i < cods.length; i += LOTE) {
  const lote = cods.slice(i, i + LOTE)
  for (const [a, b] of [[1991, 2000], [2001, 2010], [2011, 2020]]) {
    const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${lote.map(c => CAPITALES[c][1]).join(',')}&longitude=${lote.map(c => CAPITALES[c][2]).join(',')}&start_date=${a}-01-01&end_date=${b}-12-31&daily=temperature_2m_mean&timezone=GMT`
    const r = await pide(u), arr = Array.isArray(r) ? r : [r]
    arr.forEach((x, k) => { const c = lote[k]; x.daily.time.forEach((t, j) => { const v = x.daily.temperature_2m_mean[j]; if (v == null) return; const n = dia(t); suma[c][n] += v; cuenta[c][n]++ }) })
    await espera(1500)
  }
  console.log('normales', Math.min(i + LOTE, cods.length), '/', cods.length)
}
const n = {}
for (const c of cods) {
  const crudo = Array.from(suma[c], (s, k) => cuenta[c][k] ? s / cuenta[c][k] : null)
  n[c] = crudo.map((_, k) => { let s = 0, m = 0; for (let o = -3; o <= 3; o++) { const v = crudo[(k + o + 366) % 366]; if (v != null) { s += v; m++ } } return m ? Math.round((s / m) * 10) / 10 : null })
}
mkdirSync(here('../public/hoy/data'), { recursive: true })
writeFileSync(here('../public/hoy/data/normales.json'), JSON.stringify({ ref: '1991-2020', generado: new Date().toISOString().slice(0, 10), n }))
