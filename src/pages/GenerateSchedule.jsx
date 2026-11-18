// src/pages/GenerateSchedule.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useUI } from '../context/UIContext'
import { useIgreja } from '../context/IgrejaContext'
import { enviarNotificacaoEmMassa, enviarNotificacao } from '../utils/notificacoes'
import { TopBar, Button } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { CalendarDays, Wand2, Clock, Plus, Trash2, ListChecks, CalendarRange, AlertTriangle, Palette, Tag, UserMinus, X } from 'lucide-react'
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
      if (equipa.length === 0) throw new Error('Sua equipe está vazia!')

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
      toast.success(listaCultos.length === 1 ? '1 escala gerada em rascunho!' : `${listaCultos.length} escalas geradas em rascunho!`)

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
            titulo:        '📋 Escalas prontas para revisar',
            mensagem:      listaCultos.length === 1
              ? `1 escala de ${departamentoNome} foi gerada em rascunho. Revise e publique.`
              : `${listaCultos.length} escalas de ${departamentoNome} foram geradas em rascunho. Revise e publique.`,
            tipo:          'escala',
            link:          `/dashboard/${departamentoId}`,
          })
        }
      }
      setTimeout(() => navigate(-1), 1500)

    } catch (error) {
      setProgresso({ etapa: 0, texto: '', cultoAtual: 0, cultoTotal: 0 })
      console.error('Erro:', error)
      toast.error('Ocorreu um erro. Tente novamente.')
      setLoading(false)
    }
  }

  // Notifica sobre conflitos de forma AGREGADA:
  //   - 1 push por pessoa em conflito (com todas as datas dela)
  //   - 1 push por líder (resumo das pessoas em conflito que envolvem o dept dele)
  //   - o líder que é a própria pessoa em conflito não recebe o resumo sobre si mesmo
  async function processarConflitos(conflitos, deptAtualId, deptAtualNome) {
    try {
      const fmtData = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

      // Agrupa conflitos por pessoa
      const porPessoa = new Map()
      for (const conf of conflitos) {
        if (!porPessoa.has(conf.userId)) porPessoa.set(conf.userId, [])
        porPessoa.get(conf.userId).push(conf)
      }

      // Para cada pessoa, descobre os OUTROS departamentos envolvidos (1 query por pessoa)
      const resumoPessoas = [] // { userId, datas: ['dd/mm'], outros: Map(deptId|nome → nome) }
      for (const [userId, confs] of porPessoa) {
        const datasIso = [...new Set(confs.map(c => c.data))]
        const { data: outras } = await supabase
          .from('schedule_roles')
          .select('schedules!inner(data, turno, departamento_id, departamentos(nome))')
          .eq('user_id', userId)
          .in('schedules.data', datasIso)
          .neq('schedules.departamento_id', deptAtualId)

        const outros = new Map()
        for (const conf of confs) {
          const outra = outras?.find(o =>
            o.schedules.data === conf.data &&
            (o.schedules.turno === conf.turno || o.schedules.turno === 'Integral')
          )
          if (outra?.schedules?.departamento_id) {
            outros.set(outra.schedules.departamento_id, outra.schedules.departamentos?.nome || 'outro departamento')
          }
        }
        resumoPessoas.push({ userId, datas: datasIso.sort().map(fmtData), outros })
      }

      // Nomes (primeiro nome) das pessoas em conflito — 1 query
      const { data: perfis } = await supabase
        .from('users_profile').select('id, nome').in('id', [...porPessoa.keys()])
      const primeiroNome = id => (perfis?.find(p => p.id === id)?.nome || 'Um membro').split(' ')[0]

      // 1. Um push por PESSOA em conflito
      for (const p of resumoPessoas) {
        const nomesOutros = [...p.outros.values()]
        const outroTxt = nomesOutros.length === 1 ? nomesOutros[0] : 'outro departamento'
        const quando = p.datas.length === 1 ? `Em ${p.datas[0]}` : `Em ${p.datas.length} datas (${p.datas.join(', ')})`
        await enviarNotificacao({
          userId:         p.userId,
          departamentoId: deptAtualId,
          titulo:         '⚠️ Você está em duas escalas',
          mensagem:       `${quando} você está em ${deptAtualNome} e em ${outroTxt} no mesmo turno. Avise um líder.`,
          tipo:           'aviso',
          link:           '/escalas',
        })
      }

      // 2. Um push por LÍDER (dept atual + depts dos outros lados do conflito)
      const deptsOutros = [...new Set(resumoPessoas.flatMap(p => [...p.outros.keys()]))]
      const { data: lideres } = await supabase
        .from('membros_departamentos')
        .select('user_id, departamento_id')
        .in('departamento_id', [deptAtualId, ...deptsOutros])
        .in('role', ['líder', 'admin'])

      // líder → { deptId (para link), pessoas: Set(userId) }
      const porLider = new Map()
      for (const l of lideres || []) {
        const envolvidas = l.departamento_id === deptAtualId
          ? resumoPessoas
          : resumoPessoas.filter(p => p.outros.has(l.departamento_id))
        if (!porLider.has(l.user_id)) {
          porLider.set(l.user_id, { deptId: l.departamento_id, pessoas: new Set() })
        }
        const entrada = porLider.get(l.user_id)
        // Prefere o dept atual como destino do link/departamento da notificação
        if (l.departamento_id === deptAtualId) entrada.deptId = deptAtualId
        for (const p of envolvidas) {
          if (p.userId !== l.user_id) entrada.pessoas.add(p.userId)
        }
      }

      for (const [liderId, { deptId, pessoas }] of porLider) {
        if (pessoas.size === 0) continue
        const ids = [...pessoas]
        let mensagem
        if (ids.length === 1) {
          const p = resumoPessoas.find(r => r.userId === ids[0])
          const quando = p.datas.length === 1 ? `em ${p.datas[0]}` : `em ${p.datas.length} datas`
          mensagem = `${primeiroNome(ids[0])} está em duas escalas no mesmo turno ${quando} (${deptAtualNome}). Revise a escala.`
        } else {
          const nomes = ids.slice(0, 3).map(primeiroNome).join(', ') + (ids.length > 3 ? '…' : '')
          mensagem = `${ids.length} pessoas estão em duas escalas no mesmo turno (${deptAtualNome}): ${nomes}. Revise as escalas.`
        }
        await enviarNotificacao({
          userId:         liderId,
          departamentoId: deptId,
          titulo:         '⚠️ Conflito de escala',
          mensagem,
          tipo:           'aviso',
          link:           `/dashboard/${deptId}`,
        })
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
    <div className="min-h-screen bg-bg pb-[env(safe-area-inset-bottom)]">

      <TopBar
        titulo="Gerar escala do mês"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        <section className="bg-topo p-5 rounded-card text-white">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2">
            <CalendarRange className="w-5 h-5" aria-hidden="true" />
            Mês padrão
          </h2>
          <p className="text-xs text-white/80 mb-4">Adiciona os cultos de sempre para o mês inteiro.</p>
          <div className="flex gap-2">
            <input type="month" aria-label="Mês" value={mesAuto} onChange={(e) => setMesAuto(e.target.value)} className="flex-1 min-w-0 h-11 rounded-ctl px-3 bg-surface text-ink font-medium focus:outline-none focus:ring-2 focus:ring-white" />
            <Button variant="secundario" onClick={preencherMesPadrao} disabled={!mesAuto}>Aplicar</Button>
          </div>
        </section>

        <div className="bg-surface p-6 rounded-xl shadow-sm border border-line">
          <h2 className="text-sm font-bold text-ink uppercase mb-4 flex items-center gap-2">Cultos Extras</h2>
          <form onSubmit={adicionarALista} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-ink-2 mb-1">Data Extra</label>
                <input type="date" required value={dataCulto} onChange={(e) => setDataCulto(e.target.value)} className="w-full border border-line rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-ink-2 mb-1">Turno</label>
                <select value={turnoEscala} onChange={(e) => setTurnoEscala(e.target.value)} className="w-full border border-line rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none bg-surface-2">
                  <option value="Integral">Integral</option>
                  <option value="Manhã">Manhã</option>
                  <option value="Noite">Noite</option>
                </select>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-ink-2 mb-1"><Tag className="w-3.5 h-3.5" /> Nome / Tema do Culto</label>
              <input type="text" placeholder="Ex: Culto de Jovens..." value={tituloCulto} onChange={(e) => setTituloCulto(e.target.value)} className="w-full border border-line rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-brand outline-none" />
            </div>
            <button type="submit" className="w-full bg-brand/10 text-brand border border-brand/30 px-3 py-2.5 rounded-lg hover:bg-brand/10 transition active:scale-[0.97] flex items-center justify-center gap-2 font-bold"><Plus className="w-5 h-5" /> Adicionar Culto</button>
          </form>
        </div>

        {departamentoTipo === 'louvor' && (
          <div className="bg-surface p-6 rounded-xl shadow-sm border border-line">
            <h2 className="text-sm font-bold text-ink uppercase mb-3 flex items-center gap-2"><Palette className="w-5 h-5 text-brand" /> Paletas de cores </h2>
            
            <form onSubmit={adicionarCorPersonalizada} className="flex gap-2 mb-4 border-b border-line pb-4">
              <input type="text" placeholder="Nova cor para a paleta..." value={novaCor} onChange={(e) => setNovaCor(e.target.value)} className="flex-1 border border-line rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-surface-2" />
              <button type="submit" disabled={!novaCor || loading} className="bg-brand text-on-brand px-3 font-bold rounded-lg hover:bg-brand transition active:scale-[0.97] disabled:opacity-50 text-sm">Salvar</button>
            </form>

            <div className="grid grid-cols-2 gap-3 mb-4 max-h-48 overflow-y-auto pr-1">
              {todasCoresRenderizar.map(cor => (
                <label key={cor} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:bg-surface-2 p-1.5 rounded-lg transition">
                  <input type="checkbox" checked={coresSelecionadas.includes(cor)} onChange={(e) => e.target.checked ? setCoresSelecionadas([...coresSelecionadas, cor]) : setCoresSelecionadas(coresSelecionadas.filter(c => c !== cor))} className="w-4 h-4 text-brand border-line rounded focus:ring-brand shrink-0" />
                  <span className="truncate leading-tight">{cor}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface p-6 rounded-xl shadow-sm border border-line">
          <h2 className="text-sm font-bold text-ink uppercase mb-4 flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-danger" /> Membros em Pausa / Off
          </h2>
          <p className="text-xs text-ink-2 mb-4">
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
            className="w-full border border-line rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-danger bg-surface-2 cursor-pointer"
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
                  <div key={id} className="flex items-center gap-1.5 bg-danger-soft border border-danger/30 px-3 py-1.5 rounded-full text-[11px] font-bold text-danger shadow-sm animate-in zoom-in duration-200">
                    <UserMinus className="w-3 h-3 opacity-70" />
                    {m?.nome}
                    <button
                      type="button"
                      onClick={() => setMembrosExcluidos(membrosExcluidos.filter(x => x !== id))}
                      className="ml-1 text-danger hover:text-danger hover:bg-danger-soft rounded-full p-0.5 transition"
                      aria-label={`Tirar ${m?.nome || 'membro'} da pausa`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-surface p-6 rounded-xl shadow-sm border border-line">
          <h2 className="text-sm font-bold text-ink uppercase mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-success" /> Resumo do Mês ({listaCultos.length})</h2>
          {listaCultos.length > 0 && (
            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {listaOrdenada.map((culto) => (
                <div key={culto.id} className="flex justify-between items-center bg-surface-2 p-3 rounded-lg border border-line">
                  <div>
                    <span className="font-bold text-ink text-sm">{formatarDataComDia(culto.data)}</span>
                    <span className="ml-2 bg-line text-ink text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{culto.turno}</span>
                  </div>
                  <button type="button" onClick={() => removerDaLista(culto.id)} aria-label={`Remover culto de ${formatarDataComDia(culto.data)}`} className="text-danger hover:text-danger p-2 rounded-ctl"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          {loading ? (
            <div className="w-full bg-surface border-2 border-success/30 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-success-soft px-5 py-3 border-b border-success/30 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-sm font-bold text-success truncate">{progresso.texto || 'Processando...'}</p>
              </div>
              {progresso.cultoTotal > 0 && (
                <div className="px-5 py-3 border-b border-success/30">
                  <div className="flex justify-between text-xs text-ink-2 mb-1.5 font-medium">
                    <span>Culto {progresso.cultoAtual} de {progresso.cultoTotal}</span>
                    <span>{Math.round((progresso.cultoAtual / progresso.cultoTotal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                    <div className="bg-success h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progresso.cultoAtual / progresso.cultoTotal) * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="px-5 py-3 grid grid-cols-4 gap-2">
                {[{n:1,label:'Equipe'},{n:2,label:'Histórico'},{n:3,label:'Gerando'},{n:4,label:'Notif.'}].map(e => (
                  <div key={e.n} className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      progresso.etapa > e.n  ? 'bg-success text-on-success' :
                      progresso.etapa === e.n ? 'bg-success-soft text-success ring-2 ring-success' :
                      'bg-surface-2 text-muted'}`}>
                      {progresso.etapa > e.n ? '✓' : e.n}
                    </div>
                    <span className={`text-[10px] font-medium text-center ${progresso.etapa >= e.n ? 'text-success' : 'text-muted'}`}>{e.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={gerarEscalasEmLote} disabled={listaCultos.length === 0 || loading}
              className="w-full bg-success text-on-success font-bold py-3.5 rounded-xl hover:bg-success transition active:scale-[0.97] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : <><Wand2 className="w-5 h-5" /> Gerar Escalas de {departamentoNome}</>}
            </button>
          )}
        </div>

        <div className="mt-8 border-2 border-danger/30 bg-danger-soft p-6 rounded-xl">
          <h2 className="text-sm font-bold text-danger uppercase mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Zona de Perigo</h2>
          <div className="flex gap-2">
            <input type="month" aria-label="Mês para apagar" value={mesParaApagar} onChange={(e) => setMesParaApagar(e.target.value)} className="flex-1 min-w-0 border border-danger/30 rounded-lg p-3 text-danger font-medium outline-none bg-surface focus:ring-2 focus:ring-danger" />
            <button onClick={apagarMesInteiro} disabled={loading || !mesParaApagar} className="bg-danger text-on-danger px-4 font-bold rounded-lg hover:bg-danger transition active:scale-[0.97] disabled:opacity-50 shadow-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Apagar</button>
          </div>
        </div>

      </main>
    </div>
  )
}