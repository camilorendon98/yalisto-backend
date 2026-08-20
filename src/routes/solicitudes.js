const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');

const router = express.Router();

// POST /api/solicitudes — el usuario cuenta su problema en texto libre
// Body: { usuario_id, texto }
router.post('/', async (req, res) => {
  const { usuario_id, texto } = req.body || {};

  if (!usuario_id || !texto) {
    return res.status(400).json({ error: 'usuario_id y texto son obligatorios' });
  }

  const { categoria, icono } = clasificar(texto);

  try {
    if (pg.habilitado) {
      const usuario = await pg.buscarUsuarioPorId(usuario_id);
      if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
      const solicitud = await pg.crearSolicitud({ usuario_id, texto, categoria, icono });
      return res.status(201).json({ solicitud });
    }

    const db = readDb();
    const usuario = db.usuarios.find((u) => u.id === usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });

    const solicitud = {
      id: nanoid(10),
      usuario_id,
      texto,
      categoria,
      icono,
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };
    db.solicitudes.push(solicitud);
    writeDb(db);
    res.status(201).json({ solicitud });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo crear la solicitud' });
  }
});

// GET /api/solicitudes?usuario_id=...&estado=...
router.get('/', async (req, res) => {
  const { usuario_id, estado } = req.query;

  try {
    if (pg.habilitado) {
      const solicitudes = await pg.listarSolicitudes({ usuario_id, estado });
      return res.json({ solicitudes });
    }

    const db = readDb();
    let lista = db.solicitudes;
    if (usuario_id) lista = lista.filter((s) => s.usuario_id === usuario_id);
    if (estado) lista = lista.filter((s) => s.estado === estado);
    lista = [...lista].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    res.json({ solicitudes: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron listar las solicitudes' });
  }
});

// PATCH /api/solicitudes/:id — actualizar estado (ej. marcar como resuelto)
router.patch('/:id', async (req, res) => {
  const { estado } = req.body || {};
  const permitido = ['pendiente', 'en_proceso', 'resuelto'];
  if (!permitido.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${permitido.join(', ')}` });
  }

  try {
    if (pg.habilitado) {
      const solicitud = await pg.actualizarEstadoSolicitud(req.params.id, estado);
      if (!solicitud) return res.status(404).json({ error: 'solicitud no encontrada' });
      return res.json({ solicitud });
    }

    const db = readDb();
    const solicitud = db.solicitudes.find((s) => s.id === req.params.id);
    if (!solicitud) return res.status(404).json({ error: 'solicitud no encontrada' });
    solicitud.estado = estado;
    solicitud.actualizado_en = new Date().toISOString();
    writeDb(db);
    res.json({ solicitud });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo actualizar la solicitud' });
  }
});

module.exports = router;
