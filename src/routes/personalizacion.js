const express = require('express');
const pg = require('../db-postgres');
const personalizacion = require('../personalizacion');

const router = express.Router();

const CATALOGOS = {
  idiomas: [
    { codigo:'es-CO', nombre:'Español', icono:'🇨🇴' },
    { codigo:'en-US', nombre:'English', icono:'🇺🇸' },
    { codigo:'pt-BR', nombre:'Português', icono:'🇧🇷' },
    { codigo:'fr-FR', nombre:'Français', icono:'🇫🇷' },
    { codigo:'de-DE', nombre:'Deutsch', icono:'🇩🇪' },
    { codigo:'it-IT', nombre:'Italiano', icono:'🇮🇹' },
    { codigo:'zh-CN', nombre:'中文', icono:'🇨🇳' },
    { codigo:'ja-JP', nombre:'日本語', icono:'🇯🇵' },
  ],
  estados_animo: [
    { codigo:'tranquilo', etiqueta:'Tranquilo', icono:'😌' },
    { codigo:'bien', etiqueta:'Bien', icono:'🙂' },
    { codigo:'motivado', etiqueta:'Motivado', icono:'🔥' },
    { codigo:'cansado', etiqueta:'Cansado', icono:'😴' },
    { codigo:'estresado', etiqueta:'Estresado', icono:'😵‍💫' },
    { codigo:'preocupado', etiqueta:'Preocupado', icono:'😟' },
    { codigo:'triste', etiqueta:'Triste', icono:'😔' },
    { codigo:'molesto', etiqueta:'Molesto', icono:'😤' },
    { codigo:'abrumado', etiqueta:'Abrumado', icono:'🌪️' },
    { codigo:'otro', etiqueta:'Otro', icono:'💭' },
  ],
  ayuda_preferida: [
    { codigo:'organizame', etiqueta:'Organízame', descripcion:'Pon orden y prioridades' },
    { codigo:'empujame', etiqueta:'Empújame', descripcion:'Dame un siguiente paso concreto' },
    { codigo:'escuchame', etiqueta:'Escúchame', descripcion:'Primero entiende el contexto' },
    { codigo:'resuelvelo', etiqueta:'Ayúdame a resolver', descripcion:'Busca la salida más práctica' },
    { codigo:'baja_carga', etiqueta:'Bájame la carga', descripcion:'Reduce tareas y simplifica' },
  ],
  fondos_chat: [
    { codigo:'crema', etiqueta:'Crema Yalisto' },
    { codigo:'claro', etiqueta:'Claro' },
    { codigo:'noche', etiqueta:'Noche' },
    { codigo:'salvia', etiqueta:'Salvia' },
    { codigo:'cielo', etiqueta:'Cielo' },
    { codigo:'papel', etiqueta:'Papel' },
  ],
  interfaces: [
    { codigo:'calida', etiqueta:'Cálida', descripcion:'Tarjetas suaves y contexto visible' },
    { codigo:'minimal', etiqueta:'Minimal', descripcion:'Menos elementos, más espacio' },
    { codigo:'compacta', etiqueta:'Compacta', descripcion:'Más información en pantalla' },
    { codigo:'enfoque', etiqueta:'Enfoque', descripcion:'Una prioridad a la vez' },
  ],
  relaciones_personas: [
    { codigo:'pareja', etiqueta:'Pareja / cónyuge', grupo:'familia' },
    { codigo:'madre', etiqueta:'Madre', grupo:'familia' },
    { codigo:'padre', etiqueta:'Padre', grupo:'familia' },
    { codigo:'hijo', etiqueta:'Hijo/a', grupo:'familia' },
    { codigo:'hermano', etiqueta:'Hermano/a', grupo:'familia' },
    { codigo:'abuelo', etiqueta:'Abuelo/a', grupo:'familia' },
    { codigo:'nieto', etiqueta:'Nieto/a', grupo:'familia' },
    { codigo:'tio', etiqueta:'Tío/a', grupo:'familia' },
    { codigo:'primo', etiqueta:'Primo/a', grupo:'familia' },
    { codigo:'otro_familiar', etiqueta:'Otro familiar', grupo:'familia' },
    { codigo:'amigo', etiqueta:'Amigo/a', grupo:'personal' },
    { codigo:'vecino', etiqueta:'Vecino/a', grupo:'personal' },
    { codigo:'colega', etiqueta:'Colega', grupo:'trabajo' },
    { codigo:'jefe', etiqueta:'Jefe / superior', grupo:'trabajo' },
    { codigo:'empleado', etiqueta:'Empleado/a', grupo:'trabajo' },
    { codigo:'cliente', etiqueta:'Cliente', grupo:'trabajo' },
    { codigo:'proveedor', etiqueta:'Proveedor', grupo:'trabajo' },
    { codigo:'socio', etiqueta:'Socio/a', grupo:'trabajo' },
    { codigo:'medico', etiqueta:'Médico/a', grupo:'servicios' },
    { codigo:'abogado', etiqueta:'Abogado/a', grupo:'servicios' },
    { codigo:'contador', etiqueta:'Contador/a', grupo:'servicios' },
    { codigo:'contacto_emergencia', etiqueta:'Contacto de emergencia', grupo:'seguridad' },
    { codigo:'otro', etiqueta:'Otra relación', grupo:'otro' },
  ],
};

async function validarUsuario(usuario_id) {
  if (!usuario_id) return null;
  return pg.buscarUsuarioPorId(usuario_id);
}

router.get('/catalogos', (req, res) => res.json(CATALOGOS));

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
  const estados = CATALOGOS.estados_animo.map((x) => x.codigo);
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
    const preferencias = await personalizacion.obtenerPreferencias(usuario_id);
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
