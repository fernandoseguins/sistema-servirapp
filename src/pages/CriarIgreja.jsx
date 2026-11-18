// src/pages/CriarIgreja.jsx
// Tela EXCLUSIVA do super admin para criar uma nova igreja no sistema.
// Fluxo: dados da igreja → departamentos (modular) → cria tudo + gera código.
//
// Rota sugerida: /criar-igreja (proteger no App.jsx, só super admin)

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../context/UIContext'
import {
  Church, ArrowLeft, ArrowRight, Check, Plus, Trash2, Copy,
  Music, Camera, Baby, Shield, Coffee, HandHeart, Heart, Book,
  Mic, Star, Users, Sparkles, Hand, Cross
} from 'lucide-react'


// Paleta de cores disponível para departamentos personalizados
const PALETA_CORES = [
  { nome: 'Azul',     hex: '#2563eb' },
  { nome: 'Roxo',     hex: '#7c3aed' },
  { nome: 'Rosa',     hex: '#db2777' },
  { nome: 'Vermelho', hex: '#dc2626' },
  { nome: 'Âmbar',    hex: '#f59e0b' },
  { nome: 'Verde',    hex: '#059669' },
  { nome: 'Ciano',    hex: '#0891b2' },
  { nome: 'Grafite',  hex: '#111827' },
  { nome: 'Marsala',  hex: '#7f1d1d' },
  { nome: 'Índigo',   hex: '#4338ca' },
]

// Ícones disponíveis (nome → componente)
const ICONES_DISPONIVEIS = {
  Music, Camera, Baby, Shield, Coffee, HandHeart,
  Heart, Book, Mic, Star, Users, Sparkles, Hand, Cross
}

// Departamentos padrão sugeridos (pré-marcados)
const DEPTS_PADRAO = [
  { nome: 'Louvor',    icone: 'Music',     cor: '#2563eb', tipo: 'louvor' },
  { nome: 'Diaconia',  icone: 'Shield',    cor: '#111827', tipo: 'generico' },
  { nome: 'Infantil',  icone: 'Baby',      cor: '#db2777', tipo: 'infantil' },
  { nome: 'Mídia',     icone: 'Camera',    cor: '#7c3aed', tipo: 'midia' },
  { nome: 'Cantina',   icone: 'Coffee',    cor: '#f59e0b', tipo: 'cantina' },
  { nome: 'Ministros', icone: 'HandHeart', cor: '#7f1d1d', tipo: 'ministros' },
]

// Tipos de departamento disponíveis (define as funcionalidades especiais)
const TIPOS_DEPT = [
  { valor: 'generico',  label: 'Genérico',  desc: 'Escala simples de equipe' },
  { valor: 'louvor',    label: 'Louvor',    desc: 'Repertório e mapa vocal' },
  { valor: 'infantil',  label: 'Infantil',  desc: 'Check-in de crianças e lições' },
  { valor: 'midia',     label: 'Mídia',     desc: 'Cabine e checklist de equipamento' },
  { valor: 'cantina',   label: 'Cantina',   desc: 'Rodízio de departamentos' },
  { valor: 'ministros', label: 'Ministros', desc: 'Funções de ministração' },
]

export default function CriarIgreja() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()

  const [autorizado, setAutorizado] = useState(null) // null = checando
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Dados da igreja
  const [nomeIgreja, setNomeIgreja] = useState('')
  const [corIgreja, setCorIgreja]   = useState('#2563eb')

  // Departamentos selecionados (começa com os padrão marcados)
  const [departamentos, setDepartamentos] = useState(
    DEPTS_PADRAO.map(d => ({ ...d, ativo: true }))
  )

  // Form de departamento personalizado
  const [novoNome, setNovoNome]   = useState('')
  const [novoIcone, setNovoIcone] = useState('Star')
  const [novaCor, setNovaCor]     = useState('#059669')
  const [novoTipo, setNovoTipo]   = useState('generico')

  // Resultado
  const [igrejaCriada, setIgrejaCriada] = useState(null) // { nome, codigo }

  // ── Verifica se é super admin ─────────────────────────────────────
  useEffect(() => {
    async function checar() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: ehSuper } = await supabase.rpc('sou_super_admin_flag')
      setAutorizado(!!user && ehSuper === true)
    }
    checar()
  }, [])

  const toggleDept = (idx) => {
    setDepartamentos(prev => prev.map((d, i) => i === idx ? { ...d, ativo: !d.ativo } : d))
  }

  const removerDept = (idx) => {
    setDepartamentos(prev => prev.filter((_, i) => i !== idx))
  }

  const adicionarDeptPersonalizado = () => {
    if (!novoNome.trim()) {
      toast.warning('Digite o nome do departamento.')
      return
    }
    if (departamentos.some(d => d.nome.toLowerCase() === novoNome.trim().toLowerCase())) {
      toast.warning('Já existe um departamento com esse nome.')
      return
    }
    setDepartamentos(prev => [...prev, {
      nome: novoNome.trim(), icone: novoIcone, cor: novaCor, tipo: novoTipo, ativo: true, personalizado: true
    }])
    setNovoNome(''); setNovoIcone('Star'); setNovaCor('#059669')
    toast.success('Departamento adicionado!')
  }

  // ── Cria a igreja + departamentos ─────────────────────────────────
  async function criarIgreja() {
    if (!nomeIgreja.trim()) {
      toast.warning('Digite o nome da igreja.')
      setStep(1)
      return
    }
    const deptsAtivos = departamentos.filter(d => d.ativo)
    if (deptsAtivos.length === 0) {
      toast.warning('Selecione pelo menos um departamento.')
      return
    }

    setLoading(true)
    try {
      // 1. Gera código de convite único
      const { data: codigo, error: erroCodigo } = await supabase.rpc('gerar_codigo_convite')
      if (erroCodigo) throw erroCodigo

      // 2. Cria a igreja + departamentos numa ÚNICA transação (tudo ou nada)
      const slug = nomeIgreja.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const slugFinal = slug + '-' + Date.now().toString(36).slice(-4)

      // Monta a lista de departamentos para a função transacional
      const deptsParaCriar = deptsAtivos.map(d => ({
        nome: d.nome,
        cor: d.personalizado ? d.cor : '',
        icone: d.personalizado ? d.icone : '',
        tipo: d.tipo || 'generico'
      }))

      // Chama a função transacional: se algo falhar, NADA é criado (rollback)
      const { data: novaIgrejaId, error: erroIgreja } = await supabase.rpc('criar_igreja_completa', {
        p_nome: nomeIgreja.trim(),
        p_slug: slugFinal,
        p_cor: corIgreja,
        p_codigo: codigo,
        p_departamentos: deptsParaCriar
      })
      if (erroIgreja) throw erroIgreja

      // 4. Sucesso!
      setIgrejaCriada({ nome: nomeIgreja.trim(), codigo })
      setStep(3)
      toast.success('Igreja criada com sucesso!')

    } catch (error) {
      (() => { console.error('Erro ao criar igreja:', error); toast.error('Não foi possível criar a igreja. Tente novamente.') })()
    } finally {
      setLoading(false)
    }
  }

  const copiarCodigo = () => {
    navigator.clipboard.writeText(igrejaCriada.codigo)
    toast.success('Código copiado!')
  }

  // ── Renderização do ícone ─────────────────────────────────────────
  const renderIcone = (nomeIcone, className = 'w-5 h-5') => {
    const Ic = ICONES_DISPONIVEIS[nomeIcone] || Star
    return <Ic className={className} />
  }

  // ── Guards ────────────────────────────────────────────────────────
  if (autorizado === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <Shield className="w-16 h-16 text-muted mb-4" />
        <h1 className="text-xl font-bold text-ink mb-2">Acesso restrito</h1>
        <p className="text-ink-2 mb-6">Esta página é exclusiva do administrador do sistema.</p>
        <button onClick={() => navigate('/hub')} className="bg-brand text-on-brand font-bold rounded-xl py-3 px-8 hover:bg-brand transition">
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg p-4 pb-20">
      <div className="max-w-2xl mx-auto pt-6">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => navigate('/hub')} aria-label="Voltar" className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <ArrowLeft className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <Church className="w-6 h-6 text-brand" aria-hidden="true" />
            <h1 className="text-xl font-bold text-ink">Criar nova igreja</h1>
          </div>
        </div>

        {/* Indicador de passos */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-6" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} aria-label={`Passo ${step} de 2`}>
            {[1, 2].map(n => (
              <div key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-brand' : 'bg-line'}`} />
            ))}
          </div>
        )}

        {/* ── PASSO 1: Dados da igreja ── */}
        {step === 1 && (
          <div className="bg-surface rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-ink mb-1">Dados da Igreja</h2>
            <p className="text-sm text-ink-2 mb-5">Informações básicas da nova igreja.</p>

            <label className="block text-sm font-bold text-ink mb-2">Nome da Igreja</label>
            <input
              type="text"
              value={nomeIgreja}
              onChange={e => setNomeIgreja(e.target.value)}
              placeholder="Ex: Igreja Verbo da Vida Centro"
              className="w-full bg-surface-2 border border-line rounded-xl py-3 px-4 mb-5 focus:ring-2 focus:ring-brand outline-none"
            />

            <label className="block text-sm font-bold text-ink mb-2">Cor principal</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {PALETA_CORES.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setCorIgreja(c.hex)}
                  className={`w-10 h-10 rounded-xl transition ${corIgreja === c.hex ? 'ring-2 ring-offset-2 ring-brand scale-110' : ''}`}
                  style={{ background: c.hex }}
                  title={c.nome}
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (!nomeIgreja.trim()) { toast.warning('Digite o nome da igreja.'); return }
                setStep(2)
              }}
              className="w-full bg-brand text-on-brand font-bold rounded-xl py-3.5 hover:bg-brand transition flex justify-center items-center gap-2"
            >
              Continuar <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── PASSO 2: Departamentos ── */}
        {step === 2 && (
          <div className="bg-surface rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-ink mb-1">Departamentos</h2>
            <p className="text-sm text-ink-2 mb-5">Marque os que essa igreja terá. Pode criar personalizados também.</p>

            {/* Lista de departamentos */}
            <div className="space-y-2 mb-5">
              {departamentos.map((d, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${d.ativo ? 'border-brand/30 bg-brand/10' : 'border-line bg-surface-2 opacity-60'}`}
                >
                  <button onClick={() => toggleDept(idx)} className="flex items-center gap-3 flex-1">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                      style={{ background: d.cor }}
                    >
                      {renderIcone(d.icone, 'w-5 h-5')}
                    </div>
                    <span className="font-bold text-ink">{d.nome}</span>
                    {d.personalizado && <span className="text-[10px] bg-success-soft text-success px-2 py-0.5 rounded-full font-bold">PERSONALIZADO</span>}
                  </button>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${d.ativo ? 'bg-brand border-brand' : 'bg-surface border-line'}`}>
                      {d.ativo && <Check className="w-3.5 h-3.5 text-on-brand" aria-hidden="true" />}
                    </div>
                    {d.personalizado && (
                      <button onClick={() => removerDept(idx)} className="p-1 text-muted hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Criar departamento personalizado */}
            <div className="border-2 border-dashed border-line rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Criar departamento personalizado
              </h3>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome (ex: Intercessão, Recepção...)"
                className="w-full bg-surface-2 border border-line rounded-lg py-2.5 px-3 mb-3 text-sm focus:ring-2 focus:ring-brand outline-none"
              />

              <p className="text-xs font-bold text-ink-2 mb-2">Tipo (define as funcionalidades):</p>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {TIPOS_DEPT.map(t => (
                  <button
                    key={t.valor}
                    onClick={() => setNovoTipo(t.valor)}
                    className={`text-left p-2.5 rounded-lg border-2 transition ${novoTipo === t.valor ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:border-line'}`}
                  >
                    <p className={`text-xs font-bold ${novoTipo === t.valor ? 'text-brand' : 'text-ink'}`}>{t.label}</p>
                    <p className="text-[10px] text-muted leading-tight mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-ink-2 mb-2">Ícone:</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.keys(ICONES_DISPONIVEIS).map(nome => (
                  <button
                    key={nome}
                    onClick={() => setNovoIcone(nome)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${novoIcone === nome ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-2 hover:bg-line'}`}
                  >
                    {renderIcone(nome, 'w-4 h-4')}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-ink-2 mb-2">Cor:</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PALETA_CORES.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setNovaCor(c.hex)}
                    className={`w-8 h-8 rounded-lg transition ${novaCor === c.hex ? 'ring-2 ring-offset-1 ring-brand' : ''}`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>

              <button
                onClick={adicionarDeptPersonalizado}
                className="w-full bg-brand text-on-brand font-bold rounded-lg py-2.5 text-sm hover:bg-brand transition active:scale-[0.97]"
              >
                Adicionar Departamento
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="p-3.5 bg-surface-2 text-ink-2 rounded-xl hover:bg-line">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={criarIgreja}
                disabled={loading}
                className="flex-1 bg-success text-on-success font-bold rounded-xl py-3.5 hover:bg-success transition active:scale-[0.97] disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar Igreja'}
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 3: Sucesso ── */}
        {step === 3 && igrejaCriada && (
          <div className="bg-surface rounded-2xl p-6 shadow-sm text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-ink mb-1">Igreja criada! 🎉</h2>
            <p className="text-ink-2 mb-6">"{igrejaCriada.nome}" está pronta no sistema.</p>

            <div className="bg-brand/10 rounded-xl p-5 mb-6">
              <p className="text-sm font-bold text-ink-2 mb-2">Código de convite</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-bold tracking-widest text-brand">{igrejaCriada.codigo}</span>
                <button onClick={copiarCodigo} className="p-2 bg-surface rounded-lg hover:bg-surface-2 transition active:scale-[0.97]">
                  <Copy className="w-5 h-5 text-ink-2" />
                </button>
              </div>
              <p className="text-xs text-ink-2 mt-3">
                Passe este código ao líder da igreja. O primeiro a se cadastrar com ele vira administrador.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setStep(1); setNomeIgreja(''); setCorIgreja('#2563eb')
                  setDepartamentos(DEPTS_PADRAO.map(d => ({ ...d, ativo: true }))); setNovoTipo('generico')
                  setIgrejaCriada(null)
                }}
                className="w-full bg-brand text-on-brand font-bold rounded-xl py-3 hover:bg-brand transition"
              >
                Criar outra igreja
              </button>
              <button onClick={() => navigate('/hub')} className="w-full bg-surface-2 text-ink-2 font-bold rounded-xl py-3 hover:bg-line transition">
                Voltar ao início
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}