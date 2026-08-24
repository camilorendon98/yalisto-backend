async function moderarTexto(texto='') {
  const limpio=String(texto||'').trim();
  if(!limpio || !process.env.OPENAI_API_KEY) return {flagged:false,motor:'omitido'};
  try{
    const respuesta=await fetch('https://api.openai.com/v1/moderations',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'omni-moderation-latest',input:limpio}),
    });
    if(!respuesta.ok) return {flagged:false,motor:'error-no-bloqueante'};
    const data=await respuesta.json();
    const r=data?.results?.[0]||{};
    return {flagged:Boolean(r.flagged),categorias:r.categories||{},scores:r.category_scores||{},motor:'omni-moderation-latest'};
  }catch(err){
    console.error('Moderation fallback:',err?.message||err);
    return {flagged:false,motor:'error-no-bloqueante'};
  }
}

async function middlewareChat(req,res,next){
  try{
    const texto=req.body?.texto;
    const resultado=await moderarTexto(texto);
    if(resultado.flagged){
      return res.status(400).json({
        error:'No puedo ayudar con ese contenido de esa forma. Si me cuentas qué necesitas lograr, puedo intentar ayudarte de una manera segura.',
        codigo:'CONTENIDO_RESTRINGIDO',
      });
    }
    req.moderation=resultado;
    next();
  }catch(err){
    console.error('Moderation middleware:',err);
    next();
  }
}

module.exports={moderarTexto,middlewareChat};
