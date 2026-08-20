const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const pg = require('../db-postgres');

const router = express.Router();

// POST /api/usuarios — registro (paso 1 y 2 del onboarding: datos + permisos)
router.post('/', async (req, res) => {
  const { nombre, celular, ciudad, correo, permisos } = req.body || {};

  if (!nombre || !correo) {
    return res.status(400).json({ error: 'nombre y correo son obligatorios' });
  }

  const permisosCompletos = {
    notificaciones: true,
    calendario: true,
    microfono: true,
    camara: true,
    ubicacion: true,
    contactos: true,
    llamadas_sms: true,
    ...permisos,
  };

  try {
    if (pg.habilitado) {
      const existente = await pg.buscarUsuarioPorCorreo(correo);
      if (existente) return res.status(409).json({ error: 'ya existe un usuario con ese correo', usuario: existente });

      const usuario = await pg.crearUsuario({ nombre, celular, ciudad, correo, permisos: permisosCompletos });
      return res.status(201).json({ usuario });
    }

    const db = readDb();
    const yaExiste = db.usuarios.find((u) => u.correo === correo);
    if (yaExiste) return res.status(409).json({ error: 'ya existe un usuario con ese correo', usuario: yaExiste });

    const usuario = {
      id: nanoid(10),
      nombre,
      celular: celular || null,
      ciudad: ciudad || null,
      correo,
      permisos: permisosCompletos,
      creado_en: new Date().toISOString(),
    };
    db.usuarios.push(usuario);
    writeDb(db);
    res.status(201).json({ usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo registrar el usuario' });
  }
});

// GET /api/usuarios/:id
router.get('/:id', async (req, res) => {
  try {
    if (pg.habilitado) {
      const usuario = await pg.buscarUsuarioPorId(req.params.id);
      if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
      return res.json({ usuario });
    }

    const db = readDb();
    const usuario = db.usuarios.find((u) => u.id === req.params.id);
    if (!usuario) return res.status(404).json({ error: 'usuario no encontrado' });
    res.json({ usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo consultar el usuario' });
  }
});

module.exports = router;
