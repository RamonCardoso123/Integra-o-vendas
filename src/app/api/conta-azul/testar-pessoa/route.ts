import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken, TokenError } from '@/lib/conta-azul/token-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CA_BASE = 'https://api-v2.contaazul.com/v1'

export async function GET(req: NextRequest) {
  try {
    const { data: empresas } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .not('access_token_conta_azul', 'is', null)
      .limit(1)

    const empresa = empresas?.[0]
    if (!empresa) {
      return NextResponse.json({ error: 'Nenhuma empresa conectada ao CA' }, { status: 400 })
    }

    // Obter token válido (com renovação automática)
    let accessToken: string
    let empresaCompleta: Record<string, any>
    try {
      const result = await getValidToken(empresa.id)
      accessToken = result.accessToken
      empresaCompleta = result.empresa
    } catch (e) {
      if (e instanceof TokenError) {
        return NextResponse.json({ error: e.message }, { status: e.statusCode })
      }
      throw e
    }

    const resultados: Record<string, unknown>[] = []
    const ts = Date.now()

    // perfis é []models.PersonProfilesCreate — array de objetos
    // Testar diferentes formatos do objeto interno
    const payloads = [
      {
        label: 'TESTE_ENDERECO_SINGULAR',
        body: { 
          nome: `TESTE_END_${ts}_SING`, 
          tipo_pessoa: 'Física', 
          perfis: [{ tipo_perfil: 'Cliente' }], 
          ativo: true,
          endereco: {
            logradouro: 'Rua Teste',
            numero: '123',
            bairro: 'Centro',
            cep: '01001-000',
            cidade: 'São Paulo',
            estado: 'SP'
          }
        }
      },
      {
        label: 'TESTE_ENDERECO_PLURAL',
        body: { 
          nome: `TESTE_END_${ts}_PLU`, 
          tipo_pessoa: 'Física', 
          perfis: [{ tipo_perfil: 'Cliente' }], 
          ativo: true,
          enderecos: [{
            logradouro: 'Rua Teste',
            numero: '123',
            bairro: 'Centro',
            cep: '01001-000',
            cidade: 'São Paulo',
            estado: 'SP'
          }]
        }
      }
    ]

    const idsParaDeletar: string[] = []

    for (const { label, body } of payloads) {
      try {
        const res = await fetch(`${CA_BASE}/pessoas`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const resText = await res.text()
        let resJson: any = null
        try { resJson = JSON.parse(resText) } catch {}
        if (res.ok && (resJson?.id || resJson?.uuid)) {
          const cliId = resJson.id || resJson.uuid
          idsParaDeletar.push(cliId)
          
          // Testar venda com id_cliente
          const venda1 = await fetch(`${CA_BASE}/venda`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numero: 9999999,
              id_cliente: cliId,
              situacao: 'APROVADO',
              data_venda: new Date().toISOString().split('T')[0],
              itens: [{ descricao: 'Item', quantidade: 1, valor: 10 }],
              condicao_pagamento: { tipo_pagamento: 'A_VISTA', opcao_condicao_pagamento: 'DINHEIRO', parcelas: [{ data_vencimento: new Date().toISOString().split('T')[0], valor: 10 }] }
            })
          })
          const v1Text = await venda1.text()
          
          // Testar venda com cliente_id
          const venda2 = await fetch(`${CA_BASE}/venda`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numero: 9999998,
              cliente_id: cliId,
              situacao: 'APROVADO',
              data_venda: new Date().toISOString().split('T')[0],
              itens: [{ descricao: 'Item', quantidade: 1, valor: 10 }],
              condicao_pagamento: { tipo_pagamento: 'A_VISTA', opcao_condicao_pagamento: 'DINHEIRO', parcelas: [{ data_vencimento: new Date().toISOString().split('T')[0], valor: 10 }] }
            })
          })
          const v2Text = await venda2.text()

          resultados.push({ teste: label, status: res.status, SUCESSO: res.ok, resposta_json: resJson, teste_venda_id_cliente: v1Text, teste_venda_cliente_id: v2Text })
        } else {
          resultados.push({ teste: label, status: res.status, SUCESSO: res.ok, body_enviado: body, resposta_json: resJson, resposta_texto: resText })
        }
      } catch (e: any) {
        resultados.push({ teste: label, SUCESSO: false, erro: e.message })
      }
    }

    // Clean up
    for (const id of idsParaDeletar) {
      try {
        await fetch(`${CA_BASE}/pessoas/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } })
      } catch {}
    }

    return NextResponse.json({ empresa: empresaCompleta.nome || empresa.id, total_testes: resultados.length, resultados, ids_deletados: idsParaDeletar })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { url } = await req.json()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: empresaBase } = await supabase.from('empresas').select('id').not('access_token_conta_azul', 'is', null).limit(1).single()
    if (!empresaBase) return NextResponse.json({ error: 'Nenhuma empresa com token' })
    
    // Obter token válido (com renovação automática)
    const { accessToken } = await getValidToken(empresaBase.id)
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    
    return NextResponse.json({ status: res.status, json, text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
