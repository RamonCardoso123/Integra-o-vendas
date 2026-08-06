import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface ModalEditarDatacarProps {
  vendaId: string
  venda: any // VendaImportada
  onClose: () => void
  onSaveSuccess: (vendaAtualizada: any) => void
}

export default function ModalEditarDatacar({ vendaId, venda, onClose, onSaveSuccess }: ModalEditarDatacarProps) {
  const [formData, setFormData] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (venda) {
      setFormData({
        cliente: venda.cliente || '',
        cpf_cnpj: venda.dados_datacar?.cliente_cpf_cnpj || '',
        cep: venda.dados_datacar?.cliente_cep || '',
        logradouro: venda.dados_datacar?.cliente_logradouro || '',
        numero: venda.dados_datacar?.cliente_numero || '',
        complemento: venda.dados_datacar?.cliente_complemento || '',
        bairro: venda.dados_datacar?.cliente_bairro || '',
        cidade: venda.dados_datacar?.cliente_cidade || '',
        uf: venda.dados_datacar?.cliente_uf || '',
        os_numero: venda.os_numero || '',
        itens: venda.itens ? JSON.parse(JSON.stringify(venda.itens)) : [],
      })
    }
  }, [venda])

  if (!formData) return null

  const recalcularTotal = (itens: any[]) => {
    return itens.reduce((acc, item) => acc + ((item.quantidade || 0) * (item.valor_unitario || 0)), 0)
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const novosItens = [...formData.itens]
    novosItens[index] = { ...novosItens[index], [field]: value }
    setFormData({ ...formData, itens: novosItens })
  }

  const handleAdicionarItem = () => {
    const novosItens = [
      ...formData.itens, 
      { codigo: 'NOVO', descricao: 'Novo Item', quantidade: 1, valor_unitario: 0 }
    ]
    setFormData({ ...formData, itens: novosItens })
  }

  const handleRemoverItem = (index: number) => {
    const novosItens = formData.itens.filter((_: any, i: number) => i !== index)
    setFormData({ ...formData, itens: novosItens })
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
      const novosDadosDatacar = {
        ...venda.dados_datacar,
        cliente_cpf_cnpj: formData.cpf_cnpj,
        cliente_cep: formData.cep,
        cliente_logradouro: formData.logradouro,
        cliente_numero: formData.numero,
        cliente_complemento: formData.complemento,
        cliente_bairro: formData.bairro,
        cliente_cidade: formData.cidade,
        cliente_uf: formData.uf,
      }

      const vendaAtualizada = {
        ...venda,
        cliente: formData.cliente,
        cliente_cpf_cnpj: formData.cpf_cnpj || venda.cliente_cpf_cnpj,
        cliente_endereco: {
          logradouro: formData.logradouro || null,
          numero: formData.numero || null,
          complemento: formData.complemento || null,
          bairro: formData.bairro || null,
          cidade: formData.cidade || null,
          estado: formData.uf || null,
          cep: formData.cep || null,
        },
        os_numero: formData.os_numero,
        dados_datacar: novosDadosDatacar,
        itens: formData.itens,
        valor_total: recalcularTotal(formData.itens)
      }

      // Salvar na Memória Fiscal (aprende com as edições do usuário)
      try {
        const empresa_id = venda.empresa_id
        if (empresa_id && formData.itens.length > 0) {
          
          // Verifica se há dados fiscais preenchidos para justificar a pergunta
          const temFiscal = formData.itens.some((i: any) => i.ncm || i.cest)
          
          let salvarParaFamilia = false
          if (temFiscal) {
            salvarParaFamilia = window.confirm(
              "Deseja que o sistema aprenda esses dados fiscais (NCM/CEST) para aplicar em todos os produtos similares (mesma família/palavra-chave) nas próximas importações?\n\n" +
              "OK = Aplicar para todos similares\n" +
              "Cancelar = Somente para este código exato"
            )
          }

          // Adiciona a flag nos itens
          const itensPayload = formData.itens.map((i: any) => ({
            ...i,
            salvarParaFamilia
          }))

          await fetch('/api/memoria-fiscal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa_id, itens: itensPayload })
          })
        }
      } catch (e) {
        console.warn('[ModalEditarDatacar] Erro ao salvar memória fiscal (não crítico):', e)
      }

      toast.success('Venda atualizada na lista de importação!')
      onSaveSuccess(vendaAtualizada)
      onClose()
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar as alterações')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-6xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700/50">
          <h3 className="text-lg font-bold text-white">Editar Informações da Venda</h3>
          <button onClick={onClose} className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-dark-300">Cliente (Nome/Razão Social)</label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">CPF / CNPJ</label>
              <input
                type="text"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
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
          </div>

          <hr className="border-dark-700/50" />
          <h4 className="text-sm font-semibold text-white">Endereço do Cliente</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">CEP</label>
              <input
                type="text"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-dark-300">Logradouro (Rua, Av.)</label>
              <input
                type="text"
                value={formData.logradouro}
                onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">Número</label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-dark-300">Complemento</label>
              <input
                type="text"
                value={formData.complemento}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">Bairro</label>
              <input
                type="text"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">Cidade</label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-dark-300">Estado (UF)</label>
              <input
                type="text"
                value={formData.uf}
                maxLength={2}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
          </div>

          <hr className="border-dark-700/50" />
          
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
                  {formData.itens.map((item: any, i: number) => (
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
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recalcularTotal(formData.itens))}
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
            onClick={handleSave}
            disabled={salvando}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50"
          >
            <Save size={16} />
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

      </div>
    </div>
  )
}
