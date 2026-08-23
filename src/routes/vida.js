const express = require('express');
const pg = require('../db-postgres');

const router = express.Router();

function requerido(valor) {
  return valor !== undefined && valor !== null && String(valor).trim() !== '';
}

router.get('/resumen', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    const resumen = await pg.resumenVida(usuario_id);
    res.json({ usuario, ...resumen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo construir el resumen de vida' });
  }
});

router.get('/memoria', async (req, res) => {
  const { usuario_id, tipo } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const items = await pg.listarMemoria(usuario_id, tipo || null, 150);
    res.json({ memoria: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo consultar la memoria' });
  }
});

router.post('/memoria', async (req, res) => {
  const { usuario_id, tipo, clave, titulo, valor, fuente, confianza, confirmado_por_usuario } = req.body || {};
  if (!requerido(usuario_id) || !requerido(tipo)) {
    return res.status(400).json({ error: 'usuario_id y tipo son obligatorios' });
  }
  try {
    const item = await pg.guardarMemoria({
      usuario_id,
      tipo,
      clave: clave || null,
      titulo: titulo || null,
      valor: valor || {},
      fuente: fuente || 'usuario',
      confianza: confianza === undefined ? 1 : Number(confianza),
      confirmado_por_usuario: confirmado_por_usuario !== false,
    });
    res.status(201).json({ memoria: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo guardar en memoria' });
  }
});

router.get('/compromisos', async (req, res) => {
  const { usuario_id, estado } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const compromisos = await pg.listarCompromisos(usuario_id, estado || null, 100);
    res.json({ compromisos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron consultar los compromisos' });
  }
});

router.post('/compromisos', async (req, res) => {
  const { usuario_id, titulo, descripcion, categoria, estado, prioridad, fecha_limite, solicitud_id, metadata } = req.body || {};
  if (!requerido(usuario_id) || !requerido(titulo)) {
    return res.status(400).json({ error: 'usuario_id y titulo son obligatorios' });
  }
  try {
    const compromiso = await pg.crearCompromiso({
      usuario_id, titulo, descripcion, categoria, estado, prioridad, fecha_limite, solicitud_id, metadata,
    });
    res.status(201).json({ compromiso });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo crear el compromiso' });
  }
});

router.get('/personas', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try { res.json({ personas: await pg.listarPersonas(usuario_id) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'no se pudieron consultar las personas' }); }
});

router.post('/personas', async (req, res) => {
  const { usuario_id, nombre, relacion, telefono, correo, fecha_importante, notas, metadata } = req.body || {};
  if (!requerido(usuario_id) || !requerido(nombre)) return res.status(400).json({ error: 'usuario_id y nombre son obligatorios' });
  try {
    const persona = await pg.crearPersona({ usuario_id, nombre, relacion, telefono, correo, fecha_importante, notas, metadata });
    res.status(201).json({ persona });
  } catch (err) { console.error(err); res.status(500).json({ error: 'no se pudo guardar la persona' }); }
});

router.get('/vehiculos', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try { res.json({ vehiculos: await pg.listarVehiculos(usuario_id) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'no se pudieron consultar los vehículos' }); }
});

router.post('/vehiculos', async (req, res) => {
  const datos = req.body || {};
  if (!requerido(datos.usuario_id)) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try { res.status(201).json({ vehiculo: await pg.crearVehiculo(datos) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'no se pudo guardar el vehículo' }); }
});

router.get('/agenda', async (req, res) => {
  const { usuario_id, desde, hasta } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  const inicio = desde || new Date().toISOString();
  const fin = hasta || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const [eventos, recordatorios] = await Promise.all([
      pg.listarEventosAgenda(usuario_id, inicio, fin),
      pg.listarRecordatorios(usuario_id),
    ]);
    res.json({ eventos, recordatorios });
  } catch (err) { console.error(err); res.status(500).json({ error: 'no se pudo consultar la agenda' }); }
});

router.post('/agenda', async (req, res) => {
  const datos = req.body || {};
  if (!requerido(datos.usuario_id) || !requerido(datos.titulo) || !requerido(datos.inicia_en)) {
    return res.status(400).json({ error: 'usuario_id, titulo e inicia_en son obligatorios' });
  }
  try { res.status(201).json({ evento: await pg.crearEventoAgenda(datos) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'no se pudo crear el evento' }); }
});

module.exports = router;
