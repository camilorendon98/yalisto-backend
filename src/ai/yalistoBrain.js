const API_URL = 'https://api.openai.com/v1/responses';
const personalizacion = require('../personalizacion');
const pg = require('../db-postgres');

const IDIOMAS = {
  'es-CO':'español colombiano neutro',
  'en-US':'English',
  'pt-BR':'português brasileiro',
  'fr-FR':'français',
  'de-DE':'Deutsch',
  'it-IT':'italiano',
  'zh-CN':'简体中文',
  'ja-JP':'日本語',
};

function textoSalida(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const partes=[];
  for (const item of data?.output || []) for (const c of item?.content || []) if (c?.type==='output_text' && c?.text) partes.push(c.text);
  return partes.join('\n').trim();
}

const LOCAL = {
  'es-CO':{ hola:'¡Hey! Aquí estoy 😄 ¿Qué hacemos?', gracias:'Con gusto. Aquí sigo.' },
  'en-US':{ hola:"Hey! I'm here 😄 What are we doing?", gracias:"Anytime. I'm right here." },
  'pt-BR':{ hola:'Oi! Estou aqui 😄 O que vamos fazer?', gracias:'Por nada. Estou por aqui.' },
  'fr-FR':{ hola:'Salut ! Je suis là 😄 On fait quoi ?', gracias:'Avec plaisir. Je suis là.' },
  'de-DE':{ hola:'Hey! Ich bin da 😄 Was machen wir?', gracias:'Gern. Ich bin hier.' },
  'it-IT':{ hola:'Ehi! Ci sono 😄 Che facciamo?', gracias:'Volentieri. Sono qui.' },
  'zh-CN':{ hola:'嗨！我在 😄 今天想做什么？', gracias:'不客气，我在这儿。' },
  'ja-JP':{ hola:'やあ！ここにいるよ 😄 今日は何をする？', gracias:'どういたしまして。ここにいるよ。' },
};

function ultimoMensajeUsuario(historial=[], actual='') {
  const objetivo=String(actual||'').trim().toLowerCase();
  const usuarios=(historial||[]).filter(m=>m?.rol==='user' && String(m?.contenido||'').trim());
  for (let i=usuarios.length-1;i>=0;i--) {
    const texto=String(usuarios[i].contenido).trim();
    if (texto.toLowerCase() !== objetivo) return texto;
  }
  return '';
}

function ultimoMensajeAsistente(historial=[]) {
  const asistentes=(historial||[]).filter(m=>m?.rol==='assistant' && String(m?.contenido||'').trim());
  return asistentes.length ? String(asistentes[asistentes.length-1].contenido).trim() : '';
}

function pendientesActivos(resumen={}) {
  return (resumen.compromisos||[]).filter(c=>!['resuelto','cancelado'].includes(c.estado));
}

function respuestaContinuacion({ mensaje, historial, resumen, nombre='' }) {
  const t=String(mensaje||'').toLowerCase().trim();
  const anterior=ultimoMensajeUsuario(historial,mensaje).toLowerCase();
  const pendientes=pendientesActivos(resumen);
  const n=nombre?`${nombre}, `:'';

  if (/lo que t[uú] me digas|t[uú] dir[aá]s|decide t[uú]|hazlo t[uú]|como quieras|sigue por ah[ií]|dale sigue|toma t[uú] la decisi[oó]n/.test(t)) {
    if (/semana|organizar|pendiente/.test(anterior) || pendientes.length) {
      const primero=pendientes[0]?.titulo;
      const segundo=pendientes[1]?.titulo;
      if (primero) return `${n}entonces tomo la batuta. Yo empezaría por “${primero}”${segundo?`, y después seguimos con “${segundo}”`:''}. Si te parece, arranco organizando el primero en pasos concretos.`;
      return `${n}entonces tomo la batuta: primero ponemos lo que tenga fecha u hora fija, después lo importante y al final lo que pueda esperar. Arranquemos por lo que más presión te quite hoy.`;
    }
    return `${n}entonces escojo yo 😄. Vamos por una sola cosa concreta primero; la resolvemos y después vemos la siguiente, sin llenarte de opciones.`;
  }

  if (/dame opciones|qu[eé] opciones|cu[aá]les/.test(t) && /hamburgues|pizza|sushi|comer|restaurante|comprar|buscar/.test(anterior)) {
    return 'Sí. Te las organizo por tres criterios: la opción más práctica, la de mejor relación precio/beneficio y una alternativa distinta por si quieres variar.';
  }

  if (/s[ií]|dale|aj[aá]|bueno|ok|okay$/.test(t) && anterior) {
    if (/organizar.*semana|semana.*organizar/.test(anterior)) return 'Perfecto. Entonces empiezo por lo fijo: citas, vencimientos y cosas con hora. Después acomodamos lo importante alrededor de eso y te dejo espacio real, no una agenda imposible.';
    if (/hamburgues|pizza|sushi|quiero comer|restaurante/.test(anterior)) return 'De una. Voy a priorizar opciones que realmente te sirvan, no una lista eterna. Si ya tengo tu ciudad, la uso; si no, solo te pediré la zona cuando sea indispensable.';
  }
  return null;
}

function localBase({ idioma, mensaje, respuestaBase='', hechos={}, historial=[], resumen={}, nombre='' }) {
  const t=String(mensaje||'').toLowerCase().trim();
  const m=LOCAL[idioma] || LOCAL['es-CO'];
  if (/^(hola|buenas|hey|ey|hi|hello|ol[aá]|bonjour|salut|hallo|ciao|你好|こんにちは)/i.test(t)) return m.hola;
  if (/gracias|thanks|obrigad|merci|danke|grazie|谢谢|ありがとう/i.test(t)) return m.gracias;

  if (hechos?.tipo==='conversacion') {
    const continuacion=respuestaContinuacion({ mensaje, historial, resumen, nombre });
    if (continuacion) return continuacion;
    const anterior=ultimoMensajeAsistente(historial).toLowerCase();
    const opciones=[
      'Va. Yo tomo el hilo y te voy proponiendo cosas concretas, sin hacerte llenar un formulario.',
      'Dale. Háblame normal; con lo que ya me des voy avanzando y solo te pregunto algo si de verdad hace falta.',
      'Sí, vamos por ahí. Yo me encargo de ordenar la idea mientras hablamos.',
    ];
    const distinta=opciones.find(x=>!anterior.includes(x.toLowerCase().slice(0,18))) || opciones[0];
    return distinta;
  }

  // En gestiones reales, la respuesta base contiene hechos que el backend sí confirmó.
  if (respuestaBase) return respuestaBase;
  return 'Dale. Lo vemos juntos y avanzo con lo que ya tengo.';
}

function compactarResumen(resumen={}) {
  return {
    compromisos:(resumen.compromisos||[]).slice(0,8).map(x=>({titulo:x.titulo,estado:x.estado,prioridad:x.prioridad,fecha_limite:x.fecha_limite,categoria:x.categoria,tipo:x.tipo_compromiso})),
    recordatorios:(resumen.recordatorios||[]).slice(0,8).map(x=>({titulo:x.titulo,fecha:x.fecha,hora:x.hora})),
    memoria:(resumen.memoria||[]).slice(0,10).map(x=>({tipo:x.tipo,titulo:x.titulo,valor:x.valor})),
    acciones:(resumen.acciones||[]).slice(0,8).map(x=>({tipo:x.tipo,estado:x.estado,descripcion:x.descripcion})),
  };
}

function instruccionPersonalidad(codigo) {
  const mapa={
    amigo:'Habla como un amigo útil: cercano, relajado, espontáneo y respetuoso. Puedes usar expresiones naturales como “dale”, “mira”, “de una” cuando encajen, sin forzarlas.',
    consejero:'Sé cercano y agudo: escucha primero, entiende el contexto y da una recomendación clara sin sonar solemne.',
    entrenador:'Sé dinámico y orientado a avanzar. Propón una acción concreta y evita discursos largos.',
    ejecutivo:'Ve al punto, organiza la información y da opciones claras. Mantén calidez humana.',
    acompanante:'Sé cálido, paciente y atento, sin sonar terapéutico ni paternalista.',
    directo:'Habla claro y sin rodeos, pero nunca agresivo ni condescendiente.',
  };
  return mapa[codigo] || mapa.consejero;
}

function instruccionEstilo(codigo) {
  const mapa={
    breve:'Responde corto: normalmente 1 a 3 frases.',
    conversacional:'Haz que la respuesta parezca una conversación real. Puedes hacer una pregunta breve si realmente ayuda.',
    ejecutivo:'Usa frases compactas y opciones concretas.',
    creativo:'Sé más fresco, expresivo y variado; usa humor ligero cuando tenga sentido.',
    equilibrado:'Sé natural y práctico; 2 a 5 frases por defecto.',
  };
  return mapa[codigo] || mapa.equilibrado;
}

function instruccionAnimo(animo) {
  if (!animo) return '';
  const mapa={
    motivado:'El usuario reportó motivación: puedes sonar un poco más dinámico y aprovechar esa energía.',
    cansado:'El usuario reportó cansancio: reduce carga, usa menos pasos y un ritmo calmado.',
    estresado:'El usuario reportó estrés: ordena y simplifica, sin dramatizar.',
    preocupado:'El usuario reportó preocupación: separa lo controlable de lo que no y propone una acción útil.',
    triste:'El usuario reportó tristeza: sé cálido y práctico, sin diagnosticar ni sustituir ayuda profesional.',
    molesto:'El usuario reportó molestia: sé claro, tranquilo y orientado a resolver.',
    abrumado:'El usuario reportó sentirse abrumado: una cosa a la vez; no arrojes listas largas.',
  };
  return mapa[animo.estado] || '';
}

async function responderConCerebro({usuario,mensaje,historial=[],resumen={},respuestaBase='',hechos={},acciones=[]}) {
  const nombre=usuario?.nombre?.trim()?.split(/\s+/)[0] || '';
  const [animo,preferencias,personas,vehiculos]=await Promise.all([
    usuario?.id?personalizacion.obtenerEstadoAnimoHoy(usuario.id).catch(()=>null):null,
    usuario?.id?personalizacion.obtenerPreferencias(usuario.id).catch(()=>null):null,
    usuario?.id?pg.listarPersonas(usuario.id).catch(()=>[]):[],
    usuario?.id?pg.listarVehiculos(usuario.id).catch(()=>[]):[],
  ]);
  const idioma=preferencias?.idioma || 'es-CO';
  const local=localBase({ idioma, mensaje, respuestaBase, hechos, historial, resumen, nombre });
  const apiKey=process.env.OPENAI_API_KEY;
  if (!apiKey) return {respuesta:local,motor:'local-contextual',idioma};

  const instructions=[
    'Eres Yalisto, una sombra digital y agente personal. La persona debe sentir que conversa con alguien ágil, útil y natural, no con un formulario.',
    `Responde en ${IDIOMAS[idioma] || IDIOMAS['es-CO']}, salvo que el usuario pida otro idioma en ese mensaje.`,
    instruccionPersonalidad(preferencias?.personalidad_asistente),
    instruccionEstilo(preferencias?.estilo_respuesta),
    instruccionAnimo(animo),
    preferencias?.modo_descanso ? 'El usuario puso a Yalisto en modo descanso. No hagas intervenciones proactivas; responde solo si te habló directamente.' : '',
    'USA la conversación reciente. Un mensaje corto como “sí”, “sigue”, “lo que tú digas” o “dale” continúa la idea anterior: no reinicies la conversación ni respondas con una frase genérica.',
    'NUNCA des dos respuestas seguidas prácticamente iguales. Haz progresar la conversación en cada turno: decide, propone, resume, compara, busca o da el próximo movimiento según el contexto.',
    'VARÍA las aperturas y el ritmo. No empieces siempre con “Listo”, “Te sigo”, “Entiendo” ni “Cuéntame más”. Evita frases corporativas como “el siguiente paso más útil” salvo que realmente hagan falta.',
    'En conversación cotidiana puedes responder “Dale”, “Sí, mira”, “Uy, eso cambia la cosa”, “De una”, “A ver…” u otras expresiones naturales según el tono y país, pero no uses muletillas en cada respuesta.',
    'Si el usuario ya dio información suficiente, ACTÚA con ella: responde, compara, organiza o usa las acciones disponibles. No pidas contexto innecesario.',
    'Si el usuario te delega la decisión, toma una decisión razonable con lo que tienes y explica brevemente el criterio. No devuelvas la decisión al usuario de inmediato.',
    'No conviertas charla casual, recomendaciones de comida, lugares, compras o curiosidad en una Misión a menos que el usuario pida guardarlo, recordarlo, agendarlo o hacer seguimiento.',
    'Cuando el usuario pide una búsqueda y HECHOS o ACCIONES muestran que se buscaron opciones, presenta resultados concretos. No digas que buscaste si no ocurrió.',
    'Usa memoria, personas, relaciones y vehículos solo cuando haya coincidencia clara. Nunca inventes datos personales.',
    'Nunca afirmes que pagaste, llamaste, enviaste, compraste, reservaste o ejecutaste algo externo si los HECHOS no lo confirman.',
    'Distingue lo guardado, lo sugerido y lo que requiere autorización.',
    'No narres razonamiento interno ni cadena de pensamiento. Da la conclusión y, si sirve, una explicación breve.',
    'El estado de ánimo es autorreportado: solo adapta tono y carga; no diagnostiques.',
  ].filter(Boolean).join('\n');

  const input=JSON.stringify({
    usuario:{nombre:usuario?.nombre||null,ciudad:usuario?.ciudad||null},
    mensaje_actual:mensaje,
    conversacion_reciente:(historial||[]).slice(-18).map(m=>({rol:m.rol,contenido:m.contenido})),
    contexto_personal:compactarResumen(resumen),
    personas_guardadas:(personas||[]).slice(0,25).map(p=>({nombre:p.nombre,apodo:p.apodo,tipo_relacion:p.tipo_relacion||p.relacion,fecha_importante:p.fecha_importante,notas:p.notas})),
    vehiculos_guardados:(vehiculos||[]).slice(0,10).map(v=>({placa:v.placa,marca:v.marca,linea:v.linea,modelo:v.modelo,soat_vence:v.soat_vence,tecnomecanica_vence:v.tecnomecanica_vence})),
    estado_de_hoy_autoreportado:animo?{estado:animo.estado,intensidad:animo.intensidad,energia:animo.energia,ayuda_preferida:animo.ayuda_preferida}:null,
    preferencias:{personalidad:preferencias?.personalidad_asistente,estilo:preferencias?.estilo_respuesta,presencia:preferencias?.presencia_asistente,modo_descanso:preferencias?.modo_descanso},
    hechos_confirmados_por_backend:hechos,
    respuesta_base_segura:respuestaBase,
    acciones_disponibles:acciones,
  });

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),14000);
  try {
    const res=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions,input,max_output_tokens:560}),
      signal:controller.signal,
    });
    if (!res.ok) {
      const detalle=await res.text().catch(()=>'');
      console.error('OpenAI Yalisto Brain:',res.status,detalle.slice(0,500));
      return {respuesta:local,motor:'local-contextual',idioma};
    }
    const data=await res.json();
    const respuesta=textoSalida(data);
    return {respuesta:respuesta||local,motor:respuesta?'openai':'local-contextual',modelo:process.env.OPENAI_MODEL||'gpt-5.6-luna',idioma};
  } catch(err) {
    console.error('Yalisto Brain fallback:',err?.message||err);
    return {respuesta:local,motor:'local-contextual',idioma};
  } finally { clearTimeout(timer); }
}

module.exports={responderConCerebro};
