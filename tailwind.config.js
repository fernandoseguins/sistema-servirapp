/** @type {import('tailwindcss').Config} */
const cor = (v) => `rgb(var(--${v}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Classes montadas em tempo de execução por classesDept() (src/theme/deptCores.js)
  safelist: [
    { pattern: /^(bg|text)-dept-(louvor|midia|infantil|diaconia|cantina|ministros|outro)-(bg|fg)$/ },
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
        accent:    { DEFAULT: cor('accent'), ink: cor('accent-ink') },
        'on-accent':  cor('on-accent'),
        'on-success': cor('on-success'),
        'on-danger':  cor('on-danger'),
        topo:      cor('topo'),
        danger:    { DEFAULT: cor('danger'), soft: cor('danger-soft') },
        success:   { DEFAULT: cor('success'), soft: cor('success-soft') },
        warning:   { DEFAULT: cor('warning'), soft: cor('warning-soft') },

        // Departamentos: DEFAULT = token antigo (telas da fase 3, alinhado com departmentThemes.jsx);
        // bg/fg = tema Vibrante claro/escuro (ver src/theme/deptCores.js).
        dept: {
          louvor:    { DEFAULT: '#2563eb', bg: cor('dept-louvor-bg'),    fg: cor('dept-louvor-fg') },
          midia:     { DEFAULT: '#9333ea', bg: cor('dept-midia-bg'),     fg: cor('dept-midia-fg') },
          infantil:  { DEFAULT: '#ec4899', bg: cor('dept-infantil-bg'),  fg: cor('dept-infantil-fg') },
          diaconia:  { DEFAULT: '#111827', bg: cor('dept-diaconia-bg'),  fg: cor('dept-diaconia-fg') },
          cantina:   { bg: cor('dept-cantina-bg'),   fg: cor('dept-cantina-fg') },
          ministros: { bg: cor('dept-ministros-bg'), fg: cor('dept-ministros-fg') },
          outro:     { bg: cor('dept-outro-bg'),     fg: cor('dept-outro-fg') },
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
