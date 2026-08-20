const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const pg = require('../db-postgres');

const router = express.Router();

// POST /api/recordatorios — crear un recordatorio (ej. "SOAT vence el 20 de agosto")
// Body: { usuario_id, titulo, fecha (ISO), icono }
router.post('/', async (req, res) => {
  const { usuario_id, titulo, fecha, icono } = req.body || {};

  if (!usuario_id || !titulo || !fecha) {
    return res.status(400).json({ error: 'usuario_id, titulo y fecha son obligatorios' });
  }

  try {
    if (pg.habilitado) {
      const usuario = await pg.buscarUsuarioPorId(usuario_id);
      if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
      const recordatorio = await pg.crearRecordatorio({ usuario_id, titulo, fecha, icono });
      return res.status(201).json({ recordatorio });
    }

    const db = readDb();
    const usuario = db.usuarios.find((u) => u.id === usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });

    const recordatorio = {
      id: nanoid(10),
      usuario_id,
      titulo,
      fecha,
      icono: icono || '🔔',
      notificado: false,
      creado_en: new Date().toISOString(),
    };
    db.recordatorios.push(recordatorio);
    writeDb(db);
    res.status(201).json({ recordatorio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo crear el recordatorio' });
  }
});

// GET /api/recordatorios?usuario_id=...  -> para pintar el calendario
router.get('/', async (req, res) => {
  const { usuario_id } = req.query;

  try {
    if (pg.habilitado) {
      const recordatorios = await pg.listarRecordatorios(usuario_id);
      return res.json({ recordatorios });
    }

    const db = readDb();
    let lista = db.recordatorios;
    if (usuario_id) lista = lista.filter((r) => r.usuario_id === usuario_id);
    lista = [...lista].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    res.json({ recordatorios: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron listar los recordatorios' });
  }
});

// GET /api/recordatorios/proximos?usuario_id=...&dias=7
router.get('/proximos', async (req, res) => {
  const { usuario_id, dias = 7 } = req.query;

  try {
    if (pg.habilitado) {
      const recordatorios = await pg.listarRecordatoriosProximos(usuario_id, Number(dias));
      return res.json({ recordatorios });
    }

    const db = readDb();
    const limite = new Date();
    limite.setDate(limite.getDate() + Number(dias));
    let lista = db.recordatorios.filter((r) => new Date(r.fecha) <= limite);
    if (usuario_id) lista = lista.filter((r) => r.usuario_id === usuario_id);
    res.json({ recordatorios: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron listar los recordatorios próximos' });
  }
});

module.exports = router;
