// src/pages/MinhasEscalas.jsx — aba Escalas
// "Minhas": escalas futuras do usuário em todos os departamentos.
// "Que eu lidero": escalas futuras dos departamentos onde é líder/admin (com status).
import { useEffect, useState } from 'react'
import { CalendarDays, CalendarX2 } from 'lucide-react'
import { supabase } from '../supabase'
import { dataLocalISO } from '../utils/datas'
import { agruparPorMes, dataComDia } from '../utils/escalas'
import { TopBar, Card, Pill, ListRow, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import AdicionarAgenda from '../components/AdicionarAgenda'

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
          .select('id, data, turno, titulo, horario_ensaio, status, departamento_id, departamentos(nome, tipo), schedule_roles!inner(funcao, user_id)')
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
                  const linha = (
                  <ListRow key={e.id} href={`/escala/${e.id}`} state={estado(e)}
                    className={aba === 'minhas' ? 'flex-1 min-w-0 !border-b-0' : ''}
                    titulo={`${dataComDia(e.data)} · ${e.turno}`}
                    subtitulo={aba === 'minhas'
                      ? `${e.departamentos?.nome} · ${e.schedule_roles?.map(r => r.funcao).join(' + ')}`
                      : e.departamentos?.nome}
                    icon={<span className={`w-9 h-9 rounded-ctl flex items-center justify-center ${classesDept(e.departamentos?.nome).chip}`}>
                      <IconeDept nome={e.departamentos?.nome} className="w-4 h-4" />
                    </span>}
                    direita={aba === 'lidero' && <Pill tom={e.status === 'Publicada' ? 'sucesso' : 'aviso'}>{e.status}</Pill>} />
                  )
                  // "Minhas": ação rápida de agenda ao lado da linha (fora do link, para não aninhar botão em <a>)
                  if (aba !== 'minhas') return linha
                  return (
                    <div key={e.id} className="flex items-center gap-1 border-b border-line last:border-b-0">
                      {linha}
                      <AdicionarAgenda variante="icone" escala={e} departamento={e.departamentos?.nome}
                        funcoes={e.schedule_roles?.map(r => r.funcao)} />
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
