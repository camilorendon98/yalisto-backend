const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const pg = require('../db-postgres');
const legal = require('../legal');

const router = express.Router();
const CONSENTIMIENTOS_OBLIGATORIOS = ['terminos', 'privacidad', 'autorizacion_datos'];

function codigosAceptados(consentimientos = []) {
  return new Set((Array.isArray(consentimientos) ? consentimientos : [])
    .filter((c) => c && c.aceptado === true && c.codigo)
    .map((c) => String(c.codigo)));
}

function faltantesRegistro(consentimientos = []) {
  const aceptados = codigosAceptados(consentimientos);
  return CONSENTIMIENTOS_OBLIGATORIOS.filter((codigo) => !aceptados.has(codigo));
}

function validarConsentimientoPrevio(consentimientos = []) {
  const faltantes = faltantesRegistro(consentimientos);
  if (!faltantes.length) return null;
  return {
    error: 'Antes de crear la cuenta debes aceptar los Términos y Condiciones, confirmar la Política de Privacidad y autorizar el tratamiento de datos personales.',
    codigo: 'CONSENTIMIENTO_PREVIO_REQUERIDO',
    faltantes,
    sensibles_opcionales: true,
  };
}

router.post('/', async (req, res) => {
  const { nombre, celular, ciudad, correo, permisos, consentimientos = [], legal_meta = {} } = req.body || {};

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
      if (existente) {
        let consentimientosGuardados = [];
        if (Array.isArray(consentimientos) && consentimientos.length) {
          consentimientosGuardados = await legal.registrarConsentimientos(existente.id, consentimientos, {
            jurisdiccion: legal_meta.jurisdiccion || 'CO',
            version_app: legal_meta.version_app || null,
            plataforma: legal_meta.plataforma || null,
            locale: legal_meta.locale || null,
            metodo:'checkbox_onboarding',
            evidencia:{ origen:'registro_usuario_existente' },
          });
        }
        return res.status(200).json({ usuario: existente, existente: true, consentimientos: consentimientosGuardados });
      }

      const problemaLegal = validarConsentimientoPrevio(consentimientos);
      if (problemaLegal) return res.status(400).json(problemaLegal);

      // Primero se verifica la aceptación; solo después se crea el registro de usuario.
      const usuario = await pg.crearUsuario({ nombre, celular, ciudad, correo, permisos: permisosCompletos });
      const consentimientosGuardados = await legal.registrarConsentimientos(usuario.id, consentimientos, {
        jurisdiccion: legal_meta.jurisdiccion || 'CO',
        version_app: legal_meta.version_app || null,
        plataforma: legal_meta.plataforma || null,
        locale: legal_meta.locale || null,
        metodo:'checkbox_onboarding',
        evidencia:{ origen:'registro_usuario', consentimiento_previo:true },
      });
      return res.status(201).json({ usuario, existente: false, consentimientos: consentimientosGuardados });
    }

    const db = readDb();
    const yaExiste = db.usuarios.find((u) => String(u.correo).toLowerCase() === String(correo).toLowerCase());
    if (yaExiste) return res.status(200).json({ usuario: yaExiste, existente: true });

    const problemaLegal = validarConsentimientoPrevio(consentimientos);
    if (problemaLegal) return res.status(400).json(problemaLegal);

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
    res.status(201).json({ usuario, existente: false, consentimiento_previo: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'no se pudo registrar el usuario' });
  }
});

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
