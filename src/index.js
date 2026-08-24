require('dotenv').config();
const express = require('express');
const cors = require('cors');

const usuariosRouter = require('./routes/usuarios');
const solicitudesRouter = require('./routes/solicitudes');
const recordatoriosRouter = require('./routes/recordatorios');
const asistenteRouter = require('./routes/asistente');
const vidaRouter = require('./routes/vida');
const personalizacionRouter = require('./routes/personalizacion');
const analisisRouter = require('./routes/analisis');
const vozRouter = require('./routes/voz');
const legalRouter = require('./routes/legal');
const authRouter = require('./routes/auth');
const publicRouter = require('./routes/public');
const reportesRouter = require('./routes/reportes');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/', publicRouter);

app.get('/', (req, res) => {
  res.json({
    ok: true,
    servicio: 'yalisto-backend',
    version: '1.2.1',
    producto: 'agente-personal-sombra-digital',
    cerebro: process.env.OPENAI_API_KEY ? 'ia-contextual-conversacional' : 'local-contextual',
    voz: process.env.OPENAI_API_KEY ? 'natural-openai-tts' : 'dispositivo',
    privacidad: 'consentimiento-previo-y-eliminacion-de-cuenta',
    seguridad: 'sesiones-opacas-y-password-scrypt',
    reportes_ia: 'habilitados-en-app',
    presencia: 'sombra-viva-con-modo-descanso',
    mensaje: 'Yalisto: memoria, contexto, conversación, privacidad, seguridad, anticipación y ejecución.',
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'yalisto-backend',
    version: '1.2.1',
    cerebro: process.env.OPENAI_API_KEY ? 'ia-contextual-conversacional' : 'local-contextual',
    modelo: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-5.6-luna') : null,
    voz: process.env.OPENAI_API_KEY ? (process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts') : null,
    legal_operador_configurado: Boolean(process.env.LEGAL_ENTITY_NAME && process.env.LEGAL_PRIVACY_EMAIL),
    privacy_url:'/privacy',
    deletion_url:'/delete-account',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);

app.use('/api', (req,res,next) => {
  const publicRegistration = req.method === 'POST' && req.path === '/usuarios';
  const publicLegalDocs = req.method === 'GET' && req.path === '/legal/documentos';
  const publicDataRight = req.method === 'POST' && req.path === '/legal/derechos';
  if (publicRegistration || publicLegalDocs || publicDataRight) return next();
  return auth.middleware(req,res,next);
});

app.use('/api/usuarios', usuariosRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/recordatorios', recordatoriosRouter);
app.use('/api/asistente', asistenteRouter);
app.use('/api/vida', vidaRouter);
app.use('/api/personalizacion', personalizacionRouter);
app.use('/api/analisis', analisisRouter);
app.use('/api/voz', vozRouter);
app.use('/api/legal', legalRouter);
app.use('/api/reportes', reportesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'error interno del servidor' });
});

app.listen(PORT, () => console.log(`Yalisto backend escuchando en http://localhost:${PORT}`));
