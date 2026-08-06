'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

const LOGO_KEY = 'connecta_empresa_logo'

export function getEmpresaLogo(empresaId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${LOGO_KEY}_${empresaId}`)
    return raw ?? null
  } catch { return null }
}

export function setEmpresaLogo(empresaId: string, dataUrl: string | null) {
  if (typeof window === 'undefined') return
  if (dataUrl) {
    localStorage.setItem(`${LOGO_KEY}_${empresaId}`, dataUrl)
  } else {
    localStorage.removeItem(`${LOGO_KEY}_${empresaId}`)
  }
  window.dispatchEvent(new Event('empresa-logo-atualizada'))
}

interface EmpresaLogoButtonProps {
  empresaId: string
  empresaNome: string
}

export default function EmpresaLogoButton({ empresaId, empresaNome }: EmpresaLogoButtonProps) {
  const [logo, setLogo] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLogo(getEmpresaLogo(empresaId))
    const handler = () => setLogo(getEmpresaLogo(empresaId))
    window.addEventListener('empresa-logo-atualizada', handler)
    return () => window.removeEventListener('empresa-logo-atualizada', handler)
  }, [empresaId])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2 MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setEmpresaLogo(empresaId, dataUrl)
      setLogo(dataUrl)
      toast.success('Logo da empresa atualizada!')
      setShowTooltip(false)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEmpresaLogo(empresaId, null)
    setLogo(null)
    toast.success('Logo removida')
    setShowTooltip(false)
  }

  return (
    <div className="relative">
      {/* Botão principal */}
      <button
        title="Logo da empresa"
        onClick={() => setShowTooltip(!showTooltip)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all
          ${dragging
            ? 'border-brand-400 bg-brand-600/20 scale-105'
            : logo
              ? 'border-dark-600 hover:border-brand-500 bg-dark-800'
              : 'border-dashed border-dark-600 hover:border-brand-500 bg-dark-800 hover:bg-dark-700'
          }`}
      >
        {logo ? (
          <img src={logo} alt={empresaNome} className="w-full h-full object-contain p-0.5" />
        ) : (
          <Building2 size={16} className="text-dark-400" />
        )}
      </button>

      {/* Tooltip/popup de ações */}
      {showTooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
          <div className="absolute top-full mt-2 right-0 z-50 w-56 bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-3 py-2.5 border-b border-dark-700">
              <p className="text-xs text-dark-400 font-semibold uppercase tracking-wider">Logo da empresa</p>
              <p className="text-[10px] text-dark-500 mt-0.5 truncate">{empresaNome}</p>
            </div>

            {/* Drop zone dentro do popup */}
            <div
              className={`m-3 border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all
                ${dragging ? 'border-brand-400 bg-brand-600/10' : 'border-dark-600 hover:border-brand-500 hover:bg-dark-700/50'}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <Upload size={20} className="text-dark-400" />
              <p className="text-xs text-dark-400 text-center leading-relaxed">
                Arraste a logo aqui<br />
                <span className="text-dark-500">ou clique para selecionar</span>
              </p>
              <p className="text-[10px] text-dark-600">PNG, JPG, SVG • máx. 2 MB</p>
            </div>

            {logo && (
              <div className="px-3 pb-3">
                <button
                  onClick={handleRemove}
                  className="w-full flex items-center justify-center gap-2 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-2 rounded-xl transition-all"
                >
                  <X size={12} />
                  Remover logo
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
      />
    </div>
  )
}
