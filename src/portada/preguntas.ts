import resumen from '../resumen.json'
import { TEMAS } from '../temas'

/**
 * Las preguntas del buscador de la portada. Cada una se contesta con el dato de src/resumen.json (lo escriben los
 * robots), así que la respuesta está siempre al día. `p` son palabras extra para encontrarla.
 */
export type Pregunta = { id: string; tema: string; q: string; r: string; nota: string; p: string }

const R = resumen as unknown as Record<string, Record<string, unknown>>
const es = (v: number, d = 1) => v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d })
const num = (t: string, k: string) => Number(R[t]?.[k] ?? NaN)
const par = (t: string, k: string) => (R[t]?.[k] as [string, number] | undefined)?.[1] ?? NaN
const per = (t: string, k: string) => String((R[t]?.[k] as [string, number] | undefined)?.[0] ?? '')
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mes = (p: string) => /^\d{4}-\d{2}$/.test(p) ? `${MES[+p.slice(5) - 1]} de ${p.slice(0, 4)}` : p.replace(/-Q(\d)/, ' (trimestre $1)').replace(/-T(\d)/, ' (trimestre $1)')
const dia = (f: string) => new Date(f.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
const mas = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${es(Math.abs(v), d)} %`

function todas(): Pregunta[] {
  const l: Pregunta[] = []
  const add = (id: string, tema: string, q: string, r: string, nota: string, p = '') => { if (!/NaN|Infinity/.test(r)) l.push({ id, tema, q, r, nota, p }) }
  const agua = (num('agua', 'a') / num('agua', 'c')) * 100
  add('agua', 'agua', '¿Cuánta agua hay en los embalses?', `${es(agua, 1)} %`, `de su capacidad, a ${dia(String(R.agua?.fecha ?? ''))}`, 'pantanos sequía reserva lluvia hm3')
  add('luz', 'energia', '¿Cuánto cuesta hoy la luz?', `${es(num('energia', 'pvpc'), 3)} €/kWh`, 'tarifa regulada (PVPC), media de hoy', 'electricidad precio kwh factura pvpc')
  add('renovable', 'energia', '¿Cuánta luz sale del sol y el viento?', `${es(num('energia', 'ren'), 0)} %`, 'de la electricidad de ayer fue renovable', 'renovables eólica solar electricidad')
  add('gasolina', 'gasolineras', '¿Cuánto cuesta la gasolina?', `${es(num('gasolineras', 'g95'), 3)} €/l`, 'gasolina 95, precio mediano de hoy', 'combustible precio litro repostar')
  add('diesel', 'gasolineras', '¿Y el diésel?', `${es(num('gasolineras', 'dsl'), 3)} €/l`, `precio mediano de hoy en ${es(num('gasolineras', 'n'), 0)} gasolineras`, 'gasóleo gasoil combustible')
  add('barata', 'gasolineras', '¿Dónde está la gasolinera más barata?', 'Cerca de ti', 'en el mapa de las gasolineras, con el precio de hoy', 'barato cerca mapa')
  add('somos', 'poblacion', '¿Cuántos somos?', `${es(num('poblacion', 'total') / 1e6, 2)} M`, `habitantes según el padrón de ${R.poblacion?.año}`, 'población habitantes gente padrón')
  add('pueblo', 'poblacion', '¿Cuántos vecinos tiene mi pueblo?', `${es(num('poblacion', 'municipios'), 0)} municipios`, 'búscalo en el mapa de población', 'municipio ciudad vecinos censo')
  add('ipc', 'economia', '¿Cuánto suben los precios?', `${es(par('economia', 'ipc'), 1)} %`, `inflación anual en ${mes(per('economia', 'ipc'))}`, 'ipc inflación precios carestía')
  add('paro', 'economia', '¿Cuánto paro hay?', `${es(par('economia', 'paro'), 1)} %`, `de la población activa, ${mes(per('economia', 'paro'))}`, 'desempleo trabajo empleo')
  add('pib', 'economia', '¿Crece la economía?', mas(par('economia', 'pib')), `el PIB en un año, ${mes(per('economia', 'pib'))}`, 'pib crecimiento economía')
  add('vivienda', 'vivienda', '¿Cuánto sube la vivienda?', mas(par('vivienda', 'ipv_a')), `el precio en un año, ${mes(per('vivienda', 'ipv_a'))}`, 'casa piso precio alquiler comprar hipoteca')
  add('compraventas', 'vivienda', '¿Cuántas casas se venden?', es(num('vivienda', 'compraventas'), 0), `compraventas en los 12 meses hasta ${mes(String(R.vivienda?.hasta ?? ''))}`, 'compraventa pisos casas vender')
  add('turistas', 'turismo', '¿Cuántos turistas vienen?', `${es(num('turismo', 'turistas') / 1e6, 1)} M`, `turistas internacionales en ${R.turismo?.año}`, 'turistas visitantes extranjeros vacaciones hoteles')
  add('delitos', 'seguridad', '¿Es segura mi provincia?', `${es(num('seguridad', 'tasa'), 1)} delitos`, `por cada 1.000 habitantes en ${R.seguridad?.año}; compárala en el mapa`, 'delitos crimen robos hurtos seguridad')
  add('hacienda', 'impuestos', '¿Cuánto recauda Hacienda?', `${es(num('impuestos', 'total12') / 1000, 1)} mil M€`, `en los 12 meses hasta ${mes(String(R.impuestos?.hasta ?? ''))} (${mas(num('impuestos', 'var'))})`, 'impuestos irpf iva recaudación hacienda')
  add('deuda', 'cuentas', '¿Cuánto debe España?', `${es((num('cuentas', 'deuda') / num('cuentas', 'pib')) * 100, 1)} % del PIB`, `deuda pública en ${R.cuentas?.año}`, 'deuda déficit estado público')
  add('ayudas', 'subvenciones', '¿Cuánto se reparte en ayudas?', `${es(num('subvenciones', 'imp') / 1e9, 1)} mil M€`, 'en subvenciones, los últimos 12 meses', 'subvenciones ayudas bdns')
  add('exporta', 'comercio', '¿Cuánto vendemos al mundo?', `${es(num('comercio', 'exp'), 0)} mil M€`, `exportaciones de ${R.comercio?.año}`, 'exportaciones importaciones comercio vender')
  add('hogar', 'hogares', '¿Cuánto gasta un hogar?', `${es(num('hogares', 'gasto'), 0)} €`, `al año de media, ${R.hogares?.año}`, 'gasto familia hogar casa cesta')
  add('electricos', 'coches', '¿Cuántos coches eléctricos se venden?', `${es(num('coches', 'enchufables'), 1)} %`, 'de los turismos nuevos son eléctricos o enchufables', 'coche eléctrico enchufable híbrido matriculaciones')
  add('brecha', 'igualdad', '¿Cuánto cobran menos las mujeres?', `${es(num('igualdad', 'brecha'), 1)} %`, `menos por hora, brecha sin ajustar de ${R.igualdad?.año}`, 'brecha salarial mujeres igualdad sueldo')
  add('co2', 'aire', '¿Cuánto CO₂ echamos?', `${es(num('aire', 'gei') / 1000, 0)} Mt`, `de gases de efecto invernadero en ${R.aire?.año}`, 'co2 emisiones contaminación clima gases')
  add('aire', 'aire', '¿Cómo está el aire ahora?', 'En directo', 'calidad del aire en cada estación, cada dos horas', 'contaminación calidad aire respirar')
  return l.filter(x => TEMAS.some(t => t.id === x.tema && t.ruta))
}
export const PREGUNTAS = todas()
/** Las que salen sin escribir nada: lo más útil del día. */
export const POPULARES = ['luz', 'gasolina', 'agua', 'ipc', 'vivienda', 'turistas']

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
/** Busca por palabras (también a medio escribir) en la pregunta, sus palabras clave y el nombre del tema. */
export function buscar(texto: string): Pregunta[] {
  const ts = norm(texto).split(' ').filter(w => w.length > 1)
  if (!ts.length) return POPULARES.map(id => PREGUNTAS.find(p => p.id === id)).filter((p): p is Pregunta => !!p)
  return PREGUNTAS.map(p => {
    const nombre = TEMAS.find(t => t.id === p.tema)?.nombre ?? ''
    const ws = norm(`${p.q} ${p.p} ${nombre}`).split(' ')
    const s = ts.reduce((a, t) => a + (ws.some(w => w === t) ? 2 : ws.some(w => w.startsWith(t) || (t.length > 4 && w.startsWith(t.slice(0, -1)))) ? 1 : 0), 0)
    return { p, s }
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.p)
}
