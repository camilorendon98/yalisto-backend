const express = require('express');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');

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
      { etiqueta:'💰 Tarifas SOAT 2026', url:'https://www.superfinanciera.gov.co/publicaciones/10114908/soat/', descripcion:'Información oficial, tarifas y simulador' },
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
    vehiculo:`${saludo}ya lo convertí en un compromiso de vehículo. Voy a mantenerlo en tu memoria y ayudarte con vencimientos, documentos y próximos pasos.`,
    salud:`${saludo}entendido. Lo guardé como compromiso de salud y puedo organizar cita, documentos y recordatorios.`,
    hogar:`${saludo}listo. Lo guardé como compromiso de hogar para acompañarlo hasta que quede resuelto.`,
    legal:`${saludo}entendido. Lo guardé como compromiso legal y puedo organizar hechos, documentos, fechas y próximos pasos.`,
    tecnologia:`${saludo}listo. Lo guardé como compromiso de tecnología y lo iremos resolviendo paso a paso.`,
    compras:`${saludo}entendido. Lo guardé para comparar opciones y evitar que se pierda el pendiente.`,
    general:`${saludo}listo. Ya lo tengo en tu memoria como compromiso. Te mostraré qué falta y qué puedo ayudarte a ejecutar.`,
  };
  return mapa[categoria] || mapa.general;
}

async function responderConDatos(usuario, texto) {
  const t = texto.toLowerCase();
  if (/qu[eé] tengo pendiente|mis pendientes|qu[eé] sigue|qu[eé] me falta/.test(t)) {
    const resumen = await pg.resumenVida(usuario.id);
    const pendientes = resumen.compromisos.filter((c) => !['resuelto','cancelado'].includes(c.estado));
    const partes = [];
    if (pendientes.length) {
      const top = pendientes.slice(0,3).map((c) => c.titulo).join('; ');
      partes.push(`Tienes ${pendientes.length} compromiso${pendientes.length === 1 ? '' : 's'} activo${pendientes.length === 1 ? '' : 's'}. Primero revisaría: ${top}.`);
    } else partes.push('No tienes compromisos activos registrados.');
    if (resumen.recordatorios.length) {
      const top = resumen.recordatorios.slice(0,3).map((r) => `${r.titulo} (${r.fecha})`).join('; ');
      partes.push(`Tus próximos recordatorios son: ${top}.`);
    }
    if (resumen.acciones.length) partes.push(`También tienes ${resumen.acciones.length} acción${resumen.acciones.length === 1 ? '' : 'es'} pendiente${resumen.acciones.length === 1 ? '' : 's'} de continuar o autorizar.`);
    return partes.join(' ');
  }
  return null;
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
    const respuestaDatos = await responderConDatos(usuario, mensaje);
    if (respuestaDatos) {
      await pg.crearMensaje({ usuario_id, rol:'user', contenido:mensaje });
      await pg.crearMensaje({ usuario_id, rol:'assistant', contenido:respuestaDatos });
      return res.json({ respuesta:respuestaDatos, accion:'consulta', solicitud:null, compromiso:null, recordatorio:null, acciones });
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
    let respuesta;
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
        respuesta = `${nombre ? `${nombre}, ` : ''}listo. Lo guardé como compromiso y dejé el recordatorio para ${fecha}.`;
      } else {
        respuesta = `${nombre ? `${nombre}, ` : ''}ya guardé el compromiso. Solo me falta la fecha para activar el recordatorio.`;
      }
    } else if (/\bsoat\b/i.test(mensaje)) {
      respuesta = `${nombre ? `${nombre}, ` : ''}listo. Lo guardé como compromiso de vehículo y te dejé accesos oficiales para revisar el SOAT. Cuando registres tu vehículo podré recordar placa y vencimiento.`;
    } else {
      respuesta = respuestaPorCategoria(categoria, nombre);
    }

    await pg.actualizarRespuestaSolicitud(solicitud.id, respuesta);
    await pg.crearMensaje({ usuario_id, solicitud_id:solicitud.id, rol:'assistant', contenido:respuesta });

    res.status(201).json({ respuesta, accion:recordatorio ? 'recordatorio_creado' : 'compromiso_creado', solicitud, compromiso, recordatorio, acciones });
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
