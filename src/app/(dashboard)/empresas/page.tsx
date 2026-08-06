'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2, Plus, Check, Loader2, ExternalLink, Edit,
  RefreshCw, Unlink, Upload, Users, ChevronDown, ChevronUp, Trash2, ShieldCheck, Mail, Search, Copy
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCNPJ } from '@/lib/utils'
import { parseFornecedoresArquivo } from '@/lib/parsers/fornecedores-contaazul'
import { buscarCnpj, type BrasilApiCnpjResponse } from '@/services/brasil-api/client'
import type { Empresa } from '@/types'

// --- Painel de fornecedores por empresa ---
function PainelFornecedores({ empresa }: { empresa: Empresa }) {
  const [aberto, setAberto] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [importando, setImportando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const supabase = createClient()

  const carregarTotal = useCallback(async () => {
    const { count } = await supabase
      .from('fornecedores_contaazul')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa.id)
    setTotal(count ?? 0)
  }, [empresa.id, supabase])

  useEffect(() => { carregarTotal() }, [carregarTotal])

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    try {
      const fornecedores = await parseFornecedoresArquivo(file)
      if (fornecedores.length === 0) {
        toast.error('Nenhum fornecedor encontrado no arquivo')
        return
      }

      await supabase.from('fornecedores_contaazul').delete().eq('empresa_id', empresa.id)

      const registros = fornecedores.map((f) => ({
        empresa_id: empresa.id,
        nome: f.nome,
        cnpj: f.cnpj || null,
        categoria_padrao: f.categoria || null,
        nome_normalizado: f.nomeNormalizado,
      }))

      for (let i = 0; i < registros.length; i += 500) {
        const lote = registros.slice(i, i + 500)
        const { error } = await supabase.from('fornecedores_contaazul').insert(lote)
        if (error) throw error
      }

      toast.success(`${fornecedores.length} fornecedores importados com sucesso!`)
      await carregarTotal()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar fornecedores')
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  const handleLimpar = async () => {
    if (!confirm('Remover todos os fornecedores desta empresa?')) return
    setLimpando(true)
    try {
      await supabase.from('fornecedores_contaazul').delete().eq('empresa_id', empresa.id)
      setTotal(0)
      toast.success('Lista de fornecedores removida.')
    } catch {
      toast.error('Erro ao remover fornecedores')
    } finally {
      setLimpando(false)
    }
  }

  return (
    <div className="border-t border-dark-700 mt-3 pt-3">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors w-full"
      >
        <Users size={14} />
        <span>Fornecedores ContaAzul</span>
        {total !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            total > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-700 text-dark-500'
          }`}>
            {total} cadastrados
          </span>
        )}
        {aberto ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>

      {aberto && (
        <div className="mt-3 space-y-2 animate-fade-in">
          <p className="text-xs text-dark-500">
            Sincronize os fornecedores diretamente do Conta Azul para que o app corrija
            automaticamente os nomes ao importar planilhas do Datacar.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                if (!empresa.access_token_conta_azul) {
                  toast.error('Empresa não conectada ao Conta Azul.')
                  return
                }
                setSincronizando(true)
                try {
                  const res = await fetch('/api/conta-azul/fornecedores/sincronizar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empresa_id: empresa.id })
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar fornecedores')
                  toast.success(data.message || `${data.count} fornecedores sincronizados com sucesso!`)
                  await carregarTotal()
                } catch (err: any) {
                  toast.error(err.message)
                } finally {
                  setSincronizando(false)
                }
              }}
              disabled={sincronizando || importando || !empresa.access_token_conta_azul}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all
                ${sincronizando || importando || !empresa.access_token_conta_azul
                  ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
                }`}
            >
              {sincronizando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {sincronizando ? 'Sincronizando...' : 'Sincronizar Conta Azul'}
            </button>

            <label className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all
              ${importando || sincronizando
                ? 'bg-dark-700 text-dark-500 cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
              }`}>
              {importando
                ? <Loader2 size={13} className="animate-spin" />
                : <Upload size={13} />
              }
              {importando ? 'Importando...' : 'Importar CSV ContaAzul'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={importando}
                onChange={handleImportar}
              />
            </label>

            {total !== null && total > 0 && (
              <button
                onClick={handleLimpar}
                disabled={limpando}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-all"
              >
                {limpando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Limpar lista
              </button>
            )}
          </div>
          {total !== null && total > 0 && (
            <p className="text-xs text-emerald-400">
              Lista atualizada — {total} fornecedores prontos para match automático.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --- Componente do Card de Empresa ---
function EmpresaCard({
  empresa,
  isAtiva,
  onSelect,
  onEdit,
  onDelete,
  conectando,
  onConectarContaAzul,
  onDesconectar,
  viewMode
}: {
  empresa: Empresa;
  isAtiva: boolean;
  onSelect: () => void;
  onEdit: () => void;
  conectando: string | null;
  onConectarContaAzul: (id: string) => void;
  onDesconectar: (id: string) => void;
  onDelete: () => void;
  viewMode: 'vendas' | 'contas_a_pagar';
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative group rounded-2xl p-5 sm:p-6 transition-all duration-300 cursor-pointer ${
        isAtiva 
          ? 'bg-dark-800/80 border-brand-500/50 shadow-[0_0_30px_rgba(var(--brand-500),0.15)] ring-1 ring-brand-500/20' 
          : 'bg-dark-800/40 border-dark-700/50 hover:bg-dark-800/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-dark-600/50'
      } border backdrop-blur-sm flex flex-col`}
    >
      {/* STATUS BADGE ABSOLUTE TOP RIGHT */}
      {isAtiva && (
        <div className="absolute -top-3 -right-3" title="Empresa Ativa">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-20"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-500 border-2 border-dark-900 shadow-[0_0_10px_rgba(var(--brand-500),0.5)]"></span>
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4 flex-1">
        <div className="flex gap-4 items-start">
          {/* AVATAR */}
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold shadow-inner ${
            isAtiva 
              ? 'bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-brand-900/40' 
              : 'bg-dark-700/50 text-dark-300 group-hover:bg-dark-700 transition-colors'
          }`}>
            {empresa.nome.substring(0, 2).toUpperCase()}
          </div>
          
          {/* TEXTOS */}
          <div className="pt-0.5">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-white font-bold text-base sm:text-lg leading-tight group-hover:text-brand-100 transition-colors">
                {empresa.nome}
              </h3>
            </div>
            {empresa.razao_social && (
              <p className="text-dark-400 text-xs font-medium truncate max-w-[180px] sm:max-w-[250px]">{empresa.razao_social}</p>
            )}
            <p className="text-dark-500 text-[10px] sm:text-[11px] font-mono mt-0.5">{formatCNPJ(empresa.cnpj)}</p>
          </div>
        </div>

        {/* AÇÕES SUPERIORES */}
        <div className="flex gap-2 ml-2 relative z-10" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onEdit();
            }}
            className="p-1.5 rounded-lg text-dark-500 hover:text-white hover:bg-dark-700 transition-colors border border-transparent hover:border-dark-600/50 bg-dark-900/20 hover:bg-dark-900/50"
            title="Editar configurações"
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="p-1.5 rounded-lg text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 bg-dark-900/20 hover:bg-dark-900/50"
            title="Excluir empresa"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* INFORMAÇÕES DE INTEGRAÇÃO (Unificadas para ambos os modos) */}
      <div onClick={e => e.stopPropagation()} className="mt-2 pt-3 border-t border-dark-700/50 cursor-default">
        <div className="flex flex-col gap-3">
          
          {/* DATACAR */}
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${empresa.datacar_token ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-dark-500'}`} />
            <span className="text-xs text-dark-300">
              {empresa.datacar_token ? 'API Datacar Conectada' : 'Datacar Não Configurado'}
            </span>
          </div>

          <div className="h-px w-full bg-dark-700/30"></div>

          {/* CONTA AZUL */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${empresa.access_token_conta_azul ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
              <span className="text-xs text-dark-300">
                {empresa.access_token_conta_azul ? 'Conta Azul Conectado' : 'Conta Azul Desconectado'}
              </span>
            </div>
            <div className="flex gap-1.5">
              {empresa.access_token_conta_azul ? (
                <>
                  <a
                    href={`/api/conta-azul/diagnostico?empresa_id=${empresa.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-dark-800 rounded-md text-yellow-500 hover:bg-yellow-500/10 transition-all border border-dark-700/50 hover:border-yellow-500/30"
                    title="Diagnosticar Conexão"
                  >
                    <ShieldCheck size={12} />
                  </a>
                  <button
                    onClick={() => onDesconectar(empresa.id)}
                    className="p-1.5 bg-dark-800 rounded-md text-red-500/70 hover:bg-red-500/10 transition-all border border-dark-700/50 hover:border-red-500/30"
                    title="Desconectar API"
                  >
                    <Unlink size={12} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = `${window.location.origin}/api/conta-azul/autorizar?empresa_id=${empresa.id}`;
                      navigator.clipboard.writeText(link);
                      import('react-hot-toast').then((m) => m.default.success('Copiado para a memória! Agora é só colar (Ctrl+V) no WhatsApp.'));
                      // Fallback visual para o usuário ver o link na tela
                      window.prompt('O link também está abaixo se preferir copiar manualmente (Ctrl+C):', link);
                    }}
                    className="px-2.5 py-1 bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all border border-dark-700/50"
                    title="Copiar link para o cliente autorizar"
                  >
                    <Copy size={10} />
                    Copiar Link
                  </button>
                  <button
                    onClick={() => onConectarContaAzul(empresa.id)}
                    disabled={conectando === empresa.id}
                    className="px-2.5 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all border border-blue-500/20"
                    title="Conectar agora"
                  >
                    {conectando === empresa.id ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                    Conectar
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* PAINEL FORNECEDORES (Compacto) */}
          <div className="mt-2 border-t border-dark-700/30 pt-2">
            <PainelFornecedores empresa={empresa} />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Página principal ---
function EmpresasPageContent() {
  const { empresas, recarregar, setEmpresaAtiva, empresaAtiva } = useEmpresa()
  const [viewMode, setViewMode] = useState<'home' | 'vendas' | 'contas_a_pagar'>('home')
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [conectando, setConectando] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [dadosCnpj, setDadosCnpj] = useState<BrasilApiCnpjResponse | null>(null)
  const [form, setForm] = useState<{
    nome: string, 
    cnpj: string, 
    email_login: string, 
    tipo_empresa: 'vendas' | 'financeiro' | 'ambos',
    datacar_token: string,
    datacar_cod_emp: string,
    datacar_id_operador: string,
    razao_social: string,
    nome_fantasia: string
  }>({ 
    nome: '', 
    cnpj: '', 
    email_login: '', 
    tipo_empresa: 'ambos',
    datacar_token: '',
    datacar_cod_emp: '',
    datacar_id_operador: '',
    razao_social: '',
    nome_fantasia: ''
  })
  const supabase = createClient()
  const searchParams = useSearchParams()

  useEffect(() => {
    const sucesso = searchParams.get('sucesso')
    const erro = searchParams.get('erro')
    const isNew = searchParams.get('new')

    if (isNew === 'true') {
      setShowForm(true)
    }

    if (sucesso === 'conta_azul_conectado') {
      toast.success('Conta Azul conectado com sucesso!')
      recarregar()
      window.history.replaceState({}, '', '/empresas')
    } else if (erro) {
      const msgs: Record<string, string> = {
        autorizacao_negada: 'Autorização negada no Conta Azul.',
        parametros_invalidos: 'Parâmetros inválidos no retorno.',
      }
      toast.error(msgs[erro] || `Erro: ${decodeURIComponent(erro)}`)
      window.history.replaceState({}, '', '/empresas')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConectarContaAzul = (empresaId: string) => {
    setConectando(empresaId)
    window.location.href = `/api/conta-azul/autorizar?empresa_id=${empresaId}`
  }

  const handleDesconectar = async (empresaId: string) => {
    if (!confirm('Tem certeza que deseja desconectar o Conta Azul desta empresa?')) return
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          access_token_conta_azul: null,
          refresh_token_conta_azul: null,
          data_expiracao_token: null,
          conta_azul_connected: false,
        })
        .eq('id', empresaId)
      if (error) throw error
      toast.success('Conta Azul desconectado.')
      await recarregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar')
    }
  }

  const handleExcluirEmpresa = async (empresaId: string) => {
    if (!confirm('ATENÇÃO: Tem certeza que deseja excluir esta empresa? Todos os dados vinculados a ela serão perdidos.')) return
    try {
      const { error } = await supabase
        .from('empresas')
        .delete()
        .eq('id', empresaId)
      
      if (error) throw error
      
      toast.success('Empresa excluída com sucesso!')
      await recarregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir a empresa')
    }
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const cnpjLimpo = (form.cnpj || '').replace(/\D/g, '')
      const razaoSocialFinal = form.razao_social.trim() || null
      const nomeFantasiaFinal = form.nome_fantasia.trim() || null

      if (editingId) {
        // Atualiza a empresa existente
        const { error: errEmp } = await supabase
          .from('empresas')
          .update({
            nome: form.nome.trim(),
            cnpj: cnpjLimpo,
            email_login: form.email_login.trim() || null,
            tipo_empresa: form.tipo_empresa,
            datacar_token: form.datacar_token.trim() || null,
            datacar_cod_emp: form.datacar_cod_emp.trim() || null,
            datacar_id_operador: form.datacar_id_operador.trim() || null,
            razao_social: razaoSocialFinal,
            nome_fantasia: nomeFantasiaFinal,
          })
          .eq('id', editingId)

        if (errEmp) throw errEmp
        toast.success('Empresa atualizada com sucesso!')
      } else {
        // Cria uma nova empresa
        const empresaId = crypto.randomUUID()

        const { error: errEmp } = await supabase
          .from('empresas')
          .insert({
            id: empresaId,
            nome: form.nome.trim(),
            cnpj: cnpjLimpo,
            created_by: user.id,
            email_login: form.email_login.trim() || null,
            tipo_empresa: form.tipo_empresa,
            datacar_token: form.datacar_token.trim() || null,
            datacar_cod_emp: form.datacar_cod_emp.trim() || null,
            datacar_id_operador: form.datacar_id_operador.trim() || null,
            razao_social: razaoSocialFinal,
            nome_fantasia: nomeFantasiaFinal,
          })

        if (errEmp) throw errEmp

        const { error: errVinc } = await supabase
          .from('usuarios_empresas')
          .insert({
            user_id: user.id,
            empresa_id: empresaId,
            papel: 'admin'
          })

        if (errVinc) throw errVinc
        toast.success('Empresa criada com sucesso!')
      }

      setForm({ nome: '', cnpj: '', email_login: '', tipo_empresa: 'ambos', datacar_token: '', datacar_cod_emp: '', datacar_id_operador: '', razao_social: '', nome_fantasia: '' })
      setDadosCnpj(null)
      setEditingId(null)
      setShowForm(false)
      await recarregar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar empresa'
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleCriarVazio = async () => {
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const empresaId = crypto.randomUUID()

      const { error: errEmp } = await supabase
        .from('empresas')
        .insert({
          id: empresaId,
          nome: 'Aguardando Conexão...',
          cnpj: '00000000000000',
          created_by: user.id,
          tipo_empresa: 'ambos',
        })

      if (errEmp) throw errEmp

      const { error: errVinc } = await supabase
        .from('usuarios_empresas')
        .insert({
          user_id: user.id,
          empresa_id: empresaId,
          papel: 'admin'
        })

      if (errVinc) throw errVinc

      toast.success('Card em branco criado! Copie o link e envie ao cliente.')
      setForm({ nome: '', cnpj: '', email_login: '', tipo_empresa: 'ambos', datacar_token: '', datacar_cod_emp: '', datacar_id_operador: '', razao_social: '', nome_fantasia: '' })
      setDadosCnpj(null)
      setEditingId(null)
      setShowForm(false)
      await recarregar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar card em branco'
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  const handleBuscarCnpj = async () => {
    const cnpjLimpo = (form.cnpj || '').replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      toast.error('CNPJ inválido. Digite os 14 dígitos.')
      return
    }
    setBuscandoCnpj(true)
    try {
      const dados = await buscarCnpj(cnpjLimpo)
      if (!dados) {
        toast.error('CNPJ não encontrado na base da Receita Federal.')
        setDadosCnpj(null)
        return
      }
      setDadosCnpj(dados)
      setForm(prev => ({
        ...prev,
        razao_social: dados.razao_social || '',
        nome_fantasia: dados.nome_fantasia || '',
      }))
      toast.success('Dados da empresa encontrados!')
    } catch {
      toast.error('Erro ao consultar Brasil API. Tente novamente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  const handleEditClick = (empresa: Empresa) => {
    setEditingId(empresa.id)
    setForm({
      nome: empresa.nome || '',
      cnpj: empresa.cnpj || '',
      email_login: empresa.email_login || '',
      tipo_empresa: empresa.tipo_empresa || 'ambos',
      datacar_token: empresa.datacar_token || '',
      datacar_cod_emp: empresa.datacar_cod_emp || '',
      datacar_id_operador: empresa.datacar_id_operador || '',
      razao_social: empresa.razao_social || '',
      nome_fantasia: empresa.nome_fantasia || '',
    })
    setDadosCnpj(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {viewMode !== 'home' && (
            <button
              onClick={() => setViewMode('home')}
              className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-colors border border-dark-700"
              title="Voltar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {viewMode === 'home' ? 'Empresas' : viewMode === 'vendas' ? 'Empresas - Vendas' : 'Empresas - Contas a Pagar'}
            </h1>
            <p className="text-dark-400 text-sm mt-1">Gerencie as empresas do seu BPO</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setForm({ nome: '', cnpj: '', email_login: '', tipo_empresa: 'ambos', datacar_token: '', datacar_cod_emp: '', datacar_id_operador: '', razao_social: '', nome_fantasia: '' })
            setDadosCnpj(null)
            setShowForm(!showForm)
          }}
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all text-sm"
        >
          <Plus size={16} /> Nova Empresa
        </button>
      </div>

      {showForm && (
        <div className="bg-dark-800/60 backdrop-blur-md border border-brand-500/20 shadow-[0_8px_32px_rgba(var(--brand-500),0.15)] rounded-2xl p-6 sm:p-8 animate-fade-in relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null)
                setForm({ nome: '', cnpj: '', email_login: '', tipo_empresa: 'ambos', datacar_token: '', datacar_cod_emp: '', datacar_id_operador: '', razao_social: '', nome_fantasia: '' })
                setDadosCnpj(null)
                setShowForm(false)
              }}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 text-dark-400 hover:text-white transition-colors bg-dark-900/50 p-2 rounded-full hover:bg-dark-900 z-10"
            >
              ✕
            </button>
          )}

          <div className="mb-8 relative z-10">
            <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
              {editingId ? 'Editar Empresa' : 'Nova Empresa'}
            </h3>
            <p className="text-dark-400 text-xs sm:text-sm mt-1">Preencha os dados abaixo para configurar uma nova integração.</p>
          </div>

          <form onSubmit={handleSalvar} className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            
            {/* COLUNA ESQUERDA: Identidade (7 colunas em lg) */}
            <div className="lg:col-span-7 space-y-6">
              {/* O PROTAGONISTA: CNPJ */}
              <div className="bg-dark-900/40 p-1.5 rounded-xl border border-dark-700/50 shadow-inner focus-within:border-brand-500/50 focus-within:bg-dark-900/60 transition-all group">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                  <div className="hidden sm:block pl-4 pr-2 text-brand-500">
                    <Search size={20} className={buscandoCnpj ? 'animate-pulse' : ''} />
                  </div>
                  <input
                    value={form.cnpj}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
                      const masked = raw
                        .replace(/^(\d{2})(\d)/, '$1.$2')
                        .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
                        .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
                        .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, '$1-$2')
                      setForm({ ...form, cnpj: masked })
                    }}
                    placeholder="CNPJ (00.000.000/0000-00)"
                    required
                    className="flex-1 bg-transparent border-none px-4 py-3 sm:px-2 sm:text-lg text-white focus:ring-0 outline-none font-mono placeholder:text-dark-600"
                  />
                  <button
                    type="button"
                    onClick={handleBuscarCnpj}
                    disabled={buscandoCnpj || (form.cnpj || '').replace(/\D/g, '').length < 14}
                    className={`mt-2 sm:mt-0 sm:mr-1.5 px-6 py-3 sm:py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                      buscandoCnpj || (form.cnpj || '').replace(/\D/g, '').length < 14
                        ? 'bg-dark-800 text-dark-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    }`}
                  >
                    {buscandoCnpj ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} className="sm:hidden" />}
                    {buscandoCnpj ? 'Buscando...' : 'Buscar Dados'}
                  </button>
                </div>
              </div>

              {/* PAINEL DE RESULTADO GLASSMORPHISM */}
              {(dadosCnpj || form.razao_social) && (
                <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-xl rounded-xl p-5 animate-fade-in shadow-[0_8px_32px_rgba(16,185,129,0.05)]">
                  <div className="flex items-center gap-3 mb-4 border-b border-emerald-500/10 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Building2 size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-emerald-400 block">Identidade Oficial</span>
                      <span className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Brasil API</span>
                    </div>
                    {dadosCnpj && (
                      <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ml-auto border hidden sm:block ${
                        dadosCnpj.descricao_situacao_cadastral === 'ATIVA'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {dadosCnpj.descricao_situacao_cadastral}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <label className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold block mb-1">Razão Social</label>
                      <p className="text-white text-sm font-medium">{form.razao_social || '—'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold block mb-1">Nome Fantasia</label>
                      <p className="text-white text-sm font-medium">{form.nome_fantasia || '—'}</p>
                    </div>
                    {dadosCnpj && (
                      <>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold block mb-1">CNAE Principal</label>
                          <p className="text-dark-200 text-xs">{dadosCnpj.cnae_fiscal} — {dadosCnpj.cnae_fiscal_descricao}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold block mb-1">Endereço</label>
                          <p className="text-dark-200 text-xs">
                            {[dadosCnpj.descricao_tipo_de_logradouro, dadosCnpj.logradouro, dadosCnpj.numero].filter(Boolean).join(' ')}
                            {dadosCnpj.complemento ? `, ${dadosCnpj.complemento}` : ''}
                            {' — '}{dadosCnpj.bairro} — {dadosCnpj.municipio}/{dadosCnpj.uf} — CEP {dadosCnpj.cep}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* NOME POPULAR & TIPO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs text-dark-300 font-medium ml-1">Nome Popular (Como você chama)</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Auto Peças Silva"
                    required
                    className="w-full bg-dark-900/50 border border-dark-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all placeholder:text-dark-600 shadow-inner"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-dark-300 font-medium ml-1">Tipo de Integração</label>
                  <select
                    value={form.tipo_empresa}
                    onChange={(e) => setForm({ ...form, tipo_empresa: e.target.value as any })}
                    className="w-full bg-dark-900/50 border border-dark-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none transition-all appearance-none shadow-inner"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                  >
                    <option value="ambos">Ambos (Vendas e Financeiro)</option>
                    <option value="financeiro">Apenas Financeiro</option>
                    <option value="vendas">Apenas Vendas</option>
                  </select>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: Integrações (5 colunas em lg) */}
            <div className="lg:col-span-5 space-y-6 bg-dark-900/30 p-5 sm:p-6 rounded-2xl border border-dark-700/30 flex flex-col">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-400" />
                Configurações de Acesso
              </h4>

              {/* CONTA AZUL */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                    <Mail size={12} className="text-blue-400" />
                  </div>
                  <label className="text-xs font-semibold text-dark-200">Conta Azul</label>
                </div>
                <input
                  value={form.email_login}
                  onChange={(e) => setForm({ ...form, email_login: e.target.value })}
                  placeholder="E-mail de login (opcional)"
                  type="email"
                  className="w-full bg-dark-900/80 border border-dark-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-dark-600 shadow-inner"
                />
              </div>
              
              <div className="h-px w-full bg-gradient-to-r from-transparent via-dark-700/50 to-transparent my-1" />

              {/* DATACAR */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center">
                    <Unlink size={12} className="text-orange-400" />
                  </div>
                  <label className="text-xs font-semibold text-dark-200">API Datacar (Opcional)</label>
                </div>
                <div className="space-y-3">
                  <input
                    value={form.datacar_token}
                    onChange={(e) => setForm({ ...form, datacar_token: e.target.value })}
                    placeholder="Token de Acesso"
                    className="w-full bg-dark-900/80 border border-dark-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-dark-600 shadow-inner"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={form.datacar_cod_emp}
                      onChange={(e) => setForm({ ...form, datacar_cod_emp: e.target.value })}
                      placeholder="Cód. Empresa"
                      className="w-full bg-dark-900/80 border border-dark-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-dark-600 shadow-inner"
                    />
                    <input
                      value={form.datacar_id_operador}
                      onChange={(e) => setForm({ ...form, datacar_id_operador: e.target.value })}
                      placeholder="ID Operador"
                      className="w-full bg-dark-900/80 border border-dark-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-dark-600 shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* BOTÃO SALVAR E CRIAR VAZIO */}
              <div className="pt-6 mt-auto border-t border-dark-700/30 flex flex-col sm:flex-row gap-3">
                {!editingId && (
                  <button
                    type="button"
                    onClick={handleCriarVazio}
                    disabled={salvando}
                    className="flex-1 bg-dark-800 hover:bg-dark-700 disabled:opacity-50 text-white border border-dark-600 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {salvando ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Criar Vazio (Automático via Link)
                  </button>
                )}
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(var(--brand-500),0.2)] hover:shadow-[0_0_25px_rgba(var(--brand-500),0.4)]"
                >
                  {salvando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {salvando ? 'Salvando configuração...' : 'Salvar Empresa'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'home' && !showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <button
            onClick={() => setViewMode('vendas')}
            className="group relative overflow-hidden bg-dark-800/50 backdrop-blur-sm border border-dark-700 hover:border-blue-500/50 rounded-3xl p-8 sm:p-12 text-left transition-all hover:bg-dark-800 shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 flex flex-col items-center justify-center text-center h-64"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-5xl sm:text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10">🛒</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 relative z-10 group-hover:text-blue-400 transition-colors">Vendas</h2>
            <p className="text-dark-400 text-sm sm:text-base relative z-10">Acesse as configurações e os cadastros focados nas integrações de vendas (Datacar).</p>
          </button>

          <button
            onClick={() => setViewMode('contas_a_pagar')}
            className="group relative overflow-hidden bg-dark-800/50 backdrop-blur-sm border border-dark-700 hover:border-emerald-500/50 rounded-3xl p-8 sm:p-12 text-left transition-all hover:bg-dark-800 shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 flex flex-col items-center justify-center text-center h-64"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-5xl sm:text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10">💼</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 relative z-10 group-hover:text-emerald-400 transition-colors">Contas a Pagar</h2>
            <p className="text-dark-400 text-sm sm:text-base relative z-10">Acesse as integrações financeiras e importação de fornecedores (Conta Azul).</p>
          </button>
        </div>
      )}

      {viewMode !== 'home' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {empresas
            .filter(emp => viewMode === 'vendas' ? (emp.tipo_empresa === 'vendas' || emp.tipo_empresa === 'ambos') : (emp.tipo_empresa === 'financeiro' || emp.tipo_empresa === 'ambos'))
            .map((empresa) => {
              const isAtiva = empresaAtiva?.id === empresa.id;
              return (
                <EmpresaCard
                  key={empresa.id}
                  empresa={empresa}
                  isAtiva={isAtiva}
                  onSelect={() => setEmpresaAtiva(empresa)}
                  onEdit={() => handleEditClick(empresa)}
                  onDelete={() => handleExcluirEmpresa(empresa.id)}
                  conectando={conectando}
                  onConectarContaAzul={handleConectarContaAzul}
                  onDesconectar={handleDesconectar}
                  viewMode={viewMode}
                />
              );
          })}

          {empresas.filter(emp => viewMode === 'vendas' ? (emp.tipo_empresa === 'vendas' || emp.tipo_empresa === 'ambos') : (emp.tipo_empresa === 'financeiro' || emp.tipo_empresa === 'ambos')).length === 0 && !showForm && (
            <div className="lg:col-span-2 py-20 flex flex-col items-center justify-center border-2 border-dashed border-dark-700 rounded-2xl">
              <Building2 size={48} className="text-dark-700 mb-4" />
              <p className="text-dark-400">Nenhuma empresa encontrada para esta categoria.</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-brand-400 font-semibold mt-2 hover:text-brand-300 transition-colors"
              >
                Cadastrar agora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function EmpresasPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    }>
      <EmpresasPageContent />
    </Suspense>
  )
}
