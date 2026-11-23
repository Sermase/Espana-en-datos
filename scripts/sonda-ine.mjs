// Inventario de tablas del INE para el tema Población: guarda fuentes/ine.json con id y nombre.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const API = 'https://servicios.ine.es/wstempus/js/ES'
const out = { fecha: new Date().toISOString(), ops: {}, pruebas: {} }
const j = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() }
try {
  const ops = await j(`${API}/OPERACIONES_DISPONIBLES`)
  out.operaciones = ops.filter(o => /poblaci|padr|nacim|defunc|migrac|demogr|nomencl|censo|matrimon|vida|hogar|extranj/i.test(o.Nombre)).map(o => ({ Id: o.Id, Codigo: o.Codigo, Nombre: o.Nombre }))
  for (const o of out.operaciones) {
    try { out.ops[o.Codigo || o.Id] = (await j(`${API}/TABLAS_OPERACION/${o.Id}`)).map(t => [t.Id, t.Nombre, t.Anyo_Periodo_ini, t.FechaRef_fin]) } catch (e) { out.ops[o.Codigo || o.Id] = String(e.message) }
  }
} catch (e) { out.error = String(e.message) }
for (const [k, u] of Object.entries({
  csv29005: 'https://www.ine.es/jaxiT3/files/t/es/csv_bd/29005.csv',
  js29005: `${API}/DATOS_TABLA/29005?nult=1&tip=A`,
})) {
  try { const r = await fetch(u); const t = await r.text(); out.pruebas[k] = { status: r.status, bytes: t.length, inicio: t.slice(0, 1200) } } catch (e) { out.pruebas[k] = String(e.message) }
}
writeFileSync(fileURLToPath(new URL('../fuentes/ine.json', import.meta.url)), JSON.stringify(out, null, 1))
console.log('INE:', out.operaciones?.length, 'operaciones', Object.values(out.ops).reduce((t, v) => t + (Array.isArray(v) ? v.length : 0), 0), 'tablas')
