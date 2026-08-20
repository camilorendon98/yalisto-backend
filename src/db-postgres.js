// db-postgres.js
// Capa de datos real sobre Postgres (Supabase). Se activa sola cuando existe
// la variable de entorno DATABASE_URL — si no existe, el resto de la app
// sigue usando el archivo JSON (db.js) sin que haya que tocar nada más.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase exige SSL
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
  const { rows } = await pool.query('select * from usuarios where correo = $1', [correo]);
  return rows[0] || null;
}

async function buscarUsuarioPorId(id) {
  const { rows } = await pool.query('select * from usuarios where id = $1', [id]);
  return rows[0] || null;
}

async function crearSolicitud({ usuario_id, texto, categoria, icono }) {
  const { rows } = await pool.query(
    `insert into solicitudes (usuario_id, texto, categoria, icono)
     values ($1, $2, $3, $4) returning *`,
    [usuario_id, texto, categoria, icono]
  );
  return rows[0];
}

async function listarSolicitudes({ usuario_id, estado }) {
  const condiciones = [];
  const valores = [];
  if (usuario_id) { valores.push(usuario_id); condiciones.push(`usuario_id = $${valores.length}`); }
  if (estado) { valores.push(estado); condiciones.push(`estado = $${valores.length}`); }
  const where = condiciones.length ? `where ${condiciones.join(' and ')}` : '';
  const { rows } = await pool.query(
    `select * from solicitudes ${where} order by creado_en desc`,
    valores
  );
  return rows;
}

async function actualizarEstadoSolicitud(id, estado) {
  const { rows } = await pool.query(
    `update solicitudes set estado = $1, actualizado_en = now() where id = $2 returning *`,
    [estado, id]
  );
  return rows[0] || null;
}

async function crearRecordatorio({ usuario_id, titulo, fecha, icono }) {
  const { rows } = await pool.query(
    `insert into recordatorios (usuario_id, titulo, fecha, icono)
     values ($1, $2, $3, $4) returning *`,
    [usuario_id, titulo, fecha, icono || '🔔']
  );
  return rows[0];
}

async function listarRecordatorios(usuario_id) {
  const { rows } = await pool.query(
    `select * from recordatorios ${usuario_id ? 'where usuario_id = $1' : ''} order by fecha asc`,
    usuario_id ? [usuario_id] : []
  );
  return rows;
}

async function listarRecordatoriosProximos(usuario_id, dias) {
  const { rows } = await pool.query(
    `select * from recordatorios
     where fecha <= (current_date + ($1 || ' days')::interval)
     ${usuario_id ? 'and usuario_id = $2' : ''}
     order by fecha asc`,
    usuario_id ? [dias, usuario_id] : [dias]
  );
  return rows;
}

module.exports = {
  habilitado: Boolean(process.env.DATABASE_URL),
  crearUsuario,
  buscarUsuarioPorCorreo,
  buscarUsuarioPorId,
  crearSolicitud,
  listarSolicitudes,
  actualizarEstadoSolicitud,
  crearRecordatorio,
  listarRecordatorios,
  listarRecordatoriosProximos,
};
