const express = require('express');
const { obtenerPreset, VOICE_LIST } = require('../voice-presets');

const router = express.Router();

function instruccionesComunes({ idioma, velocidad, expresividad, estado_animo }) {
  const partes = [
    `Habla en el idioma correspondiente al código ${idioma || 'es-CO'}.`,
    'La prioridad es sonar como una conversación humana, no como una lectura. Usa pausas breves y desiguales, variación suave de entonación y ritmo, y evita pronunciar cada frase con la misma cadencia.',
    'No suenes como locutor, GPS, IVR ni audiolibro. No sobreactúes ni exageres respiraciones.',
    'En español colombiano, usa una dicción clara y neutra, cercana y cotidiana; no fuerces modismos.',
    'Las preguntas deben sonar realmente interrogativas y las respuestas cortas deben sentirse espontáneas.',
    'No imites ni suplantes a ninguna persona real.',
  ];
  const v = Number(velocidad) || 1;
  if (v < 0.9) partes.push('Habla un poco más despacio de lo normal, sin arrastrar las palabras.');
  else if (v > 1.1) partes.push('Habla un poco más ágil de lo normal, pero mantén claridad.');
  else partes.push('Usa una velocidad conversacional natural.');

  const estilos = {
    suave:'Mantén una expresión suave y calmada, con finales de frase naturales.',
    natural:'Mantén una expresión cotidiana y humana, con pequeñas variaciones de energía.',
    expresiva:'Usa más intención y variación emocional, sin teatralidad.',
    energico:'Usa energía positiva y ritmo vivo, sin gritar ni acelerar demasiado.',
    sereno:'Usa un tono sereno, estable y tranquilizador, sin monotonía.',
  };
  partes.push(estilos[expresividad] || estilos.natural);

  const estados = {
    cansado:'El usuario reportó cansancio: habla con calma y reduce intensidad.',
    estresado:'El usuario reportó estrés: habla de forma serena, clara y sin apresurar.',
    abrumado:'El usuario reportó sentirse abrumado: usa pausas más claras y un tono muy calmado.',
    motivado:'El usuario reportó motivación: puedes sonar un poco más dinámico.',
    triste:'El usuario reportó tristeza: mantén calidez y respeto, sin dramatizar.',
    molesto:'El usuario reportó molestia: mantén un tono firme, calmado y respetuoso.',
  };
  if (estado_animo && estados[estado_animo]) partes.push(estados[estado_animo]);
  return partes.join(' ');
}

router.get('/catalogo', (req, res) => {
  res.json({
    voces: VOICE_LIST,
    motor: process.env.OPENAI_API_KEY ? 'openai-tts' : 'dispositivo',
    natural_configurada: Boolean(process.env.OPENAI_API_KEY),
    recomendadas_calidad: ['marin','cedar'],
  });
});

router.post('/sintetizar', async (req, res) => {
  const { texto, voz='alma', idioma='es-CO', velocidad=1, expresividad='natural', estado_animo=null } = req.body || {};
  const limpio = String(texto || '').trim();
  if (!limpio) return res.status(400).json({ error:'texto es obligatorio' });
  if (limpio.length > 1800) return res.status(400).json({ error:'texto demasiado largo para voz; máximo 1800 caracteres' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error:'voz natural no configurada', fallback:'dispositivo' });

  const preset = obtenerPreset(voz);
  const instrucciones = `${preset.instrucciones} ${instruccionesComunes({ idioma, velocidad, expresividad, estado_animo })}`;

  try {
    const respuesta = await fetch('https://api.openai.com/v1/audio/speech', {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':'application/json',
      },
      body:JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: preset.base,
        input: limpio,
        instructions: instrucciones,
        response_format:'mp3',
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      console.error('Yalisto TTS:', respuesta.status, detalle.slice(0,500));
      return res.status(502).json({ error:'no se pudo generar la voz natural', fallback:'dispositivo', detalle_servidor:respuesta.status });
    }

    const audio = Buffer.from(await respuesta.arrayBuffer()).toString('base64');
    res.json({
      audio_base64:audio,
      mime_type:'audio/mpeg',
      motor:'openai-tts',
      modelo:process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voz:{ codigo:preset.codigo, nombre:preset.nombre, grupo:preset.grupo, base:preset.base },
    });
  } catch (err) {
    console.error('Yalisto TTS error:', err?.message || err);
    res.status(502).json({ error:'no se pudo generar la voz natural', fallback:'dispositivo' });
  }
});

module.exports = router;
