const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const pg = require('../db-postgres');

const router = express.Router();

router.post('/', async (req, res) => {
  const { titulo, fecha, icono } = req.body || {};
  const usuario_id = req.auth?.usuario_id || req.body?.usuario_id;
  if (!usuario_id || !titulo || !fecha) return res.status(400).json({ error: 'usuario_id, titulo y fecha son obligatorios' });

  try {
    if (pg.habilitado) {
      const recordatorio = await pg.crearRecordatorio({ usuario_id, titulo, fecha, icono });
      return res.status(201).json({ recordatorio });
    }
    const db = readDb();
    const recordatorio = { id:nanoid(10), usuario_id, titulo, fecha, icono:icono || '🔔', notificado:false, creado_en:new Date().toISOString() };
    db.recordatorios.push(recordatorio); writeDb(db);
    res.status(201).json({ recordatorio });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo crear el recordatorio' }); }
});

router.get('/', async (req, res) => {
  const usuario_id = req.auth?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error:'sesión requerida' });
  try {
    if (pg.habilitado) return res.json({ recordatorios:await pg.listarRecordatorios(usuario_id) });
    const db=readDb();
    const lista=db.recordatorios.filter(r=>r.usuario_id===usuario_id).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
    res.json({recordatorios:lista});
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudieron listar los recordatorios' }); }
});

router.get('/proximos', async (req, res) => {
  const usuario_id=req.auth?.usuario_id;
  const { dias=7 }=req.query;
  if (!usuario_id) return res.status(401).json({ error:'sesión requerida' });
  try {
    if (pg.habilitado) return res.json({ recordatorios:await pg.listarRecordatoriosProximos(usuario_id,Number(dias)) });
    const db=readDb(); const limite=new Date(); limite.setDate(limite.getDate()+Number(dias));
    const lista=db.recordatorios.filter(r=>r.usuario_id===usuario_id && new Date(r.fecha)<=limite);
    res.json({recordatorios:lista});
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudieron listar los recordatorios próximos' }); }
});

module.exports = router;
