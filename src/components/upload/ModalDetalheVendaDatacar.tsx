import React from 'react'
import { 
  X, Edit, AlertCircle, CheckCircle, Calendar, 
  DollarSign, User, MapPin, Truck, HelpCircle
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ModalDetalheVendaDatacarProps {
  venda: any
  onClose: () => void
  onEdit: () => void
  onVerVendasAnteriores?: (doc: string) => void
  onForcarEnvio?: () => void
}

export default function ModalDetalheVendaDatacar({
  venda,
  onClose,
  onEdit,
  onVerVendasAnteriores,
  onForcarEnvio
}: ModalDetalheVendaDatacarProps) {
  if (!venda) return null

  const formatCNPJ = (val: string | null) => {
    if (!val) return 'Não informado'
    const clean = val.replace(/\D/g, '')
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
    return val
  }

  const endereco = venda.cliente_endereco || {}
  const temEndereco = !!(endereco.logradouro || endereco.cidade || endereco.cep)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto transition-opacity animate-fade-in">
      <div 
        className="bg-dark-800 border border-dark-700/60 rounded-2xl w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col my-8 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow de fundo sutil estilo SaaS */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Cabeçalho */}
        <div className="p-6 border-b border-dark-700/50 flex items-center justify-between bg-dark-900/20">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2.5 py-0.5 rounded-full font-bold">
                OS #{venda.os_numero}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                venda.status === 'enviado'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : venda.status === 'erro'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : venda.status === 'duplicidade'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : venda.status === 'alerta_cliente'
                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {venda.status === 'enviado' ? 'Enviado Conta Azul' : venda.status === 'erro' ? 'Erro Envio' : venda.status === 'duplicidade' ? 'Duplicidade no CA' : venda.status === 'alerta_cliente' ? 'Aviso Cliente' : 'Pendente de Envio'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white leading-tight mt-1">
              Detalhes da Ordem de Serviço
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-700/50 transition-all border border-transparent hover:border-dark-600/30"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-dark-300">
          
          {/* Alerta de erro do Conta Azul se aplicável */}
          {venda.status === 'erro' && venda.erro_mensagem && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-red-400 font-bold">Falha no envio ao Conta Azul</p>
                <p className="text-red-300/80 text-xs mt-1 leading-relaxed">{venda.erro_mensagem}</p>
              </div>
            </div>
          )}

          {/* Grid de Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-dark-900/30 border border-dark-700/30 rounded-xl p-5">
            {/* Bloco Cliente */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-[10px] text-dark-500 uppercase tracking-widest font-semibold block">Cliente</span>
              <div className="space-y-1">
                <p className="text-white font-bold text-base leading-snug flex items-center gap-1.5">
                  <User size={16} className="text-dark-400" />
                  {venda.cliente}
                </p>
                <p className="text-dark-400 text-xs font-mono pl-5">
                  CPF/CNPJ: {formatCNPJ(venda.cliente_cpf_cnpj || venda.dados_datacar?.cliente_cpf_cnpj)}
                </p>
              </div>
            </div>

            {/* Bloco Valores */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l border-dark-700/50 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] text-dark-500 uppercase tracking-widest font-semibold block">Valores e Datas</span>
              <div className="space-y-1">
                <p className="text-white font-black text-lg tabular-nums flex items-center gap-1">
                  <DollarSign size={18} className="text-emerald-400" />
                  {formatCurrency(venda.valor_total)}
                </p>
                <p className="text-dark-400 text-xs flex items-center gap-1.5 pl-1">
                  <Calendar size={13} />
                  {formatDate(venda.data_venda)}
                </p>
              </div>
            </div>
          </div>

          {/* Grid de Logística & Operação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informações Extras Datacar */}
            <div className="space-y-3 bg-dark-900/20 border border-dark-700/20 rounded-xl p-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-brand-400" />
                Dados do Atendimento
              </h4>
              <div className="space-y-2 text-xs">
                <p className="flex justify-between border-b border-dark-700/50 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-dark-400">Vendedor:</span>
                  <span className="text-white font-medium">{venda.dados_datacar?.vendedor || 'Não informado'}</span>
                </p>
                <p className="flex justify-between border-b border-dark-700/50 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-dark-400">Veículo:</span>
                  <span className="text-white font-medium">{venda.dados_datacar?.veiculo || 'Não informado'}</span>
                </p>
                <p className="flex justify-between border-b border-dark-700/50 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-dark-400">Forma Pagto:</span>
                  <span className="text-white font-medium truncate max-w-[200px]">{venda.forma_pagamento || 'Não informada'}</span>
                </p>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-3 bg-dark-900/20 border border-dark-700/20 rounded-xl p-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-400" />
                Endereço de Faturamento
              </h4>
              {temEndereco ? (
                <div className="text-xs space-y-1 leading-relaxed">
                  <p className="text-white font-semibold">
                    {[endereco.logradouro, endereco.numero].filter(Boolean).join(', ')}
                  </p>
                  {endereco.complemento && (
                    <p className="text-dark-400">Complemento: {endereco.complemento}</p>
                  )}
                  <p className="text-dark-400">
                    {[endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(' — ')}
                  </p>
                  {endereco.cep && (
                    <p className="text-dark-500 font-mono text-[10px]">CEP: {endereco.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-dark-500 italic py-2 flex items-center gap-1">
                  <HelpCircle size={12} />
                  Endereço não informado
                </p>
              )}
            </div>
          </div>

          {/* Seção Itens da Venda */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Itens da Ordem de Serviço ({venda.itens?.length || 0})
            </h4>
            
            <div className="bg-dark-900/40 border border-dark-700/30 rounded-xl overflow-hidden divide-y divide-dark-700/50">
              {venda.itens && venda.itens.length > 0 ? (
                venda.itens.map((item: any, idx: number) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-dark-700/10 transition-colors">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Tipo + Qtd + Descrição */}
                      <div className="flex items-start gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold mt-0.5 flex-shrink-0 ${
                          item.tipo === 'produto' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                        }`}>
                          {item.tipo === 'produto' ? 'PRODUTO' : 'SERVIÇO'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-xs leading-normal">
                            {item.codigo && <span className="text-blue-400 font-mono text-[10px] mr-1.5">[{item.codigo}]</span>}
                            {item.descricao}
                          </p>
                        </div>
                      </div>

                      {/* Badges fiscais */}
                      {item.tipo === 'produto' && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-0 sm:pl-10">
                          {item.ncm ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              NCM: {item.ncm}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              ⚠ Sem NCM
                            </span>
                          )}
                          {item.cest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                              CEST: {item.cest}
                            </span>
                          )}
                          {item.origem && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              Orig: {item.origem.substring(0, 15)}...
                            </span>
                          )}
                          {item.unidade_medida && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-dark-700 text-dark-400">
                              Unidade: {item.unidade_medida}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Preços e Quantidade */}
                    <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0 border-t sm:border-t-0 border-dark-700/30 pt-2 sm:pt-0">
                      <p className="text-[10px] text-dark-500">
                        {item.quantidade} x {formatCurrency(item.valor_unitario)}
                      </p>
                      <p className="text-white font-bold text-xs tabular-nums">
                        {formatCurrency(item.valor_total)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-dark-500 italic">
                  Esta Ordem de Serviço não contém itens cadastrados.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé Ações */}
        <div className="p-6 border-t border-dark-700/50 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 bg-dark-900/20">
          {venda.status === 'alerta_cliente' && onVerVendasAnteriores && (
            <button
              onClick={() => onVerVendasAnteriores(venda.cliente_cpf_cnpj || venda.dados_datacar?.cliente_cpf_cnpj || '')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 transition-all text-center"
            >
              Ver Vendas Anteriores
            </button>
          )}

          {(venda.status === 'duplicidade' || venda.status === 'alerta_cliente') && onForcarEnvio && (
            <button
              onClick={onForcarEnvio}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all text-center"
            >
              Forçar Envio (Ignorar Aviso)
            </button>
          )}

          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-lg"
          >
            <Edit size={14} />
            Editar Dados da Venda
          </button>
        </div>
      </div>
    </div>
  )
}
