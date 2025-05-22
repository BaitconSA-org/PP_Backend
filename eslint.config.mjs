import cds from '@sap/cds/eslint.config.mjs';

export default [
  ...cds.recommended,
  {
    rules: {
      // Estilo
      semi: ['error', 'always'],                  // Siempre usar punto y coma
      quotes: ['error', 'single'],                // Usar comillas simples
      indent: ['error', 2],                       // Sangría de 2 espacios
      'comma-dangle': ['error', 'always-multiline'], // Coma final en objetos/arrays multilínea

      // Buenas prácticas
      'no-console': 'warn',                       // Avisar sobre console.log
      'no-unused-vars': ['warn', { args: 'none' }], // Avisar por variables no usadas (ignora args)
      'eqeqeq': ['error', 'always'],              // Usar === siempre

      // Seguridad / robustez
      'no-var': 'error',                          // Usar let/const en lugar de var
      'prefer-const': 'warn',                     // Usar const si no se reasigna
    },
  },
];


  