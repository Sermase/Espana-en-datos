// Sonda para Caudal: depuradoras y aglomeraciones (OGC API Features del MITECO) y tablas del INE de suministro y saneamiento.
// Solo escribe fuentes/sonda-saneamiento.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function prueba(id, url, mirar = (t) => t.slice(0, 800)) {
  await espera(600)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (sonda)' } })
    const t = await r.text()
    out[id] = { status: r.status, url, resumen: r.ok ? mirar(t) : t.slice(0, 300) }
    return r.ok ? t : null
  } catch (e) { out[id] = { url, error: String(e.message) } }
}
const OGC = 'https://wmts.mapama.gob.es/sig-api/ogc/features/v1'
const cols = await prueba('ogc:collections', `${OGC}/collections?f=json`, t => { try { const j = JSON.parse(t); return (j.collections ?? []).map(c => c.id + ' · ' + c.title).filter(x => /edar|depur|aglom|vert|saneam|agua|uww|agg/i.test(x)).slice(0, 80) } catch { return t.slice(0, 500) } })
let ids = []
try { ids = JSON.parse(cols).collections.map(c => c.id).filter(x => /edar|depur|aglom|uww|agg|vertido/i.test(x)) } catch {}
for (const id of ids.slice(0, 14)) {
  await prueba('ogc:items:' + id, `${OGC}/collections/${encodeURIComponent(id)}/items?f=json&limit=2`, t => { try { const j = JSON.parse(t); return { numberMatched: j.numberMatched, props: j.features?.[0]?.properties, geom: j.features?.[0]?.geometry?.type, coords: JSON.stringify(j.features?.[0]?.geometry?.coordinates).slice(0, 80), links: (j.links ?? []).map(l => l.rel).join(',') } } catch { return t.slice(0, 400) } })
}
await prueba('zip:edar', 'https://www.mapama.gob.es/app/descargas/descargafichero.aspx?f=depuradorasq2023.zip', t => 'bytes ' + t.length + ' empieza ' + JSON.stringify(t.slice(0, 4)))

const INE = 'https://servicios.ine.es/wstempus/js/ES'
const ineT = (t) => { try { const j = JSON.parse(t); return { n: j.length, series: j.slice(0, 60).map(s => `${s.Nombre} → ${s.Data?.map(d => `${d.Anyo ?? d.NombrePeriodo}:${d.Valor}`).join(' ')}`) } } catch { return t.slice(0, 400) } }
for (const t of [53447, 53450, 53448, 53449, 53451, 53452, 53446])
  await prueba('ine:' + t, `${INE}/DATOS_TABLA/${t}?nult=2`, ineT)
await prueba('ine:tabla53450', `${INE}/TABLA/53450`, t => t.slice(0, 600))
await prueba('ine:op', `${INE}/TABLAS_OPERACION/EASA`, t => { try { return JSON.parse(t).map(x => x.Id + ' ' + x.Nombre) } catch { return t.slice(0, 400) } })

writeFileSync(here('../fuentes/sonda-saneamiento.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([k, v]) => k + ' ' + (v.status ?? v.error)).join('\n'))
