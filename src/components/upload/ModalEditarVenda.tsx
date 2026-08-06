import React, { useState, useEffect } from 'react'
import type { VendaPreview } from '@/types'
import { X, Plus, Trash2, Save } from 'lucide-react'
import { parseCurrency } from '@/lib/utils'

interface ModalEditarVendaProps {
  venda: VendaPreview | null
  onSave: (vendaAtualizada: VendaPreview) => void
  onClose: () => void
  empresaId?: string
}

export default function ModalEditarVenda({ venda, onSave, onClose, empresaId }: ModalEditarVendaProps) {
  const [formData, setFormData] = useState<VendaPreview | null>(null)

  useEffect(() => {
    if (venda) {
      setFormData(JSON.parse(JSON.stringify(venda))) // Deep copy
    } else {
      setFormData(null)
    }
  }, [venda])

  if (!formData) return null

  const recalcularTotal = (itens: any[]) => {
    return itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0)
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const novosItens = [...formData.itens]
    novosItens[index] = { ...novosItens[index], [field]: value }
    
    setFormData({
      ...formData,
      itens: novosItens,
      valor_total: recalcularTotal(novosItens)
    })
  }

  const handleAdicionarItem = () => {
    const novosItens = [
      ...formData.itens, 
      { codigo: 'NOVO', descricao: 'Novo Item', quantidade: 1, valor_unitario: 0 }
    ]
    setFormData({
      ...formData,
      itens: novosItens,
      valor_total: recalcularTotal(novosItens)
    })
  }

  const handleRemoverItem = (index: number) => {
    const novosItens = formData.itens.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      itens: novosItens,
      valor_total: recalcularTotal(novosItens)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-6xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700/50">
          <h3 className="text-lg font-bold text-white">Editar Venda</h3>
          <button onClick={onClose} className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-dark-300">Cliente</label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">Data da Venda</label>
              <input
                type="date"
                value={formData.data_venda}
                onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">OS / Pedido</label>
              <input
                type="text"
                value={formData.os_numero}
                onChange={(e) => setFormData({ ...formData, os_numero: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-dark-300">Forma de Pagamento</label>
              <input
                type="text"
                value={formData.forma_pagamento || ''}
                onChange={(e) => setFormData({ ...formData, forma_pagamento: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                placeholder="Ex: Cartão de Crédito"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Itens da Venda e Dados Fiscais</h4>
              <button
                onClick={handleAdicionarItem}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 px-2 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>
            
            <div className="bg-dark-800/50 border border-dark-700 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[1000px]">
                <thead className="text-[11px] text-dark-400 border-b border-dark-700 uppercase">
                  <tr>
                    <th className="p-2 font-medium w-32">Código</th>
                    <th className="p-2 font-medium">Descrição</th>
                    <th className="p-2 font-medium w-20">Qtd</th>
                    <th className="p-2 font-medium w-28">Vl Unit</th>
                    <th className="p-2 font-medium w-20">UN</th>
                    <th className="p-2 font-medium w-28">NCM</th>
                    <th className="p-2 font-medium w-28">CEST</th>
                    <th className="p-2 font-medium w-48">Origem</th>
                    <th className="p-2 font-medium w-48">Tipo Produto</th>
                    <th className="p-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {formData.itens.map((item, i) => (
                    <tr key={i} className="group hover:bg-dark-700/30 text-xs">
                      <td className="p-1">
                        <input
                          type="text"
                          value={item.codigo || ''}
                          onChange={(e) => handleItemChange(i, 'codigo', e.target.value)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={item.descricao || ''}
                          onChange={(e) => handleItemChange(i, 'descricao', e.target.value)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.quantidade || 0}
                          onChange={(e) => handleItemChange(i, 'quantidade', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.valor_unitario?.toFixed(2) || '0.00'}
                          onChange={(e) => handleItemChange(i, 'valor_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          placeholder="UN"
                          value={item.unidade_medida || ''}
                          onChange={(e) => handleItemChange(i, 'unidade_medida', e.target.value.toUpperCase())}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={item.ncm || ''}
                          onChange={(e) => handleItemChange(i, 'ncm', e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={item.cest || ''}
                          onChange={(e) => handleItemChange(i, 'cest', e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        />
                      </td>
                      <td className="p-1">
                        <select
                          value={item.origem || ''}
                          onChange={(e) => handleItemChange(i, 'origem', e.target.value)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        >
                          <option value="" className="bg-dark-900">Selecione...</option>
                          <option value="0 - Nacional" className="bg-dark-900">0 - Nacional</option>
                          <option value="1 - Estrangeira - Importação direta" className="bg-dark-900">1 - Estrangeira - Imp. Direta</option>
                          <option value="2 - Estrangeira - Adquirida no mercado interno" className="bg-dark-900">2 - Estrangeira - Mercado Int.</option>
                          <option value="3 - Nacional - Conteúdo de Importação > 40%" className="bg-dark-900">3 - Nac. (Imp. &gt; 40%)</option>
                        </select>
                      </td>
                      <td className="p-1">
                        <select
                          value={item.tipo_produto || ''}
                          onChange={(e) => handleItemChange(i, 'tipo_produto', e.target.value)}
                          className="w-full bg-transparent border border-transparent rounded px-2 py-1.5 text-white hover:border-dark-600 focus:border-brand-500 focus:bg-dark-800 outline-none transition-all"
                        >
                          <option value="" className="bg-dark-900">Selecione...</option>
                          <option value="00 - Mercadoria para Revenda" className="bg-dark-900">00 - Merc. para Revenda</option>
                          <option value="01 - Matéria-Prima" className="bg-dark-900">01 - Matéria-Prima</option>
                          <option value="04 - Produto Acabado" className="bg-dark-900">04 - Produto Acabado</option>
                          <option value="07 - Material de Uso e Consumo" className="bg-dark-900">07 - Uso e Consumo</option>
                          <option value="09 - Serviços" className="bg-dark-900">09 - Serviços</option>
                        </select>
                      </td>
                      <td className="p-1">
                        <button
                          onClick={() => handleRemoverItem(i)}
                          className="text-dark-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {formData.itens.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-dark-400 text-sm">
                        Nenhum item na venda. Adicione ao menos um.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end p-2">
              <div className="text-right">
                <span className="text-xs text-dark-400 mr-3">Valor Total:</span>
                <span className="text-lg font-bold text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.valor_total)}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-dark-700/50 flex justify-end gap-3 bg-dark-900/80">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-dark-300 hover:text-white rounded-xl hover:bg-dark-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              // Revalida a venda antes de salvar
              const isValid = formData.cliente && formData.data_venda && formData.itens.length > 0
              
              // Salvar na Memória Fiscal (aprende com as edições do usuário)
              if (empresaId && formData.itens.length > 0) {
                fetch('/api/memoria-fiscal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ empresa_id: empresaId, itens: formData.itens })
                }).catch(e => console.warn('[ModalEditarVenda] Erro ao salvar memória fiscal:', e))
              }

              onSave({
                ...formData,
                valido: !!isValid,
                erros: isValid ? [] : ['Dados incompletos após edição']
              })
            }}
            disabled={formData.itens.length === 0}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50"
          >
            <Save size={16} />
            Salvar Alterações
          </button>
        </div>

      </div>
    </div>
  )
}
