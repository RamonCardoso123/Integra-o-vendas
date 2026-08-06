'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import SelectorEmpresa from '@/components/layout/SelectorEmpresa'
import {
  Settings, Upload, Shield, FileKey2, CheckCircle,
  AlertCircle, Loader2, Eye, EyeOff, Trash2, 
  Building2, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ConfigFiscal {
  id: string
  empresa_id: string
  cnpj: string | null
  inscricao_municipal: string | null
  regime_tributario: number
  certificado_nome_arquivo: string | null
  certificado_validade: string | null
  aliquota_simples_nacional: number | null
  aliquota_issqn: number | null
  created_at: string
  updated_at: string
}

export default function ConfigFiscalPage() {
  const { empresaAtiva } = useEmpresa()

  // Estado do formulário
  const [cnpj, setCnpj] = useState('')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('')
  const [regimeTributario, setRegimeTributario] = useState('1')
  const [aliquotaSimplesNacional, setAliquotaSimplesNacional] = useState('')
  const [aliquotaIssqn, setAliquotaIssqn] = useState('')
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null)

  // Estado da API
  const [config, setConfig] = useState<ConfigFiscal | null>(null)
  const [temCertificado, setTemCertificado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Carregar configuração existente
  const carregarConfig = useCallback(async () => {
    if (!empresaAtiva) return
    setLoading(true)
    try {
      const res = await fetch(`/api/config-fiscal?empresa_id=${empresaAtiva.id}`)
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        setCnpj(data.config.cnpj || '')
        setInscricaoMunicipal(data.config.inscricao_municipal || '')
        setRegimeTributario(String(data.config.regime_tributario || 1))
        setAliquotaSimplesNacional(data.config.aliquota_simples_nacional ? String(data.config.aliquota_simples_nacional) : '')
        setAliquotaIssqn(data.config.aliquota_issqn ? String(data.config.aliquota_issqn) : '')
        setTemCertificado(data.temCertificado)
      } else {
        setConfig(null)
        setTemCertificado(false)
      }
    } catch {
      toast.error('Erro ao carregar configuração fiscal.')
    } finally {
      setLoading(false)
    }
  }, [empresaAtiva])

  useEffect(() => { carregarConfig() }, [carregarConfig])

  // Salvar configuração
  const handleSalvar = async () => {
    if (!empresaAtiva) { toast.error('Selecione uma empresa'); return }

    // Validação mínima do CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo && cnpjLimpo.length !== 14) {
      toast.error('CNPJ deve ter 14 dígitos.'); return
    }

    // Se está enviando certificado, a senha é obrigatória
    if (certificadoFile && !senhaCertificado) {
      toast.error('Informe a senha do certificado digital.'); return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('empresa_id', empresaAtiva.id)
      if (cnpjLimpo) formData.append('cnpj', cnpjLimpo)
      if (inscricaoMunicipal) formData.append('inscricao_municipal', inscricaoMunicipal)
      formData.append('regime_tributario', regimeTributario)
      
      const valSimples = aliquotaSimplesNacional.replace(',', '.')
      if (valSimples && !isNaN(Number(valSimples))) formData.append('aliquota_simples_nacional', valSimples)
        
      const valIssqn = aliquotaIssqn.replace(',', '.')
      if (valIssqn && !isNaN(Number(valIssqn))) formData.append('aliquota_issqn', valIssqn)

      if (certificadoFile) {
        formData.append('certificado', certificadoFile)
      }
      if (senhaCertificado) {
        formData.append('senha_certificado', senhaCertificado)
      }

      const res = await fetch('/api/config-fiscal', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')

      toast.success(data.message || 'Configuração salva!')
      setSenhaCertificado('')
      setCertificadoFile(null)
      await carregarConfig()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const formatCnpjInput = (val: string) => {
    const nums = val.replace(/\D/g, '').slice(0, 14)
    if (nums.length <= 2) return nums
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`
    if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
  }

  if (!empresaAtiva) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-brand-500" /> Configurações Fiscais
          </h1>
          <SelectorEmpresa />
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-10 text-center">
          <Building2 size={48} className="mx-auto text-dark-500 mb-4" />
          <p className="text-dark-400">Selecione uma empresa para gerenciar as configurações fiscais.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-brand-500" />
            Configurações Fiscais
          </h1>
          <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 text-[10px] font-bold rounded border border-brand-500/30 uppercase tracking-wider">
            NFS-e
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={carregarConfig} className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all">
            <RefreshCw size={18} />
          </button>
          <SelectorEmpresa />
        </div>
      </div>

      {loading ? (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* === Card: Dados da Empresa === */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-700 flex items-center gap-3">
              <Building2 size={20} className="text-blue-400" />
              <h2 className="text-white font-bold">Dados Fiscais da Empresa</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1.5">CNPJ</label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpjInput(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-1.5">Inscrição Municipal</label>
                <input
                  type="text"
                  placeholder="Inscrição Municipal"
                  value={inscricaoMunicipal}
                  onChange={(e) => setInscricaoMunicipal(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-1.5">Regime Tributário</label>
                <select
                  value={regimeTributario}
                  onChange={(e) => setRegimeTributario(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                >
                  <option value="1">Simples Nacional</option>
                  <option value="2">Lucro Presumido</option>
                  <option value="3">Lucro Real</option>
                  <option value="4">MEI</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Alíquota Simples Nacional (%)</label>
                  <input
                    type="text"
                    placeholder="Ex: 11.34"
                    value={aliquotaSimplesNacional}
                    onChange={(e) => setAliquotaSimplesNacional(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Alíquota ISSQN Mensal (%)</label>
                  <input
                    type="text"
                    placeholder="Ex: 3.87"
                    value={aliquotaIssqn}
                    onChange={(e) => setAliquotaIssqn(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* === Card: Certificado Digital === */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-700 flex items-center gap-3">
              <FileKey2 size={20} className="text-emerald-400" />
              <h2 className="text-white font-bold">Certificado Digital A1</h2>
              {temCertificado && (
                <span className="ml-auto flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle size={12} /> Ativo
                </span>
              )}
            </div>
            <div className="p-5 space-y-4">
              {/* Status atual do certificado */}
              {temCertificado && config?.certificado_nome_arquivo && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3.5 flex items-start gap-3">
                  <Shield size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-emerald-300 font-medium">Certificado cadastrado</p>
                    <p className="text-xs text-emerald-400/70 truncate mt-0.5">{config.certificado_nome_arquivo}</p>
                    {config.certificado_validade && (
                      <p className="text-xs text-dark-400 mt-1">Validade: {new Date(config.certificado_validade).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Segurança */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex gap-2.5">
                <Shield size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-300 font-medium">Proteção AES-256-GCM</p>
                  <p className="text-[11px] text-dark-400 mt-0.5">A senha do certificado é criptografada antes de ser armazenada. O arquivo é salvo em um cofre privado inacessível por URL.</p>
                </div>
              </div>

              {/* Upload de novo certificado */}
              <div>
                <label className="block text-sm text-dark-400 mb-1.5">
                  {temCertificado ? 'Substituir certificado (.pfx ou .p12)' : 'Arquivo do certificado (.pfx ou .p12)'}
                </label>
                <label className="flex items-center gap-3 bg-dark-900 border border-dashed border-dark-600 hover:border-brand-500 rounded-lg px-4 py-3 cursor-pointer transition-colors group">
                  <Upload size={20} className="text-dark-400 group-hover:text-brand-400 transition-colors" />
                  <span className="text-sm text-dark-300 group-hover:text-white transition-colors truncate">
                    {certificadoFile ? certificadoFile.name : 'Clique para selecionar o arquivo...'}
                  </span>
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    className="hidden"
                    onChange={(e) => setCertificadoFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {/* Senha do certificado */}
              <div>
                <label className="block text-sm text-dark-400 mb-1.5">Senha do certificado</label>
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={senhaCertificado}
                    onChange={(e) => setSenhaCertificado(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 pr-12 text-white text-sm focus:border-brand-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[11px] text-dark-500 mt-1.5">A senha será criptografada com AES-256 antes de ser salva.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={saving}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2.5 transition-all shadow-lg shadow-brand-600/20"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}
