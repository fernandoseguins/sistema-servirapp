// src/pages/DevUI.jsx — vitrine das peças de UI (só em desenvolvimento: rota /dev/ui)
import { useState } from 'react'
import { Mail, Plus, Calendar, Bell } from 'lucide-react'
import { Button, Card, Pill, ListRow, Input, Select, Sheet, TopBar, Logo, EmptyState } from '../components/ui'
import IconeDept from '../theme/IconeDept'
import { classesDept } from '../theme/deptCores'
import { aplicarTema } from '../theme/aparencia'

const DEPTS = ['Louvor', 'Mídia', 'Infantil', 'Diaconia', 'Cantina', 'Ministros', 'Recepção']

export default function DevUI() {
  const [sheet, setSheet] = useState(false)
  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variante="destaque" titulo="Peças de UI" subtitulo="Vitrine" onVoltar={() => history.back()}
        acoes={<Button size="sm" variant="secundario" onClick={() => aplicarTema(document.documentElement.classList.contains('dark') ? 'claro' : 'escuro')}>Alternar tema</Button>} />
      <main className="max-w-[720px] mx-auto px-4 space-y-4 mt-4">
        <Card className="flex flex-wrap gap-2 items-center">
          <Logo variante="cor" className="h-8" />
          <span className="bg-topo rounded-ctl p-2"><Logo variante="branco" className="h-8" /></span>
        </Card>
        <Card className="flex flex-wrap gap-2">
          <Button icon={<Plus className="w-4 h-4" aria-hidden="true" />}>Primário</Button>
          <Button variant="secundario">Secundário</Button>
          <Button variant="fantasma">Fantasma</Button>
          <Button variant="perigo">Perigo</Button>
          <Button loading>Salvando</Button>
          <Button size="sm" aria-label="Avisos" variant="fantasma" icon={<Bell className="w-4 h-4" aria-hidden="true" />} />
        </Card>
        <Card className="flex flex-wrap gap-2">
          <Pill>Neutro</Pill><Pill tom="brand">Brand</Pill><Pill tom="sucesso">Publicada</Pill>
          <Pill tom="aviso">Rascunho</Pill><Pill tom="perigo">Erro</Pill>
          {DEPTS.map(d => <Pill key={d} tom="dept" dept={d}>{d}</Pill>)}
        </Card>
        <div className="grid grid-cols-2 gap-2">
          {DEPTS.map(d => (
            <button key={d} type="button" className={`rounded-card p-3 flex items-center gap-2 text-sm font-semibold ${classesDept(d).chip}`}>
              <IconeDept nome={d} /> {d}
            </button>
          ))}
        </div>
        <Card padded={false} className="px-4">
          <ListRow titulo="Domingo, 06/12 · Noite" subtitulo="Louvor · Voz principal" direita={<Pill tom="sucesso">Publicada</Pill>} onClick={() => {}} icon={<Calendar className="w-4 h-4 text-brand" aria-hidden="true" />} />
          <ListRow titulo="Um nome de departamento muito comprido que não pode estourar a tela" subtitulo="Texto auxiliar" />
        </Card>
        <Card className="space-y-3">
          <Input label="E-mail" placeholder="seu@email.com" icon={<Mail className="w-4 h-4" aria-hidden="true" />} />
          <Input label="Com erro" defaultValue="abc" erro="Digite um e-mail válido." />
          <Select label="Turno" options={[{ value: 'm', label: 'Manhã' }, { value: 'n', label: 'Noite' }]} />
        </Card>
        <Card padded={false}><EmptyState icon={<Calendar className="w-5 h-5" aria-hidden="true" />} titulo="Você ainda não foi escalado" texto="Quando o líder publicar a escala, ela aparece aqui." /></Card>
        <Button variant="secundario" onClick={() => setSheet(true)}>Abrir painel</Button>
        <Sheet aberto={sheet} onFechar={() => setSheet(false)} titulo="Mais ações">
          <ListRow titulo="Dias off" onClick={() => setSheet(false)} />
          <ListRow titulo="Músicas" onClick={() => setSheet(false)} />
        </Sheet>
      </main>
    </div>
  )
}
