// Logo do SerVir. "branco" = versão monocromática para fundo roxo/escuro.
export default function Logo({ variante = 'cor', className = 'h-10' }) {
  return (
    <img
      src="/logo.png"
      alt="SerVir"
      className={`${className} w-auto object-contain`}
      style={variante === 'branco' ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )
}
