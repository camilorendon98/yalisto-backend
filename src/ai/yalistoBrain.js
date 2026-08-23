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
  'es-CO':{ hola:'¡Hey! Aquí estoy 😄 ¿Qué hacemos?', gracias:'Con gusto. Aquí sigo.', generico:'Dale, te sigo. Cuéntame como te salga y lo vamos armando juntos.' },
  'en-US':{ hola:"Hey! I'm here 😄 What are we doing?", gracias:"Anytime. I'm right here.", generico:"Sure, tell me however it comes out. We'll figure it out together." },
  'pt-BR':{ hola:'Oi! Estou aqui 😄 O que vamos fazer?', gracias:'Por nada. Estou por aqui.', generico:'Manda aí do seu jeito. A gente organiza juntos.' },
  'fr-FR':{ hola:'Salut ! Je suis là 😄 On fait quoi ?', gracias:'Avec plaisir. Je suis là.', generico:'Vas-y, raconte-moi comme ça vient. On va clarifier ensemble.' },
  'de-DE':{ hola:'Hey! Ich bin da 😄 Was machen wir?', gracias:'Gern. Ich bin hier.', generico:'Erzähl einfach, wie es kommt. Wir sortieren es gemeinsam.' },
  'it-IT':{ hola:'Ehi! Ci sono 😄 Che facciamo?', gracias:'Volentieri. Sono qui.', generico:'Vai, dimmelo come viene. Lo sistemiamo insieme.' },
  'zh-CN':{ hola:'嗨！我在 😄 今天想做什么？', gracias:'不客气，我在这儿。', generico:'你就自然说吧，我们一起把事情理清。' },
  'ja-JP':{ hola:'やあ！ここにいるよ 😄 今日は何をする？', gracias:'どういたしまして。ここにいるよ。', generico:'そのまま話して。いっしょに整理しよう。' },
};

function localBase(idioma,mensaje,respuestaBase) {
  if (respuestaBase) return respuestaBase;
  const t=String(mensaje||'').toLowerCase().trim();
  const m=LOCAL[idioma] || LOCAL['es-CO'];
  if (/^(hola|buenas|hey|ey|hi|hello|ol[aá]|bonjour|salut|hallo|ciao|你好|こんにちは)/i.test(t)) return m.hola;
  if (/gracias|thanks|obrigad|merci|danke|grazie|谢谢|ありがとう/i.test(t)) return m.gracias;
  return m.generico;
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
  const local=localBase(idioma,mensaje,respuestaBase);
  const apiKey=process.env.OPENAI_API_KEY;
  if (!apiKey) return {respuesta:local,motor:'local-contextual',idioma};

  const instructions=[
    'Eres Yalisto, una sombra digital y agente personal. La persona debe sentir que conversa con alguien ágil, útil y natural, no con un formulario.',
    `Responde en ${IDIOMAS[idioma] || IDIOMAS['es-CO']}, salvo que el usuario pida otro idioma en ese mensaje.`,
    instruccionPersonalidad(preferencias?.personalidad_asistente),
    instruccionEstilo(preferencias?.estilo_respuesta),
    instruccionAnimo(animo),
    'VARÍA las aperturas y el ritmo. No empieces siempre con “Listo”, “Te sigo”, “Entiendo” ni “Cuéntame más”. Evita frases corporativas como “el siguiente paso más útil” salvo que realmente hagan falta.',
    'En conversación cotidiana puedes responder “Dale”, “Sí, mira”, “Uy, eso cambia la cosa”, “De una”, “A ver…” u otras expresiones naturales según el tono y país, pero no uses muletillas en cada respuesta.',
    'Si el usuario ya dio información suficiente, ACTÚA con ella: responde, compara, organiza o usa las acciones disponibles. No pidas contexto innecesario.',
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
    conversacion_reciente:(historial||[]).slice(-16).map(m=>({rol:m.rol,contenido:m.contenido})),
    contexto_personal:compactarResumen(resumen),
    personas_guardadas:(personas||[]).slice(0,25).map(p=>({nombre:p.nombre,apodo:p.apodo,tipo_relacion:p.tipo_relacion||p.relacion,fecha_importante:p.fecha_importante,notas:p.notas})),
    vehiculos_guardados:(vehiculos||[]).slice(0,10).map(v=>({placa:v.placa,marca:v.marca,linea:v.linea,modelo:v.modelo,soat_vence:v.soat_vence,tecnomecanica_vence:v.tecnomecanica_vence})),
    estado_de_hoy_autoreportado:animo?{estado:animo.estado,intensidad:animo.intensidad,energia:animo.energia,ayuda_preferida:animo.ayuda_preferida}:null,
    preferencias:{personalidad:preferencias?.personalidad_asistente,estilo:preferencias?.estilo_respuesta,presencia:preferencias?.presencia_asistente},
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
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions,input,max_output_tokens:520}),
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
