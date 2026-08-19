import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTokenComCodigo, obterInfoContaConectada } from '@/lib/conta-azul/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      { 
        status: isError ? 400 : 200, 
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    )
  }

  if (error) {
    return renderHtml('Autorização Negada', 'Você não concedeu permissão de acesso à Conta Azul. Pode fechar esta aba e tentar novamente se desejar.', true)
  }

  if (!code || !state) {
    return renderHtml('Parâmetros Inválidos', 'Ocorreu um erro no link de autorização. Parâmetros inválidos.', true)
  }

  try {
    let tokens
    try {
      tokens = await getTokenComCodigo(
        code,
        process.env.CONTA_AZUL_REDIRECT_URI!,
        process.env.CONTA_AZUL_CLIENT_ID!,
        process.env.CONTA_AZUL_CLIENT_SECRET!
      )
    } catch (err: any) {
      // Registrar falha na troca de código por token nos logs
      if (state) {
        try {
          await supabaseAdmin.from('logs_integracao').insert({
            empresa_id: state,
            acao: 'conectar_conta_azul_troca_token',
            status: 'erro',
            detalhes: { 
              mensagem: err.message, 
              stack: err.stack,
              redirect_uri: process.env.CONTA_AZUL_REDIRECT_URI || 'não configurado',
              client_id: process.env.CONTA_AZUL_CLIENT_ID ? 'configurado' : 'não configurado'
            }
          })
        } catch (e) {
          console.error('Erro ao salvar log de troca de token:', e)
        }
      }
      throw err
    }

    const expires_in = tokens.expires_in || 3600
    const expiracao = new Date(Date.now() + expires_in * 1000).toISOString()

    let debugInfo = {
      cenario: '',
      linhas_afetadas: 0,
      erro: null as any,
      log_sucesso: 'não tentado',
      token_prefixo: tokens.access_token ? `${tokens.access_token.substring(0, 5)}...` : 'nulo',
      key_length: (process.env.SUPABASE_SERVICE_ROLE_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY || '').length
    }

    // 1. Busca os dados da empresa no Conta Azul
    let infoCa
    try {
      infoCa = await obterInfoContaConectada(tokens.access_token)
    } catch (e: any) {
      console.warn('[conta-azul/callback] Não foi possível obter info da conta conectada. Usando fallback.', e)
      // Registrar falha de leitura de informações cadastrais da Conta Azul
      if (state) {
        try {
          await supabaseAdmin.from('logs_integracao').insert({
            empresa_id: state,
            acao: 'conectar_conta_azul_obter_info_empresa',
            status: 'erro',
            detalhes: { 
              mensagem: e.message, 
              stack: e.stack
            }
          })
        } catch (err) {
          console.error('Erro ao salvar log de obterInfoContaConectada:', err)
        }
      }
    }

    if (infoCa && infoCa.cnpj) {
      const cnpjLimpo = infoCa.cnpj.replace(/\D/g, '')

      // 2. Verifica se já existe uma empresa com esse CNPJ no banco
      const { data: empresasExistentes, error: errBuscaCnpj } = await supabaseAdmin
        .from('empresas')
        .select('*')
        .eq('cnpj', cnpjLimpo)
      
      if (errBuscaCnpj) throw errBuscaCnpj
        
      const empresaExistente = empresasExistentes && empresasExistentes.length > 0 ? empresasExistentes[0] : null

      if (empresaExistente) {
        debugInfo.cenario = 'Cenário A (empresa já existe pelo CNPJ)'
        // CENÁRIO A: A empresa já existe (Re-autenticação por token expirado ou link duplicado)
        let { data: updA, error: errUpdateA } = await supabaseAdmin
          .from('empresas')
          .update({
            access_token_conta_azul: tokens.access_token,
            refresh_token_conta_azul: tokens.refresh_token,
            data_expiracao_token: expiracao,
            conta_azul_connected: true,
            email_login: infoCa.email || empresaExistente.email_login || null,
            razao_social: infoCa.razao_social || null,
            nome_fantasia: infoCa.nome_fantasia || null
          })
          .eq('id', empresaExistente.id)
          .select()
          
        if (updA) debugInfo.linhas_afetadas = updA.length
        if (errUpdateA) debugInfo.erro = { stage: 'updateA', msg: errUpdateA.message, code: errUpdateA.code }

        if (errUpdateA) {
          console.warn('[Cenário A] Falha ao gravar dados cadastrais completos. Tentando salvar apenas os tokens de conexão...', errUpdateA)
          // Se falhar (ex: colunas inexistentes no banco), salvamos apenas as colunas básicas
          const { data: updASimple, error: errUpdateASimple } = await supabaseAdmin
            .from('empresas')
            .update({
              access_token_conta_azul: tokens.access_token,
              refresh_token_conta_azul: tokens.refresh_token,
              data_expiracao_token: expiracao,
              conta_azul_connected: true
            })
            .eq('id', empresaExistente.id)
            .select()
            
          if (updASimple) debugInfo.linhas_afetadas = updASimple.length
          if (errUpdateASimple) {
            debugInfo.erro = { stage: 'updateASimple', msg: errUpdateASimple.message, code: errUpdateASimple.code }
            throw errUpdateASimple
          }
        }

        // Se o usuário usou um "Card em Branco" (cujo state != empresaExistente.id), apagamos o card em branco
        if (state !== empresaExistente.id) {
          const { data: stateEmpresa } = await supabaseAdmin.from('empresas').select('cnpj').eq('id', state).single()
          if (stateEmpresa && (stateEmpresa.cnpj === '00000000000000' || !stateEmpresa.cnpj)) {
             // Deleta o vínculo em usuarios_empresas antes de deletar a empresa para evitar erro de chave estrangeira
             const { error: errDelVinc } = await supabaseAdmin.from('usuarios_empresas').delete().eq('empresa_id', state)
             if (errDelVinc) throw errDelVinc
             const { error: errDelEmp } = await supabaseAdmin.from('empresas').delete().eq('id', state)
             if (errDelEmp) throw errDelEmp
          }
        }

        try {
          const { error: errLogA } = await supabaseAdmin.from('logs_integracao').insert({
            empresa_id: empresaExistente.id,
            acao: 'conectar_conta_azul',
            status: 'sucesso',
            detalhes: { expiracao, obs: 'reautenticacao', cnpj: cnpjLimpo },
          })
          debugInfo.log_sucesso = errLogA ? `Erro: ${errLogA.message}` : 'gravado com sucesso'
        } catch (errLogA: any) {
          debugInfo.log_sucesso = `Erro exception: ${errLogA.message}`
          console.error('Erro ao salvar log do Cenário A:', errLogA)
        }

        return renderHtml(
          'Autenticado com sucesso! [v1.1.0]', 
          `A integração da empresa ${empresaExistente.nome || 'cadastrada'} foi atualizada com sucesso. Você já pode fechar esta aba.<br/><br/><small style="color: #666;">Debug: ${JSON.stringify(debugInfo)}</small>`
        )
      } else {
        debugInfo.cenario = 'Cenário B (nova empresa)'
        // CENÁRIO B: Empresa não existe. Preenche o card em branco com os dados reais
        const novoNome = infoCa.nome_fantasia || infoCa.razao_social || infoCa.nome
        
        let { data: updB, error: errUpdateB } = await supabaseAdmin
          .from('empresas')
          .update({
            nome: novoNome,
            cnpj: cnpjLimpo,
            email_login: infoCa.email || null,
            access_token_conta_azul: tokens.access_token,
            refresh_token_conta_azul: tokens.refresh_token,
            data_expiracao_token: expiracao,
            conta_azul_connected: true,
            razao_social: infoCa.razao_social || null,
            nome_fantasia: infoCa.nome_fantasia || null
          })
          .eq('id', state)
          .select()
          
        if (updB) debugInfo.linhas_afetadas = updB.length
        if (errUpdateB) debugInfo.erro = { stage: 'updateB', msg: errUpdateB.message, code: errUpdateB.code }
           
        if (errUpdateB) {
          console.warn('[Cenário B] Falha ao gravar dados cadastrais completos. Tentando salvar apenas os tokens de conexão...', errUpdateB)
          // Se falhar (ex: colunas inexistentes no banco), salvamos apenas os tokens de conexão no card
          const { data: updBSimple, error: errUpdateBSimple } = await supabaseAdmin
            .from('empresas')
            .update({
              access_token_conta_azul: tokens.access_token,
              refresh_token_conta_azul: tokens.refresh_token,
              data_expiracao_token: expiracao,
              conta_azul_connected: true
            })
            .eq('id', state)
            .select()
            
          if (updBSimple) debugInfo.linhas_afetadas = updBSimple.length
          if (errUpdateBSimple) {
            debugInfo.erro = { stage: 'updateBSimple', msg: errUpdateBSimple.message, code: errUpdateBSimple.code }
            throw errUpdateBSimple
          }
        }
      }
    } else {
      debugInfo.cenario = 'Cenário C (fallback sem dados cadastrais)'
      // Fallback: Atualiza apenas os tokens no card em branco
      const { data: updFallback, error: errUpdateFallback } = await supabaseAdmin
        .from('empresas')
        .update({
          access_token_conta_azul: tokens.access_token,
          refresh_token_conta_azul: tokens.refresh_token,
          data_expiracao_token: expiracao,
          conta_azul_connected: true
        })
        .eq('id', state)
        .select()
        
      if (updFallback) debugInfo.linhas_afetadas = updFallback.length
      if (errUpdateFallback) {
        debugInfo.erro = { stage: 'updateFallback', msg: errUpdateFallback.message, code: errUpdateFallback.code }
        throw errUpdateFallback
      }
    }

    try {
      const { error: errLogFinal } = await supabaseAdmin.from('logs_integracao').insert({
        empresa_id: state,
        acao: 'conectar_conta_azul',
        status: 'sucesso',
        detalhes: { expiracao },
      })
      debugInfo.log_sucesso = errLogFinal ? `Erro final: ${errLogFinal.message}` : 'gravado com sucesso'
    } catch (errLogFinal: any) {
      debugInfo.log_sucesso = `Erro final exception: ${errLogFinal.message}`
      console.error('Erro ao salvar log de sucesso final:', errLogFinal)
    }

    return renderHtml(
      'Autenticado com sucesso! [v1.1.0]', 
      `A integração com a Conta Azul foi concluída com sucesso. Os dados da empresa foram vinculados automaticamente. Você já pode fechar esta página.<br/><br/><small style="color: #666;">Debug: ${JSON.stringify(debugInfo)}</small>`
    )
  } catch (err: any) {
    console.error('[conta-azul/callback] Erro geral:', err)
    
    // Registrar erro geral de callback nos logs para podermos debugar remotamente
    if (state) {
      // Verifica se a empresa realmente existe antes de inserir o log (caso ela tenha sido apagada no Cenário A e o erro aconteceu depois)
      try {
        const { data: empExiste } = await supabaseAdmin.from('empresas').select('id').eq('id', state).single()
        if (empExiste) {
          await supabaseAdmin.from('logs_integracao').insert({
            empresa_id: state,
            acao: 'conectar_conta_azul_erro_geral',
            status: 'erro',
            detalhes: { 
              mensagem: err.message, 
              stack: err.stack
            }
          })
        }
      } catch (e) {
        console.error('Erro ao salvar log de erro geral:', e)
      }
    }

    let msg = 'erro_desconhecido'
    if (err instanceof Error) {
      msg = err.message
    } else if (err && typeof err === 'object') {
      msg = err.message || err.details || err.hint || JSON.stringify(err)
    }
    return renderHtml('Erro na Integração', 'Ocorreu um erro ao processar a autorização da Conta Azul: ' + msg, true)
  }
}
