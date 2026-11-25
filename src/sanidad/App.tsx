import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Activity, HeartPulse, Hospital, Microscope } from 'lucide-react'
import { Apiladas, Barras, Carrera, Columnas, CountUp, LineChart, nf, type Fotograma } from '../graficos'
import { MapaProvincias } from '../geo/MapaProvincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { nombrePais } from '../mundo/MapaMundo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'
import { LineaVida } from './LineaVida'
import { Monitor, semanaLarga, type Latido } from './Monitor'

const ACC = '#ff7b7b', MUJ = '#d55181', HOM = '#3987e5', GRIS = '#5b6b74'
type S = (number | null)[]
type Europa = { año: string; ue: number | null; paises: { id: string; v: number }[] }
type Recurso = { año: string; ccaa: Record<string, number>; años: string[]; ES: S; ueSerie: S; europa: Europa }
type D = {
  fecha: string
  vida: { años: string[]; T: S; M: S; F: S; T65: S; M65: S; F65: S; ue: S }
  vidaUE: Europa & { sexo: Record<string, [number | null, number | null]> }
  vidaCcaa: { años: string[]; ccaa: Record<string, { T: S; M: S; F: S }> }
  causas: { años: string[]; capitulos: { id: string; nombre: string; T: S; M: S; F: S }[] }
  top?: { año: string; lista: { n: string; T: number; M: number | null; F: number | null }[] }
  semanas: { s: string[]; v: (number | null)[] }
  exceso: { meses: string[]; ES: S; ue: S; europa: Europa }
  medicos: Recurso; camas: Recurso
  gasto: { años: string[]; hab: S; pib: S; publico: S; seguros: S; bolsillo: S; ue: { hab: S; pib: S; publico: S; bolsillo: S }; europa: Europa & { pib: Record<string, number | null>; bolsillo: Record<string, number | null> } }
  espera: { años: string[]; ES: S; ue: S; caro: S; lejos: S; quintiles: { año: string; v: S }; europa: Europa }
}
const SECCIONES = [
  { id: 'vida', nombre: 'Cuánto vivimos', icon: HeartPulse },
  { id: 'causas', nombre: 'De qué morimos', icon: Microscope },
  { id: 'latido', nombre: 'Semana a semana', icon: Activity },
  { id: 'sistema', nombre: 'El sistema', icon: Hospital },
] as const
type Sec = (typeof SECCIONES)[number]['id']
type Sx = 'T' | 'F' | 'M'
const SEXOS: { id: Sx; n: string; c: string }[] = [{ id: 'T', n: 'Total', c: ACC }, { id: 'F', n: 'Mujeres', c: MUJ }, { id: 'M', n: 'Hombres', c: HOM }]

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const L_VIDA = <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_mlexpec/default/table?lang=es" {...ext}>Eurostat, esperanza de vida (demo_mlexpec)</a>
const L_VIDAR = <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_r_mlifexp/default/table?lang=es" {...ext}>Eurostat, esperanza de vida por región (demo_r_mlifexp)</a>
const L_CAUSAS = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=73035" {...ext}>INE, defunciones según la causa de muerte</a>
const L_TOP = <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=7947" {...ext}>INE, defunciones por causas (lista reducida)</a>
const L_SEM = <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_r_mwk_ts/default/table?lang=es" {...ext}>Eurostat, muertes semanales (datos del INE)</a>
const L_EXC = <a href="https://ec.europa.eu/eurostat/databrowser/view/demo_mexrt/default/table?lang=es" {...ext}>Eurostat, exceso de mortalidad (demo_mexrt)</a>
const L_MED = <a href="https://ec.europa.eu/eurostat/databrowser/view/hlth_rs_physreg/default/table?lang=es" {...ext}>Eurostat, médicos por región</a>
const L_CAM = <a href="https://ec.europa.eu/eurostat/databrowser/view/hlth_rs_bdsrg2/default/table?lang=es" {...ext}>Eurostat, camas de hospital por región</a>
const L_GAS = <a href="https://ec.europa.eu/eurostat/databrowser/view/hlth_sha11_hf/default/table?lang=es" {...ext}>Eurostat, gasto sanitario (hlth_sha11_hf)</a>
const L_ESP = <a href="https://ec.europa.eu/eurostat/databrowser/view/hlth_silc_08/default/table?lang=es" {...ext}>Eurostat, necesidades médicas no atendidas (hlth_silc_08)</a>

const ult = (s: S) => s.findLastIndex(v => v != null)
const pts = (años: string[], s: S, desde = 0) => años.flatMap((a, i) => (s[i] != null && +a >= desde ? [[+a, s[i]!] as [number, number]] : []))
const masMenos = (v: number, d = 0) => `${nf(Math.abs(v), d)} % ${v >= 0 ? 'más' : 'menos'}`
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mesLargo = (m: string) => `${MESES[+m.slice(5) - 1]} de ${m.slice(0, 4)}`
const escalaAcc = ['#2a1f27', '#5a2c37', '#a8464f', '#ff7b7b', '#ffd9d4']

function Card({ t, lead, children, wide, fuente, className = '' }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode; className?: string }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''} ${className}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
function Chips<T extends string>({ items, v, set }: { items: { id: T; n: string; c?: string }[]; v: T; set: (x: T) => void }) {
  return <div className="chips" role="group">{items.map(x => <button key={x.id} className={v === x.id ? 'is-on' : ''} style={{ '--c': x.c ?? ACC } as CSSProperties} onClick={() => set(x.id)} aria-pressed={v === x.id}><i />{x.n}</button>)}</div>
}
/** Ranking europeo con España resaltada y la media de la UE en el texto. */
function Europa({ e, fmt, titulo, limite = 27 }: { e: Europa; fmt: (v: number) => string; titulo: string; limite?: number }) {
  return <Barras titulo={titulo} fmt={fmt} limite={limite} items={e.paises.map(p => ({ id: p.id, nombre: nombrePais(p.id), valor: p.v, destacado: p.id === 'ES', color: p.id === 'ES' ? ACC : GRIS }))} />
}
const puesto = (e: Europa) => e.paises.findIndex(p => p.id === 'ES') + 1

// ---------- Cuánto vivimos ----------
function Vida({ d }: { d: D }) {
  const V = d.vida, i = ult(V.T), A = V.años[i], u = d.vidaUE, pos = puesto(u)
  const j0 = V.T.findIndex(v => v != null), ueS = u.sexo.EU27_2020 ?? [null, null]
  const k19 = V.años.indexOf('2019'), k20 = V.años.indexOf('2020')
  const caida = k19 >= 0 && k20 >= 0 && V.T[k19] != null && V.T[k20] != null ? V.T[k19]! - V.T[k20]! : null
  const [sx, setSx] = useState<Sx>('T'), [sel, setSel] = useState<string | null>(null)
  const C = d.vidaCcaa, ic = C.años.length - 1
  const vc = (n: string) => C.ccaa[n]?.[sx]?.[ic] ?? null
  const rk = Object.keys(C.ccaa).map(n => ({ n, v: vc(n) })).filter((x): x is { n: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const selN = sel ? CCAA_DE_PROV[sel] ?? null : null, vs = selN ? vc(selN) : null
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div>
        <h2>La línea de la vida</h2>
        <p className="lead">Cuántos años vive de media quien nace hoy en España, si las cosas siguieran como en {A}. Toca una barra.</p>
        <LineaVida desde={V.años[j0]} filas={[
          { id: 'F', nombre: 'Mujeres', color: MUJ, nacer: V.F[i]!, a65: V.F65[i], ue: ueS[1], antes: V.F[j0] },
          { id: 'M', nombre: 'Hombres', color: HOM, nacer: V.M[i]!, a65: V.M65[i], ue: ueS[0], antes: V.M[j0] },
        ]} />
      </div>
      <div className="sala-dato">
        <span className="sala-k">Esperanza de vida al nacer, {A}</span>
        <b><CountUp value={V.T[i]!} fmt={v => `${nf(v, 1)} años`} /></b>
        <span>{pos === 1 ? <>La <b>más alta de la Unión Europea</b>.</> : pos > 0 ? <>La <b>{pos}.ª</b> de los 27 países de la UE.</> : null}{u.ue != null && <> La media de la UE es de {nf(u.ue, 1)} años.</>}</span>
        <span>Las mujeres viven <b>{nf(V.F[i]! - V.M[i]!, 1)} años más</b> que los hombres.</span>
        {V.T[j0] != null && <span>En {V.años[j0]} eran {nf(V.T[j0]!, 1)} años: hemos ganado {nf(V.T[i]! - V.T[j0]!, 1)} años de vida.</span>}
        {caida != null && caida > 0 && <span>En 2020, con la covid, se perdieron {nf(caida, 1)} años de golpe.</span>}
      </div>
    </section>
    <Card wide t={`Años de vida desde ${V.años[j0]}`} lead={<>Esperanza de vida al nacer cada año. La línea gris es la media de la Unión Europea.</>} fuente={L_VIDA}>
      <LineChart titulo="Esperanza de vida al nacer en España" alto={240} fx={v => String(v)} fy={v => `${nf(v, 0)}`} series={[
        { id: 'F', nombre: 'Mujeres', color: MUJ, datos: pts(V.años, V.F) },
        { id: 'T', nombre: 'Total', color: ACC, datos: pts(V.años, V.T), area: true },
        { id: 'M', nombre: 'Hombres', color: HOM, datos: pts(V.años, V.M) },
        { id: 'ue', nombre: 'Media de la UE', datos: pts(V.años, V.ue), fondo: true },
      ]} marcas={k20 >= 0 && V.T[k20] != null && caida && caida > .3 ? [{ x: 2020, y: V.T[k20]!, texto: 'covid', tono: 'bajo' }] : []} />
    </Card>
    <Card wide t={`Por comunidad, ${C.años[ic]}`} lead={rk.length > 1 ? <>Donde más se vive, <b>{rk[0].n}</b> ({nf(rk[0].v, 1)} años); donde menos, {rk.at(-1)!.n} ({nf(rk.at(-1)!.v, 1)}): {nf(rk[0].v - rk.at(-1)!.v, 1)} años de diferencia.{selN && vs != null && <> {selN}: <b>{nf(vs, 1)} años</b>, puesto {rk.findIndex(x => x.n === selN) + 1} de {rk.length}.</>}</> : null} fuente={L_VIDAR}>
      <Chips items={SEXOS} v={sx} set={setSx} />
      <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={n => vc(n)} fmt={v => `${nf(v, 1)} años`} titulo={`Esperanza de vida al nacer por comunidad, ${C.años[ic]}`} color={ACC} escala={escalaAcc} sel={sel} onSel={setSel} nota="Cuanto más claro, más años de vida. Toca una comunidad." />
    </Card>
    <Card wide t={`España en Europa, ${u.año}`} lead={<>Esperanza de vida al nacer en los países de la Unión Europea.</>} fuente={L_VIDA}>
      <Europa e={u} fmt={v => `${nf(v, 1)} años`} titulo={`Esperanza de vida al nacer en la UE, ${u.año}`} limite={10} />
    </Card>
  </div>
}

// ---------- De qué morimos ----------
const CORTO: Record<string, string> = {
  I: 'Infecciosas', II: 'Tumores', III: 'Sangre', IV: 'Endocrinas', V: 'Demencias y mentales', 'VI-VIII': 'Nervioso (alzhéimer)',
  IX: 'Corazón y circulación', X: 'Respiratorias', XI: 'Digestivas', XII: 'Piel', XIII: 'Huesos y músculos', XIV: 'Riñón y urinarias', XV: 'Embarazo y parto',
  XVI: 'Recién nacidos', XVII: 'Malformaciones', XVIII: 'Mal definidas', XX: 'Causas externas', COVID: 'Covid-19',
}
const COLOR: Record<string, string> = { II: '#d95926', IX: '#3987e5', X: '#199e70', 'VI-VIII': '#9085e9', V: '#c98500', XX: '#e66767', I: '#0ca30c', XI: '#d55181', COVID: ACC, IV: '#7fc7b0', XIV: '#b0a0ff' }
/** Nombres de la lista reducida del INE, más claros. */
const bonita = (n: string) => n.replace(/^Tumor maligno de la tráquea, de los bronquios y del pulmón$/, 'Cáncer de pulmón, tráquea y bronquios').replace(/^COVID-19\. Virus identificado$/, 'Covid-19').replace(/^Trastornos mentales orgánicos, senil y presenil$/, 'Demencias').replace(/^Tumor maligno (de |del )/, 'Cáncer $1').replace(/^Tumores malignos /, 'Cánceres ')
function Causas({ d }: { d: D }) {
  const C = d.causas, tot = C.capitulos.find(c => c.id === 'I-XXII')!, caps = C.capitulos.filter(c => c.id !== 'I-XXII')
  const ia = caps.find(c => c.id === 'II')!.T.findLastIndex(v => v != null), A = C.años[ia]
  const covid = (k: number) => { const s = caps.reduce((t, c) => t + (c.T[k] ?? 0), 0), r = (tot.T[k] ?? 0) - s; return +C.años[k] >= 2020 && r > 1000 ? r : 0 }
  const fot = useMemo<Fotograma[]>(() => C.años.slice(0, ia + 1).map((a, k) => ({ t: a, items: [...caps.map(c => ({ id: c.id, nombre: CORTO[c.id] ?? c.nombre, valor: c.T[k] ?? 0 })), { id: 'COVID', nombre: CORTO.COVID, valor: covid(k) }].filter(x => x.valor > 0) })), [C, ia])
  const tum = caps.find(c => c.id === 'II')!, cor = caps.find(c => c.id === 'IX')!
  const cruce = C.años.find((_, k) => (tum.T[k] ?? 0) > (cor.T[k] ?? Infinity))
  const ultimoA = fot.at(-1)?.items.slice().sort((a, b) => b.valor - a.valor) ?? []
  const totA = tot.T[ia] ?? 1
  const [sx, setSx] = useState<Sx>('T')
  const top = d.top, lista = (top?.lista ?? []).filter(x => !/^(Otr[oa]s|Resto)\b/.test(x.n)).map(x => ({ n: bonita(x.n), v: x[sx] ?? 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
  const totTop = sx === 'T' ? (tot.T[C.años.indexOf(top?.año ?? '')] ?? null) : null
  return <div className="graficos">
    <Card wide t="La carrera de las causas de muerte" lead={<>Muertes al año por grandes grupos de causas, desde {C.años[0]} hasta {A}. {cruce ? <>Mira cómo los tumores adelantan al corazón en <b>{cruce}</b>, y cómo irrumpe la covid en 2020.</> : null} Dale al botón para verla otra vez o arrastra la barra de tiempo. Toca una causa para seguirla. «Causas externas» son accidentes, caídas, suicidios y agresiones.</>} fuente={L_CAUSAS}>
      <Carrera fotogramas={fot} top={10} fmt={v => nf(v, 0)} titulo="Muertes al año por grupo de causas" colores={COLOR} ms={700} />
    </Card>
    <Card t={`De cada 100 muertes, ${A}`} lead={ultimoA[0] && <>El grupo que más mata: <b>{(CORTO[ultimoA[0].id] ?? ultimoA[0].nombre).toLowerCase()}</b>, {nf((ultimoA[0].valor / totA) * 100, 0)} de cada 100 muertes. Detrás, {(CORTO[ultimoA[1]?.id] ?? '').toLowerCase()} ({nf(((ultimoA[1]?.valor ?? 0) / totA) * 100, 0)}).</>} fuente={L_CAUSAS}>
      <Barras titulo={`Muertes por grupo de causas, ${A}`} fmt={v => nf(v, 0)} items={ultimoA.map(x => ({ id: x.id, nombre: CORTO[x.id] ?? x.nombre, sub: `${nf((x.valor / totA) * 100, 1)} % del total`, valor: x.valor, color: COLOR[x.id] ?? GRIS }))} limite={8} />
    </Card>
    <Card t="Tumores contra corazón" lead={cruce ? <>Hasta {+cruce - 1}, el corazón y la circulación mataban más que el cáncer. Desde {cruce}, los tumores van por delante.</> : <>Muertes al año por tumores y por enfermedades del corazón y la circulación.</>} fuente={L_CAUSAS}>
      <LineChart titulo="Muertes al año por tumores y por enfermedades circulatorias" alto={230} fx={v => String(v)} fy={v => `${nf(v / 1000, 0)} mil`} series={[
        { id: 'tum', nombre: 'Tumores', color: COLOR.II, datos: pts(C.años, tum.T) },
        { id: 'cor', nombre: 'Corazón y circulación', color: COLOR.IX, datos: pts(C.años, cor.T) },
      ]} marcas={cruce ? [{ x: +cruce, y: tum.T[C.años.indexOf(cruce)]!, texto: cruce }] : []} />
    </Card>
    {top && lista.length > 0 && <Card wide t={`Las causas concretas, ${top.año}`} lead={<>Dentro de cada grupo, las enfermedades que más matan. La primera, <b>{lista[0].n.toLowerCase()}</b>: {nf(lista[0].v, 0)} muertes{totTop ? <>, {nf((lista[0].v / totTop) * 100, 1)} de cada 100</> : null}. Toca una barra para compararla con las demás.</>} fuente={L_TOP}>
      <Chips items={SEXOS} v={sx} set={setSx} />
      <Barras titulo={`Muertes por causa, ${top.año}`} fmt={v => nf(v, 0)} items={lista.map(x => ({ id: x.n, nombre: x.n, valor: x.v, color: sx === 'T' ? ACC : sx === 'F' ? MUJ : HOM }))} limite={15} />
    </Card>}
  </div>
}

// ---------- Semana a semana ----------
function Semanas({ d }: { d: D }) {
  const S = d.semanas
  const media = useMemo(() => { const m: Record<string, number[]> = {}; S.s.forEach((s, k) => { const y = +s.slice(0, 4); if (y >= 2015 && y <= 2019 && S.v[k] != null) (m[s.slice(6)] ??= []).push(S.v[k]!) }); return m }, [S])
  const normal = (w: string) => { const l = media[w] ?? media['52'] ?? []; return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null }
  const lat: Latido[] = S.s.flatMap((s, k) => { const v = S.v[k], m = normal(s.slice(6)); return v != null && m ? [{ s, v, media: m }] : [] })
  const ulti = lat.at(-1)!, yA = +ulti.s.slice(0, 4)
  const porAño = (y: number) => S.s.flatMap((s, k) => (+s.slice(0, 4) === y && S.v[k] != null ? [[+s.slice(6), S.v[k]!] as [number, number]] : []))
  const sem = Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, '0'))
  const lo = sem.map(w => [+w, Math.min(...(media[w] ?? [0]))] as [number, number]), hi = sem.map(w => [+w, Math.max(...(media[w] ?? [0]))] as [number, number])
  const pico = lat.reduce((b, x) => (x.v > b.v ? x : b), lat[0])
  // en lo que va de año, frente a lo normal
  const esteAño = lat.filter(x => +x.s.slice(0, 4) === yA), suma = esteAño.reduce((t, x) => t + x.v, 0), sumaN = esteAño.reduce((t, x) => t + x.media, 0)
  const E = d.exceso, ie = ult(E.ES), xs = E.meses.map(m => Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 15))
  const C = d.causas, tot = C.capitulos.find(c => c.id === 'I-XXII')!
  const cols = C.años.map((a, k) => ({ x: a, valor: tot.T[k] ?? 0, destacado: a === '2020' })).filter(c => c.valor > 0)
  const ex20 = E.ES.slice(0, 12).reduce<number>((t, v) => Math.max(t, v ?? 0), 0)
  return <div className="graficos">
    <Card wide className="mon-card" t="El pulso del país" lead={<>Cada latido es una semana: cuanto más alto el pico, más muertes frente a lo normal para esa época del año (la media de 2015 a 2019). En {yA}, hasta ahora, {masMenos(((suma - sumaN) / (sumaN || 1)) * 100, 1)} que lo normal. Ojo: desde entonces somos más y más mayores, así que lo normal hoy es algo más alto. Toca un latido para ver su semana.</>} fuente={L_SEM}>
      <Monitor semanas={lat} acento={ACC} />
    </Card>
    <Card wide t={`${yA} frente a lo normal`} lead={<>Muertes de cada semana del año. La franja va del mínimo al máximo de 2015 a 2019, antes de la covid. La semana más dura desde 2010 fue la de {semanaLarga(pico.s)}: <b>{nf(pico.v, 0)} muertes</b>, {nf(pico.v / pico.media, 1)} veces lo normal.</>} fuente={L_SEM}>
      <LineChart titulo="Muertes por semana del año" alto={250} fx={v => `Semana ${v}`} fxEje={v => String(v)} fy={v => nf(v, 0)} yMin={0} etiquetasFinal={false}
        banda={{ nombre: 'Entre el mínimo y el máximo de 2015-2019', lo, hi }} series={[
          { id: 'a', nombre: String(yA), color: ACC, datos: porAño(yA) },
          { id: 'b', nombre: String(yA - 1), color: '#c7a3ff', datos: porAño(yA - 1) },
          { id: 'c', nombre: '2020', datos: porAño(2020), fondo: true },
        ]} />
    </Card>
    <Card t="Exceso de mortalidad" lead={ie >= 0 ? <>Cuántas muertes de más hay cada mes frente a la media de 2016 a 2019, en porcentaje. En {mesLargo(E.meses[ie])}, en España, un <b>{masMenos(E.ES[ie]!, 1)}</b>{E.ue[ie] != null && <>; en la UE, un {masMenos(E.ue[ie]!, 1)}</>}. El peor mes de 2020 llegó a un {nf(ex20, 0)} % más.</> : null} fuente={L_EXC}>
      <LineChart titulo="Exceso de mortalidad mensual" alto={230} fx={t => { const m = new Date(t).toISOString().slice(0, 7); return mesLargo(m) }} fxEje={t => String(new Date(t).getUTCFullYear())} fy={v => `${nf(v, 0)} %`} etiquetasFinal={false} series={[
        { id: 'es', nombre: 'España', color: ACC, datos: xs.flatMap((x, i) => (E.ES[i] != null ? [[x, E.ES[i]!] as [number, number]] : [])) },
        { id: 'ue', nombre: 'UE', datos: xs.flatMap((x, i) => (E.ue[i] != null ? [[x, E.ue[i]!] as [number, number]] : [])), fondo: true },
      ]} ticksX={xs.filter((_, i) => E.meses[i].endsWith('-01'))} />
    </Card>
    <Card t="Muertes al año" lead={<>Desde {cols[0]?.x}. Somos más y más mayores, así que mueren más personas aunque se viva más. 2020, resaltado.</>} fuente={L_CAUSAS}>
      <Columnas titulo="Muertes al año en España" fmt={v => nf(v, 0)} items={cols.map(c => ({ ...c, color: c.destacado ? ACC : '#7f939c' }))} alto={230} cadaX={5} />
    </Card>
    <Card wide t={`Europa, ${mesLargo(E.europa.año)}`} lead={<>Exceso de mortalidad de cada país en el último mes con datos de casi todos.</>} fuente={L_EXC}>
      <Europa e={E.europa} fmt={v => `${v >= 0 ? '+' : ''}${nf(v, 1)} %`} titulo={`Exceso de mortalidad, ${mesLargo(E.europa.año)}`} limite={10} />
    </Card>
  </div>
}

// ---------- El sistema ----------
function Sistema({ d }: { d: D }) {
  const [ind, setInd] = useState<'medicos' | 'camas'>('medicos'), [sel, setSel] = useState<string | null>(null)
  const R = d[ind], nombre = ind === 'medicos' ? 'médicos' : 'camas de hospital'
  const rk = Object.entries(R.ccaa).sort((a, b) => b[1] - a[1]), ie = ult(R.ES), selN = sel ? CCAA_DE_PROV[sel] ?? null : null
  const G = d.gasto, ig = ult(G.hab), gA = G.años[ig], pg = puesto(G.europa)
  const W = d.espera, iw = ult(W.ES), q = W.quintiles.v, pw = puesto(W.europa)
  return <div className="graficos">
    <Card wide t={`${ind === 'medicos' ? 'Médicos' : 'Camas de hospital'} por cada 100.000 habitantes, ${R.año}`} lead={<>En España, <b>{nf(R.ES[ie] ?? 0, 0)}</b>. Más: <b>{rk[0]?.[0]}</b> ({nf(rk[0]?.[1] ?? 0, 0)}); menos: {rk.at(-1)?.[0]} ({nf(rk.at(-1)?.[1] ?? 0, 0)}).{selN && R.ccaa[selN] != null && <> {selN}: <b>{nf(R.ccaa[selN], 0)}</b>, un {masMenos(((R.ccaa[selN] - (R.ES[ie] ?? 1)) / (R.ES[ie] || 1)) * 100)} que la media.</>}</>} fuente={ind === 'medicos' ? L_MED : L_CAM}>
      <Chips items={[{ id: 'medicos', n: 'Médicos' }, { id: 'camas', n: 'Camas de hospital' }]} v={ind} set={x => setInd(x)} />
      <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={n => R.ccaa[n] ?? null} fmt={v => `${nf(v, 0)} por 100.000 hab.`} titulo={`${nombre} por 100.000 habitantes, ${R.año}`} color={ACC} escala={escalaAcc} sel={sel} onSel={setSel}
        nota={ind === 'medicos' ? 'Médicos colegiados que ejercen, públicos y privados. Las comunidades con grandes hospitales de referencia atienden también a pacientes de fuera.' : 'Camas disponibles en hospitales públicos y privados.'} />
    </Card>
    <Card wide t={`${ind === 'medicos' ? 'Médicos' : 'Camas'} en Europa, ${R.europa.año}`} lead={<>España es el país <b>{puesto(R.europa)}.º</b> de los {R.europa.paises.length} con datos.</>} fuente={ind === 'medicos' ? L_MED : L_CAM}>
      <Europa e={R.europa} fmt={v => nf(v, 0)} titulo={`${nombre} por 100.000 habitantes en la UE, ${R.europa.año}`} limite={10} />
    </Card>
    <Card t={`Quién paga la sanidad, ${gA}`} lead={<>En {gA} se gastaron <b>{nf(G.hab[ig] ?? 0, 0)} € por habitante</b> en sanidad, el {nf(G.pib[ig] ?? 0, 1)} % del PIB. De cada 100 €, {nf(G.publico[ig] ?? 0, 0)} los pone lo público, {nf(G.seguros[ig] ?? 0, 0)} los seguros privados y {nf(G.bolsillo[ig] ?? 0, 0)} salen del bolsillo{G.ue.bolsillo[ig] != null && <> (en la UE, {nf(G.ue.bolsillo[ig]!, 0)})</>}.</>} fuente={L_GAS}>
      <Apiladas xs={G.años.slice(0, ig + 1).map(a => Date.UTC(+a, 6, 1))} pct fx={t => String(new Date(t).getUTCFullYear())} fy={v => `${nf(v, 0)} %`} titulo="Gasto sanitario por quién lo paga" alto={230} capas={[
        { id: 'pub', nombre: 'Público y Seguridad Social', color: '#3987e5', v: G.publico.slice(0, ig + 1).map(v => v ?? 0) },
        { id: 'seg', nombre: 'Seguros privados', color: '#9085e9', v: G.seguros.slice(0, ig + 1).map(v => v ?? 0) },
        { id: 'bol', nombre: 'Del bolsillo', color: ACC, v: G.bolsillo.slice(0, ig + 1).map(v => v ?? 0) },
      ]} />
    </Card>
    <Card t={`Gasto por habitante en Europa, ${G.europa.año}`} lead={<>En euros de igual poder de compra, para comparar países con precios distintos. España es la <b>{pg}.ª</b>{G.europa.ue != null && <>; la media de la UE, {nf(G.europa.ue, 0)}</>}.</>} fuente={L_GAS}>
      <Europa e={G.europa} fmt={v => nf(v, 0)} titulo={`Gasto sanitario por habitante en paridad de poder de compra, ${G.europa.año}`} limite={10} />
    </Card>
    <Card t="Sin consulta por la lista de espera" lead={iw >= 0 ? <>En {W.años[iw]}, el <b>{nf(W.ES[iw]!, 1)} %</b> de los adultos dijo que necesitó ir al médico y no fue por la lista de espera{W.ue[iw] != null && <> (en la UE, {nf(W.ue[iw]!, 1)} %)</>}. Por lo caro, solo el {nf(W.caro[iw] ?? 0, 1)} %.</> : null} fuente={L_ESP}>
      <LineChart titulo="Personas que no fueron al médico por la lista de espera" alto={220} fx={v => String(v)} fy={v => `${nf(v, 1)} %`} yMin={0} series={[
        { id: 'es', nombre: 'España', color: ACC, datos: pts(W.años, W.ES) },
        { id: 'ue', nombre: 'UE', datos: pts(W.años, W.ue), fondo: true },
      ]} />
    </Card>
    <Card t={`Por nivel de ingresos, ${W.quintiles.año}`} lead={q[0] != null && q[4] != null ? <>Entre el 20 % que menos ingresa, el {nf(q[0]!, 1)} %; entre el 20 % que más, el {nf(q[4]!, 1)} %. {pw > 0 && <>De los {W.europa.paises.length} países de la UE, España es el {pw}.º con más gente sin consulta por la lista de espera.</>}</> : null} fuente={L_ESP}>
      <Columnas titulo="Personas sin consulta por lista de espera, por quintil de ingresos" fmt={v => `${nf(v, 1)} %`} items={['20 % más pobre', 'Segundo', 'Tercero', 'Cuarto', '20 % más rico'].map((x, k) => ({ x, valor: q[k] ?? 0, color: ACC }))} alto={200} />
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<D | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/sanidad.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'vida')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><HeartPulse size={28} /><p>Tomando el pulso…</p></main>
  const C = d.causas, tot = C.capitulos.find(c => c.id === 'I-XXII'), it = tot ? ult(tot.T) : -1
  const V = d.vida, iv = ult(V.T)
  const S = d.semanas, ip = S.v.reduce<number>((b, v, k) => ((v ?? 0) > (S.v[b] ?? 0) ? k : b), 0)
  const vc = Object.entries(d.vidaCcaa.ccaa).map(([n, s]) => ({ n, v: s.T.at(-1) ?? null })).filter((x): x is { n: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const v65 = V.T65[iv]
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Sanidad y salud</h1>
          <p>Cuánto vivimos, de qué morimos y cómo es el sistema · INE y Eurostat</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'vida' && <Vida d={d} />}
        {sec === 'causas' && <Causas d={d} />}
        {sec === 'latido' && <Semanas d={d} />}
        {sec === 'sistema' && <Sistema d={d} />}
      </motion.div>
      <Curiosidades titulo="¿Sabías que…?" items={[
        it >= 0 ? <>En {C.años[it]} murieron en España <b>{nf(tot!.T[it]! / 365, 0)} personas al día</b> de media.</> : null,
        v65 != null ? <>Quien cumple 65 años en España vive, de media, <b>otros {nf(v65, 1)} años</b>.</> : null,
        S.s[ip] ? <>La semana con más muertes desde 2010 fue la de <b>{semanaLarga(S.s[ip])}</b>, en plena primera ola de covid: {nf(S.v[ip]!, 0)}.</> : null,
        vc.length > 1 ? <>Entre {vc[0].n} y {vc.at(-1)!.n} hay <b>{nf(vc[0].v - vc.at(-1)!.v, 1)} años</b> de diferencia en esperanza de vida.</> : null,
      ]} />
      <Fuentes ids={[]} extra={[
        { n: 'Eurostat · Esperanza de vida (demo_mlexpec y demo_r_mlifexp)', u: 'https://ec.europa.eu/eurostat/databrowser/view/demo_mlexpec/default/table?lang=es' },
        { n: 'INE · Defunciones según la causa de muerte', u: 'https://www.ine.es/jaxiT3/Tabla.htm?t=73035' },
        { n: 'Eurostat · Muertes semanales (demo_r_mwk_ts)', u: 'https://ec.europa.eu/eurostat/databrowser/view/demo_r_mwk_ts/default/table?lang=es' },
        { n: 'Eurostat · Exceso de mortalidad (demo_mexrt)', u: 'https://ec.europa.eu/eurostat/databrowser/view/demo_mexrt/default/table?lang=es' },
        { n: 'Eurostat · Médicos y camas por región', u: 'https://ec.europa.eu/eurostat/databrowser/view/hlth_rs_physreg/default/table?lang=es' },
        { n: 'Eurostat · Gasto sanitario (hlth_sha11_hf)', u: 'https://ec.europa.eu/eurostat/databrowser/view/hlth_sha11_hf/default/table?lang=es' },
        { n: 'Eurostat · Necesidades médicas no atendidas (hlth_silc_08)', u: 'https://ec.europa.eu/eurostat/databrowser/view/hlth_silc_08/default/table?lang=es' },
      ]} />
      <p className="src">Esperanza de vida: los años que viviría de media quien nace ese año si la mortalidad de cada edad no cambiara. Las muertes de las últimas semanas son provisionales y suben al completarse. Datos de {d.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
