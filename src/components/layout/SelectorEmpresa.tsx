'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'
import { useAppConfig } from '@/contexts/AppConfigContext'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown, Building2, Check,
  RefreshCw, Unlink, ExternalLink, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { formatCNPJ } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SelectorEmpresa() {
  const { empresas, empresaAtiva, setEmpresaAtiva, recarregar } = useEmpresa()
  const { accentClasses } = useAppConfig()
  const [openEmpresa, setOpenEmpresa] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const supabase = createClient()
  const refEmpresa = useRef<HTMLDivElement>(null)
  const pathname = usePathname() || ''

  const empresasFiltradas = useMemo(() => {
    return empresas.filter(emp => {
      if (pathname.startsWith('/vendas')) return emp.tipo_empresa === 'vendas' || emp.tipo_empresa === 'ambos'
      if (pathname.startsWith('/contas-pagar') || pathname.startsWith('/contas-receber')) return emp.tipo_empresa === 'financeiro' || emp.tipo_empresa === 'ambos'
      return true
    })
  }, [empresas, pathname])

  useEffect(() => {
    if (empresasFiltradas.length > 0 && empresaAtiva) {
      const isValid = empresasFiltradas.some(e => e.id === empresaAtiva.id)
      if (!isValid) {
        setEmpresaAtiva(empresasFiltradas[0])
      }
    }
  }, [pathname, empresasFiltradas, empresaAtiva, setEmpresaAtiva])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (refEmpresa.current && !refEmpresa.current.contains(e.target as Node)) setOpenEmpresa(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleConectar = () => {
    if (!empresaAtiva) return
    setConectando(true)
    window.location.href = `/api/conta-azul/autorizar?empresa_id=${empresaAtiva.id}`
  }

  const handleDesconectar = async () => {
    if (!empresaAtiva) return
    if (!confirm(`Desconectar Conta Azul de "${empresaAtiva.nome}"?`)) return
    setDesconectando(true)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          access_token_conta_azul: null,
          refresh_token_conta_azul: null,
          data_expiracao_token: null,
          conta_azul_connected: false,
        })
        .eq('id', empresaAtiva.id)
      if (error) throw error
      toast.success('Conta Azul desconectado.')
      await recarregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar')
    } finally {
      setDesconectando(false)
    }
  }

  const handleSelectEmpresa = (emp: any) => {
    setEmpresaAtiva(emp)
    setOpenEmpresa(false)
    
    // Auto-sync fornecedores if connected to Conta Azul and in a page that needs it
    if (emp.access_token_conta_azul && (pathname.startsWith('/contas-pagar') || pathname.startsWith('/empresas'))) {
      fetch('/api/conta-azul/fornecedores/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: emp.id })
      }).catch(err => {
        console.warn('Erro na auto-sincronização de fornecedores:', err)
      })
    }
  }

  const contaAzulConectado = !!empresaAtiva?.access_token_conta_azul

  return (
    <div ref={refEmpresa} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpenEmpresa(!openEmpresa)}
        className="w-full sm:w-auto flex items-center justify-between gap-2.5 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 transition-all group"
      >
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 ${accentClasses.bg}/20 rounded-md flex items-center justify-center flex-shrink-0`}>
            <Building2 size={13} className={accentClasses.text} />
          </div>
          <span className="text-white text-sm font-medium max-w-[200px] truncate text-left">
            {empresaAtiva?.nome || 'Selecionar empresa'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${contaAzulConectado ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </div>
        <ChevronDown size={13} className={`text-dark-400 transition-transform flex-shrink-0 ${openEmpresa ? 'rotate-180' : ''}`} />
      </button>

      {openEmpresa && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-dark-700">
            <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider">Suas empresas</p>
          </div>
          {empresasFiltradas.length === 0 ? (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">Nenhuma empresa encontrada para esta seção</div>
          ) : (
            empresasFiltradas.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelectEmpresa(emp)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-dark-700 transition-colors text-left"
              >
                <div className={`w-8 h-8 ${accentClasses.bg}/20 border ${accentClasses.border}/30 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <span className={`${accentClasses.text} font-bold text-xs`}>{emp.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {emp.nome}
                    <span className="ml-2 text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-dark-600 text-dark-300">
                      {emp.tipo_empresa}
                    </span>
                  </p>
                  <p className="text-dark-500 text-xs">{emp.cnpj ? formatCNPJ(emp.cnpj) : 'CNPJ nao informado'}</p>
                </div>
                {empresaAtiva?.id === emp.id && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
              </button>
            ))
          )}
          {empresaAtiva && (
            <div className="border-t border-dark-700 px-3 py-3 bg-dark-900/50">
              <p className="text-xs text-dark-500 font-semibold uppercase tracking-wider mb-2">Conta Azul</p>
              <div className="flex items-center justify-between bg-dark-800 border border-dark-700 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {contaAzulConectado ? (
                    <><CheckCircle size={13} className="text-emerald-400" /><span className="text-sm text-emerald-400 font-medium">API conectada</span></>
                  ) : (
                    <><AlertCircle size={13} className="text-amber-400" /><span className="text-sm text-amber-400 font-medium">Nao conectado</span></>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {contaAzulConectado ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleConectar() }} disabled={conectando}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-all" title="Renovar token">
                        {conectando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDesconectar() }} disabled={desconectando}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Desconectar">
                        {desconectando ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                      </button>
                    </>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); handleConectar() }} disabled={conectando}
                      className={`flex items-center gap-1.5 text-xs font-semibold ${accentClasses.text} ${accentClasses.bg}/10 hover:${accentClasses.bg}/20 px-3 py-1.5 rounded-lg transition-all`}>
                      {conectando ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      Conectar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
