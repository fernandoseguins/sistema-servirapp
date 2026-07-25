// src/pages/GlobalNotice.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Copy, CheckCircle2, RefreshCw, FileText, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { hojeLocal } from '../utils/datas'

export default function GlobalNotice() {
  const navigate = useNavigate()
  const hoje = hojeLocal()

  const [dataSelecionada,  setDataSelecionada]  = useState(hoje)
  const [turnoSelecionado, setTurnoSelecionado] = useState('Noite')
  const [textoInformativo, setTextoInformativo] = useState('')
  const [copiado,          setCopied]           = useState(false)
  const [loading,          setLoading]          = useState(false)

  useEffect(() => { gerarInformativo() }, [dataSelecionada, turnoSelecionado])

  async function gerarInformativo() {
    setLoading(true)

    const { data: escalas, error } = await supabase
      .from('schedules')
      .select(`
        id, turno, status,
        departamentos ( nome, tipo ),
        schedule_roles ( funcao, nome_externo, users_profile ( nome ) )
      `)
      .eq('data', dataSelecionada)
      .eq('turno', turnoSelecionado)

    if (error || !escalas) { setLoading(false); return }

    let conducaoLouvor = []
    let sonoplastia    = []
    let equipeMidia    = []
    let equipeDiaconia = []
    // ✅ Ministros
    let ministrando    = []
    let conducaoCulto  = []
    let oracao         = []

    escalas.forEach(escala => {
      const dept   = escala.departamentos?.nome
      const deptTipo = escala.departamentos?.tipo
      const status = escala.status

      // Só processa escalas publicadas
      if (status !== 'Publicada') return

      escala.schedule_roles.forEach(papel => {
        // Nome cadastrado OU nome de ministro de fora (visitante)
        const primeiroNome = papel.nome_externo
          ? papel.nome_externo.split(' ').slice(0, 2).join(' ')
          : (papel.users_profile?.nome?.split(' ').slice(0, 2).join(' ') || '')
        const funcao       = papel.funcao || ''

        if (deptTipo === 'louvor') {
          if (funcao.includes('Condução') || funcao.includes('Voz Principal / Condução')) {
            conducaoLouvor.push(primeiroNome)
          }
          if (funcao.includes('Sonoplastia') || funcao.includes('Mesa de Som')) {
            sonoplastia.push(primeiroNome)
          }
        }

        if (deptTipo === 'midia') {
          equipeMidia.push(primeiroNome)
        }

        if (dept === 'Diaconia') {
          equipeDiaconia.push(primeiroNome)
        }

        // ✅ Ministros — puxa as 3 funções
        if (deptTipo === 'ministros') {
          if (funcao === 'Ministro') ministrando.push(primeiroNome)
          if (funcao === 'Condução de Culto') conducaoCulto.push(primeiroNome)
          if (funcao.includes('Oração')) oracao.push(primeiroNome)  // pega "Oração" e "Condução da Oração"
        }
      })
    })

    // Formatar data
    const dataObj  = new Date(dataSelecionada + 'T12:00:00')
    const diaNum   = String(dataObj.getDate()).padStart(2, '0')
    const mesNum   = String(dataObj.getMonth() + 1).padStart(2, '0')
    const diaSemana = dataObj.getDay()  // 0=Dom, 2=Ter, 4=Qui
    const dataFmt  = `${diaNum}/${mesNum}`

    // ✅ Frase de abertura por tipo de dia (com gênero/turno corretos)
    let fraseDia
    if (diaSemana === 0) {
      // Domingo — leva o turno
      const turnoTxt = turnoSelecionado === 'Integral' ? 'manhã/noite'
        : turnoSelecionado.toLowerCase()
      fraseDia = `nosso culto de domingo ${turnoTxt} (${dataFmt})`
    } else if (diaSemana === 2) {
      // Terça — sem turno
      fraseDia = `nossa Reunião de Oração (${dataFmt})`
    } else if (diaSemana === 4) {
      // Quinta — sem turno
      fraseDia = `nosso culto de quinta (${dataFmt})`
    } else {
      // Outros dias — genérico
      fraseDia = `nosso culto (${dataFmt})`
    }

    const fmt = (arr) => arr.length > 0 ? arr.join(', ') : ''

    // ✅ Detecta se é o último domingo do mês
    const ehUltimoDomingo = (() => {
      if (diaSemana !== 0) return false
      const proxDomingo = new Date(dataObj)
      proxDomingo.setDate(dataObj.getDate() + 7)
      return proxDomingo.getMonth() !== dataObj.getMonth()
    })()

    // ✅ Bloco de tempos por tipo de dia
    let blocoTempos
    if (diaSemana === 2) {
      // Terça — Reunião de Oração
      blocoTempos =
`10 min de louvor
50 min de oração`
    } else if (diaSemana === 4) {
      // Quinta
      blocoTempos =
`25 min de louvor
45 min de Palavra
06 min de dízimos e ofertas`
    } else if (diaSemana === 0 && turnoSelecionado === 'Manhã') {
      // Domingo manhã — Estudo OU último domingo
      blocoTempos = ehUltimoDomingo
        ? `25 min de louvor
45 min de Palavra
06 min de dízimos e ofertas`
        : `15 min de louvor
60 min de Palavra
06 min de dízimos e ofertas`
    } else if (diaSemana === 0) {
      // Domingo noite (ou integral)
      blocoTempos =
`25 min de louvor
45 min de Palavra
06 min de dízimos e ofertas`
    } else {
      // Genérico
      blocoTempos =
`20 min de louvor
45 min de Palavra
06 min de dízimos e ofertas`
    }

    const template =
`Paz povo santo!

Segue o informativo para o ${fraseDia}
✝️🙏🏼🕊️❤️‍🔥

Ministrando: ${fmt(ministrando)}
Condução do Louvor: ${fmt(conducaoLouvor)}
Condução do Culto: ${fmt(conducaoCulto)}
Oração: ${fmt(oracao)}

Equipe Diaconia: ${fmt(equipeDiaconia)}
Equipe Mídia: ${fmt(equipeMidia)}
Sonoplastia: ${fmt(sonoplastia)}

⏰ Tempo Estimado ⏰

${blocoTempos}`

    setTextoInformativo(template)
    setLoading(false)
  }

  function copiar() {
    navigator.clipboard.writeText(textoInformativo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      <PageHeader
        title="Informativo Geral"
        subtitle="Gerador automático para WhatsApp"
        icon={<FileText className="w-5 h-5" />}
        color="bg-gray-900"
      />

      <div className="max-w-xl mx-auto px-4 space-y-5">

        {/* FILTROS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" /> Buscar escalas do dia
          </p>
          <div className="flex gap-3">
            <div className="flex-[2]">
              <label className="text-xs text-gray-500 mb-1 block font-medium">Data do Culto</label>
              <input type="date" value={dataSelecionada}
                onChange={e => setDataSelecionada(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block font-medium">Turno</label>
              <select value={turnoSelecionado}
                onChange={e => setTurnoSelecionado(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                <option value="Integral">Integral</option>
                <option value="Manhã">Manhã</option>
                <option value="Noite">Noite</option>
              </select>
            </div>
          </div>
        </div>

        {/* PRÉVIA DOS DADOS ENCONTRADOS */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Ministrando', value: textoInformativo.match(/Ministrando: (.+)/)?.[1] || '—', color: 'text-red-700' },
            { label: 'Condução Louvor', value: textoInformativo.match(/Condução do Louvor: (.+)/)?.[1] || '—', color: 'text-blue-600' },
            { label: 'Condução Culto', value: textoInformativo.match(/Condução do Culto: (.+)/)?.[1] || '—', color: 'text-red-700' },
            { label: 'Oração', value: textoInformativo.match(/Oração: (.+)/)?.[1] || '—', color: 'text-red-700' },
            { label: 'Diaconia', value: textoInformativo.match(/Equipe Diaconia: (.+)/)?.[1] || '—', color: 'text-gray-700' },
            { label: 'Mídia', value: textoInformativo.match(/Equipe Mídia: (.+)/)?.[1] || '—', color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xs font-semibold ${color} leading-snug`}>
                {loading ? <span className="animate-pulse">Buscando...</span> : value}
              </p>
            </div>
          ))}
        </div>

        {/* EDITOR */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              📝 Rascunho Final
            </span>
            {loading && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
          </div>

          <div className="p-4">
            <p className="text-[10px] text-gray-400 mb-2 font-medium">
              Edite abaixo para preencher o que falta antes de copiar.
            </p>
            <textarea
              value={textoInformativo}
              onChange={e => setTextoInformativo(e.target.value)}
              className="w-full h-80 bg-amber-50/40 border border-amber-100 rounded-xl p-4 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-amber-300 leading-relaxed resize-none"
            />
          </div>

          <div className="p-4 pt-0">
            <button onClick={copiar}
              className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]
                ${copiado ? 'bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
              {copiado
                ? <><CheckCircle2 className="w-5 h-5" /> Copiado com sucesso!</>
                : <><Copy className="w-5 h-5" /> Copiar para WhatsApp</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}