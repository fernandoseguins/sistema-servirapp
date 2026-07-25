// src/components/ChatBot.jsx
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { supabase } from '../supabase'

export default function ChatBot() {
  const [aberto, setAberto] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [conversa, setConversa] = useState([{ role: 'bot', text: 'A paz do Senhor! Sou o ServirBot. Como posso te ajudar hoje?' }])
  const [carregando, setCarregando] = useState(false)
  const [contextoUsuario, setContextoUsuario] = useState(null)
  const scrollRef = useRef(null)

  // 🔍 PASSO NOVO: O ChatBot "espiona" quem está logado para avisar a Inteligência Artificial!
  useEffect(() => {
    async function descobrirQuemEstaLogado() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Pega o nome do perfil
      const { data: perfil } = await supabase.from('users_profile').select('nome').eq('id', user.id).single()
      
      // Pega o departamento e o cargo (líder, admin, voluntário)
      const { data: vinculo } = await supabase
        .from('membros_departamentos')
        .select('role, departamentos(nome)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      setContextoUsuario({
        nome: perfil?.nome || 'Irmão(ã)',
        cargo: vinculo?.role || 'Voluntário',
        departamento: vinculo?.departamentos?.nome || 'Nenhum departamento específico'
      })
    }
    descobrirQuemEstaLogado()
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [conversa])

  async function enviarDuvida(e) {
    e.preventDefault()
    if (!mensagem.trim() || carregando) return

    const msgUsuario = mensagem
    setMensagem('')
    setConversa(prev => [...prev, { role: 'user', text: msgUsuario }])
    setCarregando(true)

    try {
      const { data, error } = await supabase.functions.invoke('chat-bot', {
        body: { 
          mensagem: msgUsuario,
          contextoUsuario: contextoUsuario // 🎒 Mandamos a "mochila" com a identidade para a nuvem!
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setConversa(prev => [...prev, { role: 'bot', text: data.resposta }])
    } catch (err) {
      console.error(err)
      setConversa(prev => [...prev, { role: 'bot', text: `Ops, erro técnico: ${err.message || 'Falha na comunicação'}` }])
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[999] font-sans">
      <button 
        onClick={() => setAberto(!aberto)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
      >
        {aberto ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {aberto && (
        <div className="absolute bottom-20 right-0 w-[320px] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
          <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Bot size={20} /></div>
            <div>
              <p className="font-bold text-sm">Assistente ServirApp</p>
              <p className="text-[10px] opacity-80">Online agora</p>
            </div>
          </div>

          <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {conversa.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={enviarDuvida} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input 
              type="text" 
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" className="bg-blue-600 text-white p-2 flex items-center justify-center rounded-xl hover:bg-blue-700 transition">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}