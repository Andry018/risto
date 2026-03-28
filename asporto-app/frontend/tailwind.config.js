/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: '#121212',
        surface: '#1E1E1E',
        surfaceLight: '#2A2A2A',
        gold: '#CFA055',
        goldHover: '#b88b44',
      }
    },
  },
  plugins: [],
}
