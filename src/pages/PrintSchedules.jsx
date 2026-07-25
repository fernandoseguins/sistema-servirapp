// src/pages/PrintSchedules.jsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react'

export default function PrintSchedules() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const mes = location.state?.mesAtual
  const ano = location.state?.anoAtual

  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)

  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  useEffect(() => {
    if (!departamentoId || mes === undefined || ano === undefined) {
      navigate(-1)
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

  if (loading) return <div className="text-center p-10 font-bold">A preparar documento...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0">
      
      {/* BARRA DE AÇÕES (Esconde na hora de imprimir) */}
      <div className="max-w-4xl mx-auto bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold px-4 py-2 bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 font-bold px-6 py-2 rounded-lg shadow-md transition">
          <Printer className="w-5 h-5" /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* ÁREA DA FOLHA A4 (Esta é a parte que sai no PDF) */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-md print:shadow-none print:p-0">
        
        <div className="text-center mb-8 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-black text-black uppercase tracking-widest">Escala de {departamentoNome}</h1>
          <h2 className="text-xl font-bold text-gray-700 mt-2 uppercase">{nomesMeses[mes]} {ano}</h2>
        </div>

        {escalas.length === 0 ? (
          <div className="text-center py-20 text-gray-500 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-bold text-lg">Nenhuma escala publicada neste mês.</p>
            <p className="text-sm mt-1 print:hidden">Volte ao painel e publique as escalas primeiro.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {escalas.map((escala) => (
              <div key={escala.id} className="border-2 border-gray-900 rounded-xl overflow-hidden page-break-inside-avoid">
                {/* Cabeçalho da Escala */}
                <div className="bg-gray-100 border-b-2 border-gray-900 p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-black uppercase">
                      {formatarDataLonga(escala.data)}
                    </h3>
                    <span className="bg-black text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                      {escala.turno === 'Integral' ? 'Culto Principal' : `Culto da ${escala.turno}`}
                    </span>
                  </div>
                  
                  <div className="flex gap-4 mt-2 text-sm font-bold text-gray-700">
                    {escala.titulo && <span>📌 {escala.titulo}</span>}
                    {escala.cor_roupa && <span>👕 Roupa: {escala.cor_roupa}</span>}
                    {escala.horario_ensaio && <span>⏰ Ensaio: {escala.horario_ensaio}</span>}
                  </div>
                </div>

                {/* Tabela de Membros */}
                <div className="p-0">
                  {escala.schedule_roles.length === 0 ? (
                    <p className="p-4 text-sm font-bold text-gray-400 italic">Sem membros escalados.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {escala.schedule_roles.map((papel, idx) => (
                          <tr key={idx} className="border-b border-gray-200 last:border-0">
                            <td className="py-3 px-4 w-1/3 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-r border-gray-200">
                              {papel.funcao}
                            </td>
                            <td className="py-3 px-4 text-sm font-bold text-gray-900">
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

        <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
          Documento gerado automaticamente pelo Portal IEVV Curado
        </div>

      </div>
      
      {/* Estilo para garantir que um culto não é cortado ao meio na quebra de página do PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
        }
      `}} />
    </div>
  )
}