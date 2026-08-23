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

function fuentesWeb(data) {
  const urls = [];
  for (const item of data?.output || []) {
    if (item?.type === 'web_search_call') {
      for (const source of item?.action?.sources || []) {
        if (source?.url && !urls.includes(source.url)) urls.push(source.url);
      }
    }
    for (const contenido of item?.content || []) {
      for (const an of contenido?.annotations || []) {
        if (an?.url && !urls.includes(an.url)) urls.push(an.url);
      }
    }
  }
  return urls.slice(0, 4);
}

function esBusquedaPractica(texto='') {
  const t = String(texto).toLowerCase();
  return /\b(b[uú]scame|buscame|buscarme|encu[eé]ntrame|recomi[eé]ndame|dame opciones|d[oó]nde puedo|qu[eé] hay cerca|cerca de m[ií]|quiero comer|quiero pedir|hamburgues|pizza|sushi|restaurante|caf[eé]|hotel|tienda|comprar|cotizar|precio de|planes para|qu[eé] hacer hoy)\b/i.test(t);
}

async function descubrir({ usuario, mensaje, idioma='es-CO' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const ciudad = usuario?.ciudad || null;
  if (!apiKey) {
    const ubicacion = ciudad ? ` en ${ciudad}` : '';
    return {
      respuesta: `Dale. Puedo ayudarte a buscar opciones${ubicacion}. En este momento no tengo la búsqueda web inteligente activa, pero te dejo el acceso para abrir resultados y, si me dices zona o presupuesto, te ayudo a filtrarlos.`,
      acciones:[{ etiqueta:'🔎 Ver opciones', url:`https://www.google.com/search?q=${encodeURIComponent(`${mensaje}${ubicacion}`)}`, descripcion:'Abrir búsqueda relacionada' }],
      motor:'local-discovery',
    };
  }

  const tools = [{
    type:'web_search',
    search_context_size:'medium',
    ...(ciudad ? { user_location:{ type:'approximate', city:ciudad, country:'CO', timezone:'America/Bogota' } } : {}),
  }];

  const instructions = [
    'Eres Yalisto. Esta es una búsqueda práctica y cotidiana, no una misión ni una tarea para guardar.',
    `Responde en ${idioma === 'es-CO' ? 'español colombiano neutro' : idioma}.`,
    'Habla como una persona útil y natural, no como un formulario ni como un asistente corporativo.',
    'Empieza de manera casual: “Dale”, “Sí, mira”, “Te encontré estas”, o equivalente según el contexto. No repitas siempre la misma apertura.',
    'Si el usuario pide comida, lugares, compras u opciones, busca primero y entrega 3 a 5 alternativas concretas cuando haya datos suficientes.',
    'Incluye por cada opción solo lo útil: nombre, por qué puede servir, zona/precio aproximado si la fuente lo permite. No inventes horarios, precios, calificaciones ni disponibilidad.',
    'Si falta ubicación y la búsqueda depende totalmente de ella, pide solo ciudad o zona. Si el perfil ya tiene ciudad, úsala y no vuelvas a preguntarla.',
    'No digas que reservaste, compraste, pediste o llamaste. Solo di que encontraste opciones o que puedes abrirlas.',
    'Sé corto y conversacional. Evita frases como “dame más contexto para proponerte el siguiente paso más útil”.',
  ].join('\n');

  const input = JSON.stringify({
    usuario:{ nombre:usuario?.nombre || null, ciudad },
    solicitud:mensaje,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const res = await fetch(API_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        instructions,
        input,
        tools,
        max_output_tokens:650,
      }),
      signal:controller.signal,
    });
    if (!res.ok) throw new Error(`web search ${res.status}`);
    const data = await res.json();
    const respuesta = textoSalida(data) || 'Dale. Encontré algunas opciones, pero no pude resumirlas bien. Te dejo la búsqueda abierta para que las revisemos.';
    const fuentes = fuentesWeb(data);
    const acciones = fuentes.map((url, i) => ({ etiqueta:`🌐 Fuente ${i+1}`, url, descripcion:'Abrir resultado consultado por Yalisto' }));
    if (!acciones.length) acciones.push({ etiqueta:'🔎 Abrir búsqueda', url:`https://www.google.com/search?q=${encodeURIComponent(`${mensaje}${ciudad ? ` ${ciudad}` : ''}`)}`, descripcion:'Ver más resultados' });
    return { respuesta, acciones, motor:'openai-web-search' };
  } catch (err) {
    console.error('Yalisto discovery fallback:', err?.message || err);
    return {
      respuesta:`Dale. Quise buscarte opciones, pero la búsqueda web no respondió bien ahora mismo. Te dejo una búsqueda directa y seguimos desde ahí.`,
      acciones:[{ etiqueta:'🔎 Abrir búsqueda', url:`https://www.google.com/search?q=${encodeURIComponent(`${mensaje}${ciudad ? ` ${ciudad}` : ''}`)}`, descripcion:'Ver resultados' }],
      motor:'local-discovery',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { esBusquedaPractica, descubrir };
