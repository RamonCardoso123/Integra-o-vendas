import { NextRequest, NextResponse } from 'next/server'
import { getValidToken } from '@/lib/conta-azul/token-manager'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresa_id = searchParams.get('empresa_id')
    const cpf_cnpj = searchParams.get('cpf_cnpj')

    if (!empresa_id || !cpf_cnpj) {
      return NextResponse.json({ error: 'empresa_id e cpf_cnpj são obrigatórios' }, { status: 400 })
    }

    const docLimpo = cpf_cnpj.replace(/\D/g, '')

    // Buscar Vendas no Conta Azul (nova API v2)
    const { accessToken } = await getValidToken(empresa_id)
    const url = `https://api-v2.contaazul.com/v1/venda/busca?termo_busca=${docLimpo}&tamanho_pagina=15`
    
    console.log(`[buscar-vendas-cliente] Buscando CA: ${url}`)
    const resCa = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    let vendasFormatadas: any[] = []

    if (resCa.ok) {
      const dataCa = await resCa.json()
      const itens = dataCa.itens || dataCa.items || []
      
      // Filtrar apenas as que batem exatamente com o documento (caso termo_busca traga lixo)
      const vendasCliente = itens.filter((v: any) => {
        const pDoc = (v.documento_cliente || v.cliente?.documento || '').replace(/\D/g, '')
        return pDoc === docLimpo || pDoc.includes(docLimpo) || docLimpo.includes(pDoc)
      })

      vendasFormatadas = vendasCliente.map((v: any) => ({
        cliente: v.nome_cliente || v.cliente?.nome || 'Cliente Conta Azul',
        os_numero: v.numero?.toString() || 'S/N',
        data_venda: v.data_venda,
        valor_total: v.valor_composicao?.valor_liquido || v.valor_total || 0,
        status: (v.situacao?.nome || v.situacao || 'CONTA_AZUL').toUpperCase()
      }))
    } else {
      console.warn(`[buscar-vendas-cliente] Erro CA: ${resCa.status}`)
    }

    return NextResponse.json({
      vendas: vendasFormatadas
    })

  } catch (err: any) {
    console.error('Erro em buscar-vendas-cliente:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
