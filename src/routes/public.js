const express = require('express');
const legal = require('../legal');
const pg = require('../db-postgres');

const router = express.Router();
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const limpio=(s='')=>String(s).replace(/^#{1,6}\s+/gm,'').replace(/\*\*/g,'');

function layout(titulo, contenido) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Yalisto</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6eeda;color:#1d2638;margin:0}main{max-width:820px;margin:auto;padding:40px 22px 70px}.brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.y{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#c91f2c;color:white;font-weight:900;font-size:22px}h1{font-size:30px;margin:0 0 8px}h2{margin-top:30px}p,li{line-height:1.65}.card{background:#fffaf0;border:1px solid #ddd3c1;border-radius:18px;padding:20px;margin:18px 0}.muted{color:#657080}.warn{color:#a11924;font-weight:700}a{color:#a11924}input,textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cfc6b7;border-radius:10px;margin:6px 0 12px;font:inherit}button{background:#1d2638;color:white;border:0;border-radius:999px;padding:12px 18px;font-weight:800;cursor:pointer}.foot{font-size:13px;color:#657080;margin-top:35px}</style></head><body><main><div class="brand"><div class="y">Y</div><div><strong>Yalisto</strong><div class="muted">Tu sombra digital</div></div></div>${contenido}<div class="foot">Yalisto · Colombia · <a href="/privacy">Privacidad</a> · <a href="/terms">Términos</a> · <a href="/delete-account">Eliminar cuenta</a></div></main></body></html>`;
}

async function doc(codigo) {
  const docs=await legal.documentosVigentes('CO');
  return docs.find(d=>d.codigo===codigo) || null;
}

router.get('/privacy', async(req,res)=>{
  try {
    const d=await doc('privacidad'); const op=legal.operadorLegal();
    const operador = op.configuracion_completa
      ? `<div class="card"><h2>Responsable del tratamiento</h2><p><strong>${esc(op.nombre)}</strong>${op.nit?` · ${esc(op.nit)}`:''}<br>${esc(op.domicilio||'Colombia')}${op.direccion?` · ${esc(op.direccion)}`:''}<br>Privacidad: ${esc(op.correo_privacidad||'')}</p></div>`
      : `<div class="card warn">Los datos jurídicos definitivos del responsable deben configurarse antes del lanzamiento comercial.</div>`;
    res.type('html').send(layout('Política de Privacidad',`<h1>Política de Privacidad</h1><p class="muted">Versión ${esc(d?.version||'1.0.0')} · Colombia</p><div class="card"><p>${esc(limpio(d?.contenido_markdown||'Yalisto trata datos únicamente para prestar las funciones que el usuario solicita, con los controles y autorizaciones aplicables.')).replace(/\n/g,'<br>')}</p></div>${operador}<h2>Control del usuario</h2><p>Desde la aplicación puedes revisar autorizaciones, ejercer derechos y eliminar tu cuenta. También puedes solicitar eliminación desde la página pública de eliminación.</p><p><a href="/delete-account">Solicitar eliminación de cuenta y datos</a></p>`));
  } catch(e){console.error(e);res.status(500).send('No se pudo cargar la política.');}
});

router.get('/terms', async(req,res)=>{
  try {
    const d=await doc('terminos');
    res.type('html').send(layout('Términos y Condiciones',`<h1>Términos y Condiciones</h1><p class="muted">Versión ${esc(d?.version||'1.0.0')} · Colombia</p><div class="card"><p>${esc(limpio(d?.contenido_markdown||'Yalisto es un agente personal asistido por inteligencia artificial.')).replace(/\n/g,'<br>')}</p></div><p>Yalisto distingue entre sugerir, preparar, solicitar autorización y ejecutar. No debe afirmar que una acción externa fue completada si no existe confirmación técnica.</p>`));
  } catch(e){console.error(e);res.status(500).send('No se pudieron cargar los términos.');}
});

router.get('/delete-account',(req,res)=>{
  const ok=req.query.ok==='1';
  res.type('html').send(layout('Eliminar cuenta',`<h1>Eliminar mi cuenta y datos</h1>${ok?'<div class="card"><strong>Solicitud recibida.</strong><p>Se registró tu solicitud de supresión. Si todavía tienes acceso a Yalisto, también puedes eliminar la cuenta directamente desde Privacidad y legal dentro de la app.</p></div>':''}<p>Puedes iniciar aquí una solicitud externa de eliminación asociada a Yalisto.</p><form method="post" action="/delete-account"><label>Correo de la cuenta</label><input name="correo" type="email" required autocomplete="email"><label>Detalle opcional</label><textarea name="detalle" rows="4" placeholder="Quiero eliminar mi cuenta y los datos asociados."></textarea><button type="submit">Solicitar eliminación</button></form><p class="muted">Por seguridad, una solicitud externa puede requerir verificación adicional antes de eliminar información. Desde una sesión activa de la app puedes iniciar la eliminación directamente.</p>`));
});

router.post('/delete-account', express.urlencoded({extended:false}), async(req,res)=>{
  const correo=String(req.body?.correo||'').trim();
  if(!correo) return res.status(400).send('Correo requerido');
  try {
    await pg.pool.query(`insert into solicitudes_derechos_datos (usuario_id,correo,tipo,detalle) values (null,$1,'supresion',$2)`,[correo,String(req.body?.detalle||'Solicitud externa de eliminación de cuenta Yalisto.')]);
    res.redirect('/delete-account?ok=1');
  } catch(e){console.error(e);res.status(500).send('No se pudo registrar la solicitud.');}
});

module.exports=router;
