'use client'

import React, { useState, useEffect } from 'react'
import { X, Send, Eye, FileText, CheckCircle, ChevronRight, ChevronLeft, Save, Building2, Wrench, DollarSign, ListChecks } from 'lucide-react'

interface ModalPreviewEmissaoProps {
  vendas: any[]
  empresaId: string
  aliquotaSimplesDefault: string
  aliquotaIssqnDefault: string
  onClose: () => void
  onConfirm: (vendasEditadas: any[]) => void
  enviando: boolean
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  } catch {
    return dateStr
  }
}

export default function ModalPreviewEmissao({
  vendas,
  empresaId,
  aliquotaSimplesDefault,
  aliquotaIssqnDefault,
  onClose,
  onConfirm,
  enviando,
}: ModalPreviewEmissaoProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1: Pessoas, 2: Serviço, 3: Valores, 4: Resumo

  // Estado editável para cada venda
  const [editaveis, setEditaveis] = useState<any[]>([])

  useEffect(() => {
    if (vendas && vendas.length > 0) {
      setEditaveis(
        vendas.map((v) => {
          const dt = v.data_venda || new Date().toISOString()
          return {
            ...v,
            _fiscal: {
              dataCompetencia: dt.split('T')[0],
              
              codigoTributarioNacional: '14.01.01',
              codigoComplementar: '14.01.01.001',
              nbs: '120013110',
              
              imunidadeIssqn: 'nao',
              
              aliquotaSimples: aliquotaSimplesDefault || '11.34',
              aliquotaIssqn: aliquotaIssqnDefault || '',
              retencaoIssqn: 'nao', // 'sim' | 'nao'
              
              regime: 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
              intermediario: 'nao_informado',
              paisPrestacao: 'Brasil',
              municipioPrestacao: v.dados_datacar?.cliente_cidade || 'Belo Horizonte/MG',
              
              // Cliente editável
              clienteNome: v.cliente || '',
              clienteCpfCnpj: v.dados_datacar?.cliente_cpf_cnpj || v.cliente_cpf_cnpj || '',
              clienteCep: v.dados_datacar?.cliente_cep || '',
              clienteLogradouro: v.dados_datacar?.cliente_logradouro || '',
              clienteNumero: v.dados_datacar?.cliente_numero || '',
              clienteBairro: v.dados_datacar?.cliente_bairro || '',
              clienteCidade: v.dados_datacar?.cliente_cidade || '',
              clienteUf: v.dados_datacar?.cliente_uf || '',
              clienteInformarEndereco: true,
              
              descricaoServico: v.itens?.map((i: any) => `${i.quantidade}x ${i.descricao}`).join('\n') || ''
            },
          }
        })
      )
    }
  }, [vendas, aliquotaSimplesDefault, aliquotaIssqnDefault])

  if (!editaveis || editaveis.length === 0) return null

  const venda = editaveis[currentIndex]
  const fiscal = venda._fiscal

  const updateFiscal = (field: string, value: any) => {
    setEditaveis((prev) => {
      const next = [...prev]
      next[currentIndex] = {
        ...next[currentIndex],
        _fiscal: { ...next[currentIndex]._fiscal, [field]: value },
      }
      return next
    })
  }

  // Aplica config do item atual para todas as vendas seguintes
  const aplicarParaTodas = () => {
    const fiscalAtual = editaveis[currentIndex]._fiscal
    setEditaveis((prev) =>
      prev.map((v, i) =>
        i === currentIndex
          ? v
          : {
              ...v,
              _fiscal: {
                ...v._fiscal,
                codigoTributarioNacional: fiscalAtual.codigoTributarioNacional,
                codigoComplementar: fiscalAtual.codigoComplementar,
                nbs: fiscalAtual.nbs,
                aliquotaSimples: fiscalAtual.aliquotaSimples,
                aliquotaIssqn: fiscalAtual.aliquotaIssqn,
                retencaoIssqn: fiscalAtual.retencaoIssqn,
                regime: fiscalAtual.regime,
                intermediario: fiscalAtual.intermediario,
              },
            }
      )
    )
    alert('Configurações tributárias aplicadas para todas as notas deste lote!')
  }

  const handleNextStep = () => {
    if (step < 4) setStep(s => (s + 1) as any)
  }

  const handlePrevStep = () => {
    if (step > 1) setStep(s => (s - 1) as any)
  }

  const inputClass = 'w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all'
  const selectClass = 'w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:border-blue-500 outline-none transition-all'
  const labelClass = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1'

  // Opções simulando o portal do governo
  const nbsOptions = [
    { value: '120013110', label: '120013110 - Serviços de manutenção e reparação de veículos rodoviários motorizados' },
    { value: '120013111', label: '120013111 - Serviços de lavagem, lubrificação e polimento de veículos automotores' }
  ]
  
  const ctNacionalOptions = [
    { value: '14.01.01', label: '14.01.01 - Lubrificação, limpeza, lustração, revisão, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos...' }
  ]
  
  const ccMunicipalOptions = [
    { value: '14.01.01.001', label: '14.01.01.001 - Lubrificação, limpeza, lustração, revisão, conserto, restauração, blindagem, manutenção e conservação de motores, máquinas...' }
  ]

  const navItemClass = (itemStep: number) => `
    flex-1 flex flex-col items-center justify-center py-3 border-b-4 transition-all
    ${step === itemStep ? 'border-blue-600 text-blue-600 bg-blue-50/50' : step > itemStep ? 'border-green-500 text-green-600 bg-green-50/20 cursor-pointer' : 'border-gray-200 text-gray-400'}
  `

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#f8f9fa] border border-gray-300 rounded shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden relative">
        
        {/* Header imitando Portal NFS-e */}
        <div className="flex items-center justify-between bg-white border-b border-gray-300 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-blue-700">NFS-e</span>
                <span className="text-gray-500 font-normal text-sm">PORTAL CONTRIBUINTE</span>
              </h2>
              <span className="text-xs text-gray-400">Emissão Completa</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Stepper Navbar */}
        <div className="flex bg-white border-b border-gray-200 shadow-sm">
          <div className={navItemClass(1)} onClick={() => setStep(1)}>
            <Building2 size={24} className="mb-1" />
            <span className="text-xs font-bold uppercase">Pessoas</span>
          </div>
          <div className={navItemClass(2)} onClick={() => step > 1 && setStep(2)}>
            <Wrench size={24} className="mb-1" />
            <span className="text-xs font-bold uppercase">Serviço</span>
          </div>
          <div className={navItemClass(3)} onClick={() => step > 2 && setStep(3)}>
            <DollarSign size={24} className="mb-1" />
            <span className="text-xs font-bold uppercase">Valores</span>
          </div>
          <div className={navItemClass(4)} onClick={() => step > 3 && setStep(4)}>
            <ListChecks size={24} className="mb-1" />
            <span className="text-xs font-bold uppercase">Emitir NFS-e</span>
          </div>
        </div>

        {/* Paginação de Notas (Fica fixo acima do conteúdo) */}
        {editaveis.length > 1 && (
          <div className="bg-blue-50 border-b border-blue-100 p-2 flex items-center justify-center gap-4 text-sm font-semibold text-blue-800">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="p-1 hover:bg-blue-200 rounded disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span>Lote: Nota {currentIndex + 1} de {editaveis.length}</span>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(editaveis.length - 1, i + 1))}
              disabled={currentIndex === editaveis.length - 1}
              className="p-1 hover:bg-blue-200 rounded disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8f9fa] custom-scrollbar text-gray-700">
          
          {/* STEP 1: PESSOAS */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div>
                <label className="text-sm font-semibold mb-1 block">Data de Competência *</label>
                <input type="date" value={fiscal.dataCompetencia} readOnly className={`${inputClass} w-48 bg-gray-100 cursor-not-allowed`} />
              </div>
              
              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  EMITENTE DA NFS-E
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className={labelClass}>Você irá emitir esta NFS-e como? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked readOnly /> Prestador</label>
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Tomador</label>
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Intermediário</label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Município *</label>
                      <input type="text" value="Belo Horizonte/MG" readOnly className={`${inputClass} bg-gray-50`} />
                    </div>
                    <div>
                      <label className={labelClass}>Indicador Municipal *</label>
                      <input type="text" value="15219040018" readOnly className={`${inputClass} bg-gray-50`} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Opção no Simples Nacional *</label>
                    <input type="text" value="Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)" readOnly className={`${inputClass} bg-gray-50`} />
                  </div>

                  <div>
                    <label className={labelClass}>Regime de Apuração dos Tributos no Simples Nacional *</label>
                    <select className={`${selectClass} bg-gray-50`} disabled>
                      <option>{fiscal.regime}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  TOMADOR DO SERVIÇO
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className={labelClass}>Onde está localizado o estabelecimento/domicílio? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Não informado</label>
                      <label className="flex items-center gap-2"><input type="radio" checked readOnly /> Brasil</label>
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Exterior</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className={labelClass}>CPF/CNPJ *</label>
                      <input 
                        type="text" 
                        value={fiscal.clienteCpfCnpj} 
                        onChange={(e) => updateFiscal('clienteCpfCnpj', e.target.value)}
                        className={inputClass} 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>Nome/Razão Social *</label>
                      <input 
                        type="text" 
                        value={fiscal.clienteNome} 
                        onChange={(e) => updateFiscal('clienteNome', e.target.value)}
                        className={inputClass} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <input 
                        type="checkbox" 
                        checked={fiscal.clienteInformarEndereco}
                        onChange={(e) => updateFiscal('clienteInformarEndereco', e.target.checked)}
                      />
                      Informar endereço
                    </label>
                    
                    {fiscal.clienteInformarEndereco && (
                      <div className="grid grid-cols-12 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="col-span-3">
                          <label className={labelClass}>CEP *</label>
                          <input type="text" value={fiscal.clienteCep} onChange={e => updateFiscal('clienteCep', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-9">
                          <label className={labelClass}>Município *</label>
                          <input type="text" value={`${fiscal.clienteCidade}/${fiscal.clienteUf}`} onChange={e => updateFiscal('clienteCidade', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-4">
                          <label className={labelClass}>Bairro *</label>
                          <input type="text" value={fiscal.clienteBairro} onChange={e => updateFiscal('clienteBairro', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-8">
                          <label className={labelClass}>Logradouro *</label>
                          <input type="text" value={fiscal.clienteLogradouro} onChange={e => updateFiscal('clienteLogradouro', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-3">
                          <label className={labelClass}>Número *</label>
                          <input type="text" value={fiscal.clienteNumero} onChange={e => updateFiscal('clienteNumero', e.target.value)} className={inputClass} />
                        </div>
                        <div className="col-span-9">
                          <label className={labelClass}>Complemento</label>
                          <input type="text" className={inputClass} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  INTERMEDIÁRIO DO SERVIÇO
                </div>
                <div className="p-4">
                  <label className={labelClass}>Onde está localizado o estabelecimento/domicílio? *</label>
                  <div className="flex gap-4 text-sm mt-2">
                    <label className="flex items-center gap-2"><input type="radio" checked readOnly /> Intermediário não informado</label>
                    <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Brasil</label>
                    <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Exterior</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SERVIÇO */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              
              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  LOCAL DA PRESTAÇÃO DO SERVIÇO
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>País *</label>
                    <select className={`${selectClass} bg-gray-50`} disabled>
                      <option>Brasil</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Município *</label>
                    <select className={`${selectClass} bg-gray-50`} disabled>
                      <option>{fiscal.municipioPrestacao}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm flex justify-between items-center">
                  <span>SERVIÇO PRESTADO</span>
                  <button onClick={aplicarParaTodas} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-normal">
                    Aplicar configurações para todas as notas
                  </button>
                </div>
                <div className="p-4 space-y-5">
                  <div>
                    <label className={labelClass}>Código de Tributação Nacional *</label>
                    <select 
                      value={fiscal.codigoTributarioNacional}
                      onChange={(e) => updateFiscal('codigoTributarioNacional', e.target.value)}
                      className={selectClass}
                    >
                      {ctNacionalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      <option value="outro">Outro código (Buscar...)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className={labelClass}>Código Complementar Municipal *</label>
                    <select 
                      value={fiscal.codigoComplementar}
                      onChange={(e) => updateFiscal('codigoComplementar', e.target.value)}
                      className={selectClass}
                    >
                      {ccMunicipalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      <option value="outro">Outro código (Buscar...)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className={labelClass}>O serviço prestado é um caso de: imunidade, exportação de serviço ou não incidência do ISSQN? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked={fiscal.imunidadeIssqn === 'nao'} onChange={() => updateFiscal('imunidadeIssqn', 'nao')} /> Não</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={fiscal.imunidadeIssqn === 'sim'} onChange={() => updateFiscal('imunidadeIssqn', 'sim')} /> Sim</label>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Descrição do Serviço *</label>
                    <textarea 
                      value={fiscal.descricaoServico}
                      onChange={(e) => updateFiscal('descricaoServico', e.target.value)}
                      rows={5}
                      className={inputClass}
                    />
                  </div>
                  
                  <div>
                    <label className={labelClass}>Item da NBS correspondente ao serviço prestado</label>
                    <select 
                      value={fiscal.nbs}
                      onChange={(e) => updateFiscal('nbs', e.target.value)}
                      className={selectClass}
                    >
                      {nbsOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 3: VALORES */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              
              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  VALORES DO SERVIÇO PRESTADO
                </div>
                <div className="p-4 grid grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Valor do serviço prestado *</label>
                    <input type="text" value={formatCurrency(venda.valor_total)} readOnly className={`${inputClass} bg-gray-50`} />
                  </div>
                  <div>
                    <label className={labelClass}>Valor pelo intermediário</label>
                    <input type="text" placeholder="R$" readOnly className={`${inputClass} bg-gray-50`} />
                  </div>
                  <div>
                    <label className={labelClass}>Desconto incondicionado</label>
                    <input type="text" placeholder="R$" readOnly className={`${inputClass} bg-gray-50`} />
                  </div>
                  <div>
                    <label className={labelClass}>Desconto condicionado</label>
                    <input type="text" placeholder="R$" readOnly className={`${inputClass} bg-gray-50`} />
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  TRIBUTAÇÃO MUNICIPAL
                </div>
                <div className="p-4 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Tributação do ISSQN sobre o serviço</label>
                      <select className={`${selectClass} bg-gray-50`} disabled><option>Operação Tributável</option></select>
                    </div>
                    <div>
                      <label className={labelClass}>Regime Especial de Tributação *</label>
                      <select className={`${selectClass} bg-gray-50`} disabled><option>Nenhum</option></select>
                    </div>
                  </div>
                  
                  <div>
                    <label className={labelClass}>A exigibilidade do recolhimento do ISSQN está suspensa? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked readOnly /> Não</label>
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Sim</label>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Há retenção do ISSQN pelo Tomador ou pelo Intermediário? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked={fiscal.retencaoIssqn === 'nao'} onChange={() => updateFiscal('retencaoIssqn', 'nao')} /> Não</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={fiscal.retencaoIssqn === 'sim'} onChange={() => updateFiscal('retencaoIssqn', 'sim')} /> Sim</label>
                    </div>
                  </div>

                  {fiscal.retencaoIssqn === 'sim' && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded space-y-4">
                      <div>
                        <label className={labelClass}>Informe o valor da alíquota *</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={fiscal.aliquotaIssqn} 
                            onChange={e => updateFiscal('aliquotaIssqn', e.target.value)}
                            className={`${inputClass} w-32`} 
                          />
                          <span className="text-sm font-bold text-gray-600">%</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 border-t border-blue-200 pt-4">
                        <div>
                          <label className={labelClass}>Alíquota</label>
                          <div className="text-sm font-bold bg-gray-100 p-2 rounded text-right">{fiscal.aliquotaIssqn}%</div>
                        </div>
                        <div>
                          <label className={labelClass}>BC ISSQN</label>
                          <div className="text-sm font-bold bg-gray-100 p-2 rounded text-right">{formatCurrency(venda.valor_total)}</div>
                        </div>
                        <div>
                          <label className={labelClass}>Valor ISSQN</label>
                          <div className="text-sm font-bold bg-gray-100 p-2 rounded text-right">
                            {formatCurrency(venda.valor_total * (parseFloat(fiscal.aliquotaIssqn || '0') / 100))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className={labelClass}>Será aplicado algum tipo de Dedução/Redução? *</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked readOnly /> Não</label>
                      <label className="flex items-center gap-2 text-gray-400"><input type="radio" disabled /> Sim</label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded bg-white overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 font-semibold text-gray-600 text-sm">
                  TRIBUTAÇÃO FEDERAL E APROXIMAÇÃO
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Situação Tributária do PIS/COFINS *</label>
                      <select className={`${selectClass} bg-gray-50`} disabled><option>00 - Nenhum</option></select>
                    </div>
                    <div>
                      <label className={labelClass}>Tipo de retenção *</label>
                      <select className={`${selectClass} bg-gray-50`} disabled><option>PIS/COFINS/CSLL Não Retidos</option></select>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <label className={labelClass}>Alíquota no Simples Nacional *</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={fiscal.aliquotaSimples} 
                        onChange={e => updateFiscal('aliquotaSimples', e.target.value)}
                        className={`${inputClass} w-32`} 
                      />
                      <span className="text-sm font-bold text-gray-600">%</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 4: RESUMO */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in max-w-4xl mx-auto pb-10">
              
              <div className="border border-gray-300 bg-white">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 text-xs font-bold text-gray-500">PESSOAS</div>
                <div className="p-4 space-y-4 text-sm text-gray-700">
                  <div className="border-b border-gray-100 pb-2">
                    <p><strong className="w-40 inline-block text-gray-500">Você irá emitir como:</strong> PRESTADOR</p>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">Tomador do Serviço</h4>
                    <p><strong className="w-24 inline-block text-gray-500">CPF/CNPJ:</strong> {fiscal.clienteCpfCnpj}</p>
                    <p><strong className="w-24 inline-block text-gray-500">Razão Social:</strong> {fiscal.clienteNome}</p>
                    <p><strong className="w-24 inline-block text-gray-500">CEP:</strong> {fiscal.clienteCep}</p>
                    <p><strong className="w-24 inline-block text-gray-500">Município:</strong> {fiscal.clienteCidade}/{fiscal.clienteUf}</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 bg-white">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 text-xs font-bold text-gray-500">SERVIÇO</div>
                <div className="p-4 space-y-2 text-sm text-gray-700">
                  <p><strong className="w-48 inline-block text-gray-500">Data de Competência:</strong> {formatDate(fiscal.dataCompetencia)}</p>
                  <p><strong className="w-48 inline-block text-gray-500">Cód. Tributação:</strong> {fiscal.codigoTributarioNacional}</p>
                  <p><strong className="w-48 inline-block text-gray-500">Descrição do Serviço:</strong> {fiscal.descricaoServico}</p>
                  <p><strong className="w-48 inline-block text-gray-500">Item NBS:</strong> {fiscal.nbs}</p>
                </div>
              </div>

              <div className="border border-green-300 bg-green-50">
                <div className="bg-green-100 px-4 py-2 border-b border-green-200 text-xs font-bold text-green-800">PRÉVIA DOS VALORES DA NFS-E</div>
                <div className="p-4 space-y-4 text-sm text-gray-700">
                  <div className="flex justify-between border-b border-green-200 pb-2 border-dashed">
                    <span className="text-green-800">Serviço prestado:</span>
                    <strong className="text-green-900">{formatCurrency(venda.valor_total)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-green-200 pb-2 border-dashed">
                    <span className="text-green-800">Alíquota ISSQN aplicada:</span>
                    <strong className="text-green-900">{fiscal.retencaoIssqn === 'sim' ? `${fiscal.aliquotaIssqn}%` : '-'}</strong>
                  </div>
                  <div className="flex justify-between border-b border-green-200 pb-2 border-dashed">
                    <span className="text-green-800">ISSQN Retido:</span>
                    <strong className="text-green-900">
                      {fiscal.retencaoIssqn === 'sim' ? formatCurrency(venda.valor_total * (parseFloat(fiscal.aliquotaIssqn || '0') / 100)) : 'R$ 0,00'}
                    </strong>
                  </div>
                  <div className="flex justify-between font-bold pt-2">
                    <span className="text-green-900">Valor líquido da NFS-e:</span>
                    <span className="text-green-900">
                      {fiscal.retencaoIssqn === 'sim' 
                        ? formatCurrency(venda.valor_total - (venda.valor_total * (parseFloat(fiscal.aliquotaIssqn || '0') / 100))) 
                        : formatCurrency(venda.valor_total)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-300 p-4 flex items-center justify-between">
          <button
            onClick={step === 1 ? onClose : handlePrevStep}
            className="px-6 py-2 border border-gray-400 text-gray-600 font-bold rounded hover:bg-gray-100 transition-colors"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          
          <div className="flex gap-4">
            {step < 4 ? (
              <button
                onClick={handleNextStep}
                className="px-6 py-2 bg-blue-800 text-white font-bold rounded hover:bg-blue-900 flex items-center gap-2"
              >
                Avançar <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={() => onConfirm(editaveis)}
                disabled={enviando}
                className="px-6 py-2 bg-green-700 text-white font-bold rounded hover:bg-green-800 flex items-center gap-2"
              >
                {enviando ? 'Enviando...' : `Confirmar Emissão (${editaveis.length} Notas)`}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
