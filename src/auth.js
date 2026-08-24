const crypto = require('crypto');
const pg = require('./db-postgres');

function hashToken(token='') {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function crearSesion(usuario_id, meta={}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const token_hash = hashToken(token);
  const expira_en = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await pg.pool.query(
    `insert into sesiones_usuario (usuario_id,token_hash,dispositivo,plataforma,expira_en)
     values ($1,$2,$3,$4,$5)`,
    [usuario_id, token_hash, meta.dispositivo || null, meta.plataforma || null, expira_en]
  );
  return { token, expira_en };
}

async function obtenerSesion(token) {
  if (!token) return null;
  const token_hash = hashToken(token);
  const { rows } = await pg.pool.query(
    `select s.id as sesion_id,s.usuario_id,s.expira_en,u.*
       from sesiones_usuario s
       join usuarios u on u.id=s.usuario_id
      where s.token_hash=$1
        and s.revocado_en is null
        and (s.expira_en is null or s.expira_en > now())
      limit 1`,
    [token_hash]
  );
  if (!rows[0]) return null;
  pg.pool.query(`update sesiones_usuario set ultimo_uso_en=now() where id=$1`,[rows[0].sesion_id]).catch(()=>{});
  return rows[0];
}

async function revocarSesion(token) {
  if (!token) return;
  await pg.pool.query(`update sesiones_usuario set revocado_en=now() where token_hash=$1`,[hashToken(token)]);
}

function bearer(req) {
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function middleware(req,res,next) {
  try {
    const token = bearer(req);
    const sesion = await obtenerSesion(token);
    if (!sesion) return res.status(401).json({ error:'sesión requerida', codigo:'SESION_REQUERIDA' });
    req.auth = { usuario_id:sesion.usuario_id, sesion_id:sesion.sesion_id, token, usuario:sesion };

    const bodyId = req.body && req.body.usuario_id ? String(req.body.usuario_id) : null;
    const queryId = req.query && req.query.usuario_id ? String(req.query.usuario_id) : null;
    if ((bodyId && bodyId !== String(sesion.usuario_id)) || (queryId && queryId !== String(sesion.usuario_id))) {
      return res.status(403).json({ error:'no puedes acceder a datos de otra cuenta', codigo:'CUENTA_NO_AUTORIZADA' });
    }
    next();
  } catch (err) {
    console.error('Auth middleware:',err);
    res.status(500).json({ error:'no se pudo validar la sesión' });
  }
}

module.exports = { crearSesion, obtenerSesion, revocarSesion, bearer, middleware, hashToken };
