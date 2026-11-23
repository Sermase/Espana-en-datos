/** Capítulos del Sistema Armonizado (HS2), con nombre corto en español y la gran familia a la que pertenecen. */
export type Familia = 'alimentos' | 'energia' | 'quimica' | 'materiales' | 'maquinas' | 'vehiculos' | 'textil' | 'otros'
export const FAMILIAS: Record<Familia, { nombre: string; color: string }> = {
  vehiculos: { nombre: 'Coches y transporte', color: '#3987e5' },
  maquinas: { nombre: 'Máquinas y electrónica', color: '#9085e9' },
  quimica: { nombre: 'Química y fármacos', color: '#d55181' },
  alimentos: { nombre: 'Alimentos y bebidas', color: '#199e70' },
  energia: { nombre: 'Energía', color: '#ffb02e' },
  materiales: { nombre: 'Metales, plásticos y materiales', color: '#d95926' },
  textil: { nombre: 'Ropa, calzado y textil', color: '#3fe6ff' },
  otros: { nombre: 'Otros', color: '#6b7c86' },
}
const F = (f: Familia, n: string) => ({ f, n })
export const HS2: Record<string, { f: Familia; n: string }> = {
  '01': F('alimentos', 'Animales vivos'), '02': F('alimentos', 'Carne'), '03': F('alimentos', 'Pescado y marisco'), '04': F('alimentos', 'Lácteos, huevos y miel'),
  '05': F('alimentos', 'Otros productos animales'), '06': F('alimentos', 'Plantas y flores'), '07': F('alimentos', 'Hortalizas'), '08': F('alimentos', 'Frutas y frutos secos'),
  '09': F('alimentos', 'Café, té y especias'), '10': F('alimentos', 'Cereales'), '11': F('alimentos', 'Harinas y almidones'), '12': F('alimentos', 'Semillas oleaginosas'),
  '13': F('alimentos', 'Gomas y resinas vegetales'), '14': F('alimentos', 'Otras materias vegetales'), '15': F('alimentos', 'Aceites y grasas (aceite de oliva)'), '16': F('alimentos', 'Conservas de carne y pescado'),
  '17': F('alimentos', 'Azúcar y dulces'), '18': F('alimentos', 'Cacao y chocolate'), '19': F('alimentos', 'Pan, pasta y bollería'), '20': F('alimentos', 'Conservas vegetales y zumos'),
  '21': F('alimentos', 'Otros preparados alimenticios'), '22': F('alimentos', 'Bebidas y vino'), '23': F('alimentos', 'Piensos y restos de la industria alimentaria'), '24': F('alimentos', 'Tabaco'),
  '25': F('materiales', 'Sal, piedra y cemento'), '26': F('materiales', 'Minerales metálicos'), '27': F('energia', 'Petróleo, gas y combustibles'), '28': F('quimica', 'Química inorgánica'),
  '29': F('quimica', 'Química orgánica'), '30': F('quimica', 'Medicamentos'), '31': F('quimica', 'Abonos'), '32': F('quimica', 'Pinturas y tintes'),
  '33': F('quimica', 'Perfumes y cosméticos'), '34': F('quimica', 'Jabones y detergentes'), '35': F('quimica', 'Colas y enzimas'), '36': F('quimica', 'Explosivos y cerillas'),
  '37': F('quimica', 'Material fotográfico'), '38': F('quimica', 'Otros productos químicos'), '39': F('materiales', 'Plásticos'), '40': F('materiales', 'Caucho y neumáticos'),
  '41': F('textil', 'Pieles y cueros'), '42': F('textil', 'Bolsos y marroquinería'), '43': F('textil', 'Peletería'), '44': F('materiales', 'Madera'),
  '45': F('materiales', 'Corcho'), '46': F('materiales', 'Cestería'), '47': F('materiales', 'Pasta de papel'), '48': F('materiales', 'Papel y cartón'),
  '49': F('otros', 'Libros y prensa'), '50': F('textil', 'Seda'), '51': F('textil', 'Lana'), '52': F('textil', 'Algodón'),
  '53': F('textil', 'Otras fibras vegetales'), '54': F('textil', 'Filamentos sintéticos'), '55': F('textil', 'Fibras sintéticas'), '56': F('textil', 'Guata, fieltro y cordelería'),
  '57': F('textil', 'Alfombras'), '58': F('textil', 'Tejidos especiales'), '59': F('textil', 'Tejidos técnicos'), '60': F('textil', 'Tejidos de punto'),
  '61': F('textil', 'Ropa de punto'), '62': F('textil', 'Ropa (no de punto)'), '63': F('textil', 'Otros artículos textiles'), '64': F('textil', 'Calzado'),
  '65': F('textil', 'Sombreros'), '66': F('textil', 'Paraguas'), '67': F('textil', 'Plumas y flores artificiales'), '68': F('materiales', 'Piedra trabajada'),
  '69': F('materiales', 'Cerámica y azulejos'), '70': F('materiales', 'Vidrio'), '71': F('otros', 'Oro, joyas y piedras preciosas'), '72': F('materiales', 'Hierro y acero'),
  '73': F('materiales', 'Manufacturas de hierro y acero'), '74': F('materiales', 'Cobre'), '75': F('materiales', 'Níquel'), '76': F('materiales', 'Aluminio'),
  '78': F('materiales', 'Plomo'), '79': F('materiales', 'Cinc'), '80': F('materiales', 'Estaño'), '81': F('materiales', 'Otros metales'),
  '82': F('materiales', 'Herramientas'), '83': F('materiales', 'Otras manufacturas de metal'), '84': F('maquinas', 'Máquinas y aparatos mecánicos'), '85': F('maquinas', 'Material eléctrico y electrónico'),
  '86': F('vehiculos', 'Trenes y material ferroviario'), '87': F('vehiculos', 'Coches, camiones y piezas'), '88': F('vehiculos', 'Aviones y piezas'), '89': F('vehiculos', 'Barcos'),
  '90': F('maquinas', 'Óptica, medicina y precisión'), '91': F('maquinas', 'Relojes'), '92': F('otros', 'Instrumentos musicales'), '93': F('otros', 'Armas y municiones'),
  '94': F('otros', 'Muebles e iluminación'), '95': F('otros', 'Juguetes y deporte'), '96': F('otros', 'Manufacturas diversas'), '97': F('otros', 'Arte y antigüedades'),
  '98': F('otros', 'Conjuntos industriales'), '99': F('otros', 'Otros y confidencial'),
}
export const hs2 = (c: string) => HS2[c] ?? { f: 'otros' as Familia, n: `Capítulo ${c}` }
