const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const pg = require('../db-postgres');
const legal = require('../legal');
const auth = require('../auth');

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
  return { error:'Antes de crear la cuenta debes aceptar los Términos y Condiciones, confirmar la Política de Privacidad y autorizar el tratamiento de datos personales.', codigo:'CONSENTIMIENTO_PREVIO_REQUERIDO', faltantes, sensibles_opcionales:true };
}

router.post('/', async (req, res) => {
  const { nombre, celular, ciudad, correo, password, permisos, consentimientos = [], legal_meta = {}, dispositivo=null, plataforma=null } = req.body || {};
  if (!nombre || !correo || !password) return res.status(400).json({ error:'nombre, correo y contraseña son obligatorios' });
  if (String(password).length < 8) return res.status(400).json({ error:'La contraseña debe tener mínimo 8 caracteres.' });

  const permisosCompletos = { notificaciones:true, calendario:true, microfono:true, camara:true, ubicacion:true, contactos:true, llamadas_sms:false, ...permisos };

  try {
    if (pg.habilitado) {
      const existente = await pg.buscarUsuarioPorCorreo(correo);
      if (existente) return res.status(409).json({ error:'Ya existe una cuenta con ese correo. Usa “Ya tengo cuenta” para entrar.', codigo:'CUENTA_YA_EXISTE' });
      const problemaLegal = validarConsentimientoPrevio(consentimientos);
      if (problemaLegal) return res.status(400).json(problemaLegal);

      const usuario = await pg.crearUsuario({ nombre, celular, ciudad, correo, permisos:permisosCompletos });
      const password_hash = await auth.hashPassword(password);
      await pg.pool.query('update usuarios set password_hash=$1 where id=$2',[password_hash,usuario.id]);
      const consentimientosGuardados = await legal.registrarConsentimientos(usuario.id, consentimientos, {
        jurisdiccion:legal_meta.jurisdiccion || 'CO', version_app:legal_meta.version_app || null,
        plataforma:legal_meta.plataforma || plataforma || null, locale:legal_meta.locale || null,
        metodo:'checkbox_onboarding', evidencia:{ origen:'registro_usuario', consentimiento_previo:true },
      });
      const sesion = await auth.crearSesion(usuario.id,{dispositivo,plataforma:plataforma || legal_meta.plataforma});
      return res.status(201).json({ usuario, existente:false, consentimientos:consentimientosGuardados, ...sesion });
    }

    const db=readDb();
    if (db.usuarios.find(u=>String(u.correo).toLowerCase()===String(correo).toLowerCase())) return res.status(409).json({error:'Ya existe una cuenta con ese correo.'});
    const problemaLegal=validarConsentimientoPrevio(consentimientos); if(problemaLegal)return res.status(400).json(problemaLegal);
    const usuario={id:nanoid(10),nombre,celular:celular||null,ciudad:ciudad||null,correo,permisos:permisosCompletos,creado_en:new Date().toISOString()};
    db.usuarios.push(usuario);writeDb(db);res.status(201).json({usuario,existente:false,consentimiento_previo:true});
  } catch(err){console.error(err);res.status(500).json({error:'no se pudo registrar el usuario'});}
});

router.get('/:id', async(req,res)=>{
  if(!req.auth || String(req.auth.usuario_id)!==String(req.params.id))return res.status(403).json({error:'cuenta no autorizada'});
  try{if(pg.habilitado){const usuario=await pg.buscarUsuarioPorId(req.params.id);if(!usuario)return res.status(404).json({error:'usuario no encontrado'});return res.json({usuario});}const db=readDb();const usuario=db.usuarios.find(u=>u.id===req.params.id);if(!usuario)return res.status(404).json({error:'usuario no encontrado'});res.json({usuario});}catch(err){console.error(err);res.status(500).json({error:'no se pudo consultar el usuario'});}
});

module.exports=router;
