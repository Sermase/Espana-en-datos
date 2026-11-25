import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUpRight, Building2, Car, ChevronDown, Clapperboard, Droplets, Factory, Fuel, GraduationCap, HandCoins, HeartPulse, House, Landmark, Luggage, Mountain, Plane, PiggyBank, Receipt, Route, Scale, ScrollText, ShieldCheck, Ship, ShoppingBasket, Thermometer, TrainFront, TrendingUp, Trophy, Users, Wheat, Wind, Zap, type LucideIcon } from 'lucide-react'
import resumen from '../resumen.json'
import { useEffect, useState, type CSSProperties } from 'react'
import { CountUp } from '../graficos/CountUp'
import { useInView } from '../graficos/util'
import { AREAS, TEMAS, type AreaId, type Tema } from '../temas'
import { A } from '../Fuentes'
import { Hero } from './Hero'
import { Instalar } from './Instalar'
import { Micro } from './Micro'

const fecha = new Date(resumen.agua.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const reserva = (resumen.agua.a / resumen.agua.c) * 100


/** Los datos clave de cada tema, para verlos de un vistazo sin entrar. Salen de src/resumen.json, que escriben los robots. */
function cifras(id: string): { n: number; f: (v: number) => string; l: string }[] {
  const r = R[id] as Record<string, unknown> | undefined
  if (!r) return []
  const par = (k: string) => (r[k] as [string, number] | undefined)?.[1] ?? 0
  const pct = (d = 1, signo = false) => (v: number) => `${signo && v > 0 ? '+' : ''}${es(v, d)} %`
  const eur = (d = 3) => (v: number) => `${es(v, d)} €`
  const ent = (v: number) => es(v, 0)
  switch (id) {
    case 'agua': return [{ n: reserva, f: pct(1), l: 'llenos los embalses' }, { n: Number(r.a) / 1000, f: v => `${es(v, 1)} mil hm³`, l: 'de agua guardada' }]
    case 'gasolineras': return [{ n: Number(r.g95), f: eur(), l: 'gasolina 95, mediana' }, { n: Number(r.dsl), f: eur(), l: 'diésel' }, { n: Number(r.n), f: ent, l: 'gasolineras' }]
    case 'energia': return [{ n: Number(r.ren), f: pct(0), l: 'renovable ayer' }, { n: Number(r.pvpc), f: eur(), l: 'kWh hoy, tarifa regulada' }]
    case 'economia': return [{ n: par('pib'), f: pct(1, true), l: 'crece el PIB' }, { n: par('ipc'), f: pct(1), l: 'inflación' }, { n: par('paro'), f: pct(1), l: 'paro' }]
    case 'comercio': return [{ n: Number(r.exp), f: ent, l: `mil M€ vendidos en ${r.año}` }, { n: Number(r.exp) - Number(r.imp), f: v => es(v, 1), l: 'mil M€ de saldo' }]
    case 'vivienda': return [{ n: par('ipv_a'), f: pct(1, true), l: 'sube el precio en un año' }, { n: Number(r.compraventas), f: ent, l: 'casas vendidas en 12 meses' }]
    case 'cuentas': return [{ n: (Number(r.gasto) / Number(r.pib)) * 100, f: pct(1), l: `del PIB gastan las administraciones (${r.año})` }, { n: (Number(r.ingreso) - Number(r.gasto)) / Number(r.pib) * 100, f: pct(1), l: Number(r.ingreso) < Number(r.gasto) ? 'déficit' : 'superávit' }]
    case 'subvenciones': return [{ n: Number(r.imp) / 1e9, f: v => `${es(v, 1)} mil M€`, l: 'en ayudas, últimos 12 meses' }, { n: Number(r.n) / 1e6, f: v => `${es(v, 1)} M`, l: 'concesiones' }]
    case 'impuestos': return [{ n: Number(r.total12) / 1000, f: v => `${es(v, 1)} mil M€`, l: 'recaudados en 12 meses' }, { n: Number(r.var), f: pct(1, true), l: 'en un año' }]
    case 'turismo': return [{ n: Number(r.turistas) / 1e6, f: v => `${es(v, 1)} M`, l: `turistas internacionales en ${r.año}` }, ...(r.gasto ? [{ n: Number(r.gasto) / 1000, f: (v: number) => `${es(v, 1)} mil M€`, l: 'de gasto' }] : [])]
    case 'igualdad': return [{ n: Number(r.brecha), f: v => `${es(v, 1)} %`, l: `brecha salarial por hora, ${r.año}` }, { n: Number(r.ue), f: v => `${es(v, 1)} %`, l: 'media de la UE' }]
    case 'coches': return [{ n: Number(r.nuevos), f: v => es(v, 0), l: 'turismos nuevos en 12 meses' }, { n: Number(r.enchufables), f: v => `${es(v, 1)} %`, l: 'eléctricos o enchufables' }]
    case 'hogares': return [{ n: Number(r.gasto), f: v => `${es(v, 0)} €`, l: `gasto medio por hogar en ${r.año}` }, { n: Number(r.ahorro), f: v => `${es(v, 1)} %`, l: `tasa de ahorro en ${r.añoAhorro}` }]
    case 'aire': return [{ n: Number(r.gei) / 1000, f: v => `${es(v, 1)} Mt`, l: `de CO₂ equivalente en ${r.año}` }, { n: Number(r.vs1990), f: v => `${v > 0 ? '+' : '−'}${es(Math.abs(v), 1)} %`, l: 'frente a 1990' }]
    case 'seguridad': return [{ n: Number(r.total) / 1e6, f: v => `${es(v, 2)} M`, l: `delitos conocidos en ${r.año}` }, { n: Number(r.tasa), f: v => es(v, 1), l: 'por cada 1.000 habitantes' }]
    case 'poblacion': return [{ n: Number(r.total) / 1e6, f: v => `${es(v, 2)} M`, l: `habitantes (${r.año})` }, { n: Number(r.municipios), f: ent, l: 'municipios' }]
    default: return []
  }
}
const FUENTE: Record<string, string> = { turismo: 'INE y Eurostat, cada semana', igualdad: 'INE y Eurostat, cada semana', coches: 'DGT, cada mes', hogares: 'INE y Eurostat, cada semana', aire: 'Agencia Europea, cada dos horas', seguridad: 'Ministerio del Interior, cada trimestre', impuestos: 'Agencia Tributaria, cada semana', cuentas: 'Eurostat, cada semana', subvenciones: 'BDNS, cada día', vivienda: 'INE, cada semana', agua: `Datos del ${fecha}`, poblacion: 'Padrón del INE', economia: 'Eurostat, cada día', energia: 'En directo, Red Eléctrica', comercio: 'Eurostat, cada semana', gasolineras: 'Datos de hoy' }



const R = resumen as unknown as Record<string, Record<string, unknown>>
const es = (v: number, d = 1) => v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d })

const ICONO: Record<string, LucideIcon> = {
  poblacion: Users, sociedad: Building2, seguridad: ShieldCheck, igualdad: Scale, sanidad: HeartPulse, educacion: GraduationCap,
  economia: TrendingUp, vivienda: House, comercio: Ship, hogares: ShoppingBasket, turismo: Luggage, industria: Factory,
  cuentas: Landmark, impuestos: Receipt, presupuestos: PiggyBank, subvenciones: HandCoins, contratos: ScrollText,
  agua: Droplets, aire: Wind, clima: Thermometer, montana: Mountain, agricultura: Wheat,
  energia: Zap, gasolineras: Fuel, coches: Car, trenes: TrainFront, aeropuertos: Plane, carreteras: Route, cultura: Clapperboard, deporte: Trophy,
}
const ABIERTOS = AREAS.flatMap(a => TEMAS.filter(t => t.area === a.id && t.ruta))
const AREAS_ABIERTAS = AREAS.filter(a => ABIERTOS.some(t => t.area === a.id))
const PLAN = TEMAS.filter(t => !t.ruta)
const MARCA = '#3fe6ff'

/** Cinta tipo canal de bolsa, fina y pegada arriba: lo que cambia cada día. */
const CINTA: { n: string; v: string; id: string; cambio?: number }[] = [
  { n: 'Embalses', v: `${es(reserva, 1)} %`, id: 'agua' },
  ...(R.energia ? [{ n: 'Luz hoy', v: `${es(Number(R.energia.pvpc), 3)} €/kWh`, id: 'energia' }, { n: 'Renovable ayer', v: `${es(Number(R.energia.ren), 0)} %`, id: 'energia' }] : []),
  ...(R.gasolineras ? [{ n: 'Gasolina 95', v: `${es(Number(R.gasolineras.g95), 3)} €`, id: 'gasolineras' }, { n: 'Diésel', v: `${es(Number(R.gasolineras.dsl), 3)} €`, id: 'gasolineras' }] : []),
  ...(R.economia ? [{ n: 'IPC', v: `${es((R.economia.ipc as [string, number])[1], 1)} %`, id: 'economia' }, { n: 'Paro', v: `${es((R.economia.paro as [string, number])[1], 1)} %`, id: 'economia' }, { n: 'PIB', v: `${es((R.economia.pib as [string, number])[1], 1)} %`, id: 'economia', cambio: (R.economia.pib as [string, number])[1] }] : []),
  ...(R.vivienda ? [{ n: 'Vivienda', v: `${es((R.vivienda.ipv_a as [string, number])[1], 1)} %`, id: 'vivienda', cambio: (R.vivienda.ipv_a as [string, number])[1] }] : []),
  ...(R.impuestos ? [{ n: 'Recaudación', v: `${es(Number(R.impuestos.var), 1)} %`, id: 'impuestos', cambio: Number(R.impuestos.var) }] : []),
  ...(R.coches ? [{ n: 'Enchufables', v: `${es(Number(R.coches.enchufables), 1)} %`, id: 'coches' }] : []),
  ...(R.turismo ? [{ n: 'Turistas', v: `${es(Number(R.turismo.turistas) / 1e6, 1)} M`, id: 'turismo' }] : []),
]
function Cinta() {
  const items = (oculto: boolean) => CINTA.map((c, k) => { const t = TEMAS.find(x => x.id === c.id)!; return <a key={k} href={t.ruta} tabIndex={oculto ? -1 : undefined} style={{ '--c': t.color } as CSSProperties}>
    <i />{c.n} <b>{c.v}</b>{c.cambio != null && <em className={c.cambio >= 0 ? 'sube' : 'baja'}>{c.cambio >= 0 ? '▲' : '▼'}</em>}
  </a> })
  return <div className="cinta" role="region" aria-label="Indicadores del día">
    <span className="cinta-hoy"><i className="vivo" />Hoy</span>
    <div className="cinta-ver"><div className="cinta-pista"><span>{items(false)}</span><span aria-hidden>{items(true)}</span></div></div>
  </div>
}

/** La ficha del área elegida (o de todas): qué cuenta y qué temas tiene, sin repetir las cifras de las tarjetas. */
function Ficha({ area, setArea }: { area: AreaId | null; setArea: (a: AreaId | null) => void }) {
  const a = AREAS.find(x => x.id === area)
  const baja = () => document.getElementById('temas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return <div className="ficha" style={{ '--c': a?.color ?? MARCA } as CSSProperties} aria-live="polite">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={area ?? 'todo'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .25 }}>
        {!a ? <>
          <h2><b><CountUp value={ABIERTOS.length} fmt={v => String(Math.round(v))} /></b> temas en {AREAS_ABIERTAS.length} áreas</h2>
          <p>Datos oficiales que se actualizan solos. Elige un área para ver qué cuenta, o baja a las fichas.</p>
          <ul className="fi-areas">{AREAS_ABIERTAS.map(x => <li key={x.id}><button onClick={() => setArea(x.id)} style={{ '--c': x.color } as CSSProperties}><i />{x.nombre}<small>{ABIERTOS.filter(t => t.area === x.id).length}</small></button></li>)}</ul>
        </> : <>
          <h2>{a.nombre}</h2>
          <p>{a.lema}</p>
          <ul className="fi-temas">{ABIERTOS.filter(t => t.area === a.id).map(t => { const Ico = ICONO[t.id] ?? TrendingUp
            return <li key={t.id}><a href={t.ruta} style={{ '--c': t.color } as CSSProperties}><Ico size={16} />{t.nombre}</a></li> })}</ul>
        </>}
        <button className="fi-bajar" onClick={baja}>Ver {a ? `las fichas de ${a.nombre}` : 'todas las fichas'}<ArrowDown size={16} /></button>
      </motion.div>
    </AnimatePresence>
  </div>
}

/** Tarjeta de tema: nombre, dato principal grande en su color, el secundario, la fuente y un micrográfico vivo. */
function Tarjeta({ t, i }: { t: Tema; i: number }) {
  const [ref, vista] = useInView<HTMLAnchorElement>()
  const cs = cifras(t.id), Ico = ICONO[t.id] ?? TrendingUp
  return <motion.li layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97, transition: { duration: .15 } }} transition={{ delay: (i % 3) * .05, duration: .4 }}>
    <a ref={ref} id={`tarjeta-${t.id}`} href={t.ruta} className={`tarjeta ${vista ? 'is-vista' : ''}`} style={{ '--c': t.color } as CSSProperties}>
      <div className="ta-txt">
        <h3><Ico size={16} strokeWidth={2} />{t.nombre}<ArrowUpRight size={15} className="ta-flecha" /></h3>
        {cs[0] && <><b className="ta-dato"><CountUp value={cs[0].n} fmt={cs[0].f} start={vista} duration={1.1} /></b><span className="ta-et">{cs[0].l}</span></>}
        {cs[1] && <span className="ta-sec"><b>{cs[1].f(cs[1].n)}</b> · {cs[1].l}</span>}
        <small className="ta-fuente">{FUENTE[t.id] ?? 'Datos oficiales'}</small>
      </div>
      <Micro id={t.id} c={t.color} />
    </a>
  </motion.li>
}

function Fichas({ area, setArea }: { area: AreaId | null; setArea: (a: AreaId | null) => void }) {
  const chips: { id: AreaId | null; nombre: string; n: number }[] = [{ id: null, nombre: 'Todos', n: ABIERTOS.length }, ...AREAS_ABIERTAS.map(a => ({ id: a.id, nombre: a.nombre, n: ABIERTOS.filter(t => t.area === a.id).length }))]
  return <section className="fichas" id="temas" aria-labelledby="fichas-t">
    <h2 id="fichas-t" className="sr-only">Temas</h2>
    <LayoutGroup>
      <nav className="filtro" aria-label="Filtrar por área">
        {chips.map(c => <button key={c.id ?? 'todo'} onClick={() => setArea(c.id)} aria-pressed={area === c.id} className={area === c.id ? 'is-on' : ''}>
          {area === c.id && <motion.i className="filtro-pildora" layoutId="filtro-pildora" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span>{c.nombre} <small>{c.n}</small></span>
        </button>)}
      </nav>
      <AnimatePresence mode="popLayout" initial={false}>
        {AREAS_ABIERTAS.filter(a => !area || a.id === area).map(a => <motion.section key={a.id} layout className="fi-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .15 } }}>
          <header><h3 style={{ '--c': a.color } as CSSProperties}><i />{a.nombre}</h3><p>{a.lema}</p></header>
          <ul className="tarjetas">{ABIERTOS.filter(t => t.area === a.id).map((t, i) => <Tarjeta key={t.id} t={t} i={i} />)}</ul>
        </motion.section>)}
      </AnimatePresence>
    </LayoutGroup>
  </section>
}

function Pronto() {
  const [abierto, setAbierto] = useState(false)
  return <section className="pronto-caja">
    <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto}><span><i />Próximamente <small>{PLAN.length} temas en preparación</small></span><ChevronDown size={18} style={{ transform: abierto ? 'rotate(180deg)' : undefined }} /></button>
    {abierto && <ul>{PLAN.map(t => { const Ico = ICONO[t.id] ?? TrendingUp; return <li key={t.id} style={{ '--c': t.color } as CSSProperties}><b><Ico size={15} />{t.nombre}</b><span>{AREAS.find(a => a.id === t.area)?.nombre}</span><p>{t.plan ?? t.lema}</p></li> })}</ul>}
  </section>
}

export default function Portada() {
  const reduce = useReducedMotion()
  const [area, setArea] = useState<AreaId | null>(null), [ambiente, setAmbiente] = useState(0)
  // con «todas», España va tomando el color de cada área, despacio
  useEffect(() => {
    if (area || reduce) return
    const id = setTimeout(() => setAmbiente(k => (k + 1) % (AREAS_ABIERTAS.length + 1)), 4200)
    return () => clearTimeout(id)
  }, [area, ambiente, reduce])
  const color = area ? AREAS.find(a => a.id === area)!.color : ambiente === 0 ? MARCA : AREAS_ABIERTAS[ambiente - 1].color
  return (
    <>
      <Cinta />
      <main className="portada">
        <div className="barra">
          <span className="barra-fecha"><span className="bf-largo">Datos oficiales · se actualizan solos · </span>{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })}</span>
          <span className="barra-der"><a href="./acerca/index.html">Acerca de</a><Instalar /></span>
        </div>
        <header className="cabecera">
          <div className="cab-txt">
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .2 }}>España<span>en datos</span></motion.h1>
            <nav className="areas-sel" aria-label="Áreas">
              <button onClick={() => setArea(null)} aria-pressed={!area} className={!area ? 'is-on' : ''} style={{ '--c': MARCA } as CSSProperties}>Todo</button>
              {AREAS_ABIERTAS.map(a => <button key={a.id} onClick={() => setArea(area === a.id ? null : a.id)} aria-pressed={area === a.id} className={area === a.id ? 'is-on' : ''} style={{ '--c': a.color } as CSSProperties}><i />{a.nombre}</button>)}
            </nav>
            <Ficha area={area} setArea={setArea} />
          </div>
          <Hero color={color} />
        </header>
        <Fichas area={area} setArea={setArea} />
        <Pronto />
        <footer className="pie">
          <p>Fuentes oficiales, enlazadas en cada tema: <A id="boletin">MITECO</A>, <A id="siane">IGN</A>, <A id="ine_padron">INE</A>, <A id="eurostat">Eurostat</A>, <A id="ree">REE</A>, <A id="aemet">AEMET</A>, DGT, BDNS, Agencia Tributaria y Ministerio del Interior. Sin registro, sin anuncios.</p>
          <p><a className="pie-acerca" href="./acerca/index.html">Acerca de España en datos · hecho por Istari Core</a></p>
        </footer>
      </main>
    </>
  )
}
