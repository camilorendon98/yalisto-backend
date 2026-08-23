const pg = require('./db-postgres');

const JURISDICCION_DEFAULT = 'CO';

function operadorLegal() {
  return {
    nombre: process.env.LEGAL_ENTITY_NAME || 'Yalisto — operador legal por completar antes del lanzamiento comercial',
    nit: process.env.LEGAL_ENTITY_NIT || null,
    domicilio: process.env.LEGAL_ENTITY_CITY || 'Colombia',
    direccion: process.env.LEGAL_ENTITY_ADDRESS || null,
    correo_privacidad: process.env.LEGAL_PRIVACY_EMAIL || null,
    canal_soporte: process.env.LEGAL_SUPPORT_EMAIL || null,
    configuracion_completa: Boolean(process.env.LEGAL_ENTITY_NAME && process.env.LEGAL_PRIVACY_EMAIL),
  };
}

async function documentosVigentes(jurisdiccion = JURISDICCION_DEFAULT) {
  const { rows } = await pg.pool.query(
    `select id,codigo,version,jurisdiccion,titulo,resumen,contenido_markdown,obligatorio,sensible,vigencia_desde
     from legal_documents
     where jurisdiccion=$1 and vigente=true
     order by case codigo when 'terminos' then 1 when 'privacidad' then 2 when 'autorizacion_datos' then 3 when 'autorizacion_sensibles' then 4 else 10 end`,
    [jurisdiccion]
  );
  return rows;
}

async function registrarConsentimientos(usuario_id, consentimientos = [], meta = {}) {
  if (!usuario_id || !Array.isArray(consentimientos) || !consentimientos.length) return [];
  const documentos = await documentosVigentes(meta.jurisdiccion || JURISDICCION_DEFAULT);
  const mapa = new Map(documentos.map((d) => [d.codigo, d]));
  const guardados = [];
  for (const c of consentimientos) {
    const doc = mapa.get(c.codigo);
    if (!doc) continue;
    const aceptado = Boolean(c.aceptado);
    if (doc.obligatorio && !aceptado) continue;
    const { rows } = await pg.pool.query(
      `insert into consentimientos_usuario
       (usuario_id,documento_id,aceptado,metodo,version_app,plataforma,locale,evidencia)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        usuario_id,
        doc.id,
        aceptado,
        meta.metodo || 'checkbox_app',
        meta.version_app || null,
        meta.plataforma || null,
        meta.locale || null,
        JSON.stringify({ version_documento:doc.version, jurisdiccion:doc.jurisdiccion, ...meta.evidencia }),
      ]
    );
    guardados.push(rows[0]);
  }
  return guardados;
}

async function consentimientosUsuario(usuario_id) {
  const { rows } = await pg.pool.query(
    `select cu.id,ld.codigo,ld.titulo,ld.version,ld.jurisdiccion,cu.aceptado,cu.aceptado_en,cu.revocado_en,cu.version_app,cu.plataforma
     from consentimientos_usuario cu
     join legal_documents ld on ld.id=cu.documento_id
     where cu.usuario_id=$1
     order by cu.aceptado_en desc`,
    [usuario_id]
  );
  return rows;
}

async function estadoLegalUsuario(usuario_id) {
  const [docs, consentimientos] = await Promise.all([documentosVigentes(), consentimientosUsuario(usuario_id)]);
  const ultimos = new Map();
  for (const c of consentimientos) if (!ultimos.has(c.codigo)) ultimos.set(c.codigo, c);
  const faltantes = docs.filter((d) => d.obligatorio).filter((d) => {
    const c = ultimos.get(d.codigo);
    return !c || !c.aceptado || c.revocado_en || c.version !== d.version;
  }).map((d) => ({ codigo:d.codigo, version:d.version, titulo:d.titulo }));
  return { al_dia:faltantes.length===0, faltantes, consentimientos };
}

module.exports = { operadorLegal, documentosVigentes, registrarConsentimientos, consentimientosUsuario, estadoLegalUsuario };
