const express = require('express');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');

const router = express.Router();

function limpiar(texto = '') {
  return String(texto).trim();
}

function primerNombre(nombre = '') {
  return nombre.trim().split(/\s+/)[0] || '';
}

function fechaISO(date) {
  return date.toISOString().slice(0, 10);
}

function detectarFecha(texto) {
  const t = texto.toLowerCase();
  const hoy = new Date();
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (/\bmañana\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return fechaISO(d);
  }
  if (/\bhoy\b/.test(t)) return fechaISO(base);

  const matchIso = t.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (matchIso) {
    const [, y, m, d] = matchIso;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const dias = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
  };
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

function esPeticionRecordatorio(texto) {
  const t = texto.toLowerCase();
  return /recu[eé]rdame|recordatorio|av[ií]same|no me dejes olvidar|acu[eé]rdate/.test(t);
}

function tituloRecordatorio(texto) {
  return texto
    .replace(/yalisto[,\s]*/ig, '')
    .replace(/recu[eé]rdame\s*/ig, '')
    .replace(/av[ií]same\s*/ig, '')
    .replace(/\b(hoy|mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '') || 'Recordatorio';
}

function respuestaPorCategoria(categoria, nombre) {
  const saludo = nombre ? `${nombre}, ` : '';
  const mapa = {
    vehiculo: `${saludo}ya lo convertí en una misión de vehículo. Puedo ayudarte a organizar vencimientos, documentos, costos y próximos pasos.`,
    salud: `${saludo}entendido. Lo dejé como una misión de salud. Puedo ayudarte a organizar la cita, documentos y recordatorios, sin reemplazar la orientación de un profesional de salud.`,
    hogar: `${saludo}listo. Lo marqué como una misión de hogar y puedo ir organizando opciones y pendientes contigo.`,
    legal: `${saludo}entendido. Lo marqué como una misión legal. Puedo ayudarte a ordenar hechos, documentos, fechas y próximos pasos.`,
    tecnologia: `${saludo}listo. Lo marqué como una misión de tecnología y puedo ir resolviéndolo contigo paso a paso.`,
    compras: `${saludo}entendido. Lo marqué como una misión de compra para comparar opciones y evitar que se te pierda el pendiente.`,
    general: `${saludo}listo. Ya lo tengo como una misión. Te iré mostrando qué falta, qué puedo preparar y qué necesita tu autorización.`,
  };
  return mapa[categoria] || mapa.general;
}

async function responderConDatos(usuario, texto) {
  const t = texto.toLowerCase();
  if (/qu[eé] tengo pendiente|mis pendientes|qu[eé] sigue|qu[eé] me falta/.test(t)) {
    const [solicitudes, recordatorios] = await Promise.all([
      pg.listarSolicitudes({ usuario_id: usuario.id, estado: 'pendiente' }),
      pg.listarRecordatoriosProximos(usuario.id, 14),
    ]);

    const partes = [];
    if (solicitudes.length) {
      const top = solicitudes.slice(0, 3).map((s) => s.titulo || s.texto).join('; ');
      partes.push(`Tienes ${solicitudes.length} misión${solicitudes.length === 1 ? '' : 'es'} pendiente${solicitudes.length === 1 ? '' : 's'}. Las primeras son: ${top}.`);
    } else {
      partes.push('No tienes misiones pendientes registradas.');
    }
    if (recordatorios.length) {
      const top = recordatorios.slice(0, 3).map((r) => `${r.titulo} (${r.fecha})`).join('; ');
      partes.push(`Además, tus próximos recordatorios son: ${top}.`);
    }
    return partes.join(' ');
  }
  return null;
}

router.post('/chat', async (req, res) => {
  const { usuario_id, texto } = req.body || {};
  const mensaje = limpiar(texto);

  if (!usuario_id || !mensaje) {
    return res.status(400).json({ error: 'usuario_id y texto son obligatorios' });
  }
  if (!pg.habilitado) {
    return res.status(503).json({ error: 'el asistente necesita la base de datos activa' });
  }

  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });

    const nombre = primerNombre(usuario.nombre);
    const respuestaDatos = await responderConDatos(usuario, mensaje);
    if (respuestaDatos) {
      await pg.crearMensaje({ usuario_id, rol: 'user', contenido: mensaje });
      await pg.crearMensaje({ usuario_id, rol: 'assistant', contenido: respuestaDatos });
      return res.json({ respuesta: respuestaDatos, accion: 'consulta', solicitud: null, recordatorio: null });
    }

    const { categoria, icono } = clasificar(mensaje);
    const solicitud = await pg.crearSolicitud({
      usuario_id,
      texto: mensaje,
      categoria,
      icono,
      titulo: mensaje.length > 72 ? `${mensaje.slice(0, 69)}...` : mensaje,
    });

    await pg.crearMensaje({ usuario_id, solicitud_id: solicitud.id, rol: 'user', contenido: mensaje });

    let recordatorio = null;
    let respuesta;
    if (esPeticionRecordatorio(mensaje)) {
      const fecha = detectarFecha(mensaje);
      if (fecha) {
        recordatorio = await pg.crearRecordatorio({
          usuario_id,
          titulo: tituloRecordatorio(mensaje),
          fecha,
          icono: '🔔',
        });
        respuesta = `${nombre ? `${nombre}, ` : ''}listo. Guardé el recordatorio para ${fecha}. Ya quedó en tu agenda.`;
      } else {
        respuesta = `${nombre ? `${nombre}, ` : ''}te entendí. Necesito la fecha para dejar el recordatorio activo. Puedes decirme, por ejemplo, “mañana”, “el viernes” o una fecha.`;
      }
    } else {
      respuesta = respuestaPorCategoria(categoria, nombre);
    }

    await pg.actualizarRespuestaSolicitud(solicitud.id, respuesta);
    await pg.crearMensaje({ usuario_id, solicitud_id: solicitud.id, rol: 'assistant', contenido: respuesta });

    res.status(201).json({ respuesta, accion: recordatorio ? 'recordatorio_creado' : 'mision_creada', solicitud, recordatorio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yalisto no pudo procesar la solicitud' });
  }
});

router.get('/mensajes', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    if (!pg.habilitado) return res.json({ mensajes: [] });
    const mensajes = await pg.listarMensajes(usuario_id, 100);
    res.json({ mensajes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo cargar la conversación' });
  }
});

module.exports = router;
