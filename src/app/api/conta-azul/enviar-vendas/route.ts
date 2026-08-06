import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarOuCriarProduto, criarVenda, VendaPayload, buscarOuCriarCliente } from '@/lib/conta-azul/api'
import { getValidToken, TokenError } from '@/lib/conta-azul/token-manager'
import type { VendaPreview } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// URL base da API v2 do Conta Azul (sem duplicação de /v1)
const CA_BASE = 'https://api-v2.contaazul.com/v1'


export async function POST(req: NextRequest) {
  try {
    const { empresa_id, vendas } = await req.json()

    if (!empresa_id || !vendas || !Array.isArray(vendas)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Obter token válido (com renovação automática)
    let accessToken: string
    try {
      const result = await getValidToken(empresa_id)
      accessToken = result.accessToken
    } catch (e) {
      if (e instanceof TokenError) {
        return NextResponse.json({ error: e.message }, { status: e.statusCode })
      }
      throw e
    }

    let sucessos = 0
    let erros = 0
    let detalhesErros: string[] = []

    const mapPagamento = (forma: string) => {
      const f = forma?.toLowerCase() || ''
      // PIX e conta bancária ANTES de cartão de crédito (ex: "Crédito em conta bancária/PIX" deve ser PIX)
      if (f.includes('pix')) return 'PIX'
      if (f.includes('conta bancária') || f.includes('conta bancaria')) return 'PIX'
      if (f.includes('transf') || f.includes('depósito') || f.includes('deposito')) return 'TRANSFERENCIA_BANCARIA'
      if (f.includes('boleto')) return 'BOLETO_BANCARIO'
      if (f.includes('deb') || f.includes('déb')) return 'CARTAO_DEBITO'
      if (f.includes('cred') || f.includes('créd')) return 'CARTAO_CREDITO'
      
      // Se tiver a palavra "parcela" ou "vez", por padrão vamos assumir Cartão de Crédito
      if (f.includes('parcela') || f.match(/(\d+)\s*x/)) return 'CARTAO_CREDITO'
      
      return 'DINHEIRO'
    }

    // Determina a opcao_condicao_pagamento conforme exigido pela API do Conta Azul:
    // 'À vista', '2x', '3x', ... ou padrão de dias '30', '30,60', etc.
    const mapOpcaoCondicao = (forma: string): { opcao: string; numParcelas: number } => {
      const f = forma?.toLowerCase() || ''
      // Detecta parcelamentos do tipo "2x", "3x", "12x", "4 parcelas", "4 vezes"
      const matchParcelas = f.match(/(\d+)\s*(?:x|parcela|vez)/)
      if (matchParcelas) {
        const n = parseInt(matchParcelas[1], 10)
        if (n > 1) return { opcao: `${n}x`, numParcelas: n }
      }
      // Pagamento padrão → à vista
      return { opcao: 'À vista', numParcelas: 1 }
    }

    for (const venda of vendas as VendaPreview[]) {
      try {
        // 1. Busca/Cria Cliente com função dedicada e URLs corretas
        const idCliente = await buscarOuCriarCliente(accessToken, venda.cliente, venda.cliente_cpf_cnpj, venda.cliente_endereco)
        if (!idCliente) throw new Error(`Não foi possível criar/encontrar o cliente: ${venda.cliente}`)

        // 2. Busca/Cria Produtos
        const itensPayload = []
        let totalBrutoItens = 0
        let totalLiquidoItens = 0

        for (const item of venda.itens) {
          const valorUnitarioOriginal = parseFloat(Number(item.valor_unitario_original ?? item.valor_unitario).toFixed(4))
          
          const idProduto = await buscarOuCriarProduto(
            accessToken, 
            item.codigo, 
            item.descricao, 
            valorUnitarioOriginal,
            {
              ncm: item.ncm,
              origem: item.origem,
              cest: item.cest,
              unidade_medida: item.unidade_medida || 'UN',
              tipo_produto: item.tipo_produto
            }
          )
          if (!idProduto) {
            throw new Error(`Produto "${item.descricao}" (código: ${item.codigo || 'sem código'}) não encontrado e não pôde ser criado no Conta Azul. Verifique o cadastro do produto.`)
          }
          
          itensPayload.push({
            descricao: '', // Deixar em branco - o produto já é identificado pelo id
            quantidade: item.quantidade,
            valor: valorUnitarioOriginal,
            id: idProduto
          })
          
          const totalItemBruto = item.quantidade * valorUnitarioOriginal
          totalBrutoItens += totalItemBruto
          
          const totalItem = item.quantidade * item.valor_unitario
          totalLiquidoItens += totalItem
        }
        
        totalBrutoItens = parseFloat(totalBrutoItens.toFixed(2))
        totalLiquidoItens = parseFloat(totalLiquidoItens.toFixed(2))
        
        // Em vez de somar os descontos unitários e multiplicar pela quantidade (o que pode dar divergência de centavos),
        // O desconto global enviado ao Conta Azul é exatamente a diferença entre o Bruto e o Líquido.
        // Assim, a matemática do CA (Bruto - Desconto = Líquido) sempre baterá perfeitamente com a soma das parcelas (Líquido).
        const descontoCalculado = parseFloat((totalBrutoItens - totalLiquidoItens).toFixed(2))
        let totalDescontoVenda = Math.max(0, descontoCalculado)

        // Conta Azul exige formato YYYY-MM-DD (apenas data, sem horário)
        let dataVendaOriginal = venda.data_venda
        if (dataVendaOriginal && dataVendaOriginal.includes('/')) {
           // Converte DD/MM/YYYY para YYYY-MM-DD
           const parts = dataVendaOriginal.split('/');
           if (parts.length === 3) {
             dataVendaOriginal = `${parts[2]}-${parts[1]}-${parts[0]}`;
           }
        }

        const dataVendaFormatada = dataVendaOriginal
          ? new Date(dataVendaOriginal).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

        // 3. Monta Payload
        const { opcao, numParcelas } = mapOpcaoCondicao(venda.forma_pagamento || '')

        // totalLiquidoItens = sum(1 × totalItem) = exatamente o que o Conta Azul vai calcular
        const valorLiquido = totalLiquidoItens

        // Gera parcelas dividindo o valor líquido pelo número de parcelas
        const valorParcela = parseFloat((valorLiquido / numParcelas).toFixed(2))
        const parcelasPayload = Array.from({ length: numParcelas }, (_, i) => {
          // Cada parcela vence 30 dias após a anterior (para parcelado) ou na data da venda (à vista)
          const dataVenc = new Date(dataVendaFormatada)
          dataVenc.setMonth(dataVenc.getMonth() + i)
          return {
            data_vencimento: dataVenc.toISOString().split('T')[0],
            valor: i === numParcelas - 1
              ? parseFloat((valorLiquido - valorParcela * (numParcelas - 1)).toFixed(2)) // última parcela absorve centavos
              : valorParcela
          }
        })

        const payload: VendaPayload = {
          id_cliente: idCliente,
          // 01 - Número da venda: NÃO enviamos o número da OS.
          // A função criarVenda() busca automaticamente o próximo número disponível no Conta Azul.
          numero: undefined,
          situacao: 'APROVADO',
          data_venda: dataVendaFormatada,
          // 03 - Vendedor responsável: deixado em branco (sem id_vendedor)
          itens: itensPayload,
          // Desconto conforme API v1: composicao_de_valor.desconto { tipo, valor }
          // O CA calcula: valor_total = (qty × preço_unit) + frete - desconto
          // Parcelas devem somar ao valor_total (líquido)
          composicao_de_valor: totalDescontoVenda > 0 ? {
            desconto: {
              tipo: 'VALOR' as const,
              valor: totalDescontoVenda
            }
          } : undefined,
          condicao_pagamento: {
            tipo_pagamento: mapPagamento(venda.forma_pagamento || ''),
            opcao_condicao_pagamento: opcao,
            parcelas: parcelasPayload
          }
        }

        // 4. Cria Venda no Conta Azul (com retry para eventual consistência de cliente/produto)
        let vendaCriada;
        let tentativas = 0;
        let sucesso = false;
        let ultimaMensagemErro = '';

        while (tentativas < 3 && !sucesso) {
          try {
            vendaCriada = await criarVenda(accessToken, payload)
            sucesso = true;
          } catch (e: any) {
            ultimaMensagemErro = e.message || 'Erro desconhecido';
            const msgLower = ultimaMensagemErro.toLowerCase()
            // Verifica se o erro é de consistência eventual (cliente ou produto recém-criado ainda não disponível)
            const erroConsistencia = 
              msgLower.includes('cliente') && (msgLower.includes('não encontrad') || msgLower.includes('not found')) ||
              msgLower.includes('produto') && (msgLower.includes('não encontrad') || msgLower.includes('not found')) ||
              msgLower.includes('item') && (msgLower.includes('não encontrad') || msgLower.includes('not found')) ||
              msgLower.includes('not_found') ||
              msgLower.includes('422') // Unprocessable - comum em consistência eventual

            if (erroConsistencia) {
              tentativas++;
              console.log(`[Tentativa ${tentativas}/3] Erro de consistência eventual: ${ultimaMensagemErro.substring(0, 200)}. Aguardando 3s...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              break; // Outro tipo de erro, interrompe o retry
            }
          }
        }

        if (!sucesso) {
          throw new Error(`Erro ao criar venda (Cliente ID: ${idCliente}): ${ultimaMensagemErro}`)
        }

        // 5. Salva no banco
        await supabaseAdmin.from('vendas_importadas').insert({
          empresa_id,
          cliente: venda.cliente,
          valor_total: venda.valor_total,
          data_venda: venda.data_venda,
          os_numero: venda.os_numero,
          forma_pagamento: venda.forma_pagamento,
          status: 'enviado',
          conta_azul_id: vendaCriada!.id
        })

        sucessos++
      } catch (e: any) {
        erros++
        const msgErro = e.message || 'Erro desconhecido'
        detalhesErros.push(`OS ${venda.os_numero || 'S/N'}: ${msgErro}`)
        console.error(`Erro ao criar venda ${venda.os_numero}:`, msgErro)

        await supabaseAdmin.from('vendas_importadas').insert({
          empresa_id,
          cliente: venda.cliente,
          valor_total: venda.valor_total,
          data_venda: venda.data_venda,
          os_numero: venda.os_numero,
          forma_pagamento: venda.forma_pagamento,
          status: 'erro',
          erro_mensagem: msgErro
        })
      }
    }

    return NextResponse.json({ sucessos, erros, detalhesErros })

  } catch (error: any) {
    console.error('Erro geral no endpoint enviar-vendas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
