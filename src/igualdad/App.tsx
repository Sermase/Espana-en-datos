import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Baby, Building2, Globe2, HeartCrack, Scale } from 'lucide-react'
import { Barras, LineChart, nf } from '../graficos'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { Cien, EdificioCristal, Memorial, Monedas, Pesas, RelojBrecha, type Piso } from './Animados'

const ACC = '#c98cff', MUJ = '#c98cff', HOM = '#5fb8ff'
type Ser = { p: string[]; d: Record<string, number> }
type Est = { dims: string[]; series: Record<string, Record<string, number>>; labels: Record<string, Record<string, string>> }
type Ficha = { total?: number; sinDenuncia?: number; conDenuncia?: number; pais?: { victimaEsp: number; victimaOtro: number; agresorEsp: number; agresorOtro: number }; edad?: Record<string, [number, number]>; ccaa?: Record<string, number>; huerfanos?: number; totalHistorico?: number; pareja?: number; expareja?: number }
type D = { fecha: string; ine: Record<string, Ser[]> & { violencia?: Record<string, { n: string; s: Ser[] }> }; est: Record<string, Est>; violencia?: { mortales: Record<string, Ficha>; sexual?: { años: number[]; tipos: Record<string, { k: string; n: string }>; prov: Record<string, Record<string, number[]>> } } }
const SECCIONES = [
  { id: 'brecha', nombre: 'Brecha salarial', icon: Scale },
  { id: 'violencia', nombre: 'Violencia', icon: HeartCrack },
  { id: 'techo', nombre: 'Techo de cristal', icon: Building2 },
  { id: 'edad', nombre: 'Edad', icon: Baby },
  { id: 'origen', nombre: 'Origen y renta', icon: Globe2 },
] as const
type Sec = (typeof SECCIONES)[number]['id']
const eur = (v: number) => `${nf(v, 0)} €`
const PAIS: Record<string, string> = { ES: 'España', EU27_2020: 'UE', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal', SE: 'Suecia', NL: 'Países Bajos' }

/** Serie del INE cuyo nombre tiene todos los trozos pedidos (y es el dato base). */
const ine = (t: Ser[] | undefined, ...trozos: string[]) => t?.find(s => trozos.every(x => s.p.includes(x)) && !s.p.some(x => /variaci/i.test(x)))?.d
const ultimo = (d?: Record<string, number>) => { const a = Object.keys(d ?? {}).sort().at(-1); return a ? { a: +a, v: Math.abs(d![a]) } : null }
/** Serie de Eurostat por sus valores de dimensión (en cualquier orden). */
const est = (e: Est | undefined, ...vals: string[]) => { if (!e) return undefined; const k = Object.keys(e.series).find(k => { const p = k.split('|'); return vals.every(v => p.includes(v)) }); return k ? e.series[k] : undefined }
const puntos = (o?: Record<string, number>) => Object.entries(o ?? {}).map(([a, v]) => [+a, v] as [number, number]).sort((a, b) => a[0] - b[0])
const ulA = (o?: Record<string, number>) => { const a = Object.keys(o ?? {}).sort().at(-1); return a ? [a, o![a]] as const : null }

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const EAES = <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177025&menu=ultiDatos&idp=1254735976596" target="_blank" rel="noopener noreferrer">INE, Encuesta Anual de Estructura Salarial</a>
const EUROSTAT = (code: string, n: string) => <a href={`https://ec.europa.eu/eurostat/databrowser/view/${code}/default/table`} target="_blank" rel="noopener noreferrer">Eurostat, {n}</a>

const OCUP: Record<string, string> = {
  'Directores y gerentes': 'Dirección y gerencia', 'Técnicos y profesionales científicos e intelectuales de la salud y la enseñanza': 'Profesionales de salud y enseñanza',
  'Otros técnicos y profesionales científicos e intelectuales': 'Otros profesionales', 'Técnicos; profesionales de apoyo': 'Técnicos de apoyo',
  'Empleados de oficina que no atienden al público': 'Oficina (sin público)', 'Empleados de oficina que atienden al público': 'Oficina (con público)',
  'Trabajadores de los servicios de restauración y comercio': 'Hostelería y comercio', 'Trabajadores de los servicios de salud y el cuidado de personas': 'Cuidados',
  'Trabajadores de los servicios de protección y seguridad': 'Seguridad', 'Trabajadores cualificados en el sector agrícola, ganadero, forestal y pesquero': 'Agricultura y pesca',
  'Trabajadores cualificados de la construcción, excepto operadores de máquinas': 'Construcción', 'Trabajadores cualificados de las industrias manufactureras, excepto operadores de instalaciones y máquinas': 'Oficios de la industria',
  'Operadores de instalaciones y maquinaria fijas, y montadores': 'Operadores de máquinas', 'Conductores y operadores de maquinaria móvil': 'Conductores',
  'Trabajadores no cualificados en servicios (excepto transportes)': 'Limpieza y servicios básicos', 'Peones de la agricultura, pesca, construcción, industrias manufactureras y transportes': 'Peones',
}
const ACT: Record<string, string> = {
  'Industrias extractivas': 'Minería', 'Industria manufacturera': 'Industria', 'Suministro de energía eléctrica, gas, vapor y aire acondicionado': 'Energía',
  'Suministro de agua, actividades de saneamiento, gestión de residuos y descontaminación': 'Agua y residuos', 'Construcción': 'Construcción',
  'Comercio al por mayor y al por menor; reparación de vehículos de motor y motocicletas': 'Comercio', 'Transporte y almacenamiento': 'Transporte', 'Hostelería': 'Hostelería',
  'Información y comunicaciones': 'Informática y telecos', 'Actividades financieras y de seguros': 'Banca y seguros', 'Actividades inmobiliarias': 'Inmobiliarias',
  'Actividades profesionales, científicas y técnicas': 'Consultoría y ciencia', 'Actividades administrativas y servicios auxiliares': 'Servicios auxiliares',
  'Administración pública y defensa; seguridad social obligatoria': 'Administración pública', 'Educación': 'Educación', 'Actividades sanitarias y de servicios sociales': 'Sanidad y servicios sociales',
  'Actividades artísticas, recreativas y de entretenimiento': 'Cultura y ocio', 'Otros servicios': 'Otros servicios',
}
/** Filas de pesas (mujer/hombre) del último año para una lista de categorías de una tabla del INE. */
function pesas(t: Ser[] | undefined, cats: Record<string, string> | string[], orden: 'brecha' | 'fijo' = 'brecha') {
  const lista = Array.isArray(cats) ? cats.map(c => [c, c] as const) : Object.entries(cats)
  const f = lista.map(([c, n]) => { const m = ultimo(ine(t, 'Mujeres', c)), h = ultimo(ine(t, 'Hombres', c)); return m && h ? { id: c, nombre: n, m: m.v, h: h.v, a: h.a } : null }).filter((x): x is { id: string; nombre: string; m: number; h: number; a: number } => !!x)
  return orden === 'brecha' ? f.sort((a, b) => (b.h - b.m) / b.h - (a.h - a.m) / a.h) : f
}

function Brecha({ d }: { d: D }) {
  const T = d.ine
  const m = ultimo(ine(T.edad, 'Mujeres', 'Todas las edades')), h = ultimo(ine(T.edad, 'Hombres', 'Todas las edades'))
  if (!m || !h) return <p className="note">Sin datos de salarios.</p>
  const b = ((h.v - m.v) / h.v) * 100
  const horaES = ulA(est(d.est.brecha, 'ES')), horaUE = ulA(est(d.est.brecha, 'EU27_2020'))
  const m0 = ultimo(Object.fromEntries(Object.entries(ine(T.edad, 'Mujeres', 'Todas las edades') ?? {}).slice(0, 1))), h0 = ultimo(Object.fromEntries(Object.entries(ine(T.edad, 'Hombres', 'Todas las edades') ?? {}).slice(0, 1)))
  const b0 = m0 && h0 ? ((h0.v - m0.v) / h0.v) * 100 : null
  const edades = pesas(T.edad, ['De 20 a 24 años', 'De 25 a 29 años', 'De 30 a 34 años', 'De 35 a 39 años', 'De 40 a 44 años', 'De 45 a 49 años', 'De 50 a 54 años', 'De 55 a 59 años', 'De 60 a 64 años'], 'fijo').map(x => ({ ...x, nombre: x.nombre.replace('De ', '').replace(' años', '') }))
  const ocup = pesas(T.ocupacion, OCUP), act = pesas(T.actividad, ACT)
  const jor = pesas(T.jornada, { 'Jornada a tiempo completo': 'Jornada completa', 'Jornada a tiempo parcial': 'Media jornada o menos' }, 'fijo')
  const con = pesas(T.contrato, { Indefinido: 'Contrato indefinido', Temporal: 'Contrato temporal' }, 'fijo')
  const bGrupo = (x: { m: number; h: number }) => ((x.h - x.m) / x.h) * 100
  const edadMax = [...edades].sort((a, b) => bGrupo(b) - bGrupo(a))[0], edadMin = [...edades].sort((a, b) => bGrupo(a) - bGrupo(b))[0]
  const parcF = ulA(est(d.est.parcial, 'F', 'ES')), parcM = ulA(est(d.est.parcial, 'M', 'ES'))
  const paises = Object.keys(PAIS).map(g => ({ g, v: ulA(est(d.est.brecha, g)) })).filter(x => x.v)
  const pens = Object.keys(PAIS).map(g => ({ g, v: ulA(est(d.est.brechaPension, g)) })).filter(x => x.v)
  return <div className="graficos">
    <section className="sala gcard is-wide sala-brecha">
      <RelojBrecha brecha={b} año={h.a} sub={`en ${h.a}, una mujer trabaja sin cobrar en comparación con un hombre`} />
      <div className="sala-dato">
        <span className="sala-k">Brecha salarial anual, {h.a}</span>
        <b>{nf(b, 1)} %</b>
        <span>Un hombre gana de media <b>{eur(h.v)}</b> brutos al año; una mujer, <b>{eur(m.v)}</b>: {eur(h.v - m.v)} menos.{b0 != null ? <> En {Object.keys(ine(T.edad, 'Hombres', 'Todas las edades') ?? {}).sort()[0]} la diferencia era del {nf(b0, 1)} %.</> : null}</span>
        {horaES && <span>Por <b>hora</b> trabajada, la brecha baja al {nf(horaES[1], 1)} % (UE: {nf(horaUE?.[1] ?? 0, 1)} %): buena parte de la diferencia anual viene de que ellas trabajan más a tiempo parcial{parcF && parcM ? ` (${nf(parcF[1], 0)} % de las mujeres frente al ${nf(parcM[1], 0)} % de los hombres)` : ''}.</span>}
        <Monedas mujer={m.v} hombre={h.v} etiqueta={`salario medio bruto anual, ${h.a}`} />
      </div>
    </section>
    <Card wide t="Con la edad, se abre" lead={edadMax && edadMin ? <>La brecha es mínima entre los {edadMin.nombre} años ({nf(bGrupo(edadMin), 0)} %) y máxima entre los {edadMax.nombre} ({nf(bGrupo(edadMax), 0)} %): coincide con los años de crianza y con el freno en los ascensos.</> : null} fuente={EAES}>
      <Pesas titulo={`Salario medio bruto anual por edad, ${h.a}`} fmt={eur} filas={edades} />
    </Card>
    <Card wide t="Por ocupación" lead={ocup[0] ? <>Donde más se separan es en {ocup[0].nombre.toLowerCase()} ({nf(bGrupo(ocup[0]), 0)} %); donde menos, en {ocup.at(-1)!.nombre.toLowerCase()} ({bGrupo(ocup.at(-1)!) < 0 ? `ellas cobran un ${nf(-bGrupo(ocup.at(-1)!), 0)} % más` : `${nf(bGrupo(ocup.at(-1)!), 0)} %`}).</> : null} fuente={EAES}>
      <Pesas titulo={`Salario medio bruto anual por ocupación, ${h.a}`} fmt={eur} filas={ocup} />
    </Card>
    <Card wide t="Por sector" lead={act[0] ? <>El sector con más brecha es {act[0].nombre.toLowerCase()} ({nf(bGrupo(act[0]), 0)} %); el que menos, {act.at(-1)!.nombre.toLowerCase()} ({nf(bGrupo(act.at(-1)!), 0)} %).</> : null} fuente={EAES}>
      <Pesas titulo={`Salario medio bruto anual por sector, ${h.a}`} fmt={eur} filas={act} />
    </Card>
    <Card t="Jornada y contrato" lead={jor.length ? <>A igual tipo de jornada la brecha se estrecha: {nf(bGrupo(jor[0]), 0)} % a jornada completa.</> : null}>
      <Pesas titulo={`Salario por jornada y contrato, ${h.a}`} fmt={eur} filas={[...jor, ...con]} />
    </Card>
    <Card t="En Europa, por hora" lead={horaES && horaUE ? <>Brecha por hora sin ajustar. España ({nf(horaES[1], 1)} %) está {horaES[1] < horaUE[1] ? 'por debajo' : 'por encima'} de la media europea ({nf(horaUE[1], 1)} %).</> : null} fuente={EUROSTAT('sdg_05_20', 'brecha salarial')}>
      <Barras titulo="Brecha salarial por hora" fmt={v => `${nf(v, 1)} %`} items={paises.map(x => ({ id: x.g, nombre: PAIS[x.g], valor: x.v![1], color: x.g === 'ES' ? ACC : '#5f7480', destacado: x.g === 'ES' })).sort((a, b) => b.valor - a.valor)} />
    </Card>
    {pens.length > 0 && <Card wide t="Y después, en la pensión" lead={<>Las mayores de 65 cobran de media un <b>{nf(ulA(est(d.est.brechaPension, 'ES'))?.[1] ?? 0, 0)} % menos</b> de pensión que los hombres: carreras más cortas y sueldos más bajos se arrastran hasta la jubilación.</>} fuente={EUROSTAT('ilc_pnp13', 'brecha de pensiones')}>
      <LineChart titulo="Brecha de pensiones (65 años o más)" alto={220} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[{ id: 'ue', nombre: 'UE', fondo: true, datos: puntos(est(d.est.brechaPension, 'EU27_2020')) }, { id: 'es', nombre: 'España', color: ACC, datos: puntos(est(d.est.brechaPension, 'ES')) }]} />
    </Card>}
  </div>
}

const ISCO = [['OC9', 'Ocupaciones elementales'], ['OC8', 'Operadores de máquinas'], ['OC7', 'Oficios cualificados'], ['OC6', 'Agricultura y pesca'], ['OC5', 'Servicios y comercio'], ['OC4', 'Administrativos'], ['OC3', 'Técnicos de apoyo'], ['OC2', 'Profesionales'], ['OC1', 'Dirección y gerencia']] as const

const CCAA_N: Record<string, string> = { 'Asturias, Principado de': 'Asturias', 'Balears, Illes': 'Illes Balears', 'Madrid, Comunidad de': 'Madrid', 'Murcia, Región de': 'Murcia', 'Navarra, Comunidad Foral de': 'Navarra', 'Rioja, La': 'La Rioja', 'Comunitat Valenciana': 'C. Valenciana' }
const MESES_N = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function Violencia({ d }: { d: D }) {
  const M = d.violencia?.mortales ?? {}, años = Object.keys(M).map(Number).filter(a => M[a].total).sort((a, b) => a - b)
  if (!años.length) return <p className="note">Sin datos de violencia.</p>
  const ult = años.at(-1)!, hoy = new Date(d.fecha), parcial = ult === hoy.getFullYear()
  const completos = años.filter(a => !(parcial && a === ult))
  const hist = M[ult].totalHistorico ?? años.reduce((t, a) => t + (M[a].total ?? 0), 0)
  const sumar = (f: (o: Ficha) => number | undefined, as = completos.slice(-10)) => as.reduce((t, a) => t + (f(M[a]) ?? 0), 0)
  const tot10 = sumar(o => o.total), sinD = sumar(o => o.sinDenuncia), otro = sumar(o => o.pais?.victimaOtro), tot10p = sumar(o => (o.pais ? o.total : 0))
  const ccaa: Record<string, number> = {}; for (const a of completos.slice(-10)) for (const [k, v] of Object.entries(M[a].ccaa ?? {})) ccaa[CCAA_N[k] ?? k] = (ccaa[CCAA_N[k] ?? k] ?? 0) + v
  const edad: Record<string, number> = {}; for (const a of completos.slice(-10)) for (const [k, v] of Object.entries(M[a].edad ?? {})) edad[k] = (edad[k] ?? 0) + v[0]
  // Eurostat: homicidios por pareja y totales, por sexo de la víctima
  const H = d.est.homicidios, HT = d.est.homicidiosTotal
  const hp = (sex: string, geo = 'ES') => est(H, 'IPTN', sex, 'NR', geo), ht = (sex: string, geo = 'ES') => est(HT, sex, 'NR', geo)
  const aH = Object.keys(hp('F') ?? {}).filter(a => hp('M')?.[a] != null).sort().at(-1)
  const pF = aH ? hp('F')![aH] : null, pM = aH ? hp('M')![aH] : null
  const aT = Object.keys(ht('F') ?? {}).filter(a => ht('M')?.[a] != null).sort().at(-1)
  const tF = aT ? ht('F')![aT] : null, tM = aT ? ht('M')![aT] : null
  // INE: víctimas con orden de protección o medidas cautelares
  const V = d.ine.violencia ?? {}
  const tabla = (re: RegExp) => Object.values(V).find(t => re.test(t.n))?.s
  const vg = ine(tabla(/^Asuntos incoados\. V[ií]ctimas, Personas/), 'Violencia de genero', 'Víctimas', 'Dato base')
  const vgMen = ine(tabla(/^Asuntos incoados\. V[ií]ctimas, Personas/), 'Violencia de genero', 'Víctimas menores', 'Dato base')
  const dom = (sx: string) => ine(tabla(/^Asuntos incoados\. V[ií]ctimas y Personas/), 'Violencia doméstica', 'Víctimas', 'Dato base', sx)
  const uVg = ulA(vg), uDomM = ulA(dom('Mujeres')), uDomH = ulA(dom('Hombres'))
  const rel = tabla(/seg[uú]n tipo de relaci[oó]n con el denunciado$/)
  const relaciones = rel ? rel.filter(s => s.p[0] === 'Total Nacional' && s.p.includes('Dato base') && s.p.includes('Violencia de genero') && s.p.length === 6 && !s.p.includes('Total')).map(s => ({ n: s.p.at(-1)!, v: ulA(s.d)?.[1] ?? 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v) : []
  const edadOP = tabla(/seg[uú]n grupo de edad$/)
  const edades = edadOP ? edadOP.filter(s => s.p[0] === 'Total Nacional' && s.p.includes('Dato base') && s.p.includes('Violencia de genero') && s.p.length === 6 && !s.p.includes('Todas las edades')).map(s => ({ n: s.p.at(-1)!, v: ulA(s.d)?.[1] ?? 0 })) : []
  // Interior: delitos contra la libertad sexual (suma de provincias)
  const SX = d.violencia?.sexual
  const sx = (k: string) => SX ? SX.años.map((a, i) => [a, Object.values(SX.prov).reduce((t, o) => t + (o[k]?.[i] ?? 0), 0)] as [number, number]) : []
  const viol = sx('s3_2'), agr = sx('s3_1'), totSx = sx('s3')
  const fin = (s: [number, number][]) => s.filter(x => x[1] > 0).at(-1)
  return <div className="graficos">
    <section className="gcard is-wide">
      <h2>{nf(hist, 0)} mujeres asesinadas por su pareja o expareja desde 2003</h2>
      <p className="lead">Una luz por cada mujer. En {ult}{parcial ? `, hasta el ${hoy.getDate()} de ${MESES_N[hoy.getMonth()]}` : ''}, van <b>{M[ult].total}</b>{M[ult].huerfanos ? <>, y {M[ult].huerfanos} menores se han quedado huérfanos</> : null}. Pasa por una fila para verla.</p>
      <Memorial titulo="Mujeres víctimas mortales por violencia de género, por año" años={años.map(a => ({ año: a, n: M[a].total!, parcial: parcial && a === ult }))} />
      <p className="note">{parcial ? `* ${ult}, datos provisionales hasta la última actualización. ` : ''}Delegación del Gobierno contra la Violencia de Género: asesinatos de mujeres a manos de su pareja o expareja confirmados como violencia de género.{años[0] > 2003 ? ` Faltan las fichas de 2003 a ${años[0] - 1}; el total desde 2003 sí las incluye.` : ''}</p>
      <div className="ayuda" role="note"><b>016</b><span>Atención a víctimas de violencia contra las mujeres, gratis las 24 horas. No aparece en la factura del teléfono (bórrala del historial de llamadas). En peligro: 112.</span></div>
    </section>
    <Card t={`Lo que dicen los casos (${completos.slice(-10)[0]}–${completos.at(-1)})`} lead={`Últimos diez años completos: ${nf(tot10, 0)} mujeres.`} fuente={<a href="https://violenciagenero.igualdad.gob.es/violenciaEnCifras/victimasMortales/fichaMujeres/home.htm" target="_blank" rel="noopener noreferrer">Delegación del Gobierno contra la Violencia de Género, fichas de víctimas mortales</a>}>
      <Cien pct={(sinD / tot10) * 100} color="#ff8a95" etiqueta="no había denunciado a su agresor" resto="Por eso la denuncia sola no basta para proteger: la mayoría nunca llega a pedir ayuda formal." />
      {tot10p > 0 && <p className="note" style={{ marginTop: 14 }}>El {nf((otro / tot10p) * 100, 0)} % de las víctimas había nacido fuera de España.</p>}
    </Card>
    <Card t="Por comunidad y por edad" lead="Víctimas mortales de los últimos diez años completos.">
      <Barras titulo="Víctimas mortales por comunidad" limite={8} fmt={v => nf(v, 0)} items={Object.entries(ccaa).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: k, nombre: k, valor: v, color: '#ffb36b' }))} />
      <Barras titulo="Víctimas mortales por edad" fmt={v => nf(v, 0)} items={Object.entries(edad).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, nombre: k.replace('De ', '').replace(' años', ''), valor: v, color: '#ff8a95' }))} />
    </Card>
    {pF != null && pM != null && <Card wide t="Mujeres y hombres asesinados por su pareja" lead={<>En {aH}, según Eurostat, en España murieron a manos de su pareja o expareja <b>{nf(pF, 0)} mujeres</b> y <b>{nf(pM, 0)} hombres</b>: de cada 100 víctimas de su pareja, {nf((pF / (pF + pM)) * 100, 0)} son mujeres. {tF != null && tM != null ? <>Entre todas las víctimas de homicidio doloso ({aT}) es al revés: {nf(tF, 0)} mujeres y {nf(tM, 0)} hombres; los hombres mueren sobre todo fuera de la pareja.</> : null}</>} fuente={EUROSTAT('crim_hom_vrel', 'víctimas de homicidio por relación con el agresor')}>
      <div className="mapa-dos">
        <LineChart titulo="Víctimas de homicidio a manos de su pareja o expareja" alto={230} fx={x => String(x)} fy={v => nf(v, 0)} series={[{ id: 'f', nombre: 'Mujeres', color: MUJ, datos: puntos(hp('F')) }, { id: 'm', nombre: 'Hombres', color: HOM, datos: puntos(hp('M')) }]} />
        {tF != null && <LineChart titulo="Todas las víctimas de homicidio doloso" alto={230} fx={x => String(x)} fy={v => nf(v, 0)} series={[{ id: 'f', nombre: 'Mujeres', color: MUJ, datos: puntos(ht('F')) }, { id: 'm', nombre: 'Hombres', color: HOM, datos: puntos(ht('M')) }]} />}
      </div>
      <p className="note">Eurostat no dice el sexo de quien mata: entre los hombres asesinados por su pareja entran también los asesinados por otro hombre. Sus cifras de mujeres pueden no coincidir del todo con las de la Delegación del Gobierno, que solo cuenta casos confirmados como violencia de género.</p>
    </Card>}
    {uVg && <Card wide t="Las que denuncian" lead={<>En {uVg[0]}, {nf(uVg[1], 0)} mujeres fueron víctimas de violencia de género con orden de protección o medidas cautelares{ulA(vgMen) ? <>, y {nf(ulA(vgMen)![1], 0)} de ellas eran menores</> : null}. En violencia doméstica (la familia, y la pareja cuando la víctima es un hombre) hubo {nf(uDomM?.[1] ?? 0, 0)} mujeres y {nf(uDomH?.[1] ?? 0, 0)} hombres con esas medidas.</>} fuente={<a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176866&menu=ultiDatos&idp=1254735573206" target="_blank" rel="noopener noreferrer">INE, Estadística de Violencia Doméstica y Violencia de Género</a>}>
      <div className="mapa-dos">
        <LineChart titulo="Víctimas con orden de protección o medidas cautelares" alto={230} fx={x => String(x)} fy={v => nf(v, 0)} series={[{ id: 'vg', nombre: 'Violencia de género (mujeres)', color: MUJ, datos: puntos(vg) }, { id: 'dm', nombre: 'Doméstica: mujeres', color: '#8c6aa8', datos: puntos(dom('Mujeres')) }, { id: 'dh', nombre: 'Doméstica: hombres', color: HOM, datos: puntos(dom('Hombres')) }]} />
        {relaciones.length > 0 && <Barras titulo="Quién era el agresor (violencia de género)" fmt={v => nf(v, 0)} items={relaciones.map(x => ({ id: x.n, nombre: x.n, valor: x.v, color: MUJ }))} />}
      </div>
      {edades.length > 0 && <Barras titulo="Víctimas de violencia de género por edad" fmt={v => nf(v, 0)} items={edades.map(x => ({ id: x.n, nombre: x.n, valor: x.v, color: '#ff8a95' }))} />}
    </Card>}
    {totSx.length > 0 && <Card wide t="Violencia sexual denunciada" lead={<>En {fin(totSx)?.[0]}, la policía conoció {nf(fin(totSx)?.[1] ?? 0, 0)} delitos contra la libertad sexual, {nf(fin(viol)?.[1] ?? 0, 0)} de ellos agresiones con penetración: {masVeces(viol)}. Que suban también refleja que se denuncia más.</>} fuente={<a href="https://estadisticasdecriminalidad.ses.mir.es/" target="_blank" rel="noopener noreferrer">Ministerio del Interior, balance de criminalidad</a>}>
      <LineChart titulo="Delitos contra la libertad sexual conocidos" alto={240} fx={x => String(x)} fy={v => nf(v, 0)} series={[{ id: 't', nombre: 'Todos los delitos sexuales', color: MUJ, datos: totSx }, { id: 'a', nombre: 'Agresión sexual', color: '#ffb36b', datos: agr }, { id: 'p', nombre: 'Con penetración', color: '#ff6b7a', datos: viol }]} />
      <p className="note">Delitos que conocen las policías, según el Ministerio del Interior. No distingue el sexo de la víctima, aunque la gran mayoría son mujeres y niñas.</p>
    </Card>}
  </div>
}
const masVeces = (s: [number, number][]) => { const v = s.filter(x => x[1] > 0); if (v.length < 2) return ''; const r = v.at(-1)![1] / v[0][1]; return r >= 1.5 ? `${nf(r, 1)} veces más que en ${v[0][0]}` : `${r >= 1 ? 'un ' + nf((r - 1) * 100, 0) + ' % más' : 'un ' + nf((1 - r) * 100, 0) + ' % menos'} que en ${v[0][0]}` }

function Techo({ d }: { d: D }) {
  const O = d.est.ocupacion
  const val = (sex: string, oc: string, geo = 'ES') => ulA(est(O, sex, oc, geo, 'EMP'))
  const pisos: Piso[] = ISCO.map(([k, n]) => ({ id: k, nombre: n, mujeres: val('F', k)?.[1] ?? 0, total: val('T', k)?.[1] ?? 1 }))
  const media = (val('F', 'TOTAL')?.[1] ?? 0) / (val('T', 'TOTAL')?.[1] ?? 1), A = val('T', 'TOTAL')?.[0]
  const dir = pisos.at(-1)!, fDir = dir.mujeres / dir.total
  const serieDir = (geo: string) => { const F = est(O, 'F', 'OC1', geo, 'EMP') ?? {}, Tt = est(O, 'T', 'OC1', geo, 'EMP') ?? {}; return Object.keys(Tt).sort().filter(a => F[a] != null).map(a => [+a, (F[a] / Tt[a]) * 100] as [number, number]) }
  const sd = serieDir('ES')
  const parl = (org: string, g: string) => ulA(est(d.est.parlamento, org, g))
  const bajos = ultimo(ine(d.ine.desigualdad, 'Proporción (%) de mujeres en el total de asalariados con ganancia baja'))
  const smiM = ultimo(ine(d.ine.smi, 'Mujeres', 'De 0 a 1 SMI')), smiH = ultimo(ine(d.ine.smi, 'Hombres', 'De 0 a 1 SMI'))
  return <div className="graficos">
    <Card wide t="El edificio de cristal" lead={<>Las mujeres son el <b>{nf(media * 100, 0)} %</b> de quienes trabajan, pero solo el <b>{nf(fDir * 100, 0)} %</b> de quienes dirigen{sd.length > 1 ? <> (en {sd[0][0]}, el {nf(sd[0][1], 0)} %)</> : null}. Son mayoría entre profesionales ({nf((pisos[7].mujeres / pisos[7].total) * 100, 0)} %), así que el atasco no está en la formación: está en el último piso.</>} fuente={EUROSTAT('lfsa_egais', 'empleo por ocupación')}>
      <EdificioCristal pisos={pisos} media={media} titulo={`Mujeres y hombres en cada grupo de ocupación, ${A}`} />
    </Card>
    {sd.length > 1 && <Card t="Mujeres al mando" lead="Porcentaje de mujeres entre directores y gerentes.">
      <LineChart titulo="Mujeres entre directores y gerentes" alto={220} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[{ id: 'ue', nombre: 'UE', fondo: true, datos: serieDir('EU27_2020') }, { id: 'es', nombre: 'España', color: ACC, datos: sd }]} />
    </Card>}
    <Card t="En las instituciones" lead={parl('PARL_NAT', 'ES') ? <>Las mujeres ocupan el {nf(parl('PARL_NAT', 'ES')![1], 0)} % de los escaños del Congreso y el Senado y el {nf(parl('GOV_NAT', 'ES')?.[1] ?? 0, 0)} % de los puestos del Gobierno.</> : null} fuente={EUROSTAT('sdg_05_50', 'mujeres en parlamentos y gobiernos')}>
      <Barras titulo="Mujeres en el parlamento nacional" fmt={v => `${nf(v, 0)} %`} items={Object.keys(PAIS).map(g => ({ id: g, nombre: PAIS[g], valor: parl('PARL_NAT', g)?.[1] ?? 0, color: g === 'ES' ? ACC : '#5f7480', destacado: g === 'ES' })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor)} />
    </Card>
    {(bajos || (smiM && smiH)) && <Card wide t="Y en el sótano" lead={<>{smiM && smiH ? <>El <b>{nf(smiM.v, 0)} %</b> de las asalariadas gana al año menos de un salario mínimo, frente al {nf(smiH.v, 0)} % de los hombres (sobre todo por la jornada parcial). </> : null}{bajos ? <>De quienes cobran poco por hora, el {nf(bajos.v, 0)} % son mujeres.</> : null}</>} fuente={EAES}>
      <div className="dos-cifras">
        {smiM && <div><b style={{ color: MUJ }}>{nf(smiM.v, 1)} %</b><span>de las mujeres asalariadas ganan menos de 1 SMI al año</span></div>}
        {smiH && <div><b style={{ color: HOM }}>{nf(smiH.v, 1)} %</b><span>de los hombres</span></div>}
      </div>
    </Card>}
  </div>
}

function Edad({ d }: { d: D }) {
  const P = d.est.paro, Po = d.est.pobreza
  const j = ulA(est(P, 'Y15-24', 'T', 'ES')), ad = ulA(est(P, 'Y25-74', 'T', 'ES')), jUE = ulA(est(P, 'Y15-24', 'T', 'EU27_2020'))
  const pob = (age: string, geo = 'ES') => est(Po, age, 'T', geo, 'B_60', 'PC')
  const ni = ulA(pob('Y_LT18')), ma = ulA(pob('Y_GE65')), adl = ulA(pob('Y18-64'))
  const sal = ['Menos de 20 años', 'De 20 a 24 años', 'De 25 a 29 años', 'De 30 a 34 años', 'De 35 a 39 años', 'De 40 a 44 años', 'De 45 a 49 años', 'De 50 a 54 años', 'De 55 a 59 años', 'De 60 a 64 años']
  const xEdad = [18, 22, 27, 32, 37, 42, 47, 52, 57, 62]
  const curva = (sx: string) => sal.map((c, i) => { const u = ultimo(ine(d.ine.edad, sx, c)); return u ? [xEdad[i], u.v] as [number, number] : null }).filter((x): x is [number, number] => !!x)
  const A = ultimo(ine(d.ine.edad, 'Ambos sexos', 'Todas las edades'))?.a
  const t = curva('Ambos sexos'), joven = t.find(x => x[0] === 27), pico = t.reduce((b, x) => (x[1] > b[1] ? x : b), t[0] ?? [0, 0])
  return <div className="graficos">
    <Card wide t="Ser joven y buscar trabajo" lead={j && ad ? <>El paro de los menores de 25 es del <b>{nf(j[1], 1)} %</b>, {nf(j[1] / ad[1], 1)} veces el de los mayores de 25 ({nf(ad[1], 1)} %). En la UE, el paro juvenil es del {nf(jUE?.[1] ?? 0, 1)} %.</> : null} fuente={EUROSTAT('une_rt_a', 'paro por edad y sexo')}>
      <LineChart titulo="Tasa de paro por edad y sexo" alto={260} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[
        { id: 'jf', nombre: 'Jóvenes (mujeres)', color: MUJ, datos: puntos(est(P, 'Y15-24', 'F', 'ES')) },
        { id: 'jm', nombre: 'Jóvenes (hombres)', color: HOM, datos: puntos(est(P, 'Y15-24', 'M', 'ES')) },
        { id: 'af', nombre: 'Mayores de 25 (mujeres)', color: '#8c6aa8', datos: puntos(est(P, 'Y25-74', 'F', 'ES')) },
        { id: 'am', nombre: 'Mayores de 25 (hombres)', color: '#4a7da8', datos: puntos(est(P, 'Y25-74', 'M', 'ES')) },
        { id: 'ue', nombre: 'Jóvenes en la UE', fondo: true, datos: puntos(est(P, 'Y15-24', 'T', 'EU27_2020')) }]} />
    </Card>
    <Card t="El sueldo a lo largo de la vida" lead={joven && pico ? <>A los 25-29 años se cobra de media {eur(joven[1])} al año; el máximo llega hacia los {pico[0] - 2}-{pico[0] + 2} años, con {eur(pico[1])}.</> : null} fuente={EAES}>
      <LineChart titulo={`Salario medio bruto anual por edad, ${A}`} alto={240} fx={x => `${x} años`} fy={v => `${nf(v / 1000, 0)} mil €`} series={[{ id: 'm', nombre: 'Mujeres', color: MUJ, datos: curva('Mujeres') }, { id: 'h', nombre: 'Hombres', color: HOM, datos: curva('Hombres') }]} />
    </Card>
    <Card t="La pobreza tiene edad" lead={ni && ma && adl ? <>El <b>{nf(ni[1], 0)} %</b> de los menores vive en riesgo de pobreza, frente al {nf(adl[1], 0)} % de los adultos y el {nf(ma[1], 0)} % de los mayores de 65. {ni[1] > ma[1] ? 'Los niños son el grupo más pobre.' : ''}</> : null} fuente={EUROSTAT('ilc_li02', 'riesgo de pobreza')}>
      <LineChart titulo="Tasa de riesgo de pobreza por edad" alto={240} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[{ id: 'n', nombre: 'Menores de 18', color: '#ffb02e', datos: puntos(pob('Y_LT18')) }, { id: 'a', nombre: '18 a 64', color: '#5fb8ff', datos: puntos(pob('Y18-64')) }, { id: 'm', nombre: '65 o más', color: '#3df5b0', datos: puntos(pob('Y_GE65')) }]} />
    </Card>
  </div>
}

function Origen({ d }: { d: D }) {
  const N = d.ine.nacionalidad
  const NAC: [string[], string][] = [[['Española'], 'Española'], [['País de la UE27_2020 sin España', 'País de la UE28 sin España'], 'Resto de la UE'], [['País de Europa menos UE27_2020', 'País de Europa menos UE28'], 'Resto de Europa'], [['De America', 'De América'], 'América'], [['De Africa', 'De África'], 'África'], [['Otros países'], 'Resto del mundo']]
  const v = (sx: string, alts: string[]) => alts.map(a => ultimo(ine(N, sx, a))).filter(Boolean).sort((a, b) => b!.a - a!.a)[0]
  const filas = NAC.map(([alts, n]) => { const m = v('Mujeres', alts), h = v('Hombres', alts), t = v('Ambos sexos', alts); return m && h ? { id: n, nombre: n, m: m.v, h: h.v, t: t?.v ?? 0, a: h.a } : null }).filter((x): x is { id: string; nombre: string; m: number; h: number; t: number; a: number } => !!x)
  const esp = filas.find(f => f.id === 'Española'), afr = filas.find(f => f.id === 'África')
  const PO = d.est.paroOrigen, PB = d.est.pobrezaOrigen
  const cit = (e: Est | undefined, c: string) => est(e, c, 'ES')
  const pN = ulA(cit(PB, 'NAT')), pX = ulA(cit(PB, 'NEU27_2020_FOR')), uN = ulA(cit(PO, 'NAT')), uX = ulA(cit(PO, 'NEU27_2020_FOR'))
  const g = Object.keys(PAIS).map(k => ({ k, v: ulA(est(d.est.gini, k)) })).filter(x => x.v)
  return <div className="graficos">
    <Card wide t="Lo que se cobra según el pasaporte" lead={esp && afr ? <>Un trabajador de nacionalidad española gana de media {eur(esp.t)} al año; uno de un país africano, {eur(afr.t)}: un {nf(((esp.t - afr.t) / esp.t) * 100, 0)} % menos. Y dentro de cada origen, la brecha entre mujeres y hombres se repite.</> : null} fuente={EAES}>
      <Pesas titulo={`Salario medio bruto anual por nacionalidad, ${filas[0]?.a}`} fmt={eur} filas={filas} />
    </Card>
    <Card t="Paro por nacionalidad" lead={uN && uX ? <>El paro de quienes tienen nacionalidad de fuera de la UE es del {nf(uX[1], 1)} %, frente al {nf(uN[1], 1)} % de los españoles.</> : null} fuente={EUROSTAT('lfsa_urgan', 'paro por nacionalidad')}>
      <LineChart titulo="Tasa de paro por nacionalidad" alto={230} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[{ id: 'n', nombre: 'Españoles', color: '#5fb8ff', datos: puntos(cit(PO, 'NAT')) }, { id: 'u', nombre: 'De otro país de la UE', color: '#3df5b0', datos: puntos(cit(PO, 'EU27_2020_FOR')) }, { id: 'x', nombre: 'De fuera de la UE', color: '#ffb02e', datos: puntos(cit(PO, 'NEU27_2020_FOR')) }]} />
    </Card>
    <Card t="Pobreza por nacionalidad" lead={pN && pX ? <>El {nf(pX[1], 0)} % de los adultos con nacionalidad de fuera de la UE está en riesgo de pobreza; entre los españoles, el {nf(pN[1], 0)} %.</> : null} fuente={EUROSTAT('ilc_li31', 'pobreza por nacionalidad')}>
      <LineChart titulo="Riesgo de pobreza por nacionalidad (18 años o más)" alto={230} fx={x => String(x)} fy={v => `${nf(v, 0)} %`} series={[{ id: 'n', nombre: 'Españoles', color: '#5fb8ff', datos: puntos(cit(PB, 'NAT')) }, { id: 'u', nombre: 'De otro país de la UE', color: '#3df5b0', datos: puntos(cit(PB, 'EU27_2020_FOR')) }, { id: 'x', nombre: 'De fuera de la UE', color: '#ffb02e', datos: puntos(cit(PB, 'NEU27_2020_FOR')) }]} />
    </Card>
    {g.length > 0 && <Card wide t="La desigualdad de renta" lead={<>Índice de Gini de la renta de los hogares (0 = todos igual, 100 = uno lo tiene todo). España: {nf(ulA(est(d.est.gini, 'ES'))?.[1] ?? 0, 1)}; la UE: {nf(ulA(est(d.est.gini, 'EU27_2020'))?.[1] ?? 0, 1)}.</>} fuente={EUROSTAT('ilc_di12', 'índice de Gini')}>
      <LineChart titulo="Índice de Gini de la renta disponible" alto={230} fx={x => String(x)} fy={v => nf(v, 0)} series={[...g.filter(x => x.k !== 'ES').map(x => ({ id: x.k, nombre: PAIS[x.k], fondo: true, datos: puntos(est(d.est.gini, x.k)) })), { id: 'ES', nombre: 'España', color: ACC, datos: puntos(est(d.est.gini, 'ES')) }]} />
    </Card>}
  </div>
}

export default function App() {
  const [d, setD] = useState<D | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/igualdad.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'brecha')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><Scale size={28} /><p>Equilibrando la balanza…</p></main>
  const m = ultimo(ine(d.ine.edad, 'Mujeres', 'Todas las edades')), h = ultimo(ine(d.ine.edad, 'Hombres', 'Todas las edades'))
  const emF = ulA(est(d.est.empleo, 'F', 'ES')), emM = ulA(est(d.est.empleo, 'M', 'ES'))
  const parcF = ulA(est(d.est.parcial, 'F', 'ES')), parcM = ulA(est(d.est.parcial, 'M', 'ES'))
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Igualdad</h1>
          <p>Monitor de desigualdad: sexo, edad y origen · INE y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'brecha' && <Brecha d={d} />}
        {sec === 'violencia' && <Violencia d={d} />}
        {sec === 'techo' && <Techo d={d} />}
        {sec === 'edad' && <Edad d={d} />}
        {sec === 'origen' && <Origen d={d} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        m && h ? <>Para cobrar lo que un hombre gana en un año, una mujer necesitaría trabajar <b>{nf((h.v / m.v) * 12, 1)} meses</b>.</> : null,
        emF && emM ? <>Trabaja el {nf(emF[1], 0)} % de las mujeres de 20 a 64 años y el {nf(emM[1], 0)} % de los hombres: {nf(emM[1] - emF[1], 0)} puntos de diferencia.</> : null,
        parcF && parcM ? <>Hay {nf(parcF[1] / parcM[1], 1)} veces más mujeres que hombres trabajando a tiempo parcial, en proporción.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[{ n: 'INE · Encuesta Anual de Estructura Salarial', u: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177025&menu=ultiDatos&idp=1254735976596' }, { n: 'Eurostat · Brecha salarial (sdg_05_20)', u: 'https://ec.europa.eu/eurostat/databrowser/view/sdg_05_20/default/table' }, { n: 'Eurostat · Empleo por ocupación (lfsa_egais)', u: 'https://ec.europa.eu/eurostat/databrowser/view/lfsa_egais/default/table' }, { n: 'Eurostat · Paro, pobreza y desigualdad de renta', u: 'https://ec.europa.eu/eurostat/databrowser/view/ilc_li02/default/table' }]} />
      <p className="src">Brecha salarial «sin ajustar»: compara el salario medio de todas las mujeres con el de todos los hombres, sin igualar puesto, jornada ni antigüedad. Mide la desigualdad total, no solo la discriminación directa. Datos de {d.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
