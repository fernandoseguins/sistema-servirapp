// src/pages/Songs.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { urlSegura } from '../utils/url'
import { useUI } from '../context/UIContext'
import { getDeptTheme } from '../utils/departmentThemes'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Music, Plus, Search, Trash2, Edit2, PlayCircle, Mic2, FileSpreadsheet, Flame, Heart, FileText, ChevronDown } from 'lucide-react'

export default function Songs() {
  const navigate = useNavigate()
  const { toast, confirm } = useUI()
  const location = useLocation()
  
  const departamentoId = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const [departamentoCor, setDepartamentoCor] = useState(null)
  const theme = getDeptTheme(departamentoNome || '', departamentoCor)
  const pers = theme.personalizado
  const userRole = location.state?.userRole

  // Busca a cor/ícone do departamento (para temas personalizados)
  useEffect(() => {
    if (!departamentoId) return
    supabase.from('departamentos').select('cor, icone').eq('id', departamentoId).single()
      .then(({ data }) => { if (data) setDepartamentoCor(data.cor) })
  }, [departamentoId])

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
      toast.success('Repertório atualizado!')
      setModalAberto(false)
      buscarMusicas()
    }
    setLoading(false)
  }

  async function apagarMusica(id, nomeMusica) {
    if (!await confirm({ title: 'Confirmar ação', labelOk: 'Confirmar', labelCancel: 'Cancelar' })) return
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

  // ✅ CARD DA MÚSICA
  const RenderMusicCard = ({ musica }) => (
    <div key={musica.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 pr-2">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{musica.titulo}</h3>
          {musica.artista && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Mic2 className="w-3 h-3" /> {musica.artista}
            </p>
          )}
        </div>
        
        {isLiderOuAdmin && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => abrirModal(musica)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => apagarMusica(musica.id, musica.titulo)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {(musica.link_cifra || musica.link_youtube) && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          
          {musica.link_cifra && (
            <a href={urlSegura(musica.link_cifra)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
              <FileText className="w-3.5 h-3.5" /> Cifra
            </a>
          )}

          {musica.link_youtube && (
            <a href={urlSegura(musica.link_youtube)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition ml-auto">
              <PlayCircle className="w-3.5 h-3.5" /> Ouvir
            </a>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      
      <PageHeader
        bg={pers ? theme.hexValue : theme.bgPrimary}
        icon={<Music className="w-5 h-5" />}
        title="Repertório"
        subtitle={`Lista de músicas — ${departamentoNome}`}
        onBack={() => navigate(-1, mochila)}
      />

      <div className="max-w-md mx-auto px-4 space-y-4">

        {/* FERRAMENTAS DO LÍDER */}
        {isLiderOuAdmin && (
          <div className="flex gap-2 mb-2">
            <button onClick={() => abrirModal()} className="flex-1 bg-white border border-gray-200 text-blue-600 font-bold py-3 rounded-2xl shadow-sm hover:bg-blue-50 transition flex justify-center items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Adicionar 1
            </button>
            <button onClick={() => setModalImportAberto(true)} className="flex-1 bg-white border border-green-200 text-green-600 font-bold py-3 rounded-2xl shadow-sm hover:bg-green-50 transition flex justify-center items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Importar Excel
            </button>
          </div>
        )}

        {/* BARRA DE PESQUISA */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input 
            type="text" placeholder="Buscar por título ou artista..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-white border border-gray-200 text-gray-900 rounded-2xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" 
          />
        </div>


        {/* LISTA DE MÚSICAS SEPARADA POR CATEGORIA */}
        {loading && musicas.length === 0 ? (
          <p className="text-center py-10 text-gray-400 font-bold animate-pulse">A carregar repertório...</p>
        ) : musicasFiltradas.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Music className="w-6 h-6" />}
              title={busca ? `Nenhuma música para "${busca}"` : "Repertório vazio"}
              subtitle={busca ? "Tente outro termo de busca." : "Adicione músicas para começar a construir o repertório."}
            />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            
            {/* BLOCO CELEBRAÇÃO */}
            {celebracao.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setMostrarCelebracao(!mostrarCelebracao)}
                  className="w-full flex justify-between items-center p-4 bg-orange-50 hover:bg-orange-100 transition"
                >
                  <h2 className="text-sm font-bold text-orange-600 uppercase flex items-center gap-2">
                    <Flame className="w-5 h-5" /> Celebração ({celebracao.length})
                  </h2>
                  <ChevronDown className={`w-5 h-5 text-orange-600 transition-transform duration-300 ${mostrarCelebracao ? 'rotate-180' : ''}`} />
                </button>
                
                {mostrarCelebracao && (
                  <div className="p-3 space-y-3 bg-gray-50 border-t border-gray-100">
                    {celebracao.map(musica => <RenderMusicCard key={musica.id} musica={musica} />)}
                  </div>
                )}
              </div>
            )}

            {/* BLOCO ADORAÇÃO */}
            {adoracao.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setMostrarAdoracao(!mostrarAdoracao)}
                  className="w-full flex justify-between items-center p-4 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <h2 className="text-sm font-bold text-blue-600 uppercase flex items-center gap-2">
                    <Heart className="w-5 h-5" /> Adoração ({adoracao.length})
                  </h2>
                  <ChevronDown className={`w-5 h-5 text-blue-600 transition-transform duration-300 ${mostrarAdoracao ? 'rotate-180' : ''}`} />
                </button>
                
                {mostrarAdoracao && (
                  <div className="p-3 space-y-3 bg-gray-50 border-t border-gray-100">
                    {adoracao.map(musica => <RenderMusicCard key={musica.id} musica={musica} />)}
                  </div>
                )}
              </div>
            )}

            {/* BLOCO SEM CATEGORIA */}
            {semCategoria.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setMostrarOutras(!mostrarOutras)}
                  className="w-full flex justify-between items-center p-4 bg-gray-100 hover:bg-gray-200 transition"
                >
                  <h2 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-2">
                    Outras / Sem Categoria ({semCategoria.length})
                  </h2>
                  <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${mostrarOutras ? 'rotate-180' : ''}`} />
                </button>
                
                {mostrarOutras && (
                  <div className="p-3 space-y-3 bg-gray-50 border-t border-gray-100">
                    {semCategoria.map(musica => <RenderMusicCard key={musica.id} musica={musica} />)}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL DE IMPORTAÇÃO MÁGICA (EXCEL) */}
      {modalImportAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" /> Importação Mágica
            </h2>
            
            <div className="bg-green-50 border border-green-200 p-3 rounded-xl mb-4 text-green-800 text-xs font-medium space-y-2">
              <p>1. Abra o seu ficheiro de Excel.</p>
              <p>2. Organize em 3 colunas: <strong className="font-bold">Título | Artista | Categoria</strong></p>
              <p className="text-[10px] text-green-600 italic">* Categorias aceites: Celebração ou Adoração</p>
              <p>3. Selecione as células, faça <b>CTRL+C</b> (copiar) e <b>CTRL+V</b> (colar) na caixa abaixo!</p>
            </div>
            
            <form onSubmit={processarImportacao} className="space-y-4">
              <textarea 
                required placeholder="Cole aqui as colunas do Excel..." rows="6"
                value={textoImportacao} onChange={(e) => setTextoImportacao(e.target.value)} 
                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 resize-none whitespace-pre" 
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => {setModalImportAberto(false); setTextoImportacao('')}} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition">Cancelar</button>
                <button type="submit" disabled={processandoLote} className="flex-1 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition active:scale-[0.97] shadow-md disabled:opacity-50 flex justify-center gap-2">
                  {processandoLote ? 'Importando...' : 'Importar Tudo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAR/EDITAR (MÚSICA ÚNICA) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-600" />
                {editandoId ? 'Editar Música' : 'Nova Música'}
              </h2>
            </div>
            <form onSubmit={salvarMusica} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Título *</label>
                <input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Artista / Versão</label>
                  <input type="text" value={artista} onChange={(e) => setArtista(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500" placeholder="Ex: Morada" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Categoria *</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500">
                    <option value="Adoração">Adoração</option>
                    <option value="Celebração">Celebração</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tom</label>
                  <input type="text" value={tom} onChange={(e) => setTom(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500" placeholder="Ex: G, C#m..." />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">BPM (Opcional)</label>
                  <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500" placeholder="Ex: 72" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Link (Ouvir)</label>
                  <input type="url" value={link} onChange={(e) => setLink(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 text-red-600 focus:ring-2 focus:ring-blue-500" placeholder="YouTube, Spotify..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Link (Cifra)</label>
                  <input type="url" value={linkCifra} onChange={(e) => setLinkCifra(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none bg-gray-50 text-blue-600 focus:ring-2 focus:ring-blue-500" placeholder="Cifra Club..." />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalAberto(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition active:scale-[0.97] shadow-md disabled:opacity-50">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}