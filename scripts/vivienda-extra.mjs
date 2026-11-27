// Vivienda, secciones extra: viviendas vacías (Censo 2021 del INE, según consumo eléctrico) y régimen de tenencia (ECV del INE, Censo 2021).
// → public/vivienda/data/extra.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
mkdirSync(here('../public/vivienda/data/'), { recursive: true })
const INE = 'https://servicios.ine.es/wstempus/js/ES'
const espera = (ms) => new Promise(s => setTimeout(s, ms))
async function tabla(id, nult) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${INE}/DATOS_TABLA/${id}?nult=${nult}`, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' }, signal: AbortSignal.timeout(180000) })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return await r.json()
    } catch (e) { if (i === 2) throw e; await espera(3000 * (i + 1)) }
  }
}
const out = { generado: new Date().toISOString().slice(0, 10), fuentes: {} }

// 1) Viviendas vacías, 59531: «<territorio>, <variable>»
try {
  const d = await tabla(59531, 1)
  const ter = new Map()
  for (const s of d) {
    const i = s.Nombre.indexOf(', ')
    if (i < 0) continue
    const nom = s.Nombre.slice(0, i), v = s.Nombre.slice(i + 2)
    const val = s.Data?.[0]?.Valor
    if (val == null) continue
    const clave = v === 'Viviendas totales' ? 't' : v === 'Viviendas vacías' ? 'v' : v === 'Viviendas con bajo consumo' ? 'b' : v === 'Viviendas de uso esporádico' ? 'e' : v === 'Mediana consumo anual' ? 'm' : null
    if (!clave) continue
    if (!ter.has(nom)) ter.set(nom, {})
    ter.get(nom)[clave] = +val
  }
  const fila = ([nom, o]) => { const m = nom.match(/^(\d{2,5}) (.+)$/); return { cod: m ? m[1] : nom, n: m ? m[2] : nom, ...o } }
  const todo = [...ter].map(fila).filter(f => f.t && f.v != null)
  out.nacional = todo.find(f => f.cod === 'Total Nacional')
  out.ccaa = todo.filter(f => /^\d{2}$/.test(f.cod) && ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19'].includes(f.cod))
  // las provincias también tienen código de 2 cifras: se distinguen porque el INE lista cada CCAA y después sus provincias en este orden
  const orden = [...ter.keys()].filter(k => /^\d{2} /.test(k))
  const ccaaIds = new Set(); const prov = []; let esCcaa = true
  // Heurística estable: una CCAA es la que aparece antes de provincias con su mismo código de comunidad en el INE (01–19); provincias 01–52 se resuelven por nombre
  out.provincias = []; out.ccaa = []
  const CCAA = new Set(['Andalucía', 'Aragón', 'Asturias, Principado de', 'Balears, Illes', 'Canarias', 'Cantabria', 'Castilla y León', 'Castilla - La Mancha', 'Cataluña', 'Comunitat Valenciana', 'Extremadura', 'Galicia', 'Madrid, Comunidad de', 'Murcia, Región de', 'Navarra, Comunidad Foral de', 'País Vasco', 'Rioja, La', 'Ceuta', 'Melilla'])
  let ccaaActual = null
  for (const k of orden) {
    const f = fila([k, ter.get(k)])
    const esC = CCAA.has(f.n) && (ccaaActual === null || ter.has(k)) && !(out.ccaa.length && out.provincias.length && f.n === 'Ceuta' && false)
    // En las comunidades uniprovinciales el INE repite el nombre (CCAA y provincia): el primero es la CCAA, el segundo la provincia
    if (CCAA.has(f.n) && !out.ccaa.some(c => c.n === f.n)) { out.ccaa.push(f); ccaaActual = f; continue }
    out.provincias.push({ ...f, ccaa: ccaaActual?.n })
  }
  // municipios: más vacías y mayor proporción (≥ 5.000 viviendas)
  const muni = [...ter].filter(([k]) => /^\d{5} /.test(k)).map(fila).filter(f => f.t && f.v != null)
  out.nMunicipios = muni.length
  out.topAbs = [...muni].sort((a, b) => b.v - a.v).slice(0, 15)
  out.topPct = muni.filter(f => f.t >= 5000).sort((a, b) => b.v / b.t - a.v / a.t).slice(0, 15)
  out.menosPct = muni.filter(f => f.t >= 5000).sort((a, b) => a.v / a.t - b.v / b.t).slice(0, 10)
  out.fuentes.vacias = 'INE · Censos de Población y Viviendas 2021, tabla 59531 (intensidad de uso según consumo eléctrico)'
} catch (e) { out.errorVacias = String(e.message) }

// 2) Tenencia, ECV: 9997 (comunidades), 9994 (edad), 9995 (nacionalidad)
const cats = ['Propiedad sin hipoteca', 'Propiedad con hipoteca', 'Alquiler a precio de mercado', 'Alquiler inferior al precio de mercado', 'Cesión']
async function tenencia(id, nult) {
  const d = await tabla(id, nult)
  const res = {}
  for (const s of d) {
    const p = s.Nombre.split('. ').map(x => x.trim()).filter(Boolean) // [..., territorio/grupo, categoría, 'Hogar']
    const cat = p[p.length - 2]
    if (!cats.includes(cat) && cat !== 'Propiedad') continue
    const grupo = p.slice(0, -2).join(' · ')
    res[grupo] ??= {}
    res[grupo][cat] = (s.Data ?? []).filter(x => x.Valor != null).map(x => [x.Anyo, +x.Valor]).sort((a, b) => a[0] - b[0])
  }
  return res
}
try { out.tenenciaCcaa = await tenencia(9997, 25); out.fuentes.tenencia = 'INE · Encuesta de Condiciones de Vida, tablas 9997 y 9994' } catch (e) { out.errorTenencia = String(e.message) }
try { out.tenenciaEdad = await tenencia(9994, 25) } catch (e) { out.errorEdad = String(e.message) }
// 3) Censo 2021: tenencia por tamaño del municipio (59523) y principal / no principal
try {
  const d = await tabla(59523, 1)
  out.tenenciaTamano = d.map(s => { const p = s.Nombre.split(', '); return { reg: p[1], tam: p[2], v: +s.Data?.[0]?.Valor } }).filter(f => f.tam && f.v && f.reg && f.reg !== 'Total (régimen de tenencia)' || (f.reg === 'Total (régimen de tenencia)' && f.tam))
} catch (e) { out.errorTamano = String(e.message) }
writeFileSync(here('../public/vivienda/data/extra.json'), JSON.stringify(out))
console.log('ok', Object.keys(out))
