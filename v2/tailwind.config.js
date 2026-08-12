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
        'brand-light': '#F9FAFB',
        painel: {
          bg: '#F9FAFB',
          card: '#FFFFFF',
          border: '#E5E7EB'
        },
        destaque: '#FACC15'
      }
    }
  },
  plugins: []
};
