'use client'

import { useState, useCallback, useEffect } from 'react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { createClient } from '@/lib/supabase/client'
import DropZoneVendas from '@/components/upload/DropZoneVendas'
import TabelaVendasPreview from '@/components/upload/TabelaVendasPreview'
import ModalEditarVenda from '@/components/upload/ModalEditarVenda'
import ModalEditarDatacar from '@/components/upload/ModalEditarDatacar'
import ModalDetalheVendaDatacar from '@/components/upload/ModalDetalheVendaDatacar'
import ModalVendasCliente from '@/components/upload/ModalVendasCliente'
import SelectorEmpresa from '@/components/layout/SelectorEmpresa'
import PainelAgendamento from '@/components/agendamento/PainelAgendamento'
import type { VendaPreview, ResultadoImportacaoVendas } from '@/types'
import {
  Upload, ArrowLeft, Loader2,
  CheckCircle, AlertCircle, Send, ShoppingCart,
  Database, RefreshCw, ChevronDown, ChevronUp,
  Trash2, FileSpreadsheet, BookOpen,
  Search, Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'

type Etapa = 'upload' | 'preview'
type SubAba = 'datacar' | 'planilha'

interface VendaImportada {
  id: string
  cliente: string
  os_numero: string
  data_venda: string | null
  valor_total: number
  forma_pagamento: string | null
  itens: Array<{
    codigo: string
    descricao: string
    quantidade: number
    valor_unitario: number
    valor_unitario_original?: number
    desconto?: number
    tipo?: 'produto' | 'servico'
    ncm?: string
    cest?: string
    origem?: string
    tipo_produto?: string
    unidade_medida?: string
  }>
  status: string
  dados_datacar: Record<string, unknown> | null
  created_at: string
}

export default function VendasPage() {
  const { empresaAtiva } = useEmpresa()
  const supabase = createClient()

  // Sub-aba ativa
  const [subAba, setSubAba] = useState<SubAba>('datacar')

  // ─── Estado da sub-aba Datacar ───────────────────────────────
  const hoje = new Date().toISOString().split('T')[0]
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  
  const [dtIni, setDtIni] = useState(primeiroDia)
  const [dtFim, setDtFim] = useState(hoje)
  const [buscando, setBuscando] = useState(false)
  const [tipoPeriodoVendas, setTipoPeriodoVendas] = useState<'criacao' | 'conclusao' | 'encerramento'>('encerramento')
  const [situacaoVendas, setSituacaoVendas] = useState<'todas' | 'em_andamento' | 'concluida' | 'encerrada' | 'cancelada'>('todas')
  const [numeroOS, setNumeroOS] = useState('')
  const [filtroTipoItens, setFiltroTipoItens] = useState<'tudo' | 'produtos' | 'servicos'>('produtos')
  const [vendasDatacar, setVendasDatacar] = useState<any[]>([])
  const [selecionadosDatacar, setSelecionadosDatacar] = useState<Set<string>>(new Set())
  const [expandidoDatacar, setExpandidoDatacar] = useState<string | null>(null)
  const [enviandoDatacar, setEnviandoDatacar] = useState(false)
  const [editandoDatacarId, setEditandoDatacarId] = useState<string | null>(null)
  const [modalClienteDoc, setModalClienteDoc] = useState<string | null>(null)

  // ─── Estado do Upload de Planilha Fiscal ───────────────────
  const [showPlanilhaFiscal, setShowPlanilhaFiscal] = useState(false)
  const [uploadingPlanilha, setUploadingPlanilha] = useState(false)
  const [resultadoPlanilha, setResultadoPlanilha] = useState<{
    salvos: number; erros: number; ignorados: number;
    totalLinhas: number; familiasEncontradas: number;
    exemplos: string[];
  } | null>(null)

  const handleUploadPlanilhaFiscal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !empresaAtiva) return

    setUploadingPlanilha(true)
    setResultadoPlanilha(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('empresa_id', empresaAtiva.id)

      const res = await fetch('/api/memoria-fiscal/importar-planilha', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao importar')

      setResultadoPlanilha(data)
      toast.success(`${data.salvos} famílias de produtos aprendidas com sucesso!`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar planilha'
      toast.error(msg)
    } finally {
      setUploadingPlanilha(false)
      // Reset o input para permitir reimportar
      e.target.value = ''
    }
  }

  // ─── Estado da sub-aba Planilha ──────────────────────────────
  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [resultado, setResultado] = useState<ResultadoImportacaoVendas | null>(null)
  const [dadosEditados, setDadosEditados] = useState<VendaPreview[]>([])
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [enviandoCA, setEnviandoCA] = useState(false)
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)

  // ─── Buscar vendas do Datacar ──────────────────────────────
  const handleBuscarVendasDatacar = async () => {
    if (!empresaAtiva) { toast.error('Selecione uma empresa primeiro'); return }
    if (!empresaAtiva.datacar_token) {
      toast.error('Configure as credenciais do Datacar para esta empresa na tela de Empresas.')
      return
    }
    if (!numeroOS && (!dtIni || !dtFim)) {
      toast.error('Preencha a data de início e fim, ou informe um Número de OS.')
      return
    }

    setBuscando(true)
    setVendasDatacar([])
    try {
      const mappedTipoPeriodo = tipoPeriodoVendas as string

      const res = await fetch('/api/datacar/buscar-vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          empresa_id: empresaAtiva.id, 
          dtIni, 
          dtFim, 
          tipoPeriodo: mappedTipoPeriodo,
          situacao: situacaoVendas,
          numeroOS: numeroOS.trim() || undefined
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar vendas no Datacar')

      // Mapear resultado para manter compatibilidade visual com VendaImportada
      const validas: any[] = data.dados.map((d: any) => ({
        id: crypto.randomUUID(), // ID temporário apenas para manipulação na tela
        cliente: d.cliente,
        cliente_cpf_cnpj: d.cliente_cpf_cnpj || d._datacar?.cliente_cpf_cnpj || null,
        cliente_endereco: d.cliente_endereco || null,
        os_numero: d.os_numero,
        data_venda: d.data_venda,
        valor_total: d.valor_total,
        forma_pagamento: d.forma_pagamento,
        itens: d.itens,
        status: d.ca_status === 'cliente_existente' ? 'alerta_cliente' : (d.ca_status ? 'duplicidade' : 'pendente'),
        dados_datacar: d._datacar || d,
        valido: d.valido,
        erros: d.erros,
      }))

      setVendasDatacar(validas)
      
      // Auto-selecionar as pendentes e válidas
      const validasIds = validas
        .filter(v => v.status === 'pendente' && v.valido)
        .map(v => v.id)
      setSelecionadosDatacar(new Set(validasIds))

      toast.success(`${data.total} OS/Pedidos encontrados!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar vendas')
    } finally {
      setBuscando(false)
    }
  }

  // ─── Toggles Datacar ─────────────────────────────────────────
  const toggleSelecionadoDatacar = (id: string) => {
    setSelecionadosDatacar(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleTodosDatacar = () => {
    const pendentes = vendasDatacar.filter(v => v.status === 'pendente').map(v => v.id)
    if (selecionadosDatacar.size === pendentes.length) {
      setSelecionadosDatacar(new Set())
    } else {
      setSelecionadosDatacar(new Set(pendentes))
    }
  }

  const removerVendaDatacar = async (id: string) => {
    if (!confirm('Remover esta venda da lista? Ela sairá do seu painel e não será enviada.')) return
    setVendasDatacar(prev => prev.filter(v => v.id !== id))
    toast.success('Venda ignorada da lista de importação.')
  }

  // ─── Enviar para Conta Azul (vindas do Datacar) ──────────────
  const handleEnviarDatacarParaCA = async () => {
    if (!empresaAtiva) { toast.error('Selecione uma empresa'); return }
    if (selecionadosDatacar.size === 0) { toast.error('Selecione ao menos uma venda'); return }

    setEnviandoDatacar(true)
    try {
      const vendasFiltradas = vendasDatacar
        .filter(v => selecionadosDatacar.has(v.id))
        .map(v => {
          let itensFiltrados = v.itens
          if (filtroTipoItens === 'produtos') itensFiltrados = v.itens.filter((i: any) => i.tipo === 'produto')
          if (filtroTipoItens === 'servicos') itensFiltrados = v.itens.filter((i: any) => i.tipo === 'servico')
          
          const valorTotalRecalculado = itensFiltrados.reduce((acc: number, i: any) => acc + (i.quantidade * i.valor_unitario), 0)
          
          return {
            ...v,
            itens: itensFiltrados,
            valor_total: valorTotalRecalculado
          }
        })
        .filter(v => v.itens.length > 0)

      if (vendasFiltradas.length === 0) {
        setEnviandoDatacar(false)
        toast.error('O filtro de itens excluiu todas as vendas selecionadas. Não há nada para enviar.')
        return
      }
      
      // Converte para o formato esperado pelo endpoint de envio do CA
      const vendasFormatadas = vendasFiltradas.map(v => ({
        id_original: v.id,
        cliente: v.cliente,
        cliente_cpf_cnpj: v.dados_datacar?.cliente_cpf_cnpj || v.cliente_cpf_cnpj || undefined,
        cliente_endereco: v.dados_datacar?.cliente_endereco || v.cliente_endereco || undefined,
        os_numero: v.os_numero,
        data_venda: v.data_venda,
        valor_total: v.valor_total,
        forma_pagamento: v.forma_pagamento,
        itens: v.itens,
        valido: true,
      }))

      let sucessosTotais = 0;
      let errosTotais = 0;
      const detalhesErros: string[] = [];
      const idsSucesso = new Set<string>();
      const idsErro = new Map<string, string>();

      // Envia as vendas uma a uma para evitar timeout na Vercel (limite de 10s-60s)
      for (const venda of vendasFormatadas) {
        try {
          const res = await fetch('/api/conta-azul/enviar-vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresa_id: empresaAtiva.id,
              vendas: [venda]
            }),
          })
          
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Erro ao enviar venda')
          
          if (data.sucessos > 0) {
            sucessosTotais += data.sucessos;
            if (venda.id_original) idsSucesso.add(venda.id_original);
          }
          if (data.erros > 0) {
            errosTotais += data.erros;
            if (data.detalhesErros?.length > 0) {
              detalhesErros.push(...data.detalhesErros);
              if (venda.id_original) idsErro.set(venda.id_original, data.detalhesErros[0]);
            } else {
              if (venda.id_original) idsErro.set(venda.id_original, 'Erro desconhecido no Conta Azul');
            }
          }
        } catch (err: any) {
          errosTotais++;
          const errMsg = err.message || 'Erro de comunicação';
          detalhesErros.push(`OS ${venda.os_numero || 'S/N'}: ${errMsg}`);
          if (venda.id_original) idsErro.set(venda.id_original, errMsg);
        }
      }

      // Atualiza status localmente e limpa a seleção
      if (sucessosTotais > 0 || errosTotais > 0) {
        if (sucessosTotais > 0) {
          toast.success(`${sucessosTotais} vendas criadas no Conta Azul com sucesso!`)
        }
        
        setVendasDatacar(prev => prev.map(v => {
          if (idsSucesso.has(v.id)) {
             return { ...v, status: 'enviado', erro_mensagem: undefined }
          }
          if (idsErro.has(v.id)) {
             return { ...v, status: 'erro', erro_mensagem: idsErro.get(v.id) }
          }
          return v
        }))
        
        // Remove os sucessos dos selecionados
        setSelecionadosDatacar(prev => {
          const next = new Set(prev);
          idsSucesso.forEach(id => next.delete(id));
          return next;
        });
      }

      if (errosTotais > 0) {
        toast.error(`${errosTotais} vendas com erro. Verifique os avisos nos itens.`)
        if (detalhesErros.length > 0) {
          detalhesErros.slice(0, 3).forEach((errMsg: string) => {
            toast.error(errMsg, { duration: 6000 })
          })
          if (detalhesErros.length > 3) {
            toast.error(`E mais ${detalhesErros.length - 3} erro(s)...`, { duration: 6000 })
          }
        }
      }


    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar para o Conta Azul'
      toast.error(msg)
    } finally {
      setEnviandoDatacar(false)
    }
  }

  // ─── Handlers sub-aba Planilha ───────────────────────────────
  const handleSaveEdicao = (vendaAtualizada: VendaPreview) => {
    if (editandoIdx !== null) {
      setDadosEditados(prev => {
        const novos = [...prev]
        novos[editandoIdx] = vendaAtualizada
        return novos
      })
      setEditandoIdx(null)
      toast.success('Venda atualizada com sucesso!')
    }
  }

  const handleResultado = useCallback(async (res: ResultadoImportacaoVendas) => {
    setResultado(res)
    setDadosEditados(res.dados)
    const validos = new Set<number>(
      res.dados.reduce((acc: number[], d, i) => { if (d.valido) acc.push(i); return acc }, [])
    )
    setSelecionados(validos)
    setEtapa('preview')
  }, [])

  const toggleItem = (idx: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const toggleTodos = () => {
    const validosIdx = dadosEditados.reduce((acc: number[], d, i) => {
      if (d.valido) acc.push(i); return acc
    }, [])
    if (selecionados.size === validosIdx.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(validosIdx))
    }
  }

  const removerItem = (idx: number) => {
    setDadosEditados((prev) => prev.filter((_, i) => i !== idx))
    setSelecionados((prev) => {
      const next = new Set<number>()
      prev.forEach((i) => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  const handleEnviarContaAzul = async () => {
    if (!empresaAtiva) { toast.error('Selecione uma empresa primeiro'); return }
    if (selecionados.size === 0) { toast.error('Selecione ao menos uma venda'); return }

    setEnviandoCA(true)
    try {
      const itensParaEnviar = dadosEditados.filter((_, i) => selecionados.has(i))
      
      let sucessosTotais = 0;
      let errosTotais = 0;
      const detalhesErros: string[] = [];

      for (const venda of itensParaEnviar) {
        try {
          const res = await fetch('/api/conta-azul/enviar-vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresa_id: empresaAtiva.id,
              vendas: [venda]
            }),
          })
          
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Erro ao enviar venda')
          
          if (data.sucessos > 0) sucessosTotais += data.sucessos;
          if (data.erros > 0) {
            errosTotais += data.erros;
            if (data.detalhesErros?.length > 0) {
              detalhesErros.push(...data.detalhesErros);
            }
          }
        } catch (err: any) {
          errosTotais++;
          detalhesErros.push(`OS ${venda.os_numero || 'S/N'}: ${err.message || 'Erro de comunicação'}`);
        }
      }
      
      if (sucessosTotais > 0) toast.success(`${sucessosTotais} vendas enviadas com sucesso!`)
      if (errosTotais > 0) {
        toast.error(`${errosTotais} vendas com erro. Verifique os logs.`)
        if (detalhesErros && detalhesErros.length > 0) {
          detalhesErros.slice(0, 3).forEach((errMsg: string) => {
            toast.error(errMsg, { duration: 6000 })
          })
          if (detalhesErros.length > 3) {
            toast.error(`E mais ${detalhesErros.length - 3} erro(s)...`, { duration: 6000 })
          }
        }
      }
      
      setEtapa('upload')
      setResultado(null)
      setDadosEditados([])
      setSelecionados(new Set())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar para o Conta Azul'
      toast.error(msg)
    } finally {
      setEnviandoCA(false)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────
  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const formatDate = (dt: string | null) => {
    if (!dt) return '-'
    try {
      const d = new Date(dt + 'T12:00:00')
      if (isNaN(d.getTime())) return dt
      return d.toLocaleDateString('pt-BR')
    } catch { return dt }
  }

  const pendenteCount = vendasDatacar.filter(v => v.status === 'pendente').length

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="text-brand-500" />
              Vendas Produtos
            </h1>
            <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 text-[10px] font-bold rounded border border-brand-500/30 uppercase tracking-wider">
              Novo Módulo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SelectorEmpresa />
          {subAba === 'planilha' && etapa !== 'upload' && (
            <button
              onClick={() => { setEtapa('upload'); setResultado(null); setDadosEditados([]) }}
              className="flex items-center gap-2 text-dark-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-dark-800 transition-all"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
        </div>
      </div>

      {/* Sub-abas: Datacar | Planilha */}
      <div className="flex border-b border-dark-700 gap-0">
        <button
          onClick={() => setSubAba('datacar')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all border-b-2 ${
            subAba === 'datacar'
              ? 'border-blue-400 text-blue-400 bg-dark-800/40'
              : 'border-transparent text-dark-400 hover:text-white hover:bg-dark-800/20'
          }`}
        >
          <Database size={15} />
          Importadas do Datacar
          {pendenteCount > 0 && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
              {pendenteCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubAba('planilha')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all border-b-2 ${
            subAba === 'planilha'
              ? 'border-brand-400 text-brand-400 bg-dark-800/40'
              : 'border-transparent text-dark-400 hover:text-white hover:bg-dark-800/20'
          }`}
        >
          <Upload size={15} />
          Upload de Planilha
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          SUB-ABA: IMPORTADAS DO DATACAR
      ══════════════════════════════════════════════════════ */}
      {subAba === 'datacar' && (
        <div className="space-y-4">
          {!empresaAtiva ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
              <p className="text-yellow-300 text-sm">
                Selecione uma empresa no menu superior para ver as vendas importadas.
              </p>
            </div>
          ) : (
            <>
              {/* Painel de Agendamento Automático */}
              {empresaAtiva.datacar_token && (
                <PainelAgendamento 
                  tipo="vendas" 
                />
              )}

              {/* Formulário de Busca do Datacar */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-4 text-white font-semibold">
                  <Database size={18} className="text-blue-400" />
                  <h3>Buscar Vendas do Datacar {empresaAtiva ? `— ${empresaAtiva.nome}` : ''}</h3>
                </div>
                
                <div className="flex items-end gap-4 flex-wrap">
                  {/* Tipo Período */}
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Tipo período:</label>
                    <select
                      value={tipoPeriodoVendas}
                      onChange={(e) => setTipoPeriodoVendas(e.target.value as any)}
                      className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    >
                      <option value="criacao">Criação/Abertura</option>
                      <option value="conclusao">Conclusão</option>
                      <option value="encerramento">Encerramento</option>
                    </select>
                  </div>

                  {/* Datas */}
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Data Início</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        type="date"
                        value={dtIni}
                        onChange={(e) => setDtIni(e.target.value)}
                        className="bg-dark-900 border border-dark-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Data Fim</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        type="date"
                        value={dtFim}
                        onChange={(e) => setDtFim(e.target.value)}
                        className="bg-dark-900 border border-dark-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-40"
                      />
                    </div>
                  </div>

                  {/* Situação e OS */}
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Situação:</label>
                    <select
                      value={situacaoVendas}
                      onChange={(e) => setSituacaoVendas(e.target.value as any)}
                      className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    >
                      <option value="todas">Todas</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="encerrada">Encerrada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                  
                  {/* Filtro Itens a Enviar */}
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Itens a Enviar:</label>
                    <select
                      value={filtroTipoItens}
                      onChange={(e) => setFiltroTipoItens(e.target.value as any)}
                      className="bg-dark-900 border border-brand-500/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-500/50 outline-none"
                    >
                      <option value="tudo">Produtos e Serviços</option>
                      <option value="produtos">Apenas Produtos</option>
                      <option value="servicos">Apenas Serviços</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium mb-1 block text-dark-400">Buscar por OS/Pedido:</label>
                    <input
                      type="text"
                      placeholder="Ex: 12345"
                      value={numeroOS}
                      onChange={(e) => setNumeroOS(e.target.value)}
                      className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-32 placeholder:text-dark-600"
                    />
                  </div>

                  <button
                    onClick={handleBuscarVendasDatacar}
                    disabled={buscando || !empresaAtiva.datacar_token}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ml-auto sm:ml-0"
                  >
                    {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {buscando ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {!empresaAtiva.datacar_token && (
                   <p className="text-amber-400 text-xs mt-3">
                     ⚠️ Credenciais do Datacar não configuradas para esta empresa. Configure em "Empresas".
                   </p>
                )}
              </div>

              {/* ── Seção: Planilha Fiscal (NCM/CEST) ── */}
              <div className="bg-dark-800/50 border border-dark-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowPlanilhaFiscal(!showPlanilhaFiscal)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-dark-300 hover:text-white hover:bg-dark-800/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-amber-400" />
                    <span>Base Fiscal (NCM / CEST) — Importar Planilha do Fiscal</span>
                  </div>
                  {showPlanilhaFiscal
                    ? <ChevronUp size={14} className="text-dark-500" />
                    : <ChevronDown size={14} className="text-dark-500" />
                  }
                </button>

                {showPlanilhaFiscal && (
                  <div className="px-4 pb-4 pt-1 border-t border-dark-700/50 animate-fade-in space-y-3">
                    <p className="text-xs text-dark-400">
                      Importe a planilha do seu fiscal contendo as colunas <strong className="text-amber-400">DESCRIÇÃO</strong>, <strong className="text-emerald-400">NCM</strong> e <strong className="text-cyan-400">CEST</strong>.
                      O sistema vai aprender os dados e aplicar automaticamente nas próximas importações do Datacar.
                    </p>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-lg text-amber-300 text-sm font-medium cursor-pointer transition-all">
                        <FileSpreadsheet size={16} />
                        {uploadingPlanilha ? 'Importando...' : 'Selecionar Planilha (.xlsx)'}
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleUploadPlanilhaFiscal}
                          disabled={uploadingPlanilha}
                        />
                      </label>
                      {uploadingPlanilha && <Loader2 size={16} className="animate-spin text-amber-400" />}
                    </div>

                    {resultadoPlanilha && (
                      <div className="bg-dark-900/60 rounded-lg p-3 space-y-2 animate-fade-in">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                            ✓ {resultadoPlanilha.salvos} famílias aprendidas
                          </span>
                          {resultadoPlanilha.erros > 0 && (
                            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
                              ✗ {resultadoPlanilha.erros} erros
                            </span>
                          )}
                          {resultadoPlanilha.ignorados > 0 && (
                            <span className="px-2 py-0.5 rounded bg-dark-700 text-dark-400 font-medium">
                              {resultadoPlanilha.ignorados} linhas ignoradas
                            </span>
                          )}
                          <span className="text-dark-500">
                            {resultadoPlanilha.totalLinhas} linhas na planilha
                          </span>
                        </div>
                        {resultadoPlanilha.exemplos.length > 0 && (
                          <div className="text-[10px] text-dark-400 space-y-0.5">
                            <p className="text-dark-300 font-semibold">Exemplos aprendidos:</p>
                            {resultadoPlanilha.exemplos.map((ex, i) => (
                              <p key={i} className="font-mono">• {ex}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Loading */}
              {buscando && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-blue-400" />
                </div>
              )}

              {/* Sem vendas */}
              {!buscando && vendasDatacar.length === 0 && (
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
                  <Database size={40} className="text-dark-600 mx-auto mb-3" />
                  <p className="text-dark-400 text-sm font-medium">
                    Faça uma busca para ver as vendas do Datacar.
                  </p>
                </div>
              )}

              {/* Ações da Tabela */}
              {!buscando && vendasDatacar.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold">Resultados da Busca</h3>
                  {selecionadosDatacar.size > 0 && (
                    <button
                      onClick={handleEnviarDatacarParaCA}
                      disabled={enviandoDatacar}
                      className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                      {enviandoDatacar ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {enviandoDatacar ? 'Enviando...' : `Criar ${selecionadosDatacar.size} Venda(s) no Conta Azul`}
                    </button>
                  )}
                </div>
              )}

              {/* Lista de vendas */}
              {!buscando && vendasDatacar.length > 0 && (
                <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                  {/* Cabeçalho da lista */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-900/40 border-b border-dark-700 text-xs text-dark-400 font-semibold">
                    <input
                      type="checkbox"
                      checked={
                        selecionadosDatacar.size > 0 &&
                        selecionadosDatacar.size === vendasDatacar.filter(v => v.status === 'pendente').length
                      }
                      onChange={toggleTodosDatacar}
                      className="accent-blue-500"
                    />
                    <span className="flex-1">CLIENTE / OS</span>
                    <span className="w-28 text-right">VALOR</span>
                    <span className="w-24 text-right">DATA</span>
                    <span className="w-20 text-center">STATUS</span>
                    <span className="w-16"></span>
                  </div>

                  <div className="max-h-[520px] overflow-y-auto divide-y divide-dark-700/50">
                    {vendasDatacar.map(venda => (
                      <div key={venda.id} className="hover:bg-dark-700/20 transition-colors">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                          onClick={() => setExpandidoDatacar(expandidoDatacar === venda.id ? null : venda.id)}
                        >
                          {venda.status === 'pendente' || venda.status === 'erro' ? (
                            <input
                              type="checkbox"
                              checked={selecionadosDatacar.has(venda.id)}
                              onChange={e => { e.stopPropagation(); toggleSelecionadoDatacar(venda.id) }}
                              onClick={e => e.stopPropagation()}
                              className="accent-blue-500"
                            />
                          ) : venda.status === 'alerta_cliente' ? (
                            <div className="text-yellow-500 flex-shrink-0 ml-0.5" title="Cliente já cadastrado">
                              <AlertCircle size={14} />
                            </div>
                          ) : venda.status === 'duplicidade' ? (
                            <div className="text-amber-500 flex-shrink-0 ml-0.5" title="Venda já consta no Conta Azul">
                              <AlertCircle size={14} />
                            </div>
                          ) : (
                            <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 ml-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{venda.cliente}</p>
                            <p className="text-dark-500 text-xs font-mono">OS #{venda.os_numero}</p>
                          </div>
                          <span className="text-white text-sm font-bold tabular-nums w-28 text-right">
                            {formatCurrency(venda.valor_total)}
                          </span>
                          <span className="text-dark-400 text-xs w-24 text-right tabular-nums">
                            {formatDate(venda.data_venda)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-20 text-center ${
                            venda.status === 'enviado'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : venda.status === 'erro'
                                ? 'bg-red-500/15 text-red-400'
                                : venda.status === 'duplicidade'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : venda.status === 'alerta_cliente'
                                    ? 'bg-yellow-500/15 text-yellow-500'
                                    : 'bg-yellow-500/15 text-yellow-400'
                          }`}>
                            {venda.status === 'enviado' ? 'Enviado CA' : venda.status === 'erro' ? 'Erro CA' : venda.status === 'duplicidade' ? 'Duplicada' : venda.status === 'alerta_cliente' ? 'Aviso Cliente' : 'Pendente'}
                          </span>
                          <div className="w-16 flex items-center justify-end gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); removerVendaDatacar(venda.id) }}
                              className="p-1 text-dark-600 hover:text-red-400 transition-colors"
                              title="Remover do Card"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé da lista */}
                  <div className="flex items-center justify-between px-4 py-3 bg-dark-900/30 border-t border-dark-700 text-sm">
                    <p className="text-dark-400">
                      <strong className="text-white">{selecionadosDatacar.size}</strong> selecionadas ·{' '}
                      <strong className="text-white">{vendasDatacar.length}</strong> total
                    </p>
                    {selecionadosDatacar.size > 0 && (
                      <button
                        onClick={handleEnviarDatacarParaCA}
                        disabled={enviandoDatacar}
                        className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all"
                      >
                        {enviandoDatacar ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {enviandoDatacar ? 'Enviando...' : 'Criar Vendas no Conta Azul'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-ABA: UPLOAD DE PLANILHA
      ══════════════════════════════════════════════════════ */}
      {subAba === 'planilha' && (
        <div className="space-y-4">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {(['upload', 'preview'] as Etapa[]).map((e, i) => {
              const labels = ['1. Upload da Planilha', '2. Revisão e Envio']
              const isActive = etapa === e
              const isDone = ['upload', 'preview'].indexOf(etapa) > i
              return (
                <div key={e} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? 'bg-brand-600 text-white' :
                    isDone ? 'bg-green-600/20 text-green-400' :
                    'bg-dark-800 text-dark-500'
                  }`}>
                    {isDone && <CheckCircle size={12} />}
                    {labels[i]}
                  </div>
                  {i < 1 && <div className="w-8 h-px bg-dark-700" />}
                </div>
              )
            })}
          </div>

          {/* ETAPA 1: Upload */}
          {etapa === 'upload' && (
            <div className="space-y-4">
              {!empresaAtiva ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-300 text-sm">
                    Selecione uma empresa no menu superior antes de importar vendas.
                  </p>
                </div>
              ) : null}
              <DropZoneVendas onResultado={handleResultado} />
              <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4">
                <p className="text-sm text-dark-400 font-medium mb-2">💡 Formatos suportados e regras de extração:</p>
                <ul className="text-xs text-dark-500 space-y-1">
                  <li>• <strong className="text-dark-300">Excel (.xlsx)</strong> — Planilha com layout de Vendas (OS/PED, CLIENTE, ENCERR, Pagamentos, Itens)</li>
                  <li>• Serão importados os itens classificados como produto <strong className="text-brand-400">("P")</strong> na coluna TIPO.</li>
                  <li>• O <strong className="text-dark-300">Cliente</strong> será vinculado via Conta Azul ou criado se não existir.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ETAPA 2: Preview */}
          {etapa === 'preview' && resultado && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Total de Vendas</p>
                  <p className="text-white text-2xl font-bold">{dadosEditados.length}</p>
                </div>
                <div className="bg-dark-800 border border-green-500/20 rounded-xl p-4">
                  <p className="text-dark-400 text-xs mb-1">Válidas</p>
                  <p className="text-green-400 text-2xl font-bold">
                    {dadosEditados.filter(d => d.valido).length}
                  </p>
                </div>
              </div>

              <TabelaVendasPreview
                dados={dadosEditados}
                selecionados={selecionados}
                onToggleSelec={toggleItem}
                onToggleTodos={toggleTodos}
                onRemover={removerItem}
                onEditar={(idx) => setEditandoIdx(idx)}
              />

              <div className="flex items-center justify-between p-4 bg-dark-800 border border-dark-700 rounded-xl mt-4">
                <p className="text-dark-300 text-sm">
                  <strong className="text-white">{selecionados.size}</strong> vendas selecionadas para envio.
                </p>
                <button
                  onClick={handleEnviarContaAzul}
                  disabled={enviandoCA || selecionados.size === 0 || !empresaAtiva}
                  className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg"
                >
                  {enviandoCA ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {enviandoCA ? 'Enviando...' : 'Criar Vendas no Conta Azul'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Edição (planilha) */}
      {editandoIdx !== null && (
        <ModalEditarVenda
          venda={dadosEditados[editandoIdx]}
          onSave={handleSaveEdicao}
          onClose={() => setEditandoIdx(null)}
          empresaId={empresaAtiva?.id}
        />
      )}

      {/* Modal Edição (Datacar) */}
      {editandoDatacarId !== null && (
        <ModalEditarDatacar
          vendaId={editandoDatacarId}
          venda={vendasDatacar.find(v => v.id === editandoDatacarId)}
          onSaveSuccess={(vendaAtualizada) => {
            setVendasDatacar(prev => prev.map(v => v.id === vendaAtualizada.id ? vendaAtualizada : v))
          }}
          onClose={() => setEditandoDatacarId(null)}
        />
      )}

      {expandidoDatacar !== null && (
        <ModalDetalheVendaDatacar
          venda={vendasDatacar.find(v => v.id === expandidoDatacar)}
          onClose={() => setExpandidoDatacar(null)}
          onEdit={() => {
            setEditandoDatacarId(expandidoDatacar)
            setExpandidoDatacar(null)
          }}
          onVerVendasAnteriores={(doc) => {
            setModalClienteDoc(doc)
            setExpandidoDatacar(null)
          }}
          onForcarEnvio={() => {
            setVendasDatacar(prev => prev.map(v => v.id === expandidoDatacar ? { ...v, status: 'pendente' } : v))
            setSelecionadosDatacar(prev => new Set(prev).add(expandidoDatacar))
            setExpandidoDatacar(null)
          }}
        />
      )}

      {modalClienteDoc !== null && empresaAtiva && (
        <ModalVendasCliente
          empresaId={empresaAtiva.id}
          cpfCnpj={modalClienteDoc}
          onClose={() => setModalClienteDoc(null)}
        />
      )}
    </div>
  )
}
