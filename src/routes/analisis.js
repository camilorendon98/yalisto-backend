const express = require('express');
const pg = require('../db-postgres');
const personalizacion = require('../personalizacion');

const router = express.Router();

function insight(tipo, titulo, detalle, dominio='general', confianza=0.7) {
  return { tipo, titulo, detalle, dominio, confianza };
}

router.get('/resumen', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try {
    const usuario = await pg.buscarUsuarioPorId(usuario_id);
    if (!usuario) return res.status(404).json({ error:'usuario no encontrado' });

    const [animos, compromisos, personas, memoria, guardados] = await Promise.all([
      personalizacion.listarEstadosAnimo(usuario_id, 30),
      pg.listarCompromisos(usuario_id, null, 100),
      pg.listarPersonas(usuario_id),
      pg.listarMemoria(usuario_id, null, 100),
      pg.pool.query(`select * from insights_personales where usuario_id=$1 and estado <> 'descartado' order by creado_en desc limit 20`, [usuario_id]),
    ]);

    const activos = compromisos.filter((c) => !['resuelto','cancelado'].includes(c.estado));
    const promesas = compromisos.filter((c) => c.tipo_compromiso === 'promesa' && !['resuelto','cancelado'].includes(c.estado));
    const conteoAnimos = animos.reduce((acc,a)=>{ acc[a.estado]=(acc[a.estado]||0)+1; return acc; },{});
    const derivados = [];

    const carga = activos.length;
    if (carga >= 5) derivados.push(insight('patron','Carga alta de pendientes',`Tienes ${carga} misiones activas. Yalisto puede ayudarte a escoger una sola prioridad primero.`,'trabajo',0.95));
    const estres = (conteoAnimos.estresado||0) + (conteoAnimos.abrumado||0) + (conteoAnimos.cansado||0);
    if (estres >= 3) derivados.push(insight('cambio','Cansancio o tensión repetida',`En tus registros recientes aparecen ${estres} reportes entre cansancio, estrés o sensación de estar abrumado. No es un diagnóstico; es una tendencia de tus propios registros.`,'bienestar',0.9));
    if (promesas.length) derivados.push(insight('detectado','Promesas personales activas',`Tienes ${promesas.length} promesa${promesas.length===1?'':'s'} personal${promesas.length===1?'':'es'} todavía abierta${promesas.length===1?'':'s'}.`,'metas',0.95));
    if (personas.length >= 3) derivados.push(insight('detectado','Tu mapa de personas está creciendo',`Yalisto ya reconoce ${personas.length} personas de tu contexto. Esto permite entender mejor referencias como “mi mamá”, “mi cliente” o “mi pareja”.`,'relaciones',0.95));

    res.json({
      periodo_dias:30,
      animo:{ total:animos.length, conteo:conteoAnimos, registros:animos.slice(0,14) },
      misiones:{ activas:carga, promesas_activas:promesas.length, total:compromisos.length },
      mapa:{ personas:personas.length, recuerdos:memoria.length },
      insights:[...derivados, ...guardados.rows].slice(0,20),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'no se pudo construir el análisis personal' });
  }
});

router.post('/conoceme', async (req,res) => {
  const { usuario_id, categoria='personalidad', pregunta, respuesta, clave=null } = req.body || {};
  if (!usuario_id || !pregunta || !respuesta) return res.status(400).json({ error:'usuario_id, pregunta y respuesta son obligatorios' });
  try {
    const { rows } = await pg.pool.query(
      `insert into perfil_respuestas (usuario_id,categoria,pregunta,respuesta,clave) values ($1,$2,$3,$4,$5) returning *`,
      [usuario_id,categoria,pregunta,respuesta,clave]
    );
    await pg.guardarMemoria({ usuario_id, tipo:'perfil', clave, titulo:pregunta, valor:{ respuesta, categoria }, fuente:'usuario', confirmado_por_usuario:true });
    res.status(201).json({ respuesta_perfil:rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo guardar esta respuesta' }); }
});

router.get('/conoceme', async (req,res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try {
    const { rows }=await pg.pool.query(`select * from perfil_respuestas where usuario_id=$1 order by creado_en desc`,[usuario_id]);
    const categorias = new Set(rows.map((r)=>r.categoria));
    const objetivo=10;
    res.json({ respuestas:rows, progreso:Math.min(100,Math.round((categorias.size/objetivo)*100)), categorias_completadas:[...categorias] });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo consultar tu perfil' }); }
});

router.post('/proteccion', async (req,res) => {
  const { usuario_id, disparador, recordatorio, dominio='general' }=req.body||{};
  if (!usuario_id || !disparador || !recordatorio) return res.status(400).json({ error:'faltan datos de la regla de protección' });
  try {
    const { rows }=await pg.pool.query(`insert into reglas_proteccion (usuario_id,disparador,recordatorio,dominio) values ($1,$2,$3,$4) returning *`,[usuario_id,disparador,recordatorio,dominio]);
    res.status(201).json({ regla:rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo guardar la regla de protección' }); }
});

router.get('/proteccion', async (req,res) => {
  const { usuario_id }=req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try {
    const { rows }=await pg.pool.query(`select * from reglas_proteccion where usuario_id=$1 and activa=true order by creado_en desc`,[usuario_id]);
    res.json({ reglas:rows });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudieron consultar las reglas' }); }
});

router.post('/diario', async (req,res) => {
  const { usuario_id, contenido, origen='texto' }=req.body||{};
  if (!usuario_id || !contenido) return res.status(400).json({ error:'usuario_id y contenido son obligatorios' });
  try {
    const { rows }=await pg.pool.query(`insert into diario_entradas (usuario_id,contenido,origen) values ($1,$2,$3) returning *`,[usuario_id,contenido,origen]);
    res.status(201).json({ entrada:rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo guardar el diario' }); }
});

router.get('/historia', async (req,res) => {
  const { usuario_id }=req.query;
  if (!usuario_id) return res.status(400).json({ error:'usuario_id es obligatorio' });
  try {
    const [diario,mensajes,compromisos]=await Promise.all([
      pg.pool.query(`select id,contenido as titulo,'diario' as tipo,creado_en from diario_entradas where usuario_id=$1 order by creado_en desc limit 40`,[usuario_id]),
      pg.pool.query(`select id,contenido as titulo,'conversacion' as tipo,creado_en from mensajes where usuario_id=$1 and rol='user' order by creado_en desc limit 40`,[usuario_id]),
      pg.pool.query(`select id,titulo,'mision' as tipo,creado_en from compromisos where usuario_id=$1 order by creado_en desc limit 40`,[usuario_id]),
    ]);
    const historia=[...diario.rows,...mensajes.rows,...compromisos.rows].sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en)).slice(0,80);
    res.json({ historia });
  } catch (err) { console.error(err); res.status(500).json({ error:'no se pudo construir la historia' }); }
});

module.exports=router;
