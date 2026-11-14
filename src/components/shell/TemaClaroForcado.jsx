// Mantém telas ainda não reformadas no tema claro, mesmo com o modo escuro ligado.
// As variáveis claras são redefinidas pela classe .tema-claro-forcado (src/index.css).
export default function TemaClaroForcado({ children }) {
  return <div className="tema-claro-forcado bg-bg text-ink min-h-screen">{children}</div>
}
