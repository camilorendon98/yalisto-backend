// intent.js
// Clasificador MUY simple por palabras clave. Es un punto de partida para
// que la app ya "entienda" en qué categoría cae una solicitud.
//
// Para que Yalisto realmente entienda lenguaje libre ("se me dañó la
// lavadora y no sé a quién llamar") en vez de solo palabras clave, este
// es el lugar donde se conectaría un modelo de lenguaje real —por ejemplo
// la API de Claude (docs.claude.com)— mandándole el texto del usuario y
// pidiéndole que devuelva la categoría, los datos clave, y el siguiente
// paso sugerido.

const REGLAS = [
  { categoria: 'vehiculo', icono: '🚗', palabras: ['soat', 'carro', 'moto', 'tecnomecanica', 'tecnomecánica', 'placa'] },
  { categoria: 'salud', icono: '🩺', palabras: ['cita', 'medico', 'médico', 'eps', 'salud', 'doctor'] },
  { categoria: 'hogar', icono: '🏠', palabras: ['internet', 'casa', 'nevera', 'lavadora', 'arreglar', 'reparacion', 'reparación'] },
  { categoria: 'legal', icono: '⚖️', palabras: ['abogado', 'demanda', 'contrato', 'multa', 'tutela', 'derecho de peticion', 'derecho de petición'] },
  { categoria: 'pagos', icono: '💰', palabras: ['pagar', 'factura', 'impuesto', 'vencimiento', 'vence'] },
  { categoria: 'documentos', icono: '🧾', palabras: ['garantia', 'garantía', 'documento', 'cedula', 'cédula', 'licencia', 'poliza', 'póliza'] },
  { categoria: 'celular', icono: '📱', palabras: ['app', 'apps', 'celular', 'contacto', 'llamada', 'mensaje', 'carpeta'] },
];

function clasificar(texto) {
  const t = (texto || '').toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => t.includes(p))) {
      return { categoria: regla.categoria, icono: regla.icono };
    }
  }
  return { categoria: 'general', icono: '📌' };
}

module.exports = { clasificar };
