// src/pages/Avisos.jsx — aba Avisos
// Notificações do usuário (hook compartilhado) + mural dos departamentos dele.
// Editar/apagar avisos continua no mural de cada departamento.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, Megaphone, Trash2, AlertTriangle, CheckCheck } from 'lucide-react'
import { supabase } from '../supabase'
import { useNotificacoes } from '../hooks/useNotificacoes'
import { TopBar, Card, Pill, Button, EmptyState } from '../components/ui'

function quando(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function Avisos() {
  const navigate = useNavigate()
  const { notificacoes, naoLidas, carregando, abrir, apagar, marcarTodasLidas } = useNotificacoes()
  const [mural, setMural] = useState([])
  const [carregandoMural, setCarregandoMural] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregarMural() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: vinculos } = await supabase.from('membros_departamentos').select('departamento_id').eq('user_id', user.id)
      const ids = (vinculos || []).map(v => v.departamento_id)
      if (ids.length) {
        const { data } = await supabase
          .from('notices')
          .select('id, titulo, conteudo, urgente, data_criacao, da_gestao, departamentos(nome)')
          .in('departamento_id', ids)
          .order('data_criacao', { ascending: false })
          .limit(30)
        if (ativo) setMural(data || [])
      }
      if (ativo) setCarregandoMural(false)
    }
    carregarMural()
    return () => { ativo = false }
  }, [])

  async function tocar(n) {
    const destino = await abrir(n)
    if (destino) navigate(destino)
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar titulo="Avisos" subtitulo={naoLidas ? `${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}
        acoes={naoLidas > 0 && (
          <Button size="sm" variant="secundario" onClick={marcarTodasLidas} icon={<CheckCheck className="w-4 h-4" aria-hidden="true" />}>
            Marcar como lidas
          </Button>
        )} />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-6">

        {/* NOTIFICAÇÕES */}
        <section aria-labelledby="titulo-notif">
          <h2 id="titulo-notif" className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand" aria-hidden="true" /> Notificações
          </h2>
          {carregando ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-card bg-surface-2 animate-pulse" />)}</div>
          ) : notificacoes.length === 0 ? (
            <Card padded={false}>
              <EmptyState icon={<BellOff className="w-5 h-5" aria-hidden="true" />} titulo="Nenhuma notificação"
                texto="Avisos de escala, trocas e repertório aparecem aqui." />
            </Card>
          ) : (
            <Card padded={false} className="divide-y divide-line overflow-hidden">
              {notificacoes.map(n => (
                <div key={n.id} className={`flex items-start gap-2 ${n.lida ? '' : 'bg-brand/5'}`}>
                  <button type="button" onClick={() => tocar(n)}
                    className="flex-1 min-w-0 text-left px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                    <span className="flex items-center gap-2">
                      {!n.lida && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" aria-label="Não lida" />}
                      <span className="text-sm font-semibold text-ink truncate">{n.titulo}</span>
                    </span>
                    {n.mensagem && <span className="block text-xs text-ink-2 mt-0.5">{n.mensagem}</span>}
                    {n.created_at && <span className="block text-[11px] text-muted mt-1">{quando(n.created_at)}</span>}
                  </button>
                  <button type="button" onClick={() => apagar(n.id)} aria-label={`Apagar notificação ${n.titulo}`}
                    className="p-3 text-muted hover:text-danger transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-ctl">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* MURAL */}
        <section aria-labelledby="titulo-mural">
          <h2 id="titulo-mural" className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-brand" aria-hidden="true" /> Mural dos departamentos
          </h2>
          {carregandoMural ? (
            <div className="h-24 rounded-card bg-surface-2 animate-pulse" />
          ) : mural.length === 0 ? (
            <Card padded={false}>
              <EmptyState icon={<Megaphone className="w-5 h-5" aria-hidden="true" />} titulo="Nenhum recado no mural"
                texto="Quando um líder publicar um aviso no seu departamento, ele aparece aqui." />
            </Card>
          ) : (
            <div className="space-y-2">
              {mural.map(a => (
                <Card key={a.id} className={a.urgente ? 'border-danger' : ''}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {a.urgente && <Pill tom="perigo"><AlertTriangle className="w-3 h-3" aria-hidden="true" /> Urgente</Pill>}
                    {a.departamentos?.nome && <Pill tom="dept" dept={a.departamentos.nome}>{a.departamentos.nome}</Pill>}
                    {a.da_gestao && <Pill>Gestão</Pill>}
                  </div>
                  <p className="text-sm font-bold text-ink">{a.titulo}</p>
                  <p className="text-xs text-ink-2 whitespace-pre-wrap mt-1">{a.conteudo}</p>
                  <p className="text-[11px] text-muted mt-2">{quando(a.data_criacao)}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
