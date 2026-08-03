/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/views/**/*.js',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        painel: {
          bg: '#1e293b',
          card: '#334155',
          border: '#475569'
        },
        destaque: '#fde047'
      }
    }
  },
  plugins: []
};
