const express = require('express');
const pg = require('../db-postgres');

const router = express.Router();
const requerido=(v)=>v!==undefined&&v!==null&&String(v).trim()!=='';
const uid=(req)=>req.auth?.usuario_id;

router.get('/resumen',async(req,res)=>{const usuario_id=uid(req);try{const usuario=await pg.buscarUsuarioPorId(usuario_id);if(!usuario)return res.status(404).json({error:'usuario no encontrado'});res.json({usuario,...(await pg.resumenVida(usuario_id))});}catch(err){console.error(err);res.status(500).json({error:'no se pudo construir el resumen de vida'});}});

router.get('/memoria',async(req,res)=>{const usuario_id=uid(req);const{tipo}=req.query;try{res.json({memoria:await pg.listarMemoria(usuario_id,tipo||null,150)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo consultar la memoria'});}});
router.post('/memoria',async(req,res)=>{const usuario_id=uid(req);const{tipo,clave,titulo,valor,fuente,confianza,confirmado_por_usuario}=req.body||{};if(!requerido(tipo))return res.status(400).json({error:'tipo es obligatorio'});try{const item=await pg.guardarMemoria({usuario_id,tipo,clave:clave||null,titulo:titulo||null,valor:valor||{},fuente:fuente||'usuario',confianza:confianza===undefined?1:Number(confianza),confirmado_por_usuario:confirmado_por_usuario!==false});res.status(201).json({memoria:item});}catch(err){console.error(err);res.status(500).json({error:'no se pudo guardar en memoria'});}});

router.get('/compromisos',async(req,res)=>{const usuario_id=uid(req);const{estado}=req.query;try{res.json({compromisos:await pg.listarCompromisos(usuario_id,estado||null,100)});}catch(err){console.error(err);res.status(500).json({error:'no se pudieron consultar los compromisos'});}});
router.post('/compromisos',async(req,res)=>{const datos={...(req.body||{}),usuario_id:uid(req)};if(!requerido(datos.titulo))return res.status(400).json({error:'titulo es obligatorio'});try{res.status(201).json({compromiso:await pg.crearCompromiso(datos)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo crear el compromiso'});}});
router.patch('/compromisos/:id',async(req,res)=>{const{estado}=req.body||{};const permitidos=['pendiente','en_proceso','esperando_usuario','resuelto','cancelado'];if(!permitidos.includes(estado))return res.status(400).json({error:`estado debe ser uno de: ${permitidos.join(', ')}`});try{const own=await pg.pool.query('select id from compromisos where id=$1 and usuario_id=$2',[req.params.id,uid(req)]);if(!own.rows[0])return res.status(404).json({error:'compromiso no encontrado'});const compromiso=await pg.actualizarEstadoCompromiso(req.params.id,estado);res.json({compromiso});}catch(err){console.error(err);res.status(500).json({error:'no se pudo actualizar el compromiso'});}});

router.get('/personas',async(req,res)=>{try{res.json({personas:await pg.listarPersonas(uid(req))});}catch(err){console.error(err);res.status(500).json({error:'no se pudieron consultar las personas'});}});
router.post('/personas',async(req,res)=>{const datos={...(req.body||{}),usuario_id:uid(req)};if(!requerido(datos.nombre))return res.status(400).json({error:'nombre es obligatorio'});try{res.status(201).json({persona:await pg.crearPersona(datos)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo guardar la persona'});}});

router.get('/vehiculos',async(req,res)=>{try{res.json({vehiculos:await pg.listarVehiculos(uid(req))});}catch(err){console.error(err);res.status(500).json({error:'no se pudieron consultar los vehículos'});}});
router.post('/vehiculos',async(req,res)=>{const datos={...(req.body||{}),usuario_id:uid(req)};try{res.status(201).json({vehiculo:await pg.crearVehiculo(datos)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo guardar el vehículo'});}});

router.get('/agenda',async(req,res)=>{const usuario_id=uid(req);const{desde,hasta}=req.query;const inicio=desde||new Date().toISOString();const fin=hasta||new Date(Date.now()+90*24*60*60*1000).toISOString();try{const[eventos,recordatorios]=await Promise.all([pg.listarEventosAgenda(usuario_id,inicio,fin),pg.listarRecordatorios(usuario_id)]);res.json({eventos,recordatorios});}catch(err){console.error(err);res.status(500).json({error:'no se pudo consultar la agenda'});}});
router.post('/agenda',async(req,res)=>{const datos={...(req.body||{}),usuario_id:uid(req)};if(!requerido(datos.titulo)||!requerido(datos.inicia_en))return res.status(400).json({error:'titulo e inicia_en son obligatorios'});try{res.status(201).json({evento:await pg.crearEventoAgenda(datos)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo crear el evento'});}});

router.get('/archivos',async(req,res)=>{try{res.json({archivos:await pg.listarArchivosMetadata(uid(req),150)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo consultar la bóveda'});}});
router.post('/archivos',async(req,res)=>{const datos={...(req.body||{}),usuario_id:uid(req)};if(!requerido(datos.nombre))return res.status(400).json({error:'nombre es obligatorio'});try{res.status(201).json({archivo:await pg.crearArchivoMetadata(datos)});}catch(err){console.error(err);res.status(500).json({error:'no se pudo registrar el archivo'});}});

module.exports=router;
