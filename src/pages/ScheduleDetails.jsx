// src/pages/ScheduleDetails.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { rotuloTurno } from '../utils/escalas'
import { urlSegura } from '../utils/url'
import { ScheduleDetailsSkeleton } from '../components/Skeletons'
import AdicionarAgenda from '../components/AdicionarAgenda'
import { useUI } from '../context/UIContext'
import { enviarNotificacao, enviarNotificacaoEmMassa } from '../utils/notificacoes'
import { hojeLocal } from '../utils/datas'
import { CONFIRMADO, RECUSADO, PENDENTE, statusPresenca, tomPresenca, rotuloPresenca, resumoPresenca, responderEscala } from '../utils/presenca'
import { Button, Pill } from '../components/ui'
import { ArrowLeft, CalendarDays, Clock, Palette, UserPlus, CheckCircle2, XCircle, Trash2, Send, AlertCircle, ShieldAlert, Music, Plus, PlayCircle, Edit2, FileText, Tag, MessageCircle, Search, ChevronUp, ChevronDown, RefreshCw, Check, X, ListChecks, Upload, Download, MessageSquare, PenLine, Mic2 } from 'lucide-react'

// Upload do mapa vocal: tipos aceitos e tamanho máximo
const MIME_MAPA = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
}
const EXTENSOES_MAPA   = Object.keys(MIME_MAPA)
const TAMANHO_MAX_MAPA = 15 * 1024 * 1024

export default function ScheduleDetails() {
  const params = useParams()
  const idDaEscala = params.id || params.escalaId || Object.values(params)[0]

  const navigate = useNavigate()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const [departamentoNome, setDepartamentoNome] = useState(location.state?.departamentoNome || '')
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  

  const [isLiderOuAdmin, setIsLiderOuAdmin] = useState(false)

  const [escala, setEscala] = useState(null)
  const [meuId, setMeuId] = useState(null)
  const [meuPapelId, setMeuPapelId] = useState(null)
  
  const [souConducao, setSouConducao] = useState(false)
  
  const [membrosEquipa, setMembrosEquipa] = useState([])
  const [novoMembroId, setNovoMembroId] = useState('')
  const [novasFuncoes, setNovasFuncoes] = useState([]) 
  
  const [musicasEscala, setMusicasEscala] = useState([])
  const [repertorio,       setRepertorio]       = useState([])
  const [repertorioLouvor, setRepertorioLouvor] = useState([])
  const [statusRepLouvor,  setStatusRepLouvor]  = useState(null)
  const [modalMusicaAberto, setModalMusicaAberto] = useState(false)

  const [buscaMusica, setBuscaMusica] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  
  const [modalTomAberto, setModalTomAberto] = useState(false)
  const [idRelacaoTomEditando, setIdRelacaoTomEditando] = useState(null)

  const [modalRoupaAberto, setModalRoupaAberto] = useState(false)
  const [corEditando, setCorEditando] = useState('')

  const [pedidosTroca, setPedidosTroca] = useState([])
  const [modalTrocaAberto, setModalTrocaAberto] = useState(false)
  const [papelParaTrocar, setPapelParaTrocar] = useState(null)
  const [substitutoId, setSubstitutoId] = useState('')
  const [funcoesSelecionadasTroca, setFuncoesSelecionadasTroca] = useState([])
  
  const [motivoTroca, setMotivoTroca] = useState('')
  // ── Confirmação de presença: id do papel sendo respondido ──
  const [respondendoId, setRespondendoId] = useState(null)
  
  const [loading, setLoading] = useState(true)
  const { toast, confirm } = useUI()
  const [erroFatal, setErroFatal] = useState(null)
  const [checklistEscala,  setChecklistEscala]  = useState(null)
  const [meuPapel,         setMeuPapel]         = useState(null)
  // ── Mapa Vocal ──
  const [mapasVocais,      setMapasVocais]       = useState([])  // [{id, url, nome_arquivo}]
  const [uploadingMapa,    setUploadingMapa]     = useState(false)
  // ── Observações ──
  const [obsCondutor,      setObsCondutor]       = useState('')
  const [obsLideres,       setObsLideres]        = useState('')
  const [salvandoObs,      setSalvandoObs]       = useState(false)
  const [salvandoChecklist, setSalvandoChecklist] = useState(false)
  const [checklistForm, setChecklistForm] = useState({
    equipamentos_ok: false,
    computadores_ok: false,
    tvs_ok: false,
    ar_ok: false,
    bancada_ok: false,
    relato_problema: '',
  })

  const ITENS_CHECKLIST = [
    { key: 'equipamentos_ok', label: 'Equipamentos de som OK' },
    { key: 'computadores_ok', label: 'Computadores OK' },
    { key: 'tvs_ok',          label: 'TVs / Telões OK' },
    { key: 'ar_ok',           label: 'Ar-condicionado OK' },
    { key: 'bancada_ok',      label: 'Bancada / Mesa organizada' },
  ]

  // ✅ enviarNotificacao vem de utils/notificacoes.js — dispara o push via
  // trigger no banco. Wrapper para manter a mesma assinatura usada neste arquivo.
  const notificar = (userId, titulo, mensagemTexto, tipo, linkInterno = null) =>
    enviarNotificacao({
      userId,
      departamentoId: departamentoId || escala?.departamento_id,
      titulo,
      mensagem: mensagemTexto,
      tipo,
      link: linkInterno,
    })

  // Textos das notificações: "Louvor · 16/11 (Culto da noite)", primeiro nome e
  // lista de funções com singular/plural correto ("Violão" / "Violão e Teclado").
  const primeiroNome = (nome) => (nome || '').trim().split(/\s+/)[0] || ''
  const separarFuncoes = (texto) => (texto || '').split(/[+/]/).map(f => f.trim()).filter(Boolean)
  const juntarFuncoes = (lista) => lista.length <= 1 ? (lista[0] || '') : `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
  const rotuloFuncoes = (lista) => `${lista.length > 1 ? 'funções' : 'função'}: ${juntarFuncoes(lista)}`
  const dataCurta = (iso) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : ''
  const contextoEscala = () => [departamentoNome, `${dataCurta(escala?.data)} (${rotuloTurno(escala?.turno)})`].filter(Boolean).join(' · ')


  const funcoesMidia = ['Computador', 'Fotografia', 'Redação']
  const funcoesInfantil = ['Berçário', 'Sala 03 - 08 anos', 'Sala 09 - 11 anos', 'Acolhimento', 'Auxiliar']
  const funcoesLouvor = ['Condução', 'Voz Principal', 'Backing Vocal', 'Sonoplastia', 'Violão', 'Teclado', 'Bateria', 'Baixo', 'Guitarra', 'Percussão']
  const funcoesDiaconia = ['Diaconia']

  const opcoesFuncao = 
    departamentoTipo === 'midia' ? funcoesMidia : 
    departamentoTipo === 'infantil' ? funcoesInfantil : 
    departamentoTipo === 'louvor' ? funcoesLouvor : 
    departamentoNome === 'Diaconia' ? funcoesDiaconia : ['Voluntário']

  const tonsMaiores = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
  const tonsMenores = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']

  useEffect(() => {
    if (idDaEscala) buscarDetalhes()
    else { setErroFatal("Não foi possível encontrar o ID da escala na barra de endereço."); setLoading(false) }
  }, [idDaEscala])

  async function buscarDetalhes(silencioso = false) {
    if (!silencioso) setLoading(true)
    setErroFatal(null)
    try {
      // ✅ Busca o usuário e os detalhes da escala em paralelo
      // swap_requests só precisa do idDaEscala, que já está disponível
      const [{ data: { user } }, { data: esc, error }, { data: trocas }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('schedules')
          .select(`
            id, data, turno, horario_ensaio, cor_roupa, status, departamento_id, titulo, status_repertorio, mapa_vocal_url, mapa_vocal_digital, obs_condutor, obs_lideres,
            departamentos ( nome, tipo ),
            schedule_roles ( id, funcao, status_confirmacao, user_id, users_profile ( nome ) ),
            schedule_songs ( id, song_id, ordem, tom, songs ( id, titulo, artista, tom, link_youtube, link_cifra, categoria ) )
          `)
          .eq('id', idDaEscala)
          .single(),
        supabase.from('swap_requests').select('*').eq('schedule_id', idDaEscala).eq('status', 'pendente'),
      ])

      if (error) throw error
      if (trocas) setPedidosTroca(trocas)
      if (user) setMeuId(user.id)

      const nomeRealDoDepartamento = esc?.departamentos?.nome || location.state?.departamentoNome || ''
      if (nomeRealDoDepartamento) setDepartamentoNome(nomeRealDoDepartamento)
      const tipoRealDoDepartamento = esc?.departamentos?.tipo || location.state?.departamentoTipo || 'generico'
      setDepartamentoTipo(tipoRealDoDepartamento)

      if (user && esc) {
        // ✅ Roles do user, equipa do departamento e repertório (se Louvor) rodam em paralelo
        const paralelasPos = [
          supabase.from('membros_departamentos').select('role, departamento_id').eq('user_id', user.id),
          supabase.from('membros_departamentos').select('users_profile(id, nome)').eq('departamento_id', esc.departamento_id),
        ]

        if (tipoRealDoDepartamento === 'louvor') {
          paralelasPos.push(
            supabase.from('songs').select('*').eq('departamento_id', esc.departamento_id).order('titulo')
          )
        }

        const [deptsRes, equipaRes, repRes] = await Promise.all(paralelasPos)

        // Permissões do utilizador (super-admin pela flag no banco)
        const { data: ehSuperFlag } = await supabase.rpc('sou_super_admin_flag')
        let ehMaster = ehSuperFlag === true
        let ehLiderAQUI = false
        if (deptsRes.data) {
          if (deptsRes.data.some(d => d.role === 'admin')) ehMaster = true
          const vinculo = deptsRes.data.find(d => d.departamento_id === esc.departamento_id)
          if (vinculo && (vinculo.role === 'líder' || vinculo.role === 'admin')) ehLiderAQUI = true
        }
        setIsLiderOuAdmin(ehMaster || ehLiderAQUI)

        // ✅ Se for Mídia, busca o repertório do Louvor do mesmo dia
        if ((nomeRealDoDepartamento === 'Mídia' || nomeRealDoDepartamento === 'Midia') && esc?.data) {
          const { data: escLouvor } = await supabase
            .from('schedules')
            .select(`
              status_repertorio,
              schedule_songs (
                ordem, tom,
                songs ( titulo, artista, tom, link_youtube, link_cifra )
              ),
              departamentos!inner ( nome )
            `)
            .eq('data', esc.data)
            .eq('turno', esc.turno)
            .eq('departamentos.nome', 'Louvor')
            .maybeSingle()

          if (escLouvor?.schedule_songs?.length > 0) {
            const ordenadas = [...escLouvor.schedule_songs].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
            setRepertorioLouvor(ordenadas)
            setStatusRepLouvor(escLouvor.status_repertorio)
          } else {
            setRepertorioLouvor([])
            setStatusRepLouvor(null)
          }
        }

        // ✅ Se for Mídia, busca o checklist deste schedule
        if ((nomeRealDoDepartamento === 'Mídia' || nomeRealDoDepartamento === 'Midia') && esc?.id) {
          const { data: cl } = await supabase
            .from('media_checklists')
            .select('*')
            .eq('schedule_id', esc.id)
            .maybeSingle()
          setChecklistEscala(cl || null)
        }

        // Equipa do departamento
        if (equipaRes.data) {
          setMembrosEquipa(
            equipaRes.data.map(e => e.users_profile).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome))
          )
        }

        // Repertório (apenas Louvor)
        if (repRes?.data) setRepertorio(repRes.data)
      }

      if (esc) {
        esc.schedule_roles = esc.schedule_roles || []
        if (!esc.status_repertorio) esc.status_repertorio = 'rascunho'
        if (esc.obs_condutor) setObsCondutor(esc.obs_condutor)
        if (esc.obs_lideres) setObsLideres(esc.obs_lideres)

        setEscala(esc)

        // Busca a lista de mapas vocais enviados para esta escala
        const { data: mapasData } = await supabase
          .from('mapas_vocais')
          .select('id, url, nome_arquivo')
          .eq('schedule_id', idDaEscala)
          .order('enviado_em', { ascending: true })
        if (mapasData && mapasData.length > 0) {
          setMapasVocais(mapasData)
        } else if (esc.mapa_vocal_url) {
          // Compat: mapa enviado antes da migração para a tabela mapas_vocais.
          // id sintético — removerMapaVocal trata este caso limpando a coluna.
          setMapasVocais([{ id: '__legado__', url: esc.mapa_vocal_url, nome_arquivo: 'Mapa vocal' }])
        }
        setMusicasEscala((esc.schedule_songs || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)))

        if (user) {
          const papelEncontrado = esc.schedule_roles.find(r => r.user_id === user.id)
setMeuPapel(papelEncontrado || null)
if (papelEncontrado) {
  setMeuPapelId(papelEncontrado.id)
  const isTerca = new Date(esc.data + 'T12:00:00').getDay() === 2
  setSouConducao(papelEncontrado.funcao.includes('Condução') || (isTerca && papelEncontrado.funcao.includes('Voz Principal')))
} else {
  setMeuPapelId(null)
  setSouConducao(false)
}
        }
      }

    } catch (err) {
      setErroFatal(err.message)
    } finally {
      setLoading(false)
    }
  }

  const podeGerirMusicas = isLiderOuAdmin || souConducao

  function toggleNovaFuncao(funcaoClicada) {
    if (novasFuncoes.includes(funcaoClicada)) setNovasFuncoes(novasFuncoes.filter(f => f !== funcaoClicada))
    else setNovasFuncoes([...novasFuncoes, funcaoClicada])
  }

  async function salvarCorRoupa(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('schedules').update({ cor_roupa: corEditando }).eq('id', idDaEscala)
    if (!error) {
      setEscala({ ...escala, cor_roupa: corEditando })
      toast.success('Paleta de cores atualizada!')
      setModalRoupaAberto(false)
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    setLoading(false)
  }

  // Verifica se a pessoa já está escalada em OUTRO departamento na mesma data + turno
  async function verificarConflitoEscala(userId) {
    // Busca escalas da mesma data e turno, de OUTROS departamentos
    const { data: outrasEscalas } = await supabase
      .from('schedules')
      .select('id, departamento_id, turno, departamentos(nome), schedule_roles(user_id, funcao)')
      .eq('data', escala.data)
      .neq('departamento_id', escala.departamento_id)

    if (!outrasEscalas) return null

    // Conflito = mesmo turno OU algum dos dois é 'Integral' (dia todo)
    for (const esc of outrasEscalas) {
      const mesmoTurno = esc.turno === escala.turno || esc.turno === 'Integral' || escala.turno === 'Integral'
      if (!mesmoTurno) continue
      const papel = esc.schedule_roles?.find(r => r.user_id === userId)
      if (papel) {
        return { departamento: esc.departamentos?.nome || 'outro departamento', funcao: papel.funcao }
      }
    }
    return null
  }

  async function adicionarPessoaManual(e) {
    e.preventDefault()
    if (!novoMembroId || novasFuncoes.length === 0) return

    const { data: indisponibilidades } = await supabase.from('indisponibilidades').select('turno, motivo').eq('user_id', novoMembroId).eq('data', escala.data).eq('departamento_id', escala.departamento_id)
    if (indisponibilidades && indisponibilidades.length > 0) {
      const ind = indisponibilidades[0]
      const turnoAviso = ind.turno === 'Integral' ? 'o DIA TODO' : `no turno da ${ind.turno}`
      if (!await confirm({ title: '⚠️ Membro indisponível', message: `Este membro marcou indisponibilidade para ${turnoAviso} neste dia. Escalar mesmo assim?`, danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar' })) return
    }

    // ✅ Verifica CONFLITO: já escalado em OUTRO departamento na mesma data + turno
    const conflito = await verificarConflitoEscala(novoMembroId)
    if (conflito) {
      const msg = `Esta pessoa já está escalada em "${conflito.departamento}" neste mesmo dia e turno (${escala.turno})` +
        (conflito.funcao ? ` como ${conflito.funcao}` : '') + '. Deseja escalar mesmo assim?'
      if (!await confirm({ title: '⚠️ Conflito de escala', message: msg, danger: true, labelOk: 'Escalar mesmo assim', labelCancel: 'Cancelar' })) return
    }

    const papelExistente = escala.schedule_roles.find(r => r.user_id === novoMembroId)
    const stringDasNovasFuncoes = novasFuncoes.join(' + ')

    if (papelExistente) {
      const funcoesQueEleJaTem = papelExistente.funcao.split(/[+/]/).map(f => f.trim()).filter(Boolean)
      const funcoesIneditas = novasFuncoes.filter(f => !funcoesQueEleJaTem.includes(f))
      if (funcoesIneditas.length === 0) { toast.warning('Esta pessoa já está escalada para estas funções!'); return }

      const funcaoCombinada = `${papelExistente.funcao} + ${funcoesIneditas.join(' + ')}`
      const { error } = await supabase.from('schedule_roles').update({ funcao: funcaoCombinada }).eq('id', papelExistente.id)
      if (!error) {
        // ✅ Atualiza função no estado imediatamente
        setEscala(prev => ({ ...prev, schedule_roles: prev.schedule_roles.map(r => r.id === papelExistente.id ? { ...r, funcao: funcaoCombinada } : r) }))
        toast.success('Novas funções adicionadas!')
        setNovoMembroId(''); setNovasFuncoes([])
        if (escala.status === 'Publicada') notificar(novoMembroId, "🔄 Sua escala mudou", `${contextoEscala()} — ${funcoesIneditas.length > 1 ? 'novas funções' : 'nova função'}: ${juntarFuncoes(funcoesIneditas)}. Agora você tem ${juntarFuncoes(separarFuncoes(funcaoCombinada))}.`, "escala", `/escala/${idDaEscala}`)
      } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    } else {
      const { data: novoRole, error } = await supabase
        .from('schedule_roles')
        .insert([{ schedule_id: idDaEscala, user_id: novoMembroId, funcao: stringDasNovasFuncoes, status_confirmacao: 'Pendente' }])
        .select('id, funcao, status_confirmacao, user_id, users_profile(nome)')
        .single()
      if (!error && novoRole) {
        // ✅ Adiciona ao estado imediatamente
        setEscala(prev => ({ ...prev, schedule_roles: [...prev.schedule_roles, novoRole] }))
        toast.success('Membro adicionado com sucesso!')
        setNovoMembroId(''); setNovasFuncoes([])
        if (escala.status === 'Publicada') notificar(novoMembroId, "📅 Você entrou na escala", `${contextoEscala()} — ${rotuloFuncoes(novasFuncoes)}.`, "escala", `/escala/${idDaEscala}`)
      } else { console.error('Erro ao adicionar:', error); toast.error('Não foi possível adicionar. Tente novamente.') }
    }
  }

  async function removerPessoa(roleId, nomePessoa, userId) {
    if (!await confirm({ title: `Remover ${nomePessoa}?`, message: 'Esta pessoa será removida desta escala.', danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    const { error } = await supabase.from('schedule_roles').delete().eq('id', roleId)
    if (!error) {
      // ✅ Atualiza o estado imediatamente sem esperar o servidor
      setEscala(prev => ({ ...prev, schedule_roles: prev.schedule_roles.filter(r => r.id !== roleId) }))
      toast.success(`${nomePessoa} removido(a).`)
      if (escala.status === 'Publicada') notificar(userId, "❌ Você saiu da escala", `O líder removeu você da escala de ${contextoEscala()}.`, "escala", `/escala/${idDaEscala}`)
    } else toast.error('Erro ao remover.')
  }

  // ── Confirmação de presença (membro responde o próprio papel) ──
  async function responderPresenca(papel, status) {
    setRespondendoId(papel.id)
    const { ok } = await responderEscala(papel.id, status)
    setRespondendoId(null)
    if (!ok) { toast.error('Não foi possível registrar sua resposta. Tente novamente.'); return }
    setEscala(prev => ({ ...prev, schedule_roles: prev.schedule_roles.map(r => r.id === papel.id ? { ...r, status_confirmacao: status } : r) }))
    if (status === CONFIRMADO) { toast.success('Presença confirmada!'); return }
    toast.success('Resposta enviada. O líder foi avisado.')
    const jaPediuTroca = pedidosTroca.some(p => p.role_id === papel.id)
    if (!jaPediuTroca && await confirm({ title: 'Quer pedir uma troca?', message: 'Indique alguém para assumir sua função e ajude o líder a não deixar a vaga em aberto.', labelOk: 'Pedir troca', labelCancel: 'Agora não' })) {
      abrirModalSubstituicao(papel)
    }
  }

  function abrirModalSubstituicao(papel) {
    setPapelParaTrocar(papel); setSubstitutoId(''); setMotivoTroca('') 
    setFuncoesSelecionadasTroca(papel.funcao.split(/[+/]/).map(f => f.trim()).filter(Boolean))
    setModalTrocaAberto(true)
  }

  function toggleFuncaoTroca(funcao) {
    if (funcoesSelecionadasTroca.includes(funcao)) setFuncoesSelecionadasTroca(funcoesSelecionadasTroca.filter(f => f !== funcao))
    else setFuncoesSelecionadasTroca([...funcoesSelecionadasTroca, funcao])
  }

  async function enviarPedidoTroca(e) {
    e.preventDefault()
    if (!substitutoId || funcoesSelecionadasTroca.length === 0) return toast.warning('Selecione um substituto e as funções.')
    if (!motivoTroca.trim()) return toast.warning('Por favor, informe o motivo da troca para o seu líder.')
    
    setLoading(true)
    const eu = membrosEquipa.find(m => m.id === meuId)
    const ele = membrosEquipa.find(m => m.id === substitutoId)
    const funcoesAlvoStr = funcoesSelecionadasTroca.join(' + ')

    const { error } = await supabase.from('swap_requests').insert([{
      schedule_id: idDaEscala, role_id: papelParaTrocar.id, requester_id: meuId, requester_nome: eu.nome, substitute_id: substitutoId, substitute_nome: ele.nome, funcoes_alvo: funcoesAlvoStr, motivo: motivoTroca 
    }])

    if (!error) {
      const { data: lideres } = await supabase.from('membros_departamentos').select('user_id').eq('departamento_id', escala.departamento_id).in('role', ['líder', 'admin'])
      if (lideres) lideres.forEach(async (lider) => { if (lider.user_id !== meuId) await notificar(lider.user_id, "🔁 Pedido de troca", `${contextoEscala()} — ${primeiroNome(eu.nome)} quer passar ${juntarFuncoes(funcoesSelecionadasTroca)} para ${primeiroNome(ele.nome)}.`, "aviso", `/trocas/${escala.departamento_id}`) })
      setModalTrocaAberto(false)
      toast.success('Pedido de troca enviado!')
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
    setLoading(false)
  }

  async function avaliarTroca(pedido, aprovado) {
    if (!await confirm({ title: `${aprovado ? 'Aprovar' : 'Rejeitar'} troca?`, message: `${pedido.requester_nome} → ${pedido.substitute_nome}`, danger: !aprovado, labelOk: aprovado ? 'Aprovar' : 'Rejeitar', labelCancel: 'Cancelar' })) return
    // Aprovação/rejeição atômica no banco (uma única transação)
    const { data: funcoesDaRpc, error: erroTroca } = await supabase.rpc('responder_troca', { p_pedido_id: pedido.id, p_aprovar: aprovado })
    if (erroTroca) { console.error('Erro ao processar troca:', erroTroca); return toast.error(erroTroca.code === 'P0001' ? erroTroca.message : 'Não foi possível processar a troca. Tente novamente.') }
    // Mesmos textos de SwapRequests.jsx (avaliarTroca)
    const funcoesDaTroca = juntarFuncoes(separarFuncoes(
      (typeof funcoesDaRpc === 'string' && funcoesDaRpc) || pedido.funcoes_alvo || escala.schedule_roles.find(r => r.id === pedido.role_id)?.funcao
    )) || 'a função'
    const ctxTroca = contextoEscala()
    if (aprovado) {
      if (escala.status === 'Publicada') {
        // ✅ Sem await — notificações não bloqueiam a UI
        notificar(pedido.requester_id, "✅ Troca aprovada", `${ctxTroca} — ${primeiroNome(pedido.substitute_nome)} assume ${funcoesDaTroca} no seu lugar.`, "escala", `/escala/${idDaEscala}`)
        notificar(pedido.substitute_id, "📅 Você entrou na escala", `${ctxTroca} — você assume ${funcoesDaTroca} no lugar de ${primeiroNome(pedido.requester_nome)}.`, "escala", `/escala/${idDaEscala}`)
      }
    } else {
      if (escala.status === 'Publicada') notificar(pedido.requester_id, "❌ Troca rejeitada", `${ctxTroca} — o líder não aprovou passar ${funcoesDaTroca} para ${primeiroNome(pedido.substitute_nome)}.`, "escala", `/escala/${idDaEscala}`)
    }
    // ✅ Remove troca da lista + atualiza roles no estado
    setPedidosTroca(prev => prev.filter(t => t.id !== pedido.id))
    if (aprovado) {
      const papelOrig = escala.schedule_roles.find(r => r.id === pedido.role_id)
      const papelSub  = escala.schedule_roles.find(r => r.user_id === pedido.substitute_id)
      const funcTrocadas = (pedido.funcoes_alvo || papelOrig?.funcao || '').split(/[+/]/).map(f => f.trim()).filter(Boolean)
      const funcsRestantes = (papelOrig?.funcao || '').split(/[+/]/).map(f => f.trim()).filter(Boolean).filter(f => !funcTrocadas.includes(f))
      setEscala(prev => {
        let roles = [...prev.schedule_roles]
        if (funcsRestantes.length === 0) {
          if (papelSub) {
            const nova = Array.from(new Set([...papelSub.funcao.split(/[+/]/).map(f=>f.trim()).filter(Boolean), ...funcTrocadas])).join(' + ')
            roles = roles.map(r => r.id === papelSub.id ? { ...r, funcao: nova } : r).filter(r => r.id !== papelOrig.id)
          } else {
            const subNome = pedido.substitute_nome
            roles = roles.map(r => r.id === pedido.role_id ? { ...r, user_id: pedido.substitute_id, status_confirmacao: 'Confirmado', users_profile: { nome: subNome } } : r)
          }
        } else {
          roles = roles.map(r => {
            if (r.id === pedido.role_id) return { ...r, funcao: funcsRestantes.join(' + ') }
            if (papelSub && r.id === papelSub.id) {
              const nova = Array.from(new Set([...r.funcao.split(/[+/]/).map(f=>f.trim()).filter(Boolean), ...funcTrocadas])).join(' + ')
              return { ...r, funcao: nova }
            }
            return r
          })
          if (!papelSub) roles = [...roles, { id: Date.now(), schedule_id: idDaEscala, user_id: pedido.substitute_id, funcao: funcTrocadas.join(' + '), status_confirmacao: 'Confirmado', users_profile: { nome: pedido.substitute_nome } }]
        }
        return { ...prev, schedule_roles: roles }
      })
    }
    toast.success(`Troca ${aprovado ? 'aprovada' : 'rejeitada'} com sucesso!`)
  }

  // ✅ WORKFLOW DE APROVAÇÃO DO REPERTÓRIO: CONDUTOR PEDE APROVAÇÃO
  async function pedirAprovacaoRepertorio() {
    if (musicasEscala.length === 0) return toast.warning('Adicione pelo menos uma música antes de enviar.');
    if (!await confirm({ title: "Enviar repertório?", message: "O repertório atual será enviado para análise da liderança.", labelOk: "Enviar" })) return;

    const { error } = await supabase.from('schedules').update({ status_repertorio: 'pendente' }).eq('id', idDaEscala)
    if (!error) {
      const { data: lideres } = await supabase.from('membros_departamentos').select('user_id').eq('departamento_id', escala.departamento_id).in('role', ['líder', 'admin'])
      const condutor = escala.schedule_roles.find(r => (r.funcao || '').includes('Condução'))
      const nomeCondutor = primeiroNome(condutor?.users_profile?.nome || membrosEquipa.find(m => m.id === meuId)?.nome) || 'O condutor'
      if (lideres) lideres.forEach(async (lider) => { if (lider.user_id !== meuId) await notificar(lider.user_id, "🎵 Repertório para aprovar", `${contextoEscala()} — ${nomeCondutor} enviou o repertório para sua análise.`, "aviso", `/escala/${idDaEscala}`) })
      setEscala(prev => ({ ...prev, status_repertorio: 'pendente' }))
      toast.success("Repertório enviado para aprovação!")
    } else (() => { console.error('Erro ao enviar aprovação:', error); toast.error('Erro ao enviar aprovação. Tente novamente.') })()
  }

  // ✅ WORKFLOW DE APROVAÇÃO DO REPERTÓRIO: LÍDER APROVA OU REJEITA
  async function avaliarRepertorio(aprovado) {
    if (!await confirm({ title: `${aprovado ? 'Aprovar' : 'Rejeitar'} repertório?`, danger: !aprovado, labelOk: aprovado ? 'Aprovar' : 'Rejeitar', labelCancel: 'Cancelar' })) return;
    const novoStatus = aprovado ? 'aprovado' : 'rejeitado'
    const { error } = await supabase.from('schedules').update({ status_repertorio: novoStatus }).eq('id', idDaEscala)
    if (!error) {
      escala.schedule_roles.forEach(async (r) => {
        if (r.funcao.includes('Condução') || r.funcao.includes('Voz Principal')) {
          await notificar(r.user_id, aprovado ? "✅ Repertório aprovado" : "❌ Repertório devolvido", aprovado ? `${contextoEscala()} — o líder aprovou as músicas. Já pode enviar para a equipe.` : `${contextoEscala()} — o líder pediu ajustes no repertório.`, "louvor", `/escala/${idDaEscala}`)
        }
      })
      setEscala(prev => ({ ...prev, status_repertorio: novoStatus }))
      toast[aprovado ? "success" : "warning"](aprovado ? "Repertório aprovado!" : "Repertório devolvido para ajustes.")
    } else (() => { console.error('Erro ao processar avaliação:', error); toast.error('Erro ao processar avaliação. Tente novamente.') })()
  }

  async function adicionarMusicaAEscala(songId, tomOriginal) {
    if (musicasEscala.some(m => m.songs?.id === songId)) return toast.warning('Esta música já está na escala!')
    const { data: novaRelacao, error } = await supabase
      .from('schedule_songs')
      .insert([{ schedule_id: idDaEscala, song_id: songId, ordem: musicasEscala.length + 1, tom: tomOriginal }])
      .select('id, song_id, ordem, tom, songs(id, titulo, artista, tom, link_youtube, link_cifra, categoria)')
      .single()
    if (!error && novaRelacao) {
      setMusicasEscala(prev => [...prev, novaRelacao])
      setModalMusicaAberto(false)
      toast.success('Música adicionada!')
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
  }

  async function removerMusicaDaEscala(idRelacao) {
    if (!await confirm({ title: 'Remover música?', message: 'A música será removida deste culto.', danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    const { error } = await supabase.from('schedule_songs').delete().eq('id', idRelacao)
    if (!error) setMusicasEscala(prev => prev.filter(m => m.id !== idRelacao))
  }

  async function alterarOrdemMusica(index, direcao) {
    const novaLista = [...musicasEscala]
    if (direcao === 'up' && index > 0) {
      const temp = novaLista[index]; novaLista[index] = novaLista[index - 1]; novaLista[index - 1] = temp
    } else if (direcao === 'down' && index < novaLista.length - 1) {
      const temp = novaLista[index]; novaLista[index] = novaLista[index + 1]; novaLista[index + 1] = temp
    } else return
    setMusicasEscala(novaLista)
    await Promise.all(novaLista.map((item, idx) => supabase.from('schedule_songs').update({ ordem: idx + 1 }).eq('id', item.id)))
  }

  function abrirModalTom(idRelacao) { setIdRelacaoTomEditando(idRelacao); setModalTomAberto(true) }

  async function salvarNovoTom(novoTom) {
    const { error } = await supabase.from('schedule_songs').update({ tom: novoTom }).eq('id', idRelacaoTomEditando)
    if (!error) {
      setMusicasEscala(prev => prev.map(m => m.id === idRelacaoTomEditando ? { ...m, tom: novoTom } : m))
      setModalTomAberto(false)
    } else (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
  }

  function avisarEquipaWhatsApp() {
    if (musicasEscala.length === 0) return toast.warning('Adicione pelo menos uma música!'); 
    if (escala.status_repertorio !== 'aprovado') return toast.warning('Só envie para a equipe após aprovação dos líderes.');

    let texto = `🎵 *Repertório Aprovado!* 🎵\n*Data:* ${formatarDataLonga(escala.data)}\n*Culto:* ${escala.turno}\n\n`
    musicasEscala.forEach((m, index) => {
      const artista = m.songs.artista ? ` - ${m.songs.artista}` : "";
      texto += `${index + 1}️⃣ *${m.songs.titulo}*${artista}\n🎹 Tom: ${m.tom || m.songs.tom || 'Não definido'}\n`
      if (m.songs.link_youtube) texto += `▶️ Ouvir: ${m.songs.link_youtube}\n`
      if (m.songs.link_cifra) texto += `📄 Cifra: ${m.songs.link_cifra}\n\n`
    })
    texto += `Acessem o portal da igreja para confirmar presença! 🙌`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function publicarEscala() {
    if (!await confirm({ title: 'Publicar escala?', message: 'A escala ficará visível para toda a equipe.', labelOk: 'Publicar', labelCancel: 'Cancelar' })) return
    const { error } = await supabase.from('schedules').update({ status: 'Publicada' }).eq('id', idDaEscala)
    if (!error) { 
      // Notifica todos os escalados de uma vez (1 insert em vez de N)
      // Quem publicou não recebe o próprio aviso
      const idsEscalados = [...new Set((escala.schedule_roles || []).map(m => m.user_id).filter(id => id && id !== meuId))]
      await enviarNotificacaoEmMassa({
        userIds: idsEscalados,
        departamentoId: escala.departamento_id,
        titulo: "📅 Escala publicada",
        mensagem: `Você está na escala de ${contextoEscala()}. Abra para ver sua função e confirmar presença.`,
        tipo: "escala",
        link: `/escala/${idDaEscala}`,
      })
      setEscala(prev => ({ ...prev, status: 'Publicada' }))
      toast.success('Escala publicada com sucesso!') 
    }
  }

  async function apagarEscalaCompleta() {
    if (!await confirm({ title: 'Apagar escala?', message: 'Esta ação é irreversível — a escala inteira será apagada.', danger: true, labelOk: 'Apagar', labelCancel: 'Cancelar' })) return
    setLoading(true)
    await supabase.from('schedule_roles').delete().eq('schedule_id', idDaEscala)
    await supabase.from('schedule_songs').delete().eq('schedule_id', idDaEscala)
    const { error } = await supabase.from('schedules').delete().eq('id', idDaEscala)
    if (!error) navigate(-1); else { (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })(); setLoading(false); }
  }

  function formatarDataLonga(dataString) {
    if (!dataString) return ''
    return new Date(dataString + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }
  
  function formatarDataComDia(dataString) {
    if (!dataString) return ''
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const data = new Date(dataString + 'T12:00:00');
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')} (${dias[data.getDay()]})`;
  }

  const repertorioFiltrado = repertorio.filter(mus => {
    const matchBusca = mus.titulo.toLowerCase().includes(buscaMusica.toLowerCase()) || (mus.artista && mus.artista.toLowerCase().includes(buscaMusica.toLowerCase()));
    const matchCategoria = filtroCategoria === 'Todas' || (mus.categoria && mus.categoria.toLowerCase() === filtroCategoria.toLowerCase());
    return matchBusca && matchCategoria;
  });

  if (loading && !escala) return <ScheduleDetailsSkeleton corHeader="bg-topo" />
  if (erroFatal) return (
    <div className="max-w-md mx-auto p-10 mt-20 text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-danger mx-auto" />
      <h2 className="text-xl font-bold text-ink">Oops! Erro de Conexão</h2>
      <p className="text-sm text-danger bg-danger-soft p-4 rounded-xl font-mono break-words">{erroFatal}</p>
      <button onClick={() => navigate(-1)} className="bg-line text-ink-2 px-6 py-2 rounded-xl font-bold">Voltar</button>
    </div>
  )
  if (!escala) return <div className="text-center p-10 mt-20 text-ink-2 font-bold">Escala não encontrada.</div>

  const isRascunho = escala.status === 'Rascunho'

  async function salvarChecklistEscala() {
    if (!escala?.id) return
    setSalvandoChecklist(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: perfil } = await supabase.from('users_profile').select('nome').eq('id', user.id).single()
      const { data: novo, error } = await supabase
        .from('media_checklists')
        .insert([{
          schedule_id:      escala.id,
          departamento_id:  escala.departamento_id,
          data:             escala.data,
          turno:            escala.turno,
          nome_responsavel: perfil?.nome || '',
          equipamentos_ok:  checklistForm.equipamentos_ok,
          computadores_ok:  checklistForm.computadores_ok,
          tvs_ok:           checklistForm.tvs_ok,
          ar_ok:            checklistForm.ar_ok,
          bancada_ok:       checklistForm.bancada_ok,
          relato_problema:  checklistForm.relato_problema.trim(),
          image_url:        null,
        }])
        .select().single()
      if (error) throw error
      setChecklistEscala(novo)
      toast.success('Checklist registrado! Todos os escalados estão cientes.')
    } catch (err) {
      (() => { console.error('Erro ao registar checklist:', err); toast.error('Erro ao registar checklist. Tente novamente.') })()
    }
    setSalvandoChecklist(false)
  }


  // ── Upload de arquivo(s) do mapa vocal — aceita vários de uma vez ──────────
  async function uploadMapaVocal(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    // Bucket é público: só aceita documentos/imagens e com tamanho limitado
    // (bloqueia .html/.svg/.js que poderiam ser servidos como página).
    const invalido = files.find(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      return !EXTENSOES_MAPA.includes(ext) || f.size > TAMANHO_MAX_MAPA
    })
    if (invalido) {
      toast.error(`"${invalido.name}" não é permitido. Envie PDF, Word ou imagem (até 15 MB).`)
      e.target.value = ''
      return
    }
    setUploadingMapa(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const novos = []
      for (const file of files) {
        const ext  = file.name.split('.').pop().toLowerCase()
        const path = `mapas/${idDaEscala}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error: upErr } = await supabase.storage.from('mapas-vocais').upload(path, file, { contentType: MIME_MAPA[ext] })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('mapas-vocais').getPublicUrl(path)
        const { data: inserted, error: insErr } = await supabase
          .from('mapas_vocais')
          .insert([{ schedule_id: idDaEscala, url: publicUrl, nome_arquivo: file.name, enviado_por: user?.id }])
          .select('id, url, nome_arquivo')
          .single()
        if (insErr) throw insErr
        novos.push(inserted)
      }
      setMapasVocais(prev => [...prev, ...novos])
      toast.success(novos.length > 1 ? `${novos.length} arquivos enviados!` : 'Mapa vocal enviado!')
    } catch (err) { (() => { console.error('Erro ao enviar:', err); toast.error('Não foi possível enviar. Tente novamente.') })() }
    setUploadingMapa(false)
    e.target.value = ''  // permite reenviar o mesmo arquivo depois, se precisar
  }

  // ── Remove um mapa vocal específico da lista ────────────────────────────────
  async function removerMapaVocal(mapa) {
    if (!await confirm({ title: 'Remover arquivo?', message: `Remover "${mapa.nome_arquivo || 'arquivo'}" desta escala?`, danger: true, labelOk: 'Remover', labelCancel: 'Cancelar' })) return
    const { error } = mapa.id === '__legado__'
      ? await supabase.from('schedules').update({ mapa_vocal_url: null }).eq('id', idDaEscala)
      : await supabase.from('mapas_vocais').delete().eq('id', mapa.id)
    if (error) { console.error('Erro ao remover mapa vocal:', error); toast.error('Não foi possível remover. Tente novamente.'); return }
    setMapasVocais(prev => prev.filter(m => m.id !== mapa.id))
    toast.success('Arquivo removido.')
  }


  // ── Salvar observações ────────────────────────────────────────────────────
  async function salvarObservacao(campo, valor) {
    setSalvandoObs(true)
    const { error } = await supabase
      .from('schedules').update({ [campo]: valor }).eq('id', idDaEscala)
    if (!error) toast.success('Observação salva!')
    else toast.error('Erro ao salvar.')
    setSalvandoObs(false)
  }


  return (
    <div className="min-h-screen bg-bg pb-6">
      
      <header className="bg-topo text-white px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-5 mb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => navigate(-1)} aria-label="Voltar"
              className="p-2 -ml-2 rounded-full hover:bg-white/15 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            {isRascunho && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-warning-soft text-warning">Rascunho</span>}
          </div>
          <p className="text-[11px] font-semibold text-white/75 uppercase tracking-wide mt-2">
            {departamentoNome} · {rotuloTurno(escala.turno)}
          </p>
          <h1 className="text-xl font-bold first-letter:uppercase">{formatarDataLonga(escala.data)}</h1>
          {escala.titulo && <p className="text-sm font-semibold mt-1 flex items-center gap-1.5 text-white/90"><Tag className="w-3.5 h-3.5" aria-hidden="true" /> {escala.titulo}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {escala.horario_ensaio && <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full text-xs font-medium"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Ensaio: {escala.horario_ensaio}</span>}
            {departamentoNome === 'Louvor' && (escala.cor_roupa || isLiderOuAdmin) && (
              isLiderOuAdmin ? (
                <button type="button" onClick={() => { setCorEditando(escala.cor_roupa || ''); setModalRoupaAberto(true) }}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <Palette className="w-3.5 h-3.5" aria-hidden="true" /> Roupa: {escala.cor_roupa || 'definir paleta'} <Edit2 className="w-3 h-3 opacity-70" aria-hidden="true" />
                </button>
              ) : (
                <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full text-xs font-medium"><Palette className="w-3.5 h-3.5" aria-hidden="true" /> Roupa: {escala.cor_roupa}</span>
              )
            )}
            {meuPapel && !isRascunho && <AdicionarAgenda escala={escala} departamento={departamentoNome} funcoes={meuPapel.funcao} />}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 space-y-6">

        {/* ✅ PAINEL DO WORKFLOW DE APROVAÇÃO DE REPERTÓRIO */}
        {departamentoNome === 'Louvor' && (
          <div className={`p-5 rounded-2xl border flex flex-col gap-3 shadow-sm ${
            escala.status_repertorio === 'aprovado' ? 'bg-success-soft border-success text-success' :
            escala.status_repertorio === 'pendente' ? 'bg-warning-soft border-warning/40 text-warning' :
            escala.status_repertorio === 'rejeitado' ? 'bg-danger-soft border-danger text-danger' : 'bg-surface border-line text-ink-2'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {escala.status_repertorio === 'aprovado' ? <CheckCircle2 className="w-6 h-6 text-success" /> : 
                 escala.status_repertorio === 'rejeitado' ? <XCircle className="w-6 h-6 text-danger" /> : 
                 escala.status_repertorio === 'pendente' ? <Clock className="w-6 h-6 text-warning" /> : 
                 <ListChecks className="w-6 h-6 text-brand" />}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Aprovação do Repertório</p>
                  <p className="text-sm font-bold">
                    {escala.status_repertorio === 'aprovado' ? 'Repertório Aprovado' :
                     escala.status_repertorio === 'pendente' ? 'Aguardando Liderança' :
                     escala.status_repertorio === 'rejeitado' ? 'Devolvido para Ajustes' : 'Em Rascunho (Condutor)'}
                  </p>
                </div>
              </div>
            </div>

            {souConducao && (escala.status_repertorio === 'rascunho' || escala.status_repertorio === 'rejeitado') && (
              <button onClick={pedirAprovacaoRepertorio} disabled={musicasEscala.length === 0} className="w-full bg-brand hover:opacity-90 disabled:opacity-50 text-on-brand py-2.5 rounded-xl text-xs font-bold transition active:scale-[0.97] shadow-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Enviar para Aprovação do Líder
              </button>
            )}

            {isLiderOuAdmin && escala.status_repertorio === 'pendente' && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => avaliarRepertorio(true)} className="flex-1 bg-success hover:bg-success text-on-success font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs transition"><Check className="w-4 h-4" /> Aprovar</button>
                <button onClick={() => avaliarRepertorio(false)} className="flex-1 bg-surface border border-danger text-danger hover:bg-danger-soft font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs transition"><X className="w-4 h-4" /> Rejeitar</button>
              </div>
            )}
          </div>
        )}

        {/* ── MAPA VOCAL (Louvor) ── */}
        {departamentoNome === 'Louvor' && (
          <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="p-4 border-b border-line bg-brand/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand flex items-center gap-2">
                <Mic2 className="w-4 h-4" /> Mapa Vocal do Culto
              </h3>
              <button
                onClick={() => {
                  const fileUrl = `${window.location.origin}/template-mapa-vocal.docx`
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                  if (isIOS) {
                    // iOS não consegue abrir .docx direto — abre no Google Docs
                    window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}`, '_blank')
                  } else {
                    // Desktop/Android — download direto
                    const a = document.createElement('a')
                    a.href = fileUrl
                    a.download = 'template-mapa-vocal.docx'
                    a.click()
                  }
                }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-brand bg-surface border border-brand/30 px-3 py-1.5 rounded-lg hover:bg-brand/10 transition">
                <Download className="w-3.5 h-3.5" /> Template
              </button>
            </div>

            <div className="p-4">
              <div className="space-y-3">
                {mapasVocais.length > 0 && (
                  <div className="space-y-2">
                    {mapasVocais.map(mapa => (
                      <div key={mapa.id} className="bg-success-soft border border-success rounded-xl p-3 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-success truncate">{mapa.nome_arquivo || 'Mapa vocal'}</p>
                        </div>
                        <a href={urlSegura(mapa.url)} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-lg hover:bg-brand/10 flex items-center gap-1 flex-shrink-0">
                          <Download className="w-3 h-3" /> Baixar
                        </a>
                        {(souConducao || isLiderOuAdmin) && (
                          <button onClick={() => removerMapaVocal(mapa)} className="p-1.5 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition flex-shrink-0" title="Remover arquivo" aria-label="Remover arquivo">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(souConducao || isLiderOuAdmin) ? (
                  <>
                    <label htmlFor="mapa-upload" className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition ${uploadingMapa ? 'border-brand/30 bg-brand/10' : 'border-line hover:border-brand/30 hover:bg-brand/10'}`}>
                      {uploadingMapa ? (
                        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted" />
                          <p className="text-sm font-medium text-ink-2">{mapasVocais.length > 0 ? 'Enviar mais arquivos' : 'Enviar mapa vocal preenchido'}</p>
                          <p className="text-xs text-muted">PDF, Word ou imagem — pode selecionar vários</p>
                        </>
                      )}
                    </label>
                    <input id="mapa-upload" type="file" multiple className="hidden" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={uploadMapaVocal} disabled={uploadingMapa} />
                  </>
                ) : mapasVocais.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6 font-medium">Mapa vocal ainda não enviado.</p>
                ) : null}
              </div>
            </div>

            {/* ── Dica de app ── */}
            <div className="px-4 pb-4">
              <p className="text-xs text-muted italic">
                💡 No iPhone o template abre no Google Docs automaticamente — preenche lá e envia o arquivo preenchido aqui.
              </p>
            </div>
          </div>
        )}

        {/* ── OBSERVAÇÕES (Louvor) ── */}
        {departamentoNome === 'Louvor' && (
          <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="p-4 border-b border-line bg-surface-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-ink-2" />
              <h3 className="text-sm font-bold text-ink-2">Observações</h3>
            </div>
            <div className="divide-y divide-line">

              {/* Observação do Condutor */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <PenLine className="w-3.5 h-3.5 text-brand" />
                  <p className="text-xs font-bold text-ink-2 uppercase tracking-wider">Do Condutor — para os líderes</p>
                </div>
                {souConducao && (escala.status_repertorio === 'rascunho' || escala.status_repertorio === 'rejeitado') ? (
                  <div className="space-y-2">
                    <textarea rows={3} placeholder="Escreva aqui observações, pedidos ou contexto sobre o repertório..."
                      value={obsCondutor} onChange={e => setObsCondutor(e.target.value)}
                      className="w-full border border-line rounded-xl p-3 text-xs text-ink-2 outline-none focus:ring-2 focus:ring-brand resize-none bg-surface-2" />
                    <button onClick={() => salvarObservacao('obs_condutor', obsCondutor)} disabled={salvandoObs}
                      className="text-xs font-bold bg-brand text-on-brand px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50">
                      Salvar
                    </button>
                  </div>
                ) : obsCondutor ? (
                  <p className="text-xs text-ink-2 bg-brand/10 border border-brand/30 p-3 rounded-xl leading-relaxed italic">"{obsCondutor}"</p>
                ) : (
                  <p className="text-xs text-muted italic">Nenhuma observação do condutor.</p>
                )}
              </div>

              {/* Observação dos Líderes */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                  <p className="text-xs font-bold text-ink-2 uppercase tracking-wider">Dos Líderes — para o condutor</p>
                </div>
                {isLiderOuAdmin && escala.status_repertorio === 'pendente' ? (
                  <div className="space-y-2">
                    <textarea rows={3} placeholder="Escreva aqui o motivo da rejeição ou instruções para o condutor..."
                      value={obsLideres} onChange={e => setObsLideres(e.target.value)}
                      className="w-full border border-line rounded-xl p-3 text-xs text-ink-2 outline-none focus:ring-2 focus:ring-brand resize-none bg-surface-2" />
                    <button onClick={() => salvarObservacao('obs_lideres', obsLideres)} disabled={salvandoObs}
                      className="text-xs font-bold bg-warning-soft text-warning px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50">
                      Salvar
                    </button>
                  </div>
                ) : obsLideres ? (
                  <p className="text-xs text-ink-2 bg-warning-soft border border-warning/40 p-3 rounded-xl leading-relaxed italic">"{obsLideres}"</p>
                ) : (
                  <p className="text-xs text-muted italic">Nenhuma observação dos líderes.</p>
                )}
              </div>

            </div>
          </div>
        )}

        {/* MÚSICAS DO CULTO */}
        {departamentoNome === 'Louvor' && (
          <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="p-5 border-b border-line flex justify-between items-center bg-surface-2">
              <h2 className="text-sm font-bold text-ink uppercase flex items-center gap-2"><Music className="w-5 h-5 text-brand" /> Repertório</h2>
              <div className="flex gap-2">
                {(isLiderOuAdmin || souConducao) && musicasEscala.length > 0 && (
                  <button onClick={avisarEquipaWhatsApp} className={`px-3 py-1.5 rounded-lg transition active:scale-[0.97] flex items-center gap-1.5 text-xs font-bold shadow-sm ${escala.status_repertorio === 'aprovado' ? 'bg-success-soft text-success border border-success hover:bg-success-soft cursor-pointer' : 'bg-surface-2 text-muted border border-line cursor-not-allowed opacity-60'}`}>
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                )}
                {(isLiderOuAdmin || souConducao) && <button onClick={() => setModalMusicaAberto(true)} aria-label="Adicionar música" className="bg-brand text-on-brand p-1.5 rounded-lg hover:opacity-90 transition shadow-sm"><Plus className="w-5 h-5" /></button>}
              </div>
            </div>
            <div className="p-2">
              {/* Membros comuns da escala só veem o repertório após aprovação da liderança.
                  Condutor e líderes/admins sempre veem, pois estão trabalhando nele. */}
              {!(isLiderOuAdmin || souConducao) && escala.status_repertorio !== 'aprovado' ? (
                <div className="p-5 text-center">
                  <Clock className="w-8 h-8 text-line mx-auto mb-2" />
                  <p className="text-sm text-muted font-medium">Repertório em preparação</p>
                  <p className="text-xs text-muted mt-1">Assim que a liderança aprovar, as músicas aparecem aqui.</p>
                </div>
              ) : musicasEscala.length === 0 ? <p className="text-sm text-muted text-center py-6 font-medium">Nenhuma música definida.</p> : (
                <div className="divide-y divide-line">
                  {musicasEscala.map((relacao, index) => {
                    const mus = relacao.songs; if (!mus) return null; const tomExibido = relacao.tom || mus.tom || '?';
                    return (
                      <div key={relacao.id} className="p-3 flex items-center justify-between hover:bg-surface-2 rounded-xl transition">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center shrink-0 w-8">
                            {podeGerirMusicas && index > 0 && <button onClick={() => alterarOrdemMusica(index, 'up')} className="text-muted hover:text-brand transition p-1"><ChevronUp className="w-4 h-4" /></button>}
                            <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center text-[10px] font-bold">{index + 1}</div>
                            {podeGerirMusicas && index < musicasEscala.length - 1 && <button onClick={() => alterarOrdemMusica(index, 'down')} className="text-muted hover:text-brand transition p-1"><ChevronDown className="w-4 h-4" /></button>}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-ink text-sm">{mus.titulo}</p>
                              {mus.categoria && <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${mus.categoria.toLowerCase() === 'celebração' ? 'bg-warning-soft text-warning' : mus.categoria.toLowerCase() === 'adoração' ? 'bg-brand/10 text-brand' : 'bg-surface-2 text-ink-2'}`}>{mus.categoria}</span>}
                            </div>
                            <div className="flex gap-2 mt-1 items-center">
                              {podeGerirMusicas ? (
                                <button type="button" onClick={() => abrirModalTom(relacao.id)} aria-label={`Mudar tom (atual: ${tomExibido})`}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 transition bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                                  Tom: {tomExibido} <Edit2 className="w-2.5 h-2.5 opacity-60" aria-hidden="true" />
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-surface-2 text-ink-2">Tom: {tomExibido}</span>
                              )}
                              {mus.artista && <span className="text-[10px] text-ink-2">{mus.artista}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {mus.link_cifra && <a href={urlSegura(mus.link_cifra)} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand bg-brand/10 p-1.5 rounded-md"><FileText className="w-4 h-4" /></a>}
                          {mus.link_youtube && <a href={urlSegura(mus.link_youtube)} target="_blank" rel="noopener noreferrer" className="text-danger hover:text-danger bg-danger-soft p-1.5 rounded-md"><PlayCircle className="w-4 h-4" /></a>}
                          {podeGerirMusicas && <button onClick={() => removerMusicaDaEscala(relacao.id)} aria-label={`Remover ${relacao.songs?.titulo || 'música'}`} className="text-muted hover:text-danger p-1.5"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REPERTÓRIO DO LOUVOR (visível para Mídia) ── */}
        {(departamentoNome === 'Mídia' || departamentoNome === 'Midia') && (
          <div className="bg-surface rounded-2xl shadow-sm border border-brand/30 overflow-hidden">
            <div className="p-4 border-b border-brand/30 bg-brand/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand flex items-center gap-2">
                🎵 Repertório do Louvor
              </h3>
              {statusRepLouvor && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  statusRepLouvor === 'aprovado' ? 'bg-success-soft text-success' :
                  statusRepLouvor === 'pendente' ? 'bg-warning-soft text-warning' :
                  'bg-surface-2 text-ink-2'
                }`}>
                  {statusRepLouvor === 'aprovado' ? '✓ Aprovado' : statusRepLouvor === 'pendente' ? '⏳ Aguardando' : 'Rascunho'}
                </span>
              )}
            </div>
            {statusRepLouvor !== 'aprovado' ? (
              <div className="p-5 text-center">
                <p className="text-sm text-muted font-medium">Repertório em preparação</p>
                <p className="text-xs text-muted mt-1">Assim que a liderança do Louvor aprovar, as músicas aparecem aqui.</p>
              </div>
            ) : repertorioLouvor.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-sm text-muted font-medium">Repertório ainda não definido.</p>
                <p className="text-xs text-muted mt-1">O Louvor ainda não adicionou músicas para este dia.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {repertorioLouvor.map((item, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{item.songs?.titulo}</p>
                      {item.songs?.artista && <p className="text-xs text-muted truncate">{item.songs.artista}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHECKLIST DA CABINE (Mídia) ── */}
        {(departamentoNome === 'Mídia' || departamentoNome === 'Midia') && (
          <div className="bg-surface rounded-2xl shadow-sm border border-brand/30 overflow-hidden">
            <div className="p-4 border-b border-brand/30 bg-brand/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand flex items-center gap-2">
                <ListChecks className="w-4 h-4" /> Checklist da Cabine
              </h3>
              {checklistEscala ? (
                <span className="text-[10px] font-bold bg-success-soft text-success px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Preenchido
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-warning-soft text-warning px-2.5 py-1 rounded-full">Pendente</span>
              )}
            </div>

            {checklistEscala ? (
              /* ── Checklist já preenchido — leitura ── */
              <div className="p-4 space-y-3">
                <div className="flex gap-4 text-xs text-ink-2">
                  <span>Operador: <strong className="text-ink">{checklistEscala.nome_responsavel}</strong></span>
                  <span>{new Date(checklistEscala.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ITENS_CHECKLIST.map(item => (
                    <div key={item.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${checklistEscala[item.key] ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                      <span className="w-4 text-center">{checklistEscala[item.key] ? '✓' : '✗'}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
                {checklistEscala.relato_problema && (
                  <div className="bg-warning-soft border border-warning/40 p-3 rounded-xl">
                    <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">Relato de Problema</p>
                    <p className="text-xs text-ink-2">{checklistEscala.relato_problema}</p>
                  </div>
                )}
              </div>
            ) : (meuPapel || isLiderOuAdmin) ? (
              /* ── Formulário — disponível para quem está escalado, líderes e admins ── */
              <div className="p-4 space-y-3">
                <p className="text-xs text-ink-2">Preencha após o culto. Ao finalizar, todos os escalados ficam cientes.</p>

                <div className="space-y-2">
                  {ITENS_CHECKLIST.map(item => (
                    <label key={item.key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition select-none ${checklistForm[item.key] ? 'bg-success-soft border-success text-success' : 'bg-surface-2 border-line text-ink-2 hover:border-line'}`}>
                      <input type="checkbox" className="hidden" checked={checklistForm[item.key]} onChange={() => setChecklistForm(prev => ({ ...prev, [item.key]: !prev[item.key] }))} />
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-on-success text-xs font-bold transition ${checklistForm[item.key] ? 'bg-success' : 'bg-line'}`}>
                        {checklistForm[item.key] ? '✓' : ''}
                      </div>
                      <span className="text-xs font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Relato de Problemas (opcional)</p>
                  <textarea rows={3}
                    placeholder="Som, vídeo, energia, internet..."
                    value={checklistForm.relato_problema}
                    onChange={e => setChecklistForm(prev => ({ ...prev, relato_problema: e.target.value }))}
                    className="w-full border border-line rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-brand resize-none bg-surface-2"
                  />
                </div>

                <button onClick={salvarChecklistEscala} disabled={salvandoChecklist}
                  className="w-full py-3.5 rounded-xl font-bold text-on-brand bg-brand hover:opacity-90 transition active:scale-[0.97] disabled:opacity-50">
                  {salvandoChecklist ? 'Registrando...' : '✓ Finalizar Checklist'}
                </button>
              </div>
            ) : (
              /* ── Não escalado — só vê o status ── */
              <div className="p-4 text-center text-muted">
                <p className="text-sm font-medium">Checklist ainda não preenchido.</p>
                <p className="text-xs mt-1">Disponível para membros escalados e liderança.</p>
              </div>
            )}
          </div>
        )}

        {/* ── AVISO FIXO — INFANTIL ── */}
        {departamentoNome === 'Infantil' && (
          <div className="rounded-2xl overflow-hidden border-2 border-accent/40 shadow-sm">
            <div className="bg-accent px-4 py-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-bold text-white uppercase tracking-wide">
                Atenção — Escalados do Infantil Hoje
              </p>
            </div>
            <div className="bg-accent/10 px-4 py-4 space-y-3">
              {[
                { n: '1️⃣', t: 'Chegar com até 40 min de antecedência', d: 'Para preparar o ambiente com oração e organizar a sala antes de receber as crianças.' },
                { n: '2️⃣', t: 'Oração em grupo', d: 'Realizar uma oração com todos os escalados antes do início das aulas.' },
                { n: '3️⃣', t: 'Limpeza após as aulas', d: 'Limpar a sala, verificar lixos dos banheiros, corredores, secretaria e demais áreas do DI — não apenas a sua sala.' },
              ].map(item => (
                <div key={item.n} className="flex gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">{item.n}</span>
                  <div>
                    <p className="text-sm font-bold text-accent-ink">{item.t}</p>
                    <p className="text-xs text-accent-ink leading-relaxed mt-0.5">{item.d}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-accent/40 pt-3 flex items-start gap-2">
                <span className="text-sm flex-shrink-0">👉</span>
                <p className="text-xs font-bold text-accent-ink">
                  Todos os escalados devem se unir para a organização e limpeza do ambiente.
                </p>
              </div>
              <p className="text-xs text-accent-ink text-center font-medium pt-1">
                Ficamos felizes em ter vocês servindo ao Senhor com alegria! 🥳🙌
              </p>
            </div>
          </div>
        )}

                        {/* EQUIPA ESCALADA */}
        <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
          <div className="p-5 border-b border-line bg-surface-2">
            <h2 className="text-sm font-bold text-ink uppercase flex items-center gap-2"><UserPlus className={`w-5 h-5 text-brand`} /> Equipe Escalada ({escala.schedule_roles.length})</h2>
            {isLiderOuAdmin && escala.schedule_roles.length > 0 && <p className="text-xs text-ink-2 mt-1">{resumoPresenca(escala.schedule_roles)}</p>}
          </div>
          <div className="p-2">
            {escala.schedule_roles.length === 0 ? <p className="text-sm text-muted text-center py-6 font-medium">Ninguém escalado ainda.</p> : (
              <div className="divide-y divide-line">
                {[...escala.schedule_roles].sort((a, b) => {
                  // ✅ Ordena pela posição em funcoesOrdenadas para manter sequência padrão
                  const getPrimaria = f => f.split(/[+\/]/).map(s => s.trim()).filter(Boolean)[0] || ''
                  const ordered = departamentoTipo === 'louvor' ? funcoesLouvor
                    : departamentoTipo === 'infantil' ? funcoesInfantil
                    : departamentoTipo === 'midia'    ? funcoesMidia
                    : departamentoNome === 'Diaconia' ? funcoesDiaconia
                    : []
                  const iA = ordered.indexOf(getPrimaria(a.funcao))
                  const iB = ordered.indexOf(getPrimaria(b.funcao))
                  const sortA = iA === -1 ? 999 : iA
                  const sortB = iB === -1 ? 999 : iB
                  if (sortA !== sortB) return sortA - sortB
                  // Empate na função → ordena por nome
                  return (a.users_profile?.nome || '').localeCompare(b.users_profile?.nome || '')
                }).map((papel) => {
                  const temTrocaPendente = pedidosTroca.some(p => p.role_id === papel.id)
                  const ehMeuPapel = papel.user_id === meuId
                  const presenca = statusPresenca(papel.status_confirmacao)
                  const escalaPassou = escala.data < hojeLocal()
                  return (
                    <div key={papel.id} className="p-3 flex flex-wrap items-center justify-between gap-y-2 hover:bg-surface-2 rounded-xl transition">
                      <div className="flex flex-col">
                        <span className="font-bold text-ink">{papel.users_profile?.nome || 'Membro Excluído'}</span>
                        <span className={`text-[11px] font-bold uppercase tracking-wider text-brand`}>{papel.funcao}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {papel.user_id === meuId && !temTrocaPendente && <button onClick={() => abrirModalSubstituicao(papel)} className="flex items-center gap-1 bg-warning-soft text-warning border border-warning/40 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-warning-soft transition shadow-sm"><RefreshCw className="w-3.5 h-3.5" /> Trocar</button>}
                        {papel.user_id === meuId && temTrocaPendente && <span className="flex items-center gap-1 bg-surface-2 text-ink-2 border border-line px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase"><Clock className="w-3 h-3" /> Em análise</span>}
                        {isLiderOuAdmin && !ehMeuPapel && <Pill tom={tomPresenca(presenca)}>{rotuloPresenca(presenca)}</Pill>}
                        {isLiderOuAdmin && <button onClick={() => removerPessoa(papel.id, papel.users_profile?.nome, papel.user_id)} aria-label={`Remover ${papel.users_profile?.nome || 'membro'} da escala`} className="text-muted hover:text-danger transition p-1"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      {ehMeuPapel && (
                        <div className="w-full flex flex-wrap items-center gap-2">
                          {escalaPassou ? (
                            <Pill tom={tomPresenca(presenca)}>{rotuloPresenca(presenca)}</Pill>
                          ) : presenca === PENDENTE ? (
                            <>
                              <span className="text-xs text-ink-2 font-medium mr-auto">Você confirma sua presença?</span>
                              <Button size="sm" icon={<Check className="w-4 h-4" />} loading={respondendoId === papel.id} onClick={() => responderPresenca(papel, CONFIRMADO)}>Confirmar</Button>
                              <Button size="sm" variant="perigo" icon={<X className="w-4 h-4" />} disabled={respondendoId === papel.id} onClick={() => responderPresenca(papel, RECUSADO)}>Não posso</Button>
                            </>
                          ) : presenca === CONFIRMADO ? (
                            <>
                              <Pill tom="sucesso" className="mr-auto"><CheckCircle2 className="w-3 h-3" /> Presença confirmada</Pill>
                              <Button size="sm" variant="fantasma" loading={respondendoId === papel.id} onClick={() => responderPresenca(papel, RECUSADO)}>Não posso mais</Button>
                            </>
                          ) : (
                            <>
                              <Pill tom="perigo"><XCircle className="w-3 h-3" /> Você não vai</Pill>
                              <span className="text-xs text-ink-2 flex-1 min-w-[10rem]">{temTrocaPendente ? 'Sua troca está em análise.' : 'Peça uma troca para não deixar a vaga em aberto.'}</span>
                              <Button size="sm" variant="fantasma" loading={respondendoId === papel.id} onClick={() => responderPresenca(papel, CONFIRMADO)}>Posso ir</Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ÁREA EXCLUSIVA DO LÍDER: PEDIDOS DE TROCA PENDENTES */}
        {isLiderOuAdmin && pedidosTroca.length > 0 && (
          <div className="bg-warning-soft p-5 rounded-2xl shadow-sm border border-warning/40 space-y-3">
            <h2 className="text-sm font-bold text-warning uppercase flex items-center gap-2"><RefreshCw className="w-4 h-4 text-warning" /> Aprovar Trocas ({pedidosTroca.length})</h2>
            <div className="space-y-2">
              {pedidosTroca.map(pedido => (
                <div key={pedido.id} className="bg-surface p-3 rounded-xl border border-warning/40 shadow-sm">
                  <p className="text-xs text-ink-2 mb-2"><strong className="text-ink">{pedido.requester_nome}</strong> quer repassar a função de <strong className="text-ink">{pedido.funcoes_alvo || "todas as suas funções"}</strong> para <strong className="text-ink">{pedido.substitute_nome}</strong>.</p>
                  {pedido.motivo && <div className="mb-3 bg-surface-2 p-2.5 rounded-lg border border-line"><p className="text-[10px] text-ink-2 font-bold uppercase tracking-wider mb-0.5">Motivo:</p><p className="text-xs text-ink italic">"{pedido.motivo}"</p></div>}
                  <div className="flex gap-2">
                    <button onClick={() => avaliarTroca(pedido, true)} className="flex-1 flex items-center justify-center gap-1.5 bg-success text-on-success font-bold py-2 rounded-lg text-xs hover:bg-success shadow-sm"><Check className="w-4 h-4" /> Aprovar</button>
                    <button onClick={() => avaliarTroca(pedido, false)} className="flex-1 flex items-center justify-center gap-1.5 bg-danger-soft text-danger font-bold py-2 rounded-lg text-xs border border-danger hover:bg-danger-soft shadow-sm"><X className="w-4 h-4" /> Rejeitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AÇÕES DO LÍDER */}
        {isLiderOuAdmin && (
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-line space-y-4">
            <h2 className="text-sm font-bold text-ink uppercase flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-brand" /> Ações do Líder</h2>
            <form onSubmit={adicionarPessoaManual} className="bg-surface-2 p-4 rounded-xl border border-line">
              <label className="block text-xs font-bold text-ink-2 mb-2">Adicionar membro manualmente:</label>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select value={novoMembroId} onChange={(e) => setNovoMembroId(e.target.value)} required className="flex-1 text-sm border border-line rounded-lg p-2.5 outline-none bg-surface font-medium">
                  <option value="">Selecione o membro...</option>
                  {membrosEquipa.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <button type="submit" disabled={!novoMembroId || novasFuncoes.length === 0} className={`px-6 rounded-lg text-on-brand font-bold transition active:scale-[0.97] flex items-center justify-center py-3 sm:py-0 shadow-sm disabled:opacity-50 bg-brand hover:opacity-90`}><UserPlus className="w-5 h-5 mr-2" /> Adicionar</button>
              </div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Selecione as funções:</label>
              <div className="flex flex-wrap gap-2">
                {opcoesFuncao.map(f => {
                  const isSelecionado = novasFuncoes.includes(f)
                  return (
                    <label key={f} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer transition select-none shadow-sm ${isSelecionado ? `bg-brand/10 border-brand text-brand` : `bg-surface border-line text-ink-2 hover:bg-surface-2`}`}>
                      <input type="checkbox" className="hidden" checked={isSelecionado} onChange={() => toggleNovaFuncao(f)} />
                      {isSelecionado && <CheckCircle2 className="w-3.5 h-3.5" />} {f}
                    </label>
                  )
                })}
              </div>
            </form>
            <div className="flex gap-2 pt-2">
              {isRascunho && <button onClick={publicarEscala} className={`flex-1 text-on-brand font-bold py-3 rounded-xl shadow-md flex justify-center items-center gap-2 transition active:scale-[0.97] bg-brand hover:opacity-90`}><Send className="w-5 h-5" /> Publicar</button>}
              <button onClick={apagarEscalaCompleta} className="flex-1 bg-danger-soft text-danger hover:bg-danger-soft hover:text-danger font-bold py-3 rounded-xl transition active:scale-[0.97] flex justify-center items-center gap-2 border border-danger"><Trash2 className="w-5 h-5" /> Apagar</button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL TROCA */}
      {modalTrocaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-line pb-3">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2"><RefreshCw className="w-5 h-5 text-warning" /> Solicitar Troca</h2>
              <button onClick={() => setModalTrocaAberto(false)} className="text-muted hover:bg-surface-2 p-2 rounded-full transition"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={enviarPedidoTroca} className="space-y-4">
              {papelParaTrocar && (papelParaTrocar.funcao.includes('+') || papelParaTrocar.funcao.includes('/')) && (
                <div className="bg-surface-2 p-3 rounded-xl border border-line">
                  <label className="block text-xs font-bold text-ink-2 mb-2 uppercase tracking-wider">Quais funções deseja trocar?</label>
                  <div className="flex flex-col gap-2">
                    {papelParaTrocar.funcao.split(/[+/]/).map(f => f.trim()).filter(Boolean).map(funcao => (
                      <label key={funcao} className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer hover:bg-surface-2 p-1.5 rounded-lg transition">
                        <input type="checkbox" checked={funcoesSelecionadasTroca.includes(funcao)} onChange={() => toggleFuncaoTroca(funcao)} className="w-4 h-4 rounded border-line text-warning focus:ring-warning" /> {funcao}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-2">Quem você conversou e aceitou ficar no seu lugar?</label>
                <select required value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)} className="w-full border border-line rounded-xl p-3 text-sm focus:ring-2 focus:ring-warning outline-none bg-surface-2">
                  <option value="">Selecione o membro...</option>
                  {membrosEquipa.filter(m => m.id !== meuId).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-2">Motivo da Substituição *</label>
                <textarea required rows="2" placeholder="Explique o motivo (Ex: Viagem, saúde...)" value={motivoTroca} onChange={(e) => setMotivoTroca(e.target.value)} className="w-full border border-line rounded-xl p-3 text-sm outline-none bg-surface-2 focus:ring-2 focus:ring-warning resize-none" />
              </div>
              <div className="bg-warning-soft border border-warning/40 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-[10px] text-warning font-medium">O líder do departamento vai receber este pedido.</p>
              </div>
              <button type="submit" disabled={!substitutoId || loading || funcoesSelecionadasTroca.length === 0} className="w-full bg-brand hover:opacity-90 text-on-brand font-bold py-3.5 rounded-xl transition active:scale-[0.97] shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar Solicitação de Troca'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR MÚSICA */}
      {modalMusicaAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[8vh] overflow-hidden">
          <div className="bg-surface w-full max-w-md rounded-3xl p-6 shadow-xl animate-in zoom-in-95 flex flex-col" style={{ maxHeight: '70dvh' }}>
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2"><Music className="w-5 h-5 text-brand" /> Adicionar Música</h2>
              <button onClick={() => setModalMusicaAberto(false)} className="text-muted hover:bg-surface-2 p-2 rounded-full"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="mb-4 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" placeholder="Buscar por título ou artista..." value={buscaMusica} onChange={(e) => setBuscaMusica(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:border-brand transition bg-surface-2" />
              </div>
              <div className="flex gap-2">
                {['Todas', 'Celebração', 'Adoração'].map(cat => (
                  <button key={cat} onClick={() => setFiltroCategoria(cat)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border shadow-sm ${filtroCategoria === cat ? 'bg-brand text-on-brand border-brand' : 'bg-surface text-ink-2 border-line hover:bg-surface-2'}`}>{cat}</button>
                ))}
              </div>
            </div>
            {repertorio.length === 0 ? <p className="text-sm text-ink-2 text-center py-6">O repertório está vazio.</p> : repertorioFiltrado.length === 0 ? <p className="text-sm text-ink-2 text-center py-6">Nenhuma música encontrada.</p> : (
              <div className="overflow-y-auto space-y-2 pr-2 flex-1 pb-2" style={{ minHeight: '120px', WebkitOverflowScrolling: 'touch' }}>
                {repertorioFiltrado.map(mus => {
                  const jaAdicionada = musicasEscala.some(m => m.songs?.id === mus.id)
                  return (
                    <div key={mus.id} className="flex justify-between items-center p-3 border border-line rounded-xl hover:bg-surface-2">
                      <div>
                        <p className="font-bold text-sm text-ink flex items-center gap-2">
                          {mus.titulo} {mus.categoria && <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${mus.categoria.toLowerCase() === 'celebração' ? 'bg-warning-soft text-warning' : mus.categoria.toLowerCase() === 'adoração' ? 'bg-brand/10 text-brand' : 'hidden'}`}>{mus.categoria}</span>}
                        </p>
                        <p className="text-[10px] text-ink-2">{mus.artista || 'Sem artista'} • Tom Base: {mus.tom || '?'}</p>
                      </div>
                      <button onClick={() => adicionarMusicaAEscala(mus.id, mus.tom)} disabled={jaAdicionada} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ml-2 ${jaAdicionada ? 'bg-surface-2 text-muted' : 'bg-brand text-on-brand hover:opacity-90 shadow-sm'}`}>
                        {jaAdicionada ? 'Adicionada' : 'Adicionar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TOM */}
      {modalTomAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl p-6 shadow-xl animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2"><Music className="w-5 h-5 text-brand" /> Escolha o Tom</h2>
              <button onClick={() => setModalTomAberto(false)} className="text-muted hover:bg-surface-2 p-2 rounded-full"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-muted uppercase mb-3 tracking-wider">Tons Maiores</p>
                <div className="grid grid-cols-4 gap-2">
                  {tonsMaiores.map(t => <button key={t} onClick={() => salvarNovoTom(t)} className="bg-surface-2 hover:bg-brand/10 hover:text-brand hover:border-brand/30 border border-line text-ink-2 font-black py-2.5 rounded-xl transition shadow-sm text-sm">{t}</button>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-muted uppercase mb-3 tracking-wider">Tons Menores</p>
                <div className="grid grid-cols-4 gap-2">
                  {tonsMenores.map(t => <button key={t} onClick={() => salvarNovoTom(t)} className="bg-surface-2 hover:bg-brand/10 hover:text-brand hover:border-brand/30 border border-line text-ink-2 font-black py-2.5 rounded-xl transition shadow-sm text-sm">{t}</button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ROUPA */}
      {modalRoupaAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-3xl p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-line pb-3">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2"><Palette className="w-5 h-5 text-brand" /> Cor da Roupa</h2>
              <button onClick={() => setModalRoupaAberto(false)} className="text-muted hover:bg-surface-2 p-2 rounded-full transition"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={salvarCorRoupa} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-2 mb-2">Qual a paleta para este culto?</label>
                <input type="text" autoFocus value={corEditando} onChange={(e) => setCorEditando(e.target.value)} placeholder="Ex: Preto, Branco, Jeans..." className="w-full border border-line rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand bg-surface-2" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-brand hover:opacity-90 text-on-brand font-bold py-3.5 rounded-xl transition active:scale-[0.97] shadow-md disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar Paleta'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}