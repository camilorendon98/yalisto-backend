const express = require('express');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');
const { responderConCerebro } = require('../ai/yalistoBrain');

const router = express.Router();

function limpiar(texto = '') { return String(texto).trim(); }
function primerNombre(nombre = '') { return nombre.trim().split(/\s+/)[0] || ''; }
function fechaISO(date) { return date.toISOString().slice(0, 10); }

function detectarFecha(texto) {
  const t = texto.toLowerCase();
  const hoy = new Date();
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (/\bmañana\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 1); return fechaISO(d); }
  if (/\bhoy\b/.test(t)) return fechaISO(base);
  const matchIso = t.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (matchIso) {
    const [, y, m, d] = matchIso;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const dias = { domingo:0, lunes:1, martes:2, miercoles:3, miércoles:3, jueves:4, viernes:5, sabado:6, sábado:6 };
  for (const [nombre, numero] of Object.entries(dias)) {
    if (t.includes(nombre)) {
      const d = new Date(base);
      let delta = (numero - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      d.setDate(d.getDate() + delta);
      return fechaISO(d);
    }
  }
  return null;
}

function detectarPrioridad(texto) {
  const t = texto.toLowerCase();
  if (/urgente|ya mismo|inmediato|hoy sin falta/.test(t)) return 'urgente';
  if (/importante|prioridad|antes de/.test(t)) return 'alta';
  return 'normal';
}

function esPeticionRecordatorio(texto) {
  return /recu[eé]rdame|recordatorio|av[ií]same|no me dejes olvidar|acu[eé]rdate/.test(texto.toLowerCase());
}

function esConsultaPendientes(texto) {
  return /qu[eé] tengo pendiente|mis pendientes|qu[eé] sigue|qu[eé] me falta|qu[eé] tengo hoy|qu[eé] tengo esta semana/.test(texto.toLowerCase());
}

function esAccionPersonal(texto) {
  const t = texto.toLowerCase().trim();
  if (esPeticionRecordatorio(t)) return true;
  if (/\b(tengo que|necesito|debo|me toca|quiero que|ay[uú]dame a|agenda|programa|anota|guarda|organiza|prepara|revisa|renueva|paga|cobra|llama|env[ií]a|cotiza|busca|encuentra|consigue|saca una cita|se vence|vence el)\b/.test(t)) return true;
  if (/^(qu[eé]|c[oó]mo|por qu[eé]|cu[aá]l|qui[eé]n|d[oó]nde|cu[aá]ndo|expl[ií]came|dime qu[eé])\b/.test(t)) return false;
  return false;
}

function tituloRecordatorio(texto) {
  return texto
    .replace(/yalisto[,\s]*/ig, '')
    .replace(/recu[eé]rdame\s*/ig, '')
    .replace(/av[ií]same\s*/ig, '')
    .replace(/\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/ig, '')
    .replace(/\s{2,}/g, ' ').trim().replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '') || 'Recordatorio';
}

function accionesParaTexto(texto) {
  const t = texto.toLowerCase();
  if (/\bsoat\b/.test(t)) {
    return [
      { etiqueta:'🛡️ Canales oficiales SOAT', url:'https://www.superfinanciera.gov.co/publicaciones/10115146/no-caiga-en-la-trampa-del-soat-falso/', descripcion:'Canales autorizados y prevención de fraude' },
      { etiqueta:'💰 Información oficial SOAT', url:'https://www.superfinanciera.gov.co/publicaciones/10114908/soat/', descripcion:'Información oficial y tarifas' },
    ];
  }
  if (/cita|eps|salud|m[eé]dica/.test(t)) return [{ etiqueta:'🏥 Consultar EPS', url:'https://www.minsalud.gov.co/Paginas/Consulta-Afiliados.aspx', descripcion:'Consulta oficial del Ministerio de Salud' }];
  if (/notar[ií]a|cerca|d[oó]nde|ubicaci[oó]n|direcci[oó]n/.test(t)) return [{ etiqueta:'📍 Buscar en Maps', url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`, descripcion:'Abrir búsqueda geográfica' }];
  if (/comprar|cotizar|precio|buscar|encontrar|conseguir|tr[aá]mite|tramite/.test(t)) return [{ etiqueta:'🔎 Buscar opciones', url:`https://www.google.com/search?q=${encodeURIComponent(texto)}`, descripcion:'Buscar opciones relacionadas' }];
  return [];
}

function respuestaPorCategoria(categoria, nombre) {
  const saludo = nombre ? `${nombre}, ` : '';
  const mapa = {
    vehiculo:`${saludo}ya lo guardé como compromiso de vehículo. Voy a mantener a la vista vencimientos, documentos y próximos pasos.`,
    salud:`${saludo}lo guardé como compromiso de salud. Podemos organizar cita, documentos y recordatorios sin perder el hilo.`,
    hogar:`${saludo}lo guardé como compromiso de hogar para acompañarlo hasta que quede resuelto.`,
    legal:`${saludo}lo guardé como compromiso legal. Puedo ayudarte a ordenar hechos, documentos, fechas y próximos pasos.`,
    tecnologia:`${saludo}lo guardé como compromiso de tecnología y lo podemos resolver por etapas.`,
    compras:`${saludo}lo guardé para comparar opciones y que no se pierda entre otras cosas.`,
    general:`${saludo}ya quedó en tus compromisos. Ahora podemos convertirlo en un siguiente paso concreto.`,
  };
  return mapa[categoria] || mapa.general;
}

function respuestaPendientesBase(resumen) {
  const pendientes = (resumen.compromisos || []).filter((c) => !['resuelto','cancelado'].includes(c.estado));
  const partes = [];
  if (pendientes.length) {
    const top = pendientes.slice(0,3).map((c) => c.titulo).join('; ');
    partes.push(`Tienes ${pendientes.length} compromiso${pendientes.length === 1 ? '' : 's'} activo${pendientes.length === 1 ? '' : 's'}. Los primeros son: ${top}.`);
  } else partes.push('No tienes compromisos activos registrados.');
  if ((resumen.recordatorios || []).length) {
    const top = resumen.recordatorios.slice(0,3).map((r) => `${r.titulo} (${r.fecha})`).join('; ');
    partes.push(`Próximos recordatorios: ${top}.`);
  }
  return partes.join(' ');
}

async function contextoCerebro(usuario_id) {
  const [resumen, historial] = await Promise.all([
    pg.resumenVida(usuario_id),
    pg.listarMensajes(usuario_id, 16),
  ]);
  return { resumen, historial };
}

router.post('/chat', async (req, res) => {
  const { usuario_id, texto } = req.body || {};
  const mensaje = limpiar(texto);
  if (!usuario_id || !mensaje) return res.status(400).json({ error:'usuario_id y texto son obligatorios' });
  if (!pg.habilitado) return res.status(503).json({ error:'el asistente necesita la base de datos activa' });

  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });

    const nombre = primerNombre(usuario.nombre);
    const acciones = accionesParaTexto(mensaje);
    const contextoAntes = await contextoCerebro(usuario_id);

    if (esConsultaPendientes(mensaje)) {
      await pg.crearMensaje({ usuario_id, rol:'user', contenido:mensaje });
      const respuestaBase = respuestaPendientesBase(contextoAntes.resumen);
      const cerebro = await responderConCerebro({
        usuario,
        mensaje,
        historial: contextoAntes.historial,
        resumen: contextoAntes.resumen,
        respuestaBase,
        hechos: { tipo:'consulta_pendientes', datosConsultados:true },
        acciones,
      });
      await pg.crearMensaje({ usuario_id, rol:'assistant', contenido:cerebro.respuesta });
      return res.json({ respuesta:cerebro.respuesta, accion:'consulta', solicitud:null, compromiso:null, recordatorio:null, acciones, motor:cerebro.motor });
    }

    if (!esAccionPersonal(mensaje)) {
      await pg.crearMensaje({ usuario_id, rol:'user', contenido:mensaje });
      const cerebro = await responderConCerebro({
        usuario,
        mensaje,
        historial: contextoAntes.historial,
        resumen: contextoAntes.resumen,
        respuestaBase:'',
        hechos: { tipo:'conversacion', compromisoCreado:false, nadaEjecutadoFueraDeLaApp:true },
        acciones,
      });
      await pg.crearMensaje({ usuario_id, rol:'assistant', contenido:cerebro.respuesta });
      return res.json({ respuesta:cerebro.respuesta, accion:'conversacion', solicitud:null, compromiso:null, recordatorio:null, acciones, motor:cerebro.motor });
    }

    const { categoria, icono } = clasificar(mensaje);
    const fecha = detectarFecha(mensaje);
    const prioridad = detectarPrioridad(mensaje);
    const titulo = mensaje.length > 72 ? `${mensaje.slice(0,69)}...` : mensaje;

    const solicitud = await pg.crearSolicitud({ usuario_id, texto:mensaje, categoria, icono, titulo, prioridad });
    const compromiso = await pg.crearCompromiso({
      usuario_id,
      titulo,
      descripcion:mensaje,
      categoria,
      prioridad,
      fecha_limite: fecha ? `${fecha}T09:00:00-05:00` : null,
      solicitud_id: solicitud.id,
      metadata:{ origen:'chat' },
    });
    await pg.crearMensaje({ usuario_id, solicitud_id:solicitud.id, rol:'user', contenido:mensaje });

    let recordatorio = null;
    let respuestaBase;
    if (esPeticionRecordatorio(mensaje)) {
      if (fecha) {
        recordatorio = await pg.crearRecordatorio({
          usuario_id,
          titulo:tituloRecordatorio(mensaje),
          fecha,
          icono:'🔔',
          compromiso_id:compromiso.id,
          metadata:{ origen:'chat' },
        });
        respuestaBase = `${nombre ? `${nombre}, ` : ''}guardé el compromiso y activé el recordatorio para ${fecha}.`;
      } else {
        respuestaBase = `${nombre ? `${nombre}, ` : ''}guardé el compromiso. Falta una fecha para poder activar el recordatorio.`;
      }
    } else if (/\bsoat\b/i.test(mensaje)) {
      respuestaBase = `${nombre ? `${nombre}, ` : ''}guardé esto como compromiso de vehículo y dejé disponibles canales oficiales para continuar la gestión del SOAT.`;
    } else {
      respuestaBase = respuestaPorCategoria(categoria, nombre);
    }

    await pg.actualizarRespuestaSolicitud(solicitud.id, respuestaBase);
    const contextoDespues = await contextoCerebro(usuario_id);
    const cerebro = await responderConCerebro({
      usuario,
      mensaje,
      historial: contextoAntes.historial,
      resumen: contextoDespues.resumen,
      respuestaBase,
      hechos: {
        tipo:'gestion_personal',
        compromisoCreado:true,
        compromisoId:compromiso.id,
        categoria,
        prioridad,
        fechaDetectada:fecha,
        recordatorioCreado:Boolean(recordatorio),
        recordatorioFecha:recordatorio?.fecha || null,
        accionesDisponibles:acciones.length,
        nadaPagadoNiEnviadoAutomaticamente:true,
      },
      acciones,
    });

    await pg.actualizarRespuestaSolicitud(solicitud.id, cerebro.respuesta);
    await pg.crearMensaje({ usuario_id, solicitud_id:solicitud.id, rol:'assistant', contenido:cerebro.respuesta });

    res.status(201).json({
      respuesta:cerebro.respuesta,
      accion:recordatorio ? 'recordatorio_creado' : 'compromiso_creado',
      solicitud,
      compromiso,
      recordatorio,
      acciones,
      motor:cerebro.motor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Yalisto no pudo procesar la solicitud' });
  }
});

router.get('/mensajes', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try {
    if (!pg.habilitado) return res.json({ mensajes:[] });
    res.json({ mensajes:await pg.listarMensajes(usuario_id, 100) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudo cargar la conversación' });
  }
});

module.exports = router;
