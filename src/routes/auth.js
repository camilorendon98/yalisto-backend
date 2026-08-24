const express = require('express');
const pg = require('../db-postgres');
const auth = require('../auth');

const router = express.Router();

router.post('/claim-legacy', async (req,res) => {
  const { usuario_id, correo, dispositivo=null, plataforma=null } = req.body || {};
  if (!usuario_id || !correo) return res.status(400).json({ error:'usuario_id y correo son obligatorios' });
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario || String(usuario.correo||'').toLowerCase() !== String(correo).toLowerCase()) {
      return res.status(404).json({ error:'cuenta anterior no encontrada' });
    }
    const { rows } = await pg.pool.query(
      `select count(*)::int as total from sesiones_usuario where usuario_id=$1 and revocado_en is null and (expira_en is null or expira_en>now())`,
      [usuario_id]
    );
    if ((rows[0]?.total || 0) > 0) return res.status(409).json({ error:'esta cuenta ya tiene una sesión segura; inicia desde el dispositivo autorizado' });
    const sesion = await auth.crearSesion(usuario_id,{dispositivo,plataforma});
    res.status(201).json({ usuario, ...sesion, migrada:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudo asegurar la cuenta anterior' });
  }
});

router.get('/me', auth.middleware, async (req,res) => {
  const usuario = await pg.buscarUsuarioPorId(req.auth.usuario_id);
  if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });
  res.json({ usuario });
});

router.post('/logout', auth.middleware, async (req,res) => {
  try {
    await auth.revocarSesion(req.auth.token);
    res.json({ ok:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudo cerrar la sesión' });
  }
});

router.delete('/account', auth.middleware, async (req,res) => {
  const usuario_id = req.auth.usuario_id;
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });
    await pg.pool.query('begin');
    try {
      await pg.pool.query(`delete from solicitudes_derechos_datos where usuario_id=$1 or lower(correo)=lower($2)`,[usuario_id,usuario.correo||'']);
      await pg.pool.query(`delete from usuarios where id=$1`,[usuario_id]);
      await pg.pool.query('commit');
    } catch (e) {
      await pg.pool.query('rollback');
      throw e;
    }
    res.json({ ok:true, eliminado:true, mensaje:'La cuenta y sus datos asociados fueron eliminados.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudo eliminar la cuenta' });
  }
});

module.exports = router;
