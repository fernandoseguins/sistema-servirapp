/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ✅ Tokens semânticos dos departamentos — use como bg-dept-louvor, text-dept-midia, etc.
      // Mantemos os valores alinhados com departmentThemes.jsx para consistência.
      colors: {
        dept: {
          louvor:   '#2563eb', // blue-600
          midia:    '#9333ea', // purple-600
          infantil: '#ec4899', // pink-500
          diaconia: '#111827', // gray-900
        },
      },
    },
  },
  plugins: [],
}