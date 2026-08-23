// db-postgres.js
// Capa de datos real sobre Postgres (Supabase).

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function crearUsuario({ nombre, celular, ciudad, correo, permisos }) {
  const { rows } = await pool.query(
    `insert into usuarios (nombre, celular, ciudad, correo, permisos)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [nombre, celular || null, ciudad || null, correo, JSON.stringify(permisos)]
  );
  return rows[0];
}

async function buscarUsuarioPorCorreo(correo) {
  const { rows } = await pool.query('select * from usuarios where lower(correo) = lower($1)', [correo]);
  return rows[0] || null;
}

async function buscarUsuarioPorId(id) {
  const { rows } = await pool.query('select * from usuarios where id = $1', [id]);
  return rows[0] || null;
}

async function crearSolicitud({ usuario_id, texto, categoria, icono, titulo = null, prioridad = 'normal' }) {
  const { rows } = await pool.query(
    `insert into solicitudes (usuario_id, texto, categoria, icono, titulo, prioridad)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [usuario_id, texto, categoria, icono, titulo, prioridad]
  );
  return rows[0];
}

async function listarSolicitudes({ usuario_id, estado }) {
  const condiciones = [];
  const valores = [];
  if (usuario_id) { valores.push(usuario_id); condiciones.push(`usuario_id = $${valores.length}`); }
  if (estado) { valores.push(estado); condiciones.push(`estado = $${valores.length}`); }
  const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';
  const { rows } = await pool.query(`select * from solicitudes ${where} order by creado_en desc`, valores);
  return rows;
}

async function actualizarEstadoSolicitud(id, estado) {
  const { rows } = await pool.query(
    `update solicitudes set estado = $1, actualizado_en = now() where id = $2 returning *`,
    [estado, id]
  );
  return rows[0] || null;
}

async function actualizarRespuestaSolicitud(id, respuesta) {
  const { rows } = await pool.query(
    `update solicitudes set respuesta = $1, actualizado_en = now() where id = $2 returning *`,
    [respuesta, id]
  );
  return rows[0] || null;
}

async function crearMensaje({ usuario_id, solicitud_id = null, rol, contenido }) {
  const { rows } = await pool.query(
    `insert into mensajes (usuario_id, solicitud_id, rol, contenido)
     values ($1, $2, $3, $4) returning *`,
    [usuario_id, solicitud_id, rol, contenido]
  );
  return rows[0];
}

async function listarMensajes(usuario_id, limite = 80) {
  const { rows } = await pool.query(
    `select * from mensajes where usuario_id = $1 order by creado_en asc limit $2`,
    [usuario_id, Math.max(1, Math.min(Number(limite) || 80, 200))]
  );
  return rows;
}

async function crearRecordatorio({ usuario_id, titulo, fecha, icono, compromiso_id = null, hora = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into recordatorios (usuario_id, titulo, fecha, icono, compromiso_id, hora, metadata)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [usuario_id, titulo, fecha, icono || '🔔', compromiso_id, hora, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarRecordatorios(usuario_id) {
  const { rows } = await pool.query(
    `select * from recordatorios ${usuario_id ? 'where usuario_id = $1' : ''} order by fecha asc, hora asc nulls last`,
    usuario_id ? [usuario_id] : []
  );
  return rows;
}

async function listarRecordatoriosProximos(usuario_id, dias = 14) {
  const { rows } = await pool.query(
    `select * from recordatorios
     where usuario_id = $1
       and fecha between current_date and current_date + ($2 || ' days')::interval
     order by fecha asc, hora asc nulls last`,
    [usuario_id, Number(dias) || 14]
  );
  return rows;
}

async function crearCompromiso({ usuario_id, titulo, descripcion = null, categoria = 'general', estado = 'pendiente', prioridad = 'normal', fecha_limite = null, solicitud_id = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into compromisos (usuario_id, titulo, descripcion, categoria, estado, prioridad, fecha_limite, solicitud_id, metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [usuario_id, titulo, descripcion, categoria, estado, prioridad, fecha_limite, solicitud_id, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarCompromisos(usuario_id, estado = null, limite = 50) {
  const params = [usuario_id];
  let where = 'where usuario_id = $1';
  if (estado) { params.push(estado); where += ` and estado = $${params.length}`; }
  params.push(Math.max(1, Math.min(Number(limite) || 50, 200)));
  const { rows } = await pool.query(
    `select * from compromisos ${where}
     order by case prioridad when 'urgente' then 1 when 'alta' then 2 when 'normal' then 3 else 4 end,
              fecha_limite asc nulls last, creado_en desc
     limit $${params.length}`,
    params
  );
  return rows;
}

async function actualizarEstadoCompromiso(id, estado) {
  const resuelto = estado === 'resuelto';
  const { rows } = await pool.query(
    `update compromisos
     set estado = $1,
         actualizado_en = now(),
         resuelto_en = case when $2 then coalesce(resuelto_en, now()) else null end
     where id = $3 returning *`,
    [estado, resuelto, id]
  );
  return rows[0] || null;
}

async function guardarMemoria({ usuario_id, tipo, clave = null, titulo = null, valor = {}, fuente = 'usuario', confianza = 1, confirmado_por_usuario = true }) {
  const { rows } = await pool.query(
    `insert into memoria_items (usuario_id, tipo, clave, titulo, valor, fuente, confianza, confirmado_por_usuario)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [usuario_id, tipo, clave, titulo, JSON.stringify(valor), fuente, confianza, confirmado_por_usuario]
  );
  return rows[0];
}

async function listarMemoria(usuario_id, tipo = null, limite = 100) {
  const params = [usuario_id];
  let where = 'where usuario_id = $1 and vigente = true';
  if (tipo) { params.push(tipo); where += ` and tipo = $${params.length}`; }
  params.push(Math.max(1, Math.min(Number(limite) || 100, 300)));
  const { rows } = await pool.query(
    `select * from memoria_items ${where} order by actualizado_en desc limit $${params.length}`,
    params
  );
  return rows;
}

async function crearPersona({ usuario_id, nombre, relacion = null, telefono = null, correo = null, fecha_importante = null, notas = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into personas (usuario_id,nombre,relacion,telefono,correo,fecha_importante,notas,metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [usuario_id,nombre,relacion,telefono,correo,fecha_importante,notas,JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarPersonas(usuario_id) {
  const { rows } = await pool.query('select * from personas where usuario_id = $1 order by nombre asc', [usuario_id]);
  return rows;
}

async function crearVehiculo({ usuario_id, placa = null, marca = null, linea = null, modelo = null, tipo = null, soat_vence = null, tecnomecanica_vence = null, seguro_vence = null, notas = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into vehiculos (usuario_id,placa,marca,linea,modelo,tipo,soat_vence,tecnomecanica_vence,seguro_vence,notas,metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [usuario_id,placa,marca,linea,modelo,tipo,soat_vence,tecnomecanica_vence,seguro_vence,notas,JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarVehiculos(usuario_id) {
  const { rows } = await pool.query('select * from vehiculos where usuario_id = $1 order by creado_en desc', [usuario_id]);
  return rows;
}

async function crearEventoAgenda({ usuario_id, titulo, descripcion = null, categoria = 'general', inicia_en, termina_en = null, todo_el_dia = false, origen = 'yalisto', compromiso_id = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into eventos_agenda (usuario_id,titulo,descripcion,categoria,inicia_en,termina_en,todo_el_dia,origen,compromiso_id,metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [usuario_id,titulo,descripcion,categoria,inicia_en,termina_en,todo_el_dia,origen,compromiso_id,JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarEventosAgenda(usuario_id, desde, hasta) {
  const { rows } = await pool.query(
    `select * from eventos_agenda
     where usuario_id = $1 and inicia_en >= $2 and inicia_en < $3 and estado = 'activo'
     order by inicia_en asc`,
    [usuario_id, desde, hasta]
  );
  return rows;
}

async function crearArchivoMetadata({ usuario_id, nombre, mime_type = null, tamano = null, storage_path = null, categoria = 'general', descripcion = null, fecha_documento = null, fecha_vencimiento = null, solicitud_id = null, compromiso_id = null, metadata = {} }) {
  const { rows } = await pool.query(
    `insert into archivos (usuario_id,nombre,mime_type,tamano,storage_path,categoria,descripcion,fecha_documento,fecha_vencimiento,solicitud_id,compromiso_id,metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [usuario_id,nombre,mime_type,tamano,storage_path,categoria,descripcion,fecha_documento,fecha_vencimiento,solicitud_id,compromiso_id,JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listarArchivosMetadata(usuario_id, limite = 100) {
  const { rows } = await pool.query(
    `select * from archivos where usuario_id = $1 order by creado_en desc limit $2`,
    [usuario_id, Math.max(1, Math.min(Number(limite) || 100, 300))]
  );
  return rows;
}

async function listarAccionesPendientes(usuario_id, limite = 20) {
  const { rows } = await pool.query(
    `select * from acciones_agente
     where usuario_id = $1 and estado in ('propuesta','esperando_autorizacion','autorizada','ejecutando')
     order by creado_en desc limit $2`,
    [usuario_id, Math.max(1, Math.min(Number(limite) || 20, 100))]
  );
  return rows;
}

async function resumenVida(usuario_id) {
  const [compromisos, recordatorios, acciones, memoria] = await Promise.all([
    listarCompromisos(usuario_id, null, 8),
    listarRecordatoriosProximos(usuario_id, 30),
    listarAccionesPendientes(usuario_id, 8),
    listarMemoria(usuario_id, null, 8),
  ]);
  return { compromisos, recordatorios, acciones, memoria };
}

module.exports = {
  habilitado: Boolean(process.env.DATABASE_URL),
  pool,
  crearUsuario,
  buscarUsuarioPorCorreo,
  buscarUsuarioPorId,
  crearSolicitud,
  listarSolicitudes,
  actualizarEstadoSolicitud,
  actualizarRespuestaSolicitud,
  crearMensaje,
  listarMensajes,
  crearRecordatorio,
  listarRecordatorios,
  listarRecordatoriosProximos,
  crearCompromiso,
  listarCompromisos,
  actualizarEstadoCompromiso,
  guardarMemoria,
  listarMemoria,
  crearPersona,
  listarPersonas,
  crearVehiculo,
  listarVehiculos,
  crearEventoAgenda,
  listarEventosAgenda,
  crearArchivoMetadata,
  listarArchivosMetadata,
  listarAccionesPendientes,
  resumenVida,
};
