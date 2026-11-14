// src/components/AdicionarAgenda.jsx
// Botão "Adicionar à agenda" de uma escala: abre um Sheet com
// Google Agenda (link) e Apple/Outlook (.ics — compartilhar no iOS, baixar no resto).
import { useState } from 'react'
import { CalendarPlus, Download } from 'lucide-react'
import { Button, Sheet } from './ui'
import { useUI } from '../context/UIContext'
import { eventoDaEscala, gerarIcs, linkGoogleAgenda, nomeArquivoIcs, HORARIOS_TURNO } from '../utils/agenda'

// iPhone/iPad (inclui iPad com "modo desktop", que se identifica como Mac com toque)
const ehIOS = () => typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

async function salvarIcs(conteudo, nome) {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' })
  // No iOS (principalmente PWA instalado) o download de .ics não abre o Calendário;
  // a folha de compartilhar oferece "Adicionar ao Calendário"/abrir no app.
  if (ehIOS() && typeof File !== 'undefined' && navigator.canShare) {
    const arquivo = new File([blob], nome, { type: 'text/calendar' })
    if (navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: nome })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return // usuário cancelou
        // outro erro: cai no download abaixo
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * @param escala        linha de schedules (id, data, turno, titulo, horario_ensaio)
 * @param departamento  nome do departamento
 * @param funcoes       função(ões) da pessoa na escala
 * @param variante      'chip' (cabeçalho da escala) | 'icone' (ação rápida em listas)
 */
export default function AdicionarAgenda({ escala, departamento, funcoes, variante = 'chip' }) {
  const [aberto, setAberto] = useState(false)
  const { toast } = useUI()

  const evento = eventoDaEscala(escala, { departamento, funcoes })
  const horario = HORARIOS_TURNO[evento.turno]

  const abrirGoogle = () => {
    window.open(linkGoogleAgenda(evento), '_blank', 'noopener,noreferrer')
    setAberto(false)
  }
  const baixarIcs = async () => {
    try {
      await salvarIcs(gerarIcs(evento), nomeArquivoIcs(evento))
      setAberto(false)
    } catch {
      toast.error('Não foi possível gerar o arquivo da agenda.')
    }
  }

  return (
    <>
      {variante === 'icone' ? (
        <button type="button" onClick={() => setAberto(true)} aria-label="Adicionar à agenda"
          className="p-2 rounded-full text-ink-2 hover:bg-surface-2 hover:text-brand transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <CalendarPlus className="w-5 h-5" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={() => setAberto(true)}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" /> Adicionar à agenda
        </button>
      )}

      <Sheet aberto={aberto} onFechar={() => setAberto(false)} titulo="Adicionar à agenda">
        <p className="text-xs text-ink-2 mb-4">
          {horario
            ? `Horário estimado do culto: ${horario.inicio}–${horario.fim}, com lembrete 2h antes.`
            : 'Será criado um evento de dia inteiro.'}
        </p>
        <div className="space-y-2">
          <Button full variant="secundario" icon={<CalendarPlus className="w-4 h-4" aria-hidden="true" />} onClick={abrirGoogle}>
            Google Agenda
          </Button>
          <Button full variant="secundario" icon={<Download className="w-4 h-4" aria-hidden="true" />} onClick={baixarIcs}>
            Apple/Outlook (.ics)
          </Button>
        </div>
      </Sheet>
    </>
  )
}
