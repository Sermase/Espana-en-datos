/**
 * Los temas de España en datos. Cada uno tiene su color de acento y su vista principal:
 * no todos son mapas, cada dato se enseña en la forma que mejor le va.
 */
export type Tema = {
  id: string
  nombre: string
  lema: string
  /** color de acento del tema, usado en su página y en la portada */
  color: string
  vista: 'mapa' | 'consola' | 'pirámide' | 'relieve'
  /** carpeta de la página, si ya está abierta */
  ruta?: string
}

export const TEMAS: Tema[] = [
  { id: 'agua', nombre: 'Agua', lema: 'Embalses, ríos, lluvia y energía hidroeléctrica, semana a semana.', color: '#3fe6ff', vista: 'mapa', ruta: './agua/index.html' },
  { id: 'gasolineras', nombre: 'Gasolineras', lema: 'El precio de hoy en las 12.000 gasolineras: la más barata cerca de ti, por provincia y por marca.', color: '#ff5f7e', vista: 'mapa', ruta: './gasolineras/index.html' },
  { id: 'trenes', nombre: 'Trenes', lema: 'Todos los trenes de Renfe moviéndose por el mapa, con sus horarios y retrasos.', color: '#8fb4ff', vista: 'mapa' },
  { id: 'energia', nombre: 'Energía', lema: 'De dónde sale la electricidad que gastamos, cuánto cuesta cada hora y cuánto CO₂ emite. En directo.', color: '#ffb02e', vista: 'consola', ruta: './energia/index.html' },
  { id: 'economia', nombre: 'Economía', lema: 'PIB, precios, empleo, salarios, vivienda, cuentas públicas y hogares, comparados con Europa.', color: '#3df5b0', vista: 'consola', ruta: './economia/index.html' },
  { id: 'comercio', nombre: 'Comercio', lema: 'Lo que España vende y compra al mundo: países, productos y rutas, con diez años de historia.', color: '#c6f25e', vista: 'mapa', ruta: './comercio/index.html' },
  { id: 'poblacion', nombre: 'Población', lema: 'Los 8.000 municipios en un mapa, y gráficos e históricos desde 1971: cuántos somos, dónde vivimos y cómo envejecemos.', color: '#c49bff', vista: 'pirámide', ruta: './poblacion/index.html' },
  { id: 'carreteras', nombre: 'Carreteras', lema: 'Tráfico, accidentes y obras en la red de carreteras.', color: '#ff8a5c', vista: 'mapa' },
  { id: 'montana', nombre: 'Montaña y nieve', lema: 'Cumbres, espesor de nieve y temporada de esquí.', color: '#d6ecff', vista: 'relieve' },
]
