import F from './fuentes.json'

export type FuenteId = keyof typeof F
/** Enlace a la tabla de Eurostat de un conjunto de datos. */
export const eurostatUrl = (code: string) => `https://ec.europa.eu/eurostat/databrowser/view/${code}/default/table?lang=es`
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const

/** «Fuentes: A · B · C», con enlace a cada origen. */
export function Fuentes({ ids, extra, pre = 'Fuentes', className = 'src' }: { ids: FuenteId[]; extra?: { n: string; u: string }[]; pre?: string; className?: string }) {
  const items = [...ids.map(i => F[i]), ...(extra ?? [])]
  return <p className={`${className} fuentes`}>{pre}: {items.map((x, i) => <span key={x.u}>{i > 0 && ' · '}<a href={x.u} {...ext}>{x.n}</a></span>)}</p>
}
/** Un enlace suelto, para meterlo dentro de una frase. */
export function A({ id, children }: { id: FuenteId; children?: React.ReactNode }) {
  return <a href={F[id].u} {...ext}>{children ?? F[id].n}</a>
}
