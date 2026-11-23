import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Building2, Coins, Gauge, Search, Target, Trophy, Users } from 'lucide-react'
import { Barras, ColApiladas, CountUp, nf } from '../graficos'
import { Holo3D } from '../holo3d/Holo3D'
import { monedas } from '../holo3d/modelos'
import { MapaProvincias, colorEscala } from '../geo/MapaProvincias'
import { CCAA_DE_PROV } from '../poblacion/geo'
import { Fuentes } from '../Fuentes'
import { Curiosidades } from '../Curiosidades'

const ACC = '#e0a8ff'
type Par = [number, number]
type Agg = {
  n: number; imp: number; adm: Record<string, Par>; fin: Record<string, Par>; tipo: Record<string, Par>; inst: Record<string, Par>; org: Record<string, Par>
  ben: [string, number, number, string][]; conv: [string, number, number, string, string, string, string][]; meses: string[]
}
type Datos = { fecha: string; finalidades: Record<string, string>; serie: [string, number, number, number, number, number, number, number][]; años: Record<string, Agg>; u12: Agg | null }

const ADM: Record<string, [string, string, string]> = { E: ['Estado', 'Ministerios y organismos estatales', '#9fc5ff'], A: ['Comunidades autónomas', 'Gobiernos autonómicos', '#ffd166'], L: ['Entidades locales', 'Ayuntamientos, diputaciones, cabildos', '#c6f25e'], O: ['Otros', 'Universidades y otros organismos', '#8a9bb0'] }
const NIF: Record<string, string> = {
  A: 'Sociedades anónimas', B: 'Sociedades limitadas', C: 'Sociedades colectivas', D: 'Sociedades comanditarias', E: 'Comunidades de bienes', F: 'Cooperativas', G: 'Asociaciones y fundaciones', H: 'Comunidades de propietarios',
  J: 'Sociedades civiles', N: 'Entidades extranjeras', P: 'Ayuntamientos y entes locales', Q: 'Organismos públicos (universidades, hospitales…)', R: 'Entidades religiosas', S: 'Órganos de la Administración', U: 'Uniones temporales de empresas', V: 'Otras entidades', W: 'Sucursales de empresas extranjeras',
  PF: 'Personas físicas (autónomos, particulares, becarios…)', X: 'Otros identificadores (extranjeros…)',
}
const GRUPO: Record<string, [string, string]> = { empresas: ['Empresas', '#3987e5'], social: ['Asociaciones, fundaciones y cooperativas', '#d55181'], publico: ['Otras administraciones y entes públicos', '#7fd4c8'], personas: ['Personas físicas', '#ffd166'], otros: ['Otros', '#8a9bb0'] }
const grupo = (l: string) => 'ABCDJUW'.includes(l) && l.length === 1 ? 'empresas' : 'FGRH'.includes(l) && l.length === 1 ? 'social' : 'PQS'.includes(l) && l.length === 1 ? 'publico' : l === 'PF' ? 'personas' : 'otros'
const CCAA_BDNS: [RegExp, string][] = [[/andaluc/, 'Andalucía'], [/aragon/, 'Aragón'], [/asturias/, 'Asturias'], [/balear/, 'Illes Balears'], [/canarias/, 'Canarias'], [/cantabria/, 'Cantabria'], [/mancha/, 'Castilla-La Mancha'], [/leon/, 'Castilla y León'], [/catalu/, 'Cataluña'], [/valencia/, 'C. Valenciana'], [/extremadura/, 'Extremadura'], [/galicia/, 'Galicia'], [/madrid/, 'Madrid'], [/murcia/, 'Murcia'], [/navarra/, 'Navarra'], [/vasco|euskadi/, 'País Vasco'], [/rioja/, 'La Rioja'], [/ceuta/, 'Ceuta'], [/melilla/, 'Melilla']]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ccaaDe = (s: string) => CCAA_BDNS.find(([r]) => r.test(norm(s)))?.[1] ?? null
const FIN_COLOR = ['#3987e5', '#199e70', '#ffd166', '#d95926', '#9085e9', '#d55181', '#c6f25e', '#5fd3e8', '#f2b880', '#e0a8ff', '#9fc5ff', '#8a9bb0']
const capital = (s: string) => s.toLowerCase().replace(/(^|[\s(.,-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y|E|El|En|Para|Por|A|Al|Con|Sin)\b/g, w => w.toLowerCase()).replace(/\b(Sa|Sl|Slu|Sau|Ute|Sll|Scl|Sat)\b/g, w => w.toUpperCase())

const SECCIONES = [
  { id: 'resumen', nombre: 'Resumen', icon: Gauge },
  { id: 'quien', nombre: 'Quién las da', icon: Building2 },
  { id: 'para', nombre: 'Para qué', icon: Target },
  { id: 'aquien', nombre: 'A quién', icon: Users },
  { id: 'grandes', nombre: 'Las más grandes', icon: Trophy },
] as const
type Sec = (typeof SECCIONES)[number]['id']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const per = (k: string) => `${MES[+k.slice(5) - 1]} ${k.slice(0, 4)}`
/** euros → «12,3 mil M€» / «845 M€» / «12.300 €» */
const eu = (v: number) => (v >= 1e9 ? `${nf(v / 1e9, 1)} mil M€` : v >= 1e6 ? `${nf(v / 1e6, v >= 1e8 ? 0 : 1)} M€` : `${nf(v)} €`)

function Card({ t, lead, children, wide, fuente }: { t: string; lead?: ReactNode; children: ReactNode; wide?: boolean; fuente?: ReactNode }) {
  return <section className={`gcard ${wide ? 'is-wide' : ''}`}><h2>{t}</h2>{lead && <p className="lead">{lead}</p>}{children}{fuente && <p className="fuente">{fuente}</p>}</section>
}
const BDNS = <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/concesiones" target="_blank" rel="noopener noreferrer">BDNS, concesiones</a>
const nombreP = (k: string) => (k === 'u12' ? 'los últimos 12 meses' : k)

function Resumen({ d, a, k, go }: { d: Datos; a: Agg; k: string; go: (s: Sec) => void }) {
  const tot = a.imp, ad = ['E', 'A', 'L', 'O'].map(x => ({ x, v: a.adm[x]?.[1] ?? 0 }))
  const top = [...ad].sort((p, q) => q.v - p.v)[0]
  const fin = Object.entries(a.fin).sort((p, q) => q[1][1] - p[1][1])[0]
  const pf = a.tipo.PF
  const s = d.serie.filter(x => x[0] < d.fecha.slice(0, 7))
  return <div className="graficos">
    <section className="sala gcard is-wide">
      <div className="sala-holo">
        <Holo3D modelo={monedas(ad.map(x => x.v / Math.max(...ad.map(y => y.v))))} color={ACC} alto={250} etiqueta="Holograma: pilas de monedas, una por cada administración" />
        <div className="sala-dato">
          <span className="sala-k">Ayudas públicas concedidas, {nombreP(k)}</span>
          <b><CountUp value={tot / 1e9} fmt={v => `${nf(v, 1)} mil M€`} /></b>
          <span>en <b>{nf(a.n)}</b> concesiones, de media {eu(tot / a.n)} cada una. Las que más dan: <b>{ADM[top.x][0].toLowerCase()}</b> ({nf((top.v / tot) * 100, 0)} %). La finalidad con más dinero: {(d.finalidades[fin?.[0]] ?? '').toLowerCase()}.</span>
        </div>
      </div>
    </section>
    <div className="kpis is-wide">
      {ad.filter(x => x.v > 0).map(x => <button key={x.x} className="kpi" onClick={() => go('quien')}><span className="kpi-l"><i className="pto" style={{ background: ADM[x.x][2] }} />{ADM[x.x][0]}</span><span className="kpi-v"><CountUp value={x.v / 1e9} fmt={v => `${nf(v, 1)} mil M€`} /></span><span className="kpi-p">{nf(a.adm[x.x][0])} concesiones</span></button>)}
      {pf && <button className="kpi" onClick={() => go('aquien')}><span className="kpi-l">A personas físicas</span><span className="kpi-v"><CountUp value={(pf[0] / a.n) * 100} fmt={v => `${nf(v, 0)} %`} /></span><span className="kpi-p">de las concesiones, {nf((pf[1] / tot) * 100, 0)} % del dinero</span></button>}
    </div>
    <Card t="Mes a mes" wide lead={(() => { const m = s.reduce((x, y) => (y[2] > x[2] ? y : x), s[0]); return m && <>Ayudas concedidas cada mes, por quién las da. El mes con más dinero fue <b>{per(m[0])}</b> ({eu(m[2])}). El mes en curso aún se está llenando: las administraciones registran las concesiones con días o semanas de retraso.</> })()} fuente={BDNS}>
      <ColApiladas xs={d.serie.map(x => per(x[0]))} tramos={['E', 'A', 'L', 'O'].map((x, i) => ({ id: x, nombre: ADM[x][0], color: ADM[x][2], v: d.serie.map(r => Number(r[3 + i]) / 1e6) }))} titulo="Ayudas concedidas al mes, en millones de euros" fy={v => `${nf(v)} M€`} cadaX={3} alto={240} />
    </Card>
  </div>
}

function Quien({ a, k }: { a: Agg; k: string }) {
  const [sel, setSel] = useState<string | null>(null)
  const [pob, setPob] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    fetch('../poblacion/data/municipios.json').then(r => r.json()).then((j: { m: Record<string, [string, number[]]> }) => {
      const m = new Map<string, number>()
      for (const [c, v] of Object.entries(j.m)) { const cc = CCAA_DE_PROV[c.padStart(5, '0').slice(0, 2)]; if (cc) m.set(cc, (m.get(cc) ?? 0) + (v[1].at(-1) ?? 0)) }
      setPob(m)
    }, () => {})
  }, [])
  const porCcaa = new Map<string, number>()
  for (const [o, v] of Object.entries(a.org)) if (o.startsWith('A|')) { const c = ccaaDe(o.slice(2)); if (c) porCcaa.set(c, (porCcaa.get(c) ?? 0) + v[1]) }
  const val = (c: string) => { const v = porCcaa.get(c); return v == null ? null : pob?.get(c) ? v / pob.get(c)! : null }
  const rk = [...porCcaa.keys()].map(c => ({ c, v: val(c) ?? 0, t: porCcaa.get(c)! })).sort((x, y) => y.v - x.v)
  const lo = rk.at(-1)?.v ?? 0, hi = rk[0]?.v ?? 1
  const min = Object.entries(a.org).filter(([o]) => o.startsWith('E|')).map(([o, v]) => ({ id: o, nombre: capital(o.slice(2)), valor: v[1], sub: `${nf(v[0])} concesiones` })).sort((x, y) => y.valor - x.valor)
  const loc = Object.entries(a.org).filter(([o]) => o.startsWith('L|') || o.startsWith('O|')).map(([o, v]) => ({ id: o, nombre: capital(o.slice(2)), valor: v[1], color: o.startsWith('L|') ? ADM.L[2] : ADM.O[2], sub: `${nf(v[0])} concesiones` })).sort((x, y) => y.valor - x.valor)
  return <div className="graficos">
    <Card t={`Lo que da cada comunidad, ${nombreP(k)}`} lead={<>Ayudas de los gobiernos autonómicos, en euros por habitante. Más dan: <b>{rk[0]?.c}</b> ({nf(rk[0]?.v ?? 0)} €/hab.); menos: {rk.at(-1)?.c} ({nf(lo)} €/hab.). Toca el mapa.</>} fuente={BDNS}>
      {pob ? <MapaProvincias grupo={c => CCAA_DE_PROV[c] ?? null} claveGrupo="ccaa" valor={c => val(c)} fmt={v => `${nf(v)} €/hab.`} titulo="Ayudas autonómicas por habitante" color={ACC} escala={['#24434b', '#6b4f86', '#a76fd0', '#e0a8ff', '#f6e3ff']} sel={sel} onSel={setSel} nota={sel ? `${sel}: ${eu(porCcaa.get(sel) ?? 0)} en total` : 'Cuanto más claro, más ayudas por habitante. No incluye las ayudas del Estado ni de los ayuntamientos.'} /> : <p className="note">Cargando población…</p>}
    </Card>
    <Card t="Ranking de comunidades">
      <Barras titulo="Ayudas autonómicas por habitante" fmt={v => `${nf(v)} €/hab.`} limite={19} items={rk.map(x => ({ id: x.c, nombre: x.c, sub: eu(x.t), valor: x.v, destacado: sel === x.c, onClick: () => setSel(x.c), color: colorEscala(['#6b4f86', '#a76fd0', '#e0a8ff', '#f6e3ff'], (x.v - lo) / ((hi - lo) || 1)) }))} />
    </Card>
    <Card t="Ministerios y organismos del Estado" fuente={BDNS}>
      <Barras titulo="Ayudas del Estado por ministerio" fmt={eu} limite={10} items={min.map(x => ({ ...x, color: ADM.E[2] }))} />
    </Card>
    <Card t="Diputaciones, ayuntamientos y otros" lead={<>Los que más conceden entre entidades locales, universidades y otros organismos.</>} fuente={BDNS}>
      <Barras titulo="Ayudas de entidades locales y otros" fmt={eu} limite={10} items={loc} />
    </Card>
  </div>
}

function Para({ d, a }: { d: Datos; a: Agg }) {
  const fs = Object.entries(a.fin).map(([id, v], i) => ({ id, nombre: capital(d.finalidades[id] ?? id), valor: v[1], n: v[0], i })).sort((x, y) => y.valor - x.valor)
  const tot = fs.reduce((s, x) => s + x.valor, 0)
  const inst = Object.entries(a.inst).map(([n, v]) => ({ id: n, nombre: capital(n), valor: v[1], sub: `${nf(v[0])} concesiones` })).sort((x, y) => y.valor - x.valor)
  return <div className="graficos">
    <Card t="Para qué se dan" wide lead={<>Por finalidad, según la política de gasto que declara cada convocatoria. Encabeza <b>{fs[0]?.nombre.toLowerCase()}</b> con {nf((fs[0]?.valor / tot) * 100, 0)} de cada 100 euros.</>} fuente={BDNS}>
      <div className="mosaico" role="img" aria-label="Reparto de las ayudas por finalidad">
        {fs.map((f, i) => <motion.div key={f.id} className="tesela" style={{ flexGrow: f.valor, background: `color-mix(in oklab, ${FIN_COLOR[i % FIN_COLOR.length]} 30%, #07141d)`, borderColor: FIN_COLOR[i % FIN_COLOR.length] }} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} title={`${f.nombre}: ${eu(f.valor)}`}>
          {f.valor / tot > 0.035 && <><b>{nf((f.valor / tot) * 100, 0)} %</b><span>{f.nombre}</span></>}
        </motion.div>)}
      </div>
      <Barras titulo="Ayudas por finalidad" fmt={eu} limite={8} items={fs.map((f, i) => ({ id: f.id, nombre: f.nombre, sub: `${nf(f.n)} concesiones`, valor: f.valor, color: FIN_COLOR[i % FIN_COLOR.length] }))} />
    </Card>
    <Card t="Cómo se dan" wide lead={<>No todo es dinero a fondo perdido: también hay préstamos, garantías y ventajas fiscales. La cifra es el importe concedido.</>} fuente={BDNS}>
      <Barras titulo="Ayudas por instrumento" fmt={eu} items={inst.map(x => ({ ...x, color: ACC }))} />
    </Card>
  </div>
}

function AQuien({ a }: { a: Agg }) {
  const [q, setQ] = useState('')
  const grupos = Object.keys(GRUPO).map(g => ({ g, n: 0, v: 0 }))
  for (const [l, v] of Object.entries(a.tipo)) { const x = grupos.find(y => y.g === grupo(l))!; x.n += v[0]; x.v += v[1] }
  const tot = grupos.reduce((s, x) => s + x.v, 0), totN = grupos.reduce((s, x) => s + x.n, 0)
  const tipos = Object.entries(a.tipo).map(([l, v]) => ({ id: l, nombre: NIF[l] ?? l, valor: v[1], sub: `${nf(v[0])} concesiones`, color: GRUPO[grupo(l)][1] })).sort((x, y) => y.valor - x.valor)
  const ben = a.ben.filter(b => !'EJH'.includes(b[0][0])).filter(b => !q || norm(b[3]).includes(norm(q)) || b[0].toLowerCase() === q.toLowerCase())
  return <div className="graficos">
    <Card t="A quién van" wide lead={<>Por el tipo de beneficiario (lo dice la letra del NIF). Las personas físicas reciben <b>{nf(((grupos.find(x => x.g === 'personas')?.n ?? 0) / totN) * 100, 0)} de cada 100</b> concesiones, pero solo {nf(((grupos.find(x => x.g === 'personas')?.v ?? 0) / tot) * 100, 0)} de cada 100 euros: muchas ayudas pequeñas.</>} fuente={BDNS}>
      <div className="dos-barras">
        {(['n', 'v'] as const).map(m => <div key={m}><span className="db-t">{m === 'n' ? 'Por número de concesiones' : 'Por dinero'}</span>
          <div className="db-b">{grupos.filter(x => x[m] > 0).map((x, i) => { const p = x[m] / (m === 'n' ? totN : tot); return <motion.i key={x.g} style={{ background: GRUPO[x.g][1] }} initial={{ width: 0 }} whileInView={{ width: `${p * 100}%` }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} title={`${GRUPO[x.g][0]}: ${nf(p * 100, 0)} %`}>{p > 0.09 && <span>{nf(p * 100, 0)} %</span>}</motion.i> })}</div>
        </div>)}
        <ul className="g-legend">{grupos.map(x => <li key={x.g}><i style={{ background: GRUPO[x.g][1], height: 8 }} />{GRUPO[x.g][0]}</li>)}</ul>
      </div>
      <Barras titulo="Ayudas por tipo de beneficiario" fmt={eu} limite={8} items={tipos} />
    </Card>
    <Card t="Los que más reciben" wide lead={<>Empresas, entidades y organismos con más ayudas en el periodo. No se muestran personas físicas.</>} fuente={BDNS}>
      <label className="buscar"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Busca una empresa, entidad o NIF" /></label>
      <Barras titulo="Mayores beneficiarios" fmt={eu} limite={15} items={ben.map(b => ({ id: b[0], nombre: capital(b[3]), sub: `${b[0]} · ${NIF[b[0][0]] ?? ''} · ${nf(b[1])} concesiones`, valor: b[2], color: GRUPO[grupo(b[0][0])][1] }))} />
      {!ben.length && <p className="note">No está entre los mayores beneficiarios del periodo.</p>}
    </Card>
  </div>
}

function Grandes({ d, a }: { d: Datos; a: Agg }) {
  return <div className="graficos">
    <Card t="Las convocatorias con más dinero" wide lead={<>Lo concedido en el periodo en cada convocatoria. Toca una para abrirla en la BDNS.</>} fuente={BDNS}>
      <ol className="convs">
        {a.conv.slice(0, 25).map((c, i) => <motion.li key={c[0]} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
          <a href={`https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${c[0]}`} target="_blank" rel="noopener noreferrer">
            <b>{eu(c[2])}</b>
            <span className="cv-t">{c[3]}</span>
            <span className="cv-o"><i style={{ background: ADM[c[4]]?.[2] }} />{capital(c[5])} · {capital(d.finalidades[c[6]] ?? '')} · {nf(c[1])} concesiones</span>
          </a>
        </motion.li>)}
      </ol>
    </Card>
  </div>
}

export default function App() {
  const [d, setD] = useState<Datos | null>(null), [err, setErr] = useState(false)
  useEffect(() => { fetch('./data/subvenciones.json').then(r => r.json()).then(setD, () => setErr(true)) }, [])
  const init = location.hash.slice(1) as Sec
  const [sec, setSec] = useState<Sec>(SECCIONES.some(x => x.id === init) ? init : 'resumen')
  const go = (s: Sec) => { setSec(s); history.replaceState(null, '', `#${s}`); scrollTo({ top: 0, behavior: 'smooth' }) }
  const periodos = useMemo(() => d ? [...(d.u12 ? ['u12'] : []), ...Object.keys(d.años).sort().reverse()] : [], [d])
  const [k, setK] = useState<string>('')
  const kk = k || periodos[0]
  const a = d ? (kk === 'u12' ? d.u12 : d.años[kk]) : null
  if (err) return <main className="eco boot"><p>No se han podido cargar los datos. Vuelve a intentarlo en un rato.</p></main>
  if (!d || !a) return <main className="eco boot"><Coins size={28} /><p>Cargando las subvenciones…</p></main>
  const incompleto = kk !== 'u12' && a.meses.length < 12
  return (
    <main className="eco">
      <header className="top">
        <div className="brand">
          <a className="home-link" href="../index.html">España en datos</a>
          <h1>Subvenciones</h1>
          <p>Quién da ayudas públicas, para qué y a quién · BDNS</p>
        </div>
        <div className="rango" role="radiogroup" aria-label="Periodo">{periodos.map(p => <button key={p} role="radio" aria-checked={kk === p} className={kk === p ? 'is-on' : ''} onClick={() => setK(p)}>{p === 'u12' ? 'Últimos 12 meses' : p}</button>)}</div>
      </header>
      <nav className="menu" aria-label="Secciones">
        {SECCIONES.map(x => <button key={x.id} className={sec === x.id ? 'is-on' : ''} onClick={() => go(x.id)} aria-current={sec === x.id ? 'page' : undefined}><x.icon size={17} />{x.nombre}</button>)}
      </nav>
      {incompleto && <p className="aviso">{kk} tiene solo {a.meses.length} meses descargados ({per(a.meses[0])} a {per(a.meses.at(-1)!)}).</p>}
      <motion.div key={sec + kk} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
        {sec === 'resumen' && <Resumen d={d} a={a} k={kk} go={go} />}
        {sec === 'quien' && <Quien a={a} k={kk} />}
        {sec === 'para' && <Para d={d} a={a} />}
        {sec === 'aquien' && <AQuien a={a} />}
        {sec === 'grandes' && <Grandes d={d} a={a} />}
      </motion.div>
      {sec === 'resumen' && <Curiosidades titulo="¿Sabías que…?" items={[
        a.conv[0] && <>La convocatoria con más dinero del periodo repartió <b>{eu(a.conv[0][2])}</b>: «{a.conv[0][3].slice(0, 140)}{a.conv[0][3].length > 140 ? '…' : ''}».</>,
        (() => { const m = Object.entries(a.inst).sort((x, y) => y[1][1] - x[1][1]).find(([n]) => /PR[EÉ]STAMO/.test(n)); return m && <>No todo son regalos: {eu(m[1][1])} se dieron como préstamos, que hay que devolver.</> })(),
        a.ben[0] && <>El mayor receptor del periodo es <b>{capital(a.ben[0][3])}</b> ({NIF[a.ben[0][0][0]]?.toLowerCase()}), con {eu(a.ben[0][2])}.</>,
        <>Hay {nf(a.n)} concesiones en el periodo: unas {nf(a.n / (a.meses.length * 30))} al día.</>,
      ]} />}
      <Fuentes ids={[]} extra={[{ n: 'Base de Datos Nacional de Subvenciones (BDNS)', u: 'https://www.infosubvenciones.es/bdnstrans/GE/es/index' }, { n: 'IGAE · Sistema Nacional de Publicidad de Subvenciones', u: 'https://www.pap.hacienda.gob.es/bdnstrans/GE/es/index' }]} />
      <p className="src">Concesiones registradas en la BDNS desde 2024, sumadas por mes y descargadas cada día. Las personas físicas solo cuentan en los totales: nunca se muestran sus nombres. El importe es lo concedido, no lo pagado; los préstamos y garantías cuentan por su importe.</p>
    </main>
  )
}
