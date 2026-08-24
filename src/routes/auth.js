const express = require('express');
const pg = require('../db-postgres');
const auth = require('../auth');

const router = express.Router();

router.post('/login', async(req,res)=>{
  const {correo,password,dispositivo=null,plataforma=null}=req.body||{};
  if(!correo||!password)return res.status(400).json({error:'correo y contraseña son obligatorios'});
  try{
    const usuario=await pg.buscarUsuarioPorCorreo(correo);
    if(!usuario||!usuario.password_hash)return res.status(401).json({error:'correo o contraseña incorrectos'});
    const ok=await auth.verificarPassword(password,usuario.password_hash);
    if(!ok)return res.status(401).json({error:'correo o contraseña incorrectos'});
    const sesion=await auth.crearSesion(usuario.id,{dispositivo,plataforma});
    const seguro={...usuario}; delete seguro.password_hash;
    res.json({usuario:seguro,...sesion});
  }catch(err){console.error(err);res.status(500).json({error:'no se pudo iniciar sesión'});}
});

router.post('/claim-legacy', async (req,res) => {
  const { usuario_id, correo, dispositivo=null, plataforma=null } = req.body || {};
  if (!usuario_id || !correo) return res.status(400).json({ error:'usuario_id y correo son obligatorios' });
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario || String(usuario.correo||'').toLowerCase() !== String(correo).toLowerCase()) return res.status(404).json({ error:'cuenta anterior no encontrada' });
    const { rows } = await pg.pool.query(`select count(*)::int as total from sesiones_usuario where usuario_id=$1 and revocado_en is null and (expira_en is null or expira_en>now())`,[usuario_id]);
    if ((rows[0]?.total || 0) > 0) return res.status(409).json({ error:'esta cuenta ya tiene una sesión segura; usa tu contraseña para entrar' });
    const sesion = await auth.crearSesion(usuario_id,{dispositivo,plataforma});
    const seguro={...usuario}; delete seguro.password_hash;
    res.status(201).json({ usuario:seguro, ...sesion, migrada:true, necesita_password:!usuario.password_hash });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo asegurar la cuenta anterior' }); }
});

router.get('/me', auth.middleware, async (req,res) => {
  const usuario = await pg.buscarUsuarioPorId(req.auth.usuario_id);
  if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });
  const seguro={...usuario}; delete seguro.password_hash;
  res.json({ usuario:seguro, necesita_password:!usuario.password_hash });
});

router.put('/password', auth.middleware, async(req,res)=>{
  const {password}=req.body||{};
  if(!password||String(password).length<8)return res.status(400).json({error:'La contraseña debe tener mínimo 8 caracteres.'});
  try{const hash=await auth.hashPassword(password);await pg.pool.query('update usuarios set password_hash=$1 where id=$2',[hash,req.auth.usuario_id]);res.json({ok:true});}
  catch(err){console.error(err);res.status(500).json({error:'no se pudo actualizar la contraseña'});}
});

router.post('/logout', auth.middleware, async (req,res) => {
  try { await auth.revocarSesion(req.auth.token); res.json({ ok:true }); }
  catch (err) { console.error(err); res.status(500).json({ error:'no se pudo cerrar la sesión' }); }
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
    } catch (e) { await pg.pool.query('rollback'); throw e; }
    res.json({ ok:true, eliminado:true, mensaje:'La cuenta y sus datos asociados fueron eliminados.' });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo eliminar la cuenta' }); }
});

module.exports = router;
