import { riverLen, riverMouth, useRivers } from './rivers'
import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Search, Waves, X, Zap } from 'lucide-react'
import { basinStats, consumo, data, depOrder, energyTotals, fmt, fmtPct, hydroCount, pct, status } from './data'
import type { Layer } from './Board'
import { byCapacity, resInBasin, type Sel } from './sel'
import { Ciclo } from './Ciclo'
import { metrosPorHab, orden } from './ciudad'
import { aggList, c1Color, RED, useEdar } from './edar'
import { Bar, CountUp, Head, HydroChart, Info, Ring, TimeChart } from './ui'
import { byHydroYear, envelope, hydroLabel, hydroYear, toDate, useHistory, weekOf } from './history'

type Pick = (s: Sel | null) => void
const n = data.meta.national
const NOW = toDate(data.meta.fecha)

export function Finder({ onPick }: { onPick: Pick }) {
  const [q, setQ] = useState('')
  const rivs = useRivers()
  const norm = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const hits = useMemo(() => {
    const s = norm(q.trim())
    if (s.length < 2) return { rv: [], rs: [] }
    const rv = (rivs ?? []).filter(v => norm(v.n).includes(s)).slice(0, 3)
    const rs = data.reservoirs.filter(r => norm(r.n).includes(s) || (r.riv && norm(r.riv).includes(s))).sort((a, b) => b.c - a.c).slice(0, 7 - rv.length)
    return { rv, rs }
  }, [q, rivs])
  return (
    <div className="finder">
      <label className="finder-box">
        <Search size={17} aria-hidden />
        <input id="buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar embalse o río" autoComplete="off" />
        {q && <button onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={15} /></button>}
      </label>
      {hits.rv.length + hits.rs.length > 0 && (
        <ul className="finder-list">
          {hits.rv.map(v => <li key={'v' + v.id}><button onClick={() => { onPick({ k: 'river', id: v.id }); setQ('') }}><span>Río {v.n}<small>{fmt(riverLen(v))} km · {riverMouth(v)}</small></span><em><Waves size={14} /></em></button></li>)}
          {hits.rs.map(r => <li key={r.id}><button onClick={() => { onPick({ k: 'res', id: r.id }); setQ('') }}><span>{r.n}<small>{r.riv ? `Río ${r.riv} · ` : ''}{data.basins[r.b]}</small></span><em>{fmtPct(pct(r))}</em></button></li>)}
        </ul>
      )}
      {q.trim().length >= 2 && hits.rv.length + hits.rs.length === 0 && <p className="finder-empty">Sin resultados. Prueba con parte del nombre, como «Serena» o «Tajo».</p>}
    </div>
  )
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>
          {l}{value === k && <motion.i layoutId="tab-ink" className="tab-ink" />}
        </button>
      ))}
    </div>
  )
}

function WaterSummary({ onPick, sel }: { onPick: Pick; sel: Sel | null }) {
  const focus = sel?.k === 'basin' ? sel.id : null
  const risers = [...data.reservoirs].sort((a, b) => b.d - a.d).slice(0, 5)
  const lowest = [...data.reservoirs].filter(r => r.c >= 20).sort((a, b) => pct(a) - pct(b)).slice(0, 5)
  const top10 = byCapacity.slice(0, 10).reduce((t, r) => t + r.c, 0)
  const big = byCapacity[0]
  return (<>
    <section className="card">
      <div className="nat">
        <Ring p={(n.a / n.c) * 100} label={`Reserva peninsular al ${fmtPct((n.a / n.c) * 100)}`} size={112} />
        <div className="nat-txt">
          <h2>Reserva {n.d >= 0 ? 'al alza' : 'a la baja'}: {n.d >= 0 ? '+' : '−'}{fmt(Math.abs(n.d))} hm³</h2>
          <p><CountUp value={n.a} /> de {fmt(n.c)} hm³ embalsados <Info k="reserva" /></p>
        </div>
      </div>
      <ul className="cmp">
        <li><span>Ahora</span><Bar value={n.a} max={n.c} /><b>{fmt(n.a)}</b></li>
        <li><span>Hace un año</span><Bar value={n.prevYear} max={n.c} tone="ghost" /><b>{fmt(n.prevYear)}</b></li>
        <li><span>Media 10 años <Info k="media10" /></span><Bar value={n.avg10} max={n.c} tone="ghost" /><b>{fmt(n.avg10)}</b></li>
      </ul>
      <p className="unit">hm³ · {n.a >= n.avg10 ? '+' : '−'}{fmt(Math.abs((n.a / n.avg10 - 1) * 100))} % frente a la media y {n.a >= n.prevYear ? '+' : '−'}{fmt(Math.abs(n.a - n.prevYear))} hm³ frente a hace un año</p>
    </section>
    <section className="card">
      <Head info="cuenca">Cuencas por llenado</Head>
      <ul className="rank">
        {basinStats.map(b => (
          <li key={b.id}><button className={focus === b.id ? 'is-on' : ''} onClick={() => onPick(focus === b.id ? null : { k: 'basin', id: b.id })} aria-pressed={focus === b.id}>
            <span className="rank-name">{b.name}</span><Bar value={b.pct} max={100} tone={status(b.pct)} /><b>{fmtPct(b.pct)}</b>
          </button></li>
        ))}
      </ul>
    </section>
    <section className="card two">
      <div><Head info="semana">Más suben</Head>
        <ul className="mini">{risers.map(r => <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}><span>{r.n}</span><b className="up"><ArrowUp size={12} />{fmt(r.d)}</b></button></li>)}</ul></div>
      <div><Head>Más vacíos</Head>
        <ul className="mini">{lowest.map(r => <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}><span>{r.n}</span><b className="down">{fmtPct(pct(r))}</b></button></li>)}</ul></div>
    </section>
    <section className="card">
      <Head>Curiosidades</Head>
      <ul className="facts">
        <li>El mayor embalse, <button className="link" onClick={() => onPick({ k: 'res', id: big.id })}>{big.n}</button>, tiene por sí solo el <b>{fmt((big.c / n.c) * 100, 1)} %</b> de la capacidad de la península.</li>
        <li>Los 10 mayores suman el <b>{fmt((top10 / n.c) * 100)} %</b> de toda la capacidad; los otros {byCapacity.length - 10} se reparten el resto.</li>
        <li>Lo que hay embalsado llenaría unos <b>{fmt((n.a * 1e6) / 2500 / 1e6, 1)} millones</b> de piscinas olímpicas. <Info k="hm3" /></li>
        <li>Solo <b>{hydroCount}</b> de los {data.reservoirs.length} embalses pueden producir electricidad. <Info k="hidro" /></li>
      </ul>
    </section>
  </>)
}

function WaterHistory() {
  const h = useHistory()
  const [extra, setExtra] = useState<number[]>([])
  const d = useMemo(() => {
    if (!h) return null
    const N = h.national
    const ys = byHydroYear(N.d, N.a, N.c)
    const cy = hydroYear(NOW)
    const env = envelope(ys, Array.from({ length: 10 }, (_, i) => cy - 10 + i))
    const pts = N.d.map((s, i) => ({ t: toDate(s).getTime(), v: (N.a[i] / N.c[i]) * 100 }))
    const lo = pts.reduce((m, p) => (p.v < m.v ? p : m)), hi = pts.reduce((m, p) => (p.v > m.v ? p : m))
    return { ys, cy, env, pts, lo, hi }
  }, [h])
  if (!d) return <section className="card"><p className="loading">Cargando 38 años de boletines…</p></section>
  const yearsAvail = Array.from({ length: 12 }, (_, i) => d.cy - 2 - i).filter(y => d.ys.has(y))
  const lines = [
    { key: 'avg', label: 'Media 10 años', vals: d.env.avg, cls: 'ln-avg' },
    { key: 'prev', label: hydroLabel(d.cy - 1), vals: d.ys.get(d.cy - 1) ?? [], cls: 'ln-prev' },
    ...extra.map((y, i) => ({ key: `x${y}`, label: hydroLabel(y), vals: d.ys.get(y) ?? [], cls: `ln-x ln-x${i % 4}` })),
    { key: 'cur', label: `${hydroLabel(d.cy)} (actual)`, vals: d.ys.get(d.cy) ?? [], cls: 'ln-cur' },
  ]
  const fd = (t: number) => new Date(t).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return (<>
    <section className="card">
      <Head info="anyo">Año hidrológico en curso</Head>
      <HydroChart lines={lines} band={{ lo: d.env.lo, hi: d.env.hi }} now={{ w: weekOf(NOW), v: (n.a / n.c) * 100 }} />
      <p className="grid-title">Compara con otros años (hasta 4)</p>
      <div className="chips">
        {yearsAvail.map(y => (
          <button key={y} className={extra.includes(y) ? 'is-on' : ''} aria-pressed={extra.includes(y)}
            onClick={() => setExtra(e => e.includes(y) ? e.filter(x => x !== y) : [...e, y].slice(-4))}>{hydroLabel(y)}</button>
        ))}
      </div>
    </section>
    <section className="card">
      <Head info="reserva">38 años de reserva</Head>
      <TimeChart pts={d.pts} height={180} label="Porcentaje de agua embalsada en la península desde 1988"
        marks={[{ t: d.lo.t, v: d.lo.v, label: 'min', cls: 'mk-min' }, { t: d.hi.t, v: d.hi.v, label: 'max', cls: 'mk-max' }]} />
      <div className="records">
        <div><span>Máximo de la serie</span><b>{fmtPct(d.hi.v)}</b><small>{fd(d.hi.t)}</small></div>
        <div><span>Mínimo de la serie</span><b className="down">{fmtPct(d.lo.v)}</b><small>{fd(d.lo.t)}</small></div>
      </div>
      <p className="note">Porcentaje sobre la capacidad de cada semana. Los primeros años incluyen menos embalses porque muchos aún no existían.</p>
    </section>
  </>)
}

function Rankings({ onPick }: { onPick: Pick }) {
  const [b, setB] = useState<string>('all')
  const list = b === 'all' ? byCapacity.slice(0, 20) : resInBasin(b)
  return (
    <section className="card">
      <Head info="capacidad">Ranking de capacidad</Head>
      <div className="chips scroll">
        <button className={b === 'all' ? 'is-on' : ''} onClick={() => setB('all')}>España</button>
        {[...basinStats].sort((x, y) => y.c - x.c).map(s => <button key={s.id} className={b === s.id ? 'is-on' : ''} onClick={() => setB(s.id)}>{s.name}</button>)}
      </div>
      <ol className="cap-rank">
        {list.map((r, i) => (
          <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}>
            <em>{i + 1}</em><span>{r.n}<small>{r.riv ? `Río ${r.riv}` : data.basins[r.b]}</small></span>
            <Bar value={r.c} max={list[0].c} tone="cap" /><b>{fmt(r.c)}</b>
          </button></li>
        ))}
      </ol>
      <p className="unit">hm³ de capacidad · {b === 'all' ? `los 20 mayores de ${byCapacity.length}` : `${list.length} embalses en la cuenca`}</p>
    </section>
  )
}

function EnergyPanel({ onPick }: { onPick: Pick }) {
  const ep = (energyTotals.e / energyTotals.ec) * 100
  const top = [...data.reservoirs].filter(r => r.ec > 0).sort((a, b) => b.e - a.e).slice(0, 8)
  const byBasin = [...basinStats].filter(b => b.ec > 0).sort((a, b) => b.e - a.e)
  return (<>
    <section className="card">
      <div className="nat">
        <Ring p={ep} tone="volt" label={`Energía hidroeléctrica embalsada al ${fmtPct(ep)}`} size={112} />
        <div className="nat-txt">
          <h2>{fmt(energyTotals.e)} GWh en reserva</h2>
          <p>De un máximo de {fmt(energyTotals.ec)} GWh <Info k="energia" /></p>
        </div>
      </div>
      <ul className="facts">
        <li><b>{hydroCount}</b> de {data.reservoirs.length} embalses tienen central; el resto no produce electricidad. <Info k="hidro" /></li>
        <li>Darían luz un año a unos <b>{fmt((energyTotals.e * 1e6) / 3500 / 1e6, 1)} millones</b> de hogares.</li>
      </ul>
    </section>
    {data.hydro && data.hydro.days.length > 0 && <HydroCard days={data.hydro.days} />}
    <section className="card">
      <Head>Energía embalsada por cuenca</Head>
      <ul className="rank">{byBasin.map(b => <li key={b.id}><button onClick={() => onPick({ k: 'basin', id: b.id })}><span className="rank-name">{b.name}</span><Bar value={b.e} max={byBasin[0].e} tone="energy" /><b>{fmt(b.e)}</b></button></li>)}</ul>
      <p className="unit">GWh</p>
    </section>
    <section className="card">
      <Head>Las mayores baterías de agua</Head>
      <ul className="mini">{top.map(r => <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}><span>{r.n}<small>{fmtPct((r.e / r.ec) * 100)} de carga</small></span><b className="volt"><Zap size={12} />{fmt(r.e)} GWh</b></button></li>)}</ul>
    </section>
  </>)
}

function HydroCard({ days }: { days: { d: string; mwh: number }[] }) {
  const max = Math.max(...days.map(x => x.mwh))
  const total = days.reduce((t, x) => t + x.mwh, 0) / 1000
  const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return (
    <section className="card">
      <Head>Producción hidráulica: {fmt(total)} GWh en {days.length} días</Head>
      <div className="cols" role="img" aria-label="Producción hidráulica diaria">
        {days.map(x => <i key={x.d} title={`${day(x.d)}: ${fmt(x.mwh / 1000, 1)} GWh`} style={{ height: `${Math.max(3, (x.mwh / max) * 100)}%` }} />)}
      </div>
      <p className="unit">Red Eléctrica · {day(days[0].d)} a {day(days[days.length - 1].d)}</p>
    </section>
  )
}

function RainPanel({ onPick }: { onPick: Pick }) {
  const sorted = [...data.rain].sort((a, b) => b.p - a.p)
  const top = sorted.slice(0, 12)
  const dry = sorted.filter(g => g.p < 5).length
  const driest = sorted.filter(g => !/Islas|Ceuta|Melilla/.test(g.z)).slice(-3).map(g => g.n)
  return (<>
    <section className="card">
      <h2>{top[0].n}: {fmt(top[0].p, 1)} l/m² en siete días</h2>
      <p className="lead">{data.rain.length - dry} de {data.rain.length} observatorios superaron los 5 l/m². Donde menos llovió: {driest.join(', ')}. <Info k="lluvia" /></p>
    </section>
    <section className="card">
      <Head>Donde más llovió</Head>
      <ul className="rank">{top.map(g => <li key={g.n}><button onClick={() => onPick({ k: 'rain', i: data.rain.indexOf(g) })}><span className="rank-name">{g.n}</span><Bar value={g.p} max={top[0].p} tone="rain" /><b>{fmt(g.p, 1)}</b></button></li>)}</ul>
      <p className="unit">l/m² en la semana</p>
    </section>
  </>)
}

function RiversCard({ onPick }: { onPick: Pick }) {
  const rivs = useRivers()
  if (!rivs) return null
  const top = rivs.slice(0, 12), max = riverLen(top[0])
  return (
    <section className="card">
      <Head info="longitud">Ríos más largos</Head>
      <ul className="rank">{top.map(v => <li key={v.id}><button onClick={() => onPick({ k: 'river', id: v.id })}><span className="rank-name">{v.n}</span><Bar value={riverLen(v)} max={max} tone="flow" /><b>{fmt(riverLen(v))}</b></button></li>)}</ul>
      <p className="unit">km · acércate al mapa y pincha cualquier río con nombre</p>
    </section>
  )
}

function FlowPanel({ onPick }: { onPick: Pick }) {
  const f = data.flows.map((x, i) => ({ ...x, i }))
  const top = [...f].sort((a, b) => b.q - a.q).slice(0, 10)
  const ch = f.filter(x => x.qa && x.qa > 1).map(x => ({ ...x, c: ((x.q - x.qa!) / x.qa!) * 100 }))
  const up = [...ch].sort((a, b) => b.c - a.c).slice(0, 4), dn = [...ch].sort((a, b) => a.c - b.c).slice(0, 4)
  return (<>
    <section className="card">
      <h2>{top[0].n}: {fmt(top[0].q)} m³/s</h2>
      <p className="lead">El mayor caudal medio de la semana entre {data.flows.length} estaciones de aforo y salidas de embalse del boletín. <Info k="caudal" /></p>
    </section>
    <RiversCard onPick={onPick} />
    <section className="card">
      <Head>Mayores caudales</Head>
      <ul className="rank">{top.map(x => <li key={x.i}><button onClick={() => onPick({ k: 'flow', i: x.i })}><span className="rank-name">{x.n}</span><Bar value={x.q} max={top[0].q} tone="flow" /><b>{fmt(x.q)}</b></button></li>)}</ul>
      <p className="unit">m³/s</p>
    </section>
    <section className="card two">
      <div><Head>Más crecen</Head><ul className="mini">{up.map(x => <li key={x.i}><button onClick={() => onPick({ k: 'flow', i: x.i })}><span>{x.n}<small>{x.r}</small></span><b className="up"><ArrowUp size={12} />{fmt(x.c)} %</b></button></li>)}</ul></div>
      <div><Head>Más bajan</Head><ul className="mini">{dn.map(x => <li key={x.i}><button onClick={() => onPick({ k: 'flow', i: x.i })}><span>{x.n}<small>{x.r}</small></span><b className="down"><ArrowDown size={12} />{fmt(Math.abs(x.c))} %</b></button></li>)}</ul></div>
    </section>
  </>)
}

function ConsPanel({ onPick, sel }: { onPick: Pick; sel: Sel | null }) {
  const N = consumo.national, max = consumo.regions[0].l
  const pool = byCapacity.find(r => r.c <= N.lossReal)
  const fugas = consumo.regions.map((u, i) => ({ u, i })).filter(x => x.u.lossPct != null).sort((a, b) => (b.u.lossPct ?? 0) - (a.u.lossPct ?? 0))
  return (<>
    <section className="card">
      <h2>{N.l} litros por persona y día</h2>
      <p className="lead">Lo que gastan de media los hogares españoles en {consumo.year}, según el INE. Va de {consumo.regions[consumo.regions.length - 1].l} litros en {consumo.regions[consumo.regions.length - 1].n} a {max} en {consumo.regions[0].n}. <Info k="consumo" /></p>
    </section>
    <section className="card">
      <Head>Consumo por comunidad</Head>
      <ul className="rank">{consumo.regions.map((u, i) => (
        <li key={u.n}><button className={sel?.k === 'cons' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'cons', i })}>
          <span className="rank-name">{u.n}</span><Bar value={u.l} max={max} tone={u.l > N.l ? 'urb' : 'water'} /><b>{u.l}</b>
        </button></li>
      ))}</ul>
      <p className="unit">litros por habitante y día · en naranja, por encima de la media</p>
    </section>
    <section className="card">
      <Head info="perdidas">Del embalse al grifo</Head>
      <ul className="cmp">
        <li><span>Entra en la red</span><Bar value={N.supplied} max={N.supplied} /><b>{fmt(N.supplied)}</b></li>
        <li><span>Llega a hogares</span><Bar value={N.households} max={N.supplied} tone="ghost" /><b>{fmt(N.households)}</b></li>
        <li><span>Fugas y averías</span><Bar value={N.lossReal} max={N.supplied} tone="low" /><b>{fmt(N.lossReal)}</b></li>
      </ul>
      <p className="unit">hm³ al año · {consumo.year}</p>
      <ul className="facts">
        <li>Las fugas y roturas pierden <b>{fmt((N.lossReal / N.supplied) * 100, 1)} %</b> del agua que entra en la red{pool ? <>: más de lo que cabe en <button className="link" onClick={() => onPick({ k: 'res', id: pool.id })}>{pool.n}</button> ({fmt(pool.c)} hm³)</> : null}.</li>
        <li>Origen del agua: <b>{fmt(N.origin.sup, 1)} %</b> de ríos y embalses, <b>{fmt(N.origin.sub, 1)} %</b> de acuíferos y <b>{fmt(N.origin.otras, 1)} %</b> desalada.</li>
        {N.cost != null && <li>Cada metro cúbico cuesta de media <b>{fmt(N.cost, 2)} €</b> entre abastecimiento y saneamiento. <Info k="coste" /></li>}
      </ul>
    </section>
    {fugas.length > 0 && <section className="card">
      <Head info="perdidas">Fugas por comunidad</Head>
      <p className="lead">Parte del agua que entra en la red y se pierde por fugas y roturas, y cómo ha cambiado desde {consumo.prevYear}.</p>
      <ul className="rank">{fugas.map(({ u, i }) => (
        <li key={u.n}><button className={sel?.k === 'cons' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'cons', i })}>
          <span className="rank-name">{u.n}{u.lossPctPrev != null && u.lossPct != null && Math.abs(u.lossPct - u.lossPctPrev) >= 0.5 && <small className={`flechita ${u.lossPct < u.lossPctPrev ? 'mejor' : 'peor'}`}> {u.lossPct < u.lossPctPrev ? <ArrowDown size={11} /> : <ArrowUp size={11} />}{fmt(Math.abs(u.lossPct - u.lossPctPrev), 1)}</small>}</span>
          <Bar value={u.lossPct ?? 0} max={fugas[0].u.lossPct ?? 1} tone={(u.lossPct ?? 0) > (N.lossPct ?? 0) ? 'low' : 'water'} /><b>{fmt(u.lossPct ?? 0, 1)} %</b>
        </button></li>
      ))}</ul>
      <p className="unit">% del agua suministrada a la red · flecha: puntos de cambio desde {consumo.prevYear}</p>
    </section>}
  </>)
}

function EdarResumen({ onPick, sel }: { onPick: Pick; sel: Sel | null }) {
  const ed = useEdar()
  if (!ed) return <section className="card"><p className="lead">Cargando depuradoras…</p></section>
  const n = ed.length, por = [3, 2, 1].map(t => ed.filter(p => p.t === t).length), no = ed.filter(p => p.ok === 0)
  const cap = ed.reduce((s, p) => s + (p.cap ?? 0), 0), carga = ed.reduce((s, p) => s + (p.load ?? 0), 0)
  const llenas = ed.filter(p => p.cap && p.load && p.load > p.cap).length
  const col = ed.flatMap(p => p.ag).filter(a => a.c1 != null && a.pe), pe = col.reduce((s, a) => s + a.pe!, 0)
  const c1 = pe ? col.reduce((s, a) => s + a.c1! * a.pe!, 0) / pe : null
  const COL = ['#3df5b0', '#3fe6ff', '#ffb02e']
  return <section className="card">
    <Head>{fmt(n)} depuradoras</Head>
    <p className="lead">Las que España reporta a la UE (núcleos de más de 2.000 habitantes equivalentes), con datos de 2022. Juntas pueden tratar la contaminación de {fmt(cap / 1e6, 1)} millones de habitantes equivalentes y reciben {fmt(carga / 1e6, 1)} millones.</p>
    <div className="trat-barra" role="img" aria-label={`Tratamiento más riguroso ${por[0]}, secundario ${por[1]}, primario ${por[2]}`}>
      {por.map((v, j) => <motion.i key={j} style={{ background: COL[j] }} initial={{ width: 0 }} animate={{ width: `${(v / n) * 100}%` }} transition={{ delay: j * 0.15, duration: 0.6 }} />)}
    </div>
    <ul className="g-legend trat-ley">{['Más riguroso', 'Secundario', 'Primario'].map((t, j) => <li key={t}><i style={{ background: COL[j], height: 8 }} />{t} · {fmt(por[j])}</li>)}</ul>
    <ul className="facts">
      <li><b>{fmt(no.length)}</b> no cumplen los límites de vertido que les exige la directiva ({fmt((no.length / n) * 100, 0)} %).</li>
      <li><b>{fmt(llenas)}</b> reciben en la semana de más carga más de lo que están diseñadas para tratar de media.</li>
      {c1 != null && <li>Los colectores recogen de media el <b>{fmt(c1, 1)} %</b> de la contaminación de las aglomeraciones con depuradora.</li>}
    </ul>
    <Head>Las más grandes</Head>
    <ul className="rank">{ed.slice(0, 8).map((p, i) => <li key={p.c}><button className={sel?.k === 'edar' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'edar', i })}>
      <span className="rank-name">{p.n}</span><Bar value={p.cap ?? 0} max={ed[0].cap ?? 1} /><b>{fmt((p.cap ?? 0) / 1e6, 1)} M</b>
    </button></li>)}</ul>
    <p className="unit">capacidad en millones de habitantes equivalentes</p>
  </section>
}

function AlcPanel({ onPick, sel }: { onPick: Pick; sel: Sel | null }) {
  const ed = useEdar(), ags = ed ? aggList() ?? [] : null
  if (!ags) return <section className="card"><p className="lead">Cargando núcleos urbanos…</p></section>
  const N = consumo.national, conC = ags.filter(a => a.c1 != null && a.pe), pe = conC.reduce((s, a) => s + a.pe!, 0)
  const c1 = pe ? conC.reduce((s, a) => s + a.c1! * a.pe!, 0) / pe : 0
  const enteras = conC.filter(a => a.c1! >= 99.5).length
  const peor = ags.map((a, i) => ({ a, i })).filter(x => x.a.c1 != null && x.a.c1 < 99.5 && (x.a.pe ?? 0) >= 10000).sort((p, q) => p.a.c1! - q.a.c1!)
  const redes = ['C', 'S', 'B'].map(k => ({ k, n: ags.filter(a => a.red === k).length }))
  const nr = redes.reduce((s, x) => s + x.n, 0) || 1
  const COL: Record<string, string> = { C: '#a98d6a', S: '#3fe6ff', B: '#9085e9' }
  const lista = orden('alcantarillado'), vN = metrosPorHab(N), maxM = lista[0]?.v ?? 1
  return (<>
    <section className="card">
      <h2><CountUp value={N.sewerKm ?? 0} /> km de alcantarillado</h2>
      <p className="lead">Lo que mide la red de cloacas de España según el INE ({consumo.year}){vN != null ? <>: <b>{fmt(vN, 1)} metros por habitante</b>. Donde la gente vive más repartida hay más tubo por vecino que mantener y renovar</> : null}. <Info k="alcantarillado" /></p>
      <Head>Metros de alcantarillado por habitante</Head>
      <ul className="rank">{lista.map(({ u, i, v }) => (
        <li key={u.n}><button className={sel?.k === 'alc' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'alc', i })}>
          <span className="rank-name">{u.n}</span><Bar value={v} max={maxM} tone={vN != null && v > vN ? 'urb' : 'water'} /><b>{fmt(v, 1)}</b>
        </button></li>
      ))}</ul>
      <p className="unit">km de red del INE ÷ habitantes · en naranja, por encima de la media</p>
    </section>
    <section className="card">
      <h2><CountUp value={c1} decimals={1} /> % llega a la alcantarilla</h2>
      <p className="lead">De la contaminación de los {fmt(ags.length)} núcleos urbanos que España reporta a la UE (más de 2.000 habitantes equivalentes), la que recogen los colectores, ponderada por tamaño. {fmt(enteras)} lo recogen todo. Datos de 2022.</p>
      <div className="trat-barra" role="img" aria-label="Tipo de red de alcantarillado">{redes.map((r, j) => <motion.i key={r.k} style={{ background: COL[r.k] }} initial={{ width: 0 }} animate={{ width: `${(r.n / nr) * 100}%` }} transition={{ delay: j * 0.15, duration: 0.6 }} />)}</div>
      <ul className="g-legend trat-ley">{redes.map(r => <li key={r.k}><i style={{ background: COL[r.k], height: 8 }} />{RED[r.k].split(' (')[0]} · {fmt(r.n)}</li>)}</ul>
      <p className="unit">tipo de red de los núcleos que lo declaran</p>
      <ul className="facts">
        <li>En la red <b>unitaria</b>, la lluvia y el agua usada van juntas: con tormentas fuertes desbordan y parte llega al río sin depurar.</li>
      </ul>
    </section>
    {peor.length > 0 && <section className="card">
      <Head>Donde menos se recoge</Head>
      <ul className="rank">{peor.slice(0, 12).map(({ a, i }) => <li key={a.c}><button className={sel?.k === 'agg' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'agg', i })}>
        <span className="rank-name">{a.n}</span><Bar value={a.c1!} max={100} tone="low" /><b style={{ color: c1Color(a.c1) }}>{fmt(a.c1!, 0)} %</b>
      </button></li>)}</ul>
      <p className="unit">núcleos de más de 10.000 habitantes equivalentes · % recogido por colectores</p>
    </section>}
    <p className="foot">De lejos, el mapa pinta cada comunidad según sus metros de alcantarillado por habitante. Al acercarte, cada cuadrado es un núcleo: cian si las alcantarillas lo recogen todo; amarillo, naranja y rojo cuanto menos.</p>
  </>)
}

function DepPanel({ onPick, sel }: { onPick: Pick; sel: Sel | null }) {
  const N = consumo.national, lista = depOrder.map(i => ({ u: consumo.regions[i], i }))
  const top = lista[0], max = top?.u.reusePct ?? 1
  const vueltas = (N.sewerKm ?? 0) / 40075
  return (<>
    <section className="card">
      <h2><CountUp value={N.reusePct ?? 0} decimals={1} /> % vuelve a usarse</h2>
      <p className="lead">De cada 100 litros que depuran las EDAR españolas, {fmt(N.reusePct ?? 0, 0)} se reutilizan{N.reusePctPrev != null ? <> ({N.reusePct! >= N.reusePctPrev ? 'más' : 'menos'} que en {consumo.prevYear}: {fmt(N.reusePctPrev, 1)} %)</> : null}; el resto vuelve a ríos y mar. Año {consumo.year}, INE. <Info k="depuracion" /></p>
      {N.dest && <Ciclo dest={N.dest} tratada={N.treated} km={N.sewerKm} titulo="Destino del agua depurada en España" />}
    </section>
    <section className="card">
      <Head>¿Qué parte se reutiliza en mi comunidad?</Head>
      <ul className="rank">{lista.map(({ u, i }) => (
        <li key={u.n}><button className={sel?.k === 'dep' && sel.i === i ? 'is-on' : ''} onClick={() => onPick({ k: 'dep', i })}>
          <span className="rank-name">{u.n}{u.reusePctPrev != null && u.reusePct != null && Math.abs(u.reusePct - u.reusePctPrev) >= 1 && <small className={`flechita ${u.reusePct > u.reusePctPrev ? 'mejor' : 'peor'}`}> {u.reusePct > u.reusePctPrev ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{fmt(Math.abs(u.reusePct - u.reusePctPrev), 0)}</small>}</span>
          <Bar value={u.reusePct ?? 0} max={max} tone={(u.reusePct ?? 0) >= (N.reusePct ?? 0) ? 'water' : 'ghost'} /><b>{fmt(u.reusePct ?? 0, (u.reusePct ?? 0) < 10 ? 1 : 0)} %</b>
        </button></li>
      ))}</ul>
      <p className="unit">100 × agua reutilizada / agua tratada · {consumo.year} · flecha: puntos de cambio desde {consumo.prevYear}</p>
    </section>
    <EdarResumen onPick={onPick} sel={sel} />
    <section className="card">
      <Head>Bajo la calle</Head>
      <ul className="facts">
        {N.treated ? <li>Las depuradoras tratan unos <b>{fmt(N.treated / 1e6, 1)} millones de m³</b> al día: {fmt(N.treated / 2500)} piscinas olímpicas diarias, contando la lluvia que recogen las alcantarillas.</li> : null}
        {N.sewerKm ? <li>Hay <b>{fmt(N.sewerKm)} km</b> de alcantarillado: {fmt(vueltas, 1)} vueltas a la Tierra.</li> : null}
        {N.sludge ? <li>Depurar deja <b>{fmt(N.sludge / 1e6, 2)} millones de toneladas</b> de lodos secos al año, que acaban sobre todo como abono, en incineración o en vertedero.</li> : null}
        {N.usos && <li>El agua reutilizada riega campos (<b>{fmt(N.usos['Agricultura'] ?? 0, 0)} %</b>), jardines y zonas deportivas ({fmt(N.usos['Jardines y zonas deportivas de ocio'] ?? 0, 0)} %) y va a la industria ({fmt(N.usos['Industria'] ?? 0, 0)} %).</li>}
      </ul>
      <p className="note">De lejos, el mapa pinta cada comunidad según el agua que reutiliza. Al acercarte, cada círculo es una depuradora: tócala para ver qué trata y a quién atiende.</p>
    </section>
  </>)
}

function DischargePanel({ onPick }: { onPick: Pick }) {
  const top = [...data.dischargers].sort((a, b) => b.v - a.v).slice(0, 10)
  const ind = data.dischargers.filter(d => d.t !== 'URBANO').reduce((s, d) => s + d.v, 0)
  const urb = data.dischargers.filter(d => d.t === 'URBANO').reduce((s, d) => s + d.v, 0)
  return (<>
    <section className="card">
      <h2>Quién devuelve más agua</h2>
      <p className="lead">Los mayores vertidos autorizados: el agua usada que una empresa o una ciudad puede devolver cada año a un río o al mar. No es su consumo, pero es la mejor pista pública de cuánta agua mueve. <Info k="vertidos" /></p>
      <ul className="cmp">
        <li><span><i className="key ind" />Industria</span><Bar value={ind} max={ind + urb} tone="ind" /><b>{fmt(ind)}</b></li>
        <li><span><i className="key urb" />Ciudades</span><Bar value={urb} max={ind + urb} tone="urb" /><b>{fmt(urb)}</b></li>
      </ul>
      <p className="unit">hm³/año · {data.dischargers.length} puntos de más de 20 hm³/año</p>
    </section>
    <section className="card">
      <Head>Los diez mayores</Head>
      <ul className="mini">{top.map((d, i) => <li key={i}><button onClick={() => onPick({ k: 'dis', i: data.dischargers.indexOf(d) })}><span>{d.n}<small>{d.m} · {d.c || (d.t === 'URBANO' ? 'Saneamiento urbano' : 'Industrial')}</small></span><b>{fmt(d.v)} hm³</b></button></li>)}</ul>
      <p className="unit">Las centrales térmicas y nucleares suelen devolver casi toda el agua que usan para refrigerar.</p>
    </section>
  </>)
}

type Tab = 'resumen' | 'historico' | 'rankings'
export function Panel({ layer, onPick, sel, card, leyenda }: { layer: Layer; onPick: Pick; sel: Sel | null; card: ReactNode; leyenda?: ReactNode }) {
  const [tab, setTab] = useState<Tab>('resumen')
  const tabbed = layer === 'agua' || layer === 'energia'
  return (
    <div className="panel-inner">
      {leyenda}
      <Finder onPick={onPick} />
      <AnimatePresence mode="popLayout" initial={false}>{card}</AnimatePresence>
      {tabbed && <Tabs value={tab} onChange={setTab} items={[['resumen', layer === 'agua' ? 'Resumen' : 'Energía'], ['historico', 'Histórico'], ['rankings', 'Rankings']]} />}
      <AnimatePresence mode="wait">
        <motion.div key={layer + (tabbed ? tab : '')} className="panel-layer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tabbed && tab === 'resumen' && (layer === 'agua' ? <WaterSummary onPick={onPick} sel={sel} /> : <EnergyPanel onPick={onPick} />)}
          {tabbed && tab === 'historico' && <WaterHistory />}
          {tabbed && tab === 'rankings' && <Rankings onPick={onPick} />}
          {layer === 'lluvia' && <RainPanel onPick={onPick} />}
          {layer === 'rios' && <FlowPanel onPick={onPick} />}
          {layer === 'consumo' && <ConsPanel onPick={onPick} sel={sel} />}
          {layer === 'depuracion' && <DepPanel onPick={onPick} sel={sel} />}
          {layer === 'alcantarillado' && <AlcPanel onPick={onPick} sel={sel} />}
          {layer === 'vertidos' && <DischargePanel onPick={onPick} />}
        </motion.div>
      </AnimatePresence>
      <p className="foot">Toca cualquier punto del mapa para abrir su ficha. Boletín {data.meta.boletin} del ministerio. Las «i» explican cada dato.</p>
    </div>
  )
}
