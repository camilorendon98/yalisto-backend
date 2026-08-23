const API_URL = 'https://api.openai.com/v1/responses';
const personalizacion = require('../personalizacion');
const pg = require('../db-postgres');

const IDIOMAS = {
  'es-CO': 'español',
  'en-US': 'English',
  'pt-BR': 'português',
  'fr-FR': 'français',
  'de-DE': 'Deutsch',
  'it-IT': 'italiano',
  'zh-CN': '简体中文',
  'ja-JP': '日本語',
};

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

function frase(idioma, clave, nombre = '') {
  const n = nombre ? `${nombre}, ` : '';
  const base = {
    'es-CO': {
      hola: `${n}aquí estoy. Dime qué tienes en la cabeza y lo aterrizamos: recordar, organizar, buscar o resolver.`,
      gracias: `${n}con gusto. Me quedo con el contexto para que no tengamos que empezar de cero.`,
      puede: `${n}puedo recordar compromisos, ordenar fechas, guardar contexto, ubicar documentos, proponerte opciones y acompañar una gestión hasta que quede resuelta.`,
      pendiente: `${n}ya revisé tus pendientes y te los puedo priorizar contigo.`,
      recordatorio: `${n}ya quedó. Guardé el compromiso y activé el recordatorio.`,
      compromiso: `${n}ya quedó guardado como compromiso. Ahora lo importante es convertirlo en un siguiente paso útil.`,
      generico: `${n}te sigo. Cuéntame un poco más y te propongo el siguiente paso más útil.`,
    },
    'en-US': {
      hola: `${n}I'm here. Tell me what's on your mind and we'll turn it into something manageable: remember it, organize it, find options, or solve it.`,
      gracias: `${n}you're welcome. I'll keep the context so we don't have to start from scratch next time.`,
      puede: `${n}I can remember commitments, organize dates, keep context, locate documents, suggest options, and help carry a task through to completion.`,
      pendiente: `${n}I've reviewed your pending items and can help you prioritize them.`,
      recordatorio: `${n}done. I saved the commitment and activated the reminder.`,
      compromiso: `${n}it's saved as a commitment. Now let's turn it into a useful next step.`,
      generico: `${n}I'm with you. Give me a little more context and I'll suggest the most useful next step.`,
    },
    'pt-BR': {
      hola: `${n}estou aqui. Me diga o que está na sua cabeça e vamos transformar isso em algo administrável: lembrar, organizar, buscar ou resolver.`,
      gracias: `${n}por nada. Vou manter o contexto para não precisarmos começar do zero depois.`,
      puede: `${n}posso lembrar compromissos, organizar datas, guardar contexto, localizar documentos, sugerir opções e acompanhar uma tarefa até a conclusão.`,
      pendiente: `${n}revisei suas pendências e posso ajudar a priorizá-las.`,
      recordatorio: `${n}pronto. Salvei o compromisso e ativei o lembrete.`,
      compromiso: `${n}ficou salvo como compromisso. Agora vamos transformar isso no próximo passo mais útil.`,
      generico: `${n}estou acompanhando. Me dê um pouco mais de contexto e proponho o próximo passo mais útil.`,
    },
    'fr-FR': {
      hola: `${n}je suis là. Dis-moi ce que tu as en tête et on va le rendre gérable : mémoriser, organiser, chercher ou résoudre.`,
      gracias: `${n}avec plaisir. Je garde le contexte pour éviter de recommencer à zéro.`,
      puede: `${n}je peux mémoriser des engagements, organiser des dates, conserver le contexte, retrouver des documents, proposer des options et suivre une tâche jusqu'à sa résolution.`,
      pendiente: `${n}j'ai vérifié tes éléments en attente et je peux t'aider à les prioriser.`,
      recordatorio: `${n}c'est fait. J'ai enregistré l'engagement et activé le rappel.`,
      compromiso: `${n}c'est enregistré comme engagement. Transformons-le maintenant en prochaine étape utile.`,
      generico: `${n}je te suis. Donne-moi un peu plus de contexte et je te propose la prochaine étape la plus utile.`,
    },
    'de-DE': {
      hola: `${n}ich bin da. Sag mir, was dir im Kopf herumgeht, und wir machen daraus etwas Überschaubares: merken, organisieren, suchen oder lösen.`,
      gracias: `${n}gern. Ich behalte den Kontext, damit wir später nicht wieder bei null anfangen.`,
      puede: `${n}ich kann Verpflichtungen merken, Termine ordnen, Kontext speichern, Dokumente auffinden, Optionen vorschlagen und Aufgaben bis zur Erledigung begleiten.`,
      pendiente: `${n}ich habe deine offenen Punkte geprüft und kann sie mit dir priorisieren.`,
      recordatorio: `${n}erledigt. Ich habe die Verpflichtung gespeichert und die Erinnerung aktiviert.`,
      compromiso: `${n}es ist als Verpflichtung gespeichert. Jetzt machen wir daraus den sinnvollsten nächsten Schritt.`,
      generico: `${n}ich bin dran. Gib mir etwas mehr Kontext und ich schlage dir den sinnvollsten nächsten Schritt vor.`,
    },
    'it-IT': {
      hola: `${n}ci sono. Dimmi cosa hai in mente e lo trasformiamo in qualcosa di gestibile: ricordare, organizzare, cercare o risolvere.`,
      gracias: `${n}volentieri. Terrò il contesto così non dovremo ricominciare da zero.`,
      puede: `${n}posso ricordare impegni, organizzare date, conservare il contesto, trovare documenti, proporti opzioni e seguire un'attività fino alla soluzione.`,
      pendiente: `${n}ho controllato le tue cose in sospeso e posso aiutarti a stabilire le priorità.`,
      recordatorio: `${n}fatto. Ho salvato l'impegno e attivato il promemoria.`,
      compromiso: `${n}è salvato come impegno. Ora trasformiamolo nel prossimo passo più utile.`,
      generico: `${n}ti seguo. Dammi un po' più di contesto e ti propongo il prossimo passo più utile.`,
    },
    'zh-CN': {
      hola: `${n}我在。告诉我你现在在想什么，我们把它变成可处理的事情：记住、整理、查找或解决。`,
      gracias: `${n}不客气。我会保留上下文，下次不用从头开始。`,
      puede: `${n}我可以记住待办、整理日期、保存上下文、查找文件、提供选项，并陪你把事情推进到完成。`,
      pendiente: `${n}我已经查看了你的待办，可以帮你一起确定优先级。`,
      recordatorio: `${n}好了。我已经保存事项并启用了提醒。`,
      compromiso: `${n}已经保存为待办。现在我们把它变成最有用的下一步。`,
      generico: `${n}我跟上了。再给我一点背景，我会建议最有用的下一步。`,
    },
    'ja-JP': {
      hola: `${n}ここにいます。今考えていることを教えてください。覚える・整理する・探す・解決する、のどれかに落とし込みます。`,
      gracias: `${n}どういたしまして。次回ゼロから始めなくていいように、文脈を覚えておきます。`,
      puede: `${n}予定や約束を覚え、日付を整理し、文脈を保持し、書類を探し、選択肢を提案し、完了まで支援できます。`,
      pendiente: `${n}未完了の項目を確認しました。優先順位づけを一緒にできます。`,
      recordatorio: `${n}完了です。予定を保存してリマインダーを有効にしました。`,
      compromiso: `${n}予定として保存しました。次に一番役立つ一歩へ進めましょう。`,
      generico: `${n}わかりました。もう少し背景を教えてくれれば、最も役立つ次の一歩を提案します。`,
    },
  };
  return (base[idioma] || base['es-CO'])[clave] || base['es-CO'][clave];
}

function matizAnimo(animo) {
  if (!animo) return '';
  const mapa = {
    tranquilo: 'Mantén un tono sereno y eficiente.',
    bien: 'Mantén un tono positivo y natural.',
    motivado: 'Aprovecha la energía: propone un siguiente paso concreto y breve.',
    cansado: 'Reduce carga mental: ofrece pocas opciones y pasos pequeños.',
    estresado: 'Sé calmado, ordena prioridades y evita abrumar con demasiadas tareas.',
    preocupado: 'Aclara qué sí puede controlar hoy y cuál es el primer paso útil.',
    triste: 'Sé cálido y respetuoso; ofrece apoyo práctico sin diagnosticar ni convertirte en terapeuta.',
    molesto: 'Sé claro, breve y orientado a resolver; evita sonar condescendiente.',
    abrumado: 'Prioriza una sola cosa a la vez y ofrece simplificar o posponer lo no urgente.',
    otro: 'Adapta el tono a la nota y a la ayuda que el usuario pidió.',
  };
  return mapa[animo.estado] || '';
}

function respuestaLocal({ nombre, mensaje, respuestaBase, hechos = {}, animo = null, idioma = 'es-CO' }) {
  const t = String(mensaje || '').toLowerCase();
  let respuesta;
  if (/^(hola|buenas|hey|hello|hi|olá|ola|bonjour|salut|hallo|ciao|你好|こんにちは|qué más|que mas|cómo estás|como estas)/i.test(t)) respuesta = frase(idioma, 'hola', nombre);
  else if (/gracias|thanks|thank you|obrigad|merci|danke|grazie|谢谢|ありがとう|perfecto|listo$/i.test(t)) respuesta = frase(idioma, 'gracias', nombre);
  else if (/qué puedes hacer|que puedes hacer|what can you do|o que você pode fazer|que peux-tu faire|was kannst du|cosa puoi fare|你能做什么|何ができる/i.test(t)) respuesta = frase(idioma, 'puede', nombre);
  else if (hechos?.tipo === 'consulta_pendientes') respuesta = respuestaBase || frase(idioma, 'pendiente', nombre);
  else if (hechos?.recordatorioCreado) respuesta = frase(idioma, 'recordatorio', nombre);
  else if (hechos?.compromisoCreado) respuesta = respuestaBase || frase(idioma, 'compromiso', nombre);
  else respuesta = respuestaBase || frase(idioma, 'generico', nombre);

  if (animo && ['cansado','estresado','abrumado'].includes(animo.estado) && idioma === 'es-CO') {
    respuesta += ' Vamos por una sola cosa a la vez.';
  }
  return respuesta;
}

function compactarResumen(resumen = {}) {
  return {
    compromisos: (resumen.compromisos || []).slice(0, 8).map((x) => ({ titulo: x.titulo, estado: x.estado, prioridad: x.prioridad, fecha_limite: x.fecha_limite, categoria: x.categoria })),
    recordatorios: (resumen.recordatorios || []).slice(0, 8).map((x) => ({ titulo: x.titulo, fecha: x.fecha, hora: x.hora })),
    memoria: (resumen.memoria || []).slice(0, 10).map((x) => ({ tipo: x.tipo, titulo: x.titulo, valor: x.valor })),
    acciones: (resumen.acciones || []).slice(0, 8).map((x) => ({ tipo: x.tipo, estado: x.estado, descripcion: x.descripcion })),
  };
}

async function responderConCerebro({ usuario, mensaje, historial = [], resumen = {}, respuestaBase = '', hechos = {}, acciones = [] }) {
  const nombre = usuario?.nombre?.trim()?.split(/\s+/)[0] || '';
  const [animo, preferencias, personas, vehiculos] = await Promise.all([
    usuario?.id ? personalizacion.obtenerEstadoAnimoHoy(usuario.id).catch(() => null) : null,
    usuario?.id ? personalizacion.obtenerPreferencias(usuario.id).catch(() => null) : null,
    usuario?.id ? pg.listarPersonas(usuario.id).catch(() => []) : [],
    usuario?.id ? pg.listarVehiculos(usuario.id).catch(() => []) : [],
  ]);
  const idioma = preferencias?.idioma || 'es-CO';

  const local = respuestaLocal({ nombre, mensaje, respuestaBase, hechos, animo, idioma });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { respuesta: local, motor: 'local-contextual', idioma };

  const modelo = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const contexto = compactarResumen(resumen);
  const conversacion = (historial || []).slice(-12).map((m) => ({ rol: m.rol, contenido: m.contenido }));
  const idiomaNombre = IDIOMAS[idioma] || IDIOMAS['es-CO'];

  const instructions = [
    'Eres Yalisto, un agente personal de vida.',
    `Responde SIEMPRE en ${idiomaNombre}, salvo que el usuario te pida expresamente otro idioma en ese mensaje.`,
    'Tu identidad no es la de un chatbot genérico: eres una sombra digital útil, cercana, aguda y proactiva.',
    'Habla natural, con personalidad y criterio. Sé breve por defecto: 2 a 5 frases, salvo que el usuario pida detalle.',
    'No seas robótico ni repitas siempre “listo”. Puedes usar humor ligero cuando encaje, sin exagerar emojis.',
    'Tu trabajo es convertir contexto en el siguiente paso útil: recordar, organizar, anticipar y ayudar a ejecutar.',
    'Nunca afirmes que pagaste, llamaste, enviaste, compraste, reservaste o ejecutaste algo si los HECHOS no dicen que ocurrió.',
    'Distingue claramente entre lo que ya quedó guardado, lo que propones y lo que requiere autorización del usuario.',
    'Usa la memoria, las personas guardadas, sus relaciones y los pendientes entregados; no inventes vínculos ni datos personales ausentes.',
    'Si el usuario dice “mi mamá”, “mi pareja”, “mi cliente” o una relación similar, usa PERSONAS_GUARDADAS solo si existe una coincidencia clara.',
    'Si la conversación es casual, conversa con naturalidad y no fuerces una misión.',
    'Si falta un dato indispensable, pide solo el dato mínimo necesario.',
    'Cuando haya enlaces/acciones disponibles, puedes mencionarlos como opciones, pero no inventes URLs.',
    'El estado de ánimo es AUTOREPORTADO y solo sirve para adaptar tono, carga y tipo de ayuda; no hagas diagnósticos.',
    'Si el usuario está cansado, estresado, preocupado o abrumado, reduce carga cognitiva y prioriza uno o dos pasos prácticos.',
    'Si está triste o molesto, sé respetuoso y útil; no prometas curar emociones ni sustituyas apoyo profesional.',
    'Si aparece una señal explícita de peligro inmediato o autolesión, prioriza seguridad y sugiere ayuda humana inmediata.',
    matizAnimo(animo),
  ].filter(Boolean).join('\n');

  const input = JSON.stringify({
    usuario: { nombre: usuario?.nombre || null, ciudad: usuario?.ciudad || null },
    idioma_configurado: idioma,
    mensaje_actual: mensaje,
    conversacion_reciente: conversacion,
    contexto_personal: contexto,
    personas_guardadas: (personas || []).slice(0, 25).map((p) => ({
      nombre:p.nombre,
      apodo:p.apodo,
      tipo_relacion:p.tipo_relacion || p.relacion,
      contacto_emergencia:p.es_contacto_emergencia,
      favorito:p.favorito,
      fecha_importante:p.fecha_importante,
      fecha_nacimiento:p.fecha_nacimiento,
      notas:p.notas,
    })),
    vehiculos_guardados: (vehiculos || []).slice(0, 10).map((v) => ({ placa:v.placa, marca:v.marca, linea:v.linea, modelo:v.modelo, soat_vence:v.soat_vence, tecnomecanica_vence:v.tecnomecanica_vence })),
    estado_de_hoy_autoreportado: animo ? { estado: animo.estado, intensidad: animo.intensidad, energia: animo.energia, nota: animo.nota, ayuda_preferida: animo.ayuda_preferida } : null,
    preferencias_de_interfaz_y_estilo: preferencias ? { interfaz: preferencias.interfaz, estilo_respuesta: preferencias.estilo_respuesta, chat_fondo: preferencias.chat_fondo } : null,
    hechos_confirmados_por_backend: hechos,
    respuesta_base_segura: respuestaBase,
    acciones_disponibles: acciones,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelo, instructions, input, max_output_tokens: 420 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('OpenAI Yalisto Brain:', res.status, detalle.slice(0, 500));
      return { respuesta: local, motor: 'local-contextual', idioma };
    }
    const data = await res.json();
    const respuesta = textoSalida(data);
    if (!respuesta) return { respuesta: local, motor: 'local-contextual', idioma };
    return { respuesta, motor: 'openai', modelo, idioma };
  } catch (err) {
    console.error('Yalisto Brain fallback:', err?.message || err);
    return { respuesta: local, motor: 'local-contextual', idioma };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { responderConCerebro };
