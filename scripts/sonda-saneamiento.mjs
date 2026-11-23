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
const cols = await prueba('ogc:collections', `${OGC}/collections?f=json`, t => { try { const j = JSON.parse(t); return { n: (j.collections ?? []).length, claves: Object.keys(j), ids: (j.collections ?? []).map(c => c.id).join(' | ').slice(0, 6000) } } catch { return t.slice(0, 800) } })
let ids = []
try { ids = JSON.parse(cols).collections.map(c => c.id).filter(x => /edar|depur|aglom|uww|agg|vert|saneam/i.test(x)) } catch {}
out.ogc_ids = ids
for (const id of ids.slice(0, 12)) await prueba('ogc:items:' + id, `${OGC}/collections/${encodeURIComponent(id)}/items?f=json&limit=2`, t => { try { const j = JSON.parse(t); return { numberMatched: j.numberMatched, props: j.features?.[0]?.properties, geom: j.features?.[0]?.geometry?.type, coords: JSON.stringify(j.features?.[0]?.geometry?.coordinates).slice(0, 80), links: (j.links ?? []).map(l => l.rel + ':' + l.href).join(' ').slice(0, 400) } } catch { return t.slice(0, 400) } })
const bin = async (id, url) => { try { const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 espana-en-datos' } }); const b = Buffer.from(await r.arrayBuffer()); out[id] = { status: r.status, url: r.url, bytes: b.length, tipo: r.headers.get('content-type'), inicio: b.subarray(0, 4).toString('hex') } } catch (e) { out[id] = { url, error: String(e.message) + ' ' + String(e.cause?.code ?? e.cause?.message ?? '') } } }
for (const host of ['www.mapama.gob.es', 'www.miteco.gob.es', 'www.mapa.gob.es', 'sig.mapama.gob.es'])
  await bin('zip:' + host, `https://${host}/app/descargas/descargafichero.aspx?f=depuradorasq2023.zip`)
await prueba('wfs:edar', 'https://wms.mapama.gob.es/sig/Agua/EDAR/2023?service=WFS&request=GetCapabilities', t => t.slice(0, 600))
await prueba('wms:edar', 'https://wms.mapama.gob.es/sig/Agua/EDAR/2023?service=WMS&request=GetCapabilities', t => (t.match(/<Name>[^<]+<\/Name>/g) ?? []).join(' ').slice(0, 800))
// Agencia Europea de Medio Ambiente: el mismo reporte (UWWTD) en su ArcGIS y en DiscoData
const EEA = 'https://water.discomap.eea.europa.eu/arcgis/rest/services'
await prueba('eea:catalogo', `${EEA}?f=json`, t => { try { const j = JSON.parse(t); return { folders: j.folders, services: (j.services ?? []).map(s => s.name) } } catch { return t.slice(0, 400) } })
for (const f of ['UWWTD', 'Uwwtd', 'UWWT'])
  await prueba('eea:' + f, `${EEA}/${f}?f=json`, t => t.slice(0, 1500))
const DD = 'https://discodata.eea.europa.eu/sql?query='
await prueba('dd:tablas', DD + encodeURIComponent("SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME FROM [UWWTD].INFORMATION_SCHEMA.TABLES"), t => t.slice(0, 4000))
await prueba('dd:catalogos', DD + encodeURIComponent('SELECT name FROM sys.databases'), t => t.slice(0, 3000))
writeFileSync(here('../fuentes/sonda-saneamiento.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([k, v]) => k + ' ' + (v.status ?? v.error)).join('\n'))
