import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Building2, Gauge, LineChart as LineIcon, Map as MapIcon, Pause, Play, Search, ShieldAlert, X } from 'lucide-react'
import { Barras, CountUp, LineChart, nf, type Serie } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { radar } from '../holo3d/modelos'
import { MapaProvincias, colorEscala } from '../geo/MapaProvincias'
import { PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#7b86ff'
type Serie16 = (number | null)[]
type Datos = {
  fecha: string; años: number[]; tipos: { k: string; n: string; nivel: number }[]
  prov: Record<string, Record<string, Serie16>>; pob: Record<string, Serie16>
  balance: { año: number; trimestre: number; periodos: [string, string]; tipos: { k: string; n: string }[]; prov: Record<string, Record<string, [number | null, number | null]>> } | null
}
type Munis = { fecha: string; años: number[]; muni: Record<string, { n: string; pob: Serie16; d: Record<string, Serie16> }> }

const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'evolucion', nombre: 'Desde 2010', icon: LineIcon },
  { id: 'mapa', nombre: 'Por provincias', icon: MapIcon },
  { id: 'ciudades', nombre: 'Ciudades', icon: Building2 },
] as const
type Sec = (typeof SECCIONES)[number]['id']

/**
 * Los delitos que se enseñan, en orden fijo y con su color fijo (el color sigue al delito, no a su puesto).
 * `s` es la clave de la serie anual (numeración del Código Penal); `b`, la del balance trimestral y los municipios.
 */
const TIPOS: { id: string; n: string; uno: string; s: string; b?: string; c: string }[] = [
  { id: 'total', n: 'Todos los delitos', uno: 'un delito', s: 'total', b: 'total', c: '#7b86ff' },
  { id: 'hurtos', n: 'Hurtos', uno: 'un hurto', s: 's5_1', b: 'hurtos', c: '#5fd3e8' },
  { id: 'estafas', n: 'Estafas por internet', uno: 'una estafa por internet', s: 's5_5_1', b: 'estafas', c: '#ff6fae' },
  { id: 'viviendas', n: 'Robos en viviendas', uno: 'un robo en una vivienda', s: 's5_2_2', b: 'domicilios', c: '#ffd166' },
  { id: 'violencia', n: 'Robos con violencia', uno: 'un robo con violencia', s: 's5_3', b: 'violencia', c: '#ff9f6e' },
  { id: 'vehiculos', n: 'Robos de vehículos', uno: 'un robo de vehículo', s: 's5_4', b: 'vehiculos', c: '#c6f25e' },
  { id: 'lesiones', n: 'Lesiones', uno: 'unas lesiones', s: 's1_2', b: 'lesiones', c: '#f78f6b' },
  { id: 'sexual', n: 'Contra la libertad sexual', uno: 'un delito sexual', s: 's3', b: 'sexual', c: '#e0a8ff' },
  { id: 'drogas', n: 'Tráfico de drogas', uno: 'un caso de tráfico de drogas', s: 's6_1', b: 'drogas', c: '#3df5b0' },
  { id: 'homicidios', n: 'Homicidios', uno: 'un homicidio', s: 's1_1_1', b: 'homicidio', c: '#ff5c6c' },
]
const tipo = (id: string) => TIPOS.find(t => t.id === id) ?? TIPOS[0]
const pct = (a: number, b: number) => ((a - b) / b) * 100
const signo = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), d)} %`
const AÑO = 365.25 * 86400
const bonito = (n: string) => n.replace(/^(.*), (El|La|Los|Las|Els|Les|O|A|As|Os|Es|Sa|Ses)$/, '$2 $1').replace(/^(.*), (L')$/, '$2$1')

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const MIR = <a href="https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/" target="_blank" rel="noopener noreferrer">Ministerio del Interior, Portal Estadístico de Criminalidad</a>

/** Valor de una serie en un año (índice del vector de años). */
const v = (d: Datos, cod: string, s: string, i: number) => d.prov[cod]?.[s]?.[i] ?? null
/** Tasa por 1.000 habitantes (o por 100.000 si el delito es raro). */
function porHab(d: Datos, s: string, i: number) {
  const n = v(d, '00', s, i), p = d.pob['00']?.[i]
  const por = n != null && p && (n / p) * 1000 < 0.5 ? 100000 : 1000
  return { por, f: (cod: string, j = i) => { const x = v(d, cod, s, j), q = d.pob[cod]?.[j]; return x != null && q ? (x / q) * por : null } }
}
const cada = (seg: number) => seg < 90 ? `${nf(seg, 0)} segundos` : seg < 5400 ? `${nf(seg / 60, seg < 600 ? 1 : 0)} minutos` : seg < 2 * 86400 ? `${nf(seg / 3600, seg < 36000 ? 1 : 0)} horas` : `${nf(seg / 86400, 0)} días`

function Chips({ sel, set, multi, tipos = TIPOS }: { sel: string[]; set: (id: string) => void; multi?: boolean; tipos?: typeof TIPOS }) {
  return <div className="chips" role={multi ? 'group' : 'radiogroup'} aria-label="Tipo de delito">
    {tipos.map(t => {
      const on = sel.includes(t.id)
      return <button key={t.id} role={multi ? undefined : 'radio'} aria-pressed={multi ? on : undefined} aria-checked={multi ? undefined : on} className={on ? 'is-on' : ''} style={{ '--c': t.c } as React.CSSProperties} onClick={() => set(t.id)}><i />{t.n}</button>
    })}
  </div>
}

/**
 * El reloj del delito: cada cuánto se conoce uno de cada tipo, con un anillo que se llena a ese ritmo,
 * y la cuenta de los que se han conocido en España desde que se abrió la página.
 */
function Reloj({ d }: { d: Datos }) {
  const i = d.años.length - 1, reduce = useReducedMotion()
  const [t0] = useState(() => performance.now()), [ahora, setAhora] = useState(t0)
  useEffect(() => { if (reduce) return; const id = setInterval(() => setAhora(performance.now()), 250); return () => clearInterval(id) }, [reduce])
  const filas = TIPOS.map(t => ({ t, n: v(d, '00', t.s, i) })).filter((x): x is { t: (typeof TIPOS)[number]; n: number } => !!x.n).map(x => ({ ...x, seg: AÑO / x.n }))
  const seg = (ahora - t0) / 1000, total = filas[0]
  return <div className="reloj">
    {total && <p className="reloj-cuenta" aria-live="off"><b>{nf(Math.floor((seg * total.n) / AÑO))}</b> delitos conocidos en España desde que abriste esta página <small>(al ritmo de {d.años[i]})</small></p>}
    <ul>{filas.map(({ t, seg: s }) => {
      const rueda = s <= 900
      return <li key={t.id} style={{ '--c': t.c, '--dur': `${s}s` } as React.CSSProperties}>
        <svg viewBox="0 0 36 36" aria-hidden className={rueda && !reduce ? 'gira' : ''}><circle r="15" cx="18" cy="18" className="r-fondo" /><circle r="15" cx="18" cy="18" className="r-arco" pathLength={100} /></svg>
        <span><b>{t.uno.charAt(0).toUpperCase() + t.uno.slice(1)}</b> cada {cada(s)}</span>
      </li>
    })}</ul>
  </div>
}

function Resumen({ d, go }: { d: Datos; go: (s: Sec) => void }) {
  const i = d.años.length - 1, A = d.años[i]
  const tot = v(d, '00', 'total', i) ?? 0, ant = v(d, '00', 'total', i - 1) ?? 0
  const tasa = tot / (d.pob['00']?.[i] ?? 1) * 1000, tasa0 = (v(d, '00', 'total', 0) ?? 0) / (d.pob['00']?.[0] ?? 1) * 1000
  const hom = v(d, '00', 's1_1_1', i) ?? 0, homA = v(d, '00', 's1_1_1', i - 1) ?? 0
  const b = d.balance, bn = b?.prov['00']
  const bTot = bn?.total, bCiber = bn?.ciber
  const partes = TIPOS.slice(1).map(t => v(d, '00', t.s, i) ?? 0), mx = Math.max(...partes)
  const modelo = useMemo(() => radar(partes.map(p => p / mx)), [partes.join()])
  return <>
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={modelo} color={ACC} alto={270} giro={0.18} etiqueta={`Radar de ${A}: una columna por tipo de delito, más alta cuantos más casos`} />
        <div className="sala-dato">
          <span className="sala-k">Delitos conocidos en {A}</span>
          <b><CountUp value={tot} fmt={x => nf(x)} /></b>
          <span>{ant ? <>{tot >= ant ? 'Suben' : 'Bajan'} un <b>{nf(Math.abs(pct(tot, ant)), 1)} %</b> respecto a {A - 1}.</> : null} Son <b>{nf(tasa, 1)}</b> por cada 1.000 habitantes; en {d.años[0]} eran {nf(tasa0, 1)}.</span>
        </div>
      </div>
      <Reloj d={d} />
    </section>
    <div className="kpis">
      <button className="kpi" onClick={() => go('evolucion')}><span className="kpi-l">Homicidios consumados en {A}</span><span className="kpi-v"><CountUp value={hom} fmt={x => nf(x)} /></span><span className={`kpi-d ${hom > homA ? 'is-bad' : 'is-good'}`}>{homA ? `${signo(pct(hom, homA), 1)} frente a ${A - 1}` : ''}</span></button>
      {bTot?.[1] != null && bTot[0] ? <button className="kpi" onClick={() => go('mapa')}><span className="kpi-l">De {b!.periodos[1]}</span><span className="kpi-v"><CountUp value={bTot[1]} fmt={x => nf(x)} /></span><span className={`kpi-d ${bTot[1] > bTot[0] ? 'is-bad' : 'is-good'}`}>{signo(pct(bTot[1], bTot[0]), 1)} frente a {b!.periodos[0].replace(/^.*?(\d{4})$/, '$1')}</span></button> : null}
      {bCiber?.[1] != null && bTot?.[1] ? <button className="kpi" onClick={() => go('evolucion')}><span className="kpi-l">Por internet</span><span className="kpi-v">{nf((bCiber[1] / bTot[1]) * 100, 1)} %</span><span className="kpi-d">de los delitos de {b!.periodos[1]}{bCiber[0] ? `; ${signo(pct(bCiber[1], bCiber[0]), 1)} en un año` : ''}</span></button> : null}
      <button className="kpi" onClick={() => go('ciudades')}><span className="kpi-l">Cada día</span><span className="kpi-v"><CountUp value={tot / 365.25} fmt={x => nf(x)} /></span><span className="kpi-d">delitos conocidos de media en {A}</span></button>
    </div>
  </>
}

const MARCAS = (d: Datos, y: (a: number) => number | null) => [
  { a: 2015, texto: '2015: las faltas pasan a delitos leves' }, { a: 2020, texto: '2020: confinamiento' },
].flatMap(m => { const yy = y(m.a); return d.años.includes(m.a) && yy != null ? [{ x: m.a, y: yy, texto: m.texto, tono: 'bajo' as const }] : [] })

function Evolucion({ d }: { d: Datos }) {
  const [sel, setSel] = useState<string[]>(['hurtos', 'viviendas', 'violencia', 'vehiculos'])
  const [modo, setModo] = useState<'indice' | 'numero'>('indice')
  const base = d.años.indexOf(2016)
  const toggle = (id: string) => setSel(s => s.includes(id) ? (s.length > 1 ? s.filter(x => x !== id) : s) : [...s, id].slice(-5))
  const series: Serie[] = sel.map(id => {
    const t = tipo(id), s = d.prov['00']?.[t.s] ?? [], b0 = s[base] ?? null
    return { id, nombre: t.n, color: t.c, datos: d.años.flatMap((a, i) => { const x = s[i]; if (x == null) return []; return modo === 'numero' ? [[a, x]] : b0 && a >= 2016 ? [[a, (x / b0) * 100]] : [] }) as [number, number][] }
  })
  // lo que más sube y más baja desde 2016 (antes, la reforma de 2015 rompe muchas series)
  const i = d.años.length - 1
  const cambios = d.tipos.filter(t => t.nivel === 2 && !/^otros|^resto/i.test(t.n)).map(t => ({ t, a: v(d, '00', t.k, base), b: v(d, '00', t.k, i) })).filter((x): x is { t: (typeof d.tipos)[number]; a: number; b: number } => !!x.a && x.b != null && x.a >= 500).map(x => ({ ...x, c: pct(x.b, x.a) })).sort((p, q) => q.c - p.c)
  const est = tipo('estafas'), e0 = v(d, '00', est.s, base), e1 = v(d, '00', est.s, i)
  const viv = tipo('viviendas'), v0 = v(d, '00', viv.s, base), v1 = v(d, '00', viv.s, i)
  const hur = tipo('hurtos'), serieDe = (t: (typeof TIPOS)[number]) => d.años.flatMap((a, k) => { const x = v(d, '00', t.s, k); return a >= 2016 && x != null ? [[a, x]] : [] }) as [number, number][]
  const h0 = v(d, '00', hur.s, base), h1 = v(d, '00', hur.s, i)
  return <div className="graficos">
    <Card wide t="Del bolsillo a la pantalla" lead={<>{h0 && e0 && h1 && e1 ? <>En 2016 había <b>{nf(h0 / e0, 0)}</b> hurtos por cada estafa por internet; en {d.años[i]}, <b>{nf(h1 / e1, 1)}</b>. </> : null}El robo que antes se hacía en la calle ahora llega por el móvil.</>} fuente={MIR}>
      <LineChart alto={260} titulo="Hurtos y estafas por internet" fx={a => String(a)} fy={x => nf(x)} series={[{ id: 'hurtos', nombre: hur.n, color: hur.c, datos: serieDe(hur) }, { id: 'estafas', nombre: est.n, color: est.c, area: true, datos: serieDe(est) }]} />
    </Card>
    <Card wide t="Lo que sube y lo que baja" lead={<>{e0 && e1 ? <>Desde 2016, las estafas por internet se han multiplicado por <b>{nf(e1 / e0, 1)}</b></> : null}{v0 && v1 ? <>; los robos en viviendas {v1 < v0 ? 'han bajado' : 'han subido'} un <b>{nf(Math.abs(pct(v1, v0)), 0)} %</b></> : null}. Elige qué comparar (hasta cinco).</>} fuente={MIR}>
      <Chips sel={sel} set={toggle} multi />
      <div className="modo" role="radiogroup" aria-label="Escala">{([['indice', '2016 = 100'], ['numero', 'Número de casos']] as const).map(([m, n]) => <button key={m} role="radio" aria-checked={modo === m} className={modo === m ? 'is-on' : ''} onClick={() => setModo(m)}>{n}</button>)}</div>
      <LineChart series={series} alto={300} titulo="Evolución de los delitos conocidos" fx={a => String(a)} fy={x => modo === 'numero' ? nf(x) : nf(x, 0)}
        marcas={modo === 'numero' ? MARCAS(d, a => series[0]?.datos.find(p => p[0] === a)?.[1] ?? null) : []} ahora={undefined} />
      <p className="note">{modo === 'indice' ? 'Índice: cada serie vale 100 en 2016, para comparar cuánto ha crecido cada una aunque sean de tamaños muy distintos. Empieza en 2016 porque la reforma del Código Penal de 2015 cambió cómo se cuentan muchos delitos.' : 'En 2015 desaparecieron las faltas: parte pasó a ser delito leve y parte dejó de contarse, por eso algunas series dan un salto ese año.'}</p>
    </Card>
    <Card wide t={`Cambio entre 2016 y ${d.años[i]}, por tipo`} lead={<>De {cambios.length} tipos de delito, <b>{cambios.filter(x => x.c > 0).length}</b> suben y {cambios.filter(x => x.c < 0).length} bajan. El que más sube: {cambios[0]?.t.n.toLowerCase()} ({signo(cambios[0]?.c ?? 0)}); el que más baja: {cambios.at(-1)?.t.n.toLowerCase()} ({signo(cambios.at(-1)?.c ?? 0)}).</>}>
      <Barras titulo="Cambio por tipo de delito" fmt={x => signo(x)} limite={14} items={cambios.map(x => ({ id: x.t.k, nombre: x.t.n, sub: `${nf(x.a)} → ${nf(x.b)}`, valor: x.c, color: x.c > 0 ? '#ff8a95' : '#3df5b0' }))} />
    </Card>
  </div>
}

function Mapa({ d }: { d: Datos }) {
  const [t, setT] = useState('total'), [i, setI] = useState(d.años.length - 1), [play, setPlay] = useState(false), [sel, setSel] = useState<string | null>(null)
  const reduce = useReducedMotion()
  useEffect(() => { if (!play) return; const id = setInterval(() => setI(x => { if (x >= d.años.length - 1) { setPlay(false); return x } return x + 1 }), reduce ? 1400 : 900); return () => clearInterval(id) }, [play, d.años.length, reduce])
  const T = tipo(t), { por, f } = porHab(d, T.s, i), A = d.años[i]
  const rk = Object.keys(PROV).map(c => ({ c, v: f(c) })).filter((x): x is { c: string; v: number } => x.v != null).sort((a, b) => b.v - a.v)
  const lo = rk.at(-1)?.v ?? 0, hi = rk[0]?.v ?? 1, nac = f('00')
  const ud = por === 1000 ? 'por 1.000 habitantes' : 'por 100.000 habitantes'
  const ESC = ['#161b3a', '#2c3175', '#4f58c7', '#8f98ff', '#e4e7ff']
  const elegido = sel ? f(sel) : null
  return <div className="graficos">
    <Card wide t={`${T.n} por habitante, ${A}`} lead={<>{nac != null && <>En España, <b>{nf(nac, nac < 10 ? 2 : 1)}</b> {ud}. </>}Más: <b>{PROV[rk[0]?.c]}</b> ({nf(hi, hi < 10 ? 2 : 1)}); menos: {PROV[rk.at(-1)?.c ?? '']} ({nf(lo, lo < 10 ? 2 : 1)}).{sel && elegido != null && nac ? <> {PROV[sel]}: {nf(elegido, elegido < 10 ? 2 : 1)}, un {nf(Math.abs(pct(elegido, nac)), 0)} % {elegido > nac ? 'más' : 'menos'} que la media.</> : null}</>} fuente={MIR}>
      <Chips sel={[t]} set={setT} />
      <div className="anios">
        <button className="play" onClick={() => { if (i >= d.años.length - 1) setI(0); setPlay(p => !p) }} aria-label={play ? 'Parar' : 'Reproducir los años'}>{play ? <Pause size={16} /> : <Play size={16} />}</button>
        <input type="range" min={0} max={d.años.length - 1} value={i} onChange={e => { setPlay(false); setI(+e.target.value) }} aria-label="Año" />
        <b>{A}</b>
      </div>
      <MapaProvincias valor={c => f(c)} fmt={x => `${nf(x, x < 10 ? 2 : 1)} ${ud}`} titulo={`${T.n} ${ud} en cada provincia, ${A}`} color={ACC} escala={ESC} sel={sel} onSel={setSel}
        nota="Población empadronada: donde hay mucho turismo la tasa sube, porque los visitantes también sufren y cometen delitos y no cuentan como habitantes." />
    </Card>
    <Card t="Ranking" lead={<>{T.n.toLowerCase()} {ud}, {A}.</>}>
      <Barras titulo="Ranking de provincias" fmt={x => nf(x, x < 10 ? 2 : 1)} limite={12} items={rk.map(x => ({ id: x.c, nombre: PROV[x.c], valor: x.v, destacado: sel === x.c, onClick: () => setSel(x.c), color: colorEscala(ESC.slice(1), (x.v - lo) / ((hi - lo) || 1)) }))} />
    </Card>
    <Card t={sel ? PROV[sel] : 'Elige una provincia'} lead={sel ? <>{T.n} {ud}, comparado con España.</> : 'Toca una provincia en el mapa o en el ranking para ver su evolución.'}>
      {sel && <LineChart titulo={`${T.n} en ${PROV[sel]} y en España`} alto={220} fx={a => String(a)} fy={x => nf(x, x < 10 ? 2 : 1)}
        series={[{ id: 'es', nombre: 'España', fondo: true, datos: d.años.flatMap((a, j) => { const x = f('00', j); return x == null ? [] : [[a, x]] }) as [number, number][] },
          { id: sel, nombre: PROV[sel], color: ACC, datos: d.años.flatMap((a, j) => { const x = f(sel, j); return x == null ? [] : [[a, x]] }) as [number, number][] }]} />}
    </Card>
  </div>
}

function Ciudades({ d }: { d: Datos }) {
  const [m, setM] = useState<Munis | null>(null), [err, setErr] = useState(false)
  const [q, setQ] = useState(''), [t, setT] = useState('total'), [sel, setSel] = useState<string | null>(null)
  useEffect(() => { fetch('./data/municipios.json').then(r => r.json()).then(setM, () => setErr(true)) }, [])
  useEffect(() => { if (sel) document.getElementById('ciudad-sel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) }, [sel])
  const tiposM = TIPOS.filter(x => x.b && (m ? Object.values(m.muni).some(u => u.d[x.b!]?.some(v => v != null)) : true))
  if (err) return <p className="note">No se han podido cargar los municipios.</p>
  if (!m) return <p className="note">Cargando los municipios…</p>
  const T = tipo(t), j = m.años.length - 1, A = m.años[j]
  const lista = Object.entries(m.muni).map(([c, u]) => {
    const x = u.d[T.b!]?.[j], x0 = u.d[T.b!]?.[j - 1], p = u.pob[j] ?? u.pob.findLast(v => v != null)
    return { c, n: u.n, x, x0, p, tasa: x != null && p ? (x / p) * 1000 : null }
  }).filter(u => u.tasa != null) as { c: string; n: string; x: number; x0: number | null; p: number; tasa: number }[]
  lista.sort((a, b) => b.tasa - a.tasa)
  const qn = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const vis = (q ? lista.filter(u => u.n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(qn)) : lista).slice(0, q ? 40 : 20)
  const med = lista.map(u => u.tasa).sort((a, b) => a - b)[Math.floor(lista.length / 2)] ?? 0
  const u = sel ? m.muni[sel] : null
  const xs = lista.find(x => x.c === sel), iN = d.años.indexOf(A), nN = iN >= 0 ? porHab(d, T.s, iN) : null, nac = nN && nN.por === 1000 ? nN.f('00') : null
  return <div className="graficos">
    {u && sel && <div id="ciudad-sel" className="is-wide-wrap"><Card wide t={bonito(u.n)} lead={<>Casos conocidos de {T.n.toLowerCase()} cada año{u.pob[j] ? `; ${nf(u.pob[j]!)} habitantes en ${A}` : ''}.{xs && nac ? <> Con <b>{nf(xs.tasa, 1)}</b> por 1.000 habitantes, {xs.tasa >= nac ? <>está <b>{nf(xs.tasa / nac, 1)} veces</b> por encima</> : <>está un <b>{nf(Math.abs(pct(xs.tasa, nac)), 0)} %</b> por debajo</>} de la media de España ({nf(nac, 1)}).</> : null}</>}>
      <LineChart titulo={`${T.n} en ${u.n}`} alto={220} fx={a => String(a)} ticksX={m.años.filter(a => u.d[T.b!]?.[m.años.indexOf(a)] != null).filter((_, k, l) => innerWidth > 600 || k % 2 === (l.length - 1) % 2)} fy={x => nf(x)} series={[{ id: sel, nombre: bonito(u.n), color: T.c, area: true, datos: m.años.flatMap((a, k) => { const x = u.d[T.b!]?.[k]; return x == null ? [] : [[a, x]] }) as [number, number][] }]} />
      <p className="note">Interior publica cada municipio desde que supera el umbral (30.000 habitantes hasta 2020, 20.000 desde 2021); por eso algunas series empiezan tarde. Los delitos por internet se cuentan aparte desde 2019.</p>
    </Card></div>}
    <Card wide t={`${lista.length} municipios grandes`} lead={<>{T.n} por cada 1.000 habitantes en {A}, en los municipios de más de 20.000 habitantes (y alguno más pequeño que Interior publica). La mitad está por debajo de <b>{nf(med, 1)}</b>. Busca el tuyo.</>} fuente={MIR}>
      <Chips sel={[t]} set={setT} tipos={tiposM} />
      <label className="buscar"><Search size={16} aria-hidden /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar municipio" aria-label="Buscar municipio" />{q && <button onClick={() => setQ('')} aria-label="Borrar"><X size={15} /></button>}</label>
      <ol className="munis">{vis.map(x => {
        const pos = lista.indexOf(x) + 1, cambio = x.x0 ? pct(x.x, x.x0) : null
        return <li key={x.c}><button className={sel === x.c ? 'is-on' : ''} onClick={() => setSel(x.c)}>
          <span className="mu-pos">{pos}</span><span className="mu-n">{bonito(x.n)}<small>{PROV[x.c.slice(0, 2)]} · {nf(x.p)} hab.</small></span>
          <span className="mu-b"><i style={{ width: `${(x.tasa / lista[0].tasa) * 100}%`, background: T.c }} /></span>
          <b>{nf(x.tasa, x.tasa < 10 ? 2 : 1)}</b><small className={cambio == null ? '' : cambio > 0 ? 'is-bad' : 'is-good'}>{cambio == null ? '' : signo(cambio)}</small>
        </button></li>
      })}</ol>
      {!vis.length && <p className="note">No hay ningún municipio con ese nombre en la lista de Interior.</p>}
      <p className="note">Los delitos se cuentan donde ocurren, no donde vive quien los sufre: los municipios con aeropuerto (El Prat), mucho turismo o grandes centros comerciales salen con tasas altas.</p>
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/seguridad.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d) return <main className="eco boot"><ShieldAlert size={28} /><p>Cargando los datos de seguridad…</p></main>
  const i = d.años.length - 1, A = d.años[i]
  const tot = v(d, '00', 'total', i) ?? 0
  const rk = Object.keys(PROV).map(c => ({ c, x: (v(d, c, 'total', i) ?? 0) / (d.pob[c]?.[i] ?? Infinity) * 1000 })).filter(x => x.x > 0).sort((a, b) => b.x - a.x)
  const c19 = d.años.indexOf(2019), c20 = d.años.indexOf(2020)
  const viv = d.prov['00']?.s5_2_2 ?? [], vMax = Math.max(...viv.map(x => x ?? 0)), vMaxA = d.años[viv.indexOf(vMax)]
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Seguridad</h1>
          <p>Delitos conocidos por la policía · Ministerio del Interior</p>
        </div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      <motion.div key={sec} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} go={go} />}
        {sec === 'evolucion' && <Evolucion d={d} />}
        {sec === 'mapa' && <Mapa d={d} />}
        {sec === 'ciudades' && <Ciudades d={d} />}
      </motion.div>
      {sec === 'resumen' && <Curiosidades titulo="¿Sabías que…?" items={[
        <>Cada día de {A} se conocieron de media <b>{nf(tot / 365.25)}</b> delitos: uno cada {cada(AÑO / tot)}.</>,
        rk.length > 2 && <>La provincia con más delitos por habitante es <b>{PROV[rk[0].c]}</b> ({nf(rk[0].x, 1)} por 1.000) y la que menos, {PROV[rk.at(-1)!.c]} ({nf(rk.at(-1)!.x, 1)}): {nf(rk[0].x / rk.at(-1)!.x, 1)} veces menos.</>,
        c19 >= 0 && c20 >= 0 && (() => { const a = v(d, '00', 'total', c19), b = v(d, '00', 'total', c20); return a && b ? <>Con el confinamiento de 2020, los delitos conocidos {b < a ? 'cayeron' : 'subieron'} un <b>{nf(Math.abs(pct(b, a)), 0)} %</b> respecto a 2019.</> : null })(),
        vMax > 0 && viv[i] != null && <>El peor año de robos en viviendas fue <b>{vMaxA}</b>, con {nf(vMax)}; en {A} hubo {nf(viv[i]!)}.</>,
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'Ministerio del Interior · Series anuales de hechos conocidos', u: 'https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/seriesAnuales' }, { n: 'Balances trimestrales de criminalidad', u: 'https://estadisticasdecriminalidad.ses.mir.es/publico/portalestadistico/balances' }, { n: 'INE · Padrón municipal', u: 'https://www.ine.es/dynt3/inebase/index.htm?padre=517' }]} />
      <p className="src">Hechos conocidos: lo que se denuncia y lo que descubre la policía (Policía Nacional, Guardia Civil, policías autonómicas y policías locales que envían sus datos). No es toda la delincuencia, porque mucha no se denuncia, y cambia cuando cambia la forma de registrar. Las tasas usan la población empadronada. Datos de {d.fecha.split('-').reverse().join('/')}.</p>
    </main>
  )
}
