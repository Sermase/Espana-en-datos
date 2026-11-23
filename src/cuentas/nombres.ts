// Nombres en castellano de las funciones de gasto (COFOG) y de los ingresos y gastos de la contabilidad nacional.
export const FUNCION: Record<string, [string, string, string]> = {
  // código: [nombre, corto, color]
  GF10: ['Pensiones y protección social', 'Protección social', '#3987e5'],
  GF07: ['Sanidad', 'Sanidad', '#199e70'],
  GF01: ['Servicios generales e intereses', 'Serv. generales', '#9085e9'],
  GF04: ['Transporte, empleo, energía, campo…', 'Economía', '#d95926'],
  GF09: ['Educación', 'Educación', '#ffd166'],
  GF03: ['Orden público y seguridad', 'Seguridad', '#d55181'],
  GF06: ['Vivienda y servicios urbanos', 'Vivienda y urbanos', '#c6f25e'],
  GF05: ['Medio ambiente', 'Medio ambiente', '#5fd3e8'],
  GF08: ['Ocio, cultura y religión', 'Cultura y ocio', '#f2b880'],
  GF02: ['Defensa', 'Defensa', '#8a9bb0'],
}
export const SUBFUNCION: Record<string, string> = {
  GF0101: 'Órganos ejecutivos y legislativos, hacienda, exteriores', GF0102: 'Ayuda exterior', GF0103: 'Servicios generales', GF0104: 'Investigación básica', GF0105: 'I+D de servicios generales', GF0106: 'Otros servicios generales', GF0107: 'Intereses de la deuda pública', GF0108: 'Transferencias entre administraciones',
  GF0201: 'Defensa militar', GF0202: 'Defensa civil', GF0203: 'Ayuda militar al exterior', GF0204: 'I+D de defensa', GF0205: 'Otros de defensa',
  GF0301: 'Policía', GF0302: 'Bomberos y protección civil', GF0303: 'Tribunales de justicia', GF0304: 'Prisiones', GF0305: 'I+D de orden público', GF0306: 'Otros de orden público',
  GF0401: 'Asuntos económicos, comerciales y laborales', GF0402: 'Agricultura, silvicultura, pesca y caza', GF0403: 'Combustibles y energía', GF0404: 'Minería, industria y construcción', GF0405: 'Transporte', GF0406: 'Comunicaciones', GF0407: 'Otras industrias (turismo…)', GF0408: 'I+D de asuntos económicos', GF0409: 'Otros asuntos económicos',
  GF0501: 'Gestión de residuos', GF0502: 'Aguas residuales', GF0503: 'Reducción de la contaminación', GF0504: 'Biodiversidad y paisaje', GF0505: 'I+D de medio ambiente', GF0506: 'Otros de medio ambiente',
  GF0601: 'Urbanización y vivienda', GF0602: 'Desarrollo comunitario', GF0603: 'Abastecimiento de agua', GF0604: 'Alumbrado público', GF0605: 'I+D de vivienda', GF0606: 'Otros de vivienda',
  GF0701: 'Medicamentos y material sanitario', GF0702: 'Atención ambulatoria (centros de salud)', GF0703: 'Hospitales', GF0704: 'Salud pública', GF0705: 'I+D de sanidad', GF0706: 'Otros de sanidad',
  GF0801: 'Deporte y ocio', GF0802: 'Cultura', GF0803: 'Radio, televisión y editoriales', GF0804: 'Religión y otros servicios comunitarios', GF0805: 'I+D de ocio y cultura', GF0806: 'Otros de ocio y cultura',
  GF0901: 'Infantil y primaria', GF0902: 'Secundaria', GF0903: 'Postsecundaria no universitaria', GF0904: 'Universidad', GF0905: 'Enseñanza no atribuible a un nivel', GF0906: 'Servicios auxiliares (comedor, transporte…)', GF0907: 'I+D de educación', GF0908: 'Otros de educación',
  GF1001: 'Enfermedad e incapacidad', GF1002: 'Vejez (pensiones de jubilación)', GF1003: 'Supervivencia (viudedad, orfandad)', GF1004: 'Familia e hijos', GF1005: 'Desempleo', GF1006: 'Vivienda (ayudas)', GF1007: 'Exclusión social', GF1008: 'I+D de protección social', GF1009: 'Otros de protección social',
}
export const INGRESO: Record<string, [string, string, string]> = {
  D61REC: ['Cotizaciones sociales', 'Cotizaciones', '#3987e5'],
  D5REC: ['Impuestos sobre la renta (IRPF, sociedades…)', 'IRPF, sociedades…', '#9085e9'],
  D2REC: ['Impuestos sobre el consumo (IVA, especiales…)', 'IVA y consumo', '#d95926'],
  P11_P12_P131: ['Ventas, tasas y servicios', 'Ventas y tasas', '#199e70'],
  D4REC: ['Rentas de la propiedad', 'Rentas propiedad', '#ffd166'],
  OTROS: ['Transferencias y otros ingresos', 'Otros ingresos', '#8a9bb0'],
}
export const GASTO_TIPO: Record<string, [string, string, string]> = {
  PRES: ['Pensiones, paro y otras prestaciones', 'Prestaciones', '#3987e5'],
  D1PAY: ['Sueldos de los empleados públicos', 'Sueldos', '#199e70'],
  P2: ['Compras de bienes y servicios', 'Compras', '#ffd166'],
  D41PAY: ['Intereses de la deuda', 'Intereses', '#d55181'],
  P51G: ['Inversión (obras, equipos…)', 'Inversión', '#d95926'],
  D3PAY: ['Subvenciones a empresas', 'Subvenciones', '#e0a8ff'],
  OTROS: ['Transferencias y otros gastos', 'Otros gastos', '#8a9bb0'],
}
export const SECTOR: Record<string, [string, string, string]> = {
  S1311: ['Estado y organismos estatales', 'Estado', '#9fc5ff'],
  S1312: ['Comunidades autónomas', 'Comunidades', '#ffd166'],
  S1313: ['Ayuntamientos, diputaciones y cabildos', 'Locales', '#c6f25e'],
  S1314: ['Seguridad Social', 'Seguridad Social', '#3987e5'],
}
export const PAIS: Record<string, string> = { ES: 'España', EU27_2020: 'Media de la UE', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal', NL: 'Países Bajos', BE: 'Bélgica', AT: 'Austria', SE: 'Suecia', DK: 'Dinamarca', FI: 'Finlandia', IE: 'Irlanda', EL: 'Grecia', PL: 'Polonia' }
