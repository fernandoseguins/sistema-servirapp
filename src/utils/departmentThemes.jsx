// src/utils/departmentThemes.jsx
// Fonte única de verdade para cores, gradientes e ícones de cada departamento.
// Usado em: Hub, Dashboard, ScheduleDetails, ScheduleBoard, Skeletons.
//
// Para adicionar um departamento novo, basta incluir uma entrada aqui.

import { Music, Camera, Baby, Shield, LayoutGrid, Coffee, HandHeart, Heart, Book, Mic, Star, Users, Sparkles, Hand, Cross } from 'lucide-react'

const TEMAS = {
  Louvor: {
    // Fundo e hover
    bgPrimary:       'bg-blue-600',
    bgHover:         'hover:bg-blue-700',
    bgLight:         'bg-blue-50',
    // Texto
    textPrimary:     'text-blue-600',
    textLight:       'text-blue-200',
    // Bordas
    borderLight:     'border-blue-200',
    borderHover:     'hover:border-blue-400',
    // Gradiente do card principal (Dashboard)
    gradient:        'from-blue-600 to-indigo-700',
    iconOpacity:     'text-indigo-300',
    // Calendário
    dotCor:          'bg-blue-600',
    hex:             '#2563eb',
    shadowHover:     'hover:shadow-blue-100',
    // ScheduleBoard
    bgPublicada:     'bg-blue-600',
    borderPublicada: 'border-blue-500',
    tagBg:           'bg-blue-500',
    tagBorder:       'border-blue-400',
    tagText:         'text-blue-50',
    boardBtnHover:   'hover:bg-blue-50 hover:text-blue-700',
    // Botão genérico
    btnHover:        'hover:bg-blue-700',
  },

  Mídia: {
    bgPrimary:       'bg-purple-600',
    bgHover:         'hover:bg-purple-700',
    bgLight:         'bg-purple-50',
    textPrimary:     'text-purple-600',
    textLight:       'text-purple-200',
    borderLight:     'border-purple-200',
    borderHover:     'hover:border-purple-400',
    gradient:        'from-purple-600 to-fuchsia-700',
    iconOpacity:     'text-fuchsia-300',
    dotCor:          'bg-purple-600',
    hex:             '#9333ea',
    shadowHover:     'hover:shadow-purple-100',
    bgPublicada:     'bg-purple-600',
    borderPublicada: 'border-purple-500',
    tagBg:           'bg-purple-500',
    tagBorder:       'border-purple-400',
    tagText:         'text-purple-50',
    boardBtnHover:   'hover:bg-purple-50 hover:text-purple-700',
    btnHover:        'hover:bg-purple-700',
  },

  Infantil: {
    bgPrimary:       'bg-pink-500',
    bgHover:         'hover:bg-pink-600',
    bgLight:         'bg-pink-50',
    textPrimary:     'text-pink-500',
    textLight:       'text-pink-200',
    borderLight:     'border-pink-200',
    borderHover:     'hover:border-pink-400',
    gradient:        'from-pink-500 to-rose-600',
    iconOpacity:     'text-rose-300',
    dotCor:          'bg-pink-500',
    hex:             '#ec4899',
    shadowHover:     'hover:shadow-pink-100',
    bgPublicada:     'bg-pink-500',
    borderPublicada: 'border-pink-400',
    tagBg:           'bg-pink-400',
    tagBorder:       'border-pink-300',
    tagText:         'text-pink-50',
    boardBtnHover:   'hover:bg-pink-50 hover:text-pink-700',
    btnHover:        'hover:bg-pink-600',
  },

  Diaconia: {
    bgPrimary:       'bg-gray-900',
    bgHover:         'hover:bg-black',
    bgLight:         'bg-gray-200',
    textPrimary:     'text-gray-900',
    textLight:       'text-gray-300',
    borderLight:     'border-gray-200',
    borderHover:     'hover:border-gray-700',
    gradient:        'from-gray-800 to-black',
    iconOpacity:     'text-gray-600',
    dotCor:          'bg-gray-900',
    hex:             '#111827',
    shadowHover:     'hover:shadow-gray-300',
    bgPublicada:     'bg-gray-900',
    borderPublicada: 'border-gray-700',
    tagBg:           'bg-gray-700',
    tagBorder:       'border-gray-600',
    tagText:         'text-gray-100',
    boardBtnHover:   'hover:bg-gray-100 hover:text-gray-900',
    btnHover:        'hover:bg-black',
  },

  Cantina: {
    // Amarelo mostarda
    bgPrimary:       'bg-amber-500',
    bgHover:         'hover:bg-amber-600',
    bgLight:         'bg-amber-50',
    textPrimary:     'text-amber-600',
    textLight:       'text-amber-200',
    borderLight:     'border-amber-200',
    borderHover:     'hover:border-amber-400',
    gradient:        'from-amber-500 to-yellow-600',
    iconOpacity:     'text-yellow-200',
    dotCor:          'bg-amber-500',
    hex:             '#f59e0b',
    shadowHover:     'hover:shadow-amber-100',
    bgPublicada:     'bg-amber-500',
    borderPublicada: 'border-amber-400',
    tagBg:           'bg-amber-400',
    tagBorder:       'border-amber-300',
    tagText:         'text-amber-900',
    boardBtnHover:   'hover:bg-amber-50 hover:text-amber-700',
    btnHover:        'hover:bg-amber-600',
  },

  Ministros: {
    // Vermelho marsala
    bgPrimary:       'bg-red-900',
    bgHover:         'hover:bg-red-950',
    bgLight:         'bg-red-50',
    textPrimary:     'text-red-900',
    textLight:       'text-red-200',
    borderLight:     'border-red-200',
    borderHover:     'hover:border-red-400',
    gradient:        'from-red-900 to-rose-950',
    iconOpacity:     'text-rose-300',
    dotCor:          'bg-red-900',
    hex:             '#7f1d1d',
    shadowHover:     'hover:shadow-red-100',
    bgPublicada:     'bg-red-900',
    borderPublicada: 'border-red-800',
    tagBg:           'bg-red-800',
    tagBorder:       'border-red-700',
    tagText:         'text-red-50',
    boardBtnHover:   'hover:bg-red-50 hover:text-red-900',
    btnHover:        'hover:bg-red-950',
  },
}

// Tema padrão (fallback para departamentos desconhecidos)
const TEMA_PADRAO = {
  bgPrimary:       'bg-gray-700',
  bgHover:         'hover:bg-gray-800',
  bgLight:         'bg-gray-50',
  textPrimary:     'text-gray-700',
  textLight:       'text-gray-300',
  borderLight:     'border-gray-200',
  borderHover:     'hover:border-gray-400',
  gradient:        'from-gray-700 to-gray-900',
  iconOpacity:     'text-gray-500',
  dotCor:          'bg-gray-700',
  hex:             '#374151',
  shadowHover:     'hover:shadow-gray-100',
  bgPublicada:     'bg-gray-700',
  borderPublicada: 'border-gray-600',
  tagBg:           'bg-gray-600',
  tagBorder:       'border-gray-500',
  tagText:         'text-gray-50',
  boardBtnHover:   'hover:bg-gray-50 hover:text-gray-700',
  btnHover:        'hover:bg-gray-800',
}

/**
 * Retorna o tema completo de um departamento pelo nome.
 * Normaliza "Midia" → "Mídia" automaticamente.
 * @param {string} nomeDept
 * @returns {object} tema com todas as classes Tailwind
 */

// ─── Tema dinâmico para departamentos PERSONALIZADOS (cor vinda do banco) ─────
function hexToRgb(hex) {
  const h = (hex || '#6b7280').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
function ajustarCor(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const aj = (c) => amount >= 0 ? Math.round(c + (255 - c) * amount) : Math.round(c * (1 + amount))
  const toHex = (c) => c.toString(16).padStart(2, '0')
  return '#' + toHex(aj(r)) + toHex(aj(g)) + toHex(aj(b))
}
function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Gera um tema completo (com estilos inline) a partir de uma cor hex.
 * Para departamentos personalizados. O campo `styles` traz os valores
 * CSS inline; as telas aplicam via style={{ ...tema.styles.X }}.
 */
export function gerarTemaDeCor(hex) {
  const corClara  = ajustarCor(hex, 0.85)
  const corClara2 = ajustarCor(hex, 0.70)
  const corEscura = ajustarCor(hex, -0.25)
  const corMedia  = ajustarCor(hex, -0.10)
  return {
    personalizado: true,
    hex,
    styles: {
      bgPrimary:       { backgroundColor: hex },
      bgHover:         { backgroundColor: corEscura },
      bgLight:         { backgroundColor: corClara },
      textPrimary:     { color: hex },
      textLight:       { color: corClara2 },
      borderLight:     { borderColor: ajustarCor(hex, 0.55) },
      borderHover:     { borderColor: corMedia },
      gradientStyle:   { backgroundImage: `linear-gradient(135deg, ${hex}, ${corEscura})` },
      iconOpacity:     { color: rgba(hex, 0.35) },
      dotCor:          { backgroundColor: hex },
      shadowHover:     { boxShadow: `0 10px 15px -3px ${rgba(hex, 0.15)}` },
      bgPublicada:     { backgroundColor: hex },
      borderPublicada: { borderColor: corMedia },
      tagBg:           { backgroundColor: corMedia },
      tagBorder:       { borderColor: hex },
      tagText:         { color: corClara },
      btnHover:        { backgroundColor: corEscura },
    },
    hexValue: hex,
    // Classes vazias para não quebrar onde se espera string
    bgPrimary: '', bgHover: '', bgLight: '', textPrimary: '', textLight: '',
    borderLight: '', borderHover: '', gradient: '', iconOpacity: '', dotCor: '',
    shadowHover: '', bgPublicada: '', borderPublicada: '', tagBg: '', tagBorder: '',
    tagText: '', boardBtnHover: '', btnHover: '',
  }
}


/**
 * Helper para aplicar tema de forma uniforme (padrão OU personalizado).
 * Retorna um objeto { className, style } pronto para espalhar no elemento.
 *
 * Uso:
 *   const tp = temaProps(theme, 'bgPrimary')   // fundo cor primária
 *   <div className={`base ${tp.className}`} style={tp.style}>
 *
 * Campos suportados: bgPrimary, bgHover, bgLight, textPrimary, textLight,
 *   borderLight, borderHover, dotCor, bgPublicada, borderPublicada,
 *   tagBg, tagBorder, tagText, btnHover, gradient
 */
export function temaProps(theme, campo) {
  if (!theme) return { className: '', style: {} }
  // Departamento personalizado → estilo inline
  if (theme.personalizado) {
    if (campo === 'gradient') return { className: '', style: theme.styles.gradientStyle || {} }
    return { className: '', style: theme.styles?.[campo] || {} }
  }
  // Departamento padrão → classe Tailwind
  if (campo === 'gradient') return { className: `bg-gradient-to-br ${theme.gradient}`, style: {} }
  return { className: theme[campo] || '', style: {} }
}

// Mapa de ícones disponíveis para departamentos personalizados (por nome)
const ICONES_CUSTOM = { Music, Camera, Baby, Shield, Coffee, HandHeart, Heart, Book, Mic, Star, Users, Sparkles, Hand, Cross, LayoutGrid }

export function getDeptTheme(nomeDept, cor = null) {
  // Normaliza variações sem acento
  const nome = nomeDept === 'Midia' ? 'Mídia' : nomeDept
  // Departamento padrão tem tema fixo. Se não existe E tem cor personalizada,
  // gera o tema dinâmico a partir da cor do banco.
  if (TEMAS[nome]) return TEMAS[nome]
  if (cor) return gerarTemaDeCor(cor)
  return TEMA_PADRAO
}

// ─── Ícones por departamento ─────────────────────────────────────────────────
// Retornam elementos JSX prontos para uso, com tamanho configurável via className.

const ICONES = {
  Louvor:   { Grande: <Music className="w-12 h-12" />,   Pequeno: <Music className="w-5 h-5" /> },
  Mídia:    { Grande: <Camera className="w-12 h-12" />,  Pequeno: <Camera className="w-5 h-5" /> },
  Infantil: { Grande: <Baby className="w-12 h-12" />,    Pequeno: <Baby className="w-5 h-5" /> },
  Diaconia: { Grande: <Shield className="w-12 h-12" />,  Pequeno: <Shield className="w-5 h-5" /> },
  Cantina:  { Grande: <Coffee className="w-12 h-12" />,   Pequeno: <Coffee className="w-5 h-5" /> },
  Ministros:{ Grande: <HandHeart className="w-12 h-12" />, Pequeno: <HandHeart className="w-5 h-5" /> },
}

const ICONE_PADRAO = {
  Grande:  <LayoutGrid className="w-12 h-12" />,
  Pequeno: <LayoutGrid className="w-5 h-5" />,
}

/**
 * Retorna os ícones (Grande e Pequeno) de um departamento.
 * @param {string} nomeDept
 * @returns {{ Grande: JSX.Element, Pequeno: JSX.Element }}
 */
export function getDeptIcones(nomeDept, icone = null) {
  const nome = nomeDept === 'Midia' ? 'Mídia' : nomeDept
  if (ICONES[nome]) return ICONES[nome]
  // Departamento personalizado: usa o ícone escolhido (nome do lucide)
  if (icone && ICONES_CUSTOM[icone]) {
    const Ic = ICONES_CUSTOM[icone]
    return { Grande: <Ic className="w-12 h-12" />, Pequeno: <Ic className="w-5 h-5" /> }
  }
  return ICONE_PADRAO
}