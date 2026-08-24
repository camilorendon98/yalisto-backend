const express = require('express');
const pg = require('../db-postgres');

const router = express.Router();
const MOTIVOS=['contenido_ofensivo','peligroso','engañoso','acoso','sexual','odio','otro'];

router.post('/ia', async(req,res)=>{
  const usuario_id=req.auth?.usuario_id;
  const {mensaje_id=null,contenido=null,motivo='contenido_ofensivo',detalle=null}=req.body||{};
  if(!MOTIVOS.includes(motivo))return res.status(400).json({error:'motivo no válido'});
  if(!contenido&&!mensaje_id)return res.status(400).json({error:'contenido o mensaje_id es obligatorio'});
  try{
    const {rows}=await pg.pool.query(
      `insert into reportes_ia (usuario_id,mensaje_id,contenido,motivo,detalle)
       values ($1,$2,$3,$4,$5) returning id,motivo,estado,creado_en`,
      [usuario_id,mensaje_id,contenido,motivo,detalle]
    );
    res.status(201).json({reporte:rows[0],mensaje:'Gracias. Recibimos el reporte para revisión y mejora de los filtros de Yalisto.'});
  }catch(err){console.error(err);res.status(500).json({error:'no se pudo enviar el reporte'});}
});

module.exports=router;
