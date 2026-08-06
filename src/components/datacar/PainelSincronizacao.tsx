'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
// import removed
import type { Empresa } from '@/types'
type ContaPagarPreview = any;
import {
  Search, Loader2, FileText, ShoppingCart, Calendar,
  Download, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  AlertTriangle, Eye, X
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  empresa: {
    id: string
    nome: string
    datacar_token?: string | null
    datacar_cod_emp?: string | null
    datacar_id_operador?: string | null
  }
}

interface ContaPagarResult {
  fornecedor: string
  valor: number
  vencimento: string
  emissao?: string | null
  doc?: string | null
  categoria?: string | null
  descricao?: string | null
  valido: boolean
  erros?: string[]
  _datacar?: Record<string, unknown>
}

interface VendaResult {
  cliente: string
  os_numero: string
  data_venda: string
  valor_total: number
  forma_pagamento?: string
  itens: { codigo: string; descricao: string; quantidade: number; valor_unitario: number; valor_unitario_original?: number; desconto?: number; tipo?: 'produto' | 'servico' }[]
  valido: boolean
  erros?: string[]
  _datacar?: Record<string, unknown>
  ca_status?: 'nao_enviado' | 'enviado_sem_nota' | 'enviado_com_nota'
  ca_nfe_numero?: string
}

export default function PainelSincronizacao({ empresa }: Props) {
  const hoje = new Date().toISOString().split('T')[0]
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const [tab, setTab] = useState<'contas' | 'vendas'>('contas')
  const [dtIni, setDtIni] = useState(primeiroDia)
  const [dtFim, setDtFim] = useState(hoje)
  const [buscando, setBuscando] = useState(false)

  // Contas a Pagar
  const [contasPreviewDados, setContasPreviewDados] = useState<ContaPagarPreview[] | null>(null)
  const [enviandoContas, setEnviandoContas] = useState(false)

  // Vendas
  const [vendasResultado, setVendasResultado] = useState<VendaResult[] | null>(null)
  const [vendasMeta, setVendasMeta] = useState<{ total: number; validos: number; invalidos: number } | null>(null)
  const [tipoPeriodoVendas, setTipoPeriodoVendas] = useState<'abertura' | 'previsao' | 'conclusao' | 'encerramento' | 'cancelamento'>('encerramento')
  const [situacaoVendas, setSituacaoVendas] = useState<'todas' | 'em_andamento' | 'concluida' | 'encerrada' | 'cancelada'>('todas')
  const [numeroOS, setNumeroOS] = useState('')
  const [filtroVendas, setFiltroVendas] = useState<'tudo' | 'produtos' | 'servicos'>('tudo')
  const [enviandoVendas, setEnviandoVendas] = useState(false)
  const [selecionadasVendas, setSelecionadasVendas] = useState<Set<string>>(new Set())
  const [ocultadasVendas, setOcultadasVendas] = useState<Set<string>>(new Set())

  // Expandir detalhes
  const [expandido, setExpandido] = useState<number | null>(null)

  const supabase = createClient()

  const temCredenciais = !!empresa.datacar_token && !!empresa.datacar_cod_emp && !!empresa.datacar_id_operador

  const [tipoPeriodoContas, setTipoPeriodoContas] = useState<'venc' | 'emis' | 'pgto' | 'digit'>('venc')

  const handleBuscarContas = async () => {
    setBuscando(true)
    setContasPreviewDados(null)
    try {
      const res = await fetch('/api/datacar/buscar-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id, dtIni, dtFim, tipoPeriodo: tipoPeriodoContas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar contas')

      // Converter para ContaPagarPreview[] com datas formatadas
      const dadosPreview: ContaPagarPreview[] = (data.dados || []).map((d: ContaPagarResult) => {
        const converterData = (dt: string | null | undefined) => {
          if (!dt) return undefined
          const dataStr = dt.split('T')[0].split(' ')[0]
          if (dataStr.includes('/')) {
            const [dia, mes, ano] = dataStr.split('/')
            if (dia && mes && ano) return `${ano}-${mes}-${dia}`
          }
          return dataStr
        }

        return {
          fornecedor: d.fornecedor,
          valor: d.valor,
          vencimento: converterData(d.vencimento) || d.vencimento,
          emissao: converterData(d.emissao),
          doc: d.doc || undefined,
          categoria: d.categoria || undefined,
          descricao: d.descricao || undefined,
          valido: d.valido,
          erros: d.erros,
        }
      })

      setContasPreviewDados(dadosPreview)
      toast.success(`${data.total} contas a pagar encontradas!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar contas a pagar')
    } finally {
      setBuscando(false)
    }
  }

  const handleBuscarVendas = async () => {
    if (!numeroOS && (!dtIni || !dtFim)) {
      toast.error('Preencha a data de início e fim, ou informe um Número de OS.')
      return
    }
    setBuscando(true)
    setVendasResultado(null)
    setVendasMeta(null)
    try {
      // Datacar mapeia Abertura como 'criacao', e as demais mantem o nome base
      let mappedTipoPeriodo = tipoPeriodoVendas as string
      if (tipoPeriodoVendas === 'abertura') mappedTipoPeriodo = 'criacao'

      const res = await fetch('/api/datacar/buscar-vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          empresa_id: empresa.id, 
          dtIni, 
          dtFim, 
          tipoPeriodo: mappedTipoPeriodo,
          situacao: situacaoVendas,
          numeroOS: numeroOS.trim() || undefined
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar vendas')

      setVendasResultado(data.dados)
      setVendasMeta({ total: data.total, validos: data.validos, invalidos: data.invalidos })
      
      // Seleciona todas as válidas que NÃO possuem alerta de duplicidade
      const validas = data.dados
        .filter((d: any) => d.valido && !d.ca_status)
        .map((d: any) => d.os_numero)
      setSelecionadasVendas(new Set(validas))
      setOcultadasVendas(new Set())

      toast.success(`${data.total} OS/Pedidos encontrados!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar vendas')
    } finally {
      setBuscando(false)
    }
  }

  const handleSalvarContasPreview = async (itens: ContaPagarPreview[]) => {
    if (itens.length === 0) { toast.error('Selecione ao menos um registro'); return }
    setEnviandoContas(true)
    try {
      const itensParaSalvar = itens.map((d) => ({
        empresa_id: empresa.id,
        fornecedor: d.fornecedor.trim(),
        valor: d.valor,
        vencimento: d.vencimento || new Date().toISOString().split('T')[0],
        categoria: d.categoria || 'Materiais para Revenda',
        conta_financeira: d.conta_financeira || null,
        conta_financeira_id: d.conta_financeira_id || null,
        descricao: d.descricao || null,
        doc: d.doc || null,
        emissao: d.emissao || null,
        status: 'pendente',
      }))

      // Verificar duplicatas
      const fornecedores = itensParaSalvar.map(i => i.fornecedor)
      const { data: existentes } = await supabase
        .from('contas_pagar_importadas')
        .select('fornecedor, valor, vencimento')
        .eq('empresa_id', empresa.id)
        .in('fornecedor', fornecedores)

      const contasNovas = itensParaSalvar.filter(item => {
        const jaExiste = existentes?.some(e =>
          e.fornecedor === item.fornecedor &&
          Number(e.valor) === Number(item.valor) &&
          e.vencimento === item.vencimento
        )
        return !jaExiste
      })

      if (contasNovas.length === 0) {
        toast.success('Sucesso! As contas já estavam salvas no Card de Contas a Pagar.')
        setContasPreviewDados(null)
        setEnviandoContas(false)
        return
      }

      const { data, error } = await supabase
        .from('contas_pagar_importadas')
        .insert(contasNovas)
        .select('id')

      if (error) throw error

      toast.success(`Sucesso! ${data.length} novas contas salvas no Card de Contas a Pagar.`)
      setContasPreviewDados(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar contas no Card')
    } finally {
      setEnviandoContas(false)
    }
  }

  const handleSincronizarVendas = async () => {
    if (!vendasResultado) return
    setEnviandoVendas(true)
    try {
      // Filtrar itens e recalcular valor
      const vendasParaEnviar = vendasResultado.map(v => {
        let itensFiltrados = v.itens
        if (filtroVendas === 'produtos') itensFiltrados = v.itens.filter(i => i.tipo === 'produto')
        if (filtroVendas === 'servicos') itensFiltrados = v.itens.filter(i => i.tipo === 'servico')
        
        const valorTotalRecalculado = itensFiltrados.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0)
        
        let dataFormatada = null
        if (v.data_venda) {
          const dataStr = v.data_venda.split('T')[0].split(' ')[0]
          if (dataStr.includes('/')) {
            const [dia, mes, ano] = dataStr.split('/')
            if (dia && mes && ano) dataFormatada = `${ano}-${mes}-${dia}`
            else dataFormatada = dataStr
          } else {
            dataFormatada = dataStr
          }
        }
        
        return {
          empresa_id: empresa.id,
          cliente: v.cliente,
          os_numero: v.os_numero,
          // Convertemos para data simples YYYY-MM-DD
          data_venda: dataFormatada,
          valor_total: parseFloat(valorTotalRecalculado.toFixed(2)),
          forma_pagamento: v.forma_pagamento || null,
          itens: itensFiltrados,
          status: 'pendente',
          // Coluna correta na tabela: dados_datacar (JSONB)
          dados_datacar: v._datacar || {},
          // Flag temporária (não vai para o banco)
          valido: v.valido && itensFiltrados.length > 0 && valorTotalRecalculado > 0
        }
      }).filter(v => v.valido && selecionadasVendas.has(v.os_numero))

      if (vendasParaEnviar.length === 0) {
        toast.error('Nenhuma OS selecionada/válida para o filtro.')
        return
      }

      const toastId = toast.loading(`Salvando ${vendasParaEnviar.length} vendas no Card de Vendas...`)
      
      const osNumeros = vendasParaEnviar.map(v => v.os_numero)
      
      // Verifica quais já existem
      const { data: existentes } = await supabase
        .from('vendas_importadas')
        .select('os_numero')
        .eq('empresa_id', empresa.id)
        .in('os_numero', osNumeros)

      const existentesSet = new Set(existentes?.map(e => e.os_numero) || [])
      const novasVendas = vendasParaEnviar.filter(v => !existentesSet.has(v.os_numero))

      if (novasVendas.length === 0) {
        toast.dismiss(toastId)
        toast.success('Sucesso! As vendas já estavam salvas no Card de Vendas.')
        setVendasResultado(null)
        setVendasMeta(null)
        setEnviandoVendas(false)
        return
      }

      // Remove a flag 'valido' antes de inserir (não é coluna da tabela)
      const { data, error } = await supabase
        .from('vendas_importadas')
        .insert(novasVendas.map(({ valido, ...rest }) => rest))
        .select('id')
      
      toast.dismiss(toastId)
      
      if (error) throw error
      
      if (data && data.length > 0) {
        toast.success(`Sucesso! ${data.length} novas vendas salvas no Card de Vendas. Acesse a aba Vendas para conferir e enviar ao Conta Azul.`)
      }
      
      // Limpa os resultados para obrigar nova busca
      setVendasResultado(null)
      setVendasMeta(null)
      setSelecionadasVendas(new Set())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar vendas no Card')
    } finally {
      setEnviandoVendas(false)
    }
  }

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const formatDate = (dt: string) => {
    if (!dt) return '-'
    try {
      const d = new Date(dt)
      if (isNaN(d.getTime())) return dt
      return d.toLocaleDateString('pt-BR')
    } catch { return dt }
  }

  if (!temCredenciais) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center">
        <AlertCircle size={40} className="text-dark-600 mx-auto mb-3" />
        <p className="text-dark-400 text-sm">Configure as credenciais do Datacar acima para poder buscar dados.</p>
      </div>
    )
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-dark-700">
        <button
          onClick={() => { setTab('contas'); setExpandido(null) }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all ${
            tab === 'contas'
              ? 'bg-dark-700/50 text-orange-400 border-b-2 border-orange-400'
              : 'text-dark-400 hover:text-white hover:bg-dark-700/30'
          }`}
        >
          <FileText size={16} /> Contas a Pagar
          {contasPreviewDados && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{contasPreviewDados.length}</span>}
        </button>
        <button
          onClick={() => { setTab('vendas'); setExpandido(null) }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all ${
            tab === 'vendas'
              ? 'bg-dark-700/50 text-blue-400 border-b-2 border-blue-400'
              : 'text-dark-400 hover:text-white hover:bg-dark-700/30'
          }`}
        >
          <ShoppingCart size={16} /> Vendas (OS/Pedidos)
          {vendasMeta && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{vendasMeta.total}</span>}
        </button>
      </div>

      {/* Filtros */}
      <div className="p-4 border-b border-dark-700 bg-dark-900/30">
        <div className="flex items-end gap-4 flex-wrap">
          {/* 1. Tipo Período / Pesquisar por */}
          <div>
            <label className={`text-xs font-medium mb-1 flex items-center gap-2 ${numeroOS && tab === 'vendas' ? 'text-dark-600' : 'text-dark-400'}`}>
              {tab === 'contas' ? 'Pesquisar por:' : 'Tipo período:'}
            </label>
            <select
              value={tab === 'contas' ? tipoPeriodoContas : tipoPeriodoVendas}
              onChange={(e) => {
                if (tab === 'contas') setTipoPeriodoContas(e.target.value as any)
                else setTipoPeriodoVendas(e.target.value as any)
              }}
              disabled={tab === 'vendas' && !!numeroOS}
              className={`bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none ${(tab === 'vendas' && !!numeroOS) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab === 'contas' ? (
                <>
                  <option value="venc">Vencimento</option>
                  <option value="emis">Emissão</option>
                  <option value="pgto">Pagamento</option>
                  <option value="digit">Digitação no Sistema</option>
                </>
              ) : (
                <>
                  <option value="abertura">Abertura</option>
                  <option value="previsao">Previsão</option>
                  <option value="conclusao">Conclusão</option>
                  <option value="encerramento">Encerramento</option>
                  <option value="cancelamento">Cancelamento</option>
                </>
              )}
            </select>
          </div>

          {/* 2. Datas */}
          <div>
            <label className={`text-xs font-medium mb-1 block ${numeroOS && tab === 'vendas' ? 'text-dark-600' : 'text-dark-400'}`}>Data Início</label>
            <div className="relative">
              <Calendar size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${numeroOS && tab === 'vendas' ? 'text-dark-600' : 'text-dark-400'}`} />
              <input
                type="date"
                value={dtIni}
                onChange={(e) => setDtIni(e.target.value)}
                disabled={tab === 'vendas' && !!numeroOS}
                className={`bg-dark-900 border border-dark-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-40 ${(tab === 'vendas' && !!numeroOS) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
          <div>
            <label className={`text-xs font-medium mb-1 block ${numeroOS && tab === 'vendas' ? 'text-dark-600' : 'text-dark-400'}`}>Data Fim</label>
            <div className="relative">
              <Calendar size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${numeroOS && tab === 'vendas' ? 'text-dark-600' : 'text-dark-400'}`} />
              <input
                type="date"
                value={dtFim}
                onChange={(e) => setDtFim(e.target.value)}
                disabled={tab === 'vendas' && !!numeroOS}
                className={`bg-dark-900 border border-dark-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-40 ${(tab === 'vendas' && !!numeroOS) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* 3. Situação (Apenas Vendas) e Número OS */}
          {tab === 'vendas' && (
            <>
              <div>
                <label className={`text-xs font-medium mb-1 block ${numeroOS ? 'text-dark-600' : 'text-dark-400'}`}>Situação:</label>
                <select
                  value={situacaoVendas}
                  onChange={(e) => setSituacaoVendas(e.target.value as any)}
                  disabled={!!numeroOS}
                  className={`bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none ${numeroOS ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="todas">Todas</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluídas</option>
                  <option value="encerrada">Encerradas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-dark-400 font-medium mb-1 block">Nº da OS:</label>
                <input
                  type="text"
                  placeholder="Ex: 12345"
                  value={numeroOS}
                  onChange={(e) => setNumeroOS(e.target.value)}
                  className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-28"
                />
              </div>
            </>
          )}

          {/* Botão Buscar */}
          <button
            onClick={tab === 'contas' ? handleBuscarContas : handleBuscarVendas}
            disabled={buscando}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all text-white ml-auto sm:ml-0 ${
              buscando ? 'bg-dark-700 text-dark-500' :
              tab === 'contas' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {buscando ? 'Buscando no Datacar...' : `Buscar ${tab === 'contas' ? 'Contas' : 'Vendas'}`}
          </button>
        </div>
      </div>

      {/* Resultados Contas a Pagar - indisponível neste app */}
      {tab === 'contas' && contasPreviewDados && contasPreviewDados.length > 0 && (
        <div className="p-4 text-center text-dark-400">
          <p className="text-sm">Contas a Pagar encontradas: {contasPreviewDados.length}</p>
          <p className="text-xs mt-1">Use o app de Contas a Pagar para gerenciar estas contas.</p>
        </div>
      )}

      {/* Resultados Vendas */}
      {tab === 'vendas' && vendasMeta && (
        <div>
          {/* Resumo */}
          <div className="flex items-center gap-4 p-4 bg-dark-900/20 border-b border-dark-700 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Download size={14} className="text-blue-400" />
              <span className="text-dark-300">
                <strong className="text-white">{vendasMeta.total}</strong> OS/Pedidos encontrados
              </span>
            </div>
            <span className="text-emerald-400 text-xs font-semibold">{vendasMeta.validos} válidos</span>
            {vendasMeta.invalidos > 0 && (
              <span className="text-red-400 text-xs font-semibold">{vendasMeta.invalidos} com problemas</span>
            )}
            <span className="ml-auto text-white font-bold text-sm">
              Total: {formatCurrency((vendasResultado || []).reduce((s, v) => s + v.valor_total, 0))}
            </span>
          </div>

          {/* Filtro e Botão Salvar no Card Vendas */}
          <div className="p-4 bg-blue-900/10 border-b border-dark-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-dark-300 font-medium">Filtrar para Card Vendas:</span>
              <select
                value={filtroVendas}
                onChange={(e) => setFiltroVendas(e.target.value as any)}
                className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
              >
                <option value="tudo">Produtos e Serviços</option>
                <option value="produtos">Apenas Produtos (Peças)</option>
                <option value="servicos">Apenas Serviços</option>
              </select>
            </div>
            <button
              onClick={handleSincronizarVendas}
              disabled={enviandoVendas || selecionadasVendas.size === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
            >
              {enviandoVendas ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
              Salvar {selecionadasVendas.size} OS no Card Vendas
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-[500px] overflow-y-auto">
            {/* Header da Tabela com Master Checkbox */}
            {vendasResultado && vendasResultado.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-900/60 border-b border-dark-700 text-xs text-dark-400 font-semibold sticky top-0 z-10 backdrop-blur-sm">
                <input
                  type="checkbox"
                  checked={selecionadasVendas.size > 0 && selecionadasVendas.size === vendasResultado.filter(v => v.valido).length}
                  onChange={() => {
                    const validas = vendasResultado.filter(v => v.valido).map(v => v.os_numero)
                    if (selecionadasVendas.size === validas.length) setSelecionadasVendas(new Set())
                    else setSelecionadasVendas(new Set(validas))
                  }}
                  className="accent-blue-500"
                />
                <span className="w-14 text-center">STATUS</span>
                <span className="w-14">OS Nº</span>
                <span className="flex-1">CLIENTE</span>
                <span className="w-24 text-right">VALOR TOTAL</span>
                <span className="w-24 text-right">DATA</span>
                <span className="w-4"></span>
              </div>
            )}

            {(vendasResultado || []).filter(v => !ocultadasVendas.has(v.os_numero)).map((venda, i) => (
              <div key={i} className={`border-b border-dark-700/50 hover:bg-dark-700/20 transition-colors ${
                !venda.valido ? 'bg-red-500/5' : venda.ca_status === 'enviado_com_nota' ? 'bg-emerald-500/5' : venda.ca_status === 'enviado_sem_nota' ? 'bg-amber-500/5' : ''
              }`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandido(expandido === i ? null : i)}
                >
                  <input
                    type="checkbox"
                    checked={selecionadasVendas.has(venda.os_numero)}
                    disabled={!venda.valido}
                    onChange={(e) => {
                      e.stopPropagation()
                      setSelecionadasVendas(prev => {
                        const next = new Set(prev)
                        if (next.has(venda.os_numero)) next.delete(venda.os_numero)
                        else next.add(venda.os_numero)
                        return next
                      })
                    }}
                    onClick={e => e.stopPropagation()}
                    className="accent-blue-500 disabled:opacity-30"
                  />
                  {venda.ca_status === 'enviado_com_nota' ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 whitespace-nowrap" title={venda.ca_nfe_numero ? `NFe ${venda.ca_nfe_numero}` : 'NFe emitida'}>
                      <CheckCircle2 size={10} /> NFe {venda.ca_nfe_numero || 'Emitida'}
                    </span>
                  ) : venda.ca_status === 'enviado_sem_nota' ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 whitespace-nowrap" title="Venda encontrada no CA sem nota">
                      <AlertTriangle size={10} /> No CA
                    </span>
                  ) : venda.valido ? (
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-dark-500 text-xs font-mono w-14">#{venda.os_numero}</span>
                  <span className="text-white text-sm font-medium flex-1 truncate">{venda.cliente}</span>
                  <span className="text-white text-sm font-bold tabular-nums w-24 text-right">{formatCurrency(venda.valor_total)}</span>
                  <span className="text-dark-400 text-xs tabular-nums w-24 text-right">{formatDate(venda.data_venda)}</span>
                  <div className="flex items-center gap-1 w-8 justify-end">
                    {venda.ca_status && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOcultadasVendas(prev => {
                            const next = new Set(prev)
                            next.add(venda.os_numero)
                            return next
                          })
                          // Remove da seleção também
                          setSelecionadasVendas(prev => {
                            const next = new Set(prev)
                            next.delete(venda.os_numero)
                            return next
                          })
                        }}
                        title="Ocultar da lista (já está no CA)"
                        className="text-dark-600 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {expandido === i ? <ChevronUp size={14} className="text-dark-500" /> : <ChevronDown size={14} className="text-dark-500" />}
                  </div>
                </div>
                {expandido === i && (
                  <div className="px-4 pb-3 pt-0 text-xs text-dark-400 space-y-1 animate-fade-in border-t border-dark-700/30 mx-4">
                    {venda._datacar?.vendedor ? <p><strong className="text-dark-300">Vendedor:</strong> {String(venda._datacar.vendedor)}</p> : null}
                    {venda._datacar?.veiculo ? <p><strong className="text-dark-300">Veículo:</strong> {String(venda._datacar.veiculo)}</p> : null}
                    {venda._datacar?.cliente_cpf_cnpj ? <p><strong className="text-dark-300">CPF/CNPJ:</strong> {String(venda._datacar.cliente_cpf_cnpj)}</p> : null}
                    {/* Endereço completo do cliente */}
                    {(venda._datacar?.cliente_logradouro || venda._datacar?.cliente_cidade) ? (
                      <p>
                        <strong className="text-dark-300">Endereço:</strong>{' '}
                        {[venda._datacar.cliente_logradouro, venda._datacar.cliente_numero, venda._datacar.cliente_complemento].filter(Boolean).map(String).join(', ')}
                        {venda._datacar.cliente_bairro ? ` — ${String(venda._datacar.cliente_bairro)}` : ''}
                        {venda._datacar.cliente_cidade ? ` — ${String(venda._datacar.cliente_cidade)}` : ''}
                        {venda._datacar.cliente_uf ? `/${String(venda._datacar.cliente_uf)}` : ''}
                        {venda._datacar.cliente_cep ? ` CEP: ${String(venda._datacar.cliente_cep)}` : ''}
                      </p>
                    ) : null}
                    {venda.forma_pagamento && <p><strong className="text-dark-300">Pagamento:</strong> {venda.forma_pagamento}</p>}
                    {venda.itens.length > 0 && (
                      <div className="mt-2">
                        <p className="text-dark-300 font-semibold mb-1">Itens ({venda.itens.length}):</p>
                        <div className="bg-dark-900/60 rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                          {venda.itens.map((item, j) => (
                            <div key={j} className="flex flex-col gap-1 text-[11px] border-b border-dark-700/50 pb-1 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.tipo === 'produto' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-pink-500/20 text-pink-400'}`}>
                                  {item.tipo === 'produto' ? 'PEÇA' : 'SERV'}
                                </span>
                                <span className="text-dark-500 w-8 text-right">{item.quantidade}x</span>
                                <span className="text-dark-300 flex-1 truncate">
                                  {item.codigo && <span className="text-blue-400 font-mono mr-2">[{item.codigo}]</span>}
                                  {item.descricao}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-3 text-[10px]">
                                <span className="text-dark-400">Bruto: {formatCurrency(item.valor_unitario_original || item.valor_unitario)}</span>
                                {(item.desconto ?? 0) > 0 && (
                                  <span className="text-orange-400">Desc: {formatCurrency(item.desconto || 0)}</span>
                                )}
                                <span className="text-white font-semibold">Líq: {formatCurrency(item.valor_unitario)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tab === 'contas' && !contasPreviewDados && !buscando && (
        <div className="p-12 text-center">
          <FileText size={40} className="text-dark-700 mx-auto mb-3" />
          <p className="text-dark-500 text-sm">Selecione o período e clique em &quot;Buscar Contas a Pagar&quot;</p>
        </div>
      )}
      {tab === 'vendas' && !vendasMeta && !buscando && (
        <div className="p-12 text-center">
          <ShoppingCart size={40} className="text-dark-700 mx-auto mb-3" />
          <p className="text-dark-500 text-sm">Selecione o período e clique em &quot;Buscar Vendas&quot;</p>
        </div>
      )}

      {/* Loading state */}
      {buscando && (
        <div className="p-12 text-center">
          <Loader2 size={32} className="text-orange-400 animate-spin mx-auto mb-3" />
          <p className="text-dark-400 text-sm">Buscando dados do Datacar...</p>
          <p className="text-dark-600 text-xs mt-1">Isso pode levar alguns segundos</p>
        </div>
      )}
    </div>
  )
}

