const express = require('express');
const pg = require('../db-postgres');
const legal = require('../legal');

const router = express.Router();

router.get('/documentos', async (req,res) => {
  try {
    const jurisdiccion = req.query.jurisdiccion || 'CO';
    const documentos = await legal.documentosVigentes(jurisdiccion);
    res.json({ jurisdiccion, operador:legal.operadorLegal(), documentos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudieron cargar los documentos legales' });
  }
});

router.get('/estado', async (req,res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try { res.json(await legal.estadoLegalUsuario(usuario_id)); }
  catch (err) { console.error(err); res.status(500).json({ error:'no se pudo consultar el estado legal' }); }
});

router.get('/consentimientos', async (req,res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try { res.json({ consentimientos:await legal.consentimientosUsuario(usuario_id) }); }
  catch (err) { console.error(err); res.status(500).json({ error:'no se pudieron consultar los consentimientos' }); }
});

router.post('/consentimientos', async (req,res) => {
  const { usuario_id, consentimientos, version_app, plataforma, locale, jurisdiccion='CO' } = req.body || {};
  if (!usuario_id || !Array.isArray(consentimientos)) return res.status(400).json({ error:'usuario_id y consentimientos son obligatorios' });
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });
    const guardados = await legal.registrarConsentimientos(usuario_id, consentimientos, {
      jurisdiccion, version_app, plataforma, locale, metodo:'checkbox_app', evidencia:{ origen:'centro_privacidad' },
    });
    res.status(201).json({ consentimientos:guardados, estado:await legal.estadoLegalUsuario(usuario_id) });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudieron registrar los consentimientos' }); }
});

router.post('/derechos', async (req,res) => {
  const { usuario_id=null, correo=null, tipo, detalle=null } = req.body || {};
  const tipos = ['acceso','actualizacion','rectificacion','supresion','revocatoria','consulta_uso','portabilidad','otro'];
  if (!tipo || !tipos.includes(tipo)) return res.status(400).json({ error:'tipo de solicitud no válido' });
  if (!usuario_id && !correo) return res.status(400).json({ error:'usuario_id o correo es obligatorio' });
  try {
    const { rows } = await pg.pool.query(
      `insert into solicitudes_derechos_datos (usuario_id,correo,tipo,detalle) values ($1,$2,$3,$4) returning *`,
      [usuario_id,correo,tipo,detalle]
    );
    res.status(201).json({ solicitud:rows[0], mensaje:'Solicitud recibida. El operador deberá atenderla conforme a los términos legales aplicables.' });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo registrar la solicitud' }); }
});

module.exports = router;
