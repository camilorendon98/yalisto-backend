const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { respuestaCalidaLocal } = require('../src/ai/calidez');

test('uses an existing active task without inventing urgency', () => {
  const respuesta = respuestaCalidaLocal({mensaje:'Estoy cansado y tengo pendientes', resumen:{compromisos:[{titulo:'Cerrada',estado:'resuelto'},{titulo:'Revisar documentos',estado:'pendiente'}]}});
  assert.match(respuesta, /Revisar documentos/);
  assert.doesNotMatch(respuesta, /Cerrada|vence|urgente|mañana|ya hice/);
});
test('does not invent tasks without records', () => {
  assert.doesNotMatch(respuestaCalidaLocal({mensaje:'Estoy cansada y tengo pendientes'}), /Entre tus pendientes|documentos/);
});
test('respects a request to talk without advice', () => {
  assert.match(respuestaCalidaLocal({mensaje:'Estoy cansado, solo quiero hablar'}), /hablar con calma/);
});
test('does not mistake negation or a third party for a self-report', () => {
  for (const mensaje of ['No estoy cansado','Mi hermano está cansado','Hola, no estoy cansado']) {
    assert.equal(respuestaCalidaLocal({mensaje}), null);
  }
});
test('greeting does not swallow a substantive message', () => {
  assert.equal(respuestaCalidaLocal({mensaje:'Hola, necesito revisar un documento'}), null);
});
test('avoids repeating the immediate greeting', () => {
  const primera = respuestaCalidaLocal({mensaje:'hola'});
  assert.notEqual(respuestaCalidaLocal({mensaje:'hola',historial:[{rol:'assistant',contenido:primera}]}), primera);
});
test('integration preserves confirmed action responses and applies warm fallback', async () => {
  const sandbox = {module:{exports:{}},require(name){
    if(name === './calidez') return require('../src/ai/calidez');
    return {};
  },process:{env:{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/ai/yalistoBrain'),'utf8'), sandbox);
  const responder = sandbox.module.exports.responderConCerebro;
  const confirmed = await responder({usuario:{nombre:'Ana'},mensaje:'Estoy cansada',respuestaBase:'Recordatorio guardado para el 10 de septiembre.',hechos:{tipo:'gestion_personal'}});
  assert.equal(confirmed.respuesta,'Recordatorio guardado para el 10 de septiembre.');
  const casual = await responder({usuario:{nombre:'Ana'},mensaje:'Estoy cansada y tengo pendientes',hechos:{tipo:'conversacion'},resumen:{compromisos:[{titulo:'Revisar propuesta',estado:'pendiente'}]}});
  assert.match(casual.respuesta,/Revisar propuesta/);
});
