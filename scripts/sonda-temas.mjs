// Sonda: servicios ArcGIS públicos de la Agencia Europea de Medio Ambiente que alimentan el Índice Europeo de Calidad del Aire
// (carpetas AQMobile y Air). Para cada servicio: capas, campos y dos registros de ejemplo. Escribe fuentes/sonda-temas.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const B = 'https://air.discomap.eea.europa.eu/arcgis/rest/services'
async function j(url) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' }, signal: AbortSignal.timeout(60000) }); const t = await r.text(); try { return JSON.parse(t) } catch { return { error: `HTTP ${r.status}`, cabeza: t.slice(0, 300) } } } catch (e) { return { error: e.message } }
}
for (const carpeta of ['AQMobile_2025', 'AQMobile', 'Air']) {
  const c = await j(`${B}/${carpeta}?f=pjson`)
  out[carpeta] = c.services ?? c
  for (const s of (c.services ?? []).slice(0, 12)) {
    const url = `${B}/${s.name}/${s.type}`
    const info = await j(`${url}?f=pjson`)
    const capas = [...(info.layers ?? []), ...(info.tables ?? [])].slice(0, 8)
    out[`${s.name} (${s.type})`] = { descr: (info.serviceDescription ?? info.description ?? '').slice(0, 300), capas: capas.map(l => `${l.id} ${l.name}`) }
    for (const l of capas.slice(0, 4)) {
      const li = await j(`${url}/${l.id}?f=pjson`)
      const q = await j(`${url}/${l.id}/query?where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&f=json`)
      const qe = await j(`${url}/${l.id}/query?where=1%3D1&returnCountOnly=true&f=json`)
      out[`${s.name} capa ${l.id}`] = { nombre: l.name, campos: (li.fields ?? []).map(f => f.name).slice(0, 60), n: qe.count, ejemplo: (q.features ?? []).map(f => ({ ...f.attributes, geo: f.geometry })), error: q.error ?? li.error }
    }
  }
}
writeFileSync(here('../fuentes/sonda-temas.json'), JSON.stringify(out, null, 1))
console.log(Object.keys(out).join('\n'))
