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
        painel: {
          bg: '#EEF1F6',
          card: '#FFFFFF',
          border: '#E2E8F0'
        },
        destaque: '#FACC15'
      }
    }
  },
  plugins: []
};
