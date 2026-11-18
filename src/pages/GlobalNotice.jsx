// src/pages/GlobalNotice.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { Copy, CheckCircle2, RefreshCw, FileText, Search, Clock, Plus, Trash2, ChevronUp, ChevronDown, Save, RotateCcw, Users, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TopBar, Button, Card, Input, Select } from '../components/ui'
import { hojeLocal } from '../utils/datas'

// Tempos padrão por tipo de culto (podem ser sobrescritos e salvos no aparelho)
const TEMPOS_PADRAO = {
  terca:          [{ nome: 'louvor', min: 10 }, { nome: 'oração', min: 50 }],
  quinta:         [{ nome: 'louvor', min: 25 }, { nome: 'Palavra', min: 45 }, { nome: 'dízimos e ofertas', min: 6 }],
  domingoManha:   [{ nome: 'louvor', min: 15 }, { nome: 'Palavra', min: 60 }, { nome: 'dízimos e ofertas', min: 6 }],
  domingoManhaUlt:[{ nome: 'louvor', min: 25 }, { nome: 'Palavra', min: 45 }, { nome: 'dízimos e ofertas', min: 6 }],
  domingoNoite:   [{ nome: 'louvor', min: 25 }, { nome: 'Palavra', min: 45 }, { nome: 'dízimos e ofertas', min: 6 }],
  generico:       [{ nome: 'louvor', min: 20 }, { nome: 'Palavra', min: 45 }, { nome: 'dízimos e ofertas', min: 6 }],
}

const NOMES_TIPO = {
  terca: 'Reunião de Oração (terça)',
  quinta: 'Culto de quinta',
  domingoManha: 'Domingo manhã (estudo)',
  domingoManhaUlt: 'Domingo manhã (último do mês)',
  domingoNoite: 'Domingo noite',
  generico: 'Outros cultos',
}

const SUGESTOES_PARTES = ['louvor', 'momento de oração', 'ministração', 'Palavra', 'dízimos e ofertas', 'avisos', 'Santa Ceia', 'apresentação de crianças', 'testemunhos']

// Campos fixos do informativo (sempre aparecem, mesmo vazios, para preencher à mão)
const CAMPOS = [
  { key: 'ministrando',    label: 'Ministrando',        bloco: 1 },
  { key: 'conducaoLouvor', label: 'Condução do Louvor', bloco: 1 },
  { key: 'conducaoCulto',  label: 'Condução do Culto',  bloco: 1 },
  { key: 'oracao',         label: 'Oração',             bloco: 1 },
  { key: 'diaconia',       label: 'Equipe Diaconia',    bloco: 2 },
  { key: 'midia',          label: 'Equipe Mídia',       bloco: 2 },
  { key: 'sonoplastia',    label: 'Sonoplastia',        bloco: 2 },
]

const CAMPOS_VAZIOS = Object.fromEntries(CAMPOS.map(c => [c.key, '']))

const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function chaveStorage(tipo) { return `informativo_tempos_${tipo}` }

function carregarTempos(tipo) {
  try {
    const salvo = localStorage.getItem(chaveStorage(tipo))
    if (salvo) {
      const arr = JSON.parse(salvo)
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* storage indisponível: usa padrão */ }
  return TEMPOS_PADRAO[tipo].map(p => ({ ...p }))
}

function somarMinutos(hhmm, minutos) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function GlobalNotice() {
  const navigate = useNavigate()
  const hoje = hojeLocal()

  const [dataSelecionada,  setDataSelecionada]  = useState(hoje)
  const [turnoSelecionado, setTurnoSelecionado] = useState('Noite')
  const [incluirRascunho,  setIncluirRascunho]  = useState(true)
  const [pessoas,          setPessoas]          = useState(CAMPOS_VAZIOS)
  const [outrasEquipes,    setOutrasEquipes]    = useState([])  // [{ label, value }]
  const [rascunhos,        setRascunhos]        = useState([])  // nomes de departamentos em rascunho
  const [partes,           setPartes]           = useState([])
  const [horaInicio,       setHoraInicio]       = useState('')
  const [textoInformativo, setTextoInformativo] = useState('')
  const [editadoAMao,      setEditadoAMao]      = useState(false)
  const [copiado,          setCopied]           = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [salvouPadrao,     setSalvouPadrao]     = useState(false)

  // Informações do dia selecionado
  const info = useMemo(() => {
    const dataObj   = new Date(dataSelecionada + 'T12:00:00')
    const diaSemana = dataObj.getDay()  // 0=Dom, 2=Ter, 4=Qui
    const dataFmt   = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}`

    const proxDomingo = new Date(dataObj)
    proxDomingo.setDate(dataObj.getDate() + 7)
    const ehUltimoDomingo = diaSemana === 0 && proxDomingo.getMonth() !== dataObj.getMonth()

    let tipo
    if (diaSemana === 2) tipo = 'terca'
    else if (diaSemana === 4) tipo = 'quinta'
    else if (diaSemana === 0 && turnoSelecionado === 'Manhã') tipo = ehUltimoDomingo ? 'domingoManhaUlt' : 'domingoManha'
    else if (diaSemana === 0) tipo = 'domingoNoite'
    else tipo = 'generico'

    let fraseDia
    if (diaSemana === 0) {
      const turnoTxt = turnoSelecionado === 'Integral' ? 'manhã/noite' : turnoSelecionado.toLowerCase()
      fraseDia = `nosso culto de domingo ${turnoTxt} (${dataFmt})`
    } else if (diaSemana === 2) fraseDia = `nossa Reunião de Oração (${dataFmt})`
    else if (diaSemana === 4) fraseDia = `nosso culto de quinta (${dataFmt})`
    else fraseDia = `nosso culto (${dataFmt})`

    return { diaSemana, tipo, fraseDia, ehDomingo: diaSemana === 0 }
  }, [dataSelecionada, turnoSelecionado])

  // Ao trocar o tipo de culto, carrega os tempos padrão (ou os salvos)
  useEffect(() => { setPartes(carregarTempos(info.tipo)) }, [info.tipo])

  useEffect(() => { buscarEscalas() }, [dataSelecionada, turnoSelecionado, incluirRascunho])

  async function buscarEscalas() {
    setLoading(true)

    // Busca TODAS as escalas do dia; o filtro de turno é feito aqui
    // (escalas podem estar como 'Integral' ou 'Extra', não só Manhã/Noite)
    const { data: escalas, error } = await supabase
      .from('schedules')
      .select(`
        id, turno, status,
        departamentos ( nome, tipo ),
        schedule_roles ( funcao, nome_externo, users_profile ( nome ) )
      `)
      .eq('data', dataSelecionada)

    if (error || !escalas) { setLoading(false); return }

    const turnoBate = (t) => {
      // Dias de semana têm só um culto: qualquer turno vale
      if (!info.ehDomingo) return true
      if (turnoSelecionado === 'Integral') return true
      return t === turnoSelecionado || t === 'Integral'
    }

    const listas = Object.fromEntries(CAMPOS.map(c => [c.key, []]))
    const vozPrincipal = []
    const outras = {}   // { 'Equipe Infantil': [...] }
    const deptsRascunho = new Set()

    const add = (arr, nome) => { if (nome && !arr.includes(nome)) arr.push(nome) }

    escalas.forEach(escala => {
      if (!turnoBate(escala.turno)) return
      const deptNome = escala.departamentos?.nome || ''
      const deptTipo = escala.departamentos?.tipo || ''
      const n = normalizar(deptNome)

      if (escala.status !== 'Publicada') {
        if (!incluirRascunho) return
        deptsRascunho.add(deptNome || 'Departamento')
      }

      const ehLouvor    = deptTipo === 'louvor' || n === 'louvor'
      const ehMidia     = deptTipo === 'midia' || n.includes('midia')
      const ehDiaconia  = n.includes('diacon')
      const ehMinistros = deptTipo === 'ministros' || n.includes('ministros')

      ;(escala.schedule_roles || []).forEach(papel => {
        // Nome cadastrado OU nome de ministro de fora (visitante)
        const nomeCompleto = papel.nome_externo || papel.users_profile?.nome || ''
        const nome = nomeCompleto.trim().split(/\s+/).slice(0, 2).join(' ')
        if (!nome) return  // vaga vazia
        const funcao = papel.funcao || ''
        const f = normalizar(funcao)

        if (ehLouvor) {
          if (f.includes('conducao')) add(listas.conducaoLouvor, nome)
          else if (f.includes('voz principal')) add(vozPrincipal, nome)
          if (f.includes('sonoplastia') || f.includes('mesa de som')) add(listas.sonoplastia, nome)
        } else if (ehMinistros) {
          if (f === 'ministro' || f.includes('pregacao')) add(listas.ministrando, nome)
          if (f.includes('conducao de culto')) add(listas.conducaoCulto, nome)
          if (f.includes('oracao') || f.includes('intercessao')) add(listas.oracao, nome)
        } else if (ehMidia) {
          add(listas.midia, nome)
        } else if (ehDiaconia) {
          add(listas.diaconia, nome)
        } else {
          const label = n.includes('cantina') ? 'Cantina' : `Equipe ${deptNome}`
          outras[label] = outras[label] || []
          add(outras[label], nome)
        }
      })
    })

    // Sem "Condução" escalada (ex.: terça), usa quem está na Voz Principal
    if (listas.conducaoLouvor.length === 0) listas.conducaoLouvor.push(...vozPrincipal)

    setPessoas(Object.fromEntries(Object.entries(listas).map(([k, v]) => [k, v.join(', ')])))
    setOutrasEquipes(Object.entries(outras).map(([label, v]) => ({ label, value: v.join(', ') })))
    setRascunhos([...deptsRascunho])
    setLoading(false)
  }

  // Monta o texto a partir dos campos + tempos
  const textoGerado = useMemo(() => {
    const linhas = (bloco) => CAMPOS.filter(c => c.bloco === bloco).map(c => `${c.label}: ${pessoas[c.key] || ''}`)
    const bloco2 = [...linhas(2), ...outrasEquipes.filter(o => o.value.trim()).map(o => `${o.label}: ${o.value}`)]

    let acumulado = 0
    const tempos = partes
      .filter(p => p.nome.trim() && Number(p.min) > 0)
      .map(p => {
        const min = Number(p.min)
        const linha = `${String(min).padStart(2, '0')} min de ${p.nome.trim()}`
        const prefixo = horaInicio ? `${somarMinutos(horaInicio, acumulado)} - ` : ''
        acumulado += min
        return prefixo + linha
      })
    const total = partes.reduce((s, p) => s + (Number(p.min) || 0), 0)
    const fim = horaInicio && total ? `\n\nPrevisão de término: ${somarMinutos(horaInicio, total)}` : ''

    return `Paz povo santo!

Segue o informativo para o ${info.fraseDia}
✝️🙏🏼🕊️❤️‍🔥

${linhas(1).join('\n')}

${bloco2.join('\n')}

⏰ Tempo Estimado ⏰

${tempos.join('\n')}${fim}`
  }, [pessoas, outrasEquipes, partes, horaInicio, info.fraseDia])

  // Sempre que os campos mudam, o rascunho é regenerado (descarta edição manual)
  useEffect(() => { setTextoInformativo(textoGerado); setEditadoAMao(false) }, [textoGerado])

  // ── Edição de tempos ──
  const atualizarParte = (i, campo, valor) =>
    setPartes(prev => prev.map((p, idx) => idx === i ? { ...p, [campo]: campo === 'min' ? valor.replace(/\D/g, '').slice(0, 3) : valor } : p))
  const removerParte = (i) => setPartes(prev => prev.filter((_, idx) => idx !== i))
  const moverParte = (i, dir) => setPartes(prev => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const novo = [...prev]
    ;[novo[i], novo[j]] = [novo[j], novo[i]]
    return novo
  })
  const adicionarParte = (nome = '') => setPartes(prev => [...prev, { nome, min: 10 }])

  function salvarComoPadrao() {
    try {
      localStorage.setItem(chaveStorage(info.tipo), JSON.stringify(partes.map(p => ({ nome: p.nome, min: Number(p.min) || 0 }))))
      setSalvouPadrao(true)
      setTimeout(() => setSalvouPadrao(false), 2000)
    } catch { /* storage indisponível */ }
  }

  function restaurarPadrao() {
    try { localStorage.removeItem(chaveStorage(info.tipo)) } catch { /* ignora */ }
    setPartes(TEMPOS_PADRAO[info.tipo].map(p => ({ ...p })))
  }

  const totalMin = partes.reduce((s, p) => s + (Number(p.min) || 0), 0)

  function copiar() {
    navigator.clipboard.writeText(textoInformativo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const inputCls = 'w-full h-10 rounded-ctl bg-surface border border-line px-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand'
  const iconBtn = 'rounded-ctl text-muted hover:text-ink hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30'

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Informativo"
        subtitulo="Texto do culto para o WhatsApp"
        onVoltar={() => navigate(-1)}
        icone={<span className="w-10 h-10 rounded-ctl flex items-center justify-center bg-brand/10 text-brand">
          <FileText className="w-5 h-5" aria-hidden="true" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        {/* FILTROS */}
        <Card className="space-y-3">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <Search className="w-4 h-4 text-brand" aria-hidden="true" /> Escalas do dia
          </h2>
          <div className="flex gap-3">
            <Input className="flex-[2]" label="Data do culto" type="date" value={dataSelecionada}
              onChange={e => setDataSelecionada(e.target.value)} />
            {info.ehDomingo && (
              <Select className="flex-1" label="Turno" value={turnoSelecionado}
                onChange={e => setTurnoSelecionado(e.target.value)}
                options={[{ value: 'Integral', label: 'Integral' }, { value: 'Manhã', label: 'Manhã' }, { value: 'Noite', label: 'Noite' }]} />
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" checked={incluirRascunho} onChange={e => setIncluirRascunho(e.target.checked)}
              className="w-4 h-4 accent-[rgb(var(--brand))]" />
            Incluir escalas em rascunho (não publicadas)
          </label>
          {rascunhos.length > 0 && (
            <p className="text-xs text-warning bg-warning-soft rounded-ctl px-3 py-2 flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Em rascunho: {rascunhos.join(', ')}. Confira antes de enviar.
            </p>
          )}
        </Card>

        {/* ESCALADOS (editáveis) */}
        <Card className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" aria-hidden="true" /> Escalados
            </h2>
            <Button variant="fantasma" size="sm" onClick={buscarEscalas}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />}>
              Recarregar
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPOS.map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={`campo-${key}`} className="text-xs font-semibold mb-1 block text-ink-2">{label}</label>
                <input id={`campo-${key}`} value={pessoas[key]} placeholder={loading ? 'Buscando...' : 'Ninguém escalado'}
                  onChange={e => setPessoas(prev => ({ ...prev, [key]: e.target.value }))}
                  className={inputCls} />
              </div>
            ))}
            {outrasEquipes.map((o, i) => (
              <div key={o.label}>
                <label htmlFor={`outra-${i}`} className="text-xs font-semibold mb-1 block text-ink-2">{o.label}</label>
                <input id={`outra-${i}`} value={o.value}
                  onChange={e => setOutrasEquipes(prev => prev.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                  className={inputCls} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted">Deixe em branco para tirar uma equipe extra do texto.</p>
        </Card>

        {/* TEMPOS DO CULTO */}
        <Card className="space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" aria-hidden="true" /> Tempos do culto
              </h2>
              <p className="text-xs text-ink-2 mt-0.5">{NOMES_TIPO[info.tipo]} · total {totalMin} min</p>
            </div>
            <div className="w-28 shrink-0">
              <label htmlFor="hora-inicio" className="text-[11px] text-ink-2 block mb-1">Início (opcional)</label>
              <input id="hora-inicio" type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className={inputCls} />
            </div>
          </div>

          <ol className="space-y-2">
            {partes.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moverParte(i, -1)} disabled={i === 0} aria-label={`Subir ${p.nome || 'parte'}`} className={iconBtn}>
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => moverParte(i, 1)} disabled={i === partes.length - 1} aria-label={`Descer ${p.nome || 'parte'}`} className={iconBtn}>
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <input value={p.min} inputMode="numeric" aria-label={`Minutos de ${p.nome || 'parte'}`} onChange={e => atualizarParte(i, 'min', e.target.value)}
                  className={`${inputCls} !w-14 text-center font-bold`} />
                <span className="text-xs text-ink-2 shrink-0">min de</span>
                <input value={p.nome} placeholder="ex.: louvor" aria-label="Nome da parte" onChange={e => atualizarParte(i, 'nome', e.target.value)}
                  className={`${inputCls} flex-1 min-w-0`} />
                <button type="button" onClick={() => removerParte(i)} aria-label={`Remover ${p.nome || 'parte'}`}
                  className={`p-2 ${iconBtn} hover:!text-danger`}>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES_PARTES.filter(s => !partes.some(p => normalizar(p.nome) === normalizar(s))).map(s => (
              <button type="button" key={s} onClick={() => adicionarParte(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-brand/10 text-brand font-semibold hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                + {s}
              </button>
            ))}
            <button type="button" onClick={() => adicionarParte()}
              className="text-xs px-2.5 py-1 rounded-full bg-surface-2 text-ink-2 font-semibold hover:bg-line flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Plus className="w-3 h-3" aria-hidden="true" /> Outra
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={salvarComoPadrao}
              icon={salvouPadrao ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}>
              {salvouPadrao ? 'Salvo' : 'Salvar como padrão'}
            </Button>
            <Button size="sm" variant="secundario" onClick={restaurarPadrao} icon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}>
              Restaurar
            </Button>
          </div>
          <p className="text-[11px] text-muted">O padrão fica salvo neste aparelho, separado por tipo de culto.</p>
        </Card>

        {/* EDITOR */}
        <Card padded={false} className="overflow-hidden">
          <div className="bg-surface-2 px-4 py-3 border-b border-line flex justify-between items-center">
            <label htmlFor="texto-final" className="text-xs font-bold text-ink-2">Texto final</label>
            {editadoAMao && (
              <Button variant="fantasma" size="sm" onClick={() => { setTextoInformativo(textoGerado); setEditadoAMao(false) }}
                icon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}>
                Gerar de novo
              </Button>
            )}
          </div>

          <div className="p-4">
            <p className="text-[11px] text-muted mb-2">
              Dá para ajustar aqui. Mudar os campos acima gera o texto de novo.
            </p>
            <textarea
              id="texto-final"
              value={textoInformativo}
              onChange={e => { setTextoInformativo(e.target.value); setEditadoAMao(true) }}
              className="w-full h-80 bg-surface-2 border border-line rounded-ctl p-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand leading-relaxed resize-none"
            />
          </div>

          <div className="p-4 pt-0">
            <Button full onClick={copiar}
              className={copiado ? '!bg-success !text-on-success' : ''}
              icon={copiado ? <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> : <Copy className="w-5 h-5" aria-hidden="true" />}>
              <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar para o WhatsApp'}</span>
            </Button>
          </div>
        </Card>

      </main>
    </div>
  )
}
