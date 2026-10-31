'use strict';

/**
 * Identidade do produto.
 * Para renomear o aplicativo, altere `name`, `slug` e `tagline` aqui.
 * O restante do código usa este módulo (servidor e /api/config).
 */
module.exports = {
  name: process.env.APP_NAME || 'Vibra',
  slug: 'vibra',
  tagline: 'Conexões que fazem sentido.',
  description:
    'Rede social e descoberta de afinidades para adultos, com privacidade por padrão.',
};
