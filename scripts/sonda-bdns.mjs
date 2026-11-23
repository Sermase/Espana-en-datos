// Sonda para Sector público: API de la BDNS (filtros, tamaño de página, campos) y tablas de cuentas públicas de Eurostat.
// Solo escribe fuentes/sonda-bdns.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function prueba(id, url, mirar = (t) => t.slice(0, 600)) {
  await espera(800)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (sonda)' } })
    const t = await r.text()
    out[id] = { status: r.status, url, resumen: r.ok ? mirar(t) : t.slice(0, 300) }
  } catch (e) { out[id] = { url, error: String(e.message) } }
}
const B = 'https://www.infosubvenciones.es/bdnstrans'
const pag = (t) => { try { const j = JSON.parse(t); return { total: j.totalElements, n: j.content?.length, primero: j.content?.[0], ultimo: j.content?.at(-1) && { fecha: j.content.at(-1).fechaConcesion ?? j.content.at(-1).fechaRecepcion, nivel1: j.content.at(-1).nivel1 } } } catch { return t.slice(0, 300) } }
const lista = (t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j.slice(0, 40) : j } catch { return t.slice(0, 600) } }

for (const p of ['/v3/api-docs', '/api/v3/api-docs', '/v2/api-docs', '/api-docs', '/api/api-docs', '/swagger-ui/index.html', '/openapi.json', '/api/openapi.json'])
  await prueba('doc' + p, B + p, t => t.slice(0, 4000))
for (const e of ['finalidades', 'instrumentos', 'regiones', 'beneficiarios', 'tiposbeneficiario', 'sectores', 'objetivos', 'reglamentos'])
  await prueba('cat:' + e, `${B}/api/${e}?vpd=GE`, lista)

const C = `${B}/api/concesiones/busqueda?vpd=GE&page=0`
await prueba('conc:pageSize10000', `${C}&pageSize=10000`, t => { const j = JSON.parse(t); return { n: j.content?.length, total: j.totalElements, bytes: t.length } })
await prueba('conc:pageSize2000', `${C}&pageSize=2000`, t => { const j = JSON.parse(t); return { n: j.content?.length, total: j.totalElements, bytes: t.length } })
await prueba('conc:base', `${C}&pageSize=2`, pag)
await prueba('conc:fechas', `${C}&pageSize=2&fechaDesde=01/10/2026&fechaHasta=31/10/2026`, pag)
await prueba('conc:fechasISO', `${C}&pageSize=2&fechaDesde=2026-10-01&fechaHasta=2026-10-31`, pag)
for (const k of ['tipoAdministracion=C', 'tipoAdministracion=A', 'tipoAdministracion=L', 'tipoAdministracion=O', 'nivel1=ESTADO', 'finalidad=1', 'finalidades=1', 'instrumentos=1', 'regiones=1', 'actividad=1', 'order=importe&direccion=desc', 'order=fechaConcesion&direccion=asc'])
  await prueba('conc:' + k, `${C}&pageSize=2&fechaDesde=01/10/2026&fechaHasta=31/10/2026&${k}`, pag)
await prueba('conc:exportar', `${B}/api/concesiones/busqueda/exportar?vpd=GE&tipoDoc=csv&fechaDesde=01/11/2026&fechaHasta=02/11/2026`, t => t.slice(0, 800))

const V = `${B}/api/convocatorias/busqueda?vpd=GE&page=0&pageSize=2`
await prueba('conv:fechas', `${V}&fechaDesde=01/10/2026&fechaHasta=31/10/2026`, pag)
for (const k of ['tipoAdministracion=C', 'tipoAdministracion=L', 'finalidad=1', 'finalidades=1', 'mrr=true'])
  await prueba('conv:' + k, `${V}&fechaDesde=01/10/2026&fechaHasta=31/10/2026&${k}`, pag)
await prueba('conv:detalle', `${B}/api/convocatorias?vpd=GE&numConv=944145`, t => t.slice(0, 3000))
await prueba('gb:2024', `${B}/api/grandesbeneficiarios/busqueda?vpd=GE&page=0&pageSize=5&ejercicio=2024&order=ayudaETotal&direccion=desc`, pag)
await prueba('gb:anios', `${B}/api/grandesbeneficiarios/anios?vpd=GE`, t => t.slice(0, 300))
await prueba('minimis', `${B}/api/minimis/busqueda?vpd=GE&page=0&pageSize=2`, pag)
await prueba('ayudasestado', `${B}/api/ayudasestado/busqueda?vpd=GE&page=0&pageSize=2`, pag)

// Eurostat: cuentas de las administraciones públicas
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const esT = (t) => { try { const j = JSON.parse(t); return { dims: Object.fromEntries(j.id.map(d => [d, Object.keys(j.dimension[d].category.index).slice(0, 80).join(',')])), n: Object.keys(j.value ?? {}).length } } catch { return t.slice(0, 300) } }
await prueba('es:gov_10a_main', `${ES}/gov_10a_main?format=JSON&geo=ES&unit=MIO_EUR&time=2024`, esT)
await prueba('es:gov_10a_exp', `${ES}/gov_10a_exp?format=JSON&geo=ES&unit=MIO_EUR&time=2024&na_item=TE`, esT)
await prueba('es:gov_10a_taxag', `${ES}/gov_10a_taxag?format=JSON&geo=ES&unit=MIO_EUR&time=2024`, esT)
await prueba('es:gov_10dd_edpt1', `${ES}/gov_10dd_edpt1?format=JSON&geo=ES&unit=MIO_EUR&time=2024`, esT)
await prueba('es:gov_10q_ggnfa', `${ES}/gov_10q_ggnfa?format=JSON&geo=ES&unit=MIO_EUR&s_adj=NSA&lastTimePeriod=2`, esT)

writeFileSync(here('../fuentes/sonda-bdns.json'), JSON.stringify(out, null, 1))
console.log(Object.entries(out).map(([k, v]) => k + ' ' + (v.status ?? v.error)).join('\n'))
