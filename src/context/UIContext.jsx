// src/context/UIContext.jsx
// Sistema global de Toast + Confirm modal.
// Substitui todos os alert() e window.confirm() do projeto.
//
// USO:
//   const { toast, confirm } = useUI()
//
//   toast.success('Salvo com sucesso!')
//   toast.error('Erro ao salvar: ' + err.message)
//   toast.warning('Preencha todos os campos.')
//   toast.info('Aguarde...')
//
//   const ok = await confirm({ title: 'Remover membro?', message: 'Esta ação não pode ser desfeita.' })
//   if (!ok) return
//   // prossegue com a ação

import { createContext, useContext, useState, useCallback, useRef } from 'react'

const UIContext = createContext(null)

let toastId = 0

export function UIProvider({ children }) {
  const [toasts, setToasts]         = useState([])
  const [confirmState, setConfirm]  = useState(null)
  const resolveRef                   = useRef(null)

  // ── TOAST ────────────────────────────────────────────────────────────────
  const addToast = useCallback((type, message) => {
    const id = ++toastId
    setToasts(prev => [...prev.slice(-2), { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const toast = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    warning: (msg) => addToast('warning', msg),
    info:    (msg) => addToast('info',    msg),
  }

  // ── CONFIRM ──────────────────────────────────────────────────────────────
  const confirm = useCallback(({ title, message, danger = false, labelOk = 'Confirmar', labelCancel = 'Cancelar' }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setConfirm({ title, message, danger, labelOk, labelCancel })
    })
  }, [])

  const handleConfirmClose = (result) => {
    setConfirm(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  // ── ESTILOS DOS TOASTS ───────────────────────────────────────────────────
  const toastStyles = {
    success: { icon: '✓', bg: '#dcfce7', border: '#86efac', color: '#166534' },
    error:   { icon: '✕', bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
    warning: { icon: '⚠', bg: '#fef9c3', border: '#fde047', color: '#854d0e' },
    info:    { icon: 'i', bg: '#dbeafe', border: '#93c5fd', color: '#1e40af' },
  }

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── TOASTS ── */}
      <div style={{
        position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
        width: 'min(92vw, 380px)', pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const s = toastStyles[t.type]
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: s.bg, border: `1px solid ${s.border}`, color: s.color,
              borderRadius: '12px', padding: '12px 16px',
              fontSize: '14px', fontWeight: 500, lineHeight: 1.4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              animation: 'slideDown 0.2s ease',
              pointerEvents: 'auto',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: s.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0,
              }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          )
        })}
      </div>

      {/* ── CONFIRM MODAL ── */}
      {confirmState && (
        <div
          onClick={() => handleConfirmClose(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 env(safe-area-inset-bottom)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px 20px 0 0',
              padding: '24px 24px 32px',
              width: 'min(100%, 480px)',
              animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Alça */}
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: '#e5e7eb', margin: '0 auto 20px',
            }} />

            {/* Ícone */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: confirmState.danger ? '#fee2e2' : '#dbeafe',
              fontSize: 22,
            }}>
              {confirmState.danger ? '⚠️' : '❓'}
            </div>

            <h3 style={{
              textAlign: 'center', fontSize: 17, fontWeight: 600,
              color: '#111827', margin: '0 0 8px',
            }}>
              {confirmState.title}
            </h3>

            {confirmState.message && (
              <p style={{
                textAlign: 'center', fontSize: 14, color: '#6b7280',
                margin: '0 0 24px', lineHeight: 1.5,
              }}>
                {confirmState.message}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleConfirmClose(true)}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: 'none',
                  background: confirmState.danger ? '#dc2626' : '#2563eb',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {confirmState.labelOk}
              </button>
              <button
                onClick={() => handleConfirmClose(false)}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: '1.5px solid #e5e7eb',
                  background: '#fff', color: '#374151',
                  fontSize: 15, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {confirmState.labelCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI deve ser usado dentro de <UIProvider>')
  return ctx
}