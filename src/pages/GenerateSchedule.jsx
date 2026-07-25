// src/pages/GenerateSchedule.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useIgreja } from '../context/IgrejaContext'
import { enviarNotificacaoEmMassa, enviarNotificacao } from '../utils/notificacoes'
import PageHeader from '../components/PageHeader'
import { ArrowLeft, CalendarDays, Wand2, Clock, Plus, Trash2, ListChecks, CalendarRange, AlertTriangle, Palette, Tag, UserMinus, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function GenerateSchedule() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const { igrejaId } = useIgreja()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const [departamentoTipo, setDepartamentoTipo] = useState(location.state?.departamentoTipo || '')
  useEffect(() => {
    if (departamentoId && !departamentoTipo) {
      supabase.from('departamentos').select('tipo').eq('id', departamentoId).single()
        .then(({ data }) => { if (data) setDepartamentoTipo(data.tipo || 'generico') })
    }
  }, [departamentoId])

  const [dataCulto, setDataCulto] = useState('')
  const [turnoEscala, setTurnoEscala] = useState('Integral')
  const [horarioEnsaio, setHorarioEnsaio] = useState('')
  const [tituloCulto, setTituloCulto] = useState('') 
  const [mesAuto, setMesAuto] = useState('')
  const [mesParaApagar, setMesParaApagar] = useState('')

  const [listaCultos, setListaCultos] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [progresso, setProgresso] = useState({ etapa: 0, texto: '', cultoAtual: 0, cultoTotal: 0 })

  function avancarEtapa(etapa, texto, cultoAtual = 0, cultoTotal = 0) {
    setProgresso({ etapa, texto, cultoAtual, cultoTotal })
  }

  const coresBase = ['All Black', 'Preto e Branco', 'Tons Terrosos', 'Jeans e Branco', 'Tons de Azul', 'Tons de Verde', 'Bege']
  const [coresSalvasBD, setCoresSalvasBD] = useState([]) 
  const [coresSelecionadas, setCoresSelecionadas] = useState([...coresBase]) 
  const [novaCor, setNovaCor] = useState('') 

  const [membrosEquipe, setMembrosEquipe] = useState([])
  const [membrosExcluidos, setMembrosExcluidos] = useState([])

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    
    if (dataCulto) {
      const isDomingo = new Date(dataCulto + 'T12:00:00').getDay() === 0
      setTurnoEscala(isDomingo ? 'Manhã' : 'Integral')
    }

    async function buscarMembros() {
      const { data } = await supabase
        .from('membros_departamentos')
        .select('users_profile(id, nome)')
        .eq('departamento_id', departamentoId)
      
      if (data) {
        const formatados = data.map(d => d.users_profile).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome))
        setMembrosEquipe(formatados)
      }
    }
    
    async function buscarCores() {
      if (departamentoNome !== 'Louvor') return;
      const { data } = await supabase.from('departamento_cores').select('cor').eq('departamento_id', departamentoId)
      if (data) {
        const coresExtras = data.map(d => d.cor)
        setCoresSalvasBD(coresExtras)
        setCoresSelecionadas([...coresBase, ...coresExtras])
      }
    }

    buscarMembros()
    buscarCores()
  }, [dataCulto, departamentoId, departamentoNome])

  function preencherMesPadrao() {
    if (!mesAuto) return

    const [ano, mes] = mesAuto.split('-')
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const novosCultos = []
    const jaExiste = (data, turno) => listaCultos.some(c => c.data === data && c.turno === turno)

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataAtual = new Date(ano, mes - 1, dia)
      const yyyy = dataAtual.getFullYear()
      const mm = String(dataAtual.getMonth() + 1).padStart(2, '0')
      const dd = String(dataAtual.getDate()).padStart(2, '0')
      const dataFormatada = `${yyyy}-${mm}-${dd}`
      
      const diaDaSemana = dataAtual.getDay()

      if (diaDaSemana === 0) {
        if (!jaExiste(dataFormatada, 'Manhã')) {
          novosCultos.push({ id: Date.now() + Math.random(), data: dataFormatada, turno: 'Manhã', ensaio: departamentoTipo === 'louvor' ? '08:00' : '', titulo: '' })
        }
        if (!jaExiste(dataFormatada, 'Noite')) {
          novosCultos.push({ id: Date.now() + Math.random(), data: dataFormatada, turno: 'Noite', ensaio: departamentoTipo === 'louvor' ? 'Após o culto da manhã' : '', titulo: '' })
        }
      } 
      else if (diaDaSemana === 2 && (departamentoTipo === 'louvor' || departamentoNome === 'Diaconia')) {
        if (!jaExiste(dataFormatada, 'Noite')) {
          novosCultos.push({ id: Date.now() + Math.random(), data: dataFormatada, turno: 'Noite', ensaio: departamentoTipo === 'louvor' ? 'Sem ensaio' : '', titulo: '' })
        }
      }
      else if (diaDaSemana === 4) {
        if (!jaExiste(dataFormatada, 'Noite')) {
          let textoEnsaio = ''
          if (departamentoTipo === 'louvor') {
            const dataTerca = new Date(dataAtual)
            dataTerca.setDate(dataAtual.getDate() - 2)
            const diaTerca = String(dataTerca.getDate()).padStart(2, '0')
            const mesTerca = String(dataTerca.getMonth() + 1).padStart(2, '0')
            textoEnsaio = `Terça (${diaTerca}/${mesTerca}) às 21:00`
          }
          novosCultos.push({ id: Date.now() + Math.random(), data: dataFormatada, turno: 'Noite', ensaio: textoEnsaio, titulo: '' })
        }
      }
    }
    setListaCultos([...listaCultos, ...novosCultos])
    setMesAuto('')
  }

  function formatarDataComDia(dataString) {
    const dias = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
    const data = new Date(dataString + 'T12:00:00');
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const nomeDia = dias[data.getDay()];
    return `${dia}/${mes} - ${nomeDia}`;
  }

  async function adicionarALista(e) {
    e.preventDefault()
    if (!dataCulto) return

    const diaDaSemana = new Date(dataCulto + 'T12:00:00').getDay()
    
    if (diaDaSemana === 2 && departamentoNome !== 'Louvor' && departamentoNome !== 'Diaconia') {
      if (!await confirm({ title: 'Culto extra na terça?', message: `Por padrão, ${departamentoNome} não tem escala às terças. Deseja adicionar mesmo assim?`, labelOk: 'Adicionar', labelCancel: 'Cancelar' })) {
        return 
      }
    }

    if (listaCultos.some(c => c.data === dataCulto && c.turno === turnoEscala)) {
      toast.warning('Este culto já está na sua lista!')
      return
    }
    
    const textoEnsaioFinal = departamentoTipo === 'louvor' ? (horarioEnsaio || 'A combinar') : ''
    
    setListaCultos([...listaCultos, { 
      id: Date.now(), 
      data: dataCulto, 
      turno: turnoEscala, 
      ensaio: textoEnsaioFinal,
      titulo: tituloCulto 
    }])
    
    setDataCulto('')
    setHorarioEnsaio('')
    setTituloCulto('')
  }

  function removerDaLista(id) {
    setListaCultos(listaCultos.filter(c => c.id !== id))
  }

  async function adicionarCorPersonalizada(e) {
    e.preventDefault()
    const corAjustada = novaCor.trim()
    if (!corAjustada) return
    
    const todasCoresDisponiveis = [...coresBase, ...coresSalvasBD]
    
    if (todasCoresDisponiveis.map(c => c.toLowerCase()).includes(corAjustada.toLowerCase())) {
      toast.warning('Essa cor já existe na sua paleta!')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('departamento_cores').insert([{ departamento_id: departamentoId, cor: corAjustada }])
    
    if (!error) {
      setCoresSalvasBD([...coresSalvasBD, corAjustada])
      setCoresSelecionadas([...coresSelecionadas, corAjustada])
      setNovaCor('')
    } else {
      (() => { console.error('Erro ao salvar cor:', error); toast.error('Não foi possível salvar a cor. Tente novamente.') })()
    }
    setLoading(false)
  }

  async function gerarEscalasEmLote() {
    if (listaCultos.length === 0) return
    if (loading) return  // evita duplo-clique gerando escalas duplicadas
    
    if (departamentoTipo === 'louvor' && coresSelecionadas.length === 0) {
      toast.warning('Selecione pelo menos uma cor de roupa para o mês.')
      return
    }

    setLoading(true)
    avancarEtapa(1, 'A carregar equipe e histórico...')

    try {
      const { data: membrosDept } = await supabase
        .from('membros_departamentos')
        .select(`
          user_id, 
          users_profile ( 
            id, nome, 
            voz, conducao, backing_vocal, sonoplastia, 
            midia_computador, midia_fotografia, midia_redacao,
            infantil_bercario, infantil_sala3_8, infantil_sala9_11, infantil_acolhimento, infantil_auxiliar,
            diaconia,
            user_instruments(instrumento) 
          )
        `)
        .eq('departamento_id', departamentoId)

      let equipa = membrosDept ? membrosDept.map(m => m.users_profile).filter(Boolean) : []
      if (equipa.length === 0) throw new Error('A sua equipe está vazia!')

      equipa = equipa.filter(m => !membrosExcluidos.includes(m.id))

      if (equipa.length === 0) throw new Error('Todos os membros foram excluídos. A equipe ficou vazia!')

      const datasCultos = listaCultos.map(c => new Date(c.data));
      const minData = new Date(Math.min(...datasCultos));
      const ano = minData.getFullYear();
      const mes = String(minData.getMonth() + 1).padStart(2, '0');
      
      const dataInicioMes = `${ano}-${mes}-01`;
      const dataFimMes = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;

      // ✅ Histórico do mês ANTERIOR para o rodízio começar já equilibrado
      const dataMesAnterior = new Date(parseInt(ano), parseInt(mes) - 2, 1)
      const anoAnterior  = dataMesAnterior.getFullYear()
      const mesAnteriorN = String(dataMesAnterior.getMonth() + 1).padStart(2, '0')
      const inicioMesAnt = `${anoAnterior}-${mesAnteriorN}-01`
      const fimMesAnt    = `${anoAnterior}-${mesAnteriorN}-${new Date(anoAnterior, dataMesAnterior.getMonth() + 1, 0).getDate()}`

      avancarEtapa(2, 'A analisar histórico do mês...')

      // Busca mês atual + mês anterior em paralelo
      const [escalasMesAtualRes, escalasMesAnteriorRes] = await Promise.all([
        supabase
          .from('schedule_roles')
          .select('user_id, schedules!inner(departamento_id, data)')
          .eq('schedules.departamento_id', departamentoId)
          .gte('schedules.data', dataInicioMes)
          .lte('schedules.data', dataFimMes),
        supabase
          .from('schedule_roles')
          .select('user_id, schedules!inner(departamento_id, data)')
          .eq('schedules.departamento_id', departamentoId)
          .gte('schedules.data', inicioMesAnt)
          .lte('schedules.data', fimMesAnt),
      ])

      const todasEscalasMes      = escalasMesAtualRes.data
      const escalasMesAnterior   = escalasMesAnteriorRes.data

      // Inicializa com contagem do mês anterior (quem serviu mais já começa em desvantagem)
      const historicoGlobal = {};
      equipa.forEach(m => {
        historicoGlobal[m.id] = 0;
      });

      if (escalasMesAnterior) {
        escalasMesAnterior.forEach(role => {
          if (historicoGlobal[role.user_id] !== undefined) {
            historicoGlobal[role.user_id]++
          }
        })
      }

      // Soma também o mês atual (escalas já geradas)
      if (todasEscalasMes) {
        todasEscalasMes.forEach(role => {
          const uid = role.user_id;
          if (historicoGlobal[uid] !== undefined) {
            historicoGlobal[uid]++;
          }
        });
      }

      // ✅ Embaralhamento fixo — calculado uma vez, garante ordem diferente a cada geração
      const ordemAleatoria = {}
      equipa.forEach(m => { ordemAleatoria[m.id] = Math.random() })

      // ✅ Penalidade por dia da semana — evita mesma pessoa em todas as quintas
      const contadorDiaSemana = {}
      equipa.forEach(m => { contadorDiaSemana[m.id] = {} })

      const conflitosDetectados = [] // {userId, data, turno, deptOutro}

      for (let i = 0; i < listaCultos.length; i++) {
        const culto = listaCultos[i]
        avancarEtapa(3, `A gerar ${new Date(culto.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}...`, i + 1, listaCultos.length)

        // ✅ Promise.all — existente + folgas + ocupados em paralelo por culto
        const [existenteRes, folgasRes, ocupadosRes] = await Promise.all([
          supabase.from('schedules').select('id')
            .eq('data', culto.data).eq('turno', culto.turno).eq('departamento_id', departamentoId).maybeSingle(),
          supabase.from('indisponibilidades').select('user_id, turno').eq('data', culto.data),
          supabase.from('schedule_roles').select('user_id, schedules!inner(data, turno)').eq('schedules.data', culto.data),
        ])
        const escalaExistente = existenteRes.data
        const folgas          = folgasRes.data
        const ocupadosGlobal  = ocupadosRes.data

        if (escalaExistente) throw new Error(`Já existe escala para o dia ${new Date(culto.data + 'T12:00:00').toLocaleDateString('pt-BR')} no turno ${culto.turno}`)

        const idsFolga = folgas ? folgas.filter(f =>
          f.turno === 'Integral' ||
          f.turno?.toLowerCase() === 'dia todo' ||
          f.turno === culto.turno
        ).map(f => f.user_id) : []

        const idsOcupados = ocupadosGlobal ? ocupadosGlobal.filter(oc => oc.schedules.turno === 'Integral' || oc.schedules.turno === culto.turno).map(oc => oc.user_id) : []

        const idsIndisponiveis = [...new Set([...idsFolga, ...idsOcupados])]
        
        const disponiveis = equipa.filter(membro => !idsIndisponiveis.includes(membro.id));

        // ✅ diaDaSemana precisa ser declarado ANTES de scoreOf (que o usa)
        const diaDaSemana = new Date(culto.data + 'T12:00:00').getDay()

        // ✅ Score = histórico global + penalidade dia da semana + jitter fixo
        const scoreOf = (m) => {
          const penalidade = (contadorDiaSemana[m.id][diaDaSemana] || 0) * 1.5
          return historicoGlobal[m.id] + penalidade + ordemAleatoria[m.id] * 0.9
        }
        const equipePriorizada = [...disponiveis].sort((a, b) => scoreOf(a) - scoreOf(b))

        const escalados = []
        
        const alocarMembro = (membro, funcao) => {
          if (!membro) return;
          const existente = escalados.find(e => e.user_id === membro.id);
          if (existente) {
            existente.funcao = existente.funcao + ' + ' + funcao;
          } else {
            escalados.push({ user_id: membro.id, funcao });
            historicoGlobal[membro.id]++
            // ✅ Registra que esta pessoa serviu neste dia da semana
            contadorDiaSemana[membro.id][diaDaSemana] = (contadorDiaSemana[membro.id][diaDaSemana] || 0) + 1
          }
        }

        const escalarPorFuncao = (condicao, nomeFuncao, quantidade = 1) => {
          for (let q = 0; q < quantidade; q++) {
            const voluntario = equipePriorizada.find(m => !escalados.some(e => e.user_id === m.id) && condicao(m));
            if (voluntario) alocarMembro(voluntario, nomeFuncao);
          }
        }

        if (departamentoTipo === 'louvor') {
          const podeAcumularVoz = (m) => {
            const jaEscalado = escalados.find(e => e.user_id === m.id);
            if (!jaEscalado) return true; 
            return !jaEscalado.funcao.includes('Sonoplastia') && !jaEscalado.funcao.includes('Backing Vocal');
          }
          if (diaDaSemana === 2) { 
            const player = equipePriorizada.find(m => m.user_instruments?.some(inst => inst.instrumento === 'Violão' || inst.instrumento === 'Teclado'))
            if (player) alocarMembro(player, player.user_instruments.find(inst => inst.instrumento === 'Violão' || inst.instrumento === 'Teclado').instrumento)
            const singer = equipePriorizada.find(m => podeAcumularVoz(m) && m.voz)
            if (singer) alocarMembro(singer, 'Voz Principal')
          } else { 
            escalarPorFuncao(m => m.user_instruments?.some(i => i.instrumento === 'Bateria'), 'Bateria', 1)
            escalarPorFuncao(m => m.user_instruments?.some(i => i.instrumento === 'Teclado'), 'Teclado', 1)
            escalarPorFuncao(m => m.user_instruments?.some(i => i.instrumento === 'Violão'), 'Violão', 1)
            escalarPorFuncao(m => m.user_instruments?.some(i => i.instrumento === 'Baixo'), 'Baixo', 1)
            escalarPorFuncao(m => m.user_instruments?.some(i => i.instrumento === 'Guitarra'), 'Guitarra', 1)
            escalarPorFuncao(m => m.sonoplastia, 'Sonoplastia', 1)
            const cand = equipePriorizada.find(m => podeAcumularVoz(m) && m.voz && m.conducao);
            if (cand) alocarMembro(cand, 'Voz Principal / Condução');
            else {
              const candV = equipePriorizada.find(m => podeAcumularVoz(m) && m.voz);
              if (candV) alocarMembro(candV, 'Voz Principal');
            }
            escalarPorFuncao(m => m.backing_vocal, 'Backing Vocal', 2)
          }
        } 
        else if (departamentoTipo === 'midia') {
          escalarPorFuncao(m => m.midia_computador, 'Computador', 1)
          escalarPorFuncao(m => m.midia_fotografia, 'Fotografia', 1)
          escalarPorFuncao(m => m.midia_redacao, 'Redação', 1)
        }
        else if (departamentoTipo === 'infantil') {
          const qtdBercario = diaDaSemana === 4 ? 1 : 2; 
          escalarPorFuncao(m => m.infantil_bercario, 'Berçário', qtdBercario)
          escalarPorFuncao(m => m.infantil_sala3_8, 'Sala 03 - 08 anos', 1) 
          escalarPorFuncao(m => m.infantil_auxiliar, 'Auxiliar (Sala 03-08)', 1) 
          escalarPorFuncao(m => m.infantil_sala9_11, 'Sala 09 - 11 anos', 1)
        }
        else if (departamentoNome === 'Diaconia') {
          let qtdDiaconia = 4; // Padrão para extras e Domingos à Noite
          
          if (diaDaSemana === 2) { // Terça
            qtdDiaconia = 1;
          } else if (diaDaSemana === 4) { // Quinta
            qtdDiaconia = 3;
          } else if (diaDaSemana === 0) { // Domingo
            qtdDiaconia = culto.turno === 'Manhã' ? 2 : 4;
          }
          
          escalarPorFuncao(m => m.diaconia, 'Diaconia', qtdDiaconia) 
        }

        const corSorteada = departamentoTipo === 'louvor' && coresSelecionadas.length > 0 ? coresSelecionadas[Math.floor(Math.random() * coresSelecionadas.length)] : null;
        
        const { data: novaEscala, error: erroEscala } = await supabase.from('schedules').insert([{ 
          data: culto.data, cor_roupa: corSorteada, turno: culto.turno, horario_ensaio: culto.ensaio, titulo: culto.titulo || null, status: 'Rascunho', departamento_id: departamentoId, igreja_id: igrejaId
        }]).select().single()

        if (erroEscala) throw erroEscala
        const papeisParaSalvar = escalados.map(e => ({ schedule_id: novaEscala.id, user_id: e.user_id, funcao: e.funcao }))
        if (papeisParaSalvar.length > 0) await supabase.from('schedule_roles').insert(papeisParaSalvar)

        // ✅ Detecta CONFLITO: pessoa escalada que JÁ estava em outro dept no mesmo dia+turno.
        // (ocupadosGlobal tem quem já estava escalado nesse dia, de qualquer departamento)
        if (ocupadosGlobal?.length > 0) {
          for (const e of escalados) {
            const jaOcupado = ocupadosGlobal.find(oc =>
              oc.user_id === e.user_id &&
              (oc.schedules.turno === culto.turno || oc.schedules.turno === 'Integral')
            )
            if (jaOcupado) {
              conflitosDetectados.push({ userId: e.user_id, data: culto.data, turno: culto.turno })
            }
          }
        }
      } 

      avancarEtapa(4, 'A notificar líderes...')
      toast.success(`${listaCultos.length} escala(s) gerada(s) em rascunho!`)

      // ✅ Avisa sobre CONFLITOS entre departamentos (pessoa escalada em 2 lugares no mesmo dia/turno)
      if (conflitosDetectados.length > 0) {
        await processarConflitos(conflitosDetectados, departamentoId, departamentoNome)
      }

      // ✅ Notificar líderes/admins que as escalas estão prontas para revisão
      const { data: { user } } = await supabase.auth.getUser()
      const { data: lideres } = await supabase
        .from('membros_departamentos')
        .select('user_id')
        .eq('departamento_id', departamentoId)
        .in('role', ['líder', 'admin'])

      if (lideres?.length > 0) {
        const liderIds = lideres.map(l => l.user_id).filter(id => id !== user?.id)
        if (liderIds.length > 0) {
          await enviarNotificacaoEmMassa({
            userIds:       liderIds,
            departamentoId,
            titulo:        `📋 Escalas prontas para revisão — ${departamentoNome}`,
            mensagem:      `${listaCultos.length} escala(s) foram geradas em rascunho. Acesse para revisar e publicar.`,
            tipo:          'escala',
            link:          `/dashboard/${departamentoId}`,
          })
        }
      }
      setTimeout(() => navigate(-1), 1500)

    } catch (error) {
      setProgresso({ etapa: 0, texto: '', cultoAtual: 0, cultoTotal: 0 })
      (() => { console.error('Erro:', error); toast.error('Ocorreu um erro. Tente novamente.') })()
      setLoading(false) 
    }
  }

  // Notifica sobre conflitos: a pessoa escalada em 2 depts + líderes dos 2 depts
  async function processarConflitos(conflitos, deptAtualId, deptAtualNome) {
    try {
      for (const conf of conflitos) {
        // Descobre em qual OUTRO departamento a pessoa já está nesse dia+turno
        const { data: outras } = await supabase
          .from('schedule_roles')
          .select('schedules!inner(data, turno, departamento_id, departamentos(nome))')
          .eq('user_id', conf.userId)
          .eq('schedules.data', conf.data)
          .neq('schedules.departamento_id', deptAtualId)

        const outraEscala = outras?.find(o =>
          o.schedules.turno === conf.turno || o.schedules.turno === 'Integral'
        )
        const deptOutroNome = outraEscala?.schedules?.departamentos?.nome || 'outro departamento'
        const deptOutroId   = outraEscala?.schedules?.departamento_id

        const dataFmt = new Date(conf.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

        // 1. Notifica a PRÓPRIA pessoa
        await enviarNotificacao({
          userId:   conf.userId,
          titulo:   '⚠️ Você está escalado em dois lugares',
          mensagem: `No dia ${dataFmt} você foi escalado(a) em "${deptAtualNome}" e também em "${deptOutroNome}" no mesmo turno. Avise um líder se não puder servir nos dois.`,
          tipo:     'aviso',
        })

        // 2. Notifica os LÍDERES dos dois departamentos
        const deptsParaAvisar = [deptAtualId, deptOutroId].filter(Boolean)
        if (deptsParaAvisar.length > 0) {
          const { data: lideres } = await supabase
            .from('membros_departamentos')
            .select('user_id')
            .in('departamento_id', deptsParaAvisar)
            .in('role', ['líder', 'admin'])

          // Pega o nome da pessoa em conflito
          const { data: perfilPessoa } = await supabase
            .from('users_profile').select('nome').eq('id', conf.userId).single()
          const nomePessoa = perfilPessoa?.nome || 'Um membro'

          const liderIdsUnicos = [...new Set((lideres || []).map(l => l.user_id))]
          if (liderIdsUnicos.length > 0) {
            await enviarNotificacaoEmMassa({
              userIds:  liderIdsUnicos,
              titulo:   '⚠️ Conflito de escala detectado',
              mensagem: `${nomePessoa} está escalado(a) em "${deptAtualNome}" e "${deptOutroNome}" no dia ${dataFmt}, mesmo turno.`,
              tipo:     'aviso',
            })
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao processar conflitos:', err.message)
    }
  }

  async function apagarMesInteiro() {
    if (!mesParaApagar) return
    const [ano, mes] = mesParaApagar.split('-')
    if (!await confirm({ title: `Apagar todas as escalas de ${mes}/${ano}?`, message: 'Atenção: esta ação é irreversível!', danger: true, labelOk: 'Apagar tudo', labelCancel: 'Cancelar' })) return
    setLoading(true)
    toast.info('Apagando escalas...')
    try {
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const dataInicio = `${mesParaApagar}-01`
      const dataFim = `${mesParaApagar}-${String(ultimoDia).padStart(2, '0')}`
      const { data: escalas, error: erroBusca } = await supabase.from('schedules').select('id').gte('data', dataInicio).lte('data', dataFim).eq('departamento_id', departamentoId)
      if (erroBusca) throw erroBusca
      if (!escalas || escalas.length === 0) {
        toast.success('Nenhuma escala encontrada para apagar.')
        setLoading(false)
        return
      }
      const idsDasEscalas = escalas.map(e => e.id)
      await supabase.from('schedule_songs').delete().in('schedule_id', idsDasEscalas)
      await supabase.from('schedule_roles').delete().in('schedule_id', idsDasEscalas)
      await supabase.from('schedules').delete().in('id', idsDasEscalas)
      toast.success('Todas as escalas foram apagadas!')
      setTimeout(() => setMesParaApagar(''), 1500)
    } catch (error) { (() => { console.error('Erro ao apagar:', error); toast.error('Não foi possível apagar. Tente novamente.') })() } finally { setLoading(false) }
  }

  const listaOrdenada = [...listaCultos].sort((a, b) => new Date(a.data) - new Date(b.data))

  const todasCoresRenderizar = Array.from(new Set([...coresBase, ...coresSalvasBD]))

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      <PageHeader
        title="Gerar Escala do Mês"
        subtitle={`Criar escalas para ${departamentoNome}`}
        icon={<CalendarDays className="w-5 h-5" />}
        color='bg-blue-600'
      />

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-xl shadow-md text-white">
          <h2 className="text-sm font-bold uppercase mb-2 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-200" />
            Mês Padrão
          </h2>
          <p className="text-xs text-blue-100 mb-4 opacity-90">Adiciona cultos padrão para todo o mês.</p>
          <div className="flex gap-2">
            <input type="month" value={mesAuto} onChange={(e) => setMesAuto(e.target.value)} className="flex-1 border-0 rounded-lg p-3 text-gray-800 font-medium outline-none shadow-inner" />
            <button onClick={preencherMesPadrao} disabled={!mesAuto} className="bg-white text-blue-700 px-4 font-bold rounded-lg hover:bg-blue-50 transition active:scale-[0.97] disabled:opacity-50 shadow-sm">Aplicar</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">Cultos Extras</h2>
          <form onSubmit={adicionarALista} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Data Extra</label>
                <input type="date" required value={dataCulto} onChange={(e) => setDataCulto(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Turno</label>
                <select value={turnoEscala} onChange={(e) => setTurnoEscala(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50">
                  <option value="Integral">Integral</option>
                  <option value="Manhã">Manhã</option>
                  <option value="Noite">Noite</option>
                </select>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1"><Tag className="w-3.5 h-3.5" /> Nome / Tema do Culto</label>
              <input type="text" placeholder="Ex: Culto de Jovens..." value={tituloCulto} onChange={(e) => setTituloCulto(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2.5 rounded-lg hover:bg-indigo-100 transition active:scale-[0.97] flex items-center justify-center gap-2 font-bold"><Plus className="w-5 h-5" /> Adicionar Culto</button>
          </form>
        </div>

        {departamentoTipo === 'louvor' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center gap-2"><Palette className="w-5 h-5 text-blue-600" /> Paletas de cores </h2>
            
            <form onSubmit={adicionarCorPersonalizada} className="flex gap-2 mb-4 border-b border-gray-100 pb-4">
              <input type="text" placeholder="Nova cor para a paleta..." value={novaCor} onChange={(e) => setNovaCor(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              <button type="submit" disabled={!novaCor || loading} className="bg-blue-600 text-white px-3 font-bold rounded-lg hover:bg-blue-700 transition active:scale-[0.97] disabled:opacity-50 text-sm">Salvar</button>
            </form>

            <div className="grid grid-cols-2 gap-3 mb-4 max-h-48 overflow-y-auto pr-1">
              {todasCoresRenderizar.map(cor => (
                <label key={cor} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition">
                  <input type="checkbox" checked={coresSelecionadas.includes(cor)} onChange={(e) => e.target.checked ? setCoresSelecionadas([...coresSelecionadas, cor]) : setCoresSelecionadas(coresSelecionadas.filter(c => c !== cor))} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600 shrink-0" />
                  <span className="truncate leading-tight">{cor}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-red-600" /> Membros em Pausa / Off
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Selecione membros que estão de férias ou que <b>não devem</b> participar da escala deste mês. Pode adicionar vários!
          </p>
          
          <select 
            value="" 
            onChange={(e) => {
              const idSelecionado = e.target.value;
              if (idSelecionado && !membrosExcluidos.includes(idSelecionado)) {
                setMembrosExcluidos([...membrosExcluidos, idSelecionado]);
              }
            }} 
            className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-red-500 bg-gray-50 cursor-pointer"
          >
            <option value="">Clique para adicionar um membro à pausa...</option>
            {membrosEquipe.filter(m => !membrosExcluidos.includes(m.id)).map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>

          {membrosExcluidos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {membrosExcluidos.map(id => {
                const m = membrosEquipe.find(x => x.id === id);
                return (
                  <div key={id} className="flex items-center gap-1.5 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-red-700 shadow-sm animate-in zoom-in duration-200">
                    <UserMinus className="w-3 h-3 opacity-70" />
                    {m?.nome}
                    <button 
                      onClick={() => setMembrosExcluidos(membrosExcluidos.filter(x => x !== id))} 
                      className="ml-1 text-red-400 hover:text-red-700 hover:bg-red-200 rounded-full p-0.5 transition"
                      title="Remover pausa deste membro"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-green-600" /> Resumo do Mês ({listaCultos.length})</h2>
          {listaCultos.length > 0 && (
            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {listaOrdenada.map((culto) => (
                <div key={culto.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <span className="font-bold text-gray-800 text-sm">{formatarDataComDia(culto.data)}</span>
                    <span className="ml-2 bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{culto.turno}</span>
                  </div>
                  <button onClick={() => removerDaLista(culto.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          {loading ? (
            <div className="w-full bg-white border-2 border-green-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-green-50 px-5 py-3 border-b border-green-100 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm font-bold text-green-800 truncate">{progresso.texto || 'Processando...'}</p>
              </div>
              {progresso.cultoTotal > 0 && (
                <div className="px-5 py-3 border-b border-green-50">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                    <span>Culto {progresso.cultoAtual} de {progresso.cultoTotal}</span>
                    <span>{Math.round((progresso.cultoAtual / progresso.cultoTotal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progresso.cultoAtual / progresso.cultoTotal) * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="px-5 py-3 grid grid-cols-4 gap-2">
                {[{n:1,label:'Equipe'},{n:2,label:'Histórico'},{n:3,label:'Gerando'},{n:4,label:'Notif.'}].map(e => (
                  <div key={e.n} className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      progresso.etapa > e.n  ? 'bg-green-500 text-white' :
                      progresso.etapa === e.n ? 'bg-green-100 text-green-700 ring-2 ring-green-400' :
                      'bg-gray-100 text-gray-400'}`}>
                      {progresso.etapa > e.n ? '✓' : e.n}
                    </div>
                    <span className={`text-[10px] font-medium text-center ${progresso.etapa >= e.n ? 'text-green-700' : 'text-gray-400'}`}>{e.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={gerarEscalasEmLote} disabled={listaCultos.length === 0 || loading}
              className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : <><Wand2 className="w-5 h-5" /> Gerar Escalas de {departamentoNome}</>}
            </button>
          )}
        </div>

        <div className="mt-8 border-2 border-red-200 bg-red-50 p-6 rounded-xl">
          <h2 className="text-sm font-bold text-red-800 uppercase mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Zona de Perigo</h2>
          <div className="flex gap-2">
            <input type="month" value={mesParaApagar} onChange={(e) => setMesParaApagar(e.target.value)} className="flex-1 border border-red-300 rounded-lg p-3 text-red-800 font-medium outline-none bg-white focus:ring-2 focus:ring-red-500" />
            <button onClick={apagarMesInteiro} disabled={loading || !mesParaApagar} className="bg-red-600 text-white px-4 font-bold rounded-lg hover:bg-red-700 transition active:scale-[0.97] disabled:opacity-50 shadow-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Apagar</button>
          </div>
        </div>

      </div>
    </div>
  )
}