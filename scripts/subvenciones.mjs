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
const PARALELO = 6
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
// Temas con más detalle que la «finalidad» oficial: se buscan palabras en el título de la convocatoria.
// Gana el primero que encaja; es una aproximación y así se explica en la web.
const VERSION = 2
const TEMAS = [
  ['Coche eléctrico y recarga', /\bmoves\b|veh[ií]culos? (el[eé]ctric|de energ[ií]as alternativas)|movilidad el[eé]ctrica|puntos? de recarga|infraestructura de recarga/],
  ['Billetes y transporte de residentes', /transporte a[eé]reo|transporte mar[ií]timo|residentes en (canarias|baleares|illes|ceuta|melilla)|bonificaci[oó]n.*transporte|abono (transporte|[uú]nico)|descuento.*(billete|transporte)/],
  ['Rehabilitación y eficiencia energética', /rehabilitaci[oó]n|eficiencia energ[eé]tica|\bpree\b|envolvente t[eé]rmica|ahorro energ[eé]tico|edificios? (de consumo|sostenible)/],
  ['Renovables y autoconsumo', /autoconsumo|renovable|repotenciaci|fotovolt|almacenamiento (energ|detr)|hidr[oó]geno|biog[aá]s|biomasa|geot[eé]rmi|aerotermia|bombas? de calor/],
  ['Vivienda y alquiler', /alquiler|bono (alquiler )?joven|vivienda|desahucio/],
  ['Campo: PAC, ganadería y pesca', /\bpac\b|pepac|pagos directos|intervenciones? sectorial|agrari|agr[ií]col|ganad|agricult|pesca|acuicult|pesquer|desarrollo rural|leader|forestal|feader|feaga|femp|olivar|vi[ñn]edo|apicult|cosecha|regad[ií]o|cooperativas agro/],
  ['Cine y audiovisual', /cine|cinematogr|audiovisual|largometraje|cortometraje|\bicaa\b|rodaje|series de (televisi|ficci)|videojueg|animaci[oó]n/],
  ['Cultura, libros y artes', /cultur|libro|editorial|museo|teatro|m[uú]sica|artes esc[eé]nicas|patrimonio hist|festival|danza|exposici[oó]n|bibliotec|lectura|artist/],
  ['Deporte', /deport|federaci[oó]n|\bclub\b|competici[oó]n|olimp/],
  ['Universidades', /universi|\bull\b|\bulpgc\b|\buned\b/],
  ['Becas y estudios', /\bbecas?\b|estudiante|alumn|matr[ií]cula|comedor escolar|libros de texto|material escolar|transporte escolar|ense[ñn]anza|centros? (docentes|educativ)|educaci[oó]n|escuela infantil|guarder[ií]a|0.?3 a[ñn]os/],
  ['Investigación e innovación', /investigaci[oó]n|i\+d|innovaci[oó]n|ram[oó]n y cajal|doctora|cient[ií]fic|tecnol[oó]gic|proyectos? de generaci[oó]n de conocimiento|transferencia de conocimiento/],
  ['Digitalización', /kit digital|digitaliz|ciberseguridad|conectividad|banda ancha|transformaci[oó]n digital|\b5g\b/],
  ['Empleo y contratación', /empleo|contrataci[oó]n|trabajador(es|as)? aut[oó]nom|\baut[oó]nom[oa]s\b|cuota cero|tarifa plana|emprend|inserci[oó]n|formaci[oó]n (profesional|para el empleo)|desemplead|personas trabajadoras|centros especiales de empleo/],
  ['Turismo y hostelería', /turis|hoster|camino de santiago|xacobeo/],
  ['Industria, comercio y empresas', /industri|incentivos regionales|pyme|empresa|internacionaliz|exportaci|comercio|competitiv|artesan|perte|cadena de valor|reindustri|aceleraci[oó]n/],
  ['Servicios sociales y cooperación', /social|natalidad|nacimiento|dependencia|discapacid|personas mayores|inclusi[oó]n|vulnerab|pobreza|familias?|infancia|menores|mujer|igualdad|violencia de g[eé]nero|cooperaci[oó]n (internacional|al desarrollo)|refugi|humanitari|emergencia|exclusi[oó]n|sin hogar|ingreso m[ií]nimo|renta (m[ií]nima|de inserci)/],
  ['Sanidad', /sanid|salud|sanitari|hospital|m[eé]dic|farmac|enfermedad|adicci|drogodependen/],
  ['Medio ambiente, agua y clima', /medio ?ambient|residuo|reciclaj|econom[ií]a circular|agua|depuraci|biodiversidad|incendio|cambio clim[aá]tico|descarboniz|espacios naturales|reforestaci/],
  ['Ayuntamientos y obras', /ayuntamientos?|cooperaci[oó]n local|plan abierto de inversiones|entidades locales|municipi|corporaciones locales|obras|infraestructura|plan (de cooperaci[oó]n|provincial)|diputaci[oó]n|cabildo|financiaci[oó]n auton[oó]mica|ciudad de ceuta|ciudad de melilla|real decreto-ley/],
  ['Asociaciones, fiestas y entidades', /asociaci[oó]n|vecinal|vecinos|fiesta|pe[ñn]a|cofrad|entidades sin [aá]nimo|fundaci[oó]n|juventud|j[oó]venes|tercer sector|voluntariado/],
]
const temaCache = new Map()
function tema(id, titulo) {
  if (temaCache.has(id)) return temaCache.get(id)
  const t = String(titulo ?? '').toLowerCase().normalize('NFC')
  const r = (TEMAS.find(([, re]) => re.test(t)) ?? ['Otros'])[0]
  temaCache.set(id, r); return r
}
const suma = (o, k, imp) => { const v = (o[k] ??= [0, 0]); v[0]++; v[1] += imp }

async function mes(y, m, finalidades) {
  const ag = { n: 0, imp: 0, adm: {}, fin: {}, tipo: {}, inst: {}, org: {}, ben: {}, conv: {}, tema: {} }
  const tot = await get(url(y, m, '', 0, 1))
  ag.total = tot.totalElements
  const ben = {}, conv = {}, vistos = new Set()
  const dia = (d) => `&fechaDesde=${dd(y, m, d)}&fechaHasta=${dd(y, m, d)}`
  const pide = (f, d, page) => `${B}/concesiones/busqueda?vpd=GE&page=${page}&pageSize=${PAG}&${ORDEN}${dia(d)}&finalidad=${f.id}`
  const suma1 = (r, f) => {
    if (vistos.has(r.id)) { ag.dup = (ag.dup ?? 0) + 1; return }
    vistos.add(r.id)
    const imp = Number(r.importe) || 0
    ag.n++; ag.imp += imp
    suma(ag.adm, ADM[r.nivel1] ?? 'O', imp)
    suma(ag.fin, f.id, imp)
    suma(ag.tema, tema(r.idConvocatoria, r.convocatoria), imp)
    const [tp, nif, nombre] = tipoNif(r.beneficiario)
    suma(ag.tipo, tp, imp)
    suma(ag.inst, String(r.instrumento ?? '').trim().toUpperCase() || '—', imp)
    suma(ag.org, `${ADM[r.nivel1] ?? 'O'}|${r.nivel2 ?? ''}`, imp)
    if (nif) { const b = (ben[nif] ??= [0, 0, nombre]); b[0]++; b[1] += imp }
    const k = r.idConvocatoria
    if (k != null) { const v = (conv[k] ??= [0, 0, r.convocatoria ?? '', ADM[r.nivel1] ?? 'O', r.nivel2 ?? '', f.id, 0]); v[0]++; v[1] += imp; if (!nif) v[6] += imp }
  }
  // Día a día y finalidad a finalidad: casi todo cabe en una página, y las páginas se piden de varias en varias
  const cola = []
  for (let d = 1; d <= diasMes(y, m); d++) for (const f of finalidades) cola.push([f, d, 0])
  const trabajador = async () => {
    while (cola.length) {
      const [f, d, page] = cola.shift()
      const j = await get(pide(f, d, page))
      const c = j.content ?? []
      for (const r of c) suma1(r, f)
      if (page === 0) for (let p = 1; p * PAG < (j.totalElements ?? 0); p++) cola.push([f, d, p])
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  // Solo lo grande pasa al estado, para que el archivo no crezca sin control
  for (const [k, v] of Object.entries(ben)) if (v[1] >= 250000) ag.ben[k] = [v[0], Math.round(v[1]), v[2]]
  for (const [k, v] of Object.entries(conv)) if (v[1] >= 1e6 && !(v[0] === 1 && v[6] > 0)) ag.conv[k] = [v[0], Math.round(v[1]), v[2].slice(0, 220), v[3], v[4], v[5]]
  for (const [k, v] of Object.entries(ag.org)) if (v[1] < 100000 && !k.startsWith('E|') && !k.startsWith('A|')) delete ag.org[k]
  for (const o of [ag.adm, ag.fin, ag.tipo, ag.inst, ag.org, ag.tema]) for (const v of Object.values(o)) v[1] = Math.round(v[1])
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
// Si cambia lo que se guarda de cada mes (versión), los meses viejos se vuelven a bajar poco a poco
if (estado.version !== VERSION) { for (const v of Object.values(estado.meses)) v.viejo = true; estado.version = VERSION }

// Orden: el mes en curso y los dos anteriores siempre (llegan concesiones con retraso); luego los que falten, del más reciente hacia atrás.
const hoy = new Date(), lista = []
for (let d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)); d.toISOString().slice(0, 7) >= INICIO; d.setUTCMonth(d.getUTCMonth() - 1)) lista.push(d.toISOString().slice(0, 7))
const reciente = (k) => estado.meses[k] && Date.now() - Date.parse(estado.meses[k].hecho) < 20 * 3600e3
const cola = [...lista.slice(0, 3).filter(k => !reciente(k) || estado.meses[k]?.viejo), ...lista.slice(3).filter(k => !estado.meses[k] || estado.meses[k].viejo)]
for (const k of cola) {
  if (k === undefined) continue
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
  const r = { n: 0, imp: 0, adm: {}, fin: {}, tipo: {}, inst: {}, org: {}, ben: {}, conv: {}, tema: {} }
  for (const k of ks) {
    const a = estado.meses[k]; r.n += a.n; r.imp += a.imp
    for (const c of ['adm', 'fin', 'tipo', 'inst', 'org', 'tema']) for (const [x, v] of Object.entries(a[c] ?? {})) { const t = (r[c][x] ??= [0, 0]); t[0] += v[0]; t[1] += v[1] }
    for (const [x, v] of Object.entries(a.ben)) { const t = (r.ben[x] ??= [0, 0, v[2]]); t[0] += v[0]; t[1] += v[1] }
    for (const [x, v] of Object.entries(a.conv)) { const t = (r.conv[x] ??= [0, 0, ...v.slice(2)]); t[0] += v[0]; t[1] += v[1] }
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1][1] - a[1][1]).slice(0, n)
  r.ben = top(r.ben, 60).map(([nif, v]) => [nif, ...v])
  r.conv = top(r.conv, 60).map(([id, v]) => [id, ...v, tema(id, v[2])])
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
