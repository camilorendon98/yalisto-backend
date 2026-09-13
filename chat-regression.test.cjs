const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
function brain(fetch,env={OPENAI_API_KEY:'test-only'}){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/src/ai/yalistoBrain.js','utf8'),{module,require:()=>({}),process:{env},fetch,AbortController,setTimeout,clearTimeout,console:{error(){}}});
 return module.exports.responderConCerebro;
}
test('Historial conserva roles; última entrada es la pregunta actual',async()=>{
 let body;
 const run=brain(async(_,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Respuesta nueva'}]}]})};});
 const r=await run({usuario:{nombre:'Prueba'},mensaje:'Ahora explícame las mareas',historial:[{rol:'user',contenido:'Organiza mi tarde'},{rol:'assistant',contenido:'Plan anterior'}]});
 assert.equal(r.respuesta,'Respuesta nueva');assert.equal(body.input.at(-1).content,'Ahora explícame las mareas');
 assert.equal(body.input.at(-2).role,'assistant');assert.equal(body.input.at(-3).content,'Organiza mi tarde');
});
test('Error de IA no simula conversación ni confirma acciones',async()=>{
 const r=await brain(async()=>({ok:false,status:401,text:async()=>''}))({usuario:{},mensaje:'¿Qué son las mareas?',hechos:{tipo:'conversacion'}});
 assert.match(r.respuesta,/No pude obtener una respuesta/);assert.doesNotMatch(r.respuesta,/Dale|te sigo|guard/);
});
test('Sin IA se conservan hechos de una acción confirmada',async()=>{
 const r=await brain(null,{})({usuario:{},mensaje:'guarda tarea',hechos:{tipo:'gestion_personal'},respuestaBase:'Tarea guardada.'});
 assert.match(r.respuesta,/Tarea guardada/);assert.match(r.respuesta,/IA no está disponible/);
});
test('Preguntas no se convierten en misiones; guardado explícito sí',()=>{
 const code=fs.readFileSync(__dirname+'/src/routes/asistente.js','utf8');
 const begin=code.indexOf('function esPeticionRecordatorio');const end=code.indexOf('function respuestaCasualLocal');
 const ctx={esBusquedaPractica:()=>false};vm.createContext(ctx);vm.runInContext(code.slice(begin,end),ctx);
 for(const q of ['Necesito saber por qué llueve','Quiero que me expliques las mareas','Ayúdame a organizar dos horas de estudio','No guardes esto','¿Qué sigue?'])assert.equal(ctx.esAccionPersonal(q),false,q);
 for(const q of ['Guarda comprar leche','Anota pagar el recibo','Recuérdame mañana llamar','Quiero que guardes una tarea'])assert.equal(ctx.esAccionPersonal(q),true,q);
 assert.equal(ctx.esConsultaPendientes('¿Qué sigue?'),false);
});
