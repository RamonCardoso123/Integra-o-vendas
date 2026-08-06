'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Clock, CheckCircle, AlertCircle, TrendingUp,
  Building2, Plus, Upload, Trash2, Loader2,
  RefreshCw, Zap, X, ArrowDownCircle, ChevronRight,
  Calendar, DollarSign, User, ShoppingCart
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import SelectorEmpresa from '@/components/layout/SelectorEmpresa'

interface Stats {
  totalPendente: number
  totalEnviado: number
  totalErro: number
  valorPendente: number
  valorEnviado: number
}

interface Lancamento {
  id: string
  fornecedor: string
  valor: number
  vencimento: string
  status: string
  descricao?: string | null
  categoria?: string | null
}

type DrawerStatus = 'pendente' | 'enviado' | 'erro' | null

export default function DashboardPage() {
  const { empresaAtiva, empresas } = useEmpresa()
  const [stats, setStats] = useState<Stats>({
    totalPendente: 0, totalEnviado: 0, totalErro: 0,
    valorPendente: 0, valorEnviado: 0,
  })
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Drawer
  const [drawerStatus, setDrawerStatus] = useState<DrawerStatus>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loadingDrawer, setLoadingDrawer] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!empresaAtiva) { setLoading(false); return }
    carregarStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva])

  // Fechar drawer com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerStatus(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Travar scroll do body quando drawer aberto
  useEffect(() => {
    if (drawerStatus) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerStatus])

  const carregarStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data } = await supabase
        .from('contas_pagar_importadas')
        .select('status, valor')
        .eq('empresa_id', empresaAtiva!.id)

      if (data) {
        const pendente = data.filter((r) => r.status === 'pendente')
        const enviado = data.filter((r) => r.status === 'enviado')
        const erro = data.filter((r) => r.status === 'erro')
        setStats({
          totalPendente: pendente.length,
          totalEnviado: enviado.length,
          totalErro: erro.length,
          valorPendente: pendente.reduce((s, r) => s + Number(r.valor), 0),
          valorEnviado: enviado.reduce((s, r) => s + Number(r.valor), 0),
        })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const abrirDrawer = useCallback(async (status: DrawerStatus) => {
    if (!status || !empresaAtiva) return
    setDrawerStatus(status)
    setLoadingDrawer(true)
    try {
      const { data, error } = await supabase
        .from('contas_pagar_importadas')
        .select('id, fornecedor, valor, vencimento, status, descricao, categoria')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', status)
        .order('vencimento', { ascending: true })

      if (error) throw error
      setLancamentos(data || [])
    } catch {
      toast.error('Erro ao carregar lançamentos')
    } finally {
      setLoadingDrawer(false)
    }
  }, [empresaAtiva, supabase])

  const excluirLancamento = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('contas_pagar_importadas')
        .delete()
        .eq('id', id)

      if (error) throw error
      setLancamentos(prev => prev.filter(l => l.id !== id))
      toast.success('Lançamento excluído')
      await carregarStats(true)
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  const handleLimparStatus = async (status: 'pendente' | 'erro') => {
    const label = status === 'pendente' ? 'pendentes' : 'com erro'
    if (!confirm(`Tem certeza que deseja apagar todos os registros ${label}?`)) return

    setDeleting(status)
    try {
      const { error } = await supabase
        .from('contas_pagar_importadas')
        .delete()
        .eq('empresa_id', empresaAtiva!.id)
        .eq('status', status)

      if (error) throw error

      toast.success(`Registros ${label} removidos com sucesso!`)
      await carregarStats()
      if (drawerStatus === status) {
        setLancamentos([])
        setDrawerStatus(null)
      }
    } catch (err: any) {
      toast.error('Erro ao remover registros: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (!empresaAtiva && empresas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center border border-dark-700">
          <Building2 size={32} className="text-dark-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">Nenhuma empresa cadastrada</h2>
          <p className="text-dark-400 text-sm mt-1">Crie sua primeira empresa para começar</p>
        </div>
        <Link href="/empresas?new=true"
          className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg shadow-brand-900/30">
          <Plus size={18} /> Criar empresa
        </Link>
      </div>
    )
  }

  const total = stats.totalPendente + stats.totalEnviado + stats.totalErro
  const taxaSucesso = total > 0 ? Math.round((stats.totalEnviado / total) * 100) : 0

  const cards = [
    {
      status: 'pendente' as DrawerStatus,
      title: 'Pendentes',
      label: 'A enviar',
      value: stats.totalPendente,
      sub: formatCurrency(stats.valorPendente),
      icon: Clock,
      color: 'text-amber-400',
      colorHex: '#f59e0b',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      hoverBorder: 'hover:border-amber-400/60',
      gradientFrom: 'from-amber-500/10',
      barWidth: total > 0 ? `${Math.round((stats.totalPendente / total) * 100)}%` : '0%',
      barColor: 'bg-amber-400',
      canDelete: stats.totalPendente > 0,
    },
    {
      status: 'enviado' as DrawerStatus,
      title: 'Enviados',
      label: 'Conta Azul',
      value: stats.totalEnviado,
      sub: formatCurrency(stats.valorEnviado),
      icon: CheckCircle,
      color: 'text-emerald-400',
      colorHex: '#34d399',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      hoverBorder: 'hover:border-emerald-400/60',
      gradientFrom: 'from-emerald-500/10',
      barWidth: total > 0 ? `${Math.round((stats.totalEnviado / total) * 100)}%` : '0%',
      barColor: 'bg-emerald-400',
      canDelete: false,
    },
    {
      status: 'erro' as DrawerStatus,
      title: 'Com Erro',
      label: 'Falhas',
      value: stats.totalErro,
      sub: 'Necessitam atenção',
      icon: AlertCircle,
      color: 'text-rose-400',
      colorHex: '#fb7185',
      bg: 'bg-rose-400/10',
      border: 'border-rose-400/20',
      hoverBorder: 'hover:border-rose-400/60',
      gradientFrom: 'from-rose-500/10',
      barWidth: total > 0 ? `${Math.round((stats.totalErro / total) * 100)}%` : '0%',
      barColor: 'bg-rose-400',
      canDelete: stats.totalErro > 0,
    },
    {
      status: null as DrawerStatus,
      title: 'Total',
      label: 'Processados',
      value: total,
      sub: formatCurrency(stats.valorPendente + stats.valorEnviado),
      icon: TrendingUp,
      color: 'text-brand-400',
      colorHex: '#818cf8',
      bg: 'bg-brand-400/10',
      border: 'border-brand-400/20',
      hoverBorder: 'hover:border-brand-400/60',
      gradientFrom: 'from-brand-500/10',
      barWidth: '100%',
      barColor: 'bg-brand-400',
      canDelete: false,
    },
  ]

  const drawerCard = cards.find(c => c.status === drawerStatus)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <SelectorEmpresa />
          <button
            onClick={() => carregarStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-dark-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl backdrop-blur-md transition-all shadow-lg shadow-black/20"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand-400' : 'text-brand-400'} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI Cards — clicáveis */}
      {empresaAtiva?.tipo_empresa !== 'vendas' && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                <ArrowDownCircle className="text-brand-400" size={18} />
              </div>
              Contas a Pagar
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          const isClickable = card.status !== null && card.value > 0
          const isActive = drawerStatus === card.status && card.status !== null

          return (
            <div
              key={card.title}
              onClick={() => isClickable ? abrirDrawer(card.status) : undefined}
              className={[
                'relative group rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300',
                'bg-white/[0.02] backdrop-blur-xl',
                isActive ? `${card.hoverBorder} bg-white/[0.04] shadow-[0_0_30px_rgba(0,0,0,0.15)] ring-1 ring-offset-0` : card.border,
                isClickable && !isActive ? `cursor-pointer hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 ${card.hoverBorder}` : '',
              ].join(' ')}
              style={isActive ? { '--tw-ring-color': card.colorHex, boxShadow: `0 0 30px ${card.colorHex}25` } as any : {}}
            >
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className={`${card.bg} rounded-xl p-2.5 shadow-inner border border-white/5`}>
                  <Icon size={18} className={card.color} />
                </div>
                <div className="flex items-center gap-1.5">
                  {card.canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLimparStatus(card.status as 'pendente' | 'erro') }}
                      disabled={deleting !== null}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-transparent hover:border-rose-500/20"
                      title="Apagar todos"
                    >
                      {deleting === card.status ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${card.color} opacity-60 border border-current px-2 py-0.5 rounded-full`}>
                    {card.label}
                  </span>
                </div>
              </div>

              {/* Value */}
              <div className="flex-1 mt-1">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-10 w-20 bg-dark-700/50 animate-pulse rounded-lg" />
                    <div className="h-4 w-28 bg-dark-700/50 animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-white tabular-nums leading-none drop-shadow-sm">{card.value}</p>
                    <p className="text-dark-400 text-sm mt-2 font-medium">{card.sub}</p>
                  </>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-dark-900/50 rounded-full overflow-hidden shadow-inner mt-2">
                <div
                  className={`h-full ${card.barColor} rounded-full transition-all duration-700`}
                  style={{ width: loading ? '0%' : card.barWidth }}
                />
              </div>

              {/* Click hint */}
              {isClickable && (
                <div className={`absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 text-[11px] ${card.color} font-bold tracking-wide`}>
                  Ver lançamentos <ChevronRight size={14} />
                </div>
              )}
            </div>
          )
        })}
      </div>
        </>
      )}

      {/* Linha do meio: Taxa de sucesso + Ação rápida */}
      {empresaAtiva?.tipo_empresa !== 'vendas' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Taxa de sucesso */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl hover:bg-white/[0.04] transition-colors">
          <p className="text-dark-400 text-sm font-medium">Taxa de Sucesso</p>
          <div>
            <p className="text-5xl font-bold text-white tabular-nums leading-none drop-shadow-sm">
              {loading ? <span className="text-dark-600">—</span> : `${taxaSucesso}%`}
            </p>
            <p className="text-dark-500 text-xs mt-2 font-medium">
              {stats.totalEnviado} de {total} registros enviados
            </p>
          </div>
          <div className="space-y-3 mt-auto pt-2">
            {[
              { label: 'Enviados', value: stats.totalEnviado, color: 'bg-emerald-400', textColor: 'text-emerald-400' },
              { label: 'Pendentes', value: stats.totalPendente, color: 'bg-amber-400', textColor: 'text-amber-400' },
              { label: 'Erros', value: stats.totalErro, color: 'bg-rose-400', textColor: 'text-rose-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-dark-500 text-xs font-medium w-16">{item.label}</span>
                <div className="flex-1 h-2 bg-dark-900/50 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: total > 0 ? `${Math.round((item.value / total) * 100)}%` : '0%' }}
                  />
                </div>
                <span className={`text-xs font-bold w-6 text-right ${item.textColor}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ação rápida — um só card */}
        <div className="lg:col-span-2">
          <Link href="/contas-pagar"
            className="h-full bg-white/[0.02] backdrop-blur-xl border border-white/5 hover:border-brand-500/50 hover:bg-white/[0.04] rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 group hover:shadow-2xl hover:shadow-brand-900/20 hover:-translate-y-1 relative overflow-hidden">
            {/* Subtle glow background */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-colors pointer-events-none"></div>

            <div className="flex items-start justify-between relative z-10">
              <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center group-hover:bg-brand-500/20 shadow-inner border border-brand-500/10 transition-all">
                <Upload size={22} className="text-brand-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-[11px] text-dark-500 bg-dark-900/50 border border-dark-700/50 px-2.5 py-1 rounded-lg font-medium backdrop-blur-sm shadow-inner">DataCar · CSV · PDF</span>
            </div>
            <div className="mt-6 relative z-10">
              <p className="text-white text-xl font-bold group-hover:text-brand-50 transition-colors">Contas a Pagar</p>
              <p className="text-dark-400 text-sm mt-1.5 leading-relaxed max-w-md">Importar arquivo DataCar, revisar lançamentos e enviar para o Conta Azul de forma rápida e segura.</p>
            </div>
            <div className="flex items-center gap-2 text-brand-400 text-sm font-bold mt-6 group-hover:gap-3 transition-all relative z-10">
              Abrir módulo <ArrowDownCircle size={18} className="rotate-[-90deg]" />
            </div>
          </Link>
        </div>
      </div>
      )}

      {/* Status da Integração */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Zap size={15} className="text-brand-400" />
            Status da Integração
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Operacional
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-dark-900 border border-dark-700 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Supabase</p>
              <p className="text-dark-500 text-xs">Banco de dados conectado</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-dark-900 border border-dark-700 rounded-xl px-4 py-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${empresaAtiva?.access_token_conta_azul ? 'bg-emerald-400/10' : 'bg-amber-400/10'}`}>
              {empresaAtiva?.access_token_conta_azul
                ? <CheckCircle size={14} className="text-emerald-400" />
                : <AlertCircle size={14} className="text-amber-400" />}
            </div>
            <div>
              <p className="text-white text-sm font-medium">Conta Azul</p>
              <p className="text-dark-500 text-xs">
                {empresaAtiva?.access_token_conta_azul ? 'API conectada' : 'Configurar em Empresas'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── DRAWER ── */}
      {/* Overlay */}
      {drawerStatus && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setDrawerStatus(null)}
        />
      )}

      {/* Painel lateral */}
      <div className={[
        'fixed top-0 right-0 h-full w-full max-w-xl bg-dark-900 border-l border-dark-700 z-50',
        'flex flex-col shadow-2xl transition-transform duration-300 ease-out',
        drawerStatus ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}>

        {/* Header do drawer */}
        <div className={`p-5 border-b border-dark-700 flex items-center justify-between bg-gradient-to-r ${drawerCard?.gradientFrom} to-transparent`}>
          <div className="flex items-center gap-3">
            {drawerCard && (
              <div className={`${drawerCard.bg} rounded-xl p-2`}>
                {drawerCard && <drawerCard.icon size={16} className={drawerCard.color} />}
              </div>
            )}
            <div>
              <h2 className="text-white font-bold text-lg leading-none">
                Lançamentos — {drawerCard?.title}
              </h2>
              <p className="text-dark-400 text-xs mt-1">
                {loadingDrawer ? 'Carregando...' : `${lancamentos.length} registro${lancamentos.length !== 1 ? 's' : ''}`}
                {!loadingDrawer && lancamentos.length > 0 && (
                  <span className={`ml-2 font-semibold ${drawerCard?.color}`}>
                    {formatCurrency(lancamentos.reduce((s, l) => s + Number(l.valor), 0))}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDrawerStatus(null)}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo do drawer */}
        <div className="flex-1 overflow-y-auto">
          {loadingDrawer ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-dark-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
              <div className="w-12 h-12 bg-dark-800 rounded-2xl flex items-center justify-center border border-dark-700">
                <CheckCircle size={24} className="text-dark-500" />
              </div>
              <p className="text-white font-medium">Nenhum lançamento</p>
              <p className="text-dark-500 text-sm">Não há registros com este status.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {lancamentos.map((l) => (
                <div
                  key={l.id}
                  className="group bg-dark-800 hover:bg-dark-750 border border-dark-700 hover:border-dark-600 rounded-xl p-4 flex items-start justify-between gap-3 transition-all"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Fornecedor */}
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-dark-500 flex-shrink-0" />
                      <p className="text-white text-sm font-semibold truncate">{l.fornecedor}</p>
                    </div>
                    {/* Descrição */}
                    {l.descricao && (
                      <p className="text-dark-500 text-xs truncate pl-4">{l.descricao}</p>
                    )}
                    {/* Valor + Vencimento */}
                    <div className="flex items-center gap-4 pl-0">
                      <span className="flex items-center gap-1 text-xs font-bold text-white">
                        <DollarSign size={11} className="text-dark-400" />
                        {formatCurrency(Number(l.valor))}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-dark-400">
                        <Calendar size={11} />
                        {formatDate(l.vencimento)}
                      </span>
                      {l.categoria && (
                        <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                          {l.categoria}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botão excluir */}
                  <button
                    onClick={() => excluirLancamento(l.id)}
                    disabled={deletingId === l.id}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                    title="Excluir lançamento"
                  >
                    {deletingId === l.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer do drawer */}
        {!loadingDrawer && lancamentos.length > 0 && drawerCard?.canDelete && (
          <div className="p-4 border-t border-dark-700 bg-dark-900">
            <button
              onClick={() => handleLimparStatus(drawerStatus as 'pendente' | 'erro')}
              disabled={deleting !== null}
              className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Apagar todos os {drawerCard?.title.toLowerCase()}
            </button>
          </div>
        )}

        {/* Footer com link para página de contas */}
        {!loadingDrawer && (
          <div className="px-4 pb-4 border-t border-dark-700 pt-3 bg-dark-900">
            <Link
              href="/contas-pagar"
              onClick={() => setDrawerStatus(null)}
              className="w-full flex items-center justify-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Abrir módulo Contas a Pagar <ArrowDownCircle size={14} className="rotate-[-90deg]" />
            </Link>
          </div>
        )}
      </div>

    </div>
  )
}
