// Impuestos: recaudación mensual de la Agencia Tributaria (Informe mensual de recaudación tributaria, en términos de caja).
//  · Cuadros_estadisticos_series: series mensuales desde 1995 por impuesto y por administración.
//  · Ingresos_por_Delegaciones: lo ingresado en cada delegación provincial desde 2007.
// Escribe public/impuestos/data/impuestos.json y el resumen de la portada.
// Uso: node scripts/impuestos.mjs   (AEAT_DIR=carpeta para usar ficheros ya bajados)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/impuestos/data/impuestos.json')
const B = 'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/'
const log = {}
const dir = process.env.AEAT_DIR ?? join(tmpdir(), 'aeat')
mkdirSync(dir, { recursive: true })
function fichero(f) {
  const p = join(dir, f)
  if (!process.env.AEAT_DIR || !existsSync(p)) execFileSync('curl', ['-sSfL', '--retry', '3', '--max-time', '180', '-A', 'Mozilla/5.0 espana-en-datos', '-o', p, B + f])
  return XLSX.readFile(p)
}
const limpia = (x) => String(x ?? '').replace(/\s+/g, ' ').replace(/\(\d\)|\([a-f](?: = [^)]*)?\)/g, '').trim()

// ---------- Series mensuales ----------
const wb = fichero('Cuadros_estadisticos_series_es_es.xlsx')
const a = XLSX.utils.sheet_to_json(wb.Sheets['Ingresos tributarios'], { header: 1, raw: true, defval: null })
const H = [1, 2, 3, 4, 5].map(r => a[r] ?? [])
const n = Math.max(...a.slice(0, 8).map(r => r.length))
// cabecera de cada columna: impuesto | bruto/devolución/neto | ruta de subconceptos
const col = []
let l0 = '', l1 = '', ruta = []
for (let j = 3; j < n; j++) {
  if (H[0][j] != null) { l0 = limpia(H[0][j]); l1 = ''; ruta = [] }
  if (H[1][j] != null) { l1 = limpia(H[1][j]); ruta = [] }
  for (let k = 2; k < 5; k++) if (H[k][j] != null) { ruta = ruta.slice(0, k - 2); ruta[k - 2] = limpia(H[k][j]) }
  col.push({ j, l0, l1, path: ruta.filter(Boolean).join(' / ') })
}
const busca = (re0, re1, re2) => col.find(c => re0.test(c.l0) && re1.test(c.l1) && re2.test(c.path))?.j
const SEL = {
  total: [/^Ingresos tributarios/, /netos/, /^Total$/], estado: [/^Ingresos tributarios/, /netos/, /Estado$/], ccaa: [/^Ingresos tributarios/, /netos/, /CC\.AA\.$/], ccll: [/^Ingresos tributarios/, /netos/, /CC\.LL\.$/],
  bruto: [/^Ingresos tributarios/, /brutos/, /^$/], devol: [/^Ingresos tributarios/, /Devoluciones/, /^$/],
  irpf: [/Personas Físicas/, /netos/, /^Total$/], irpf_ret: [/Personas Físicas/, /netos/, /Retenciones sobre rentas del trabajo/], irpf_aapp: [/Personas Físicas/, /netos/, /Principales Administraciones/],
  irpf_ge: [/Personas Físicas/, /netos/, /de las cuales.*Grandes Empresas$/], irpf_pyme: [/Personas Físicas/, /netos/, /de las cuales.*Pymes$/], irpf_cap: [/Personas Físicas/, /netos/, /capital mobiliario/], irpf_alq: [/Personas Físicas/, /netos/, /arrendamientos/],
  irpf_frac: [/Personas Físicas/, /netos/, /Pagos fraccionados/], irpf_decl: [/Personas Físicas/, /netos/, /Resultado de la declaración anual$/], irpf_ccaa: [/Personas Físicas/, /netos/, /CC\.AA\.$/],
  soc: [/Sociedades/, /netos/, /^Total$/], soc_frac: [/Sociedades/, /netos/, /Pagos fraccionados \/ Total/], soc_grupos: [/Sociedades/, /netos/, /Grupos consolidados/], soc_ge: [/Sociedades/, /netos/, /Grandes Empresas \(no grupos\)$/], soc_pyme: [/Sociedades/, /netos/, /Pagos fraccionados \/ Pymes$/], soc_decl: [/Sociedades/, /netos/, /Resultado de la declaración anual$/],
  irnr: [/No Residentes/, /netos/, /^Total$/],
  iva: [/Valor Añadido/, /netos/, /^Total$/], iva_bruto: [/Valor Añadido/, /brutos/, /^Total$/], iva_imp: [/Valor Añadido/, /brutos/, /Importaciones/], iva_devol: [/Valor Añadido/, /Devoluciones/, /^Total$/], iva_ccaa: [/Valor Añadido/, /netos/, /CC\.AA\.$/],
  iiee: [/Especiales/, /netos/, /^Total$/], hidro: [/Especiales/, /netos/, /Hidrocarburos \/ Total/], tabaco: [/Especiales/, /netos/, /Labores del Tabaco \/ Total/], alcohol: [/Especiales/, /netos/, /Alcohol y Bebidas Derivadas \/ Total/],
  cerveza: [/Especiales/, /netos/, /Cerveza \/ Total/], intermedios: [/Especiales/, /netos/, /Productos Intermedios \/ Total/], electricidad: [/Especiales/, /netos/, /Electricidad \/ Total/], plasticos: [/Especiales/, /netos/, /Envases de Plástico/], carbon: [/Especiales/, /netos/, /^.*Carbón$/], vapeo: [/Especiales/, /netos/, /cigarrillos electrónicos/],
  resto: [/^Resto/, /netos/, /^Total$/], trafico: [/^Resto/, /netos/, /Tráfico Exterior/], seguros: [/^Resto/, /netos/, /Primas de Seguros/], medioambiente: [/^Resto/, /netos/, /medioambientales \/ Total/], banca: [/^Resto/, /netos/, /Margen de Intereses.* \/ Total/],
  transacciones: [/^Resto/, /netos/, /Transacciones Financieras/], digitales: [/^Resto/, /netos/, /Servicios Digitales/], juego: [/^Resto/, /netos/, /Actividades del Juego/], tasas: [/^Resto/, /netos/, /Tasas \/ Total/],
}
const idx = Object.fromEntries(Object.entries(SEL).map(([k, [a0, a1, a2]]) => [k, busca(a0, a1, a2)]))
log.columnas = Object.fromEntries(Object.entries(idx).map(([k, j]) => [k, j == null ? 'NO ENCONTRADA' : `${j}: ${col.find(c => c.j === j).l0} · ${col.find(c => c.j === j).l1} · ${col.find(c => c.j === j).path}`]))
const filas = a.filter(r => /^\d{4}$/.test(String(r[0] ?? '').trim()) && Number(r[1]) >= 1 && Number(r[1]) <= 12 && typeof r[idx.total] === 'number')
const series = {}
for (const [k, j] of Object.entries(idx)) if (j != null) series[k] = filas.map(r => [`${String(r[0]).trim()}-${String(r[1]).padStart(2, '0')}`, typeof r[j] === 'number' ? Math.round(r[j] / 100) / 10 : null]) // miles → millones con un decimal
const ultimo = series.total.at(-1)[0]
log.meses = `${series.total.length}, de ${series.total[0][0]} a ${ultimo}`

// ---------- Por delegaciones ----------
let deleg = null
try {
  const w2 = fichero('Ingresos_por_Delegaciones.xlsx')
  const d = XLSX.utils.sheet_to_json(w2.Sheets['datos_delegaciones'], { header: 1, raw: true, defval: null })
  const cab = d[0].map(x => limpia(x))
  const conceptos = new Set(d.slice(1).map(r => limpia(r[2])).filter(Boolean))
  log.deleg_conceptos = [...conceptos].slice(0, 60)
  // los 12 últimos meses con dato
  const meses = [...new Set(d.slice(1).filter(r => r[0] && r[1] && typeof r[3] === 'number').map(r => `${String(r[0]).trim()}-${String(r[1]).padStart(2, '0')}`))].sort()
  const u12 = new Set(meses.slice(-12))
  const want = { total: /^Total Ingresos netos$/, irpf: /^IRPF Ingresos netos$/, iva: /^IVA Ingresos netos$/, soc: /^I\.?SOCIEDADES Ingresos netos$/ }
  // Cada columna → código INE de provincia. Las delegaciones locales (Jerez, Gijón, Vigo, Cartagena) suman a su provincia;
  // las delegaciones especiales de una sola provincia (Madrid, Cantabria…) cuentan como tal.
  const COD = { 'Almería': '04', 'Cádiz': '11', 'Córdoba': '14', 'Granada': '18', 'Huelva': '21', 'Jaén': '23', 'Málaga': '29', 'Sevilla': '41', 'Jerez de la Frontera': '11', 'Huesca': '22', 'Teruel': '44', 'Zaragoza': '50', 'Oviedo': '33', 'Gijón': '33', 'D.E. Baleares': '07', 'Las Palmas': '35', 'Sta.Cruz Tenerife': '38', 'D.E. Cantabria': '39', 'Albacete': '02', 'Ciudad Real': '13', 'Cuenca': '16', 'Guadalajara': '19', 'Toledo': '45', 'Ávila': '05', 'Burgos': '09', 'León': '24', 'Palencia': '34', 'Salamanca': '37', 'Segovia': '40', 'Soria': '42', 'Valladolid': '47', 'Zamora': '49', 'Barcelona': '08', 'Gerona': '17', 'Lérida': '25', 'Tarragona': '43', 'Badajoz': '06', 'Cáceres': '10', 'La Coruña': '15', 'Lugo': '27', 'Orense': '32', 'Pontevedra': '36', 'Vigo': '36', 'D.E. Madrid': '28', 'Murcia': '30', 'Cartagena': '30', 'D.E. Navarra': '31', 'Álava': '01', 'Guipúzcoa': '20', 'Vizcaya': '48', 'D.E. La Rioja': '26', 'Alicante': '03', 'Castellón': '12', 'Valencia': '46', 'Ceuta': '51', 'Melilla': '52' }
  log.deleg_sin_codigo = cab.slice(4).filter(x => x && !COD[x] && !/^D\.E\.|^Delegaciones$|^Servicios Centrales/.test(x))
  const prov = {}, centrales = {}
  for (const r of d.slice(1)) {
    const m = `${String(r[0] ?? '').trim()}-${String(r[1] ?? '').padStart(2, '0')}`
    if (!u12.has(m)) continue
    const c = limpia(r[2]), k = Object.keys(want).find(x => want[x].test(c)); if (!k) continue
    cab.forEach((name, j) => {
      if (j < 4 || typeof r[j] !== 'number') return
      if (name === 'Servicios Centrales') centrales[k] = (centrales[k] ?? 0) + r[j] / 1000
      const c = COD[name]; if (!c) return
      ;((prov[c] ??= {})[k] = (prov[c][k] ?? 0) + r[j] / 1000)
    })
  }
  for (const p of Object.values(prov)) for (const k in p) p[k] = Math.round(p[k] * 10) / 10
  for (const k in centrales) centrales[k] = Math.round(centrales[k])
  deleg = { desde: meses.slice(-12)[0], hasta: meses.at(-1), prov, centrales }
  log.deleg = `${Object.keys(prov).length} delegaciones, ${deleg.desde} a ${deleg.hasta}`
} catch (e) { log.deleg = 'ERROR ' + String(e.message).slice(0, 200) }

mkdirSync(here('../public/impuestos/data'), { recursive: true })
writeFileSync(OUT, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), ultimo, unidad: 'millones de euros', series, deleg }))
try {
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  const s12 = (k, fin = 0) => series[k].slice(-(12 + fin), fin ? -fin : undefined).reduce((t, x) => t + (x[1] ?? 0), 0)
  res.impuestos = { hasta: ultimo, total12: Math.round(s12('total')), var: Math.round((s12('total') / s12('total', 12) - 1) * 1000) / 10 }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log._resumen = String(e.message) }
writeFileSync(here('../fuentes/impuestos-log.json'), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log, null, 1).slice(0, 5000))
