// Igualdad: brecha salarial (Encuesta Anual de Estructura Salarial del INE y Eurostat), techo de cristal (mujeres por
// ocupación y en las instituciones), y desigualdades por edad y origen (empleo, paro, pobreza), con datos de Eurostat.
// Escribe public/igualdad/data/igualdad.json, resumen.igualdad y fuentes/igualdad-log.json (forma de cada tabla).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const OUT = here('../public/igualdad/data'); mkdirSync(OUT, { recursive: true })
const log = { avisos: [] }
const espera = (ms) => new Promise(s => setTimeout(s, ms))
const INE = 'https://servicios.ine.es/wstempus/js/ES', EST = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
async function get(url) {
  for (let i = 0; i < 3; i++) {
    await espera(400)
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (espana-en-datos; GitHub Actions)' }, signal: AbortSignal.timeout(120e3) }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json() }
    catch (e) { if (i === 2) throw new Error(`${url.slice(0, 160)}: ${e.message}`); await espera(3000 * (i + 1)) }
  }
}
const datos = { fecha: new Date().toISOString().slice(0, 10), ine: {}, est: {} }

// 1. INE, Encuesta Anual de Estructura Salarial: ganancia media anual por trabajador. Se guarda cada serie con su nombre
//    partido en trozos; la página escoge (sexo, edad, nacionalidad, ocupación, comunidad, jornada, contrato…).
const TABLAS = { edad: 28189, nacionalidad: 28190, ocupacion: 28186, actividad: 28185, ccaa: 28191, jornada: 28187, contrato: 28188, desigualdad: 28184, smi: 28182 }
for (const [k, id] of Object.entries(TABLAS)) {
  try {
    const j = await get(`${INE}/DATOS_TABLA/${id}?nult=20`)
    datos.ine[k] = j.map(s => ({ p: s.Nombre.split('. ').map(x => x.replace(/\.\s*$/, '').trim()).filter(Boolean), d: Object.fromEntries((s.Data ?? []).filter(x => x.Valor != null).map(x => [x.Anyo, x.Valor])) }))
    log[k] = { series: j.length, muestra: j.slice(0, 8).map(s => s.Nombre) }
  } catch (e) { log.avisos.push(`INE ${k}: ${e.message}`) }
}

// 2. Eurostat: cada conjunto se guarda como series con clave «dim1|dim2|…» (sin la frecuencia ni el tiempo)
const PAISES = ['ES', 'EU27_2020', 'DE', 'FR', 'IT', 'PT', 'SE', 'NL']
const pa = (gs = PAISES) => gs.map(g => 'geo=' + g).join('&')
async function eurostat(clave, ds, q) {
  try {
    const j = await get(`${EST}${ds}?format=JSON&lang=en&${q}`)
    const ids = j.id, size = j.size, inv = ids.map(d => Object.fromEntries(Object.entries(j.dimension[d].category.index).map(([k, v]) => [v, k])))
    const dims = ids.filter(d => d !== 'freq' && d !== 'time'), series = {}
    for (const [pos, val] of Object.entries(j.value)) {
      let p = +pos; const c = {}
      for (let k = ids.length - 1; k >= 0; k--) { c[ids[k]] = inv[k][p % size[k]]; p = Math.floor(p / size[k]) }
      ;(series[dims.map(d => c[d]).join('|')] ??= {})[c.time] = val
    }
    datos.est[clave] = { dims, series, labels: Object.fromEntries(dims.filter(d => d !== 'geo').map(d => [d, j.dimension[d].category.label])) }
    log[clave] = { ds, dims, series: Object.keys(series).length, años: [...new Set(Object.values(series).flatMap(Object.keys))].sort().slice(-3) }
  } catch (e) { log.avisos.push(`Eurostat ${clave}: ${e.message}`) }
}
await eurostat('brecha', 'sdg_05_20', `${pa()}&sinceTimePeriod=2006`)
await eurostat('brechaEdad', 'earn_gr_gpgr2ag', 'geo=ES&geo=EU27_2020&unit=PC&nace_r2=B-S_X_O')
await eurostat('brechaPension', 'ilc_pnp13', `${pa()}&unit=PC&age=Y_GE65&sinceTimePeriod=2010`)
await eurostat('ocupacion', 'lfsa_egais', 'geo=ES&geo=EU27_2020&unit=THS_PER&age=Y15-74&wstatus=EMP&sex=F&sex=T&sinceTimePeriod=2011')
await eurostat('empleo', 'lfsi_emp_a', `${pa()}&indic_em=EMP_LFS&unit=PC_POP&age=Y20-64&sex=F&sex=M&sinceTimePeriod=2006`)
await eurostat('parcial', 'lfsa_eppga', 'geo=ES&geo=EU27_2020&unit=PC&age=Y20-64&sex=F&sex=M&sinceTimePeriod=2006')
await eurostat('paro', 'une_rt_a', 'geo=ES&geo=EU27_2020&unit=PC_ACT&age=Y15-24&age=Y25-74&age=Y15-74&sex=F&sex=M&sex=T&sinceTimePeriod=2006')
await eurostat('paroOrigen', 'lfsa_urgan', 'geo=ES&geo=EU27_2020&unit=PC&age=Y15-64&sex=T&citizen=NAT&citizen=EU27_2020_FOR&citizen=NEU27_2020_FOR&sinceTimePeriod=2008')
await eurostat('pobreza', 'ilc_li02', 'geo=ES&geo=EU27_2020&unit=PC&rskpovth=B_60&sex=F&sex=M&sex=T&age=TOTAL&age=Y_LT18&age=Y18-64&age=Y_GE65&sinceTimePeriod=2008')
await eurostat('pobrezaOrigen', 'ilc_li31', 'geo=ES&geo=EU27_2020&unit=PC&sex=T&age=Y_GE18&citizen=NAT&citizen=EU27_2020_FOR&citizen=NEU27_2020_FOR&sinceTimePeriod=2008')
await eurostat('gini', 'ilc_di12', `${pa()}&age=TOTAL&sinceTimePeriod=2008`)
await eurostat('parlamento', 'sdg_05_50', `${pa()}&sinceTimePeriod=2008`)
await eurostat('directivas', 'sdg_05_60', `${pa()}&sinceTimePeriod=2008`)

// 3. Violencia contra las mujeres
// 3a. Víctimas mortales por violencia de género (Delegación del Gobierno): una ficha en PDF por año desde 2003
const { execFileSync } = await import('node:child_process')
const sh = (c) => execFileSync('bash', ['-c', c], { encoding: 'utf8', maxBuffer: 64e6 })
datos.violencia = { mortales: {} }
try {
  const base = 'https://violenciagenero.igualdad.gob.es'
  const h = sh(`curl -sSL --max-time 60 -A 'Mozilla/5.0' '${base}/fichaMujeres/home.htm'`)
  const pdfs = [...new Set([...h.matchAll(/href="([^"]+\.pdf)"/gi)].map(m => m[1]))].map(u => u.startsWith('http') ? u : base + (u.startsWith('/') ? '' : '/') + u)
  log.fichas = pdfs.slice(0, 40)
  mkdirSync('/tmp/fichas', { recursive: true })
  for (const u of pdfs) {
    const año = (u.match(/(20\d\d)/g) ?? []).map(Number).find(y => y >= 2003 && y <= 2030); if (!año || datos.violencia.mortales[año]) continue
    try {
      sh(`curl -sSL --max-time 60 -A 'Mozilla/5.0' -o /tmp/fichas/${año}.pdf '${u}'`)
      const t = sh(`pdftotext -layout /tmp/fichas/${año}.pdf - 2>/dev/null`)
      datos.violencia.mortales[año] = { texto: t.slice(0, 20000) } // se interpreta abajo; el texto se borra antes de guardar
      if (!log.fichaMuestra) log.fichaMuestra = t.slice(0, 9000)
    } catch (e) { log.avisos.push(`ficha ${año}: ${String(e.message).slice(-120)}`) }
  }
} catch (e) { log.avisos.push('víctimas mortales: ' + String(e.message).slice(-200)) }
// 3b. INE, Estadística de Violencia Doméstica y Violencia de Género (víctimas con orden de protección)
try {
  const ops = await get(`${INE}/OPERACIONES_DISPONIBLES`)
  const op = ops.find(o => /violencia dom.stica y violencia de g.nero/i.test(o.Nombre))
  log.evdvg = op ? [op.Id, op.Codigo, op.Nombre] : 'no encontrada'
  if (op) {
    const tablas = await get(`${INE}/TABLAS_OPERACION/${op.Id}`)
    log.evdvgTablas = tablas.map(t => `${t.Id} · ${t.Nombre}`)
    datos.ine.violencia = {}
    for (const t of tablas.filter(t => /v[ií]ctimas/i.test(t.Nombre)).slice(0, 14)) {
      try {
        const j = await get(`${INE}/DATOS_TABLA/${t.Id}?nult=15`)
        datos.ine.violencia[t.Id] = { n: t.Nombre, s: j.map(s => ({ p: s.Nombre.split('. ').map(x => x.replace(/\.\s*$/, '').trim()).filter(Boolean), d: Object.fromEntries((s.Data ?? []).filter(x => x.Valor != null).map(x => [x.Anyo, x.Valor])) })) }
        log['evdvg' + t.Id] = j.slice(0, 6).map(s => s.Nombre)
      } catch (e) { log.avisos.push(`EVDVG ${t.Id}: ${e.message}`) }
    }
  }
} catch (e) { log.avisos.push('EVDVG: ' + e.message) }
// 3c. Eurostat: víctimas de homicidio por sexo y relación con el agresor
await eurostat('homicidios', 'crim_hom_vrel', `${pa()}&sinceTimePeriod=2008`)
// 3d. Delitos contra la libertad sexual (Ministerio del Interior), de la descarga de Seguridad
try {
  const sg = JSON.parse(readFileSync(here('../public/seguridad/data/seguridad.json'), 'utf8'))
  log.seguridadTipos = Object.entries(sg.tipos ?? {}).map(([k, v]) => `${k}=${v.n ?? v}`).slice(0, 60)
  datos.violencia.sexual = { años: sg.años, tipos: Object.fromEntries(Object.entries(sg.tipos ?? {}).filter(([, v]) => /sexual|violaci|agresi.n sexual|abuso/i.test(v.n ?? v))), prov: Object.fromEntries(Object.entries(sg.prov ?? {}).map(([p, o]) => [p, Object.fromEntries(Object.entries(o).filter(([k]) => /^s3/.test(k)))])), pob: sg.pob }
} catch (e) { log.avisos.push('sexual: ' + e.message) }

// interpretar las fichas: total, edad, país de nacimiento, denuncias previas y comunidad
for (const [a, o] of Object.entries(datos.violencia.mortales)) {
  const t = o.texto; delete o.texto
  const num = (re) => { const m = t.match(re); return m ? Number(m[1]) : null }
  o.total = num(/TOTAL\s+v[ií]ctimas por violencia de g[ée]nero\s+(\d+)/i) ?? num(/Total V[ÍI]CTIMAS\s+(\d+)/i) ?? num(/TOTAL\s+(\d+)\s+100[.,]0/)
  o.sinDenuncia = num(/Sin denuncias? previas?\s+(\d+)/i)
  o.conDenuncia = num(/Con una o m[aá]s denuncias previas\s+(\d+)/i) ?? num(/Hab[ií]an denunciado\s+(\d+)/i)
  const pais = t.match(/Espa[ñn]a\s+(\d+)\s+[\d.,]+\s+(\d+)[\s\S]{0,80}?Otro pa[ií]s\s+(\d+)\s+[\d.,]+\s+(\d+)/)
  if (pais) o.pais = { victimaEsp: +pais[1], agresorEsp: +pais[2], victimaOtro: +pais[3], agresorOtro: +pais[4] }
  const edades = {}
  for (const m of t.matchAll(/^\s*(Menos de \d+|Menor de \d+|De? ?\d+\s*(?:a|-)\s*\d+(?: años)?|\d+\s*-\s*\d+|\d+ (?:y|o) m[aá]s(?: años)?|M[aá]s de \d+(?: años)?)\s+(\d+)\s+[\d.,]+\s+(\d+)/gim)) edades[m[1].replace(/\s+/g, ' ')] = [+m[2], +m[3]]
  if (Object.keys(edades).length) o.edad = edades
  const ccaa = {}
  for (const m of t.matchAll(/^\s*(Andaluc[ií]a|Arag[oó]n|Asturias[^\d\n]*|Balears[^\d\n]*|Illes Balears|Canarias|Cantabria|Castilla y Le[oó]n|Castilla[- ]La Mancha|Catalu[ñn]a|Comunitat Valenciana|Comunidad Valenciana|Extremadura|Galicia|Madrid[^\d\n]*|Comunidad de Madrid|Murcia[^\d\n]*|Regi[oó]n de Murcia|Navarra[^\d\n]*|Comunidad Foral de Navarra|Pa[ií]s Vasco|La Rioja|Rioja[^\d\n]*|Ceuta|Melilla)\s+(\d+)\s+[\d.,]+/gim)) ccaa[m[1].trim()] = +m[2]
  if (Object.keys(ccaa).length) o.ccaa = ccaa
}
log.mortales = Object.fromEntries(Object.entries(datos.violencia.mortales).map(([a, o]) => [a, JSON.stringify(o).slice(0, 300)]))

writeFileSync(`${OUT}/igualdad.json`, JSON.stringify(datos))
try {
  const s = datos.est.brecha?.series ?? {}, k = Object.keys(s).find(x => x.split('|').includes('ES')), o = k ? s[k] : {}, a = Object.keys(o).sort().at(-1)
  const RES = here('../src/resumen.json'), res = JSON.parse(readFileSync(RES, 'utf8'))
  res.igualdad = { año: a, brecha: a ? o[a] : null, ue: a ? Object.entries(s).find(([x]) => x.split('|').includes('EU27_2020'))?.[1]?.[a] ?? null : null }
  writeFileSync(RES, JSON.stringify(res, null, 1) + '\n')
} catch (e) { log.avisos.push('resumen: ' + e.message) }
mkdirSync(here('../fuentes'), { recursive: true })
writeFileSync(here('../fuentes/igualdad-log.json'), JSON.stringify(log, null, 1))
console.log('Igualdad:', Object.keys(datos.ine).length, 'tablas INE,', Object.keys(datos.est).length, 'de Eurostat;', log.avisos.length, 'avisos')
