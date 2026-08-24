const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const { clasificar } = require('../intent');
const pg = require('../db-postgres');

const router = express.Router();

router.post('/', async (req, res) => {
  const usuario_id=req.auth?.usuario_id || req.body?.usuario_id;
  const { texto }=req.body || {};
  if (!usuario_id || !texto) return res.status(400).json({ error:'usuario_id y texto son obligatorios' });
  const { categoria,icono }=clasificar(texto);
  try {
    if (pg.habilitado) return res.status(201).json({ solicitud:await pg.crearSolicitud({usuario_id,texto,categoria,icono}) });
    const db=readDb(); const solicitud={id:nanoid(10),usuario_id,texto,categoria,icono,estado:'pendiente',creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString()};
    db.solicitudes.push(solicitud); writeDb(db); res.status(201).json({solicitud});
  } catch(err){console.error(err);res.status(500).json({error:'no se pudo crear la solicitud'});}
});

router.get('/', async (req,res)=>{
  const usuario_id=req.auth?.usuario_id;
  const {estado}=req.query;
  if(!usuario_id)return res.status(401).json({error:'sesión requerida'});
  try {
    if(pg.habilitado)return res.json({solicitudes:await pg.listarSolicitudes({usuario_id,estado})});
    const db=readDb(); let lista=db.solicitudes.filter(s=>s.usuario_id===usuario_id); if(estado)lista=lista.filter(s=>s.estado===estado); lista=[...lista].sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en)); res.json({solicitudes:lista});
  } catch(err){console.error(err);res.status(500).json({error:'no se pudieron listar las solicitudes'});}
});

router.patch('/:id', async(req,res)=>{
  const {estado}=req.body||{}; const permitido=['pendiente','en_proceso','resuelto'];
  if(!permitido.includes(estado))return res.status(400).json({error:`estado debe ser uno de: ${permitido.join(', ')}`});
  const usuario_id=req.auth?.usuario_id;
  try {
    if(pg.habilitado){
      const own=await pg.pool.query('select id from solicitudes where id=$1 and usuario_id=$2',[req.params.id,usuario_id]);
      if(!own.rows[0])return res.status(404).json({error:'solicitud no encontrada'});
      const solicitud=await pg.actualizarEstadoSolicitud(req.params.id,estado); return res.json({solicitud});
    }
    const db=readDb(); const solicitud=db.solicitudes.find(s=>s.id===req.params.id&&s.usuario_id===usuario_id); if(!solicitud)return res.status(404).json({error:'solicitud no encontrada'}); solicitud.estado=estado; solicitud.actualizado_en=new Date().toISOString(); writeDb(db); res.json({solicitud});
  } catch(err){console.error(err);res.status(500).json({error:'no se pudo actualizar la solicitud'});}
});

module.exports=router;
