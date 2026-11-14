// src/pages/MinhasEscalas.jsx — aba Escalas
// "Minhas": escalas futuras do usuário em todos os departamentos.
// "Que eu lidero": escalas futuras dos departamentos onde é líder/admin (com status).
import { useEffect, useState } from 'react'
import { CalendarDays, CalendarX2, Check, X } from 'lucide-react'
import { supabase } from '../supabase'
import { dataLocalISO } from '../utils/datas'
import { agruparPorMes, dataComDia } from '../utils/escalas'
import { TopBar, Card, Pill, ListRow, EmptyState, Button } from '../components/ui'
import { useUI } from '../context/UIContext'
import { CONFIRMADO, RECUSADO, PENDENTE, statusAgregado, tomPresenca, rotuloPresenca, responderEscala } from '../utils/presenca'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'

const ABAS = [
  { id: 'minhas', rotulo: 'Minhas' },
  { id: 'lidero', rotulo: 'Que eu lidero' },
]

export default function MinhasEscalas() {
  const [aba, setAba] = useState('minhas')
  const [minhas, setMinhas] = useState([])
  const [lidero, setLidero] = useState([])
  const [ehLider, setEhLider] = useState(false)
  const [ehAdmin, setEhAdmin] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [respondendoId, setRespondendoId] = useState(null)
  const { toast } = useUI()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const hoje = dataLocalISO(new Date())

      const [perfilRes, vinculosRes, minhasRes] = await Promise.all([
        supabase.from('users_profile').select('role, super_admin, igreja_id').eq('id', user.id).single(),
        supabase.from('membros_departamentos').select('role, departamento_id').eq('user_id', user.id),
        supabase.from('schedules')
          .select('id, data, turno, status, departamento_id, departamentos(nome, tipo), schedule_roles!inner(id, funcao, user_id, status_confirmacao)')
          .eq('schedule_roles.user_id', user.id)
          .neq('status', 'Rascunho')
          .gte('data', hoje)
          .order('data', { ascending: true }),
      ])
      if (!ativo) return

      const perfil = perfilRes.data
      const vinculos = vinculosRes.data || []
      const admin = perfil?.super_admin === true || perfil?.role === 'admin' || vinculos.some(v => v.role === 'admin')
      const lider = admin || perfil?.role === 'líder' || vinculos.some(v => v.role === 'líder')

      setMinhas(minhasRes.data || [])
      setEhAdmin(admin)
      setEhLider(lider)

      if (lider) {
        let consulta = supabase.from('schedules')
          .select('id, data, turno, status, departamento_id, departamentos(nome, tipo)')
          .gte('data', hoje)
          .order('data', { ascending: true })
          .limit(300)
        if (!admin) {
          const ids = vinculos.filter(v => v.role === 'líder' || v.role === 'admin').map(v => v.departamento_id)
          consulta = consulta.in('departamento_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        }
        const { data } = await consulta
        if (ativo) setLidero(data || [])
      }
      if (ativo) setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  // Responde todos os papéis do usuário nessa escala (normalmente é um só).
  async function responder(escala, status) {
    setRespondendoId(escala.id)
    const resultados = await Promise.all((escala.schedule_roles || []).map(r => responderEscala(r.id, status)))
    setRespondendoId(null)
    if (resultados.some(r => !r.ok)) { toast.error('Não foi possível registrar sua resposta. Tente novamente.'); return }
    setMinhas(prev => prev.map(e => e.id === escala.id
      ? { ...e, schedule_roles: e.schedule_roles.map(r => ({ ...r, status_confirmacao: status })) }
      : e))
    if (status === CONFIRMADO) toast.success('Presença confirmada!')
    else toast.success('O líder foi avisado. Abra a escala para pedir uma troca.')
  }

  const lista = aba === 'minhas' ? minhas : lidero
  const grupos = agruparPorMes(lista)
  const estado = (e) => ({ departamentoId: e.departamento_id, departamentoNome: e.departamentos?.nome, departamentoTipo: e.departamentos?.tipo, userRole: ehAdmin ? 'admin' : 'membro' })

  return (
    <div className="min-h-screen bg-bg">
      <TopBar titulo="Escalas" subtitulo={aba === 'minhas' ? 'Onde você vai servir' : 'Departamentos que você lidera'} />

      <main className="max-w-[720px] mx-auto px-4 pb-6 space-y-4">
        {ehLider && (
          <div role="group" aria-label="Filtrar escalas" className="grid grid-cols-2 p-1 rounded-ctl bg-surface-2">
            {ABAS.map(a => (
              <button key={a.id} type="button" aria-pressed={aba === a.id} onClick={() => setAba(a.id)}
                className={`h-9 rounded-[10px] text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                  ${aba === a.id ? 'bg-surface text-brand shadow-sm' : 'text-ink-2'}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
        )}

        {carregando ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-card bg-surface-2 animate-pulse" />)}</div>
        ) : grupos.length === 0 ? (
          <Card padded={false}>
            {aba === 'minhas'
              ? <EmptyState icon={<CalendarX2 className="w-5 h-5" aria-hidden="true" />} titulo="Nenhuma escala por vir"
                  texto="Quando o líder publicar uma escala com o seu nome, ela aparece aqui." />
              : <EmptyState icon={<CalendarDays className="w-5 h-5" aria-hidden="true" />} titulo="Nenhuma escala criada"
                  texto="Use “Gerar mês” no departamento para criar as escalas." />}
          </Card>
        ) : (
          grupos.map(g => (
            <section key={g.chave} aria-label={g.titulo}>
              <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wide mb-2">{g.titulo}</h2>
              <Card padded={false} className="px-4">
                {g.itens.map(e => {
                  const presenca = aba === 'minhas' ? statusAgregado(e.schedule_roles) : null
                  const linha = (
                    <ListRow key={e.id} href={`/escala/${e.id}`} state={estado(e)}
                      className={presenca === PENDENTE ? 'border-b-0' : ''}
                      titulo={`${dataComDia(e.data)} · ${e.turno}`}
                      subtitulo={aba === 'minhas'
                        ? `${e.departamentos?.nome} · ${e.schedule_roles?.map(r => r.funcao).join(' + ')}`
                        : e.departamentos?.nome}
                      icon={<span className={`w-9 h-9 rounded-ctl flex items-center justify-center ${classesDept(e.departamentos?.nome).chip}`}>
                        <IconeDept nome={e.departamentos?.nome} className="w-4 h-4" />
                      </span>}
                      direita={aba === 'lidero'
                        ? <Pill tom={e.status === 'Publicada' ? 'sucesso' : 'aviso'}>{e.status}</Pill>
                        : <Pill tom={tomPresenca(presenca)}>{rotuloPresenca(presenca)}</Pill>} />
                  )
                  if (presenca !== PENDENTE) return linha
                  // Pendente: ações rápidas fora do link (botão dentro de <a> é inválido)
                  return (
                    <div key={e.id} className="border-b border-line last:border-b-0 pb-3">
                      {linha}
                      <div className="flex items-center gap-2 pl-12">
                        <Button size="sm" icon={<Check className="w-4 h-4" />} loading={respondendoId === e.id} onClick={() => responder(e, CONFIRMADO)}>Confirmar</Button>
                        <Button size="sm" variant="perigo" icon={<X className="w-4 h-4" />} disabled={respondendoId === e.id} onClick={() => responder(e, RECUSADO)}>Não posso</Button>
                      </div>
                    </div>
                  )
                })}
              </Card>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
