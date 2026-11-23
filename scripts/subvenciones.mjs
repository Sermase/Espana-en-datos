// Subvenciones: concesiones de la Base de Datos Nacional de Subvenciones (BDNS, infosubvenciones.es), sumadas por mes.
// Se descarga mes a mes y por finalidad (la API no da la finalidad en cada concesión, así que se pide una a una).
// Nunca se guardan nombres de personas físicas: solo cuentan en los totales.
// Estado: public/subvenciones/data/meses.json (agregados por mes). Página: public/subvenciones/data/subvenciones.json.
// Uso: PRESUPUESTO_MIN=40 node scripts/subvenciones.mjs   (Node 20+, sin dependencias)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const DIR = here('../public/subvenciones/data/')
const ESTADO = DIR + 'meses.json', OUT = DIR + 'subvenciones.json'
const B = 'https://www.infosubvenciones.es/bdnstrans/api'
const INICIO = '2024-01'
const PAG = 10000
const FIN = Date.now() + Number(process.env.PRESUPUESTO_MIN ?? 40) * 60000
const log = { meses: {} }
let ORDEN = 'order=id&direccion=asc'
const espera = (ms) => new Promise(s => setTimeout(s, ms))

async function get(url) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'espana-en-datos (GitHub Actions)' } })
      const t = await r.text()
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 160))
      return JSON.parse(t)
    } catch (e) { if (i === 4) throw e; await espera(5000 * (i + 1)) }
  }
}
const dd = (y, m, d) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
const diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const url = (y, m, extra, page, size = PAG) => `${B}/concesiones/busqueda?vpd=GE&page=${page}&pageSize=${size}&${ORDEN}&fechaDesde=${dd(y, m, 1)}&fechaHasta=${dd(y, m, diasMes(y, m))}${extra}`

// Tipo de beneficiario por la letra del NIF. Las personas físicas (DNI, NIE o enmascaradas con ***) solo suman.
const LETRAS = 'ABCDEFGHJNPQRSUVW'
function tipoNif(benef) {
  const t = String(benef ?? '').trim()
  if (t.startsWith('*')) return ['PF']
  const id = t.split(/\s+/)[0] ?? ''
  if (/^\d{8}[A-Z]$/.test(id) || /^[XYZKLM]\d{7}[A-Z]$/.test(id)) return ['PF']
  if (new RegExp(`^[${LETRAS}]\\d{7}[0-9A-J]$`).test(id)) return [id[0], id, t.slice(id.length).replace(/^[\s-]+/, '').trim()]
  return ['X']
}
const ADM = { ESTADO: 'E', AUTONOMICA: 'A', LOCAL: 'L', OTROS: 'O' }
const suma = (o, k, imp) => { const v = (o[k] ??= [0, 0]); v[0]++; v[1] += imp }

async function mes(y, m, finalidades) {
  const ag = { n: 0, imp: 0, adm: {}, fin: {}, tipo: {}, inst: {}, org: {}, ben: {}, conv: {} }
  const tot = await get(url(y, m, '', 0, 1))
  ag.total = tot.totalElements
  const ben = {}, conv = {}
  for (const f of finalidades) {
    let page = 0, vistos = 0, total = Infinity
    while (vistos < total) {
      const j = await get(url(y, m, `&finalidad=${f.id}`, page))
      total = j.totalElements ?? 0
      const c = j.content ?? []
      if (!c.length) break
      for (const r of c) {
        const imp = Number(r.importe) || 0
        ag.n++; ag.imp += imp
        suma(ag.adm, ADM[r.nivel1] ?? 'O', imp)
        suma(ag.fin, f.id, imp)
        const [tp, nif, nombre] = tipoNif(r.beneficiario)
        suma(ag.tipo, tp, imp)
        suma(ag.inst, String(r.instrumento ?? '').trim().toUpperCase() || '—', imp)
        suma(ag.org, `${ADM[r.nivel1] ?? 'O'}|${r.nivel2 ?? ''}`, imp)
        if (nif) { const b = (ben[nif] ??= [0, 0, nombre]); b[0]++; b[1] += imp }
        const k = r.idConvocatoria
        if (k != null) { const v = (conv[k] ??= [0, 0, r.convocatoria ?? '', ADM[r.nivel1] ?? 'O', r.nivel2 ?? '', f.id, 0]); v[0]++; v[1] += imp; if (!nif) v[6] += imp }
      }
      vistos += c.length; page++
    }
  }
  // Solo lo grande pasa al estado, para que el archivo no crezca sin control
  for (const [k, v] of Object.entries(ben)) if (v[1] >= 250000) ag.ben[k] = [v[0], Math.round(v[1]), v[2]]
  for (const [k, v] of Object.entries(conv)) if (v[1] >= 1e6 && !(v[0] === 1 && v[6] > 0)) ag.conv[k] = [v[0], Math.round(v[1]), v[2].slice(0, 220), v[3], v[4], v[5]]
  for (const [k, v] of Object.entries(ag.org)) if (v[1] < 100000 && !k.startsWith('E|') && !k.startsWith('A|')) delete ag.org[k]
  for (const o of [ag.adm, ag.fin, ag.tipo, ag.inst, ag.org]) for (const v of Object.values(o)) v[1] = Math.round(v[1])
  ag.imp = Math.round(ag.imp)
  ag.hecho = new Date().toISOString()
  return ag
}

mkdirSync(DIR, { recursive: true })
let estado = { meses: {} }; try { estado = JSON.parse(readFileSync(ESTADO, 'utf8')) } catch {}
const finalidades = await get(`${B}/finalidades?vpd=GE`)
// Paginar con un orden estable (por id); si la API no lo acepta, por fecha de concesión
try { await get(url(2025, 1, '', 0, 1)) } catch { ORDEN = 'order=fechaConcesion&direccion=asc'; log.orden = ORDEN }
estado.finalidades = Object.fromEntries(finalidades.map(f => [f.id, f.descripcion]))

// Orden: el mes en curso y los dos anteriores siempre (llegan concesiones con retraso); luego los que falten, del más reciente hacia atrás.
const hoy = new Date(), lista = []
for (let d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)); d.toISOString().slice(0, 7) >= INICIO; d.setUTCMonth(d.getUTCMonth() - 1)) lista.push(d.toISOString().slice(0, 7))
const cola = [...lista.slice(0, 3), ...lista.slice(3).filter(k => !estado.meses[k])]
for (const k of cola) {
  if (Date.now() > FIN) { log.parada = 'presupuesto de tiempo agotado antes de ' + k; break }
  const t0 = Date.now()
  try {
    const ag = await mes(+k.slice(0, 4), +k.slice(5), finalidades)
    estado.meses[k] = ag
    log.meses[k] = `${ag.n} de ${ag.total} concesiones (${((ag.n / (ag.total || 1)) * 100).toFixed(1)} %), ${(ag.imp / 1e6).toFixed(0)} M€, ${((Date.now() - t0) / 1000).toFixed(0)} s`
    writeFileSync(ESTADO, JSON.stringify(estado))
  } catch (e) { log.meses[k] = 'ERROR ' + String(e.message).slice(0, 200) }
}

// Página: serie mensual y agregados por año (y de los últimos 12 meses completos)
const meses = Object.keys(estado.meses).sort()
const completo = (k) => k < hoy.toISOString().slice(0, 7)
const juntar = (ks) => {
  const r = { n: 0, imp: 0, adm: {}, fin: {}, tipo: {}, inst: {}, org: {}, ben: {}, conv: {} }
  for (const k of ks) {
    const a = estado.meses[k]; r.n += a.n; r.imp += a.imp
    for (const c of ['adm', 'fin', 'tipo', 'inst', 'org']) for (const [x, v] of Object.entries(a[c])) { const t = (r[c][x] ??= [0, 0]); t[0] += v[0]; t[1] += v[1] }
    for (const [x, v] of Object.entries(a.ben)) { const t = (r.ben[x] ??= [0, 0, v[2]]); t[0] += v[0]; t[1] += v[1] }
    for (const [x, v] of Object.entries(a.conv)) { const t = (r.conv[x] ??= [0, 0, ...v.slice(2)]); t[0] += v[0]; t[1] += v[1] }
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1][1] - a[1][1]).slice(0, n)
  r.ben = top(r.ben, 60).map(([nif, v]) => [nif, ...v])
  r.conv = top(r.conv, 40).map(([id, v]) => [id, ...v])
  const org = Object.entries(r.org)
  r.org = Object.fromEntries([...org.filter(([k]) => k.startsWith('A|') || k.startsWith('E|')), ...org.filter(([k]) => k.startsWith('L|') || k.startsWith('O|')).sort((a, b) => b[1][1] - a[1][1]).slice(0, 60)])
  r.meses = ks
  return r
}
const anios = {}
for (const k of meses) (anios[k.slice(0, 4)] ??= []).push(k)
const comp = meses.filter(completo)
const out = {
  fecha: hoy.toISOString().slice(0, 10), finalidades: estado.finalidades,
  serie: meses.map(k => { const a = estado.meses[k]; return [k, a.n, a.imp, a.adm.E?.[1] ?? 0, a.adm.A?.[1] ?? 0, a.adm.L?.[1] ?? 0, a.adm.O?.[1] ?? 0, a.total] }),
  años: Object.fromEntries(Object.entries(anios).map(([y, ks]) => [y, juntar(ks)])),
  u12: comp.length >= 12 ? juntar(comp.slice(-12)) : null,
}
writeFileSync(OUT, JSON.stringify(out))
try {
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  if (out.u12) res.subvenciones = { hasta: out.u12.meses.at(-1), n: out.u12.n, imp: out.u12.imp }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log._resumen = String(e.message) }
writeFileSync(here('../fuentes/subvenciones-log.json'), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log, null, 1))
