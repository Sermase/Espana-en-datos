/**
 * Los temas de España en datos, agrupados en cinco grandes áreas. Cada tema tiene su color de acento y su vista
 * principal: no todos son mapas, cada dato se enseña en la forma que mejor le va. Un tema vive en un área,
 * aunque se enlace desde otras (el agua, por ejemplo, también cruza con Energía).
 */
export type AreaId = 'gente' | 'economia' | 'publico' | 'territorio' | 'movilidad' | 'ocio'
export type Tema = {
  id: string
  nombre: string
  lema: string
  /** color de acento del tema, usado en su página y en la portada */
  color: string
  vista: 'mapa' | 'consola' | 'pirámide' | 'relieve'
  area: AreaId
  /** carpeta de la página, si ya está abierta */
  ruta?: string
  /** lo que tendrá cuando se abra (para los temas en preparación) */
  plan?: string
}

export const AREAS: { id: AreaId; nombre: string; lema: string }[] = [
  { id: 'gente', nombre: 'Gente', lema: 'Cuántos somos, cómo vivimos, de qué enfermamos y qué estudiamos.' },
  { id: 'economia', nombre: 'Economía', lema: 'Lo que ganamos, lo que cuesta vivir, lo que reparte lo público y lo que vendemos al mundo.' },
  { id: 'publico', nombre: 'Sector público', lema: 'Lo que ingresan y gastan las administraciones, en qué, y a quién ayudan.' },
  { id: 'territorio', nombre: 'Territorio', lema: 'El agua, el clima, las montañas y el campo.' },
  { id: 'movilidad', nombre: 'Energía y movilidad', lema: 'La luz, el combustible y cómo nos movemos.' },
  { id: 'ocio', nombre: 'Cultura y ocio', lema: 'Cine, museos, libros y deporte.' },
]

export const TEMAS: Tema[] = [
  // Gente
  { id: 'poblacion', area: 'gente', nombre: 'Población', lema: 'Los 8.000 municipios en un mapa, y gráficos e históricos desde 1971: cuántos somos, dónde vivimos y cómo envejecemos.', color: '#c49bff', vista: 'pirámide', ruta: './poblacion/index.html' },
  { id: 'sociedad', area: 'gente', nombre: 'Sociedad', lema: 'Hogares, familias, desigualdad y cómo usamos el tiempo.', color: '#ff9ecf', vista: 'consola', plan: 'Tamaño de los hogares, personas que viven solas, renta por hogar y desigualdad por provincia.' },
  { id: 'sanidad', area: 'gente', nombre: 'Sanidad', lema: 'Esperanza de vida, listas de espera y recursos de cada comunidad.', color: '#ff7b7b', vista: 'mapa', plan: 'Esperanza de vida por provincia, listas de espera por comunidad, médicos y camas por habitante.' },
  { id: 'educacion', area: 'gente', nombre: 'Educación', lema: 'Del colegio a la universidad: alumnos, abandono y titulados.', color: '#7cc8ff', vista: 'consola', plan: 'Abandono escolar, titulados universitarios, alumnos por profesor y comparación con Europa.' },
  // Dinero
  { id: 'economia', area: 'economia', nombre: 'Macroeconomía', lema: 'PIB, precios, empleo, salarios, vivienda, cuentas públicas y hogares, comparados con Europa.', color: '#3df5b0', vista: 'consola', ruta: './economia/index.html' },
  { id: 'vivienda', area: 'economia', nombre: 'Vivienda', lema: 'Cuánto sube la vivienda, dónde se vende, cuánto se hipoteca y cuánto sube el alquiler en tu municipio.', color: '#ffd166', vista: 'mapa', ruta: './vivienda/index.html' },
  { id: 'comercio', area: 'economia', nombre: 'Comercio', lema: 'Lo que España vende y compra al mundo: países, productos y rutas, con diez años de historia.', color: '#c6f25e', vista: 'mapa', ruta: './comercio/index.html' },
  { id: 'turismo', area: 'economia', nombre: 'Turismo', lema: 'Quién nos visita, cuánto gasta y a dónde va.', color: '#ff9f43', vista: 'mapa', plan: 'Turistas por país de origen, gasto, pernoctaciones por provincia y destinos de moda.' },
  { id: 'industria', area: 'economia', nombre: 'Industria', lema: 'Empresas, sectores y lo que fabricamos.', color: '#9fb3c8', vista: 'consola', plan: 'Producción industrial, empresas por sector y tamaño, y exportación de coches.' },
  // Sector público
  { id: 'cuentas', area: 'publico', nombre: 'Cuentas públicas', lema: 'Ingresos, gastos, déficit y deuda del Estado, las comunidades, los ayuntamientos y la Seguridad Social.', color: '#7fd4c8', vista: 'consola', ruta: './cuentas/index.html' },
  { id: 'impuestos', area: 'publico', nombre: 'Impuestos', lema: 'Cuánto se recauda, de qué impuestos y cómo cambia cada mes.', color: '#f2b880', vista: 'consola', ruta: './impuestos/index.html' },
  { id: 'presupuestos', area: 'publico', nombre: 'Presupuestos', lema: 'Los presupuestos de tu comunidad y de tu ayuntamiento, euro a euro.', color: '#9fc5ff', vista: 'mapa', plan: 'Presupuestos y liquidaciones de los 8.000 ayuntamientos y las comunidades: gasto por habitante y en qué se va.' },
  { id: 'subvenciones', area: 'publico', nombre: 'Subvenciones', lema: 'Quién da ayudas públicas, a quién y para qué: Estado, comunidades y ayuntamientos.', color: '#e0a8ff', vista: 'consola', ruta: './subvenciones/index.html' },
  { id: 'contratos', area: 'publico', nombre: 'Contratos públicos', lema: 'Qué compra la administración, a quién y por cuánto.', color: '#c8b6ff', vista: 'consola', plan: 'Licitaciones y adjudicaciones de la Plataforma de Contratación del Sector Público: por órgano, sector e importe.' },
  // Territorio
  { id: 'agua', area: 'territorio', nombre: 'Agua', lema: 'Embalses, ríos, lluvia, consumo y energía hidroeléctrica, semana a semana.', color: '#3fe6ff', vista: 'mapa', ruta: './agua/index.html' },
  { id: 'clima', area: 'territorio', nombre: 'Clima', lema: 'Temperaturas, olas de calor y lluvia, y cómo están cambiando.', color: '#ff7a59', vista: 'mapa', plan: 'Temperatura de cada observatorio desde hace décadas, olas de calor, noches tropicales y sequía.' },
  { id: 'montana', area: 'territorio', nombre: 'Montaña y nieve', lema: 'Cumbres, espesor de nieve y temporada de esquí.', color: '#d6ecff', vista: 'relieve', plan: 'Relieve en 3D, nieve acumulada, estaciones de esquí abiertas y las cumbres más altas.' },
  { id: 'agricultura', area: 'territorio', nombre: 'Campo', lema: 'Agricultura, ganadería y lo que sale de cada tierra.', color: '#8fd16a', vista: 'mapa', plan: 'Cultivos por provincia, aceite de oliva, vino, ganadería y precios en origen.' },
  // Energía y movilidad
  { id: 'energia', area: 'movilidad', nombre: 'Energía', lema: 'De dónde sale la electricidad, cuánto cuesta cada hora, de dónde viene el gas y cuánto CO₂ emite. En directo.', color: '#ffb02e', vista: 'consola', ruta: './energia/index.html' },
  { id: 'gasolineras', area: 'movilidad', nombre: 'Gasolineras', lema: 'El precio de hoy en las 12.000 gasolineras: la más barata cerca de ti, por provincia y por marca.', color: '#ff5f7e', vista: 'mapa', ruta: './gasolineras/index.html' },
  { id: 'trenes', area: 'movilidad', nombre: 'Trenes', lema: 'Todos los trenes de Renfe moviéndose por el mapa, con sus horarios y retrasos.', color: '#8fb4ff', vista: 'mapa', plan: 'Los trenes circulando según su horario, líneas de alta velocidad y viajeros.' },
  { id: 'aeropuertos', area: 'movilidad', nombre: 'Aeropuertos', lema: 'Pasajeros, rutas y los aeropuertos que más crecen.', color: '#b8a6ff', vista: 'mapa', plan: 'Pasajeros de cada aeropuerto mes a mes, rutas internacionales y mercancías.' },
  { id: 'carreteras', area: 'movilidad', nombre: 'Carreteras', lema: 'Tráfico, accidentes y obras en la red de carreteras.', color: '#ff8a5c', vista: 'mapa', plan: 'Incidencias en directo, intensidad de tráfico y siniestralidad por provincia.' },
  // Cultura y ocio
  { id: 'cultura', area: 'ocio', nombre: 'Cultura', lema: 'Cine, museos, libros y conciertos.', color: '#f78fb3', vista: 'consola', plan: 'Espectadores de cine español, museos más visitados, libros publicados y gasto cultural.' },
  { id: 'deporte', area: 'ocio', nombre: 'Deporte', lema: 'Cuánto hacemos deporte, licencias y grandes eventos.', color: '#5ee6a8', vista: 'consola', plan: 'Licencias federativas por deporte, práctica deportiva y medallas.' },
]
