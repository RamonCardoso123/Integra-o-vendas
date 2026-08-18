import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cnpj = searchParams.get('cnpj')

  if (!cnpj) {
    return NextResponse.json({ error: 'CNPJ é obrigatório' }, { status: 400 })
  }

  const cnpjLimpo = cnpj.replace(/\D/g, '')
  if (cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  // 1. TENTA BRASIL API
  try {
    console.log(`[CNPJ Backend] Consultando Brasil API para ${cnpjLimpo}...`)
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      next: { revalidate: 86400 } // Cache de 24h
    })
    
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
    console.warn(`[CNPJ Backend] Brasil API retornou status ${res.status} para ${cnpjLimpo}`)
  } catch (err: any) {
    console.error(`[CNPJ Backend] Erro na Brasil API:`, err.message)
  }

  // 2. FALLBACK 1: TENTA RECEITA WS
  try {
    console.log(`[CNPJ Backend] Consultando ReceitaWS (Fallback 1) para ${cnpjLimpo}...`)
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
      next: { revalidate: 86400 }
    })
    
    if (res.ok) {
      const data = await res.json()
      if (data && data.status !== 'ERROR') {
        const mapeado = {
          cnpj: cnpjLimpo,
          razao_social: data.nome || '',
          nome_fantasia: data.fantasia || data.nome || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cep: (data.cep || '').replace(/\D/g, ''),
          uf: data.uf || '',
          municipio: data.municipio || '',
          ddd_telefone_1: data.telefone || '',
          situacao_cadastral: data.situacao === 'ATIVA' ? 2 : 1,
          descricao_situacao_cadastral: data.situacao || '',
          data_inicio_atividade: data.abertura || '',
          opcao_pelo_simples: false,
          opcao_pelo_mei: false
        }
        return NextResponse.json(mapeado)
      }
    }
    console.warn(`[CNPJ Backend] ReceitaWS falhou ou retornou erro para ${cnpjLimpo}`)
  } catch (err: any) {
    console.error(`[CNPJ Backend] Erro na ReceitaWS:`, err.message)
  }

  // 3. FALLBACK 2: TENTA CNPJ.WS
  try {
    console.log(`[CNPJ Backend] Consultando CNPJ.ws (Fallback 2) para ${cnpjLimpo}...`)
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      next: { revalidate: 86400 }
    })
    
    if (res.ok) {
      const data = await res.json()
      const est = data.estabelecimento || {}
      const mapeado = {
        cnpj: cnpjLimpo,
        razao_social: data.razao_social || '',
        nome_fantasia: est.nome_fantasia || data.razao_social || '',
        logradouro: est.logradouro || '',
        numero: est.numero || '',
        complemento: est.complemento || '',
        bairro: est.bairro || '',
        cep: (est.cep || '').replace(/\D/g, ''),
        uf: est.uf || '',
        municipio: est.cidade?.nome || '',
        ddd_telefone_1: est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : '',
        situacao_cadastral: est.situacao_cadastral === 'Ativa' ? 2 : 1,
        descricao_situacao_cadastral: est.situacao_cadastral || '',
        data_inicio_atividade: est.data_inicio_atividade || '',
        opcao_pelo_simples: !!data.simples?.optante,
        opcao_pelo_mei: !!data.simples?.mei
      }
      return NextResponse.json(mapeado)
    }
    console.warn(`[CNPJ Backend] CNPJ.ws falhou para ${cnpjLimpo}`)
  } catch (err: any) {
    console.error(`[CNPJ Backend] Erro na CNPJ.ws:`, err.message)
  }

  return NextResponse.json(
    { error: 'Não foi possível obter os dados do CNPJ em nenhuma das fontes públicas' },
    { status: 502 }
  )
}
