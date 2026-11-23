import { useEffect, useMemo, useState } from 'react'
import { motion, type PanInfo } from 'motion/react'
import { Activity, Bath, Building2, Network, CalendarClock, ChevronLeft, House, ChevronRight, CloudRain, Droplets, Recycle, Factory, Footprints, Map as MapIcon, Mountain, Ruler, Sparkles, Timer, Trophy, Waves, X, Zap } from 'lucide-react'
import { basinStats, consumo, data, depOrder, fmt, fmtBig, fmtPct, pct, status, type Reservoir } from './data'
import { byCapacity, rankIn, resInBasin, resolve, sequence, sizeRank, type Sel } from './sel'
import { Bar, CountUp, Head, HydroChart, Info, Ring, TimeChart } from './ui'
import { Ciclo } from './Ciclo'
import { habitantes, metrosPorHab, orden, regionDeNuts } from './ciudad'
import { EXTRA, RED, TRATAMIENTO, aggList, c1Color, edarById, edarList, type AggPt, type Edar } from './edar'
import { riverLen, riverList, riverMouth, riverStats, type River } from './rivers'
import { byHydroYear, envelope, fechaCorta, hydroLabel, hydroYear, near, toDate, useHistory, weekOf } from './history'

const POOL = 2500 // m³ de una piscina olímpica
const HOME_KWH = 3500 // consumo eléctrico anual aproximado de un hogar
const NOW = toDate(data.meta.fecha)
const rainMax = Math.max(...data.rain.map(g => g.p))
const rainMean = data.rain.reduce((t, g) => t + g.p, 0) / data.rain.length

const KIND = {
  res: { label: 'Embalse', icon: Droplets },
  basin: { label: 'Cuenca', icon: MapIcon },
  rain: { label: 'Pluviómetro', icon: CloudRain },
  dis: { label: 'Vertido', icon: Factory },
  flow: { label: 'Estación de aforo', icon: Activity },
  cons: { label: 'Abastecimiento', icon: House },
  dep: { label: 'Depuración', icon: Recycle },
  alc: { label: 'Alcantarillado', icon: Network },
  edar: { label: 'Depuradora', icon: Recycle },
  agg: { label: 'Núcleo urbano', icon: Building2 },
  river: { label: 'Río', icon: Waves },
} as const

function Stat({ label, info, children, tone }: { label: string; info?: string; children: React.ReactNode; tone?: string }) {
  return <div className={`stat ${tone ?? ''}`}><span>{label}{info && <Info k={info} />}</span><b>{children}</b></div>
}
const Fun = ({ icon: I, children, tone }: { icon: typeof Waves; children: React.ReactNode; tone?: string }) => <p className={`fun ${tone ?? ''}`}><I size={15} aria-hidden /><span>{children}</span></p>
/** Ficha de cada presa (inventario del ministerio + Wikidata); se carga una vez, al abrir el primer embalse. */
type Ficha = { tit?: string; tipo?: string; uso?: string; prov?: string; cuenca?: number; aport?: number; sup?: number; cota?: number; lc?: number; alv?: number; url?: string; año?: number; wiki?: string }
let fichasP: Promise<Record<string, Ficha>> | null = null
function useFicha(id: number) {
  const [f, setF] = useState<Ficha | null>(null)
  useEffect(() => { fichasP ??= fetch('./data/presas.json').then(r => r.json()).catch(() => ({})); let ok = true; fichasP.then(m => ok && setF(m[id] ?? null)); return () => { ok = false } }, [id])
  return f
}
const CAMPO_HA = 0.714 // un campo de fútbol de 105 × 68 m
const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const signed = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), d)}`

export function SelCard({ sel, onPick, isNew, compact, dir }: {
  sel: Sel; onPick: (s: Sel | null, dir?: number) => void; isNew: boolean; compact: boolean; dir: number
}) {
  const it = resolve(sel)
  if (!it) return null
  const seq = sequence(sel)
  const go = (d: number) => onPick(seq.list[(seq.at + d + seq.list.length) % seq.list.length], d)
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1)
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1)
  }
  const Icon = KIND[it.k].icon
  return (
    <motion.section
      className={`card selcard kind-${it.k} ${compact ? 'is-compact' : ''}`}
      initial={{ x: dir * 70, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -70, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      drag={compact ? 'x' : false} dragSnapToOrigin dragElastic={0.3} onDragEnd={onDragEnd} aria-live="polite"
    >
      <i className="scan" aria-hidden />
      <header className="sel-top">
        <span className="kind-chip"><Icon size={13} aria-hidden />{KIND[it.k].label}</span>
        {isNew && <motion.span className="new-chip" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}><Sparkles size={12} aria-hidden />Nuevo registro</motion.span>}
        <button className="icon-btn sm" onClick={() => onPick(null)} aria-label="Cerrar ficha"><X size={16} /></button>
      </header>
      {it.k === 'res' && <ResBody r={it.r} onPick={onPick} />}
      {it.k === 'basin' && <BasinBody id={it.b.id} onPick={onPick} />}
      {it.k === 'rain' && <RainBody i={it.i} />}
      {it.k === 'dis' && <DisBody i={it.i} />}
      {it.k === 'flow' && <FlowBody i={it.i} />}
      {it.k === 'cons' && <ConsBody i={it.i} />}
      {it.k === 'dep' && <DepBody i={it.i} />}
      {it.k === 'alc' && <AlcBody i={it.i} onPick={onPick} />}
      {it.k === 'edar' && <EdarBody p={it.p} />}
      {it.k === 'agg' && <AggBody a={it.a} onPick={onPick} />}
      {it.k === 'river' && <RiverBody v={it.v} onPick={onPick} />}
      <nav className="sel-nav" aria-label="Recorrer">
        <button onClick={() => go(-1)} aria-label="Anterior"><ChevronLeft size={19} /></button>
        <span><b>{seq.at + 1}</b> / {seq.list.length}<small>{seq.label}{compact ? ' · desliza' : ''}</small></span>
        <button onClick={() => go(1)} aria-label="Siguiente"><ChevronRight size={19} /></button>
      </nav>
    </motion.section>
  )
}

function ResBody({ r, onPick }: { r: Reservoir; onPick: (s: Sel) => void }) {
  const h = useHistory()
  const p = pct(r)
  const basin = basinStats.find(b => b.id === r.b)!
  const rk = rankIn(r)
  const capRankBasin = resInBasin(r.b).findIndex(x => x.id === r.id) + 1
  const bigger = Math.round((1 - sizeRank(r) / byCapacity.length) * 100)
  const tone = r.ec > 0 ? 'water' : 'water'
  const hist = useMemo(() => {
    if (!h) return null
    const vals = h.res[r.id]; if (!vals) return null
    const lastYear = near(h.rd, vals, new Date(NOW.getTime() - 364 * 864e5))
    const w = weekOf(NOW), ys = byHydroYear(h.rd, vals, r.c), cy = hydroYear(NOW)
    const avg = envelope(ys, Array.from({ length: 10 }, (_, i) => cy - 10 + i)).avg[w]
    const pts = h.rd.map((d, i) => ({ t: toDate(d).getTime(), v: vals[i] == null ? null : (vals[i]! / r.c) * 100 }))
    return { lastYear: lastYear == null ? null : (lastYear / r.c) * 100, avg, pts, rec: h.rec[r.id] }
  }, [h, r])
  return (<>
    <h2 className="sel-name">{r.n}</h2>
    <p className="sel-sub">
      {r.riv && <>Río {r.riv} · </>}<button className="link" onClick={() => onPick({ k: 'basin', id: r.b })}>{data.basins[r.b]}</button> · {r.ec > 0 ? 'con central hidroeléctrica' : 'sin central'}
    </p>
    <div className="sel-hero">
      <Ring p={p} tone={status(p) === 'low' ? 'low' : tone} label={`${r.n} al ${fmtPct(p)}`} />
      <div className="stat-grid">
        <Stat label="Agua" info="hm3"><CountUp value={r.a} /> <small>hm³</small></Stat>
        <Stat label="Capacidad" info="capacidad">{fmt(r.c)} <small>hm³</small></Stat>
        <Stat label="Semana" info="semana" tone={r.d > 0 ? 'up' : r.d < 0 ? 'down' : ''}>{signed(r.d)} <small>hm³</small></Stat>
        {r.ec > 0 ? <Stat label={`Energía · de ${fmt(r.ec)}`} info="energia" tone="volt"><CountUp value={r.e} /> <small>GWh</small></Stat> : <Stat label="Energía" info="hidro">— <small>no turbina</small></Stat>}
      </div>
    </div>
    <ul className="vs">
      <li><span>Ahora</span><Bar value={p} max={100} tone={status(p)} /><b>{fmtPct(p)}</b></li>
      <li><span>Hace un año</span><Bar value={hist?.lastYear ?? 0} max={100} tone="ghost" /><b>{hist?.lastYear != null ? fmtPct(hist.lastYear) : '…'}</b></li>
      <li><span>Media 10 años <Info k="media10" /></span><Bar value={hist?.avg ?? 0} max={100} tone="ghost" /><b>{hist?.avg != null ? fmtPct(hist.avg) : '…'}</b></li>
      <li><span>Su cuenca</span><Bar value={basin.pct} max={100} tone="ghost" /><b>{fmtPct(basin.pct)}</b></li>
    </ul>
    {hist && <>
      <Head info="records">Llenado desde 2015</Head>
      <TimeChart pts={hist.pts} height={150} label={`Porcentaje de llenado de ${r.n} desde 2015`}
        marks={[
          ...(hist.rec && toDate(hist.rec.min[1]) >= toDate(h!.rd[0]) ? [{ t: toDate(hist.rec.min[1]).getTime(), v: hist.rec.min[0], label: 'min', cls: 'mk-min' }] : []),
          { t: NOW.getTime(), v: p, label: 'now', cls: 'mk-now' },
        ]} />
      <p className="note">Datos semanales del ministerio hasta febrero de 2026 y el boletín actual. Las semanas intermedias se completan con la actualización automática.</p>
      {hist.rec && <div className="records">
        <div><span>Récord máximo</span><b>{fmtPct(hist.rec.max[0])}</b><small>{fechaCorta(hist.rec.max[1])}</small></div>
        <div><span>Mínimo histórico</span><b className="down">{fmtPct(hist.rec.min[0])}</b><small>{fechaCorta(hist.rec.min[1])}</small></div>
      </div>}
    </>}
    {!h && <p className="loading">Cargando histórico…</p>}
    <Head>Ranking</Head>
    <ul className="facts">
      <li><b>{sizeRank(r)}º</b> de {byCapacity.length} en capacidad en España</li>
      <li><b>{capRankBasin}º</b> de {rk.of} en capacidad en {data.basins[r.b]}</li>
      <li><b>{rk.pos}º</b> de {rk.of} por llenado en su cuenca</li>
      {r.hm && <li>Presa de <b>{r.hm} m</b> de altura desde cimientos <Info k="presa" /></li>}
    </ul>
    <Head>Curiosidades</Head>
    <Fun icon={Waves}>Guarda el agua de <b>{fmt((r.a * 1e6) / POOL)}</b> piscinas olímpicas. Lleno cabrían <b>{fmt(((r.c - r.a) * 1e6) / POOL)}</b> más.</Fun>
    <Fun icon={Droplets}>Es más grande que el <b>{bigger} %</b> de los embalses de España.</Fun>
    {r.e > 0 && <Fun icon={Zap} tone="volt">Sus {fmt(r.e)} GWh darían electricidad un año a unos <b>{fmt((r.e * 1e6) / HOME_KWH)}</b> hogares.</Fun>}
    <PresaFicha r={r} />
  </>)
}

/** El resumen del artículo de Wikipedia (se pide en el momento; licencia CC BY-SA, con enlace al artículo). */
function Wiki({ url }: { url: string }) {
  const [t, setT] = useState<string | null>(null)
  useEffect(() => {
    let ok = true; setT(null)
    const titulo = decodeURIComponent(url.split('/wiki/')[1] ?? '')
    fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`).then(r => r.ok ? r.json() : null).then(j => ok && j?.extract && setT(j.extract)).catch(() => {})
    return () => { ok = false }
  }, [url])
  if (!t) return null
  return <blockquote className="wiki">{t}<cite><a href={url} target="_blank" rel="noopener noreferrer">Wikipedia</a> · CC BY-SA</cite></blockquote>
}

/** Lo que cuenta el inventario de la presa: año, tipo, quién la gestiona, sus medidas y su aliviadero. */
function PresaFicha({ r }: { r: Reservoir }) {
  const f = useFicha(r.id)
  if (!f) return null
  const año = new Date().getFullYear()
  const llenado = f.aport && f.aport > 0 ? (r.c / f.aport) * 12 : null // meses que tardaría en llenarse con la aportación media
  return <>
    {f.año && <Fun icon={CalendarClock}>Data de <b>{f.año}</b>: lleva {fmt(año - f.año)} años guardando agua.</Fun>}
    {f.tipo && <Fun icon={Building2}>Es una {minus(f.tipo)}{f.tit && <>, de <b>{f.tit.toLowerCase().split(' ').map((w, i) => w.length > 3 || i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')}</b></>}{f.uso && <>, y su agua se usa sobre todo para {minus(f.uso)}</>}.</Fun>}
    {r.hm && <Fun icon={Ruler}>Su presa mide <b>{fmt(r.hm)} m</b> desde los cimientos, como un edificio de unas {fmt(r.hm / 3)} plantas{f.lc && <>, y <b>{fmt(f.lc)} m</b> de largo por arriba</>}.</Fun>}
    {f.cota && <Fun icon={Mountain}>Su coronación está a <b>{fmt(f.cota)} m</b> sobre el nivel del mar.</Fun>}
    {f.sup && <Fun icon={MapIcon}>Lleno, el agua cubre <b>{fmt(f.sup)} ha</b>: unos {fmt(f.sup / CAMPO_HA)} campos de fútbol.</Fun>}
    {llenado && llenado < 600 && <Fun icon={Timer}>Le llegan de media {fmt(f.aport!, f.aport! < 10 ? 1 : 0)} hm³ al año de una cuenca de {fmt(f.cuenca ?? 0)} km²: sin gastar nada, se llenaría desde cero en {llenado < 18 ? <b>{fmt(llenado)} meses</b> : <b>{fmt(llenado / 12, 1)} años</b>}.</Fun>}
    {f.alv && f.alv > 5 && <Fun icon={Waves}>Su aliviadero puede soltar <b>{fmt(f.alv)} m³ por segundo</b>: llenaría una piscina olímpica en {fmt(POOL / f.alv, POOL / f.alv < 10 ? 1 : 0)} segundos.</Fun>}
    {f.wiki && <Wiki url={f.wiki} />}
    {(f.wiki || f.url) && <p className="fun-links">{f.wiki && <a href={f.wiki} target="_blank" rel="noopener noreferrer">Su historia en Wikipedia ↗</a>}{f.url && <a href={f.url} target="_blank" rel="noopener noreferrer">Ficha oficial de la presa ↗</a>}</p>}
  </>
}

function BasinBody({ id, onPick }: { id: string; onPick: (s: Sel) => void }) {
  const h = useHistory()
  const b = basinStats.find(x => x.id === id)!
  const pos = basinStats.findIndex(x => x.id === id) + 1
  const list = resInBasin(id)
  const chart = useMemo(() => {
    const s = h?.basins[id]; if (!h || !s) return null
    const ys = byHydroYear(h.rd, s.a, s.c), cy = hydroYear(NOW)
    const env = envelope(ys, Array.from({ length: 10 }, (_, i) => cy - 10 + i).filter(y => ys.has(y)))
    return { ys, env, cy }
  }, [h, id])
  return (<>
    <h2 className="sel-name">{b.name}</h2>
    <p className="sel-sub">{pos}ª de {basinStats.length} cuencas por llenado · {b.k} embalses <Info k="cuenca" /></p>
    <div className="sel-hero">
      <Ring p={b.pct} tone={status(b.pct) === 'low' ? 'low' : 'water'} label={`${b.name} al ${fmtPct(b.pct)}`} />
      <div className="stat-grid">
        <Stat label="Agua" info="hm3"><CountUp value={b.a} /> <small>hm³</small></Stat>
        <Stat label="Capacidad" info="capacidad">{fmt(b.c)} <small>hm³</small></Stat>
        <Stat label="Semana" info="semana" tone={b.d > 0 ? 'up' : b.d < 0 ? 'down' : ''}>{signed(b.d)} <small>hm³</small></Stat>
        <Stat label="Energía" info="energia" tone="volt"><CountUp value={b.e} /> <small>GWh</small></Stat>
      </div>
    </div>
    {chart && <>
      <Head info="anyo">Año hidrológico</Head>
      <HydroChart height={170} band={{ lo: chart.env.lo, hi: chart.env.hi }}
        lines={[
          { key: 'avg', label: 'Media 10 años', vals: chart.env.avg, cls: 'ln-avg' },
          { key: 'y1', label: hydroLabel(chart.cy - 1), vals: chart.ys.get(chart.cy - 1) ?? [], cls: 'ln-prev' },
          { key: 'y2', label: hydroLabel(chart.cy - 2), vals: chart.ys.get(chart.cy - 2) ?? [], cls: 'ln-old' },
        ]}
        now={{ w: weekOf(NOW), v: b.pct }} />
      <p className="note">El punto es esta semana. Por cuenca, los datos semanales de marzo a octubre de 2026 llegan con la actualización automática.</p>
    </>}
    <Head>Embalses de la cuenca por capacidad</Head>
    <ol className="cap-rank">
      {list.slice(0, 8).map((r, i) => (
        <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}>
          <em>{i + 1}</em><span>{r.n}</span><Bar value={r.c} max={list[0].c} tone="cap" /><b>{fmt(r.c)}</b>
        </button></li>
      ))}
    </ol>
    <p className="grid-title">Todos sus embalses · toca uno</p>
    <div className="minitanks">
      {list.map((r, i) => {
        const p = pct(r)
        return (
          <motion.button key={r.id} className={`mt st-${status(p)}`} onClick={() => onPick({ k: 'res', id: r.id })} title={`${r.n}: ${fmtPct(p)}`} aria-label={`${r.n}, ${fmtPct(p)}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.5) }}>
            <i style={{ height: `${Math.min(100, p)}%` }} />
          </motion.button>
        )
      })}
    </div>
  </>)
}

function RainBody({ i }: { i: number }) {
  const g = data.rain[i]
  const pos = [...data.rain].sort((a, b) => b.p - a.p).findIndex(x => x === g) + 1
  const times = g.p / rainMean
  return (<>
    <h2 className="sel-name">{g.n}</h2>
    <p className="sel-sub">Observatorio de AEMET · {g.z}</p>
    <div className="sel-hero">
      <Ring p={(g.p / rainMax) * 100} shown={g.p} unit="l/m²" tone="rain" label={`${fmt(g.p, 1)} litros por metro cuadrado`} />
      <div className="stat-grid">
        <Stat label="Puesto">{pos}º <small>de {data.rain.length}</small></Stat>
        <Stat label="Vs. media" tone={times >= 1 ? 'up' : 'down'}>{fmt(times, 1)}<small>×</small></Stat>
        <Stat label="Récord semana" info="lluvia">{fmt(rainMax, 1)} <small>l/m²</small></Stat>
        <Stat label="Media España">{fmt(rainMean, 1)} <small>l/m²</small></Stat>
      </div>
    </div>
    <Fun icon={Droplets}>En un tejado de 100 m² habrían caído <b>{fmt(g.p * 100)}</b> litros: unas {fmt((g.p * 100) / 150)} bañeras llenas.</Fun>
  </>)
}

function FlowBody({ i }: { i: number }) {
  const f = data.flows[i]
  const pos = [...data.flows].sort((a, b) => b.q - a.q).findIndex(x => x === f) + 1
  const ch = f.qa ? ((f.q - f.qa) / f.qa) * 100 : null
  const max = Math.max(...data.flows.map(x => x.q))
  return (<>
    <h2 className="sel-name">{f.n}</h2>
    <p className="sel-sub">Río {f.r} · {f.e ? 'salida o entrada de embalse' : 'estación en el río'} <Info k="caudal" /></p>
    <div className="sel-hero">
      <Ring p={(Math.sqrt(f.q) / Math.sqrt(max)) * 100} shown={f.q} unit="m³/s" tone="flow" label={`${fmt(f.q, 1)} metros cúbicos por segundo`} />
      <div className="stat-grid">
        <Stat label="Caudal" info="caudal">{fmt(f.q, f.q < 10 ? 2 : 0)} <small>m³/s</small></Stat>
        <Stat label="Semana anterior">{f.qa != null ? fmt(f.qa, f.qa < 10 ? 2 : 0) : '—'} <small>m³/s</small></Stat>
        <Stat label="Cambio" tone={ch == null ? '' : ch >= 0 ? 'up' : 'down'}>{ch == null ? '—' : `${signed(ch)} %`}</Stat>
        <Stat label="Puesto">{pos}º <small>de {data.flows.length}</small></Stat>
      </div>
    </div>
    {f.q > 0 && <Fun icon={Waves}>Cada segundo pasan <b>{fmt(f.q * 1000)}</b> litros: llenaría una piscina olímpica en {f.q * 60 >= POOL ? <b>{fmt(POOL / f.q)} segundos</b> : <b>{fmt(POOL / f.q / 60)} minutos</b>}.</Fun>}
  </>)
}

function DisBody({ i }: { i: number }) {
  const d = data.dischargers[i]
  const pos = [...data.dischargers].sort((a, b) => b.v - a.v).findIndex(x => x === d) + 1
  const perDay = (d.v * 1e6) / 365
  const urb = d.t === 'URBANO'
  const max = Math.max(...data.dischargers.map(x => x.v))
  return (<>
    <h2 className="sel-name">{d.n}</h2>
    <p className="sel-sub">{d.m} ({d.pr}) · {d.c || (urb ? 'Saneamiento urbano' : 'Industrial')}</p>
    <div className="sel-hero">
      <Ring p={(Math.sqrt(d.v) / Math.sqrt(max)) * 100} shown={d.v} unit="hm³/año" tone={urb ? 'urb' : 'ind'} label={`${fmt(d.v, 1)} hectómetros cúbicos al año`} />
      <div className="stat-grid">
        <Stat label="Autorizado" info="vertidos">{fmt(d.v, d.v < 100 ? 1 : 0)} <small>hm³/año</small></Stat>
        <Stat label="Al día">{fmtBig(perDay)} <small>m³</small></Stat>
        <Stat label="Puesto">{pos}º <small>de {data.dischargers.length}</small></Stat>
        <Stat label="Tipo" tone={urb ? 'urb' : 'ind'}>{urb ? 'Ciudad' : 'Industria'}</Stat>
      </div>
    </div>
    <Fun icon={Waves}>Cada día podría devolver al agua el equivalente a <b>{fmt(perDay / POOL)}</b> piscinas olímpicas.</Fun>
    <p className="note">Es el volumen que tiene permiso para verter, no lo que mide ni lo que consume.</p>
  </>)
}

function ConsBody({ i }: { i: number }) {
  const u = consumo.regions[i], N = consumo.national
  const max = Math.max(...consumo.regions.map(x => x.l))
  const yearM3 = (u.l * 365) / 1000
  return (<>
    <h2 className="sel-name">{u.n}</h2>
    <p className="sel-sub">Hogares · año {consumo.year} · INE <Info k="consumo" /></p>
    <div className="sel-hero">
      <Ring p={(u.l / max) * 100} shown={u.l} unit="l/hab/día" tone={u.l > N.l ? 'urb' : 'water'} label={`${u.l} litros por habitante y día`} />
      <div className="stat-grid">
        <Stat label="Puesto">{i + 1}º <small>de {consumo.regions.length}</small></Stat>
        <Stat label="Vs. España" tone={u.l > N.l ? 'down' : 'up'}>{signed(u.l - N.l)} <small>litros</small></Stat>
        {u.v != null && <Stat label="En dos años" tone={u.v > 0 ? 'down' : 'up'}>{signed(u.v, 1)} <small>%</small></Stat>}
        {u.cost != null && <Stat label="Coste" info="coste">{fmt(u.cost, 2)} <small>€/m³</small></Stat>}
      </div>
    </div>
    <ul className="vs">
      <li><span>{u.n.length > 14 ? 'Esta comunidad' : u.n}</span><Bar value={u.l} max={max} tone={u.l > N.l ? 'urb' : 'water'} /><b>{u.l}</b></li>
      <li><span>Media de España</span><Bar value={N.l} max={max} tone="ghost" /><b>{N.l}</b></li>
    </ul>
    <Fun icon={Bath}>Una familia de cuatro gasta unos <b>{fmt(u.l * 4)}</b> litros al día en casa: {fmt((u.l * 4) / 150, 1)} bañeras llenas.</Fun>
    {u.supplied ? <>
      <h3 className="sel-h">De la red al contador <Info k="abastecimiento" /></h3>
      <ul className="vs">
        <li><span>Entra en la red</span><Bar value={u.supplied} max={u.supplied} /><b>{fmt(u.supplied, 1)}</b></li>
        <li><span>Registrada</span><Bar value={u.registered ?? 0} max={u.supplied} tone="ghost" /><b>{fmt(u.registered ?? 0, 1)}</b></li>
        <li><span>Fugas y roturas</span><Bar value={u.lossReal ?? 0} max={u.supplied} tone="low" /><b>{fmt(u.lossReal ?? 0, 1)}</b></li>
        <li><span>Errores y fraudes</span><Bar value={u.lossApparent ?? 0} max={u.supplied} tone="ghost" /><b>{fmt(u.lossApparent ?? 0, 1)}</b></li>
      </ul>
      <p className="unit">hm³ al año · {consumo.year}</p>
      {u.lossPct != null && <Fun icon={Droplets} tone={u.lossPctPrev != null && u.lossPct > u.lossPctPrev ? 'warn' : ''}>Por fugas y roturas se pierde el <b>{fmt(u.lossPct, 1)} %</b> del agua que entra en la red{u.lossPctPrev != null ? <> ({u.lossPct > u.lossPctPrev ? 'más' : u.lossPct < u.lossPctPrev ? 'menos' : 'lo mismo'} que en {consumo.prevYear}, cuando era el {fmt(u.lossPctPrev, 1)} %)</> : null}; en España, el {fmt(N.lossPct ?? 0, 1)} %.</Fun>}
    </> : null}
    {u.cost != null && <Fun icon={Waves}>Cada habitante usa unos <b>{fmt(yearM3)} m³</b> al año en casa; al coste medio de la comunidad son unos <b>{fmt(yearM3 * u.cost)} €</b> por persona entre abastecimiento y saneamiento.</Fun>}
    <p className="note">El INE publica este dato por comunidad autónoma. No hay una estadística oficial por municipio para toda España.</p>
  </>)
}

/** El decantador de la depuradora visto desde arriba: el anillo se llena con la carga que recibe frente a su capacidad. */
function Decantador({ p }: { p: number }) {
  const r = 44, C = 2 * Math.PI * r, v = Math.min(1, p / 100)
  return <svg className="decantador" viewBox="0 0 110 110" role="img" aria-label={`Recibe el ${fmt(p)} % de su capacidad`}>
    <circle cx={55} cy={55} r={r} className="dc-fondo" />
    <circle cx={55} cy={55} r={r} className={`dc-carga ${p > 100 ? 'is-sobre' : ''}`} strokeDasharray={`${C * v} ${C}`} transform="rotate(-90 55 55)" />
    <circle cx={55} cy={55} r={r - 9} className="dc-agua" />
    <g className="dc-puente"><line x1={55} y1={55} x2={55 + r - 9} y2={55} /><circle cx={55 + r - 12} cy={55} r={2.5} /></g>
    <circle cx={55} cy={55} r={4} className="dc-eje" />
    <text x={55} y={52} textAnchor="middle" className="dc-num">{fmt(p)} %</text>
    <text x={55} y={66} textAnchor="middle" className="dc-u">de su capacidad</text>
  </svg>
}

/** habitantes equivalentes, corto: «2,3 M h-e», «45.000 h-e» */
const hEq = (v: number) => v >= 1e6 ? <>{fmt(v / 1e6, 1)} <small>M h-e</small></> : <>{fmt(v)} <small>h-e</small></>

function EdarBody({ p }: { p: Edar }) {
  const uso = p.cap && p.load ? (p.load / p.cap) * 100 : null
  const all = edarList() ?? [], pos = all.indexOf(p) + 1
  const dia = p.vol ? p.vol / 365 : null
  return (<>
    <h2 className="sel-name">EDAR {p.n}</h2>
    <p className="sel-sub">Depuradora · datos de 2022 · reporte a la UE</p>
    <div className="sel-hero">
      {uso != null ? <Decantador p={uso} /> : <Ring p={0} shown={0} unit="sin dato" label="Sin dato de carga" />}
      <div className="stat-grid">
        <Stat label="Capacidad">{p.cap ? hEq(p.cap) : '—'}</Stat>
        <Stat label="Recibe">{p.load ? hEq(p.load) : '—'}</Stat>
        <Stat label="Tamaño">{pos}º <small>de {fmt(all.length)}</small></Stat>
        <Stat label="Cumple" tone={p.ok === 0 ? 'down' : p.ok === 1 ? 'up' : ''}>{p.ok === 1 ? 'Sí' : p.ok === 0 ? 'No' : '—'}</Stat>
      </div>
    </div>
    <p className={`trat t${p.t}`}><b>{TRATAMIENTO[p.t]}</b>{p.e.length ? <>: {p.e.map(x => EXTRA[x] ?? x).join(', ')}</> : null}.</p>
    {dia ? <Fun icon={Waves}>Trató unos <b>{fmt(dia)} m³</b> al día en 2022: {fmt(dia / POOL, 1)} piscinas olímpicas diarias.</Fun> : null}
    {p.ag.length > 0 && <>
      <h3 className="sel-h">Aglomeraciones que atiende</h3>
      <ul className="aggs">{p.ag.map(a => <li key={a.c}>
        <span className="agg-n">{a.n || a.c}{a.pe ? <small> · {fmtBig(a.pe)} hab. eq.</small> : null}</span>
        {a.c1 != null && <span className="agg-b" title={`${fmt(a.c1, 1)} % de la carga la recogen los colectores`}><i style={{ width: `${Math.min(100, a.c1)}%` }} />{a.c2 ? <i className="ias" style={{ width: `${Math.min(100, a.c2)}%` }} /> : null}</span>}
        <small className="agg-d">{a.c1 != null ? <>Colectores: <b>{fmt(a.c1, a.c1 % 1 ? 1 : 0)} %</b> de la carga{a.c2 ? <>, fosas y sistemas individuales {fmt(a.c2, 1)} %</> : null}. </> : null}{a.red && RED[a.red] ? <>Red {RED[a.red]}.</> : null}{a.pct != null && a.pct < 100 ? <> Llega aquí el {fmt(a.pct)} %.</> : null}</small>
      </li>)}</ul>
    </>}
    <p className="note">Habitante equivalente: la contaminación que genera una persona al día; incluye industria y comercios. La capacidad es la media de diseño y la carga es la máxima semanal, por eso puede pasar del 100 %. «Cumple» se refiere a los límites de vertido que le exige la directiva. Fuente: Agencia Europea de Medio Ambiente, reporte de España (cuestionario 2023).</p>
  </>)
}

/** La aglomeración vista como una red: el colector principal y sus ramales, encendidos según lo que recogen. */
function Red({ c1, c2 }: { c1: number; c2: number }) {
  const ramas = 12, on = Math.round((c1 / 100) * ramas), ias = Math.round((c2 / 100) * ramas)
  return <svg className="redsvg" viewBox="0 0 120 110" role="img" aria-label={`Los colectores recogen el ${fmt(c1, 1)} %`}>
    <line x1={60} y1={8} x2={60} y2={92} className="rs-tronco" />
    {Array.from({ length: ramas }, (_, j) => { const y = 14 + (j >> 1) * 13, lado = j % 2 ? 1 : -1, cls = j < on ? 'rs-on' : j < on + ias ? 'rs-ias' : 'rs-off'
      return <g key={j} className={cls}><line x1={60} y1={y} x2={60 + lado * 34} y2={y - 5} /><circle cx={60 + lado * 38} cy={y - 6} r={3.2} /></g> })}
    <rect x={48} y={92} width={24} height={12} rx={3} className="rs-edar" />
    <text x={60} y={58} textAnchor="middle" className="dc-num">{fmt(c1, c1 % 1 ? 1 : 0)} %</text>
  </svg>
}

function AggBody({ a, onPick }: { a: AggPt; onPick: (s: Sel) => void }) {
  const all = aggList() ?? [], pos = all.indexOf(a) + 1
  const sinRed = a.c1 != null ? Math.max(0, 100 - a.c1 - (a.c2 ?? 0)) : null
  return (<>
    <h2 className="sel-name">{a.n}</h2>
    <p className="sel-sub">Aglomeración urbana · datos de 2022 · reporte a la UE</p>
    <div className="sel-hero">
      {a.c1 != null ? <Red c1={a.c1} c2={a.c2 ?? 0} /> : <Ring p={0} shown={0} unit="sin dato" label="Sin dato" />}
      <div className="stat-grid">
        <Stat label="Contamina como">{a.pe ? (a.pe >= 1e6 ? <>{fmt(a.pe / 1e6, 1)} <small>M h-e</small></> : <>{fmt(a.pe)} <small>h-e</small></>) : '—'}</Stat>
        <Stat label="Tamaño">{pos}º <small>de {fmt(all.length)}</small></Stat>
        {a.c2 ? <Stat label="Fosas e individuales">{fmt(a.c2, 1)} <small>%</small></Stat> : null}
        {sinRed ? <Stat label="Sin recoger" tone="down">{fmt(sinRed, 1)} <small>%</small></Stat> : null}
      </div>
    </div>
    {a.c1 != null && <Fun icon={Waves} tone={a.c1 < 99.5 ? 'warn' : ''}>{a.c1 >= 99.5 ? <>Toda su agua usada la recogen las alcantarillas</> : <>Las alcantarillas recogen el <b>{fmt(a.c1, 1)} %</b> de su agua usada{a.c2 ? <>; otro {fmt(a.c2, 1)} % va a fosas sépticas y sistemas individuales</> : null}{sinRed ? <> y un {fmt(sinRed, 1)} % no se recoge</> : null}</>}.</Fun>}
    {a.red && RED[a.red] && <p className="trat" style={{ borderColor: c1Color(a.c1) }}>Red <b>{RED[a.red]}</b>.</p>}
    {a.sin ? <p className="note">El {fmt(a.sin, 1)} % de su carga llega a un río o al mar sin depurar.</p> : null}
    {a.ed.length > 0 && <>
      <h3 className="sel-h">Va a parar a</h3>
      <ul className="mini">{a.ed.map(i => { const p = edarById(i); return p && <li key={i}><button onClick={() => onPick({ k: 'edar', i })}><span>EDAR {p.n}<small>{TRATAMIENTO[p.t]}</small></span><b>{p.ok === 0 ? 'no cumple' : p.ok === 1 ? 'cumple' : ''}</b></button></li> })}</ul>
    </>}
    {!a.ed.length && <p className="note">No consta ninguna depuradora enlazada en el reporte.</p>}
    <p className="note">Aglomeración: el núcleo (o núcleos) cuya agua usada se recoge junta. Habitante equivalente: la contaminación de una persona al día, incluidas industria y comercios. Fuente: Agencia Europea de Medio Ambiente, reporte de España (2022).</p>
  </>)
}

const MAD_BCN = 620 // km de autovía entre Madrid y Barcelona, para hacerse una idea
function AlcBody({ i, onPick }: { i: number; onPick: (s: Sel) => void }) {
  const u = consumo.regions[i], N = consumo.national, v = metrosPorHab(u), vN = metrosPorHab(N)
  const lista = orden('alcantarillado'), pos = lista.findIndex(x => x.i === i) + 1, max = lista[0]?.v ?? 1
  const hab = habitantes(u)
  const ags = (aggList() ?? []).map((a, j) => ({ a, j })).filter(x => regionDeNuts(x.a.nuts) === u.n)
  const faltan = ags.filter(x => x.a.c1 != null && x.a.c1 < 99.5).sort((p, q) => (q.a.pe ?? 0) - (p.a.pe ?? 0))
  return (<>
    <h2 className="sel-name">{u.n}</h2>
    <p className="sel-sub">Alcantarillado · año {consumo.year} · INE <Info k="alcantarillado" /></p>
    <div className="sel-hero">
      {v != null ? <Ring p={(v / max) * 100} shown={v} unit="m/hab" tone="urb" label={`${fmt(v, 1)} metros de alcantarillado por habitante`} /> : <Ring p={0} shown={0} unit="sin dato" label="Sin dato" />}
      <div className="stat-grid">
        {pos > 0 && <Stat label="Puesto">{pos}º <small>de {lista.length}</small></Stat>}
        {u.sewerKm ? <Stat label="Red">{fmt(u.sewerKm)} <small>km</small></Stat> : null}
        {v != null && vN != null && <Stat label="Vs. España">{signed(v - vN, 1)} <small>m/hab</small></Stat>}
        {hab ? <Stat label="Habitantes">{fmtBig(hab)}</Stat> : null}
      </div>
    </div>
    {u.sewerKm ? <Fun icon={Ruler}>Puesto en fila, su alcantarillado iría <b>{fmt(u.sewerKm / MAD_BCN, 1)} veces</b> de Madrid a Barcelona.</Fun> : null}
    {v != null && vN != null && <Fun icon={Network}>{v > vN ? <>Tiene más tubo por vecino que la media (<b>{fmt(vN, 1)} m</b>): suele pasar donde la gente vive más repartida, y encarece mantener y renovar la red.</> : <>Tiene menos tubo por vecino que la media (<b>{fmt(vN, 1)} m</b>): la población vive más concentrada y cada metro de red da servicio a más gente.</>}</Fun>}
    {ags.length > 0 && <>
      <h3 className="sel-h">Sus núcleos urbanos</h3>
      <p className="lead sm">{fmt(ags.length)} núcleos de más de 2.000 habitantes equivalentes reportados a la UE; {faltan.length ? <>en <b>{fmt(faltan.length)}</b> las alcantarillas no recogen toda el agua usada.</> : <>en todos, las alcantarillas recogen toda el agua usada.</>}</p>
      {faltan.length > 0 && <ul className="mini">{faltan.slice(0, 4).map(({ a, j }) => <li key={a.c}><button onClick={() => onPick({ k: 'agg', i: j })}><span>{a.n}<small>{a.pe ? `${fmtBig(a.pe)} hab. eq.` : ''}</small></span><b>{fmt(a.c1!, 1)} %</b></button></li>)}</ul>}
    </>}
    <p className="note">Metros de alcantarillado por habitante: kilómetros de red del INE divididos entre los habitantes, que salen del consumo de los hogares y los litros por persona que el INE calcula con el padrón. Los núcleos son del reporte de España a la Agencia Europea de Medio Ambiente (2022).</p>
  </>)
}

function DepBody({ i }: { i: number }) {
  const u = consumo.regions[i], N = consumo.national
  const pos = depOrder.indexOf(i) + 1
  const dia = (u.treated ?? 0), piscinas = dia / POOL
  return (<>
    <h2 className="sel-name">{u.n}</h2>
    <p className="sel-sub">Depuración · año {consumo.year} · INE <Info k="depuracion" /></p>
    <div className="sel-hero">
      <Ring p={u.reusePct ?? 0} shown={u.reusePct ?? 0} unit="%" tone="water" label={`Reutiliza el ${fmt(u.reusePct ?? 0, 1)} % del agua que depura`} />
      <div className="stat-grid">
        <Stat label="Puesto">{pos}º <small>de {depOrder.length}</small></Stat>
        {u.reusePct != null && N.reusePct != null && <Stat label="Vs. España" tone={u.reusePct >= N.reusePct ? 'up' : 'down'}>{signed(u.reusePct - N.reusePct, 1)} <small>puntos</small></Stat>}
        {u.reusePctPrev != null && u.reusePct != null && <Stat label={`Desde ${consumo.prevYear}`} tone={u.reusePct >= u.reusePctPrev ? 'up' : 'down'}>{signed(u.reusePct - u.reusePctPrev, 1)} <small>puntos</small></Stat>}
        {u.sewerKm ? <Stat label="Alcantarillado">{fmt(u.sewerKm)} <small>km</small></Stat> : null}
      </div>
    </div>
    {u.dest && <Ciclo dest={u.dest} tratada={u.treated} km={u.sewerKm} titulo={`Destino del agua depurada en ${u.n}`} />}
    {dia > 0 && <Fun icon={Waves}>Sus depuradoras tratan unos <b>{fmt(dia)} m³</b> al día: {fmt(piscinas)} piscinas olímpicas. {u.reused ? <>Vuelven a usarse <b>{fmt(u.reused)} m³</b> diarios.</> : null}</Fun>}
    {u.usos && Object.values(u.usos).some(v => (v ?? 0) > 0) && <Fun icon={Recycle}>El agua reutilizada va sobre todo a <b>{(() => { const [k, v] = Object.entries(u.usos!).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]; return `${k.toLowerCase()} (${fmt(v ?? 0, 0)} %)` })()}</b>.</Fun>}
    <p className="note">Volúmenes del INE en metros cúbicos al día. El reparto por destinos sale de otra tabla del INE y su «reutilizada» no coincide exactamente con el porcentaje de arriba.</p>
  </>)
}

/** Perfil del río: altitud frente a distancia, con sus embalses encima. */
function Profile({ v }: { v: River }) {
  const W = 340, H = 130, L = 34, R = 8, T = 12, B = 20
  const maxD = v.prof[v.prof.length - 1][0] || 1
  const maxZ = Math.max(200, Math.ceil(Math.max(...v.prof.map(p => p[1])) / 200) * 200)
  const x = (d: number) => L + (d / maxD) * (W - L - R), y = (z: number) => T + (1 - z / maxZ) * (H - T - B)
  const line = v.prof.map(([d, z], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(z).toFixed(1)}`).join('')
  const zAt = (d: number) => { const i = v.prof.findIndex(p => p[0] >= d); return i <= 0 ? v.prof[0][1] : v.prof[i][1] }
  const marks = v.res.filter(([, d]) => d != null).map(([id, d]) => ({ r: data.reservoirs.find(q => q.id === id)!, d: d! })).filter(m => m.r)
  return (
    <svg className="profile" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil de altitud del río ${v.n}`}>
      <defs><linearGradient id="prof-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3fe6ff" stopOpacity=".45" /><stop offset="1" stopColor="#3fe6ff" stopOpacity="0" /></linearGradient></defs>
      {[0, maxZ / 2, maxZ].map(z => <g key={z}><line x1={L} x2={W - R} y1={y(z)} y2={y(z)} className="prof-grid" /><text x={L - 5} y={y(z) + 3} className="prof-ax" textAnchor="end">{fmt(z)}</text></g>)}
      <path d={`${line}L${x(maxD)} ${y(0)}L${x(0)} ${y(0)}Z`} fill="url(#prof-g)" />
      <path d={line} className="prof-line" />
      {marks.map(m => <g key={m.r.id} transform={`translate(${x(m.d)} ${y(zAt(m.d))})`}><line y2={-12} className="prof-dam" /><circle r={3.2} className={`prof-res st-${status(pct(m.r))}`}><title>{m.r.n} · {fmtPct(pct(m.r))}</title></circle></g>)}
      <text x={x(0)} y={H - 5} className="prof-ax">Nacimiento</text>
      <text x={W - R} y={H - 5} className="prof-ax" textAnchor="end">{fmt(maxD)} km</text>
      <text x={L + 2} y={T - 2} className="prof-ax">m</text>
    </svg>
  )
}

function RiverBody({ v, onPick }: { v: River; onPick: (s: Sel) => void }) {
  const st = riverStats(v)
  const all = riverList() ?? []
  const lenRank = all.findIndex(x => x.id === v.id) + 1
  const byWater = [...all].map(x => ({ x, a: riverStats(x).a })).sort((p, q) => q.a - p.a)
  const waterRank = byWater.findIndex(w => w.x.id === v.id) + 1
  const pc = st.c ? (st.a / st.c) * 100 : 0
  const slope = st.drop / Math.max(1, v.km)
  return (<>
    <h2 className="sel-name">{v.n}</h2>
    <p className="sel-sub">{riverMouth(v)}{v.b && <> · <button className="link" onClick={() => onPick({ k: 'basin', id: v.b! })}>{data.basins[v.b]}</button></>}</p>
    <div className="sel-hero">
      {st.c > 0
        ? <Ring p={pc} tone={status(pc) === 'low' ? 'low' : 'water'} label={`Embalses del ${v.n} al ${fmtPct(pc)}`} />
        : <Ring p={(riverLen(v) / riverLen(all[0] ?? v)) * 100} shown={riverLen(v)} unit="km" tone="flow" label={`${fmt(riverLen(v))} kilómetros`} />}
      <div className="stat-grid">
        <Stat label="Longitud" info="longitud">{fmt(riverLen(v))} <small>km</small></Stat>
        <Stat label="Desnivel" info="perfil">{fmt(st.drop)} <small>m</small></Stat>
        <Stat label="Embalses">{st.res.length} <small>{st.c ? `· ${fmt(st.c)} hm³` : ''}</small></Stat>
        <Stat label="Caudal máx." info="caudal">{st.qMax ? fmt(st.qMax, st.qMax < 10 ? 1 : 0) : '—'} <small>m³/s</small></Stat>
      </div>
    </div>
    <Head info="perfil">Perfil del río</Head>
    <Profile v={v} />
    <p className="note">Nace hacia los {fmt(st.top)} m y deja el mapa hacia los {fmt(st.bottom)} m. Perfil orientativo, sacado de las curvas de nivel del IGN.</p>
    <Head>Curiosidades</Head>
    <Fun icon={Trophy}>Es el <b>{lenRank}.º</b> río más largo de los {all.length} del mapa{waterRank > 0 && st.c > 0 && <> y el {waterRank}.º que más agua guarda en sus embalses</>}.</Fun>
    <Fun icon={Footprints}>Recorrerlo andando, a 5 km/h y 8 horas al día, llevaría <b>{fmt(Math.max(1, riverLen(v) / 40))} días</b>.</Fun>
    {st.drop > 0 && <Fun icon={Mountain}>Baja {fmt(st.drop)} m: de media, <b>{fmt(slope, slope < 1 ? 2 : 1)} m por kilómetro</b>{slope > 5 ? ', un río de montaña' : slope < 1 ? ', un río tranquilo de llanura' : ''}.</Fun>}
    {st.qMax > 0 && <Fun icon={Waves}>Con su mayor caudal de esta semana, {fmt(st.qMax, st.qMax < 10 ? 1 : 0)} m³/s, llenaría una piscina olímpica en <b>{POOL / st.qMax < 120 ? `${fmt(POOL / st.qMax)} segundos` : `${fmt(POOL / st.qMax / 60)} minutos`}</b>.</Fun>}
    {st.res.length > 0 && <>
      <Head right={`${fmtPct(pc)} lleno`}>Sus embalses</Head>
      <ul className="rank">{st.res.map(({ r }) => <li key={r.id}><button onClick={() => onPick({ k: 'res', id: r.id })}><span className="rank-name">{r.n}</span><Bar value={pct(r)} max={100} tone={status(pct(r))} /><b>{fmtPct(pct(r))}</b></button></li>)}</ul>
    </>}
    {st.flows.length > 0 && <>
      <Head info="caudal">Caudal esta semana</Head>
      <ul className="rank">{st.flows.sort((p, q) => q.f.q - p.f.q).map(({ f, i }) => <li key={i}><button onClick={() => onPick({ k: 'flow', i })}><span className="rank-name">{f.n}</span><Bar value={f.q} max={st.qMax || 1} tone="flow" /><b>{fmt(f.q, f.q < 10 ? 1 : 0)}</b></button></li>)}</ul>
      <p className="unit">m³/s</p>
    </>}
    <Head>Ranking</Head>
    <ul className="facts">
      <li><b>{lenRank}º</b> de {all.length} ríos del mapa por longitud</li>
      {st.a > 0 && <li><b>{waterRank}º</b> por agua embalsada en su cauce: {fmt(st.a)} hm³</li>}
    </ul>
    <Head>Curiosidades</Head>
    {slope > 0 && <Fun icon={Activity}>Baja de media <b>{fmt(slope, 1)} m por km</b>: {slope > 5 ? 'un río de montaña, con mucha fuerza para turbinar' : slope > 2 ? 'pendiente moderada' : 'un río de llanura, lento y tranquilo'}.</Fun>}
    {st.qMax > 0 && <Fun icon={Waves}>En su punto de más caudal pasan <b>{fmt(st.qMax * 1000)}</b> litros por segundo.</Fun>}
    {st.a > 0 && <Fun icon={Droplets}>Sus embalses guardan el agua de <b>{fmt((st.a * 1e6) / POOL)}</b> piscinas olímpicas.</Fun>}
  </>)
}
