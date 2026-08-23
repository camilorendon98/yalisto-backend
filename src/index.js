require('dotenv').config();
const express = require('express');
const cors = require('cors');

const usuariosRouter = require('./routes/usuarios');
const solicitudesRouter = require('./routes/solicitudes');
const recordatoriosRouter = require('./routes/recordatorios');
const asistenteRouter = require('./routes/asistente');
const vidaRouter = require('./routes/vida');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    servicio: 'yalisto-backend',
    version: '0.4.0',
    producto: 'agente-personal',
    cerebro: process.env.OPENAI_API_KEY ? 'ia-contextual' : 'local-contextual',
    mensaje: 'Yalisto: memoria, contexto, anticipación y ejecución personal.',
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'yalisto-backend',
    version: '0.4.0',
    cerebro: process.env.OPENAI_API_KEY ? 'ia-contextual' : 'local-contextual',
    modelo: process.env.OPENAI_API_KEY ? (process.env.OPENAI_MODEL || 'gpt-5.6-luna') : null,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/usuarios', usuariosRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/recordatorios', recordatoriosRouter);
app.use('/api/asistente', asistenteRouter);
app.use('/api/vida', vidaRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Yalisto backend escuchando en http://localhost:${PORT}`);
});
