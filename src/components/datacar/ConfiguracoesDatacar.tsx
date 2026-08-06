'use client'

import { useState } from 'react'
import { Key, Building2, User, Save, Loader2, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  empresa: {
    id: string
    nome: string
    datacar_token?: string | null
    datacar_cod_emp?: string | null
    datacar_id_operador?: string | null
  }
  onSalvo?: () => void
}

export default function ConfiguracoesDatacar({ empresa, onSalvo }: Props) {
  const [token, setToken] = useState(empresa.datacar_token || '')
  const [codEmp, setCodEmp] = useState(empresa.datacar_cod_emp || '')
  const [idOperador, setIdOperador] = useState(empresa.datacar_id_operador || '')
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [statusConexao, setStatusConexao] = useState<'idle' | 'ok' | 'erro'>('idle')
  const [showToken, setShowToken] = useState(false)

  const temCredenciais = !!empresa.datacar_token && !!empresa.datacar_cod_emp && !!empresa.datacar_id_operador

  const handleSalvar = async () => {
    if (!token.trim() || !codEmp.trim() || !idOperador.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch('/api/datacar/credenciais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresa.id,
          datacar_token: token.trim(),
          datacar_cod_emp: codEmp.trim(),
          datacar_id_operador: idOperador.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      toast.success('Credenciais do Datacar salvas com sucesso!')
      onSalvo?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar credenciais')
    } finally {
      setSalvando(false)
    }
  }

  const handleTestar = async () => {
    setTestando(true)
    setStatusConexao('idle')
    try {
      const res = await fetch('/api/datacar/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatusConexao('ok')
        toast.success(data.mensagem || 'Conexão OK!')
      } else {
        setStatusConexao('erro')
        toast.error(data.mensagem || data.error || 'Falha na conexão')
      }
    } catch (err: unknown) {
      setStatusConexao('erro')
      toast.error(err instanceof Error ? err.message : 'Erro ao testar conexão')
    } finally {
      setTestando(false)
    }
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
          <Key size={20} className="text-orange-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Credenciais Datacar — {empresa.nome}</h3>
          <p className="text-dark-400 text-xs">
            Token, Código da Empresa e ID do Operador fornecidos pela Datalog Sistemas
          </p>
        </div>
        {temCredenciais && (
          <div className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
            statusConexao === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
            statusConexao === 'erro' ? 'bg-red-500/20 text-red-400' :
            'bg-emerald-500/20 text-emerald-400'
          }`}>
            {statusConexao === 'ok' ? <Wifi size={12} /> :
             statusConexao === 'erro' ? <WifiOff size={12} /> :
             <Wifi size={12} />}
            {statusConexao === 'ok' ? 'Conectado' :
             statusConexao === 'erro' ? 'Erro' :
             'Configurado'}
          </div>
        )}
      </div>

      {/* Formulário */}
      <div className="space-y-3">
        {/* Token */}
        <div>
          <label className="text-xs text-dark-400 font-medium mb-1 block">Token de Acesso *</label>
          <div className="relative">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type={showToken ? 'text' : 'password'}
              placeholder="Cole aqui o token fornecido pela Datalog"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white transition-colors"
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Código da Empresa + ID Operador */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-dark-400 font-medium mb-1 flex items-center gap-1.5">
              <Building2 size={12} /> Código da Empresa (codEmp) *
            </label>
            <input
              value={codEmp}
              onChange={(e) => setCodEmp(e.target.value)}
              placeholder="Ex: 1366"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-dark-400 font-medium mb-1 flex items-center gap-1.5">
              <User size={12} /> ID do Operador *
            </label>
            <input
              value={idOperador}
              onChange={(e) => setIdOperador(e.target.value)}
              placeholder="Ex: FINANCEIRO-2"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSalvar}
          disabled={salvando || !token.trim() || !codEmp.trim() || !idOperador.trim()}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:bg-dark-700 disabled:text-dark-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando...' : 'Salvar Credenciais'}
        </button>

        {temCredenciais && (
          <button
            onClick={handleTestar}
            disabled={testando}
            className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all border border-dark-600"
          >
            {testando ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
            {testando ? 'Testando...' : 'Testar Conexão'}
          </button>
        )}
      </div>

      {/* Dica */}
      <div className="bg-dark-900/60 border border-dark-700 rounded-lg p-3">
        <p className="text-[11px] text-dark-500 leading-relaxed">
          💡 <strong className="text-dark-400">Como obter estas informações:</strong> Solicite ao suporte do Datacar
          (61 3397-1278) o <strong className="text-dark-400">Token</strong> e o <strong className="text-dark-400">Código da Empresa</strong>.
          O <strong className="text-dark-400">ID do Operador</strong> é o código numérico do seu usuário de acesso ao Datacar
          (aparece na barra inferior da tela ou pode ser solicitado ao suporte).
        </p>
      </div>
    </div>
  )
}
