const API_URL = 'https://api.openai.com/v1/responses';

function textoSalida(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const partes = [];
  for (const item of data?.output || []) {
    for (const contenido of item?.content || []) {
      if (contenido?.type === 'output_text' && contenido?.text) partes.push(contenido.text);
    }
  }
  return partes.join('\n').trim();
}

function respuestaLocal({ nombre, mensaje, respuestaBase, hechos = {} }) {
  const n = nombre ? `${nombre}, ` : '';
  const t = String(mensaje || '').toLowerCase();

  if (/^(hola|buenas|hey|ey|qué más|que mas|cómo estás|como estas)/.test(t)) {
    return `${n}aquí estoy. Dime qué tienes en la cabeza y lo aterrizamos: si es algo para recordar, organizar, buscar o resolver, lo convierto en un siguiente paso claro.`;
  }
  if (/gracias|muchas gracias|perfecto|listo$/.test(t)) {
    return `${n}con gusto. Yo me quedo con el contexto; cuando quieras seguimos desde aquí sin volver a empezar.`;
  }
  if (/qué puedes hacer|que puedes hacer|para qué sirves|para que sirves/.test(t)) {
    return `${n}puedo ayudarte a convertir cosas sueltas en algo manejable: recordar compromisos, ordenar fechas, guardar contexto, ubicar documentos, proponerte opciones y acompañar una gestión hasta que quede resuelta.`;
  }
  if (hechos?.tipo === 'consulta_pendientes') {
    return respuestaBase || `${n}ya revisé tus pendientes y te los puedo priorizar contigo.`;
  }
  if (hechos?.recordatorioCreado) {
    return `${n}ya quedó. Guardé el compromiso y activé el recordatorio. Si quieres, también puedo ayudarte a dejar listo el siguiente paso para no llegar a la fecha con todo encima.`;
  }
  if (hechos?.compromisoCreado) {
    return `${n}${respuestaBase || 'ya lo guardé como compromiso.'} No quiero que se quede solo anotado: dime si prefieres que primero busque opciones, organice documentos o te recuerde una fecha.`;
  }
  return respuestaBase || `${n}te sigo. Cuéntame un poco más y te propongo el siguiente paso más útil.`;
}

function compactarResumen(resumen = {}) {
  return {
    compromisos: (resumen.compromisos || []).slice(0, 8).map((x) => ({
      titulo: x.titulo,
      estado: x.estado,
      prioridad: x.prioridad,
      fecha_limite: x.fecha_limite,
      categoria: x.categoria,
    })),
    recordatorios: (resumen.recordatorios || []).slice(0, 8).map((x) => ({ titulo: x.titulo, fecha: x.fecha, hora: x.hora })),
    memoria: (resumen.memoria || []).slice(0, 10).map((x) => ({ tipo: x.tipo, titulo: x.titulo, valor: x.valor })),
    acciones: (resumen.acciones || []).slice(0, 8).map((x) => ({ tipo: x.tipo, estado: x.estado, descripcion: x.descripcion })),
  };
}

async function responderConCerebro({ usuario, mensaje, historial = [], resumen = {}, respuestaBase = '', hechos = {}, acciones = [] }) {
  const nombre = usuario?.nombre?.trim()?.split(/\s+/)[0] || '';
  const local = respuestaLocal({ nombre, mensaje, respuestaBase, hechos });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { respuesta: local, motor: 'local-contextual' };

  const modelo = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const contexto = compactarResumen(resumen);
  const conversacion = (historial || []).slice(-12).map((m) => ({ rol: m.rol, contenido: m.contenido }));

  const instructions = [
    'Eres Yalisto, un agente personal de vida en español neutro.',
    'Tu identidad no es la de un chatbot genérico: eres una sombra digital útil, cercana, aguda y proactiva.',
    'Habla natural, con personalidad y criterio. Sé breve por defecto: 2 a 5 frases, salvo que el usuario pida detalle.',
    'No seas robótico ni repitas siempre “listo”. Puedes usar humor ligero cuando encaje, sin exagerar emojis.',
    'Tu trabajo es convertir contexto en el siguiente paso útil: recordar, organizar, anticipar y ayudar a ejecutar.',
    'Nunca afirmes que pagaste, llamaste, enviaste, compraste, reservaste o ejecutaste algo si los HECHOS no dicen que ocurrió.',
    'Distingue claramente entre lo que ya quedó guardado, lo que propones y lo que requiere autorización del usuario.',
    'Usa la memoria y los pendientes entregados; no inventes datos personales ausentes.',
    'Si la conversación es casual, conversa con naturalidad y no fuerces una misión.',
    'Si falta un dato indispensable, pide solo el dato mínimo necesario.',
    'Cuando haya enlaces/acciones disponibles, puedes mencionarlos como opciones, pero no inventes URLs.',
  ].join('\n');

  const input = JSON.stringify({
    usuario: { nombre: usuario?.nombre || null, ciudad: usuario?.ciudad || null },
    mensaje_actual: mensaje,
    conversacion_reciente: conversacion,
    contexto_personal: contexto,
    hechos_confirmados_por_backend: hechos,
    respuesta_base_segura: respuestaBase,
    acciones_disponibles: acciones,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        instructions,
        input,
        max_output_tokens: 420,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('OpenAI Yalisto Brain:', res.status, detalle.slice(0, 500));
      return { respuesta: local, motor: 'local-contextual' };
    }
    const data = await res.json();
    const respuesta = textoSalida(data);
    if (!respuesta) return { respuesta: local, motor: 'local-contextual' };
    return { respuesta, motor: 'openai', modelo };
  } catch (err) {
    console.error('Yalisto Brain fallback:', err?.message || err);
    return { respuesta: local, motor: 'local-contextual' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { responderConCerebro };
