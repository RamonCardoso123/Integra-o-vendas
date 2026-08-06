import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTokenComCodigo, obterInfoContaConectada } from '@/lib/conta-azul/api'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // empresa_id
  const error = searchParams.get('error')

  const renderHtml = (titulo: string, mensagem: string, isError = false) => {
    const cor = isError ? '#ef4444' : '#10b981' // red-500 ou emerald-500
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${titulo}</title>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #fafafa; }
            .card { background: #18181b; padding: 2rem 3rem; border-radius: 1rem; border: 1px solid #27272a; text-align: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); max-width: 400px; width: 90%; }
            h1 { color: ${cor}; margin-top: 0; }
            p { color: #a1a1aa; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${titulo}</h1>
            <p>${mensagem}</p>
          </div>
        </body>
      </html>`,
      { status: isError ? 400 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (error) {
    return renderHtml('Autorização Negada', 'Você não concedeu permissão de acesso à Conta Azul. Pode fechar esta aba e tentar novamente se desejar.', true)
  }

  if (!code || !state) {
    return renderHtml('Parâmetros Inválidos', 'Ocorreu um erro no link de autorização. Parâmetros inválidos.', true)
  }

  try {
    const tokens = await getTokenComCodigo(
      code,
      process.env.CONTA_AZUL_REDIRECT_URI!,
      process.env.CONTA_AZUL_CLIENT_ID!,
      process.env.CONTA_AZUL_CLIENT_SECRET!
    )

    const expires_in = tokens.expires_in || 3600
    const expiracao = new Date(Date.now() + expires_in * 1000).toISOString()

    // 1. Busca os dados da empresa no Conta Azul
    let infoCa
    try {
      infoCa = await obterInfoContaConectada(tokens.access_token)
    } catch (e) {
      console.warn('[conta-azul/callback] Não foi possível obter info da conta conectada. Usando fallback.', e)
    }

    if (infoCa && infoCa.cnpj) {
      const cnpjLimpo = infoCa.cnpj.replace(/\D/g, '')

      // 2. Verifica se já existe uma empresa com esse CNPJ no banco
      const { data: empresasExistentes } = await supabaseAdmin
        .from('empresas')
        .select('*')
        .eq('cnpj', cnpjLimpo)
        
      const empresaExistente = empresasExistentes && empresasExistentes.length > 0 ? empresasExistentes[0] : null

      if (empresaExistente) {
        // CENÁRIO A: A empresa já existe (Re-autenticação por token expirado ou link duplicado)
        await supabaseAdmin
          .from('empresas')
          .update({
            access_token_conta_azul: tokens.access_token,
            refresh_token_conta_azul: tokens.refresh_token,
            data_expiracao_token: expiracao,
            conta_azul_connected: true
          })
          .eq('id', empresaExistente.id)

        // Se o usuário usou um "Card em Branco" (cujo state != empresaExistente.id), apagamos o card em branco
        if (state !== empresaExistente.id) {
          const { data: stateEmpresa } = await supabaseAdmin.from('empresas').select('cnpj').eq('id', state).single()
          if (stateEmpresa && (stateEmpresa.cnpj === '00000000000000' || !stateEmpresa.cnpj)) {
             await supabaseAdmin.from('empresas').delete().eq('id', state)
          }
        }

        await supabaseAdmin.from('logs_integracao').insert({
          empresa_id: empresaExistente.id,
          acao: 'conectar_conta_azul',
          status: 'sucesso',
          detalhes: { expiracao, obs: 'reautenticacao', cnpj: cnpjLimpo },
        })

        return renderHtml('Autenticado com sucesso!', `A integração da empresa ${empresaExistente.nome || 'cadastrada'} foi atualizada com sucesso. Você já pode fechar esta aba.`)
      } else {
        // CENÁRIO B: Empresa não existe. Preenche o card em branco com os dados reais
        const novoNome = infoCa.nome_fantasia || infoCa.razao_social || infoCa.nome
        
        await supabaseAdmin
          .from('empresas')
          .update({
            nome: novoNome,
            razao_social: infoCa.razao_social || null,
            nome_fantasia: infoCa.nome_fantasia || null,
            cnpj: cnpjLimpo,
            email_login: infoCa.email || null,
            access_token_conta_azul: tokens.access_token,
            refresh_token_conta_azul: tokens.refresh_token,
            data_expiracao_token: expiracao,
            conta_azul_connected: true
          })
          .eq('id', state)
      }
    } else {
      // Fallback: Atualiza apenas os tokens no card em branco
      await supabaseAdmin
        .from('empresas')
        .update({
          access_token_conta_azul: tokens.access_token,
          refresh_token_conta_azul: tokens.refresh_token,
          data_expiracao_token: expiracao,
          conta_azul_connected: true
        })
        .eq('id', state)
    }

    await supabaseAdmin.from('logs_integracao').insert({
      empresa_id: state,
      acao: 'conectar_conta_azul',
      status: 'sucesso',
      detalhes: { expiracao },
    })

    return renderHtml('Autenticado com sucesso!', 'A integração com a Conta Azul foi concluída com sucesso. Os dados da empresa foram vinculados automaticamente. Você já pode fechar esta página.')
  } catch (err) {
    console.error('[conta-azul/callback]', err)
    const msg = err instanceof Error ? err.message : 'erro_desconhecido'
    return renderHtml('Erro na Integração', 'Ocorreu um erro ao processar a autorização da Conta Azul: ' + msg, true)
  }
}
