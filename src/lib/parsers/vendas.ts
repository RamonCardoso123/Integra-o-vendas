import * as XLSX from 'xlsx'
import { parseDate, parseCurrency } from '@/lib/utils'
import type { VendaPreview, ResultadoImportacaoVendas } from '@/types'

const _COL_PAG_L1 = {
  15: "Cartão de Crédito",
  22: "Dinheiro",
  28: "Fatura / Boleto",
  32: "Cheque à Vista",
  33: "Cheque Pré-datado",
  52: "Sucata",
}
const _COL_PAG_L2 = {
  13: "Cartão de Débito",
  37: "Outros",
  42: "Pix",
  49: "Abatimento de Crédito",
}

function _val(row: any[], col: number): any {
  if (!row || row.length <= col) return null
  let v = row[col]
  if (typeof v === 'string') {
    v = v.trim()
  }
  return v !== "" ? v : null
}

function normalizarData(raw: unknown): string {
  if (!raw) return ''
  if (raw instanceof Date) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(raw).trim()
  const dtMatch = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dtMatch) return dtMatch[1]
  
  const parts = str.split(' ')[0].split('/')
  if (parts.length === 3) {
    let y = parts[2]
    if (y.length === 2) y = '20' + y
    if (y.length === 4) return `${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  
  return parseDate(str)
}

function parseBonoPneusFormat(rows: any[][]): ResultadoImportacaoVendas {
  const vendas: VendaPreview[] = []
  
  let currentVenda: VendaPreview | null = null
  let parsingItems = false
  
  let idxTipo = 0
  let idxCodigo = 1
  let idxDescricao = 2
  let idxQtd = 4
  let idxVlUnitOrig = 5
  let idxDesc = 6
  let idxVlTotal = 7

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    if (!Array.isArray(row)) continue
    
    const colA = String(_val(row, 0) || '').trim()
    const colB = String(_val(row, 1) || '').trim()
    const colA_upper = colA.toUpperCase()

    if (colA_upper.includes('ORDEM DE SERVICO') || colA_upper.includes('ORDEM DE SERVIÇO')) {
      if (currentVenda) {
        vendas.push(currentVenda)
      }
      
      let osNumero = ''
      for(let c=0; c<row.length; c++) {
        const val = String(_val(row, c) || '').trim().toUpperCase()
        if (val.startsWith('Nº') || val.startsWith('N')) {
           osNumero = val.replace(/[^0-9]/g, '')
           if (osNumero) break;
        }
      }

      currentVenda = {
        os_numero: osNumero || 'S/N',
        cliente: 'CLIENTE NÃO IDENTIFICADO',
        data_venda: '',
        itens: [],
        valor_total: 0,
        valido: true,
        erros: []
      }
      parsingItems = false
      continue
    }

    if (!currentVenda) continue

    if (colA_upper.startsWith('DATA/HORA')) {
       let rawDate = colB
       if (!rawDate) rawDate = String(_val(row, 2) || '').trim()
       if (!rawDate) rawDate = String(_val(row, 3) || '').trim()
       currentVenda.data_venda = normalizarData(rawDate)
    }
    else if (colA_upper === 'CLIENTE:') {
       currentVenda.cliente = colB || String(_val(row, 2) || '').trim()
    }
    else if (colA_upper.startsWith('FORMA DE') || colA_upper.startsWith('FORMA PAGAMENTO') || colA_upper.startsWith('FORMA RECEBIMENTO')) {
       let forma = colB || String(_val(row, 2) || '').trim()
       if (!forma && idx + 1 < rows.length) {
          forma = String(_val(rows[idx+1], 0) || '').trim()
       }
       if (forma) currentVenda.forma_pagamento = forma
    }
    else if (colA_upper === 'TIPO' || (colA_upper.includes('CODIGO') && !parsingItems) || (colA_upper.includes('CÓDIGO') && !parsingItems)) {
       parsingItems = true
       for (let c=0; c<row.length; c++) {
          const head = String(_val(row, c) || '').trim().toUpperCase()
          if (head === 'TIPO') idxTipo = c
          else if (head === 'CODIGO' || head === 'CÓDIGO') idxCodigo = c
          else if (head === 'DESCRICAO' || head === 'DESCRIÇÃO') idxDescricao = c
          else if (head === 'QTD' || head === 'QUANTIDADE') idxQtd = c
          else if (head.includes('VL UNIT') || head.includes('VALOR UNIT') || head.includes('VI UNIT')) idxVlUnitOrig = c
          else if (head.includes('DESC') && !head.includes('DESCRI')) idxDesc = c
          else if (head.includes('VL TOTAL') || head.includes('VALOR TOTAL') || head.includes('VI TOTAL')) idxVlTotal = c
       }
       continue
    }
    else if (colA_upper === 'TOTAIS' || colA_upper === 'TOTAL' || colA_upper.includes('GARANTIA')) {
       parsingItems = false
    }
    else if (parsingItems) {
       const tipoStr = String(_val(row, idxTipo) || '').trim()
       const codigo = String(_val(row, idxCodigo) || '').trim()
       const descricao = String(_val(row, idxDescricao) || '').trim()
       const qtd = _val(row, idxQtd)
       const vlUnitOrigRaw = _val(row, idxVlUnitOrig)
       const descRaw = _val(row, idxDesc)
       const vlTotalItem = _val(row, idxVlTotal)
       
       if (codigo && descricao && codigo.toUpperCase() !== 'TOTAIS') {
         const q = typeof qtd === 'number' ? qtd : parseFloat(String(qtd).replace(',', '.')) || 1
         const totalItem = typeof vlTotalItem === 'number' ? vlTotalItem : parseCurrency(String(vlTotalItem || '0'))
         const unitOrig = typeof vlUnitOrigRaw === 'number' ? vlUnitOrigRaw : parseCurrency(String(vlUnitOrigRaw || '0'))
         const desconto = typeof descRaw === 'number' ? descRaw : parseCurrency(String(descRaw || '0'))
         
         const u = totalItem / (q || 1) // Calcula o valor unitário já com o desconto aplicado (para envio)
         
         if (u >= 0) {
           currentVenda.itens.push({
             codigo,
             descricao,
             quantidade: q,
             valor_unitario: u,
             tipo: tipoStr || 'Produto/Serviço',
             valor_unitario_original: unitOrig,
             desconto: desconto,
             valor_total: totalItem
           })
           currentVenda.valor_total += totalItem
         }
       }
    }
  }

  if (currentVenda) {
    vendas.push(currentVenda)
  }

  vendas.forEach(venda => {
    venda.valido = true
    venda.erros = []
    if (!venda.cliente || venda.cliente === 'CLIENTE NÃO IDENTIFICADO') {
      venda.valido = false
      venda.erros.push('Cliente não identificado')
    }
    if (!venda.data_venda) {
      venda.valido = false
      venda.erros.push('Data da venda inválida')
    }
    if (venda.itens.length === 0) {
      venda.valido = false
      venda.erros.push('Nenhum produto/serviço encontrado')
    }
  })

  return {
    total: vendas.length,
    validos: vendas.filter(v => v.valido).length,
    invalidos: vendas.filter(v => !v.valido).length,
    dados: vendas
  }
}

export async function parseVendasExcel(file: File): Promise<ResultadoImportacaoVendas> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, dateNF: 'yyyy-mm-dd' })

  // Identifica se é o formato "OS Impressa" ou o formato de relatório antigo
  const isBonoPneusFormat = rows.some(row => {
    const v = String(row[0] || '').trim().toUpperCase()
    return v.includes('ORDEM DE SERVICO') || v.includes('ORDEM DE SERVIÇO')
  })

  if (isBonoPneusFormat) {
    return parseBonoPneusFormat(rows)
  }

  const vendas: VendaPreview[] = []
  const os_start_rows: number[] = []
  
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    if (!Array.isArray(row)) continue
    
    const v = row[0]
    if ((typeof v === 'number' && v > 0) || (typeof v === 'string' && /^[A-Z0-9]{4,12}$/i.test(v.trim()))) {
      os_start_rows.push(idx)
    }
  }

  for (let i = 0; i < os_start_rows.length; i++) {
    const start = os_start_rows[i]
    const row_os = rows[start]

    const osNumero = String(_val(row_os, 0) || '').trim()
    const cliente = String(_val(row_os, 29) || '').trim() || 'CLIENTE NÃO IDENTIFICADO'
    const dataVenda = normalizarData(_val(row_os, 16))

    const currentVenda: VendaPreview = {
      os_numero: osNumero,
      cliente: cliente,
      data_venda: dataVenda,
      itens: [],
      valor_total: 0,
      valido: true,
      erros: []
    }

    let formaPagamento = ''
    for (let offset = 1; offset <= 6; offset++) {
      const pagRow = rows[start + offset]
      if (!pagRow) continue
      
      for (const [colStr, nome] of Object.entries(_COL_PAG_L1)) {
        const v = _val(pagRow, parseInt(colStr))
        if (typeof v === 'number' && v > 0) {
          formaPagamento = nome
          break
        }
      }
      if (formaPagamento) break
      
      for (const [colStr, nome] of Object.entries(_COL_PAG_L2)) {
        const v = _val(pagRow, parseInt(colStr))
        if (typeof v === 'number' && v > 0) {
          formaPagamento = nome
          break
        }
      }
      if (formaPagamento) break
    }

    currentVenda.forma_pagamento = formaPagamento

    const fim_os = (i + 1 < os_start_rows.length) ? os_start_rows[i + 1] : rows.length
    for (let j = start + 1; j < fim_os; j++) {
      const row_item = rows[j]
      if (!row_item) continue
      
      const tipo = String(_val(row_item, 5) || '').trim().toUpperCase()
      if (tipo === 'P') {
        const codigo = String(_val(row_item, 7) || '').trim()
        const descricao = String(_val(row_item, 18) || '').trim()
        const qtdeVal = _val(row_item, 34)
        const unitVal = _val(row_item, 38)
        
        const qtde = typeof qtdeVal === 'number' ? qtdeVal : parseFloat(String(qtdeVal).replace(',', '.')) || 1
        const unit = typeof unitVal === 'number' ? unitVal : parseCurrency(String(unitVal || '0'))
        
        if (codigo) {
          currentVenda.itens.push({
            codigo,
            descricao: descricao || codigo,
            quantidade: qtde,
            valor_unitario: unit
          })
          currentVenda.valor_total += (qtde * unit)
        }
      }
    }

    if (currentVenda.itens.length > 0) {
      vendas.push(currentVenda)
    }
  }

  vendas.forEach(venda => {
    venda.valido = true
    venda.erros = []
    if (!venda.cliente || venda.cliente === 'CLIENTE NÃO IDENTIFICADO') {
      venda.valido = false
      venda.erros.push('Cliente não identificado')
    }
    if (!venda.data_venda) {
      venda.valido = false
      venda.erros.push('Data da venda inválida')
    }
    if (venda.itens.length === 0) {
      venda.valido = false
      venda.erros.push('Nenhum produto encontrado na venda')
    }
  })

  return {
    total: vendas.length,
    validos: vendas.filter(v => v.valido).length,
    invalidos: vendas.filter(v => !v.valido).length,
    dados: vendas
  }
}
