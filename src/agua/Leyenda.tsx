import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, CircleHelp, House, Network, Recycle, X } from 'lucide-react'
import type { Layer } from './Board'
import { consumo, data, energyTotals, fmt, fmtPct, landColor } from './data'
import { aggList, c1Color, edarList, useEdar } from './edar'
import { degradado, isUrb, metrica, metrosPorHab, orden, type Urb } from './ciudad'

/**
 * La leyenda de cada capa: una frase con lo más importante (calculada con el dato), la escala de colores
 * o de símbolos, y un «¿Qué estoy viendo?» para quien llega sin saber de agua.
 */
type Contenido = { t: string; sub: ReactNode; escala: ReactNode; ayuda: string; mas?: string }

const n = data.meta.national
const pctNac = (n.a / n.c) * 100
const conCentral = data.reservoirs.filter(r => r.ec > 0).length
const lluviaMax = [...data.rain].sort((a, b) => b.p - a.p)[0]
const secos = data.rain.filter(g => g.p === 0).length
const suben = data.flows.filter(f => f.qa != null && f.q > f.qa * 1.05).length
const bajan = data.flows.filter(f => f.qa != null && f.q < f.qa * 0.95).length
const vertTotal = data.dischargers.reduce((s, d) => s + d.v, 0)
const vertInd = data.dischargers.filter(d => d.t !== 'URBANO').reduce((s, d) => s + d.v, 0)

function Gradiente({ fondo, bajo, alto }: { fondo: string; bajo: string; alto: string }) {
  return <div className="ley-grad"><i style={{ background: fondo }} /><span>{bajo}</span><span>{alto}</span></div>
}
function Claves({ items }: { items: [ReactNode, string][] }) {
  return <ul className="ley-claves">{items.map(([icono, txt]) => <li key={txt}>{icono}{txt}</li>)}</ul>
}
const sw = (c: string, forma: 'c' | 'q' | 'h' = 'q', extra = '') => <svg className="ley-sw" viewBox="-7 -7 14 14" aria-hidden>
  {forma === 'c' ? <circle r={5} style={{ fill: c + '33', stroke: c }} className={extra} /> : forma === 'h' ? <polygon points="5,0 2.5,4.3 -2.5,4.3 -5,0 -2.5,-4.3 2.5,-4.3" style={{ fill: c + '40', stroke: c }} /> : <rect x={-5} y={-5} width={10} height={10} rx={1.5} style={{ fill: c }} />}
</svg>
const gradTierra = `linear-gradient(90deg, ${[25, 40, 55, 70, 88].map(landColor).join(', ')})`

function contenido(layer: Layer, cerca: boolean, edar: boolean): Contenido {
  if (layer === 'agua') return {
    t: `Embalses al ${fmtPct(pctNac)}`,
    sub: <>{n.d >= 0 ? 'Suben' : 'Bajan'} <b>{fmt(Math.abs(n.d))} hm³</b> esta semana; {n.a >= n.avg10 ? 'por encima' : 'por debajo'} de la media de diez años.</>,
    escala: <Gradiente fondo={gradTierra} bajo="cuenca seca" alto="llena" />,
    ayuda: 'Cada círculo es un embalse de más de 5 hm³ y su arco marca lo lleno que está. El fondo es el llenado de su cuenca. Toca un embalse para verlo en holograma.',
  }
  if (layer === 'energia') return {
    t: `Energía embalsada al ${fmtPct((energyTotals.e / energyTotals.ec) * 100)}`,
    sub: <><b>{fmt(energyTotals.e)} GWh</b> guardados en {conCentral} embalses con central hidroeléctrica.</>,
    escala: <Gradiente fondo={gradTierra} bajo="vacíos" alto="llenos" />,
    ayuda: 'El agua de un embalse con central puede convertirse en electricidad al bajar por las turbinas. Aquí se mide cuánta podrían dar con lo que guardan ahora.',
  }
  if (layer === 'lluvia') return {
    t: `Hasta ${fmt(lluviaMax.p)} l/m² en ${lluviaMax.n}`,
    sub: secos ? <>En <b>{secos}</b> de {data.rain.length} observatorios no cayó nada esta semana.</> : <>Ha llovido en los {data.rain.length} observatorios esta semana.</>,
    escala: <Claves items={[[<svg key="c" className="ley-sw" viewBox="-7 -14 14 16" aria-hidden><rect x={-1.6} y={-12} width={3.2} height={12} rx={1.6} fill="#bfe6ff" /><circle cy={-12} r={2.4} fill="#fff" /></svg>, 'altura: litros por m² en la semana']]} />,
    ayuda: 'Lluvia de la última semana en los observatorios principales de AEMET. 1 l/m² es un litro de agua sobre cada metro cuadrado de suelo.',
  }
  if (layer === 'rios') return {
    t: `${suben} estaciones suben y ${bajan} bajan`,
    sub: <>Caudal medio de la semana en {data.flows.length} estaciones de aforo, frente a la anterior.</>,
    escala: <Claves items={[[sw('#5aa8ff', 'q'), 'tamaño: caudal'], [<span key="u" className="ley-fl up">▲</span>, 'sube'], [<span key="d" className="ley-fl down">▼</span>, 'baja']]} />,
    ayuda: 'Cuánta agua pasa por segundo, de media en la semana, por cada estación de aforo. Toca un río para verlo en holograma con su perfil.',
  }
  if (layer === 'vertidos') return {
    t: `${fmt(vertTotal)} hm³ al año autorizados`,
    sub: <>En los {data.dischargers.length} mayores puntos de vertido; la industria suma el <b>{fmt((vertInd / vertTotal) * 100)} %</b>.</>,
    escala: <Claves items={[[sw('#ff9f6e', 'h'), 'ciudad'], [sw('#ff4fd8', 'h'), 'industria'], [<span key="t" className="ley-txt">tamaño: volumen</span>, '']]} />,
    ayuda: 'Puntos con permiso para devolver agua usada a un río o al mar, con el volumen máximo autorizado al año. No es lo que consumen.',
  }
  const l = layer as Urb, m = metrica(l), o = orden(l), top = o[0], bot = o[o.length - 1], N = consumo.national
  const grad = <Gradiente fondo={degradado(l)} bajo={`${m.num(bot.v)} ${m.bajo}`} alto={`${m.num(top.v)} ${m.alto}`} />
  if (layer === 'consumo') return {
    t: `${N.l} litros por persona y día`,
    sub: <>Lo que se gasta en casa: de {bot.v} en {bot.u.n} a <b>{top.v}</b> en {top.u.n}.</>,
    escala: grad,
    ayuda: `Agua que se gasta en casa por persona y día (INE, ${consumo.year}). Antes de llegar al grifo, parte se pierde por fugas: lo verás en la ficha de cada comunidad.`,
  }
  if (layer === 'alcantarillado') {
    const vN = metrosPorHab(N)
    const ags = edar ? aggList() ?? [] : [], noTodo = ags.filter(a => a.c1 != null && a.c1 < 99.5).length
    const ayuda = 'Las cloacas recogen el agua usada de casas, comercios e industrias y la llevan a la depuradora. Donde la gente vive más repartida hay más metros de tubo por vecino que mantener.'
    if (cerca && ags.length) return {
      t: `${fmt(ags.length)} núcleos urbanos`,
      sub: <>En <b>{noTodo}</b> las cloacas no recogen toda el agua usada; el resto va a fosas sépticas o se queda sin recoger.</>,
      escala: <Claves items={[[sw(c1Color(100)), 'todo'], [sw(c1Color(95)), '90-99 %'], [sw(c1Color(80)), '70-90 %'], [sw(c1Color(50)), 'menos']]} />,
      ayuda: ayuda + ' Cada cuadrado es un núcleo; su tamaño, lo que contamina.',
    }
    return {
      t: `${fmt(N.sewerKm ?? 0)} km de alcantarillado`,
      sub: <>{vN != null ? <><b>{fmt(vN, 1)} m</b> por habitante: </> : null}de {fmt(bot.v, 1)} en {bot.u.n} a {fmt(top.v, 1)} en {top.u.n}.</>,
      escala: grad, ayuda, mas: 'Acércate o toca una comunidad para ver sus núcleos urbanos.',
    }
  }
  const ed = edar ? edarList() ?? [] : []
  const ayuda = 'Las depuradoras (EDAR) limpian el agua usada antes de devolverla al río o al mar. Una parte se puede reutilizar para regar o baldear calles en vez de gastar agua nueva.'
  if (cerca && ed.length) {
    const no = ed.filter(p => p.ok === 0).length, llenas = ed.filter(p => p.cap && p.load && p.load > p.cap).length
    return {
      t: `${fmt(ed.length)} depuradoras`,
      sub: <><b>{no}</b> no cumplen los límites de vertido de la UE y {llenas} reciben más carga de la que están hechas para tratar.</>,
      escala: <Claves items={[[sw('#3df5b0', 'c'), 'más riguroso'], [sw('#3fe6ff', 'c'), 'biológico'], [sw('#ffb02e', 'c'), 'primario'], [sw('#ff4d5e', 'c', 'ley-no'), 'no cumple']]} />,
      ayuda: ayuda + ' Cada círculo es una depuradora; su tamaño, cuánta gente puede atender.',
    }
  }
  const bajos = o.filter(x => x.v < 1).length
  return {
    t: `Se reutiliza el ${fmt(N.reusePct ?? 0, 1)} % del agua depurada`,
    sub: <>{top.u.n} llega al <b>{m.num(top.v)}</b>; {bajos ? <>{bajos} comunidades no pasan del 1 %.</> : <>{bot.u.n} se queda en el {m.num(bot.v)}.</>}</>,
    escala: grad, ayuda, mas: 'Acércate o toca una comunidad para ver sus depuradoras.',
  }
}

const PASOS: { id: Urb; label: string; icon: typeof House }[] = [
  { id: 'consumo', label: 'Grifo', icon: House },
  { id: 'alcantarillado', label: 'Cloacas', icon: Network },
  { id: 'depuracion', label: 'Depuradora', icon: Recycle },
]

/**
 * `completa` (móvil): frase, escala y ayuda sobre la barra, porque la consola está plegada.
 * `clave` (escritorio): solo la escala y la ayuda, arriba de la consola, que ya lleva la frase en su primera tarjeta.
 */
export function Leyenda({ layer, cerca, onLayer, modo }: { layer: Layer; cerca: boolean; onLayer: (l: Layer) => void; modo: 'completa' | 'clave' }) {
  const edar = !!useEdar()
  const reduce = useReducedMotion()
  const [ayuda, setAyuda] = useState(false)
  const c = contenido(layer, cerca && isUrb(layer), edar)
  return (
    <section className={`leyenda ley-${layer} is-${modo}`} aria-live="polite" aria-label="Leyenda del mapa">
      {isUrb(layer) && <div className="pasos" role="group" aria-label="El agua en la ciudad, paso a paso">
        {PASOS.map((p, j) => {
          const Icon = p.icon
          return <span key={p.id} className="paso-w">
            {j > 0 && <ChevronRight size={14} className="paso-flecha" aria-hidden />}
            <button className={`paso paso-${p.id} ${layer === p.id ? 'is-on' : ''}`} onClick={() => onLayer(p.id)} aria-pressed={layer === p.id}><Icon size={15} aria-hidden />{p.label}</button>
          </span>
        })}
      </div>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={layer + (cerca ? 'c' : '')} className="ley-in" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.22 }}>
          <div className="ley-top">
            {modo === 'completa' ? <h2>{c.t}</h2> : <span className="ley-cab">{cerca && isUrb(layer) ? c.t : 'Cómo leer el mapa'}</span>}
            <button className={`ley-q ${ayuda ? 'is-on' : ''}`} onClick={() => setAyuda(a => !a)} aria-expanded={ayuda} aria-label={ayuda ? 'Cerrar explicación' : '¿Qué estoy viendo?'}>
              {ayuda ? <X size={15} /> : <CircleHelp size={16} />}<span>¿Qué es esto?</span>
            </button>
          </div>
          {(modo === 'completa' || (cerca && isUrb(layer))) && <p className="ley-sub">{c.sub}</p>}
          {c.escala}
          <AnimatePresence initial={false}>
            {ayuda && <motion.div className="ley-ayuda" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}>
              <p>{c.ayuda}</p>{c.mas && <p className="ley-mas">{c.mas}</p>}
            </motion.div>}
          </AnimatePresence>
          {!ayuda && c.mas && modo === 'clave' && <p className="ley-mas">{c.mas}</p>}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
