# Yalisto — backend (arranque)

API real y probada — no es una simulación. Funciona en dos modos:

- **Sin configurar nada**: guarda todo en `data/db.json` (se crea solo). Así
  la probé — de punta a punta, funciona.
- **Con `DATABASE_URL` configurada** (la cadena de conexión que da
  Supabase): usa Postgres de verdad automáticamente — no hay que cambiar
  código ni avisarle nada más. `src/db-postgres.js` se activa solo.

## Correrla

```
npm install
npm start
```

Queda escuchando en `http://localhost:3000`.

## Conectar con Supabase (cuando esté lista la cuenta)

1. En Supabase → SQL Editor, correr `supabase/schema.sql` (crea las tres
   tablas: usuarios, solicitudes, recordatorios).
2. Copiar la cadena de conexión (Project Settings → Database → Connection
   string → modo "URI").
3. Ponerla como `DATABASE_URL` en las variables de entorno — en local, en
   `.env`; en Render, en el panel de la variable (ver `render.yaml`).
4. Reiniciar el servidor. Ya está escribiendo en Postgres, no en el archivo.

## Desplegar en Render

El archivo `render.yaml` ya tiene la configuración lista (Render lo detecta
solo al conectar el repositorio). Solo falta pegar el valor de
`DATABASE_URL` en el panel de Render una vez exista.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/api/usuarios` | Registro (nombre, celular, ciudad, correo, permisos) |
| GET | `/api/usuarios/:id` | Ver un usuario |
| POST | `/api/solicitudes` | El usuario cuenta su problema en texto libre — se clasifica solo |
| GET | `/api/solicitudes?usuario_id=` | Listar sus solicitudes |
| PATCH | `/api/solicitudes/:id` | Cambiar estado (pendiente / en_proceso / resuelto) |
| POST | `/api/recordatorios` | Crear un recordatorio con fecha |
| GET | `/api/recordatorios?usuario_id=` | Para pintar el calendario |
| GET | `/api/recordatorios/proximos?usuario_id=&dias=7` | Los que vencen pronto — de aquí saldrían las notificaciones |

Probado de punta a punta en modo archivo: registro → crear solicitud → se
clasifica sola como "legal" ⚖️ → crear recordatorio → listar todo. El modo
Postgres pasó la revisión de sintaxis de cada archivo, pero no lo pude
probar contra una base de datos real porque todavía no existe una
conectada — en cuanto la haya, se prueba igual que se probó la de archivo.

## Lo que falta para que sea el Yalisto completo

1. **Entender lenguaje real, no solo palabras clave** — `src/intent.js` hoy
   solo busca palabras como "soat" o "abogado". Para que entienda frases
   como las reales, ahí se conecta un modelo de lenguaje (por ejemplo la
   API de Claude — docs.claude.com) que reciba el texto y devuelva
   categoría + qué necesita.
2. **Notificaciones de verdad** — hoy `/api/recordatorios/proximos` solo
   devuelve la lista; falta un proceso que corra todos los días y mande
   la notificación push / SMS / llamada real (Firebase Cloud Messaging
   para push, Twilio para SMS/llamadas, por ejemplo).
3. **Las integraciones reales** — aseguradoras para SOAT, la EPS,
   directorios de abogados, etc. Cada una es una negociación/acuerdo
   aparte con esa empresa o entidad; ningún desarrollo por sí solo las
   reemplaza.
