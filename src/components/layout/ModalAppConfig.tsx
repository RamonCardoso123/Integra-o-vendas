'use client'

import { useState, useRef } from 'react'
import { X, Upload, Sun, Moon, Palette, Building2, Trash2, Save } from 'lucide-react'
import { useAppConfig, AccentColor } from '@/contexts/AppConfigContext'
import toast from 'react-hot-toast'

const COLORS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'violet', label: 'Violeta', hex: '#7c3aed' },
  { id: 'blue',   label: 'Azul',    hex: '#2563eb' },
  { id: 'emerald',label: 'Verde',   hex: '#059669' },
  { id: 'rose',   label: 'Rosa',    hex: '#e11d48' },
  { id: 'amber',  label: 'Ambar',   hex: '#d97706' },
  { id: 'cyan',   label: 'Ciano',   hex: '#0891b2' },
]

interface Props { open: boolean; onClose: () => void }

export default function ModalAppConfig({ open, onClose }: Props) {
  const { config, update } = useAppConfig()
  const [draft, setDraft] = useState({ ...config })
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    if (file.size > 3 * 1024 * 1024) { toast.error('Max 3 MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => setDraft(d => ({ ...d, appLogoUrl: e.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    update(draft)
    toast.success('Configuracoes salvas!')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Palette size={15} className="text-brand-400" />
            <h2 className="text-white font-semibold text-sm">Personalizar app</h2>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Logo do app */}
          <div>
            <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 size={11} /> Logo do app
            </p>
            <div className="flex items-center gap-3">
              {/* Preview */}
              <div
                onClick={() => fileRef.current?.click()}
                className="w-14 h-14 rounded-xl border-2 border-dashed border-dark-600 hover:border-brand-500 bg-dark-800 flex items-center justify-center overflow-hidden cursor-pointer transition-all group"
              >
                {draft.appLogoUrl ? (
                  <img src={draft.appLogoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Upload size={18} className="text-dark-500 group-hover:text-brand-400 transition-colors" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full text-xs text-brand-400 hover:text-brand-300 bg-brand-600/10 hover:bg-brand-600/20 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Upload size={11} /> Carregar logo
                </button>
                {draft.appLogoUrl && (
                  <button
                    onClick={() => setDraft(d => ({ ...d, appLogoUrl: null }))}
                    className="w-full text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={11} /> Remover
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            </div>
            <p className="text-[10px] text-dark-600 mt-1.5">PNG, SVG, JPG • max 3 MB • arraste ou clique</p>
          </div>

          {/* Nome do app */}
          <div>
            <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-2">Nome do app</p>
            <input
              type="text"
              value={draft.appNome}
              onChange={(e) => setDraft(d => ({ ...d, appNome: e.target.value }))}
              placeholder="Ex: Dinheiro em Caixa"
              className="w-full bg-dark-800 border border-dark-600 focus:border-brand-500 rounded-xl px-3 py-2 text-sm text-white placeholder-dark-500 outline-none transition-colors"
            />
          </div>

          {/* Cor de destaque */}
          <div>
            <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-2">Cor de destaque</p>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => setDraft(d => ({ ...d, accentColor: c.id }))}
                  className={`w-8 h-8 rounded-lg transition-all border-2 ${draft.accentColor === c.id ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <p className="text-[10px] text-dark-600 mt-1.5">
              Selecionado: <span className="text-dark-400">{COLORS.find(c => c.id === draft.accentColor)?.label}</span>
            </p>
          </div>

          {/* Modo claro/escuro */}
          <div>
            <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-2">Aparencia</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft(d => ({ ...d, darkMode: true }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all border ${draft.darkMode ? 'bg-dark-700 border-brand-500 text-white' : 'border-dark-700 text-dark-400 hover:bg-dark-800'}`}
              >
                <Moon size={13} /> Escuro
              </button>
              <button
                onClick={() => setDraft(d => ({ ...d, darkMode: false }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all border ${!draft.darkMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'border-dark-700 text-dark-400 hover:bg-dark-800'}`}
              >
                <Sun size={13} /> Claro
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm text-dark-400 hover:text-white px-4 py-2 rounded-xl hover:bg-dark-800 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl transition-all shadow-md"
          >
            <Save size={13} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
