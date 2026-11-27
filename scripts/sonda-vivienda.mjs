// Sonda 3 de Vivienda: dónde publica el Catastro los titulares (CSV). Escribe fuentes/sonda-vivienda3.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (espana-en-datos; sonda)' }, signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r }
for (const u of ['https://www.catastro.hacienda.gob.es/esp/estadistica_3.asp', 'https://datos.gob.es/es/catalogo/e05250001-estadisticas-catastrales-catastro-inmobiliario-titulares.csv', 'https://datos.gob.es/es/catalogo/e05250001-estadisticas-catastrales-catastro-inmobiliario-titulares.jsonld']) {
  try {
    const r = await get(u), t = await r.text()
    out[u] = { tipo: r.headers.get('content-type'), bytes: t.length, enlaces: [...new Set([...t.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]))].filter(h => /csv|xls|zip|titular|propiedad|altas/i.test(h)).slice(0, 80), inicio: t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500), urls: [...new Set(t.match(/https?:\/\/[^\s"',<>]+(?:csv|xls|xlsx|zip)/gi) ?? [])].slice(0, 60) }
  } catch (e) { out[u] = String(e.message) }
}
writeFileSync(here('../fuentes/sonda-vivienda3.json'), JSON.stringify(out, null, 1))
console.log('ok')
