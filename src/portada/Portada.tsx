import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Building2, Car, Droplets, Factory, Fuel, GraduationCap, HandCoins, HeartPulse, House, Landmark, Luggage, Mountain, Plane, PiggyBank, Receipt, Route, Scale, ScrollText, ShieldCheck, Ship, ShoppingBasket, Thermometer, TrainFront, TrendingUp, Trophy, Users, Clapperboard, Wheat, Wind, Zap, type LucideIcon } from 'lucide-react'
import resumen from '../resumen.json'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CountUp } from '../graficos/CountUp'
import { AREAS, TEMAS, type Tema } from '../temas'
import { A } from '../Fuentes'
import { Hero } from './Hero'
import { Instalar } from './Instalar'

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
const PLAN = TEMAS.filter(t => !t.ruta)

/** Cinta tipo canal de bolsa: el dato principal de cada tema y, si lo hay, cuánto cambia. */
const CAMBIO: Record<string, [number, string] | undefined> = {
  impuestos: R.impuestos ? [Number(R.impuestos.var), 'en un año'] : undefined,
  seguridad: R.seguridad ? [Number(R.seguridad.var), 'en un año'] : undefined,
  aire: R.aire ? [Number(R.aire.vs1990), 'desde 1990'] : undefined,
}
const CINTA = [
  ...ABIERTOS.flatMap(t => { const c = cifras(t.id)[0]; return c ? [{ id: t.id, n: t.nombre, v: c.f(c.n), l: c.l, cambio: CAMBIO[t.id] }] : [] }),
  ...(R.gasolineras ? [{ id: 'gasolineras', n: 'Diésel', v: `${es(Number(R.gasolineras.dsl), 3)} €`, l: 'litro, mediana de hoy', cambio: undefined }] : []),
  ...(R.energia ? [{ id: 'energia', n: 'Luz', v: `${es(Number(R.energia.pvpc), 3)} €`, l: 'kWh hoy, tarifa regulada', cambio: undefined }] : []),
]
function Cinta() {
  const items = (oculto: boolean) => CINTA.map((c, k) => { const t = TEMAS.find(x => x.id === c.id)!; return <a key={k} href={t.ruta} tabIndex={oculto ? -1 : undefined} style={{ '--c': t.color } as CSSProperties}>
    <span className="ci-n">{c.n}</span><b>{c.v}</b>
    {c.cambio && Number.isFinite(c.cambio[0]) && <em className={c.cambio[0] >= 0 ? 'sube' : 'baja'}>{c.cambio[0] >= 0 ? '▲' : '▼'} {es(Math.abs(c.cambio[0]), 1)} %</em>}
    <small>{c.l}</small>
  </a> })
  return <div className="cinta" aria-label="Datos de hoy de cada tema">
    <div className="cinta-pista"><span>{items(false)}</span><span aria-hidden>{items(true)}</span></div>
  </div>
}

/** La hora de España, en vivo. */
function Reloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 15000); return () => clearInterval(t) }, [])
  const f = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })
  const h = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
  return <span className="reloj-vivo"><i className="vivo" />En directo <span>· {f} · {h}</span></span>
}

/** El tema elegido: su nombre, para qué sirve, sus cifras de hoy y la puerta para entrar. */
function Panel({ t }: { t: Tema }) {
  const Ico = ICONO[t.id] ?? TrendingUp, cs = cifras(t.id).slice(0, 2)
  return <div className="panel" style={{ '--c': t.color } as CSSProperties} aria-live="polite">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .28 }}>
        <span className="pa-area">{AREAS.find(a => a.id === t.area)?.nombre}</span>
        <h2><Ico size={26} strokeWidth={1.8} />{t.nombre}</h2>
        <p>{t.lema}</p>
        {cs.length > 0 && <dl>{cs.map((c, k) => <div key={c.l}><dd><CountUp value={c.n} fmt={c.f} delay={k * .08} duration={.9} /></dd><dt>{c.l}</dt></div>)}</dl>}
        <div className="pa-pie"><a className="pa-entrar" href={t.ruta}>Entrar en {t.nombre}<ArrowRight size={18} /></a><small><i className="vivo" /> {FUENTE[t.id] ?? 'Datos oficiales'}</small></div>
      </motion.div>
    </AnimatePresence>
  </div>
}

export default function Portada() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0), [quieto, setQuieto] = useState(0)
  const conRaton = useRef(typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches)
  const tira = useRef<HTMLDivElement>(null)
  const t = ABIERTOS[i]
  // España va cambiando de tema sola; en cuanto alguien elige, se para un rato
  useEffect(() => {
    if (reduce) return
    const espera = Math.max(4500, quieto - Date.now())
    const id = setTimeout(() => setI(k => (k + 1) % ABIERTOS.length), espera)
    return () => clearTimeout(id)
  }, [i, quieto, reduce])
  // en el móvil, la tira de temas acompaña al tema activo
  useEffect(() => {
    const nav = tira.current, el = nav?.querySelector<HTMLElement>('.is-on')
    if (nav && el && nav.scrollWidth > nav.clientWidth) { const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect(); nav.scrollTo({ left: nav.scrollLeft + r.left - n.left - n.width / 2 + r.width / 2, behavior: reduce ? 'auto' : 'smooth' }) }
  }, [i, reduce])
  const elige = (k: number) => { setI(k); setQuieto(Date.now() + 20000) }
  return (
    <main className="portada">
      <div className="barra">
        <Reloj />
        <span className="barra-der"><a href="./acerca/index.html">Acerca de</a><Instalar /></span>
      </div>
      <header className="cabecera">
        <div className="cab-txt">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .2 }}>España<span>en datos</span></motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: .8 }}>El país como un cuadro de mando: datos oficiales que se actualizan solos. Elige un tema.</motion.p>
          <Panel t={t} />
        </div>
        <Hero color={t.color} />
      <nav className="selector" aria-label="Temas" ref={tira}>
        {AREAS.map(a => { const ts = ABIERTOS.filter(x => x.area === a.id); if (!ts.length) return null
          return <div key={a.id} className="sel-area"><span>{a.nombre}</span>
            {ts.map(x => { const k = ABIERTOS.indexOf(x), Ico = ICONO[x.id] ?? TrendingUp, on = k === i
              return <a key={x.id} href={x.ruta} className={on ? 'is-on' : ''} style={{ '--c': x.color } as CSSProperties} aria-current={on ? 'true' : undefined}
                onPointerEnter={e => { if (e.pointerType === 'mouse') elige(k) }} onFocus={() => elige(k)}
                onClick={e => { if (!conRaton.current && !on) { e.preventDefault(); elige(k) } }}>
                {on && <motion.i className="sel-pildora" layoutId="sel-pildora" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Ico size={17} strokeWidth={1.9} /><span>{x.nombre}</span>
              </a> })}
          </div> })}
      </nav>
      <p className="sel-pista">{conRaton.current ? 'Pasa el ratón por un tema para verlo y haz clic para entrar.' : 'Toca un tema para verlo; tócalo otra vez, o «Entrar», para abrirlo.'}</p>
      </header>
      <Cinta />
      <footer className="pie">
        {PLAN.length > 0 && <p className="pronto"><span>Próximamente</span>{PLAN.map(x => { const Ico = ICONO[x.id] ?? TrendingUp; return <i key={x.id} title={x.plan ?? x.lema} style={{ '--c': x.color } as CSSProperties}><Ico size={14} />{x.nombre}</i> })}</p>}
        <p>Fuentes oficiales, enlazadas en cada tema: <A id="boletin">MITECO</A>, <A id="siane">IGN</A>, <A id="ine_padron">INE</A>, <A id="eurostat">Eurostat</A>, <A id="ree">REE</A>, <A id="aemet">AEMET</A>. Sin registro, sin anuncios. <a className="pie-acerca" href="./acerca/index.html">Acerca de España en datos · hecho por Istari Core</a></p>
      </footer>
    </main>
  )
}
