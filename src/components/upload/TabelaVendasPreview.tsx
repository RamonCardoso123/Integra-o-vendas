import React, { useState } from 'react'
import type { VendaPreview } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, AlertCircle, ShoppingCart, ChevronDown, Edit } from 'lucide-react'

interface TabelaVendasPreviewProps {
  dados: VendaPreview[]
  selecionados: Set<number>
  onToggleSelec: (idx: number) => void
  onToggleTodos: () => void
  onRemover: (idx: number) => void
  onEditar?: (idx: number) => void
}

export default function TabelaVendasPreview({
  dados,
  selecionados,
  onToggleSelec,
  onToggleTodos,
  onRemover,
  onEditar,
}: TabelaVendasPreviewProps) {
  const [expandido, setExpandido] = useState<number | null>(null)
  const allSelected = dados.length > 0 && selecionados.size === dados.filter(d => d.valido).length

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-dark-300">
          <thead className="text-xs uppercase bg-dark-900 border-b border-dark-700">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleTodos}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-dark-900"
                />
              </th>
              <th className="p-3">Status</th>
              <th className="p-3">OS / Pedido</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Data</th>
              <th className="p-3 text-right">Valor Total</th>
              <th className="p-3">Forma Pag.</th>
              <th className="p-3">Itens</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/50">
            {dados.map((venda, idx) => {
              const isSelected = selecionados.has(idx)
              const isExpanded = expandido === idx
              
              return (
                <React.Fragment key={idx}>
                  <tr
                    className={`group transition-colors ${
                      !venda.valido ? 'bg-rose-500/5 hover:bg-rose-500/10' :
                      isSelected ? 'bg-brand-500/5 hover:bg-brand-500/10' : 'hover:bg-dark-700/50'
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        disabled={!venda.valido}
                        checked={isSelected}
                        onChange={() => onToggleSelec(idx)}
                        className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-dark-900 disabled:opacity-50"
                      />
                    </td>
                    <td className="p-3">
                      {venda.valido ? (
                        <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2 py-1 rounded-md w-max">
                          <CheckCircle size={14} /> <span className="text-xs font-medium">OK</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md w-max" title={venda.erros?.join(', ')}>
                          <AlertCircle size={14} /> <span className="text-xs font-medium">Erro</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium text-white">{venda.os_numero}</td>
                    <td className="p-3 text-white truncate max-w-[200px]" title={venda.cliente}>{venda.cliente}</td>
                    <td className="p-3">
                      {venda.data_venda ? new Date(venda.data_venda).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-white">
                      {formatCurrency(venda.valor_total)}
                    </td>
                    <td className="p-3 text-xs">
                      {venda.forma_pagamento ? (
                        <span className="px-2 py-1 bg-dark-700 rounded-md text-dark-300">{venda.forma_pagamento}</span>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      <button 
                        onClick={() => setExpandido(isExpanded ? null : idx)}
                        className="flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded hover:bg-brand-500/10 transition-colors"
                      >
                        <ShoppingCart size={14} />
                        <span>{venda.itens.length} prod.</span>
                        <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onEditar && (
                          <button
                            onClick={() => onEditar(idx)}
                            className="text-dark-500 hover:text-brand-400 p-1.5 rounded hover:bg-brand-400/10 transition-colors"
                            title="Editar Venda"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onRemover(idx)}
                          className="text-dark-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-400/10 transition-colors"
                          title="Remover"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Linha expandida de itens */}
                  {isExpanded && (
                    <tr className="bg-dark-900/50">
                      <td colSpan={9} className="p-0 border-t border-dark-700/30">
                        <div className="px-10 py-6 animate-fade-in">
                          <h4 className="text-xs font-semibold text-dark-400 mb-3 uppercase tracking-wider">Itens da Venda</h4>
                          <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-dark-900 border-b border-dark-700">
                                <tr>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium">Tipo</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium">Código</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium">Descrição</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium text-center">Qtd</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium text-right">Vl Unit (R$)</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium text-right">Desc (R$)</th>
                                  <th className="px-4 py-2 text-xs text-dark-300 font-medium text-right">Vl Total (R$)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-dark-700/50">
                                {venda.itens.map((item, iItem) => (
                                  <tr key={iItem} className="hover:bg-dark-700/30 transition-colors">
                                    <td className="px-4 py-2 text-white">{item.tipo || '-'}</td>
                                    <td className="px-4 py-2 text-white">{item.codigo || '-'}</td>
                                    <td className="px-4 py-2 text-white">{item.descricao}</td>
                                    <td className="px-4 py-2 text-white text-center">{item.quantidade}</td>
                                    <td className="px-4 py-2 text-white text-right">
                                      {formatCurrency(item.valor_unitario_original !== undefined ? item.valor_unitario_original : item.valor_unitario)}
                                    </td>
                                    <td className="px-4 py-2 text-rose-400 text-right">
                                      {formatCurrency(item.desconto || 0)}
                                    </td>
                                    <td className="px-4 py-2 font-bold text-white text-right">
                                      {formatCurrency(item.valor_total !== undefined ? item.valor_total : item.quantidade * item.valor_unitario)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {dados.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-dark-400">
                  Nenhuma venda importada.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  )
}
