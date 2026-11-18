// src/pages/PrintSchedules.jsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react'
import { Button } from '../components/ui'

export default function PrintSchedules() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const mes = location.state?.mesAtual
  const ano = location.state?.anoAtual

  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)

  // ✅ Volta para a tela anterior só se ela for do app; aberto direto (link/aba nova) vai para o Hub
  const voltar = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/hub', { replace: true })
  }

  const nomesMeses =['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  useEffect(() => {
    if (!departamentoId || mes === undefined || ano === undefined) {
      voltar()
      return
    }
    buscarEscalasDoMes()
  }, [departamentoId, mes, ano])

  async function buscarEscalasDoMes() {
    setLoading(true)
    
    // Pega o primeiro e o último dia do mês selecionado
    const primeiroDia = new Date(ano, mes, 1).toISOString().split('T')[0]
    const ultimoDia = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id, data, turno, cor_roupa, horario_ensaio, titulo,
        schedule_roles ( funcao, users_profile ( nome ) )
      `)
      .eq('departamento_id', departamentoId)
      .eq('status', 'Publicada') // Apenas as oficiais!
      .gte('data', primeiroDia)
      .lte('data', ultimoDia)
      .order('data', { ascending: true })

    if (!error && data) {
      setEscalas(data)
    }
    setLoading(false)
  }

  function formatarDataLonga(dataString) {
    if (!dataString) return ''
    const data = new Date(dataString + 'T12:00:00')
    return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="min-h-screen bg-bg text-ink-2 text-center p-10 font-bold" aria-busy="true">Preparando o documento...</div>

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8 print:bg-white print:p-0">
      
      {/* BARRA DE AÇÕES (Esconde na hora de imprimir) */}
      <div className="max-w-4xl mx-auto bg-surface border border-line p-3 rounded-card mb-6 flex justify-between items-center gap-2 print:hidden">
        <Button variant="secundario" onClick={voltar} icon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}>
          Voltar
        </Button>
        <Button onClick={() => window.print()} icon={<Printer className="w-4 h-4" aria-hidden="true" />}>
          Imprimir ou salvar PDF
        </Button>
      </div>

      {/* ÁREA DA FOLHA A4 (Esta é a parte que sai no PDF) */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none print:p-0">
        
        <div className="text-center mb-8 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-black text-black uppercase tracking-widest">Escala de {departamentoNome}</h1>
          <h2 className="text-xl font-bold text-black/70 mt-2 uppercase">{nomesMeses[mes]} {ano}</h2>
        </div>

        {escalas.length === 0 ? (
          <div className="text-center py-20 text-black/60 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-bold text-lg">Nenhuma escala publicada neste mês.</p>
            <p className="text-sm mt-1 print:hidden">Volte ao painel e publique as escalas primeiro.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {escalas.map((escala) => (
              <div key={escala.id} className="border-2 border-black rounded-xl overflow-hidden page-break-inside-avoid">
                {/* Cabeçalho da Escala */}
                <div className="bg-black/5 border-b-2 border-black p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-black uppercase">
                      {formatarDataLonga(escala.data)}
                    </h3>
                    <span className="bg-black text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                      {escala.turno === 'Integral' ? 'Culto Principal' : `Culto da ${escala.turno}`}
                    </span>
                  </div>
                  
                  <div className="flex gap-4 mt-2 text-sm font-bold text-black/70">
                    {escala.titulo && <span>📌 {escala.titulo}</span>}
                    {escala.cor_roupa && <span>👕 Roupa: {escala.cor_roupa}</span>}
                    {escala.horario_ensaio && <span>⏰ Ensaio: {escala.horario_ensaio}</span>}
                  </div>
                </div>

                {/* Tabela de Membros */}
                <div className="p-0">
                  {escala.schedule_roles.length === 0 ? (
                    <p className="p-4 text-sm font-bold text-black/50 italic">Sem membros escalados.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {escala.schedule_roles.map((papel, idx) => (
                          <tr key={idx} className="border-b border-black/15 last:border-0">
                            <td className="py-3 px-4 w-1/3 text-xs font-bold uppercase tracking-wider text-black/60 bg-black/[0.03] border-r border-black/15">
                              {papel.funcao}
                            </td>
                            <td className="py-3 px-4 text-sm font-bold text-black">
                              {papel.users_profile?.nome || 'Membro Excluído'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 pt-4 border-t border-black/25 text-center text-xs font-bold text-black/50 uppercase tracking-widest">
          Documento gerado automaticamente pelo Portal IEVV Curado
        </div>

      </div>
      
      {/* Estilo para garantir que um culto não é cortado ao meio na quebra de página do PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          html, body { background: #fff !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
        }
      `}} />
    </div>
  )
}