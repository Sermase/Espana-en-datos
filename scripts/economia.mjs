// Economía: series de Eurostat (sin clave) y del INE, para public/economia/data/series.json.
// Cada serie queda como { nombre, fuente, frec, unidad, d: [[periodo, valor]...] } y se agrupan por tema.
// Uso: node scripts/economia.mjs        (Node 20+; sin dependencias)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/economia/data/series.json')
const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const log = {}

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200))
      return await r.json()
    } catch (e) { if (i === 3) throw e; await new Promise(s => setTimeout(s, 3000 * (i + 1))) }
  }
}

/** Eurostat JSON-stat → { [clave de la dimensión que varía]: [[periodo, valor]] } */
async function eurostat(code, filtros, varia = 'geo') {
  const qs = new URLSearchParams({ format: 'JSON', lang: 'EN' })
  for (const [k, v] of Object.entries(filtros)) for (const x of [].concat(v)) qs.append(k, x)
  const j = await get(`${ES}/${code}?${qs}`)
  const ids = j.id, size = j.size
  const pos = (dim) => Object.entries(j.dimension[dim].category.index).sort((a, b) => a[1] - b[1]).map(([k]) => k)
  const times = pos('time'), cats = pos(varia)
  const iT = ids.indexOf('time'), iV = ids.indexOf(varia)
  const stride = ids.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1))
  const out = {}
  for (const [flat, val] of Object.entries(j.value)) {
    let rest = Number(flat); const coord = ids.map((_, i) => { const c = Math.floor(rest / stride[i]); rest %= stride[i]; return c })
    const key = cats[coord[iV]], t = times[coord[iT]]
    ;(out[key] ??= []).push([t, +Number(val).toFixed(3)])
  }
  for (const k in out) out[k].sort((a, b) => a[0].localeCompare(b[0]))
  return out
}

const temas = {}
async function serie(tema, id, nombre, unidad, frec, fn) {
  try {
    const r = await fn()
    temas[tema] ??= {}
    for (const [k, d] of Object.entries(r)) if (d.length) temas[tema][`${id}${Object.keys(r).length > 1 ? ':' + k : ''}`] = { nombre: Object.keys(r).length > 1 ? `${nombre} · ${k}` : nombre, unidad, frec, fuente: 'Eurostat', d }
    log[id] = Object.fromEntries(Object.entries(r).map(([k, d]) => [k, `${d.length} datos, último ${d.at(-1)?.join(' = ')}`]))
  } catch (e) { log[id] = 'ERROR ' + String(e.message).slice(0, 300) }
}

const UE = 'EU27_2020'
const PAISES = ['ES', 'DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'IE', 'PL', 'SE', 'AT', 'GR', 'DK', 'FI', 'CZ', 'RO', 'HU', UE]
const NUTS2 = { ES11: 'Galicia', ES12: 'Asturias', ES13: 'Cantabria', ES21: 'País Vasco', ES22: 'Navarra', ES23: 'La Rioja', ES24: 'Aragón', ES30: 'Madrid', ES41: 'Castilla y León', ES42: 'Castilla-La Mancha', ES43: 'Extremadura', ES51: 'Cataluña', ES52: 'C. Valenciana', ES53: 'Illes Balears', ES61: 'Andalucía', ES62: 'Murcia', ES63: 'Ceuta', ES64: 'Melilla', ES70: 'Canarias' }
const desde = (y) => ({ sinceTimePeriod: String(y) })

// --- Crecimiento ---
await serie('pib', 'pib_anual', 'PIB, variación anual', '%', 'T', () => eurostat('namq_10_gdp', { unit: 'CLV_PCH_SM', s_adj: 'SCA', na_item: 'B1GQ', geo: ['ES', UE], ...desde(1996) }))
await serie('pib', 'pib_trim', 'PIB, variación trimestral', '%', 'T', () => eurostat('namq_10_gdp', { unit: 'CLV_PCH_PRE', s_adj: 'SCA', na_item: 'B1GQ', geo: ['ES', UE], ...desde(1996) }))
await serie('pib', 'pib_nivel', 'PIB a precios corrientes', 'M€', 'A', () => eurostat('nama_10_gdp', { unit: 'CP_MEUR', na_item: 'B1GQ', geo: 'ES', ...desde(1995) }))
await serie('pib', 'pib_pc_ppa', 'PIB por habitante en poder de compra (UE = 100)', 'índice', 'A', () => eurostat('nama_10_pc', { unit: 'PC_EU27_2020_HAB_MPPS_CP', na_item: 'B1GQ', geo: PAISES, ...desde(2000) }))
await serie('pib', 'pib_pc_ccaa', 'PIB por habitante', '€', 'A', () => eurostat('nama_10r_2gdp', { unit: 'EUR_HAB', geo: [...Object.keys(NUTS2), 'ES'], ...desde(2000) }))

// --- Precios ---
await serie('precios', 'ipc', 'Inflación (IPCA)', '%', 'M', () => eurostat('prc_hicp_manr', { coicop: 'CP00', geo: ['ES', UE], ...desde(1997) }))
await serie('precios', 'ipc_sub', 'Inflación subyacente (sin energía ni alimentos)', '%', 'M', () => eurostat('prc_hicp_manr', { coicop: 'TOT_X_NRG_FOOD', geo: 'ES', ...desde(2002) }))
await serie('precios', 'ipc_grupos', 'Inflación por grupos', '%', 'M', () => eurostat('prc_hicp_manr', { coicop: ['CP01', 'CP02', 'CP03', 'CP04', 'CP045', 'CP06', 'CP07', 'CP0722', 'CP09', 'CP11', 'NRG', 'SERV'], geo: 'ES', ...desde(2015) }, 'coicop'))
await serie('precios', 'ipc_paises', 'Inflación en la UE', '%', 'M', () => eurostat('prc_hicp_manr', { coicop: 'CP00', geo: PAISES, ...desde(2023) }))

// --- Empleo ---
await serie('empleo', 'paro', 'Tasa de paro', '%', 'M', () => eurostat('une_rt_m', { s_adj: 'SA', age: 'TOTAL', sex: 'T', unit: 'PC_ACT', geo: ['ES', UE], ...desde(2000) }))
await serie('empleo', 'paro_joven', 'Paro de menores de 25 años', '%', 'M', () => eurostat('une_rt_m', { s_adj: 'SA', age: 'Y_LT25', sex: 'T', unit: 'PC_ACT', geo: ['ES', UE], ...desde(2000) }))
await serie('empleo', 'paro_sexo', 'Tasa de paro por sexo', '%', 'M', () => eurostat('une_rt_m', { s_adj: 'SA', age: 'TOTAL', sex: ['M', 'F'], unit: 'PC_ACT', geo: 'ES', ...desde(2000) }, 'sex'))
await serie('empleo', 'paro_paises', 'Tasa de paro en la UE', '%', 'M', () => eurostat('une_rt_m', { s_adj: 'SA', age: 'TOTAL', sex: 'T', unit: 'PC_ACT', geo: PAISES, ...desde(2023) }))
await serie('empleo', 'paro_ccaa', 'Tasa de paro por comunidad', '%', 'A', () => eurostat('lfst_r_lfu3rt', { sex: 'T', age: 'Y15-74', isced11: 'TOTAL', unit: 'PC', geo: Object.keys(NUTS2), ...desde(2000) }))
await serie('empleo', 'empleo_tasa', 'Tasa de empleo (20-64 años)', '%', 'A', () => eurostat('lfsi_emp_a', { indic_em: 'EMP_LFS', sex: 'T', age: 'Y20-64', unit: 'PC_POP', geo: ['ES', UE], ...desde(2000) }))
await serie('empleo', 'temporal', 'Asalariados con contrato temporal', '%', 'A', () => eurostat('lfsa_etpga', { sex: 'T', age: 'Y15-64', unit: 'PC', geo: ['ES', UE], ...desde(2000) }))

// --- Salarios ---
await serie('salarios', 'smi', 'Salario mínimo mensual', '€', 'S', () => eurostat('earn_mw_cur', { currency: 'EUR', geo: PAISES.filter(g => !['SE', 'AT', 'DK', 'FI', 'IT', UE].includes(g)), ...desde(2000) }))
await serie('salarios', 'coste_laboral', 'Coste laboral por hora, variación anual', '%', 'T', () => eurostat('lc_lci_r2_q', { nace_r2: 'B-S', unit: 'PCH_SM', s_adj: 'SCA', lcstruct: 'D1_D4_MD5', geo: ['ES', UE], ...desde(2005) }))
await serie('salarios', 'salario_medio', 'Salario medio anual a tiempo completo', '€', 'A', () => eurostat('nama_10_fte', { unit: 'EUR', geo: PAISES, ...desde(2000) }))

// --- Vivienda ---
await serie('vivienda', 'vivienda_var', 'Precio de la vivienda, variación anual', '%', 'T', () => eurostat('prc_hpi_q', { purchase: 'TOTAL', unit: 'RCH_A', geo: ['ES', UE], ...desde(2008) }))
await serie('vivienda', 'vivienda_ind', 'Precio de la vivienda (2015 = 100)', 'índice', 'T', () => eurostat('prc_hpi_q', { purchase: ['TOTAL', 'DW_NEW', 'DW_EXST'], unit: 'I15_Q', geo: 'ES', ...desde(2007) }, 'purchase'))
await serie('vivienda', 'euribor', 'Euríbor a 12 meses', '%', 'M', () => eurostat('irt_st_m', { int_rt: 'IRT_M12', geo: 'EA', ...desde(1999) }))
await serie('vivienda', 'propiedad', 'Hogares en vivienda en propiedad', '%', 'A', () => eurostat('ilc_lvho02', { tenure: 'OWN', hhtyp: 'TOTAL', incgrp: 'TOTAL', geo: PAISES, ...desde(2010) }))

// --- Cuentas públicas ---
await serie('publico', 'deuda', 'Deuda pública', '% del PIB', 'A', () => eurostat('gov_10dd_edpt1', { unit: 'PC_GDP', sector: 'S13', na_item: 'GD', geo: PAISES, ...desde(1995) }))
await serie('publico', 'deficit', 'Déficit o superávit público', '% del PIB', 'A', () => eurostat('gov_10dd_edpt1', { unit: 'PC_GDP', sector: 'S13', na_item: 'B9', geo: PAISES, ...desde(1995) }))
await serie('publico', 'deuda_trim', 'Deuda pública trimestral', '% del PIB', 'T', () => eurostat('gov_10q_ggdebt', { unit: 'PC_GDP', sector: 'S13', na_item: 'GD', geo: ['ES', UE], ...desde(2000) }))
await serie('publico', 'gasto', 'Gasto público por funciones', '% del PIB', 'A', () => eurostat('gov_10a_exp', { unit: 'PC_GDP', sector: 'S13', na_item: 'TE', cofog99: ['GF01', 'GF02', 'GF03', 'GF04', 'GF05', 'GF06', 'GF07', 'GF08', 'GF09', 'GF10'], geo: 'ES', ...desde(2010) }, 'cofog99'))

// --- Bolsillos: renta y pobreza ---
await serie('hogares', 'riesgo_pobreza', 'En riesgo de pobreza o exclusión social', '%', 'A', () => eurostat('ilc_peps01n', { unit: 'PC', age: 'TOTAL', sex: 'T', geo: ['ES', UE], ...desde(2015) }))
await serie('hogares', 'gini', 'Desigualdad (índice de Gini)', 'índice', 'A', () => eurostat('ilc_di12', { geo: PAISES, ...desde(2005) }))
await serie('hogares', 'renta_mediana', 'Renta mediana por persona', '€', 'A', () => eurostat('ilc_di03', { indic_il: 'MED_E', age: 'TOTAL', sex: 'T', unit: 'EUR', geo: PAISES, ...desde(2005) }))

const NOMBRES = {
  geo: { ES: 'España', [UE]: 'UE', EA: 'Zona euro', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal', NL: 'Países Bajos', BE: 'Bélgica', IE: 'Irlanda', PL: 'Polonia', SE: 'Suecia', AT: 'Austria', GR: 'Grecia', DK: 'Dinamarca', FI: 'Finlandia', CZ: 'Chequia', RO: 'Rumanía', HU: 'Hungría', ...NUTS2 },
  coicop: { CP01: 'Alimentos', CP02: 'Alcohol y tabaco', CP03: 'Ropa y calzado', CP04: 'Vivienda y suministros', CP045: 'Luz, gas y calefacción', CP06: 'Sanidad', CP07: 'Transporte', CP0722: 'Carburantes', CP09: 'Ocio y cultura', CP11: 'Hoteles y restaurantes', NRG: 'Energía', SERV: 'Servicios' },
  sex: { M: 'Hombres', F: 'Mujeres' },
  purchase: { TOTAL: 'Todas', DW_NEW: 'Nueva', DW_EXST: 'Usada' },
  cofog99: { GF01: 'Servicios generales', GF02: 'Defensa', GF03: 'Orden y seguridad', GF04: 'Asuntos económicos', GF05: 'Medio ambiente', GF06: 'Vivienda y urbanismo', GF07: 'Sanidad', GF08: 'Ocio, cultura y religión', GF09: 'Educación', GF10: 'Protección social (pensiones, paro…)' },
}
const out = { fecha: new Date().toISOString().slice(0, 10), nombres: NOMBRES, temas }
writeFileSync(OUT, JSON.stringify(out))
writeFileSync(here('../fuentes/economia-log.json'), JSON.stringify(log, null, 1))

// resumen para la portada
const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
const lastOf = (t, k) => temas[t]?.[k]?.d.at(-1)
res.economia = { ipc: lastOf('precios', 'ipc:ES'), paro: lastOf('empleo', 'paro:ES'), pib: lastOf('pib', 'pib_anual:ES') }
writeFileSync(RES, JSON.stringify(res, null, 1))
console.log('Economía:', Object.values(log).filter(v => typeof v === 'string').length, 'series con error de', Object.keys(log).length)
