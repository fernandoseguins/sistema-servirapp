/** @type {import('tailwindcss').Config} */
const cor = (v) => `rgb(var(--${v}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ✅ Tokens do tema Vibrante (claro/escuro via variáveis em src/index.css)
        bg:        cor('bg'),
        surface:   { DEFAULT: cor('surface'), 2: cor('surface-2') },
        line:      cor('line'),
        ink:       { DEFAULT: cor('ink'), 2: cor('ink-2') },
        muted:     cor('muted'),
        brand:     cor('brand'),
        'on-brand': cor('on-brand'),
        accent:    cor('accent'),
        topo:      cor('topo'),
        danger:    { DEFAULT: cor('danger'), soft: cor('danger-soft') },
        success:   { DEFAULT: cor('success'), soft: cor('success-soft') },
        warning:   { DEFAULT: cor('warning'), soft: cor('warning-soft') },

        // Tokens antigos dos departamentos — ainda usados nas telas da fase 3.
        // Mantemos os valores alinhados com departmentThemes.jsx para consistência.
        dept: {
          louvor:   '#2563eb', // blue-600
          midia:    '#9333ea', // purple-600
          infantil: '#ec4899', // pink-500
          diaconia: '#111827', // gray-900
        },
      },
      borderRadius: {
        card: '18px',
        ctl:  '12px',
      },
    },
  },
  plugins: [],
}
