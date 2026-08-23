const express = require('express');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');
const personalizacion = require('../personalizacion');
const { responderConCerebro } = require('../ai/yalistoBrain');
const { esBusquedaPractica, descubrir } = require('../ai/yalistoDiscovery');

const router = express.Router();
const limpiar = (texto='') => String(texto).trim();
const primerNombre = (nombre='') => nombre.trim().split(/\s+/)[0] || '';
const fechaISO = (date) => date.toISOString().slice(0,10);

function detectarFecha(texto) {
  const t=texto.toLowerCase(); const hoy=new Date(); const base=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate());
  if (/\bmañana\b/.test(t)) { const d=new Date(base); d.setDate(d.getDate()+1); return fechaISO(d); }
  if (/\bhoy\b/.test(t)) return fechaISO(base);
  const iso=t.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) { const[,y,m,d]=iso; return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  const dias={domingo:0,lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6};
  for (const [nombre,numero] of Object.entries(dias)) {
    if (t.includes(nombre)) { const d=new Date(base); let delta=(numero-d.getDay()+7)%7; if(delta===0)delta=7; d.setDate(d.getDate()+delta); return fechaISO(d); }
  }
  return null;
}

function detectarPrioridad(texto) {
  const t=texto.toLowerCase();
  if (/urgente|ya mismo|inmediato|hoy sin falta/.test(t)) return 'urgente';
  if (/importante|prioridad|antes de/.test(t)) return 'alta';
  return 'normal';
}

function esPeticionRecordatorio(texto) { return /recu[eé]rdame|recordatorio|av[ií]same|no me dejes olvidar|acu[eé]rdate/.test(texto.toLowerCase()); }
function esConsultaPendientes(texto) { return /qu[eé] tengo pendiente|mis pendientes|qu[eé] sigue|qu[eé] me falta|qu[eé] tengo hoy|qu[eé] tengo esta semana/.test(texto.toLowerCase()); }
function esPromesa(texto) { return /\b(prometo|me promet[ií]|mi meta es|quiero lograr|quiero conseguir|este año voy a|este mes voy a|voy a aprender|voy a empezar|no quiero volver a)\b/i.test(texto); }

function esAccionPersonal(texto) {
  const t=texto.toLowerCase().trim();
  if (esBusquedaPractica(t)) return false;
  if (esPeticionRecordatorio(t) || esPromesa(t)) return true;
  if (/\b(tengo que|debo|me toca|quiero que|quiero hacer|quiero empezar|ay[uú]dame a organizar|agenda|programa|anota|guarda|organiza|prepara|revisa|renueva|paga|cobra|llama|env[ií]a|saca una cita|se vence|vence el)\b/.test(t)) return true;
  if (/^necesito\b/.test(t)) return true;
  if (/^(qu[eé]|c[oó]mo|por qu[eé]|cu[aá]l|qui[eé]n|d[oó]nde|cu[aá]ndo|expl[ií]came|dime qu[eé])\b/.test(t)) return false;
  return false;
}

function respuestaCasualLocal(texto,nombre='') {
  const t=texto.toLowerCase().trim();
  const n=nombre?`${nombre}, `:'';
  if (/^(hola|buenas|hey|ey|holi|qué más|que mas)/.test(t)) return `${n}¡hey! Aquí estoy 😄 ¿Qué hacemos?`;
  if (/cómo estás|como estas/.test(t)) return `${n}bien, pendiente de ti. ¿Qué tienes hoy: algo que resolver, algo que buscar o solo quieres hablar un rato?`;
  if (/tengo hambre|quiero comer|qué como|que como/.test(t)) return `Dale 😄 dime qué te provoca y te ayudo a escoger algo rico sin darle tantas vueltas.`;
  if (/estoy aburrid|me aburr/.test(t)) return `Eso sí lo podemos arreglar 😄. ¿Quieres plan tranquilo, salir, comer algo o hacer algo distinto?`;
  if (/gracias|muchas gracias/.test(t)) return `Con gusto. Aquí sigo por si aparece otra cosa.`;
  if (/no s[eé]|no tengo idea|ni idea/.test(t)) return `Tranqui. Te doy opciones y escogemos sobre la marcha. No tienes que tenerlo claro desde el principio.`;
  return `Dale, te sigo. Cuéntame como te salga; yo voy armando la idea contigo.`;
}

function tituloRecordatorio(texto) {
  return texto.replace(/yalisto[,\s]*/ig,'').replace(/recu[eé]rdame\s*/ig,'').replace(/av[ií]same\s*/ig,'')
    .replace(/\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/ig,'')
    .replace(/\s{2,}/g,' ').trim().replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g,'') || 'Recordatorio';
}

function accionesParaTexto(texto) {
  const t=texto.toLowerCase();
  if (/\bsoat\b/.test(t)) return [
    {etiqueta:'🛡️ Canales oficiales SOAT',url:'https://www.superfinanciera.gov.co/publicaciones/10115146/no-caiga-en-la-trampa-del-soat-falso/',descripcion:'Canales autorizados y prevención de fraude'},
    {etiqueta:'💰 Información oficial SOAT',url:'https://www.superfinanciera.gov.co/publicaciones/10114908/soat/',descripcion:'Información oficial y tarifas'},
  ];
  if (/cita|eps|salud|m[eé]dica/.test(t)) return [{etiqueta:'🏥 Consultar EPS',url:'https://www.minsalud.gov.co/Paginas/Consulta-Afiliados.aspx',descripcion:'Consulta oficial del Ministerio de Salud'}];
  if (/notar[ií]a|cerca|d[oó]nde|ubicaci[oó]n|direcci[oó]n/.test(t)) return [{etiqueta:'📍 Buscar en Maps',url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`,descripcion:'Abrir búsqueda geográfica'}];
  return [];
}

function respuestaPorCategoria(categoria,nombre) {
  const s=nombre?`${nombre}, `:'';
  const m={
    vehiculo:`${s}dale. Lo dejé guardado como una misión de vehículo para que no se pierda.`,
    salud:`${s}dale. Lo guardé para que podamos organizar la gestión, la fecha y lo que haga falta.`,
    hogar:`${s}listo, lo dejé como misión de hogar y seguimos desde ahí.`,
    legal:`${s}lo tengo. Lo guardé como misión legal; cuando quieras revisamos documentos, fechas o el siguiente movimiento.`,
    tecnologia:`${s}dale, lo guardé y lo resolvemos por partes.`,
    compras:`${s}lo tengo. Si lo que quieres es comparar opciones, mejor las buscamos primero y no te lleno Misiones sin necesidad.`,
    general:`${s}dale, ya quedó guardado. ¿Quieres que lo resolvamos ahora o lo dejamos pendiente?`,
  };
  return m[categoria] || m.general;
}

function respuestaPendientesBase(resumen) {
  const p=(resumen.compromisos||[]).filter(c=>!['resuelto','cancelado'].includes(c.estado));
  if (!p.length && !(resumen.recordatorios||[]).length) return 'Hoy estás limpio por acá: no veo misiones ni recordatorios activos.';
  const partes=[];
  if (p.length) partes.push(`Tienes ${p.length} misión${p.length===1?'':'es'} activa${p.length===1?'':'s'}. Primero pondría: ${p.slice(0,3).map(c=>c.titulo).join('; ')}.`);
  if ((resumen.recordatorios||[]).length) partes.push(`También vienen: ${resumen.recordatorios.slice(0,3).map(r=>`${r.titulo} (${r.fecha})`).join('; ')}.`);
  return partes.join(' ');
}

async function contextoCerebro(usuario_id) {
  const [resumen,historial]=await Promise.all([pg.resumenVida(usuario_id),pg.listarMensajes(usuario_id,16)]);
  return {resumen,historial};
}

router.post('/chat', async (req,res) => {
  const {usuario_id,texto}=req.body||{};
  const mensaje=limpiar(texto);
  if (!usuario_id||!mensaje) return res.status(400).json({error:'usuario_id y texto son obligatorios'});
  if (!pg.habilitado) return res.status(503).json({error:'el asistente necesita la base de datos activa'});

  try {
    const usuario=await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({error:'usuario no encontrado'});
    const nombre=primerNombre(usuario.nombre);
    const contextoAntes=await contextoCerebro(usuario_id);

    // Una búsqueda cotidiana no debe convertirse en Misión. Primero busca y conversa.
    if (esBusquedaPractica(mensaje)) {
      await pg.crearMensaje({usuario_id,rol:'user',contenido:mensaje});
      const prefs=await personalizacion.obtenerPreferencias(usuario_id).catch(()=>null);
      const hallazgo=await descubrir({usuario,mensaje,idioma:prefs?.idioma||'es-CO'});
      await pg.crearMensaje({usuario_id,rol:'assistant',contenido:hallazgo.respuesta});
      return res.json({respuesta:hallazgo.respuesta,accion:'busqueda_practica',solicitud:null,compromiso:null,recordatorio:null,acciones:hallazgo.acciones||[],motor:hallazgo.motor});
    }

    const acciones=accionesParaTexto(mensaje);
    if (esConsultaPendientes(mensaje)) {
      await pg.crearMensaje({usuario_id,rol:'user',contenido:mensaje});
      const respuestaBase=respuestaPendientesBase(contextoAntes.resumen);
      const cerebro=await responderConCerebro({usuario,mensaje,historial:contextoAntes.historial,resumen:contextoAntes.resumen,respuestaBase,hechos:{tipo:'consulta_pendientes',datosConsultados:true},acciones});
      await pg.crearMensaje({usuario_id,rol:'assistant',contenido:cerebro.respuesta});
      return res.json({respuesta:cerebro.respuesta,accion:'consulta',solicitud:null,compromiso:null,recordatorio:null,acciones,motor:cerebro.motor});
    }

    if (!esAccionPersonal(mensaje)) {
      await pg.crearMensaje({usuario_id,rol:'user',contenido:mensaje});
      const cerebro=await responderConCerebro({
        usuario,mensaje,historial:contextoAntes.historial,resumen:contextoAntes.resumen,
        respuestaBase:respuestaCasualLocal(mensaje,nombre),
        hechos:{tipo:'conversacion',compromisoCreado:false,nadaEjecutadoFueraDeLaApp:true,tono:'casual'},acciones,
      });
      await pg.crearMensaje({usuario_id,rol:'assistant',contenido:cerebro.respuesta});
      return res.json({respuesta:cerebro.respuesta,accion:'conversacion',solicitud:null,compromiso:null,recordatorio:null,acciones,motor:cerebro.motor});
    }

    const {categoria,icono}=clasificar(mensaje);
    const fecha=detectarFecha(mensaje);
    const prioridad=detectarPrioridad(mensaje);
    const titulo=mensaje.length>72?`${mensaje.slice(0,69)}...`:mensaje;
    const tipoCompromiso=esPromesa(mensaje)?'promesa':'mision';
    const solicitud=await pg.crearSolicitud({usuario_id,texto:mensaje,categoria,icono,titulo,prioridad});
    const compromiso=await pg.crearCompromiso({
      usuario_id,titulo,descripcion:mensaje,categoria:tipoCompromiso==='promesa'?'meta':categoria,
      prioridad,fecha_limite:fecha?`${fecha}T09:00:00-05:00`:null,solicitud_id:solicitud.id,
      metadata:{origen:'chat'},tipo_compromiso:tipoCompromiso,
    });
    await pg.crearMensaje({usuario_id,solicitud_id:solicitud.id,rol:'user',contenido:mensaje});

    let recordatorio=null; let respuestaBase;
    if (esPeticionRecordatorio(mensaje)) {
      if (fecha) {
        recordatorio=await pg.crearRecordatorio({usuario_id,titulo:tituloRecordatorio(mensaje),fecha,icono:'🔔',compromiso_id:compromiso.id,metadata:{origen:'chat'}});
        respuestaBase=`${nombre?`${nombre}, `:''}dale, ya quedó. Te lo voy a recordar el ${fecha}.`;
      } else respuestaBase=`${nombre?`${nombre}, `:''}lo guardé. Solo me falta saber cuándo quieres que te lo recuerde.`;
    } else if (tipoCompromiso==='promesa') {
      respuestaBase=`${nombre?`${nombre}, `:''}me la quedo como una promesa personal, no como una tarea cualquiera. Podemos volver a ella y ver si sigue siendo importante para ti.`;
    } else if (/\bsoat\b/i.test(mensaje)) {
      respuestaBase=`${nombre?`${nombre}, `:''}dale, lo guardé como misión de vehículo y te dejé los canales oficiales para seguir.`;
    } else respuestaBase=respuestaPorCategoria(categoria,nombre);

    await pg.actualizarRespuestaSolicitud(solicitud.id,respuestaBase);
    const contextoDespues=await contextoCerebro(usuario_id);
    const cerebro=await responderConCerebro({
      usuario,mensaje,historial:contextoAntes.historial,resumen:contextoDespues.resumen,respuestaBase,
      hechos:{tipo:'gestion_personal',compromisoCreado:true,compromisoId:compromiso.id,tipoCompromiso,categoria,prioridad,fechaDetectada:fecha,recordatorioCreado:Boolean(recordatorio),recordatorioFecha:recordatorio?.fecha||null,accionesDisponibles:acciones.length,nadaPagadoNiEnviadoAutomaticamente:true},acciones,
    });
    await pg.actualizarRespuestaSolicitud(solicitud.id,cerebro.respuesta);
    await pg.crearMensaje({usuario_id,solicitud_id:solicitud.id,rol:'assistant',contenido:cerebro.respuesta});
    res.status(201).json({respuesta:cerebro.respuesta,accion:recordatorio?'recordatorio_creado':tipoCompromiso==='promesa'?'promesa_creada':'compromiso_creado',solicitud,compromiso,recordatorio,acciones,motor:cerebro.motor});
  } catch(err) {
    console.error(err);
    res.status(500).json({error:'Yalisto no pudo procesar la solicitud'});
  }
});

router.get('/mensajes', async(req,res) => {
  const {usuario_id}=req.query;
  if(!usuario_id)return res.status(400).json({error:'usuario_id es obligatorio'});
  try {
    if(!pg.habilitado)return res.json({mensajes:[]});
    res.json({mensajes:await pg.listarMensajes(usuario_id,100)});
  } catch(err) {
    console.error(err);
    res.status(500).json({error:'no se pudo cargar la conversación'});
  }
});

module.exports=router;
