// Aire: emisiones de gases de efecto invernadero y de contaminantes por sector desde 1990 (Eurostat, inventarios
// que España envía a la ONU y a la UE). Escribe public/aire/data/emisiones.json, fuentes/aire-log.json y resumen.aire.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/aire/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function eurostat(ds, q) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${ES}${ds}?format=JSON&lang=en&${q}`, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      if (r.ok) return await r.json()
      log.avisos.push(`${ds} HTTP ${r.status}`)
    } catch (e) { log.avisos.push(`${ds}: ${e.message}`) }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Eurostat no responde: ' + ds)
}
/** JSON-stat → { [dimA]: { [dimB]: { año: valor } } } según el orden de dimensiones pedido. */
function tabla(j, dims) {
  const ids = j.id, size = j.size, idx = ids.map(d => j.dimension[d].category.index)
  const inv = idx.map(m => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])))
  const out = {}
  for (const [pos, val] of Object.entries(j.value)) {
    let p = +pos; const c = {}
    for (let k = ids.length - 1; k >= 0; k--) { c[ids[k]] = inv[k][p % size[k]]; p = Math.floor(p / size[k]) }
    let o = out; for (const d of dims) o = (o[c[d]] ??= {})
    o[c.time] = val
  }
  return out
}
const etiquetas = (j, d) => j.dimension[d].category.label

// 1. Gases de efecto invernadero por sector (CRF), España y UE, todos los años
const gge = await eurostat('env_air_gge', 'geo=ES&geo=EU27_2020&airpol=GHG&unit=THS_T')
const G = tabla(gge, ['geo', 'src_crf'])
const LCRF = etiquetas(gge, 'src_crf')
log.crf = Object.entries(LCRF).map(([k, v]) => `${k} ${v}`)
// 2. Contaminantes del aire por sector (NFR), España y UE
const emi = await eurostat('env_air_emis', 'geo=ES&geo=EU27_2020&unit=T&airpol=NOX&airpol=SOX&airpol=PM2_5&airpol=PM10&airpol=NH3&airpol=NMVOC&airpol=CO')
const P = tabla(emi, ['geo', 'airpol', 'src_nfr'])
const LNFR = etiquetas(emi, 'src_nfr')
log.nfr = Object.entries(LNFR).map(([k, v]) => `${k} ${v}`)
// 3. Población para las cifras por habitante
const pob = await eurostat('demo_pjan', 'geo=ES&geo=EU27_2020&age=TOTAL&sex=T')
const POB = tabla(pob, ['geo'])

const años = [...new Set(Object.keys(G.ES?.[Object.keys(G.ES)[0]] ?? {}))].map(Number).sort()
const serie = (o) => años.map(a => o?.[a] ?? null)
const fecha = new Date().toISOString().slice(0, 10)
const datos = {
  fecha, años,
  gei: { es: Object.fromEntries(Object.entries(G.ES ?? {}).map(([k, v]) => [k, serie(v)])), ue: Object.fromEntries(Object.entries(G.EU27_2020 ?? {}).filter(([k]) => /^(TOTX4_MEMONIA|TOTX4_MEMO|TOTXMEMO|TOTX_MEMO)$/.test(k)).map(([k, v]) => [k, serie(v)])) },
  crf: LCRF,
  cont: { es: Object.fromEntries(Object.entries(P.ES ?? {}).map(([pol, s]) => [pol, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, serie(v)]))])), ue: Object.fromEntries(Object.entries(P.EU27_2020 ?? {}).map(([pol, s]) => [pol, serie(s.NFR_TOT_NAT ?? s.TOTX_NAT ?? Object.values(s)[0])])) },
  nfr: LNFR,
  pob: { es: serie(POB.ES), ue: serie(POB.EU27_2020) },
}
writeFileSync(`${OUT}/emisiones.json`, JSON.stringify(datos))
// resumen para la portada: emisiones totales del último año frente a 1990
const tot = datos.gei.es.TOTX4_MEMONIA ?? datos.gei.es.TOTX4_MEMO ?? Object.values(datos.gei.es)[0]
const i = tot.findLastIndex(v => v != null), i90 = años.indexOf(1990)
const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
res.aire = { ...(res.aire ?? {}), año: años[i], gei: tot[i], vs1990: i90 >= 0 && tot[i90] ? ((tot[i] - tot[i90]) / tot[i90]) * 100 : null }
writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/aire-log.json'), JSON.stringify(log, null, 1))
console.log(`Emisiones: ${años[0]}-${años[i]}, ${Object.keys(datos.gei.es).length} sectores CRF, ${Object.keys(datos.cont.es).length} contaminantes`)
