// src/components/ErrorBoundary.jsx
// Captura qualquer erro de runtime não tratado e exibe uma tela amigável
// em vez de deixar o app em branco.
//
// Error Boundaries precisam ser class components — é uma limitação do React.
// hooks (useState, useEffect) não conseguem capturar erros de render.
//
// USO no App.jsx:
//   import ErrorBoundary from './components/ErrorBoundary'
//   <ErrorBoundary>
//     <Suspense>...</Suspense>
//   </ErrorBoundary>

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { temErro: false, erro: null }
  }

  // Chamado quando um erro acontece em qualquer componente filho
  static getDerivedStateFromError(erro) {
    return { temErro: true, erro }
  }

  // Chamado após o render — bom para logar o erro (ex: Sentry, LogRocket)
  componentDidCatch(erro, info) {
    console.error('❌ ErrorBoundary capturou um erro:', erro, info.componentStack)
  }

  handleRecarregar() {
    // Tenta recuperar limpando o estado de erro
    this.setState({ temErro: false, erro: null })
    // Se o erro for grave, força um reload completo
    window.location.href = '/hub'
  }

  render() {
    if (!this.state.temErro) return this.props.children

    return (
      <div style={{
        minHeight: '100svh',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}>
        {/* Ícone */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: '1.5rem',
          border: '1px solid #334155',
        }}>
          ⚠️
        </div>

        <h1 style={{
          color: '#f1f5f9', fontSize: 22, fontWeight: 700,
          margin: '0 0 0.5rem',
        }}>
          Algo deu errado
        </h1>

        <p style={{
          color: '#94a3b8', fontSize: 14, lineHeight: 1.6,
          maxWidth: 320, margin: '0 0 2rem',
        }}>
          Ocorreu um erro inesperado no aplicativo. Seus dados estão seguros — tente voltar para o início.
        </p>

        {/* Detalhes do erro (visível apenas em desenvolvimento) */}
        {import.meta.env.DEV && this.state.erro && (
          <details style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 8, padding: '1rem', marginBottom: '1.5rem',
            maxWidth: 480, width: '100%', textAlign: 'left',
          }}>
            <summary style={{ color: '#64748b', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
              Detalhes técnicos
            </summary>
            <pre style={{
              color: '#f87171', fontSize: 11, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', margin: 0,
            }}>
              {this.state.erro.toString()}
            </pre>
          </details>
        )}

        <button
          onClick={() => this.handleRecarregar()}
          style={{
            background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 12,
            padding: '14px 32px', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', marginBottom: '0.75rem', width: '100%', maxWidth: 280,
          }}
        >
          Voltar ao início
        </button>

        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent', color: '#64748b',
            border: '1px solid #334155', borderRadius: 12,
            padding: '12px 32px', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', width: '100%', maxWidth: 280,
          }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}