const VOICE_PRESETS = {
  alma: {
    codigo:'alma', nombre:'Alma', grupo:'femenina', icono:'👩', base:'marin',
    descripcion:'Natural, cálida y conversacional',
    instrucciones:'Usa una voz sintética adulta femenina, cálida, natural y cercana. Habla como una persona real en conversación, con pausas breves, respiración sutil e intonación variada. Evita tono de locutora o cadencia robótica.'
  },
  sofia: {
    codigo:'sofia', nombre:'Sofía', grupo:'femenina', icono:'👩', base:'coral',
    descripcion:'Amable, clara y expresiva',
    instrucciones:'Usa una voz sintética adulta femenina, clara, amable y expresiva. Mantén ritmo conversacional, pausas naturales y emoción moderada.'
  },
  luna: {
    codigo:'luna', nombre:'Luna', grupo:'femenina', icono:'👩', base:'nova',
    descripcion:'Ligera, fresca y cercana',
    instrucciones:'Usa una voz sintética adulta femenina, fresca, ligera y muy natural. Evita monotonía; usa pequeñas variaciones de ritmo e intonación.'
  },
  vera: {
    codigo:'vera', nombre:'Vera', grupo:'femenina', icono:'👩', base:'shimmer',
    descripcion:'Suave, tranquila y elegante',
    instrucciones:'Usa una voz sintética adulta femenina, suave, tranquila y elegante. Habla despacio sin sonar lenta, con pausas humanas y tono cercano.'
  },
  emma: {
    codigo:'emma', nombre:'Emma', grupo:'femenina', icono:'👩', base:'sage',
    descripcion:'Serena, inteligente y equilibrada',
    instrucciones:'Usa una voz sintética adulta femenina, serena, inteligente y equilibrada. Habla con seguridad tranquila y entonación humana.'
  },
  cesar: {
    codigo:'cesar', nombre:'César', grupo:'masculina', icono:'👨', base:'cedar',
    descripcion:'Natural, cálida y profunda',
    instrucciones:'Usa una voz sintética adulta masculina, cálida, natural y cercana. Habla como una persona real, con pausas breves, respiración sutil, ritmo fluido y sin tono de narrador artificial.'
  },
  mateo: {
    codigo:'mateo', nombre:'Mateo', grupo:'masculina', icono:'👨', base:'onyx',
    descripcion:'Grave, segura y pausada',
    instrucciones:'Usa una voz sintética adulta masculina, grave, segura y pausada. Mantén una conversación natural, no solemne, con variación de entonación.'
  },
  samuel: {
    codigo:'samuel', nombre:'Samuel', grupo:'masculina', icono:'👨', base:'ash',
    descripcion:'Joven adulta, clara y ágil',
    instrucciones:'Usa una voz sintética masculina de adulto joven, clara, ágil y cercana. Habla con naturalidad, pequeñas pausas y ritmo dinámico.'
  },
  bruno: {
    codigo:'bruno', nombre:'Bruno', grupo:'masculina', icono:'👨', base:'echo',
    descripcion:'Calmada, sobria y confiable',
    instrucciones:'Usa una voz sintética adulta masculina, calmada, sobria y confiable. Evita una lectura plana; conserva una cadencia conversacional.'
  },
  nicolas: {
    codigo:'nicolas', nombre:'Nicolás', grupo:'masculina', icono:'👨', base:'verse',
    descripcion:'Enérgica, amistosa y espontánea',
    instrucciones:'Usa una voz sintética masculina de adulto joven, enérgica, amistosa y espontánea. Habla como en una conversación cotidiana, sin exagerar.'
  },
  nico: {
    codigo:'nico', nombre:'Nico', grupo:'infantil', icono:'🧒', base:'alloy',
    descripcion:'Infantil/juvenil, alegre y clara',
    instrucciones:'Usa una voz sintética infantil o juvenil, alegre, clara y natural, sin imitar a ningún menor real ni a una persona específica. Mantén dicción entendible y energía moderada.'
  },
  mia: {
    codigo:'mia', nombre:'Mía', grupo:'infantil', icono:'👧', base:'coral',
    descripcion:'Infantil/juvenil, dulce y expresiva',
    instrucciones:'Usa una voz sintética infantil o juvenil, dulce, expresiva y natural, sin imitar a ningún menor real ni a una persona específica. Evita caricaturizarla.'
  },
  teo: {
    codigo:'teo', nombre:'Teo', grupo:'infantil', icono:'🧒', base:'fable',
    descripcion:'Infantil/juvenil, curiosa y divertida',
    instrucciones:'Usa una voz sintética infantil o juvenil, curiosa, divertida y clara, sin imitar a ningún menor real ni a una persona específica. Mantén un tono natural, no caricaturesco.'
  },
  sara: {
    codigo:'sara', nombre:'Sara', grupo:'infantil', icono:'👧', base:'shimmer',
    descripcion:'Infantil/juvenil, suave y tranquila',
    instrucciones:'Usa una voz sintética infantil o juvenil, suave, tranquila y clara, sin imitar a ningún menor real ni a una persona específica. Habla con pausas naturales.'
  },
  aura: {
    codigo:'aura', nombre:'Aura', grupo:'neutra', icono:'✨', base:'ballad',
    descripcion:'Neutra, narrativa y envolvente',
    instrucciones:'Usa una voz sintética neutra, envolvente y muy natural. Habla como alguien cercano que piensa mientras conversa, con pausas cortas y entonación orgánica.'
  },
};

const VOICE_LIST = Object.values(VOICE_PRESETS).map(({ codigo, nombre, grupo, icono, base, descripcion }) => ({ codigo, nombre, grupo, icono, base, descripcion }));

function obtenerPreset(codigo) {
  return VOICE_PRESETS[codigo] || VOICE_PRESETS.alma;
}

module.exports = { VOICE_PRESETS, VOICE_LIST, obtenerPreset };
