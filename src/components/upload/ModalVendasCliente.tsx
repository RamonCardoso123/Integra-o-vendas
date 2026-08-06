import { useState, useEffect } from 'react'
import { X, Loader2, Database, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ModalVendasClienteProps {
  empresaId: string
  cpfCnpj: string
  onClose: () => void
}

export default function ModalVendasCliente({ empresaId, cpfCnpj, onClose }: ModalVendasClienteProps) {
  const [loading, setLoading] = useState(true)
  const [vendas, setVendas] = useState<any[]>([])

  useEffect(() => {
    const buscarVendas = async () => {
      try {
        const res = await fetch(`/api/conta-azul/buscar-vendas-cliente?empresa_id=${empresaId}&cpf_cnpj=${cpfCnpj}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao buscar vendas do cliente')
        setVendas(data.vendas || [])
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    if (empresaId && cpfCnpj) {
      buscarVendas()
    }
  }, [empresaId, cpfCnpj])

  const formatCurrency = (val: number) =>
    val?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'

  const formatDate = (dt: string | null) => {
    if (!dt) return '-'
    try {
      const d = new Date(dt.includes('T') ? dt : dt + 'T12:00:00')
      if (isNaN(d.getTime())) return dt
      return d.toLocaleDateString('pt-BR')
    } catch { return dt }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-dark-700/50 bg-dark-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <AlertCircle size={20} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cliente já possui Vendas</h2>
              <p className="text-xs text-dark-400">Verifique o histórico abaixo para evitar emissão duplicada.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-brand-400" />
              <p className="text-sm text-dark-400 font-medium">Buscando histórico na base...</p>
            </div>
          ) : vendas.length === 0 ? (
            <div className="text-center py-12 bg-dark-800/50 rounded-xl border border-dark-700 border-dashed">
              <Database size={32} className="text-dark-500 mx-auto mb-3" />
              <p className="text-dark-300 font-medium">Nenhuma venda encontrada na base local.</p>
              <p className="text-dark-500 text-sm mt-1">O cliente existe no Conta Azul, mas talvez não tenha vendas recentes ou registradas por este app.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-dark-300 font-medium mb-4">
                Encontramos <strong className="text-white">{vendas.length}</strong> venda(s) anterior(es) lançada(s) pelo app:
              </p>
              {vendas.map((v: any, i: number) => (
                <div key={i} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-dark-600 transition-colors">
                  <div>
                    <h3 className="text-white font-semibold text-sm">{v.cliente}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-dark-400 font-mono">
                        <span className="text-dark-500 mr-1">OS:</span>
                        {v.os_numero || 'S/N'}
                      </p>
                      <p className="text-xs text-dark-400">
                        <span className="text-dark-500 mr-1">Data:</span>
                        {formatDate(v.data_venda)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <p className="text-lg font-bold text-white tabular-nums">
                      {formatCurrency(v.valor_total)}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      v.status === 'enviado' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                      v.status === 'erro' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                      'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {v.status === 'enviado' ? 'Enviada' : v.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-dark-700/50 bg-dark-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-dark-700 hover:bg-dark-600 text-white transition-colors"
          >
            Fechar e Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
