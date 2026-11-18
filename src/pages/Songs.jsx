// src/pages/Songs.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { urlSegura } from '../utils/url'
import { useUI } from '../context/UIContext'
import { TopBar, Button, Card, Pill, Input, Select, Sheet, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { useNavigate, useLocation } from 'react-router-dom'
import { Music, Plus, Search, Trash2, Edit2, PlayCircle, Mic2, FileSpreadsheet, Flame, Heart, FileText, ChevronDown } from 'lucide-react'

export default function Songs() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const userRole = location.state?.userRole

  const isLiderOuAdmin = userRole === 'admin' || userRole === 'líder'

  const [musicas, setMusicas] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  // ✅ ESTADOS DO EFEITO SANFONA (Começam abertos por padrão)
  const [mostrarCelebracao, setMostrarCelebracao] = useState(true)
  const [mostrarAdoracao, setMostrarAdoracao] = useState(true)
  const [mostrarOutras, setMostrarOutras] = useState(true)

  // Modais
  const [modalAberto, setModalAberto] = useState(false)
  const [modalImportAberto, setModalImportAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  
  // Dados do Formulário Único
  const [titulo, setTitulo] = useState('')
  const [artista, setArtista] = useState('')
  const [tom, setTom] = useState('')
  const [bpm, setBpm] = useState('')
  const [link, setLink] = useState('')
  const [linkCifra, setLinkCifra] = useState('') 
  const [categoria, setCategoria] = useState('Adoração')

  // Dados da Importação em Lote
  const [textoImportacao, setTextoImportacao] = useState('')
  const [processandoLote, setProcessandoLote] = useState(false)

  useEffect(() => {
    if (!departamentoId) {
      navigate('/hub')
      return
    }
    buscarMusicas()
  }, [departamentoId])

  async function buscarMusicas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('departamento_id', departamentoId)
      .order('titulo', { ascending: true })

    if (!error && data) setMusicas(data)
    setLoading(false)
  }

  // --- FUNÇÕES DA MÚSICA INDIVIDUAL ---
  function abrirModal(musica = null) {
    if (musica) {
      setEditandoId(musica.id)
      setTitulo(musica.titulo)
      setArtista(musica.artista || '')
      setTom(musica.tom || '')
      setBpm(musica.bpm || '')
      setLink(musica.link_youtube || '')
      setLinkCifra(musica.link_cifra || '') 
      setCategoria(musica.categoria || 'Adoração')
    } else {
      setEditandoId(null)
      setTitulo(''); setArtista(''); setTom(''); setBpm(''); setLink(''); setLinkCifra(''); setCategoria('Adoração')
    }
    setModalAberto(true)
  }

  async function salvarMusica(e) {
    e.preventDefault()
    setLoading(true)
    
    const dadosMusica = { departamento_id: departamentoId, titulo, artista, tom, bpm, link_youtube: link, link_cifra: linkCifra, categoria }
    let error;

    if (editandoId) {
      const res = await supabase.from('songs').update(dadosMusica).eq('id', editandoId)
      error = res.error
    } else {
      const res = await supabase.from('songs').insert([dadosMusica])
      error = res.error
    }

    if (error) toast.error('Erro ao salvar música.')
    else {
      toast.success('Música salva.')
      setModalAberto(false)
      buscarMusicas()
    }
    setLoading(false)
  }

  async function apagarMusica(id, nomeMusica) {
    if (!await confirm({ title: `Apagar "${nomeMusica}"?`, message: 'A música sai do repertório deste departamento.', danger: true, labelOk: 'Apagar', labelCancel: 'Cancelar' })) return
    const { error } = await supabase.from('songs').delete().eq('id', id)
    if (!error) buscarMusicas()
  }

  // --- A MAGIA DA IMPORTAÇÃO EM LOTE ---
  async function processarImportacao(e) {
    e.preventDefault()
    if (!textoImportacao.trim()) return

    setProcessandoLote(true)
    toast.info('Processando as músicas...')

    try {
      const linhas = textoImportacao.split('\n')
      const musicasParaInserir = []

      linhas.forEach(linha => {
        const colunas = linha.split('\t') 
        
        const tit = colunas[0]?.trim()
        const art = colunas[1]?.trim() || null
        let cat = colunas[2]?.trim() || 'Adoração' 

        if (cat.toLowerCase().includes('celeb')) cat = 'Celebração'
        else if (cat.toLowerCase().includes('ador')) cat = 'Adoração'

        if (tit) {
          musicasParaInserir.push({
            departamento_id: departamentoId,
            titulo: tit,
            artista: art,
            categoria: cat, 
            tom: null, 
            bpm: null,
            link_youtube: null,
            link_cifra: null
          })
        }
      })

      if (musicasParaInserir.length === 0) {
        throw new Error('Não consegui identificar nenhuma música no texto colado.')
      }

      const { error } = await supabase.from('songs').insert(musicasParaInserir)
      if (error) throw error

      toast.success(`${musicasParaInserir.length} músicas adicionadas ao repertório!`)
      setModalImportAberto(false)
      setTextoImportacao('')
      buscarMusicas()

    } catch (error) {
      (() => { console.error('Erro na importação:', error); toast.error('Erro na importação. Tente novamente.') })()
    } finally {
      setProcessandoLote(false)
    }
  }

  // ✅ FILTRAGEM E SEPARAÇÃO DE MÚSICAS
  // ✅ useMemo — só recalcula quando 'musicas' ou 'busca' mudam
  const musicasFiltradas = useMemo(() =>
    musicas.filter(m =>
      m.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (m.artista && m.artista.toLowerCase().includes(busca.toLowerCase()))
    ),
    [musicas, busca]
  )

  const celebracao   = useMemo(() => musicasFiltradas.filter(m => m.categoria === 'Celebração'),  [musicasFiltradas])
  const adoracao     = useMemo(() => musicasFiltradas.filter(m => m.categoria === 'Adoração'),    [musicasFiltradas])
  const semCategoria = useMemo(() => musicasFiltradas.filter(m => m.categoria !== 'Celebração' && m.categoria !== 'Adoração'), [musicasFiltradas])

  const mochila = { state: { departamentoId, departamentoNome, userRole } }

  // ✅ LINHA DA MÚSICA
  const RenderMusicCard = ({ musica }) => (
    <li className="py-3 border-b border-line last:border-b-0">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink text-sm leading-tight">{musica.titulo}</p>
          {musica.artista && (
            <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-1">
              <Mic2 className="w-3 h-3" aria-hidden="true" /> {musica.artista}
            </p>
          )}
        </div>
        {musica.tom && <Pill tom="brand">Tom {musica.tom}</Pill>}
        {isLiderOuAdmin && (
          <div className="flex shrink-0 -mr-1">
            <button type="button" onClick={() => abrirModal(musica)} aria-label={`Editar ${musica.titulo}`}
              className="p-1.5 text-ink-2 hover:text-brand hover:bg-surface-2 rounded-ctl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Edit2 className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => apagarMusica(musica.id, musica.titulo)} aria-label={`Apagar ${musica.titulo}`}
              className="p-1.5 text-ink-2 hover:text-danger hover:bg-danger-soft rounded-ctl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {(musica.link_cifra || musica.link_youtube) && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {musica.link_cifra && (
            <a href={urlSegura(musica.link_cifra)} target="_blank" rel="noopener noreferrer" aria-label={`Cifra de ${musica.titulo} (abre em nova aba)`}
              className="flex items-center gap-1 text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Cifra
            </a>
          )}
          {musica.link_youtube && (
            <a href={urlSegura(musica.link_youtube)} target="_blank" rel="noopener noreferrer" aria-label={`Ouvir ${musica.titulo} (abre em nova aba)`}
              className="flex items-center gap-1 text-xs font-semibold text-accent-ink bg-accent/15 hover:bg-accent/25 px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" /> Ouvir
            </a>
          )}
        </div>
      )}
    </li>
  )

  const Bloco = ({ id, icone, titulo, lista, aberto, alternar }) => lista.length > 0 && (
    <Card padded={false} className="overflow-hidden">
      <h2>
        <button type="button" onClick={alternar} aria-expanded={aberto} aria-controls={`bloco-${id}`}
          className="w-full flex justify-between items-center px-4 py-3 hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
          <span className="text-sm font-bold text-ink flex items-center gap-2">{icone} {titulo} <Pill>{lista.length}</Pill></span>
          <ChevronDown className={`w-5 h-5 text-ink-2 transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      {aberto && (
        <ul id={`bloco-${id}`} className="px-4 border-t border-line">
          {lista.map(musica => <RenderMusicCard key={musica.id} musica={musica} />)}
        </ul>
      )}
    </Card>
  )

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        titulo="Músicas"
        subtitulo={departamentoNome}
        onVoltar={() => navigate(-1, mochila)}
        icone={<span className={`w-10 h-10 rounded-ctl flex items-center justify-center ${classesDept(departamentoNome).chip}`}>
          <IconeDept nome={departamentoNome} className="w-5 h-5" />
        </span>}
      />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">

        {isLiderOuAdmin && (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => abrirModal()} icon={<Plus className="w-4 h-4" aria-hidden="true" />}>
              Adicionar
            </Button>
            <Button variant="secundario" className="flex-1" onClick={() => setModalImportAberto(true)} icon={<FileSpreadsheet className="w-4 h-4" aria-hidden="true" />}>
              Importar Excel
            </Button>
          </div>
        )}

        <Input
          type="search"
          aria-label="Buscar música"
          placeholder="Buscar por título ou artista"
          icon={<Search className="w-4 h-4" aria-hidden="true" />}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {loading && musicas.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-2 rounded-card animate-pulse" />)}
          </div>
        ) : musicasFiltradas.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Music className="w-6 h-6" aria-hidden="true" />}
              titulo={busca ? `Nenhuma música para "${busca}"` : 'Nenhuma música ainda'}
              texto={busca ? 'Tente outro termo.' : (isLiderOuAdmin ? 'Adicione músicas para montar o repertório.' : 'O líder ainda não cadastrou músicas.')}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <Bloco id="celebracao" icone={<Flame className="w-5 h-5 text-accent-ink" aria-hidden="true" />} titulo="Celebração"
              lista={celebracao} aberto={mostrarCelebracao} alternar={() => setMostrarCelebracao(!mostrarCelebracao)} />
            <Bloco id="adoracao" icone={<Heart className="w-5 h-5 text-brand" aria-hidden="true" />} titulo="Adoração"
              lista={adoracao} aberto={mostrarAdoracao} alternar={() => setMostrarAdoracao(!mostrarAdoracao)} />
            <Bloco id="outras" icone={<Music className="w-5 h-5 text-ink-2" aria-hidden="true" />} titulo="Outras"
              lista={semCategoria} aberto={mostrarOutras} alternar={() => setMostrarOutras(!mostrarOutras)} />
          </div>
        )}
      </main>

      {/* IMPORTAÇÃO DO EXCEL */}
      <Sheet aberto={modalImportAberto} onFechar={() => { setModalImportAberto(false); setTextoImportacao('') }} titulo="Importar do Excel">
        <ol className="bg-surface-2 p-3 rounded-ctl mb-4 text-ink-2 text-xs space-y-1.5 list-decimal list-inside">
          <li>Abra a planilha no Excel.</li>
          <li>Organize em 3 colunas: <strong className="text-ink">Título | Artista | Categoria</strong> (Celebração ou Adoração).</li>
          <li>Selecione as células, copie (Ctrl+C) e cole (Ctrl+V) abaixo.</li>
        </ol>
        <form onSubmit={processarImportacao} className="space-y-4">
          <textarea
            required placeholder="Cole aqui as colunas do Excel" rows="6" aria-label="Colunas copiadas do Excel"
            value={textoImportacao} onChange={(e) => setTextoImportacao(e.target.value)}
            className="w-full rounded-ctl bg-surface border border-line p-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none whitespace-pre"
          />
          <div className="flex gap-2">
            <Button variant="secundario" className="flex-1" onClick={() => { setModalImportAberto(false); setTextoImportacao('') }}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={processandoLote}>{processandoLote ? 'Importando...' : 'Importar tudo'}</Button>
          </div>
        </form>
      </Sheet>

      {/* CRIAR/EDITAR MÚSICA */}
      <Sheet aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editandoId ? 'Editar música' : 'Nova música'}>
        <form onSubmit={salvarMusica} className="space-y-3">
          <Input label="Título *" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Artista / versão" value={artista} onChange={(e) => setArtista(e.target.value)} placeholder="Ex: Morada" />
            <Select label="Categoria *" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              options={[{ value: 'Adoração', label: 'Adoração' }, { value: 'Celebração', label: 'Celebração' }]} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Tom" value={tom} onChange={(e) => setTom(e.target.value)} placeholder="Ex: G, C#m" />
            <Input label="BPM (opcional)" type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="Ex: 72" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Link para ouvir" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="YouTube, Spotify" />
            <Input label="Link da cifra" type="url" value={linkCifra} onChange={(e) => setLinkCifra(e.target.value)} placeholder="Cifra Club" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secundario" className="flex-1" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={loading}>Salvar</Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
