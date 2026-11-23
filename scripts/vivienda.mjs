// Vivienda: precios de compra, alquiler, compraventas e hipotecas, por comunidad, provincia y municipio.
// Fuentes: INE (API JSON) y Ministerio de Vivienda (valor tasado, Excel). Primera pasada: también registra
// la estructura de cada fuente en fuentes/vivienda-log.json para ajustar filtros.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
mkdirSync(here('../public/vivienda/data/'), { recursive: true })
const OUT = here('../public/vivienda/data/vivienda.json')
const prev = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return {} } })()
const log = {}
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES'

async function get(url, tipo = 'json') {
  for (let i = 0; i < 3; i++) {
    await espera(700)
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return tipo === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer())
    } catch (e) { if (i === 2) throw e; await espera(3000 * (i + 1)) }
  }
}
/** Tabla del INE → [{ nombre, datos: [[periodo, valor]] }] */
async function tabla(id, nult = 200) {
  const j = await get(`${INE}/DATOS_TABLA/${id}?nult=${nult}`)
  return j.map(s => ({ nombre: s.Nombre, datos: (s.Data ?? []).filter(d => d.Valor != null).map(d => [periodo(d), +Number(d.Valor).toFixed(3)]).reverse() }))
}
const periodo = (d) => { const a = d.Anyo, p = d.FK_Periodo; if (p >= 1 && p <= 12) return `${a}-${String(p).padStart(2, '0')}`; if (p >= 19 && p <= 22) return `${a}-T${p - 18}`; return String(a) }

// --- 1) Tablas del INE ---
// IPV (índice de precios de vivienda, por comunidad, trimestral): el INE cambia de tabla al rebasar;
// se busca en la operación la más reciente con «Índices por comunidades».
let IPV = 25171
try {
  const ts = await get(`${INE}/TABLAS_OPERACION/IPV`)
  log._ipv_tablas = ts.slice(0, 40).map(t => `${t.Id}: ${t.Nombre}`).join(' | ')
  const c = ts.filter(t => /CCAA|comunidades/i.test(t.Nombre) && /general, vivienda nueva/i.test(t.Nombre) && /trimestral/i.test(t.Nombre)).sort((x, y) => y.Id - x.Id)[0]
  if (c) IPV = c.Id
} catch (e) { log._ipv_tablas = 'ERROR ' + e.message }
const TABLAS = { ipv: IPV, compraventas: 6150, hipotecas: 3200, alquiler: 59060, alquiler_tam: 59057 }

/** Agrupa series por territorio: nombre «A. B. C.» → partes; `clave(partes)` devuelve [territorio, medida] o null. */
function agrupa(series, clave) {
  const out = {}
  for (const s of series) {
    const partes = s.nombre.split('.').map(x => x.trim()).filter(Boolean)
    const k = clave(partes); if (!k) continue
    ;(out[k[0]] ??= {})[k[1]] = s.datos
  }
  return out
}
const datos = { fecha: new Date().toISOString(), tablas: TABLAS }
const paso = async (id, fn) => { try { datos[id] = await fn(); log[id] = Object.keys(datos[id]).length + ' territorios · ej. ' + JSON.stringify(Object.entries(Object.values(datos[id])[0] ?? {}).map(([k, v]) => [k, v.length, v.at(-1)])).slice(0, 300) } catch (e) { datos[id] = prev[id] ?? null; log[id] = 'ERROR ' + String(e.message).slice(0, 200) } }

await paso('ipv', async () => agrupa(await tabla(TABLAS.ipv, 400), ([t, tipo, med]) => {
  const k = { 'Índice': 'i', 'Variación anual': 'a' }[med]; if (!k) return null
  const ty = { General: 'g', 'Vivienda nueva': 'n', 'Vivienda segunda mano': 'u' }[tipo]; if (!ty) return null
  return [t === 'Nacional' ? 'España' : t, ty + k]
}))
await paso('compraventas', async () => agrupa(await tabla(TABLAS.compraventas, 400), ([t, tipo]) => {
  const ty = { General: 'total', 'Vivienda nueva': 'nueva', 'Vivienda segunda mano': 'usada' }[tipo]; return ty ? [t === 'Total Nacional' ? 'España' : t, ty] : null
}))
await paso('hipotecas', async () => agrupa(await tabla(TABLAS.hipotecas, 400), ([f, med, t]) => {
  if (f !== 'Viviendas') return null
  const k = { 'Número de hipotecas': 'num', 'Importe de hipotecas': 'imp' }[med]; return k ? [t === 'Total Nacional' ? 'España' : t, k] : null
}))
await paso('alquiler', async () => agrupa(await tabla(TABLAS.alquiler, 40), (p) => {
  const t = p[0], med = p.find(x => x === 'Índice' || x === 'Variación anual'), tot = p.includes('Total')
  if (!med || !tot) return null
  return [t === 'Total Nacional' ? 'España' : t, med === 'Índice' ? 'i' : 'a']
}))

// --- 2) Ministerio de Vivienda: valor tasado (€/m²). Se buscan los Excel en varias direcciones posibles. ---
for (const url of ['https://apps.fomento.gob.es/BoletinOnline2/sedal/35101000.XLS', 'https://apps.fomento.gob.es/boletinonline2/sedal/35101000.XLS', 'https://www.transportes.gob.es/recursos_mfom/listado/recursos/35101000.xls', 'https://www.mivau.gob.es/vivienda/estadisticas/valor-tasado-de-la-vivienda', 'https://www.transportes.gob.es/informacion-para-el-ciudadano/informacion-estadistica/vivienda-y-actuaciones-urbanas/estadisticas/valor-tasado-de-la-vivienda']) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos)' }, redirect: 'follow' })
    const buf = Buffer.from(await r.arrayBuffer()), txt = buf.slice(0, 4000).toString('latin1')
    log['_tasado ' + url] = `${r.status} ${r.headers.get('content-type')} → ${r.url} · ${(buf.toString('latin1').match(/href="[^"]+\.xlsx?"/gi) ?? []).slice(0, 12).join(' ') || txt.replace(/\s+/g, ' ').slice(0, 200)}`
  } catch (e) { log['_tasado ' + url] = 'ERROR ' + e.message }
}

writeFileSync(OUT, JSON.stringify(datos))
// resumen para la portada
try {
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  const e = datos.ipv?.['España'], c = datos.compraventas?.['España']?.total
  res.vivienda = { ipv_a: e?.ga?.at(-1) ?? null, compraventas: c ? c.slice(-12).reduce((t, x) => t + x[1], 0) : null, hasta: c?.at(-1)?.[0] }
  writeFileSync(RES, JSON.stringify(res, null, 1))
} catch (e) { log._resumen = String(e.message) }
writeFileSync(here('../fuentes/vivienda-log.json'), JSON.stringify(log, null, 1))
console.log('Vivienda:', Object.entries(log).filter(([, v]) => String(v).startsWith('ERROR')).map(([k]) => k).join(', ') || 'todo bien')
