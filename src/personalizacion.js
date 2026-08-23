const pg = require('./db-postgres');

async function guardarEstadoAnimo({ usuario_id, estado, intensidad = 3, energia = 3, nota = null, ayuda_preferida = null }) {
  const { rows } = await pg.pool.query(
    `insert into estados_animo (usuario_id, estado, intensidad, energia, nota, ayuda_preferida)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [usuario_id, estado, intensidad, energia, nota, ayuda_preferida]
  );
  return rows[0];
}

async function obtenerEstadoAnimoHoy(usuario_id) {
  const { rows } = await pg.pool.query(
    `select * from estados_animo where usuario_id = $1 and fecha = current_date order by creado_en desc limit 1`,
    [usuario_id]
  );
  return rows[0] || null;
}

async function listarEstadosAnimo(usuario_id, limite = 14) {
  const { rows } = await pg.pool.query(
    `select * from estados_animo where usuario_id = $1 order by creado_en desc limit $2`,
    [usuario_id, Math.max(1, Math.min(Number(limite) || 14, 60))]
  );
  return rows;
}

async function asegurarPreferencias(usuario_id) {
  await pg.pool.query(`insert into preferencias (usuario_id) values ($1) on conflict (usuario_id) do nothing`, [usuario_id]);
}

async function obtenerPreferencias(usuario_id) {
  await asegurarPreferencias(usuario_id);
  const { rows } = await pg.pool.query(`select * from preferencias where usuario_id = $1`, [usuario_id]);
  return rows[0] || null;
}

async function guardarPreferencias(usuario_id, cambios = {}) {
  await asegurarPreferencias(usuario_id);
  const permitidos = {
    idioma: cambios.idioma,
    chat_fondo: cambios.chat_fondo,
    interfaz: cambios.interfaz,
    densidad: cambios.densidad,
    estilo_respuesta: cambios.estilo_respuesta,
    mostrar_animo_home: cambios.mostrar_animo_home,
    sombra_movil: cambios.sombra_movil,
    voz_habilitada: cambios.voz_habilitada,
    manos_libres: cambios.manos_libres,
    activacion_por_nombre: cambios.activacion_por_nombre,
    personalidad_asistente: cambios.personalidad_asistente,
    presencia_asistente: cambios.presencia_asistente,
    intensidad_notificaciones: cambios.intensidad_notificaciones,
    sonidos_interfaz: cambios.sonidos_interfaz,
    hapticos: cambios.hapticos,
    animaciones: cambios.animaciones,
    permisos_intervencion: cambios.permisos_intervencion,
    proveedor_voz: cambios.proveedor_voz,
    voz_preset: cambios.voz_preset,
    voz_velocidad: cambios.voz_velocidad,
    voz_expresividad: cambios.voz_expresividad,
    voz_auto_estado: cambios.voz_auto_estado,
  };
  const entradas = Object.entries(permitidos).filter(([, v]) => v !== undefined);
  if (!entradas.length) return obtenerPreferencias(usuario_id);

  const sets = [];
  const valores = [];
  entradas.forEach(([k, v]) => {
    valores.push(k === 'permisos_intervencion' ? JSON.stringify(v) : v);
    sets.push(`${k} = $${valores.length}${k === 'permisos_intervencion' ? '::jsonb' : ''}`);
  });
  valores.push(usuario_id);
  const { rows } = await pg.pool.query(
    `update preferencias set ${sets.join(', ')}, actualizado_en = now() where usuario_id = $${valores.length} returning *`,
    valores
  );
  return rows[0];
}

module.exports = { guardarEstadoAnimo, obtenerEstadoAnimoHoy, listarEstadosAnimo, obtenerPreferencias, guardarPreferencias };
