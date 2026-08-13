/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/views/**/*.js',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        // Padrao visual do Frottex (marca "irma") - amarelo/preto, alto contraste.
        'brand-yellow': '#FACC15',
        'brand-yellow-hover': '#EAB308',
        'brand-black': '#111827',
        'brand-dark': '#1F2937',
        'brand-light': '#EEF1F6',
        // Tema escuro: elevacao por camadas de luminosidade (nao por sombra,
        // que some no escuro) - pesquisa de dark mode 2026. Nada de preto
        // puro nem branco puro, pra nao cansar a vista.
        painel: {
          bg: '#0F1520',
          card: '#1B2434',
          border: '#334155'
        },
        destaque: '#FACC15'
      }
    }
  },
  plugins: []
};
