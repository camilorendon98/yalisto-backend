// Pure conversation helpers: no persistence or external actions.
const INSTRUCCIONES_CALIDEZ = [
  'Demuestra cercanía respondiendo al detalle concreto que la persona acaba de compartir. Evita anunciar que entiendes o que vas a avanzar sin aportar contenido.',
  'Mantén español neutro y respeta el estilo elegido. Usa el nombre ocasionalmente; evita diminutivos, apodos afectivos y emojis por defecto.',
  'Si la persona expresa cansancio o sobrecarga, reconoce brevemente lo que dice y ofrece una sola ayuda pertinente. Si solo quiere hablar, acompaña la conversación sin imponer productividad.',
  'Distingue propuestas de acciones realizadas. No prometas volver luego, notificar o seguir trabajando en segundo plano sin una capacidad y un resultado confirmados.',
  'Al priorizar, usa fechas y prioridades presentes; si faltan, presenta tu elección como una propuesta, nunca inventes urgencias.',
  'La calidez no exige fingir sentimientos humanos, intimidad ni conocimiento sobre la persona. Usa solo contexto disponible y respeta el modo descanso.',
  'Ante un sí breve, responde a la última propuesta concreta del asistente. Si requiere una acción no ejecutada, no la presentes como completada.',
].join('\n');

function normalizar(texto = '') {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function respuestaCalidaLocal({ mensaje = '', resumen = {}, historial = [] }) {
  const t = normalizar(mensaje);
  const anterior = [...historial].reverse().find(m => m?.rol === 'assistant')?.contenido || '';
  const elegir = opciones => opciones.find(x => x !== anterior) || opciones[0];
  if (/^(hola|buenas|hey|ey)[!.\s]*$/.test(t)) {
    return elegir(['Hola, qué gusto saludarte. Cuéntame.', 'Hola. ¿Cómo va tu día?']);
  }
  if (/^(muchas gracias|gracias|gracias por todo)[!.\s]*$/.test(t)) {
    return elegir(['Con gusto.', 'Me alegra que te sirva.']);
  }
  if (/^(solo quiero hablar|no quiero consejos|solo escuchame)[!.\s]*$/.test(t)) {
    return 'Te leo. Cuéntame lo que quieras compartir, a tu ritmo.';
  }
  // Match direct self-reports only, not "no estoy cansado" or third parties.
  if (/^(?:hoy\s+)?(?:estoy|me siento)\s+(?:muy\s+|algo\s+)?(?:cansad[oa]|abrumad[oa]|estresad[oa])\b/.test(t)) {
    if (/no quiero (?:consejos|organizar|hacer)|solo quiero hablar/.test(t)) {
      return 'Podemos hablar con calma. ¿Qué ha sido lo más pesado de hoy?';
    }
    const pendientes = (resumen.compromisos || []).filter(c =>
      c && !['resuelto', 'cancelado'].includes(c.estado) && typeof c.titulo === 'string' && c.titulo.trim()
    );
    if (/pendientes|tareas|organizar/.test(t) && pendientes.length) {
      const titulo = pendientes[0].titulo.trim();
      return elegir([
        `Vamos con calma. Entre tus pendientes está “${titulo}”. Podemos centrarnos en ese y pensar en un primer paso pequeño.`,
        `Podemos reducirlo a una sola cosa: “${titulo}” está pendiente. ¿Qué parte te gustaría resolver primero?`,
      ]);
    }
    return elegir(['Podemos ir con calma. ¿Prefieres contarme qué pasó o pensar en algo que te quite un poco de carga?', 'No hace falta resolverlo todo ahora. Te leo, a tu ritmo.']);
  }
  return null;
}

module.exports = { INSTRUCCIONES_CALIDEZ, respuestaCalidaLocal };
