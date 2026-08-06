'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa } from '@/types'

interface EmpresaContextType {
  empresas: Empresa[]
  empresaAtiva: Empresa | null
  setEmpresaAtiva: (empresa: Empresa) => void
  loading: boolean
  recarregar: () => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const carregarEmpresas = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('nome')

      if (error) throw error

      setEmpresas(data || [])

      // Recuperar empresa ativa do localStorage
      const savedId = localStorage.getItem('empresa_ativa_id')
      const saved = data?.find((e) => e.id === savedId)
      if (saved) {
        setEmpresaAtivaState(saved)
      } else if (data && data.length > 0) {
        setEmpresaAtivaState(data[0])
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err)
    } finally {
      setLoading(false)
    }
  }

  const setEmpresaAtiva = (empresa: Empresa) => {
    setEmpresaAtivaState(empresa)
    localStorage.setItem('empresa_ativa_id', empresa.id)
  }

  useEffect(() => {
    carregarEmpresas()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') carregarEmpresas()
      if (event === 'SIGNED_OUT') {
        setEmpresas([])
        setEmpresaAtivaState(null)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        empresaAtiva,
        setEmpresaAtiva,
        loading,
        recarregar: carregarEmpresas,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
