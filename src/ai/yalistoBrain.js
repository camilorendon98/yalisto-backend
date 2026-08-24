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
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (c?.type === 'output_text' && c?.text) partes.push(c.text);
    }
  }
  return partes.join('\n').trim();
}

function normalizar(t='') {
  return String(t||'').toLowerCase().replace(/[^a-záéíóúñ0-9 ]/gi,' ').replace(/\s+/g,' ').trim();
}

function ultimos(historial=[], rol, n=4) {
  return historial.filter(m=>m?.rol===rol && String(m?.contenido||'').trim()).slice(-n).map(m=>String(m.contenido).trim());
}

function ultimoDistinto(historial=[], rol, actual='') {
  const objetivo=normalizar(actual);
  const arr=ultimos(historial, rol, 12);
  for (let i=arr.length-1;i>=0;i--) if (normalizar(arr[i])!==objetivo) return arr[i];
  return '';
}

function activos(resumen={}) {
  return (resumen.compromisos||[]).filter(c=>!['resuelto','cancelado'].includes(c.estado));
}

function temaReciente(historial=[]) {
  return ultimos(historial,'user',6).join(' · ');
}

function localConversacional({nombre='', mensaje, historial=[], resumen={}, respuestaBase='', hechos={}}) {
  if (respuestaBase && hechos?.tipo !== 'conversacion') return respuestaBase;
  const t=normalizar(mensaje);
  const anterior=normalizar(ultimoDistinto(historial,'user',mensaje));
  const ultAsistente=normalizar(ultimoDistinto(historial,'assistant',''));
  const pendientes=activos(resumen);
  const n=nombre?`${nombre}, `:'';

  if (/^(hola|buenas|hey|ey|que mas|qué más)/.test(t)) {
    const opciones=['¡Hey! 😄 Aquí estoy. ¿Qué hacemos?','Hola 😄. Aquí estoy, cuéntame.','Ey, llegué. ¿Qué tienes hoy?'];
    return opciones.find(x=>!ultAsistente.includes(normalizar(x).slice(0,15))) || opciones[0];
  }
  if (/como estas|cómo estás/.test(t)) return `${n}bien 😄, aquí pendiente de ti. ¿Qué hacemos ahora?`;
  if (/gracias|muchas gracias/.test(t)) return 'Con gusto. Aquí sigo.';

  if (/lo que tu me digas|lo que tú me digas|decide tu|decide tú|hazlo tu|hazlo tú|toma la batuta|como quieras|sigue por ahi|sigue por ahí|dale sigue/.test(t)) {
    if (pendientes.length) {
      const primero=pendientes[0]?.titulo;
      const segundo=pendientes[1]?.titulo;
      return `${n}entonces decido yo. Empezaría por “${primero}”${segundo?` y dejaría “${segundo}” de segundo`:''}. Primero te lo aterrizo en pasos y avanzamos desde ahí.`;
    }
    if (/semana|organiza|agenda|pendiente/.test(anterior)) return 'Entonces tomo la batuta: primero lo que tiene hora o vencimiento, luego una prioridad fuerte y después dejo espacio real. Nada de llenar la semana por llenar.';
    if (/comer|hamburgues|pizza|sushi|restaurante/.test(anterior)) return 'De una, escojo yo 😄. Me quedaría con la opción más cercana que tenga buena relación precio/antojo y te dejaría una segunda por si quieres variar.';
    return 'Entonces escojo yo con lo que ya tenemos. Voy por una sola cosa concreta primero y después seguimos, sin abrir cinco frentes.';
  }

  if (/^(si|sí|dale|aja|ajá|bueno|ok|okay|va|de una)$/.test(t)) {
    if (/semana|organiza|agenda|pendiente/.test(anterior)) return 'Bien. Arranco por lo fijo y después acomodo una prioridad importante. Te lo voy dejando realista, no perfecto en papel e imposible de cumplir.';
    if (/comer|hamburgues|pizza|sushi|restaurante/.test(anterior)) return 'Perfecto. Te reduzco eso a pocas opciones buenas y luego te digo cuál escogería yo.';
    return 'Va. Sigo desde ahí y avanzo la idea; no te voy a devolver la misma pregunta.';
  }

  if (/que harias tu|qué harías tú|en mi lugar|que opinas|qué opinas/.test(t)) {
    if (pendientes.length) return `Yo empezaría por “${pendientes[0].titulo}”. Es la que pondría al frente con lo que tengo registrado; después revisamos la siguiente.`;
    return 'Yo elegiría lo que te quite más fricción ahora sin crearte un problema nuevo después. Si ya me diste las opciones, me mojo y te digo una.';
  }

  if (/y luego|que sigue|qué sigue|despues que|después qué/.test(t)) {
    if (pendientes.length>1) return `Después pasaría a “${pendientes[1].titulo}”. Prefiero terminar de encaminar una cosa antes de saltar a otra.`;
    return 'Después seguimos con el siguiente punto, pero solo cuando este ya esté encaminado. Así la conversación sí avanza.';
  }

  if (/por que|por qué/.test(t) && anterior) return `Porque estoy tomando en cuenta lo que veníamos hablando: “${ultimoDistinto(historial,'user',mensaje)}”. Si cambia esa parte, también cambia mi recomendación.`;

  if (/estoy (cansad|estresad|triste|preocupad|abrumad|molest)/.test(t)) return 'Te entiendo. No te voy a llenar de consejos: bajemos esto a una sola cosa que puedas controlar ahora y desde ahí vemos lo demás.';
  if (/no se|no sé|ni idea/.test(t)) return 'No pasa nada. Yo te pongo dos o tres caminos claros y escogemos sobre la marcha; no necesitas tenerlo resuelto para empezar.';
  if (/organizar.*semana|organiza.*semana|semana.*organizar/.test(t)) return 'Yo la armaría con tres capas: lo fijo, una prioridad fuerte y espacio libre. Luego uso tus pendientes para escoger qué entra en cada una.';

  const contexto=temaReciente(historial);
  const opciones=[
    contexto ? 'Sí, ya tengo el hilo. Voy a responder sobre lo que venimos hablando, no desde cero.' : 'Dale. Suelta la idea como te salga y yo la voy aterrizando.',
    'Va. Con lo que ya me dijiste puedo avanzar; solo te pregunto algo si realmente cambia la respuesta.',
    'Sí, vamos por ahí. Yo conecto lo anterior y te propongo algo concreto, sin hacerte repetir todo.',
    'Entendido. Me quedo en este tema y lo vamos moviendo hasta que quede claro o resuelto.'
  ];
  return opciones.find(x=>!ultAsistente.includes(normalizar(x).slice(0,18))) || opciones[0];
}

function compactarResumen(resumen={}) {
  return {
    compromisos:(resumen.compromisos||[]).slice(0,12).map(x=>({titulo:x.titulo,estado:x.estado,prioridad:x.prioridad,fecha_limite:x.fecha_limite,categoria:x.categoria,tipo:x.tipo_compromiso})),
    recordatorios:(resumen.recordatorios||[]).slice(0,10).map(x=>({titulo:x.titulo,fecha:x.fecha,hora:x.hora})),
    memoria:(resumen.memoria||[]).slice(0,14).map(x=>({tipo:x.tipo,titulo:x.titulo,valor:x.valor})),
    acciones:(resumen.acciones||[]).slice(0,8).map(x=>({tipo:x.tipo,estado:x.estado,descripcion:x.descripcion})),
  };
}

function instruccionPersonalidad(codigo) {
  const mapa={
    amigo:'Habla como un amigo útil: cercano, relajado y espontáneo. Usa expresiones naturales solo cuando salgan bien; no conviertas “dale” o “de una” en muletillas.',
    consejero:'Sé cercano y agudo. Entiende primero, luego da criterio propio claro sin sonar solemne.',
    entrenador:'Sé dinámico. Ayuda a avanzar con una acción concreta y evita discursos motivacionales vacíos.',
    ejecutivo:'Ve al punto, ordena y decide. Mantén calidez humana.',
    acompanante:'Sé cálido y paciente, sin sonar terapéutico ni paternalista.',
    directo:'Habla claro, sin rodeos y sin agresividad.',
  };
  return mapa[codigo] || mapa.consejero;
}

function instruccionEstilo(codigo) {
  const mapa={
    breve:'Normalmente 1 a 3 frases, pero no sacrifiques una respuesta útil por ser corto.',
    conversacional:'Habla como una conversación real: mezcla afirmaciones, propuestas y preguntas solo cuando hagan falta.',
    ejecutivo:'Usa frases compactas, prioridades y decisiones claras.',
    creativo:'Sé fresco y variado; humor ligero cuando encaje, nunca forzado.',
    equilibrado:'Sé natural y práctico; 2 a 5 frases por defecto.',
  };
  return mapa[codigo] || mapa.equilibrado;
}

function instruccionAnimo(animo) {
  if (!animo) return '';
  const mapa={
    motivado:'El usuario reportó motivación: aprovecha la energía y propón avance.',
    cansado:'El usuario reportó cansancio: reduce carga y número de opciones.',
    estresado:'El usuario reportó estrés: simplifica y ordena sin dramatizar.',
    preocupado:'El usuario reportó preocupación: separa lo controlable y propone una acción.',
    triste:'El usuario reportó tristeza: sé cálido y práctico; no diagnostiques.',
    molesto:'El usuario reportó molestia: sé claro y calmado.',
    abrumado:'El usuario reportó sentirse abrumado: una cosa a la vez.',
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
  const local=localConversacional({nombre,mensaje,historial,resumen,respuestaBase,hechos});
  const apiKey=process.env.OPENAI_API_KEY;
  if (!apiKey) return {respuesta:local,motor:'local-contextual-v11',idioma};

  const instructions=[
    'Eres Yalisto, una sombra digital y agente personal. Tu conversación debe sentirse viva, humana, continua y útil.',
    `Responde en ${IDIOMAS[idioma] || IDIOMAS['es-CO']}, salvo petición explícita de otro idioma.`,
    instruccionPersonalidad(preferencias?.personalidad_asistente),
    instruccionEstilo(preferencias?.estilo_respuesta),
    instruccionAnimo(animo),
    preferencias?.modo_descanso ? 'Yalisto está en modo descanso: no hagas intervenciones proactivas, pero responde normalmente si el usuario te habla.' : '',
    'REGLA PRINCIPAL DE DIÁLOGO: cada turno debe mover la conversación hacia adelante. No repitas la misma invitación a hablar, no reinicies el tema y no cierres cada respuesta con una pregunta.',
    'Resuelve referencias implícitas usando los turnos anteriores: “sí”, “eso”, “sigue”, “lo que tú digas”, “él”, “ella”, “esa opción”, “y luego”, “por qué” pertenecen al contexto inmediatamente anterior.',
    'Si el usuario delega una decisión, toma una decisión razonable con lo que ya sabes. No le devuelvas la decisión salvo que falte un dato que cambie materialmente el resultado.',
    'No pidas contexto por costumbre. Pide un dato solo si es indispensable. Si puedes dar una respuesta parcial útil, hazlo primero.',
    'Alterna actos conversacionales: responder, opinar, proponer, resumir, comparar, decidir, recordar, buscar o ejecutar lo autorizado. No uses siempre la misma estructura.',
    'Evita frases de asistente corporativo: “¿en qué puedo ayudarte?”, “dame más contexto”, “el siguiente paso más útil”, salvo que sean realmente necesarias.',
    'En español colombiano puedes usar expresiones casuales como “dale”, “mira”, “de una”, “va”, pero como una persona real: ocasionalmente y no al comienzo de cada respuesta.',
    'No conviertas charla, comida, recomendaciones o curiosidad en Misiones salvo que el usuario pida guardar, agendar, recordar o hacer seguimiento.',
    'Nunca afirmes que pagaste, llamaste, enviaste, compraste, reservaste o ejecutaste algo externo si los HECHOS no lo confirman.',
    'Usa Memoria, Personas, Vehículos, Misiones y Agenda solo con datos presentes. No inventes relaciones ni recuerdos.',
    'Si la respuesta anterior del asistente fue parecida a la que estás por dar, CAMBIA de movimiento: da una conclusión, una opción concreta o avanza un paso.',
    'No muestres cadena de pensamiento. Da criterio, conclusión y razones breves cuando sirvan.',
  ].filter(Boolean).join('\n');

  const input=JSON.stringify({
    usuario:{nombre:usuario?.nombre||null,ciudad:usuario?.ciudad||null},
    mensaje_actual:mensaje,
    conversacion_reciente:(historial||[]).slice(-24).map(m=>({rol:m.rol,contenido:m.contenido})),
    contexto_personal:compactarResumen(resumen),
    personas_guardadas:(personas||[]).slice(0,30).map(p=>({nombre:p.nombre,apodo:p.apodo,tipo_relacion:p.tipo_relacion||p.relacion,fecha_importante:p.fecha_importante,notas:p.notas})),
    vehiculos_guardados:(vehiculos||[]).slice(0,12).map(v=>({placa:v.placa,marca:v.marca,linea:v.linea,modelo:v.modelo,soat_vence:v.soat_vence,tecnomecanica_vence:v.tecnomecanica_vence})),
    estado_de_hoy_autoreportado:animo?{estado:animo.estado,intensidad:animo.intensidad,energia:animo.energia,ayuda_preferida:animo.ayuda_preferida}:null,
    preferencias:{personalidad:preferencias?.personalidad_asistente,estilo:preferencias?.estilo_respuesta,presencia:preferencias?.presencia_asistente},
    hechos_confirmados_por_backend:hechos,
    respuesta_base_segura:respuestaBase,
    acciones_disponibles:acciones,
  });

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),16000);
  try {
    const res=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions,input,max_output_tokens:650}),
      signal:controller.signal,
    });
    if (!res.ok) {
      const detalle=await res.text().catch(()=>'');
      console.error('OpenAI Yalisto Brain:',res.status,detalle.slice(0,500));
      return {respuesta:local,motor:'local-contextual-v11',idioma};
    }
    const data=await res.json();
    const respuesta=textoSalida(data);
    return {respuesta:respuesta||local,motor:respuesta?'openai':'local-contextual-v11',modelo:process.env.OPENAI_MODEL||'gpt-5.6-luna',idioma};
  } catch(err) {
    console.error('Yalisto Brain fallback:',err?.message||err);
    return {respuesta:local,motor:'local-contextual-v11',idioma};
  } finally {
    clearTimeout(timer);
  }
}

module.exports={responderConCerebro};
