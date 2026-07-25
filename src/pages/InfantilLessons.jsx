// src/pages/InfantilLessons.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react'
import { useUI } from '../context/UIContext'
import PageHeader from '../components/PageHeader'

export default function InfantilLessons() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { toast, confirm } = useUI()

  const departamentoId   = location.state?.departamentoId
  const departamentoNome = location.state?.departamentoNome
  const userRole         = location.state?.userRole
  const isLiderOuAdmin   = userRole === 'admin' || userRole === 'líder'

  const [licoes,   setLicoes]   = useState([])
  const [titulo,   setTitulo]   = useState('')
  const [link,     setLink]     = useState('')
  const [loading,  setLoading]  = useState(true)

  const theme = {
    bgPrimary: 'bg-pink-500', textPrimary: 'text-pink-500',
    bgLight: 'bg-pink-50', borderLight: 'border-pink-200',
    btnHover: 'hover:bg-pink-600', textLight: 'text-pink-100'
  }

  useEffect(() => {
    if (!departamentoId) { navigate('/hub'); return }
    buscarLicoes()
  }, [departamentoId])

  async function buscarLicoes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('lessons').select('*')
      .eq('departamento_id', departamentoId)
      .order('created_at', { ascending: false })
    if (!error && data) setLicoes(data)
    setLoading(false)
  }

  async function adicionarLicao(e) {
    e.preventDefault()
    if (!titulo || !link) return
    setLoading(true)
    let linkFinal = link
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      linkFinal = 'https://' + link
    }
    const { error } = await supabase.from('lessons').insert([
      { departamento_id: departamentoId, titulo, link: linkFinal }
    ])
    if (error) toast.error('Erro ao adicionar lição.')
    else {
      toast.success('Lição adicionada com sucesso!')
      setTitulo(''); setLink('')
      buscarLicoes()
    }
    setLoading(false)
  }

  async function removerLicao(id, tituloLicao) {
    if (!await confirm({
      title: `Apagar "${tituloLicao}"?`,
      message: 'Este material será removido permanentemente.',
      danger: true, labelOk: 'Apagar', labelCancel: 'Cancelar'
    })) return
    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (!error) { buscarLicoes(); toast.info('Material removido.') }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      <PageHeader
        title="Lições e Materiais"
        subtitle="Acesso rápido aos materiais da aula"
        icon={<BookOpen className="w-5 h-5" />}
        color={theme.bgPrimary}
      />

      <div className="max-w-md mx-auto px-4 space-y-6">

        {/* PAINEL DO LÍDER */}
        {isLiderOuAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className={`text-sm font-bold uppercase mb-4 flex items-center gap-2 ${theme.textPrimary}`}>
              <Plus className="w-5 h-5" /> Adicionar Link do Drive
            </h2>
            <form onSubmit={adicionarLicao} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Título da Lição</label>
                <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> Link do Google Drive / PDF
                </label>
                <input type="text" required value={link} onChange={e => setLink(e.target.value)}
                  placeholder="Cole o link aqui..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none bg-gray-50" />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full text-white font-bold py-3.5 rounded-xl transition active:scale-[0.97] flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50 ${theme.bgPrimary} ${theme.btnHover}`}>
                {loading ? 'Salvando...' : 'Salvar Material'}
              </button>
            </form>
          </div>
        )}

        {/* LISTA DE LIÇÕES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase mb-4">Materiais Disponíveis</h2>

          {loading && licoes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 font-bold animate-pulse">A procurar na pasta...</p>
          ) : licoes.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Nenhum material adicionado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {licoes.map(licao => (
                <div key={licao.id} className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-pink-50 hover:border-pink-200 transition group">
                  <a href={licao.link} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-pink-100 text-pink-600 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-800 text-sm truncate">{licao.titulo}</p>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 font-medium mt-0.5">
                        <ExternalLink className="w-3 h-3" /> Clique para abrir
                      </p>
                    </div>
                  </a>
                  {isLiderOuAdmin && (
                    <button onClick={() => removerLicao(licao.id, licao.titulo)}
                      aria-label="Apagar lição"
                      className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
