// Sonda de fuentes para: componentes del precio de la luz, intercambios por frontera, consumo por sectores,
// gas y petróleo por origen, y comercio exterior. Solo escribe fuentes/sonda-comercio.json.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function prueba(id, url, mirar = (t) => t.slice(0, 500)) {
  await espera(1200)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (sonda)' } })
    const t = await r.text()
    out[id] = { status: r.status, url, resumen: r.ok ? mirar(t) : t.slice(0, 300) }
  } catch (e) { out[id] = { url, error: String(e.message) } }
}
const reeT = (t) => { try { const j = JSON.parse(t); return (j.included ?? []).map(i => `${i.attributes?.title}: ${(i.attributes?.values ?? []).length} · ${JSON.stringify((i.attributes?.values ?? []).at(-1))} · contenido ${(i.attributes?.content ?? []).map(c => c.attributes?.title + '(' + (c.attributes?.values ?? []).length + ')').join(', ')}`).join(' | ').slice(0, 1500) } catch { return t.slice(0, 300) } }
const R = 'https://apidatos.ree.es/es/datos/'
const m = 'start_date=2025-01-01T00:00&end_date=2025-12-31T23:59&time_trunc=month'
for (const ruta of ['mercados/componentes-precio-energia-cierre-desglose', 'mercados/componentes-precio', 'mercados/precios-mercados-tiempo-real', 'mercados/energia-precios-ponderados'])
  await prueba('ree:' + ruta, `${R}${ruta}?${m}`, reeT)
for (const f of ['francia', 'portugal', 'marruecos', 'andorra'])
  for (const tipo of ['frontera', 'frontera-programado', 'fisicos-frontera'])
    await prueba(`ree:intercambios/${f}-${tipo}`, `${R}intercambios/${f}-${tipo}?${m}`, reeT)
await prueba('ree:intercambios/todas-fronteras-programados', `${R}intercambios/todas-fronteras-programados?${m}`, reeT)
await prueba('ree:demanda/ire-general', `${R}demanda/ire-general?${m}`, reeT)
await prueba('ree:demanda/ire-industria', `${R}demanda/ire-industria?${m}`, reeT)
await prueba('ree:demanda/ire-servicios', `${R}demanda/ire-servicios?${m}`, reeT)

// Eurostat: estructura de dimensiones y valores
const esT = (t) => { try { const j = JSON.parse(t); return { dims: Object.fromEntries(j.id.map(d => [d, Object.keys(j.dimension[d].category.index).slice(0, 60).join(',')])), n: Object.keys(j.value ?? {}).length, label: j.label } } catch { return t.slice(0, 300) } }
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
await prueba('es:nrg_bal_c', `${ES}nrg_bal_c?format=JSON&lang=EN&geo=ES&siec=E7000&unit=GWH&lastTimePeriod=1`, esT)
await prueba('es:nrg_ti_gasm', `${ES}nrg_ti_gasm?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:nrg_ti_gas', `${ES}nrg_ti_gas?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:nrg_ti_oilm', `${ES}nrg_ti_oilm?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:nrg_ti_oil', `${ES}nrg_ti_oil?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:ext_st_eu27_2020sitc', `${ES}ext_st_eu27_2020sitc?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:ext_lt_intertrd', `${ES}ext_lt_intertrd?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:ext_lt_maineu', `${ES}ext_lt_maineu?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
await prueba('es:bop_its6_det', `${ES}bop_its6_det?format=JSON&lang=EN&geo=ES&lastTimePeriod=1`, esT)
// Comext (comercio detallado por país y producto)
const CX = 'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/'
await prueba('cx:DS-045409', `${CX}DS-045409?format=JSON&lang=EN&reporter=ES&partner=US&product=TOTAL&flow=1&indicators=VALUE_IN_EUROS&freq=A&lastTimePeriod=1`, esT)
await prueba('cx:DS-059341', `${CX}DS-059341?format=JSON&lang=EN&reporter=ES&partner=US&product=TOTAL&flow=1&indicators=VALUE_IN_EUROS&freq=A&lastTimePeriod=1`, esT)
await prueba('cx:DS-059322', `${CX}DS-059322?format=JSON&lang=EN&reporter=ES&lastTimePeriod=1`, esT)
await prueba('cx:DS-018995', `${CX}DS-018995?format=JSON&lang=EN&reporter=ES&lastTimePeriod=1`, esT)
// CORES y Enagás (páginas)
await prueba('cores', 'https://www.cores.es/es/estadisticas', t => (t.match(/href="[^"]*\.(xlsx?|csv)"/gi) ?? []).slice(0, 30).join(' '))
await prueba('enagas', 'https://www.enagas.es/es/gestion-tecnica-sistema/energy-data/', t => (t.match(/href="[^"]*\.(xlsx?|csv)"/gi) ?? []).slice(0, 30).join(' ') || t.slice(0, 200))
await prueba('datacomex', 'https://comercio.serviciosmin.gob.es/Datacomex/', t => t.slice(0, 200))
// mapa del mundo (npm)
await prueba('world-atlas', 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', t => t.length + ' bytes')
// Inventario de presas: qué campos trae (año de construcción, tipo, titular...)
const ARC = 'https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services'
await prueba('presas:campos', `${ARC}/UP_Presas_y_embalses/FeatureServer/0?f=json`, t => { try { return JSON.parse(t).fields.map(f => f.name + ':' + (f.alias ?? '')).join(' | ') } catch { return t.slice(0, 300) } })
await prueba('presas:ejemplo', `${ARC}/UP_Presas_y_embalses/FeatureServer/0/query?where=NOMBRE%20LIKE%20%27%25ALCANTARA%25%27&outFields=*&returnGeometry=false&f=json`, t => { try { return JSON.stringify(JSON.parse(t).features?.slice(0, 2).map(f => f.attributes)) } catch { return t.slice(0, 300) } })
// Subvenciones: BDNS / Infosubvenciones
const BD = 'https://www.infosubvenciones.es/bdnstrans/api'
for (const u of [`${BD}/convocatorias/ultimas?vpd=GE&page=0&pageSize=3`, `${BD}/concesiones/busqueda?vpd=GE&page=0&pageSize=3`, `${BD}/organos?vpd=GE&idAdmon=C`, `${BD}/convocatorias/busqueda?vpd=GE&page=0&pageSize=3&order=fechaRecepcion&direccion=desc`, `${BD}/actividades?vpd=GE`, `${BD}/grandesbeneficiarios/busqueda?vpd=GE&page=0&pageSize=3`])
  await prueba('bdns:' + u.split('/api/')[1].split('?')[0], u, t => t.slice(0, 700))
writeFileSync(here('../fuentes/sonda-comercio.json'), JSON.stringify(out, null, 1))
console.log('Sonda comercio:', Object.entries(out).map(([k, v]) => k + ' ' + (v.status ?? 'ERR')).join(' · '))
