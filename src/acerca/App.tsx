import type { CSSProperties } from 'react'
import { AREAS, TEMAS } from '../temas'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const CORREO = 'istaricore@gmail.com'
/** Organismos de los que salen los datos (cada gráfico enlaza además a su tabla concreta). */
const ORGANISMOS = [
  { n: 'Instituto Nacional de Estadística (INE)', u: 'https://www.ine.es' },
  { n: 'Eurostat', u: 'https://ec.europa.eu/eurostat' },
  { n: 'Ministerio para la Transición Ecológica (MITECO)', u: 'https://www.miteco.gob.es' },
  { n: 'Instituto Geográfico Nacional (IGN)', u: 'https://www.ign.es' },
  { n: 'Agencia Estatal de Meteorología (AEMET)', u: 'https://www.aemet.es' },
  { n: 'Red Eléctrica (REE)', u: 'https://www.ree.es' },
  { n: 'Ministerio del Interior', u: 'https://www.interior.gob.es' },
  { n: 'Dirección General de Tráfico (DGT)', u: 'https://www.dgt.es' },
  { n: 'Agencia Tributaria', u: 'https://sede.agenciatributaria.gob.es' },
  { n: 'Base de Datos Nacional de Subvenciones', u: 'https://www.infosubvenciones.es' },
  { n: 'Agencia Europea de Medio Ambiente', u: 'https://www.eea.europa.eu' },
  { n: 'Delegación del Gobierno contra la Violencia de Género', u: 'https://violenciagenero.igualdad.gob.es' },
]

export default function App() {
  const abiertos = TEMAS.filter(t => t.ruta)
  return (
    <main className="acerca">
      <header className="ac-cab">
        <a className="home-link" href="../index.html">España en datos</a>
        <h1>Acerca de</h1>
        <p className="ac-lema">España contada con sus datos oficiales: {abiertos.length} temas que se actualizan solos, cada uno con la forma que mejor cuenta su dato.</p>
      </header>

      <section className="ac-bloque">
        <h2>Qué es</h2>
        <p>Una web pública y gratuita que reúne datos de España que suelen estar repartidos en decenas de webs, tablas y PDF: cuánta agua hay en los embalses, de dónde sale la luz de esta hora, cuántos somos en cada pueblo, quién nos visita, cuánto se recauda o dónde está la gasolina más barata.</p>
        <p>No todo es un mapa: hay consolas con gráficos, pirámides, carreras de barras, relojes y hologramas. Cada tema tiene su color y se puede recorrer en el móvil o en el ordenador.</p>
        <ul className="ac-temas" aria-label="Temas abiertos">
          {AREAS.map(a => {
            const ts = abiertos.filter(t => t.area === a.id); if (!ts.length) return null
            return <li key={a.id}><span className="ac-area">{a.nombre}</span>
              <span className="ac-chips">{ts.map(t => <a key={t.id} href={`.${t.ruta}`} style={{ '--c': t.color } as CSSProperties}><i />{t.nombre}</a>)}</span></li>
          })}
        </ul>
      </section>

      <section className="ac-bloque">
        <h2>De dónde salen los datos</h2>
        <p>Solo de fuentes oficiales y de acceso libre. Cada gráfico enlaza a la tabla exacta de la que sale, para que cualquiera pueda comprobarlo. Los principales organismos:</p>
        <ul className="ac-org">{ORGANISMOS.map(o => <li key={o.n}><a href={o.u} {...ext}>{o.n}</a></li>)}</ul>
      </section>

      <section className="ac-bloque">
        <h2>Cómo se actualiza</h2>
        <p>Nadie copia cifras a mano. Unos programas descargan cada fuente según publica: la calidad del aire cada dos horas; la electricidad, las gasolineras y las subvenciones cada día; la mayoría de estadísticas, cada semana. Si una fuente falla, la web sigue mostrando el último dato bueno.</p>
        <p>Las frases de los paneles también se calculan con el dato: si algo sube o baja, el texto cambia solo.</p>
      </section>

      <section className="ac-bloque">
        <h2>Cómo leerlos</h2>
        <ul className="ac-lista">
          <li>Cada cifra lleva su fecha. Algunas estadísticas salen con meses o años de retraso: se enseña siempre la más reciente.</li>
          <li>Cuando un dato tiene letra pequeña, se dice junto al gráfico. Por ejemplo, la brecha salarial es «sin ajustar», los vertidos son volumen autorizado (no consumo) y las estadísticas experimentales van marcadas.</li>
          <li>Los euros son corrientes, sin descontar la subida de precios, salvo que se diga lo contrario.</li>
          <li>Esta web no es de ningún organismo público. Si ves un dato raro, puede ser un error nuestro: avísanos.</li>
        </ul>
      </section>

      <section className="ac-bloque">
        <h2>Privacidad</h2>
        <p>Sin registro, sin anuncios y sin analítica: no sabemos quién entra ni qué mira. Para dibujar las letras y algunos mapas se cargan recursos de terceros (tipografías de Google Fonts y mapas de Esri y OpenStreetMap), que, como cualquier web, reciben tu dirección IP al servirlos.</p>
      </section>

      <section className="ac-bloque ac-istari">
        <h2>Quién la hace</h2>
        <p><b>España en datos</b> es un proyecto personal de <b>Istari Core</b>, el pequeño estudio donde también nacen Listopic y otras apps. La hacemos por curiosidad y para que los datos públicos se entiendan de un vistazo.</p>
        <div className="ac-enlaces">
          <a href="https://listopic.es/istari-core" {...ext}><b>Istari Core</b><span>Quiénes somos y otros proyectos</span></a>
          <a href="https://listopic.es" {...ext}><b>Listopic</b><span>Listas y opiniones de sitios para comer y visitar</span></a>
          <a href={`mailto:${CORREO}?subject=Espa%C3%B1a%20en%20datos`}><b>Contacto</b><span>{CORREO}</span></a>
          <a href="https://github.com/Sermase/Espana-en-datos" {...ext}><b>Código abierto</b><span>El código y los programas que descargan los datos, en GitHub</span></a>
        </div>
      </section>

      <p className="ac-pie"><a href="../index.html">‹ Volver a la portada</a></p>
    </main>
  )
}
