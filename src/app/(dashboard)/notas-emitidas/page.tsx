'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import SelectorEmpresa from '@/components/layout/SelectorEmpresa'
import {
  Database, Search, Filter, Loader2,
  Eye, RefreshCw, XCircle, FileCode, FileText,
  MoreVertical, Calendar, X, CheckCircle,
  Printer, ArrowLeftRight, ShoppingCart,
  Download, AlertTriangle, FileWarning,
  ChevronLeft, ChevronRight, Plus
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Tipos ──────────────────────────────────────────────────────────
interface NotaEmitida {
  id: string
  cliente: string
  os_numero: string
  data_venda: string | null
  valor_total: number
  status: 'enviado' | 'cancelado'
  erro_mensagem: string | null
  metadata: any
  dados_datacar: any
  updated_at: string
  created_at: string
  conta_azul_id: string | null
}

type AbaAtiva = 'servicos' | 'produtos'

// ─── Helpers ────────────────────────────────────────────────────────
const formatCurrency = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (d: string | null) => {
  if (!d) return '—'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch { return d }
}

const formatDateTime = (d: string | null) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return d }
}

// ─── Gerador de XML de demonstração ─────────────────────────────────
function gerarXmlDemonstrativo(nota: NotaEmitida): string {
  const cpfCnpj = nota.dados_datacar?.cliente_cpf_cnpj || nota.metadata?.cliente_cpf_cnpj || '00.000.000/0000-00'
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFSe_${nota.os_numero}">
    <Emissao>
      <xLocEmi>Belo Horizonte/MG</xLocEmi>
      <dCompet>${nota.data_venda || new Date().toISOString().slice(0, 10)}</dCompet>
    </Emissao>
    <Prestador>
      <xNome>Empresa Emitente</xNome>
    </Prestador>
    <Tomador>
      <CNPJ>${cpfCnpj}</CNPJ>
      <xNome>${nota.cliente}</xNome>
    </Tomador>
    <Servico>
      <cTribNac>14.01.01</cTribNac>
      <xDescServ>Serviço de manutenção veicular — OS #${nota.os_numero}</xDescServ>
    </Servico>
    <Valores>
      <vServPrest>${nota.valor_total.toFixed(2)}</vServPrest>
      <vReceb>${nota.valor_total.toFixed(2)}</vReceb>
    </Valores>
    <Situacao>${nota.status === 'cancelado' ? 'CANCELADA' : 'EMITIDA'}</Situacao>
  </infNFSe>
</NFSe>`
}

// ─── Gerador de DANFS-e HTML (demonstração oficial) ─────────────────
function gerarDanfseHtml(nota: NotaEmitida): string {
  const cpfCnpj = nota.dados_datacar?.cliente_cpf_cnpj || nota.metadata?.cliente_cpf_cnpj || '—'
  const dateEmissao = formatDateTime(nota.updated_at)
  const competencia = nota.data_venda ? `${nota.data_venda.slice(8,10)}/${nota.data_venda.slice(5,7)}/${nota.data_venda.slice(0,4)}` : '—'
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFS-e — OS #${nota.os_numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
    body { padding: 40px; background: #fff; color: #000; font-size: 11px; }
    .page { max-width: 800px; margin: 0 auto; border: 1px solid #000; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding: 10px; }
    .header-logo { width: 120px; }
    .header-title { text-align: center; flex: 1; }
    .header-title h1 { font-size: 16px; font-weight: bold; }
    .header-title h2 { font-size: 14px; font-weight: bold; }
    .header-brasao { width: 150px; text-align: right; }
    .header-brasao img { width: 40px; margin-bottom: 5px; }
    
    .grid-container { display: flex; flex-direction: column; border-bottom: 1px solid #000; }
    .grid-row { display: flex; border-bottom: 1px solid #000; }
    .grid-row:last-child { border-bottom: none; }
    .grid-cell { padding: 4px 8px; border-right: 1px solid #000; flex: 1; }
    .grid-cell:last-child { border-right: none; }
    .grid-cell.qr-code { width: 120px; text-align: center; justify-content: center; display: flex; flex-direction: column; align-items: center; border-left: 1px solid #000; }
    
    .label { font-size: 9px; font-weight: bold; margin-bottom: 2px; }
    .value { font-size: 11px; }
    
    .section-title { font-size: 11px; font-weight: bold; background: #f0f0f0; padding: 4px 8px; border-bottom: 1px solid #000; border-top: 1px solid #000; text-transform: uppercase; }
    .section-title.no-top { border-top: none; }
    
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(255, 0, 0, 0.1); font-weight: bold; z-index: -1; white-space: nowrap; pointer-events: none; }
    
    @media print { body { padding: 0; } .page { border: none; } }
  </style>
</head>
<body>
  ${nota.status === 'cancelado' ? '<div class="watermark">NFS-E CANCELADA</div>' : ''}
  <div class="page">
    <div class="header">
      <div class="header-logo">
        <!-- Espaço para logo NFS-e -->
        <div style="font-weight:900; font-size:24px; color:#166534; line-height:0.8;">NFS<span style="font-size:16px;">e</span></div>
        <div style="font-size:8px; color:#666; margin-top:2px;">Nota Fiscal de Serviço eletrônica</div>
      </div>
      <div class="header-title">
        <h1>DANFSe v1.0</h1>
        <h2>Documento Auxiliar da NFS-e</h2>
      </div>
      <div class="header-brasao">
        <div style="font-size:10px; font-weight:bold; text-align:left;">Prefeitura Municipal de Belo Horizonte</div>
        <div style="font-size:8px; text-align:left;">Secretaria Municipal de Fazenda - SMFA</div>
      </div>
    </div>
    
    <div class="grid-container" style="border-bottom:none;">
      <div class="grid-row" style="border-bottom:none;">
        <div style="flex:1;">
          <div class="grid-row" style="border-bottom:1px solid #000;">
            <div class="grid-cell" style="border-right:none; padding:8px;">
              <div class="label" style="font-size:10px;">Chave de Acesso da NFS-e</div>
              <div class="value" style="font-size:12px;">31062002253159326000122000000000082426079433782989</div>
            </div>
          </div>
          <div class="grid-row" style="border-bottom:1px solid #000;">
            <div class="grid-cell">
              <div class="label">Número da NFS-e</div>
              <div class="value">824</div>
            </div>
            <div class="grid-cell">
              <div class="label">Competência da NFS-e</div>
              <div class="value">${competencia}</div>
            </div>
            <div class="grid-cell" style="border-right:none;">
              <div class="label">Data e Hora da emissão da NFS-e</div>
              <div class="value">${dateEmissao}</div>
            </div>
          </div>
          <div class="grid-row">
            <div class="grid-cell">
              <div class="label">Número da DPS</div>
              <div class="value">${nota.os_numero}</div>
            </div>
            <div class="grid-cell">
              <div class="label">Série da DPS</div>
              <div class="value">70000</div>
            </div>
            <div class="grid-cell" style="border-right:none;">
              <div class="label">Data e Hora da emissão da DPS</div>
              <div class="value">${dateEmissao}</div>
            </div>
          </div>
        </div>
        <div class="grid-cell qr-code">
          <div style="width:70px; height:70px; background:#eee; margin-bottom:4px; display:flex; align-items:center; justify-content:center; font-size:8px; color:#999; border:1px solid #ccc;">QR CODE</div>
          <div style="font-size:7px; text-align:center; line-height:1.2;">A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e</div>
        </div>
      </div>
    </div>
    
    <div class="section-title">EMITENTE DA NFS-e</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell" style="flex:2;">
          <div class="label">Prestador do Serviço</div>
          <div class="value">Empresa Emitente</div>
        </div>
        <div class="grid-cell">
          <div class="label">CNPJ / CPF / NIF</div>
          <div class="value">00.000.000/0000-00</div>
        </div>
        <div class="grid-cell">
          <div class="label">Inscrição Municipal</div>
          <div class="value">15219040018</div>
        </div>
        <div class="grid-cell">
          <div class="label">Telefone</div>
          <div class="value">(31) 3309-9300</div>
        </div>
      </div>
      <div class="grid-row">
        <div class="grid-cell" style="flex:2;">
          <div class="label">Nome / Nome Empresarial</div>
          <div class="value">ER SERVICOS AUTOMOTIVOS LTDA</div>
        </div>
        <div class="grid-cell" style="flex:2;">
          <div class="label">E-mail</div>
          <div class="value">contato@empresa.com.br</div>
        </div>
      </div>
      <div class="grid-row">
        <div class="grid-cell" style="flex:3;">
          <div class="label">Endereço</div>
          <div class="value">RUA TEIXEIRA LEITE, 186, JOAO PINHEIRO</div>
        </div>
        <div class="grid-cell">
          <div class="label">Município</div>
          <div class="value">Belo Horizonte - MG</div>
        </div>
        <div class="grid-cell">
          <div class="label">CEP</div>
          <div class="value">30530-280</div>
        </div>
      </div>
      <div class="grid-row">
        <div class="grid-cell" style="flex:1;">
          <div class="label">Simples Nacional na Data de Competência</div>
          <div class="value">Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)</div>
        </div>
        <div class="grid-cell" style="flex:1;">
          <div class="label">Regime de Apuração Tributária pelo SN</div>
          <div class="value">Regime de apuração dos tributos federais e municipal pelo Simples Nacional</div>
        </div>
      </div>
    </div>
    
    <div class="section-title">TOMADOR DO SERVIÇO</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell" style="flex:2;">
          <div class="label">Nome / Nome Empresarial</div>
          <div class="value">${nota.cliente}</div>
        </div>
        <div class="grid-cell">
          <div class="label">CNPJ / CPF / NIF</div>
          <div class="value">${cpfCnpj}</div>
        </div>
        <div class="grid-cell">
          <div class="label">Inscrição Municipal</div>
          <div class="value">-</div>
        </div>
        <div class="grid-cell">
          <div class="label">Telefone</div>
          <div class="value">-</div>
        </div>
      </div>
      <div class="grid-row">
        <div class="grid-cell" style="flex:3;">
          <div class="label">Endereço</div>
          <div class="value">${nota.dados_datacar?.cliente_logradouro || ''} ${nota.dados_datacar?.cliente_numero || ''} ${nota.dados_datacar?.cliente_bairro || ''}</div>
        </div>
        <div class="grid-cell">
          <div class="label">Município</div>
          <div class="value">${nota.dados_datacar?.cliente_cidade || 'Belo Horizonte - MG'}</div>
        </div>
        <div class="grid-cell">
          <div class="label">CEP</div>
          <div class="value">${nota.dados_datacar?.cliente_cep || '-'}</div>
        </div>
      </div>
    </div>
    
    <div class="section-title" style="text-align:center; background:#fff; font-weight:normal; border-top:none;">INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e</div>
    
    <div class="section-title">SERVIÇO PRESTADO</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell" style="flex:1;">
          <div class="label">Código de Tributação Nacional</div>
          <div class="value">14.01.01 - Lubrificação, limpeza, lustração, revisão...</div>
        </div>
        <div class="grid-cell" style="flex:1;">
          <div class="label">Código de Tributação Municipal</div>
          <div class="value">001 - Lubrificação, limpeza, lustração, revisão...</div>
        </div>
        <div class="grid-cell">
          <div class="label">Local da Prestação</div>
          <div class="value">Belo Horizonte - MG</div>
        </div>
        <div class="grid-cell">
          <div class="label">País da Prestação</div>
          <div class="value">-</div>
        </div>
      </div>
      <div class="grid-row">
        <div class="grid-cell">
          <div class="label">Descrição do Serviço</div>
          <div class="value" style="text-transform:uppercase;">Serviços automotivos referentes à OS #${nota.os_numero}.</div>
        </div>
      </div>
    </div>
    
    <div class="section-title">TRIBUTAÇÃO MUNICIPAL</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell"><div class="label">Tributação do ISSQN</div><div class="value">Operação Tributável</div></div>
        <div class="grid-cell"><div class="label">País Resultado da Prestação</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Município de Incidência</div><div class="value">Belo Horizonte - MG</div></div>
        <div class="grid-cell"><div class="label">Regime Especial</div><div class="value">Nenhum</div></div>
      </div>
      <div class="grid-row">
        <div class="grid-cell"><div class="label">Tipo de Imunidade</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Suspensão da Exigibilidade</div><div class="value">Não</div></div>
        <div class="grid-cell"><div class="label">Número Processo Suspensão</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Benefício Municipal</div><div class="value">-</div></div>
      </div>
      <div class="grid-row">
        <div class="grid-cell"><div class="label">Valor do Serviço</div><div class="value">R$ ${nota.valor_total.toFixed(2).replace('.', ',')}</div></div>
        <div class="grid-cell"><div class="label">Desconto Incondicionado</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Total Deduções/Reduções</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Cálculo do BM</div><div class="value">-</div></div>
      </div>
      <div class="grid-row">
        <div class="grid-cell"><div class="label">BC ISSQN</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Alíquota Aplicada</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Retenção do ISSQN</div><div class="value">Não Retido</div></div>
        <div class="grid-cell"><div class="label">ISSQN Apurado</div><div class="value">-</div></div>
      </div>
    </div>
    
    <div class="section-title">TRIBUTAÇÃO FEDERAL</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell"><div class="label">IRRF</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">CP - Retida</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">CSLL - Retida</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">PIS - Apuração</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">COFINS - Apuração</div><div class="value">-</div></div>
      </div>
    </div>
    
    <div class="section-title">VALOR TOTAL DA NFS-E</div>
    <div class="grid-container">
      <div class="grid-row">
        <div class="grid-cell"><div class="label">Valor do Serviço</div><div class="value">R$ ${nota.valor_total.toFixed(2).replace('.', ',')}</div></div>
        <div class="grid-cell"><div class="label">Desconto Condicionado</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Desconto Incondicionado</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">ISSQN Retido</div><div class="value">-</div></div>
        <div class="grid-cell"><div class="label">Total Retenções Federais</div><div class="value">-</div></div>
        <div class="grid-cell" style="background:#f0f0f0;"><div class="label">Valor Líquido da NFS-e</div><div class="value" style="font-weight:bold; font-size:12px;">R$ ${nota.valor_total.toFixed(2).replace('.', ',')}</div></div>
      </div>
    </div>
    
    <div class="section-title" style="text-align:center;">INFORMAÇÕES COMPLEMENTARES</div>
    <div class="grid-container" style="border-bottom:none;">
      <div class="grid-row" style="border-bottom:none;">
        <div class="grid-cell" style="border-right:none;"><div class="value">NBS: 120013110</div></div>
      </div>
    </div>
    
  </div>
</body>
</html>`
}

// ─── Ações de Download ──────────────────────────────────────────────
function downloadAsFile(conteudo: string, nomeArquivo: string, mimeType: string) {
  const blob = new Blob([conteudo], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function imprimirDanfse(nota: NotaEmitida) {
  const html = gerarDanfseHtml(nota)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function NotasEmitidasPage() {
  const { empresaAtiva } = useEmpresa()

  // Estado da aba ativa
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('servicos')

  // Notas carregadas
  const [notasServicos, setNotasServicos] = useState<NotaEmitida[]>([])
  const [notasProdutos, setNotasProdutos] = useState<NotaEmitida[]>([])
  const [carregando, setCarregando] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10))

  // UI
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null)
  const [notaVisualizar, setNotaVisualizar] = useState<NotaEmitida | null>(null)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState<NotaEmitida | null>(null)
  const [cancelando, setCancelando] = useState(false)

  // ─── Buscar Notas ─────────────────────────────────────────────────
  const buscarNotas = useCallback(async (tipo: AbaAtiva) => {
    if (!empresaAtiva) return
    setCarregando(true)
    try {
      const params = new URLSearchParams({
        empresa_id: empresaAtiva.id,
        tipo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        ...(busca ? { busca } : {})
      })
      const res = await fetch(`/api/notas-emitidas?${params}`)
      
      let data
      try {
        data = await res.json()
      } catch (e) {
        toast.error(`Erro ${res.status}: Servidor retornou resposta inválida`)
        return
      }

      if (!res.ok) {
        toast.error(data.error || `Erro ${res.status} ao buscar notas`)
        return
      }

      if (data.notas) {
        if (tipo === 'servicos') setNotasServicos(data.notas)
        else setNotasProdutos(data.notas)
      } else if (data.error) {
        toast.error(data.error)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar notas emitidas')
    } finally {
      setCarregando(false)
    }
  }, [empresaAtiva, dataInicio, dataFim, busca])

  useEffect(() => {
    buscarNotas(abaAtiva)
  }, [empresaAtiva, abaAtiva]) // eslint-disable-line

  // ─── Cancelar Nota ────────────────────────────────────────────────
  const handleCancelar = async (nota: NotaEmitida) => {
    if (!empresaAtiva) return
    setCancelando(true)
    try {
      const res = await fetch('/api/notas-emitidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          nota_id: nota.id,
          acao: 'cancelar'
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.mensagem || 'Nota cancelada com sucesso!')
        setConfirmandoCancelar(null)
        buscarNotas(abaAtiva)
      } else {
        toast.error(data.error || 'Erro ao cancelar')
      }
    } catch {
      toast.error('Erro de rede ao cancelar nota')
    } finally {
      setCancelando(false)
    }
  }

  // ─── Dados da aba ativa ───────────────────────────────────────────
  const notasAtivas = abaAtiva === 'servicos' ? notasServicos : notasProdutos
  const totalValor = notasAtivas.reduce((s, n) => s + (n.valor_total || 0), 0)
  const totalEmitidas = notasAtivas.filter(n => n.status === 'enviado').length
  const totalCanceladas = notasAtivas.filter(n => n.status === 'cancelado').length

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fade-in p-2">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-blue-500" />
            Notas Emitidas
          </h1>
        </div>
        <SelectorEmpresa />
      </div>

      {/* ─── Sub-abas: Produtos / Serviços ──────────────────────────── */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => setAbaAtiva('servicos')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${
              abaAtiva === 'servicos'
                ? 'bg-blue-600/15 text-blue-400 border-b-2 border-blue-500'
                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            }`}
          >
            <FileText size={18} />
            Serviços (Gov.br / NFS-e)
            {notasServicos.length > 0 && (
              <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {notasServicos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setAbaAtiva('produtos')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${
              abaAtiva === 'produtos'
                ? 'bg-emerald-600/15 text-emerald-400 border-b-2 border-emerald-500'
                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            }`}
          >
            <ShoppingCart size={18} />
            Produtos (Conta Azul / NF-e)
            {notasProdutos.length > 0 && (
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {notasProdutos.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── Toolbar / Filtros ─────────────────────────────────────── */}
        <div className="p-4 flex flex-wrap gap-3 items-end border-b border-dark-700/50">
          {/* Busca */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
            <input
              type="text"
              placeholder="Pesquisar pessoa física ou jurídica..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-dark-500 focus:border-brand-500 outline-none transition-colors"
            />
          </div>

          {/* Data Inicial */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" size={14} />
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
            />
          </div>
          <span className="text-dark-500 text-sm">até</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" size={14} />
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
            />
          </div>

          {/* Botão Filtrar */}
          <button
            onClick={() => buscarNotas(abaAtiva)}
            disabled={carregando}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            {carregando ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
            Filtrar
          </button>

          {/* Refresh */}
          <button
            onClick={() => buscarNotas(abaAtiva)}
            disabled={carregando}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white p-2 rounded-lg transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ─── Resumo ─────────────────────────────────────────────────── */}
        <div className="px-4 py-3 flex gap-6 items-center text-xs text-dark-400 border-b border-dark-700/30 bg-dark-800/50">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <strong className="text-emerald-400">{totalEmitidas}</strong> emitida{totalEmitidas !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <strong className="text-rose-400">{totalCanceladas}</strong> cancelada{totalCanceladas !== 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-dark-300 font-mono">
            Total: <strong className="text-white">{formatCurrency(totalValor)}</strong>
          </span>
        </div>

        {/* ─── Tabela ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900/50 text-dark-400 border-b border-dark-700">
              <tr>
                <th className="px-4 py-3 font-medium w-28">Geração</th>
                <th className="px-4 py-3 font-medium">Emitida para</th>
                <th className="px-4 py-3 font-medium text-center w-28">Competência</th>
                <th className="px-4 py-3 font-medium w-44">Município Emissor</th>
                <th className="px-4 py-3 font-medium text-right w-32">Preço Serviço</th>
                <th className="px-4 py-3 font-medium text-center w-28">Situação</th>
                <th className="px-4 py-3 w-14" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {carregando && notasAtivas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-dark-400">
                    <Loader2 className="animate-spin inline-block mb-2" size={24} />
                    <p>Carregando notas emitidas...</p>
                  </td>
                </tr>
              ) : notasAtivas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-dark-400">
                    <FileWarning className="inline-block mb-2 text-dark-500" size={32} />
                    <p className="text-dark-300 font-medium">Nenhuma nota encontrada</p>
                    <p className="text-xs mt-1">
                      {abaAtiva === 'servicos'
                        ? 'Emita notas pelo painel de Vendas de Serviços para vê-las aqui.'
                        : 'Notas enviadas para o Conta Azul aparecerão aqui.'}
                    </p>
                  </td>
                </tr>
              ) : (
                notasAtivas.map(nota => {
                  const cpfCnpj = nota.dados_datacar?.cliente_cpf_cnpj || nota.metadata?.cliente_cpf_cnpj || ''
                  const competencia = nota.data_venda
                    ? `${nota.data_venda.slice(5, 7)}/${nota.data_venda.slice(0, 4)}`
                    : '—'
                  return (
                    <tr key={nota.id} className="hover:bg-dark-700/30 transition-colors group">
                      {/* Data Geração */}
                      <td className="px-4 py-3.5 text-dark-300 text-xs tabular-nums">
                        {formatDate(nota.data_venda)}
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3.5 font-medium text-white max-w-[340px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500/20 text-blue-400 text-center rounded text-[10px] font-bold leading-5 flex-shrink-0">
                            T
                          </span>
                          <span className="truncate">
                            {cpfCnpj ? `${cpfCnpj} — ` : ''}{nota.cliente}
                          </span>
                        </div>
                      </td>

                      {/* Competência */}
                      <td className="px-4 py-3.5 text-dark-300 text-center text-xs tabular-nums">
                        {competencia}
                      </td>

                      {/* Município */}
                      <td className="px-4 py-3.5 text-dark-300 text-xs">
                        Belo Horizonte/MG
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5 text-white font-semibold text-right tabular-nums">
                        {formatCurrency(nota.valor_total)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {nota.status === 'enviado' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                            <CheckCircle size={12} />
                            Emitida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400">
                            <XCircle size={12} />
                            Cancelada
                          </span>
                        )}
                      </td>

                      {/* Ações (menu) */}
                      <td className="px-4 py-3.5 relative">
                        <button
                          onClick={() => setDropdownAberto(dropdownAberto === nota.id ? null : nota.id)}
                          className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown de ações */}
                        {dropdownAberto === nota.id && (
                          <div className="absolute right-10 top-2 w-52 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 py-1.5 flex flex-col animate-in fade-in zoom-in duration-150">
                            {/* Visualizar */}
                            <button
                              onClick={() => { setNotaVisualizar(nota); setDropdownAberto(null) }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-dark-700 transition-colors text-left"
                            >
                              <Eye size={15} className="text-blue-400" /> Visualizar
                            </button>

                            {/* Substituir (futuro) */}
                            <button
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-500 cursor-not-allowed text-left"
                              disabled
                              title="Funcionalidade disponível na integração completa com a Receita"
                            >
                              <ArrowLeftRight size={15} /> Substituir
                            </button>

                            {/* Cancelar */}
                            {nota.status === 'enviado' && (
                              <button
                                onClick={() => { setConfirmandoCancelar(nota); setDropdownAberto(null) }}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                              >
                                <XCircle size={15} /> Cancelar NFS-e
                              </button>
                            )}

                            <div className="h-px bg-dark-700 my-1" />

                            {/* Download XML */}
                            <button
                              onClick={() => {
                                const xml = gerarXmlDemonstrativo(nota)
                                downloadAsFile(xml, `NFSe_OS_${nota.os_numero}.xml`, 'application/xml')
                                setDropdownAberto(null)
                                toast.success('XML baixado com sucesso!')
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-dark-700 transition-colors text-left"
                            >
                              <FileCode size={15} className="text-emerald-500" /> Download XML
                            </button>

                            {/* Download DANFS-e */}
                            <button
                              onClick={() => {
                                const html = gerarDanfseHtml(nota)
                                downloadAsFile(html, `DANFSe_OS_${nota.os_numero}.html`, 'text/html')
                                setDropdownAberto(null)
                                toast.success('DANFS-e baixado!')
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-dark-700 transition-colors text-left"
                            >
                              <Download size={15} className="text-blue-400" /> Download DANFS-e
                            </button>

                            {/* Imprimir */}
                            <button
                              onClick={() => {
                                imprimirDanfse(nota)
                                setDropdownAberto(null)
                              }}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-300 hover:text-white hover:bg-dark-700 transition-colors text-left"
                            >
                              <Printer size={15} className="text-amber-400" /> Imprimir DANFS-e
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da tabela */}
        {notasAtivas.length > 0 && (
          <div className="px-4 py-3 border-t border-dark-700 flex items-center justify-between text-xs text-dark-400">
            <span>{notasAtivas.length} nota{notasAtivas.length !== 1 ? 's' : ''} encontrada{notasAtivas.length !== 1 ? 's' : ''}</span>
            <span className="text-dark-500">Últimos 30 dias • {abaAtiva === 'servicos' ? 'Gov.br NFS-e' : 'Conta Azul NF-e'}</span>
          </div>
        )}
      </div>

      {/* ─── Overlay para fechar dropdown ──────────────────────────── */}
      {dropdownAberto && (
        <div className="fixed inset-0 z-40" onClick={() => setDropdownAberto(null)} />
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: VISUALIZAR NOTA                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
{notaVisualizar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#f4f6f8] rounded-md w-full max-w-[1000px] max-h-[90vh] shadow-2xl flex flex-col font-sans">
            
            {/* Header / Barra de Ações (Simula o topo azul do portal) */}
            <div className="bg-[#5a6b7d] px-4 py-2 flex items-center gap-2 rounded-t-md shrink-0">
              <button className="bg-[#2c3e50] hover:bg-[#1a252f] text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 transition-colors">
                <Plus size={16} /> Nova NFS-e
              </button>
              <button disabled className="bg-[#6c7d8e] text-white/50 px-2.5 py-1.5 rounded text-sm cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button disabled className="bg-[#6c7d8e] text-white/50 px-2.5 py-1.5 rounded text-sm cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
              
              <div className="h-6 w-px bg-white/20 mx-1"></div>

              <button
                onClick={() => {
                  const html = gerarDanfseHtml(notaVisualizar)
                  downloadAsFile(html, `DANFSe_OS_${notaVisualizar.os_numero}.html`, 'text/html')
                }}
                className="bg-[#6c7d8e] hover:bg-[#5a6b7d] text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors border border-[#7d8e9e]"
                title="Download PDF"
              >
                <Download size={15} /> PDF
              </button>
              
              <button
                onClick={() => imprimirDanfse(notaVisualizar)}
                className="bg-[#6c7d8e] hover:bg-[#5a6b7d] text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors border border-[#7d8e9e]"
                title="Imprimir"
              >
                <Printer size={15} />
              </button>

              <button
                onClick={() => {
                  const xml = gerarXmlDemonstrativo(notaVisualizar)
                  downloadAsFile(xml, `NFSe_OS_${notaVisualizar.os_numero}.xml`, 'application/xml')
                }}
                className="bg-[#6c7d8e] hover:bg-[#5a6b7d] text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors border border-[#7d8e9e]"
                title="Download XML"
              >
                <FileCode size={15} /> XML
              </button>

              <button
                onClick={() => setNotaVisualizar(null)}
                className="ml-auto text-white/70 hover:text-white p-1"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo de Visualização (Fundo branco padrão Gov) */}
            <div className="bg-white m-4 mb-0 overflow-y-auto p-6 border border-gray-200">
              
              {/* Identificação da NFS-e */}
              <h3 className="text-[#598c73] font-medium text-[15px] mb-2">Identificação da NFS-e</h3>
              <div className="grid grid-cols-12 gap-4 mb-6">
                <div className="col-span-8">
                  <label className="block text-[11px] text-gray-500 mb-1">Chave de acesso</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 font-mono bg-white">
                    31062002253159326000122000000000082426079433782989
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Data de geração</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    {formatDateTime(notaVisualizar.updated_at)}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Versão</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    1.01
                  </div>
                </div>
              </div>

              {/* Identificação do DPS */}
              <h3 className="text-[#598c73] font-medium text-[15px] mb-2">Identificação do DPS</h3>
              <div className="grid grid-cols-12 gap-4 mb-6">
                <div className="col-span-4">
                  <label className="block text-[11px] text-gray-500 mb-1">Número</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    {notaVisualizar.os_numero}
                  </div>
                </div>
                <div className="col-span-4">
                  <label className="block text-[11px] text-gray-500 mb-1">Série</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    70000
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Data de emissão</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    {formatDateTime(notaVisualizar.updated_at)}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">Versão</label>
                  <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                    1.01
                  </div>
                </div>
              </div>

              {/* Tabs Container */}
              <div className="flex text-sm text-gray-600 mt-2">
                <div className="px-5 py-2 bg-[#598c73] text-white font-medium cursor-default">NFS-e</div>
                <div className="px-5 py-2 hover:bg-gray-100 cursor-not-allowed">Pessoas</div>
                <div className="px-5 py-2 hover:bg-gray-100 cursor-not-allowed">Serviço</div>
                <div className="px-5 py-2 hover:bg-gray-100 cursor-not-allowed">Outros Tributos</div>
              </div>

              {/* Box Principal com Borda Verde */}
              <div className="border border-[#598c73] p-6">
                
                {/* EMITENTE */}
                <h4 className="text-[#598c73] font-medium text-[14px] mb-3">Emitente</h4>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Razão Social</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">Empresa Emitente</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">CNPJ</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">00.000.000/0000-00</div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Inscrição Municipal</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">15219040018</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Situação Perante o Simples Nacional</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">Microempresa ou Empresa de Pequeno Porte (ME/EPP)</div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Regime Especial de Tributação</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">Nenhum</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Endereço do Estabelecimento/Domicílio</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                      RUA TEIXEIRA LEITE , 186 , Bairro JOAO PINHEIRO , CEP 30530280 , Belo Horizonte/MG
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Telefone</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">(31)3309-9300</div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Email</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">contato@empresa.com.br</div>
                    </div>
                  </div>
                </div>

                {/* TOMADOR */}
                <h4 className="text-[#598c73] font-medium text-[14px] mb-3 mt-4 border-t border-gray-200 pt-4">Tomador do Serviço</h4>
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">CNPJ / CPF</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                        {notaVisualizar.dados_datacar?.cliente_cpf_cnpj || notaVisualizar.metadata?.cliente_cpf_cnpj || '—'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Razão Social / Nome</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                        {notaVisualizar.cliente}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Endereço do Domicílio</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                      {[
                        notaVisualizar.dados_datacar?.cliente_logradouro,
                        notaVisualizar.dados_datacar?.cliente_numero,
                        notaVisualizar.dados_datacar?.cliente_bairro,
                        notaVisualizar.dados_datacar?.cliente_cidade
                      ].filter(Boolean).join(', ') || 'Não informado'}
                    </div>
                  </div>
                </div>

                {/* SERVIÇO */}
                <h4 className="text-[#598c73] font-medium text-[14px] mb-3 mt-4 border-t border-gray-200 pt-4">Serviço Prestado</h4>
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Código de Tributação (CTN / NBS)</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                        14.01.01 — Lubrificação, limpeza, lustração, revisão...
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Descrição</label>
                      <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">
                        Serviços automotivos referentes à OS #{notaVisualizar.os_numero}
                      </div>
                    </div>
                  </div>
                </div>

                {/* TRIBUTAÇÃO MUNICIPAL */}
                <h4 className="text-[#598c73] font-medium text-[14px] mb-3 mt-4 border-t border-gray-200 pt-4">Tributação Municipal</h4>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Tributação do ISSQN</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">1 - Operação Tributável</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">País Resultado da Prestação de Serviço</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">-</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Município de Incidência</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">Belo Horizonte/MG</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Tipo de Imunidade</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">-</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Suspensão do ISSQN</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">-</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Número processo suspensão</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">-</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Valor do Serviço</label>
                    <div className="flex border border-gray-300 bg-gray-100">
                      <span className="px-2 py-1.5 text-[13px] text-gray-500 border-r border-gray-300">R$</span>
                      <div className="w-full px-3 py-1.5 text-[13px] text-gray-700 bg-white">{notaVisualizar.valor_total.toFixed(2).replace('.', ',')}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Desconto incondicionado</label>
                    <div className="flex border border-gray-300 bg-gray-100">
                      <span className="px-2 py-1.5 text-[13px] text-gray-500 border-r border-gray-300">R$</span>
                      <div className="w-full px-3 py-1.5 text-[13px] text-gray-700 bg-white">0,00</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Base de Cálculo</label>
                    <div className="flex border border-gray-300 bg-gray-100">
                      <span className="px-2 py-1.5 text-[13px] text-gray-500 border-r border-gray-300">R$</span>
                      <div className="w-full px-3 py-1.5 text-[13px] text-gray-700 bg-white">0,00</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Alíquota Aplicada</label>
                    <div className="flex border border-gray-300 bg-white">
                      <div className="w-full px-3 py-1.5 text-[13px] text-gray-700 bg-white">0,00</div>
                      <span className="px-2 py-1.5 text-[13px] text-gray-500 border-l border-gray-300 bg-gray-100">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Valor do ISSQN</label>
                    <div className="flex border border-gray-300 bg-gray-100">
                      <span className="px-2 py-1.5 text-[13px] text-gray-500 border-r border-gray-300">R$</span>
                      <div className="w-full px-3 py-1.5 text-[13px] text-gray-700 bg-white">0,00</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Retenção</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">1 - Não Retido</div>
                  </div>
                </div>

                {/* OUTRAS INFORMAÇÕES */}
                <h4 className="text-[#598c73] font-medium text-[14px] mb-3 mt-4 border-t border-gray-200 pt-4">Outras Informações</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Versão da Aplicação</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">EmissorWeb_1.6.0.0</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Ambiente Gerador</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white">2 - Sefin Nacional NFS-e</div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Situação da NFS-e</label>
                    <div className="w-full border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 bg-white font-bold">
                      {notaVisualizar.status === 'cancelado' ? '300 - Cancelada' : '100 - NFS-e Gerada'}
                    </div>
                  </div>
                </div>

              </div>
              
              <div className="h-6"></div> {/* Espaço inferior */}
            </div>
            
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAR CANCELAMENTO                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {confirmandoCancelar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} className="text-rose-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Cancelar NFS-e?</h2>
              <p className="text-dark-400 text-sm">
                Tem certeza que deseja cancelar a nota da{' '}
                <strong className="text-white">OS #{confirmandoCancelar.os_numero}</strong> do cliente{' '}
                <strong className="text-white">{confirmandoCancelar.cliente}</strong>?
              </p>
              <p className="text-rose-400/80 text-xs bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
                ⚠️ Esta ação não pode ser desfeita. A nota ficará marcada como cancelada no sistema.
              </p>
            </div>
            <div className="border-t border-dark-700 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmandoCancelar(null)}
                disabled={cancelando}
                className="px-4 py-2 bg-dark-700 text-dark-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => handleCancelar(confirmandoCancelar)}
                disabled={cancelando}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                {cancelando ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
