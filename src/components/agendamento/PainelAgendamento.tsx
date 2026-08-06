'use client'

import { useState, useEffect } from 'react'
import { Clock, Play, Save, CheckCircle, XCircle, AlertCircle, Loader2, X, Settings2, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatDate } from '@/lib/utils'

interface PainelAgendamentoProps {
  tipo: 'contas_pagar' | 'vendas'
  onTestarAgora?: () => void
}

// Calcula data padrão (7 dias atrás)
function getDefaultDtIni() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}
function getDefaultDtFim() {
  return new Date().toISOString().split('T')[0]
}

export default function PainelAgendamento({ tipo }: PainelAgendamentoProps) {
  const { empresaAtiva } = useEmpresa()
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [ativo, setAtivo] = useState(false)
  const [acao, setAcao] = useState('importar_e_enviar')
  const [horario, setHorario] = useState('22:00')
  const [dias, setDias] = useState<string[]>(['1','2','3','4','5'])
  
  // === FILTROS CONTAS A PAGAR ===
  const [tipoPeriodoContas, setTipoPeriodoContas] = useState<string>('venc')
  const [statusPagamento, setStatusPagamento] = useState<string>('apagar')
  const [localPagamento, setLocalPagamento] = useState<string>('todos')

  // === FILTROS VENDAS (Produtos e Serviços) ===
  const [tipoPeriodoVendas, setTipoPeriodoVendas] = useState<string>('abertura')
  const [situacaoVendas, setSituacaoVendas] = useState<string>('todas')
  const [filtroTipoItens, setFiltroTipoItens] = useState<string>('tudo')

  // === FILTROS COMUNS ===
  const [dtIni, setDtIni] = useState<string>(getDefaultDtIni())
  const [dtFim, setDtFim] = useState<string>(getDefaultDtFim())

  const [ultimaExecucao, setUltimaExecucao] = useState<string | null>(null)
  const [ultimoStatus, setUltimoStatus] = useState<string | null>(null)
  const [ultimoLog, setUltimoLog] = useState<any>(null)

  useEffect(() => {
    if (empresaAtiva && modalOpen) {
      carregarAgendamento()
    }
  }, [empresaAtiva, modalOpen])

  const carregarAgendamento = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agendamentos?empresa_id=${empresaAtiva!.id}&tipo=${tipo}`)
      const { data } = await res.json()
      if (data) {
        setAtivo(data.ativo)
        setAcao(data.acao)
        setHorario(data.horario || '22:00')
        setDias(data.dias_semana || ['1','2','3','4','5'])
        setUltimaExecucao(data.ultima_execucao)
        setUltimoStatus(data.ultimo_status)
        setUltimoLog(data.ultimo_log)
        
        // Filtros Contas a Pagar
        if (data.tipo_periodo_contas) setTipoPeriodoContas(data.tipo_periodo_contas)
        if (data.status_pagamento) setStatusPagamento(data.status_pagamento)
        if (data.local_pagamento) setLocalPagamento(data.local_pagamento)

        // Filtros Vendas
        if (data.tipo_periodo_vendas) setTipoPeriodoVendas(data.tipo_periodo_vendas)
        if (data.situacao_vendas) setSituacaoVendas(data.situacao_vendas)
        if (data.filtro_tipo_itens) setFiltroTipoItens(data.filtro_tipo_itens)

        // Datas comuns
        if (data.dt_ini) setDtIni(data.dt_ini)
        if (data.dt_fim) setDtFim(data.dt_fim)
      }
    } catch (e: any) {
      toast.error('Erro ao carregar agendamento: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSalvar = async () => {
    setSaving(true)
    try {
      const payload: any = {
        empresa_id: empresaAtiva!.id,
        tipo,
        ativo,
        acao,
        horario,
        dias_semana: dias,
        dt_ini: dtIni,
        dt_fim: dtFim,
      }

      // Adiciona filtros específicos do tipo
      if (tipo === 'contas_pagar') {
        payload.tipo_periodo_contas = tipoPeriodoContas
        payload.status_pagamento = statusPagamento
        payload.local_pagamento = localPagamento
      } else {
        payload.tipo_periodo_vendas = tipoPeriodoVendas
        payload.situacao_vendas = situacaoVendas
        payload.filtro_tipo_itens = filtroTipoItens
      }

      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Erro ao salvar agendamento')
      
      toast.success('Agendamento salvo com sucesso!')
      setModalOpen(false)
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTestar = async () => {
    if (!confirm('Isto executará o agendamento IMEDIATAMENTE usando os filtros salvos. Deseja continuar?')) return
    
    setTesting(true)
    try {
      const res = await fetch('/api/cron/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaAtiva!.id, tipo })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no teste')

      toast.success('Teste concluído com status: ' + data.status)
      carregarAgendamento()
    } catch (e: any) {
      toast.error('Erro ao testar: ' + e.message)
    } finally {
      setTesting(false)
    }
  }

  const toggleDia = (dia: string) => {
    if (dias.includes(dia)) {
      setDias(dias.filter(d => d !== dia))
    } else {
      setDias([...dias, dia])
    }
  }

  const diasOptions = [
    { v: '1', l: 'Seg' }, { v: '2', l: 'Ter' }, { v: '3', l: 'Qua' },
    { v: '4', l: 'Qui' }, { v: '5', l: 'Sex' }, { v: '6', l: 'Sáb' }, { v: '7', l: 'Dom' }
  ]

  if (!empresaAtiva) return null

  return (
    <>
      {/* Botão de Abertura */}
      <button 
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-sm font-semibold text-brand-400 transition-all shadow-md mb-4"
      >
        <Settings2 size={16} />
        Configurar Automação Diária
      </button>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-3xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-dark-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ativo ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-800 text-dark-400'}`}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    Automação Diária — {tipo === 'contas_pagar' ? 'Contas a Pagar' : 'Vendas'}
                  </h3>
                  <p className="text-dark-400 text-xs">Configure os filtros e horário do robô automático</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo scrollable */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="animate-spin text-dark-500" size={30} />
                </div>
              ) : (
                <>
                  {/* Toggle Ativar */}
                  <div className="flex items-center justify-between bg-dark-800 p-4 rounded-xl border border-dark-700">
                    <div>
                      <p className="text-white font-semibold">Ativar Automação</p>
                      <p className="text-dark-400 text-sm">O robô executará essa rotina automaticamente.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={ativo} 
                        onChange={(e) => setAtivo(e.target.checked)} 
                      />
                      <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>

                  {/* ==========================================
                      SEÇÃO 1: QUANDO EXECUTAR
                  ========================================== */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white border-b border-dark-700 pb-2">Quando Executar</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Ação</label>
                        <select 
                          value={acao}
                          onChange={(e) => setAcao(e.target.value)}
                          className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        >
                          <option value="importar_e_enviar">Importar do DataCar E Enviar p/ Conta Azul</option>
                          <option value="importar">APENAS Importar do DataCar</option>
                          <option value="enviar">APENAS Enviar os Pendentes p/ Conta Azul</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Horário (Brasília)</label>
                        <input 
                          type="time" 
                          value={horario}
                          onChange={(e) => setHorario(e.target.value)}
                          className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Dias da Semana</label>
                      <div className="flex flex-wrap gap-2">
                        {diasOptions.map(d => (
                          <button
                            key={d.v}
                            onClick={() => toggleDia(d.v)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${dias.includes(d.v) ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : 'bg-dark-800 text-dark-400 border border-dark-700 hover:bg-dark-700'}`}
                          >
                            {d.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ==========================================
                      SEÇÃO 2: FILTROS DE BUSCA (específicos por card)
                  ========================================== */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white border-b border-dark-700 pb-2">
                      Filtros de Busca — {tipo === 'contas_pagar' ? 'Contas a Pagar' : 'Vendas'}
                    </h4>

                    {/* ===== FILTROS CONTAS A PAGAR ===== */}
                    {tipo === 'contas_pagar' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Por data de:</label>
                          <select 
                            value={tipoPeriodoContas}
                            onChange={(e) => setTipoPeriodoContas(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="venc">Vencimento</option>
                            <option value="emis">Emissão</option>
                            <option value="pgto">Pagamento</option>
                            <option value="digit">Digitação no Sistema</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Pagamento:</label>
                          <select 
                            value={statusPagamento}
                            onChange={(e) => setStatusPagamento(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="apagar">A pagar</option>
                            <option value="pagas">Pagas</option>
                            <option value="todas">A pagar e pagas</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Local:</label>
                          <select 
                            value={localPagamento}
                            onChange={(e) => setLocalPagamento(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="todos">(Todos)</option>
                            <option value="BANCO">BANCO</option>
                            <option value="CARTEIRA">CARTEIRA</option>
                            <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ===== FILTROS VENDAS (Produtos e Serviços) ===== */}
                    {tipo === 'vendas' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Tipo período:</label>
                          <select 
                            value={tipoPeriodoVendas}
                            onChange={(e) => setTipoPeriodoVendas(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="abertura">Abertura</option>
                            <option value="previsao">Previsão</option>
                            <option value="conclusao">Conclusão</option>
                            <option value="encerramento">Encerramento</option>
                            <option value="cancelamento">Cancelamento</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Situação:</label>
                          <select 
                            value={situacaoVendas}
                            onChange={(e) => setSituacaoVendas(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="todas">Todas</option>
                            <option value="em_andamento">Em Andamento</option>
                            <option value="concluida">Concluída</option>
                            <option value="encerrada">Encerrada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Itens a Enviar:</label>
                          <select 
                            value={filtroTipoItens}
                            onChange={(e) => setFiltroTipoItens(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500"
                          >
                            <option value="tudo">Produtos e Serviços</option>
                            <option value="produtos">Apenas Produtos</option>
                            <option value="servicos">Apenas Serviços</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Datas (comuns a todos os cards) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Data Início</label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                          <input
                            type="date"
                            value={dtIni}
                            onChange={(e) => setDtIni(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg pl-10 pr-3 p-2.5 focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Data Fim</label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                          <input
                            type="date"
                            value={dtFim}
                            onChange={(e) => setDtFim(e.target.value)}
                            className="w-full bg-dark-800 border border-dark-700 text-white text-sm rounded-lg pl-10 pr-3 p-2.5 focus:border-brand-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Box */}
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-dark-800 border border-dark-700 rounded-xl p-4 mt-2">
                    <div className="flex items-center gap-3">
                      {ultimoStatus === 'sucesso' ? (
                        <CheckCircle className="text-emerald-400" size={24} />
                      ) : ultimoStatus === 'parcial' ? (
                        <AlertCircle className="text-amber-400" size={24} />
                      ) : ultimoStatus === 'erro' ? (
                        <XCircle className="text-rose-400" size={24} />
                      ) : (
                        <Clock className="text-dark-500" size={24} />
                      )}
                      
                      <div>
                        <p className="text-sm text-white font-medium">
                          {ultimaExecucao ? `Última execução: ${formatDate(ultimaExecucao)}` : 'Nunca executado'}
                        </p>
                        {ultimoLog && (
                          <p className="text-xs text-dark-400 mt-0.5">
                            {ultimoLog.erro 
                              ? `Erro: ${ultimoLog.erro}`
                              : `Importados: ${ultimoLog.importados || 0} | Enviados: ${ultimoLog.enviados || 0} | Erros: ${ultimoLog.erros_envio || 0}`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleTestar}
                      disabled={testing}
                      className="mt-3 sm:mt-0 flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                      title="Executar agora manualmente usando esses filtros"
                    >
                      {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                      {testing ? 'Testando...' : 'Testar Agora'}
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-5 border-t border-dark-700 flex justify-end gap-3 shrink-0 bg-dark-900 rounded-b-2xl">
              <button 
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSalvar}
                disabled={saving || loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/30 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
