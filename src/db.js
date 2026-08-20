// db.js
// Capa de datos MUY simple: guarda todo en un archivo JSON local.
// Sirve perfecto para desarrollar y probar la app, pero NO está pensada
// para producción con muchos usuarios al tiempo (no maneja bien escrituras
// simultáneas). Cuando la app esté lista para usuarios reales, esto se
// reemplaza por una base de datos de verdad — Postgres es la recomendación,
// y Supabase (Postgres administrado + login de usuarios ya resuelto) es la
// forma más rápida de tenerla sin gestionar un servidor aparte.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seed = { usuarios: [], solicitudes: [], recordatorios: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
