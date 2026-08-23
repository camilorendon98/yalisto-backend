const express = require('express');
const pg = require('../db-postgres');
const personalizacion = require('../personalizacion');

const router = express.Router();

async function validarUsuario(usuario_id) {
  if (!usuario_id) return null;
  return pg.buscarUsuarioPorId(usuario_id);
}

router.get('/animo', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const usuario = await validarUsuario(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    const [hoy, historial] = await Promise.all([
      personalizacion.obtenerEstadoAnimoHoy(usuario_id),
      personalizacion.listarEstadosAnimo(usuario_id, 14),
    ]);
    res.json({ hoy, historial });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo consultar el estado de ánimo' });
  }
});

router.post('/animo', async (req, res) => {
  const { usuario_id, estado, intensidad, energia, nota, ayuda_preferida } = req.body || {};
  const estados = ['tranquilo','bien','motivado','cansado','estresado','preocupado','triste','molesto','abrumado','otro'];
  if (!usuario_id || !estado) return res.status(400).json({ error: 'usuario_id y estado son obligatorios' });
  if (!estados.includes(estado)) return res.status(400).json({ error: 'estado no permitido' });
  try {
    const usuario = await validarUsuario(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    const item = await personalizacion.guardarEstadoAnimo({
      usuario_id,
      estado,
      intensidad: Math.max(1, Math.min(Number(intensidad) || 3, 5)),
      energia: Math.max(1, Math.min(Number(energia) || 3, 5)),
      nota: nota || null,
      ayuda_preferida: ayuda_preferida || null,
    });
    res.status(201).json({ animo: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo guardar el estado de ánimo' });
  }
});

router.get('/preferencias', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const usuario = await validarUsuario(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    let preferencias = await personalizacion.obtenerPreferencias(usuario_id);
    if (!preferencias) preferencias = await personalizacion.guardarPreferencias(usuario_id, {});
    res.json({ preferencias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron consultar las preferencias' });
  }
});

router.patch('/preferencias', async (req, res) => {
  const { usuario_id, ...cambios } = req.body || {};
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id es obligatorio' });
  try {
    const usuario = await validarUsuario(usuario_id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    const preferencias = await personalizacion.guardarPreferencias(usuario_id, cambios);
    res.json({ preferencias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudieron guardar las preferencias' });
  }
});

module.exports = router;
