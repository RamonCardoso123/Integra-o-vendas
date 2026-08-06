'use client'

import { useState, useEffect } from 'react'
import { X, Save, Sun, Moon, Palette, User, KeyRound } from 'lucide-react'
import { useAppConfig, AccentColor } from '@/contexts/AppConfigContext'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const COLORS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'violet', label: 'Violeta', hex: '#7c3aed' },
  { id: 'blue',   label: 'Azul',    hex: '#2563eb' },
  { id: 'emerald',label: 'Verde',   hex: '#059669' },
  { id: 'rose',   label: 'Rosa',    hex: '#e11d48' },
  { id: 'amber',  label: 'Ambar',   hex: '#d97706' },
  { id: 'cyan',   label: 'Ciano',   hex: '#0891b2' },
]

const NOME_KEY = 'connecta_perfil_nome'

interface Props { open: boolean; onClose: () => void; userEmail: string }

export default function ModalPerfil({ open, onClose, userEmail }: Props) {
  const { config, update } = useAppConfig()
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [accentColor, setAccentColor] = useState(config.accentColor)
  const [darkMode, setDarkMode] = useState(config.darkMode)
  const [enviandoSenha, setEnviandoSenha] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setAccentColor(config.accentColor)
      setDarkMode(config.darkMode)
      const saved = localStorage.getItem(NOME_KEY)
      setNomeExibicao(saved || '')
    }
  }, [open, config])

  if (!open) return null

  const handleSave = () => {
    localStorage.setItem(NOME_KEY, nomeExibicao)
    update({ accentColor, darkMode })
    toast.success('Perfil salvo!')
    onClose()
  }

  const handleRedefinirSenha = async () => {
    if (!userEmail) return
    setEnviandoSenha(true)
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) {
      toast.error('Erro ao enviar email de redefinicao')
    } else {
      toast.success('Email de redefinicao enviado!')
    }
    setEnviandoSenha(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <User size={15} className="text-brand-400" />
            <h2 className="text-white font-semibold text-sm">Editar perfil</h2>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Email readonly */}
          <div>
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider mb-1.5">Email</p>
            <p className="text-sm text-dark-400 bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 truncate">{userEmail}</p>
          </div>

          {/* Nome de exibicao */}
          <div>
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider mb-1.5">Nome de exibicao</p>
            <input
              type="text"
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Ex: Ramon Cardoso"
              className="w-full bg-dark-800 border border-dark-600 focus:border-brand-500 rounded-xl px-3 py-2 text-sm text-white placeholder-dark-500 outline-none transition-colors"
            />
          </div>

          {/* Cor de destaque */}
          <div>
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette size={10} /> Cor de destaque
            </p>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => setAccentColor(c.id)}
                  className={`w-8 h-8 rounded-lg transition-all border-2 ${accentColor === c.id ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Modo claro/escuro */}
          <div>
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider mb-2">Aparencia</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDarkMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all border ${darkMode ? 'bg-dark-700 border-brand-500 text-white' : 'border-dark-700 text-dark-400 hover:bg-dark-800'}`}
              >
                <Moon size={12} /> Escuro
              </button>
              <button
                onClick={() => setDarkMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all border ${!darkMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'border-dark-700 text-dark-400 hover:bg-dark-800'}`}
              >
                <Sun size={12} /> Claro
              </button>
            </div>
          </div>

          {/* Redefinir senha */}
          <div>
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <KeyRound size={10} /> Seguranca
            </p>
            <button
              onClick={handleRedefinirSenha}
              disabled={enviandoSenha}
              className="w-full text-xs text-dark-300 hover:text-white bg-dark-800 hover:bg-dark-700 border border-dark-700 py-2 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <KeyRound size={12} />
              {enviandoSenha ? 'Enviando...' : 'Enviar email de redefinicao de senha'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm text-dark-400 hover:text-white px-4 py-2 rounded-xl hover:bg-dark-800 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl transition-all"
          >
            <Save size={13} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
