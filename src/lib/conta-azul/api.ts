/**
 * Cliente da API do Conta Azul - NOVA API v2
 * Documentação: https://developers.contaazul.com/
 * Base URL: https://api-v2.contaazul.com/v1/
 * Auth URL: https://auth.contaazul.com/oauth2/
 *
 * ATENÇÃO: A API legada foi desligada em Out/2025. Este client usa a nova API v2.
 */

const BASE_URL = 'https://api-v2.contaazul.com/v1'
const AUTH_URL = 'https://auth.contaazul.com/oauth2/token'
const AUTHORIZE_URL = 'https://auth.contaazul.com/login'

/**
 * Helper para lidar com os limites de requisição da Conta Azul (Spike Arrest).
 * Intercepta erros 429 e aplica um backoff exponencial.
 */
async function fetchCA(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 100)); // Delay reduzido de 200ms para 100ms para agilizar sem quebrar o limite base
    const res = await fetch(url, options);
    if (res.status === 429) {
      const waitTime = (2 ** i) * 1000;
      console.warn(`[fetchCA] Rate limit atingido (429) na URL ${typeof url === 'string' ? url : '...'} - Tentativa ${i+1}/${maxRetries}. Aguardando ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface ContaFinanceira {
  id: string
  descricao: string
  tipo?: string
}

export interface ContatoCA {
  id: string
  nome: string
}

export interface ContaPagarPayload {
  data_competencia: string
  valor: number
  observacao?: string
  descricao: string
  contato?: string
  conta_financeira?: string
  condicao_pagamento: {
    parcelas: Array<{
      descricao: string
      data_vencimento: string
      nota?: string
      detalhe_valor: {
        valor_bruto: number
        valor_liquido: number
        multa?: number
        juros?: number
        desconto?: number
        taxa?: number
      }
    }>
  }
  rateio: Array<{
    id_categoria?: string
    categoria_id?: string
    valor?: number
    value?: number
  }>
}

export interface ContaPagarResponse {
  protocolId: string
  status: 'PENDING' | 'SUCCESS' | 'ERROR'
  createdAt: string
}

export async function getTokenComCodigo(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const credenciais = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetchCA(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credenciais}` },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Erro ao obter token: ${res.status} - ${err}`) }
  return res.json()
}

export async function refreshToken(
  refreshTokenStr: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const credenciais = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetchCA(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credenciais}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTokenStr }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Erro ao renovar token: ${res.status} - ${err}`) }
  return res.json()
}

export async function listarContasFinanceiras(accessToken: string): Promise<ContaFinanceira[]> {
  const todasContas = new Map<string, ContaFinanceira>()
  const endpoints = [
    `${BASE_URL}/conta-financeira?pagina=1&tamanho_pagina=100`,
    `${BASE_URL}/financeiro/conta-financeira?pagina=1&tamanho_pagina=100`,
    `${BASE_URL}/contas-financeiras?pagina=1&tamanho_pagina=100`,
    `${BASE_URL}/financeiro/contas-financeiras?pagina=1&tamanho_pagina=100`,
  ]
  for (const endpoint of endpoints) {
    try {
      const res = await fetchCA(endpoint, { headers: { 'Authorization': `Bearer ${accessToken}` } })
      if (!res.ok) {
        if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
        continue
      }
      const data = await res.json()
      const listaRaw = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
      for (const item of listaRaw) {
        const id = item.id || item.uuid || item.bankAccountId || item.guid
        if (id && !todasContas.has(id)) {
          todasContas.set(id, { id, descricao: item.descricao || item.nome || item.name || item.description || 'Conta Sem Nome', tipo: item.tipo || item.type })
        }
      }
      // Se encontrou contas no endpoint atual, não precisa tentar os fallbacks
      if (todasContas.size > 0) break
    } catch (e: any) { 
      if (e.message === 'TOKEN_EXPIRADO') throw e;
      console.warn(`[contas-financeiras] erro em ${endpoint}:`, e) 
    }
  }
  return Array.from(todasContas.values())
}

export async function listarCategorias(accessToken: string): Promise<Array<{ id: string; nome: string }>> {
  const todasCategoriasEncontradas = new Map<string, { id: string; nome: string; tipo?: string }>()
  const endpoints = [
    `${BASE_URL}/categorias?tipo=DESPESA&permite_apenas_filhos=true`,
    `${BASE_URL}/categorias?permite_apenas_filhos=true`,
    `${BASE_URL}/categorias?tipo=DESPESA&permite_apenas_filhos=false`,
    `${BASE_URL}/categorias?permite_apenas_filhos=false`,
    `${BASE_URL}/categorias`,
    `${BASE_URL}/financeiro/categorias`,
  ]
  const errosDaApi: string[] = []
  
  for (const endpoint of endpoints) {
    try {
      for (let page = 1; page <= 10; page++) {
        const sep = endpoint.includes('?') ? '&' : '?'
        const urlComPagina = `${endpoint}${sep}pagina=${page}&tamanho_pagina=100`
        const res = await fetchCA(urlComPagina, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        
        if (!res.ok) {
          if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
          const errText = await res.text()
          errosDaApi.push(`[${endpoint}] ${res.status}: ${errText}`)
          break // Falhou, tenta o próximo endpoint
        }
        
        const data = await res.json()
        let listaRaw: any[] = []
        if (data.itens && Array.isArray(data.itens)) listaRaw = data.itens
        else if (Array.isArray(data)) listaRaw = data
        else if (data.content && Array.isArray(data.content)) listaRaw = data.content
        else if (data.items && Array.isArray(data.items)) listaRaw = data.items
        else if (data.data && Array.isArray(data.data)) listaRaw = data.data
        
        if (listaRaw.length === 0) break
        
        const achatarCategorias = (itens: any[]): any[] => {
          let resultado: any[] = []
          for (const item of itens) {
            resultado.push({ id: item.id || item.uuid || item.categoryId || item.guid, nome: item.nome || item.name || item.descricao || item.description || 'Categoria', tipo: item.tipo || item.type })
            const filhos = item.children || item.sub_categories || item.subcategorias || item.itens || item.items || item.nodes
            if (filhos && Array.isArray(filhos) && filhos.length > 0) resultado = resultado.concat(achatarCategorias(filhos))
          }
          return resultado
        }
        
        const achatadas = achatarCategorias(listaRaw)
        for (const cat of achatadas) {
          if (cat.id && !todasCategoriasEncontradas.has(cat.id)) {
            const ehReceita = cat.tipo === 'RECEITA' || cat.tipo === 'REVENUE' || cat.tipo === 'INCOME'
            if (!ehReceita) todasCategoriasEncontradas.set(cat.id, cat)
          }
        }
        
        if (listaRaw.length < 100) break
      }
    } catch (e: any) { 
      if (e.message === 'TOKEN_EXPIRADO') throw e;
      errosDaApi.push(`[${endpoint}] Falha no fetch: ${e.message}`)
    }
  }
  
  const resultadoFinal = Array.from(todasCategoriasEncontradas.values())
  console.log(`[categorias] Total carregado: ${resultadoFinal.length}`)
  
  if (resultadoFinal.length === 0) {
    throw new Error(`Nenhuma categoria no Conta Azul. Detalhes da API: ${errosDaApi.join(' | ')}`)
  }
  
  return resultadoFinal
}

/**
 * Busca ou cria um Fornecedor no Conta Azul.
 * Prioriza busca por CPF/CNPJ para evitar duplicatas.
 */
export async function buscarOuCriarContato(
  accessToken: string,
  nome: string,
  cpfCnpj?: string | null
): Promise<string | undefined> {
  const docLimpo = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : ''
  const tipoPessoa = docLimpo.length === 14 ? 'Jurídica' : 'Física'

  try {
    // 1. Busca por CPF/CNPJ se disponível (mais preciso)
    if (docLimpo) {
      const urlDoc = `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=10&cpf_cnpj=${docLimpo}&tipo_perfil=Fornecedor`
      try {
        const busca = await fetchCA(urlDoc, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (busca.ok) {
          const data = await busca.json()
          const lista: any[] = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
          if (lista.length > 0) {
            const matchDoc = lista.find(p => {
              const pDoc = (p.cpf || p.cnpj || p.documento || '').replace(/\D/g, '')
              return pDoc === docLimpo
            })
            if (matchDoc) return matchDoc.id || matchDoc.uuid
          }
        }
      } catch (e) { console.warn('[fornecedor] erro na busca por doc:', e) }
    }

    // 2. Busca por nome
    const endpointsBusca = [
      `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=100&busca=${encodeURIComponent(nome)}&tipo_perfil=Fornecedor`,
      `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=100&busca=${encodeURIComponent(nome)}`,
    ]
    for (const url of endpointsBusca) {
      try {
        const busca = await fetchCA(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (busca.ok) {
          const data = await busca.json()
          const lista: any[] = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
          if (lista.length > 0) {
            const nomeBusca = nome.toLowerCase().trim()
            const matchExato = lista.find(p => (p.nome || p.name || '').toLowerCase().trim() === nomeBusca)
            if (matchExato) return matchExato.id || matchExato.uuid
          }
        }
      } catch (e) { console.warn(`[fornecedor] erro na busca em ${url}:`, e) }
    }

    // 3. Criar como Fornecedor
    const bodyFornecedor: Record<string, unknown> = {
      nome,
      tipo_pessoa: tipoPessoa,
      perfis: [{ tipo_perfil: 'Fornecedor' }],
      ativo: true,
    }
    if (docLimpo) {
      if (tipoPessoa === 'Jurídica') bodyFornecedor.cnpj = docLimpo
      else bodyFornecedor.cpf = docLimpo
    }
    const criar = await fetchCA(`${BASE_URL}/pessoas`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyFornecedor),
    })
    if (criar.ok) { const novo: any = await criar.json(); return novo.id }
    // Fallback legado
    const criarLegado = await fetchCA(`${BASE_URL}/contatos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, tipo_pessoa: tipoPessoa === 'Jurídica' ? 'PJ' : 'PF', ativo: true }),
    })
    if (criarLegado.ok) { const novo: any = await criarLegado.json(); return novo.id }
    const errText = await criar.text()
    throw new Error(`Erro ao criar contato '${nome}': ${criar.status} - ${errText}`)
  } catch (e: any) { console.error(`[buscarOuCriarContato] erro:`, e); throw e }
}

export async function criarContaPagar(accessToken: string, payload: ContaPagarPayload): Promise<ContaPagarResponse> {
  const res = await fetchCA(`${BASE_URL}/financeiro/eventos-financeiros/contas-a-pagar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
  if (!res.ok) { const errBody = await res.text(); throw new Error(`[${res.status}] ${errBody}`) }
  return res.json()
}

export function getUrlAutorizacao(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile aws.cognito.signin.user.admin',
    ...(state ? { state } : {}),
  })
  return `${AUTHORIZE_URL}?${params}`
}

export async function listarFornecedores(accessToken: string): Promise<Array<{ id: string; nome: string; documento: string }>> {
  const todosFornecedoresEncontrados = new Map<string, { id: string; nome: string; documento: string }>()
  const errosDaApi: string[] = []
  
  // Como as APIs da CA podem mudar ou falhar com parâmetros específicos, vamos tentar listar todos
  // e tratar a extração de CNPJ/CPF da resposta.
  // A request na documentação sugere: /v1/pessoas?tipo_perfil=Fornecedor
  const endpoints = [
    `${BASE_URL}/pessoas?tipo_perfil=Fornecedor`,
    `${BASE_URL}/v1/pessoas?tipo_perfil=Fornecedor`
  ]

  for (const endpoint of endpoints) {
    try {
      // Loop de paginação
      for (let page = 1; page <= 50; page++) {
        const sep = endpoint.includes('?') ? '&' : '?'
        const urlComPagina = `${endpoint}${sep}pagina=${page}&tamanho_pagina=100`
        const res = await fetchCA(urlComPagina, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        
        if (!res.ok) {
          if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
          const errText = await res.text()
          errosDaApi.push(`[${endpoint}] ${res.status}: ${errText}`)
          break // Falhou, tenta o próximo endpoint
        }
        
        const data = await res.json()
        let listaRaw: any[] = []
        if (data.itens && Array.isArray(data.itens)) listaRaw = data.itens
        else if (data.items && Array.isArray(data.items)) listaRaw = data.items
        else if (Array.isArray(data)) listaRaw = data
        else if (data.content && Array.isArray(data.content)) listaRaw = data.content
        else if (data.data && Array.isArray(data.data)) listaRaw = data.data
        
        if (listaRaw.length === 0) break
        
        for (const item of listaRaw) {
          const id = item.id || item.uuid || item.guid
          const nome = item.nome || item.name || item.nome_fantasia || ''
          const documentoRaw = item.cnpj || item.cpf || item.documento || ''
          const documento = documentoRaw.replace(/\D/g, '')

          if (id && nome && !todosFornecedoresEncontrados.has(id)) {
            todosFornecedoresEncontrados.set(id, { id, nome, documento })
          }
        }
        
        if (listaRaw.length < 100) break // Última página
      }
      
      // Se já achou fornecedores em um endpoint, não precisa tentar o próximo
      if (todosFornecedoresEncontrados.size > 0) break
    } catch (e: any) { 
      if (e.message === 'TOKEN_EXPIRADO') throw e;
      errosDaApi.push(`[${endpoint}] Falha no fetch: ${e.message}`)
    }
  }
  
  const resultadoFinal = Array.from(todosFornecedoresEncontrados.values())
  console.log(`[fornecedores] Total carregado via sincronização: ${resultadoFinal.length}`)
  
  if (resultadoFinal.length === 0 && errosDaApi.length > 0) {
    console.warn(`Nenhum fornecedor encontrado no Conta Azul. Detalhes da API: ${errosDaApi.join(' | ')}`)
  }
  
  return resultadoFinal
}

export interface VendaPayload {
  id_cliente: string
  numero?: number
  situacao: 'EM_ANDAMENTO' | 'APROVADO'
  data_venda: string
  id_categoria?: string
  id_centro_custo?: string
  id_vendedor?: string
  observacoes?: string
  observacoes_pagamento?: string
  itens: Array<{
    descricao: string
    quantidade: number
    valor: number
    id?: string // uuid do produto
    valor_custo?: number
  }>
  composicao_de_valor?: {
    frete?: number
    desconto?: {
      tipo: 'PORCENTAGEM' | 'VALOR'
      valor: number
    }
  }
  condicao_pagamento: {
    tipo_pagamento: string
    id_conta_financeira?: string
    opcao_condicao_pagamento: string
    nsu?: string
    parcelas: Array<{
      data_vencimento: string
      valor: number
      descricao?: string
    }>
  }
}

export async function criarVenda(accessToken: string, payload: VendaPayload): Promise<{ id: string, id_legado: number }> {
  // Busca o próximo número de venda para não haver conflito se não informarmos
  if (!payload.numero) {
    try {
      const proximo = await fetchCA(`${BASE_URL}/venda/proximo-numero`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (proximo.ok) {
        payload.numero = Number(await proximo.text())
      }
    } catch (e) {
      console.warn('Erro ao obter proximo numero de venda', e)
    }
  }

  // Garante que id_vendedor NÃO seja enviado (vendedor responsável deve ficar em branco)
  delete (payload as any).id_vendedor

  const res = await fetchCA(`${BASE_URL}/venda`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
  if (!res.ok) { const errBody = await res.text(); throw new Error(`[${res.status}] ${errBody}`) }
  return res.json()
}

export async function buscarOuCriarProduto(
  accessToken: string,
  codigo: string,
  descricao: string,
  valor: number,
  metadata?: { ncm?: string, origem?: string, unidade_medida?: string, cest?: string, tipo_produto?: string }
): Promise<string | undefined> {
  
  // Helper: busca o ID de uma unidade de medida pela sigla (ex: "UN", "PC", "KG")
  const buscarUnidadeMedidaId = async (): Promise<number | undefined> => {
    if (!metadata?.unidade_medida) return undefined
    const sigla = metadata.unidade_medida.toUpperCase().trim()
    try {
      const res = await fetchCA(`${BASE_URL}/produtos/unidades-medida?busca_textual=${encodeURIComponent(sigla)}&tamanho_pagina=100`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const lista: any[] = data.itens || data.items || (Array.isArray(data) ? data : [])
        // Tenta match exato pela sigla, senão pega o primeiro
        const exato = lista.find((u: any) => 
          (u.sigla || u.descricao || '').toUpperCase().trim() === sigla
        )
        const alvo = exato || lista[0]
        if (alvo?.id) {
          console.log(`[buscarOuCriarProduto] Unidade '${sigla}' => ID ${alvo.id}`)
          return alvo.id
        }
      }
    } catch (e) {
      console.warn('[buscarOuCriarProduto] Falha ao buscar unidade de medida:', e)
    }
    return undefined
  }

  // Monta o objeto fiscal completo conforme a API v2 do Conta Azul
  const montarFiscal = async () => {
    if (!metadata) return undefined
    const fiscal: any = {}

    // 1. Busca ID do NCM pela API
    if (metadata.ncm) {
      try {
        const ncmCode = metadata.ncm.replace(/\D/g, '')
        const res = await fetchCA(`${BASE_URL}/produtos/ncm?busca_textual=${ncmCode}&tamanho_pagina=50`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          const lista: any[] = data.itens || data.items || (Array.isArray(data) ? data : [])
          const match = lista.find((n: any) => (n.codigo || '').replace(/\D/g, '') === ncmCode)
          if (match?.id) {
            fiscal.ncm = { id: match.id }
            console.log(`[montarFiscal] NCM '${ncmCode}' => ID ${match.id}`)
          } else if (lista.length > 0 && lista[0].id) {
            fiscal.ncm = { id: lista[0].id }
            console.log(`[montarFiscal] NCM '${ncmCode}' => fallback ID ${lista[0].id} (${lista[0].codigo})`)
          }
        }
      } catch (e) { console.warn('[montarFiscal] Erro busca NCM:', e) }
    }

    // 2. Busca ID do CEST pela API
    if (metadata.cest) {
      try {
        const cestCode = metadata.cest.replace(/\D/g, '')
        const res = await fetchCA(`${BASE_URL}/produtos/cest?busca_textual=${cestCode}&tamanho_pagina=50`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          const lista: any[] = data.itens || data.items || (Array.isArray(data) ? data : [])
          const match = lista.find((c: any) => (c.codigo || '').replace(/\D/g, '') === cestCode)
          if (match?.id) {
            fiscal.cest = { id: match.id }
            console.log(`[montarFiscal] CEST '${cestCode}' => ID ${match.id}`)
          } else if (lista.length > 0 && lista[0].id) {
            fiscal.cest = { id: lista[0].id }
            console.log(`[montarFiscal] CEST '${cestCode}' => fallback ID ${lista[0].id}`)
          }
        }
      } catch (e) { console.warn('[montarFiscal] Erro busca CEST:', e) }
    }

    // 3. Origem (enum string conforme API v2)
    if (metadata.origem) {
      const origemCode = metadata.origem.split('-')[0].trim()
      const mapaOrigem: Record<string, string> = {
        '0': 'NACIONAL',
        '1': 'ESTRANGEIRA_IMPORTACAO_DIRETA',
        '2': 'ESTRANGEIRA_ADQUIRIDA_INTERNAMENTE',
        '3': 'NACIONAL_IMPORTACAO_SUPERIOR_40',
        '4': 'NACIONAL_PRODUCAO_CONFORMIDADE',
        '5': 'NACIONAL_IMPORTACAO_INFERIOR_40',
        '6': 'ESTRANGEIRA_IMPORTACAO_DIRETA_CAMEX',
        '7': 'ESTRANGEIRA_ADQUIRIDA_INTERNAMENTE_CAMEX',
        '8': 'NACIONAL_MERCDORIA_BEM_IMPORTACAO_SUPERIOR_70'
      }
      fiscal.origem = mapaOrigem[origemCode] || 'NACIONAL'
    } else {
      fiscal.origem = 'NACIONAL'
    }

    // 4. Tipo Produto (enum string conforme API v2)
    if (metadata.tipo_produto) {
      const tipoCode = metadata.tipo_produto.split('-')[0].trim()
      const mapaTipo: Record<string, string> = {
        '00': 'MERCADORIA_PARA_REVENDA',
        '01': 'MATERIA_PRIMA',
        '02': 'EMBALAGEM',
        '03': 'PRODUTO_EM_PROCESSO',
        '04': 'PRODUTO_ACABADO',
        '05': 'SUBPRODUTO',
        '06': 'PRODUTO_INTERMEDIARIO',
        '07': 'MATERIAL_DE_USO_E_CONSUMO',
        '08': 'ATIVO_IMOBILIZADO',
        '09': 'SERVICOS',
        '10': 'OUTROS_INSUMOS',
        '99': 'OUTRAS'
      }
      fiscal.tipo_produto = mapaTipo[tipoCode] || 'MERCADORIA_PARA_REVENDA'
    } else {
      fiscal.tipo_produto = 'MERCADORIA_PARA_REVENDA'
    }

    // 5. Unidade de medida DENTRO do fiscal (obrigatório na API v2)
    const unidadeId = await buscarUnidadeMedidaId()
    if (unidadeId) {
      fiscal.unidade_medida = { id: unidadeId }
    }

    return Object.keys(fiscal).length > 0 ? fiscal : undefined
  }

  // 1. Tenta buscar o produto pelo código ou descrição
  let matchProduto = null;
  const termoBusca = encodeURIComponent(codigo || descricao);
  
  try {
    // Busca paginada (até 5 páginas) para evitar que SKUs curtos se percam em muitos resultados
    for (let page = 1; page <= 5; page++) {
      const urlBusca = `${BASE_URL}/produtos?termo_busca=${termoBusca}&tamanho_pagina=100&pagina=${page}`;
      const busca = await fetchCA(urlBusca, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      
      if (!busca.ok) {
        if (busca.status === 401) throw new Error('TOKEN_EXPIRADO');
        break; // Erro na busca, interrompe paginação
      }
      
      const data = await busca.json();
      const lista: any[] = data.itens || data.items || (Array.isArray(data) ? data : []);
      
      if (lista.length === 0) break; // Fim dos resultados
      
      if (codigo) {
        const codigoTrim = codigo.trim();
        matchProduto = lista.find(p => p.codigo_sku?.trim() === codigoTrim || p.codigo?.trim() === codigoTrim);
      }
      
      if (!matchProduto) {
        const searchName = (descricao || '').toLowerCase().trim();
        matchProduto = lista.find(p => (p.nome || p.name || '').toLowerCase().trim() === searchName);
      }
      
      if (matchProduto) {
        break; // Encontrou o produto, pode parar a paginação
      }
      
      if (lista.length < 100) break; // Última página
    }

    if (matchProduto) {
      const produtoId = matchProduto.id || matchProduto.uuid;
      
      // Se temos dados fiscais, faz PUT para atualizar o produto existente
      const fiscal = await montarFiscal();
      if (fiscal && produtoId) {
        try {
          const updatePayload: any = { fiscal };
          const unidadeId = await buscarUnidadeMedidaId();
          if (unidadeId) updatePayload.unidade_medida = { id: unidadeId };
          
          console.log(`[buscarOuCriarProduto] Atualizando produto ${produtoId} com:`, JSON.stringify(updatePayload));
          
          const updateRes = await fetchCA(`${BASE_URL}/produtos/${produtoId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });
          if (!updateRes.ok) {
            const errBody = await updateRes.text();
            console.warn(`[buscarOuCriarProduto] Falha ao atualizar fiscal do produto existente ${produtoId}:`, updateRes.status, errBody);
          } else {
            console.log(`[buscarOuCriarProduto] Produto ${produtoId} atualizado com dados fiscais com sucesso!`);
          }
        } catch (e) {
          console.warn('[buscarOuCriarProduto] Erro ao tentar atualizar fiscal:', e);
        }
      }
      
      return produtoId;
    }
  } catch (e) {
    console.warn(`[buscarOuCriarProduto] erro na busca do produto:`, e);
  }

  // 2. Tenta criar o produto se não existir
  try {
    const fiscal = await montarFiscal()
    const unidadeId = await buscarUnidadeMedidaId()
    
    const payloadProduto: any = {
      nome: descricao || codigo || 'Produto sem nome',
      codigo_sku: codigo || undefined,
      status: 'ATIVO',
      formato: 'SIMPLES',
      estoque: {
        valor_venda: valor
      }
    }
    
    // Unidade de medida no nível raiz do produto
    if (unidadeId) {
      payloadProduto.unidade_medida = { id: unidadeId }
    }
    
    // Dados fiscais (ncm, cest, origem, tipo_produto, unidade_medida)
    if (fiscal) {
      payloadProduto.fiscal = fiscal
    }
    
    console.log(`[buscarOuCriarProduto] Criando produto com payload:`, JSON.stringify(payloadProduto))
    
    const criar = await fetchCA(`${BASE_URL}/produtos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadProduto),
    })
    if (criar.ok) {
      const novo: any = await criar.json()
      console.log(`[buscarOuCriarProduto] Produto criado com sucesso! ID: ${novo.id}`)
      return novo.id || novo.uuid
    } else {
      const errBody = await criar.text()
      console.error(`[buscarOuCriarProduto] falha ao criar produto "${descricao}" (${codigo}):`, criar.status, errBody)
      
      let msg = `Não foi possível criar o produto "${descricao}" no Conta Azul: [${criar.status}] ${errBody}`
      if (errBody.includes('unidade de medida')) {
        msg = `Erro no Conta Azul: Para cadastrar o produto "${descricao}", é obrigatório enviar o ID da Unidade de Medida. Verifique se a unidade "${metadata?.unidade_medida || 'UN'}" existe no seu Conta Azul.`
      } else if (criar.status === 409 && errBody.includes('SKU')) {
        console.log(`[buscarOuCriarProduto] 409 SKU duplicado para '${codigo}'. Tentando recuperar produto exaustivamente...`);
        if (codigo) {
           const codigoTrim = codigo.trim();
           const rotasDeBusca = [
             `${BASE_URL}/produtos?codigo_sku=${encodeURIComponent(codigo)}`,
             `${BASE_URL}/produtos?busca=${encodeURIComponent(codigo)}`,
             `${BASE_URL}/produtos?status=INATIVO&termo_busca=${encodeURIComponent(codigo)}`,
             `${BASE_URL}/produtos?status=TODOS&termo_busca=${encodeURIComponent(codigo)}`,
             // Uma tentativa sem filtros, iterando as primeiras 10 páginas
             `${BASE_URL}/produtos`
           ];
           
           let produtoRecuperado = null;
           for (const rotaBase of rotasDeBusca) {
             if (produtoRecuperado) break;
             const maxPages = rotaBase === `${BASE_URL}/produtos` ? 10 : 3;
             for (let page = 1; page <= maxPages; page++) {
                const sep = rotaBase.includes('?') ? '&' : '?';
                const urlBusca = `${rotaBase}${sep}tamanho_pagina=100&pagina=${page}`;
                try {
                  const busca = await fetchCA(urlBusca, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                  if (!busca.ok) break;
                  
                  const data = await busca.json();
                  const lista: any[] = data.itens || data.items || (Array.isArray(data) ? data : []);
                  if (lista.length === 0) break;
                  
                  const rec = lista.find((p: any) => p.codigo_sku?.trim() === codigoTrim || p.codigo?.trim() === codigoTrim);
                  if (rec) {
                    produtoRecuperado = rec;
                    console.log(`[buscarOuCriarProduto] Produto recuperado na rota ${rotaBase}. ID: ${rec.id || rec.uuid}`);
                    break;
                  }
                  if (lista.length < 100) break;
                } catch (errRec) {
                  console.warn(`[buscarOuCriarProduto] Erro na recuperacao na rota ${urlBusca}:`, errRec);
                  break;
                }
             }
           }
           
           if (produtoRecuperado) {
             const recId = produtoRecuperado.id || produtoRecuperado.uuid;
             // Se o produto está inativo, a criação da venda com ele pode falhar depois, mas retornamos o ID para reaproveitamento.
             return recId;
           }
        }
        msg = `O produto "${descricao}" tem o código/SKU "${codigo}", que JÁ EXISTE no Conta Azul cadastrado em outro produto, ou está Inativo. Mude o código no Datacar ou no Conta Azul para resolver o conflito.`;
      }
      
      throw new Error(msg)
    }
  } catch (e) {
    // Re-lança erros informativos (como falha na criação)
    if (e instanceof Error) throw e
    console.warn(`[buscarOuCriarProduto] erro ao tentar criar:`, e)
  }
  
  return undefined
}

/**
 * Busca ou cria um Cliente no Conta Azul.
 * Prioriza busca por CPF/CNPJ para evitar duplicatas.
 * @param cpfCnpj - CPF (11 dígitos) ou CNPJ (14 dígitos) sem máscara, ou com máscara (será limpo)
 */
export async function buscarOuCriarCliente(
  accessToken: string,
  nome: string,
  cpfCnpj?: string | null,
  endereco?: {
    logradouro?: string | null
    numero?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
    complemento?: string | null
  }
): Promise<string | undefined> {
  const docLimpo = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : ''
  // CPF = 11 dígitos, CNPJ = 14 dígitos
  const tipoPessoa = docLimpo.length === 14 ? 'Jurídica' : 'Física'

  try {
    // 1. Busca por CPF/CNPJ se disponível (mais preciso, evita duplicatas)
    if (docLimpo) {
      const urlDoc = `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=10&busca=${docLimpo}&tipo_perfil=Cliente`
      try {
        const busca = await fetchCA(urlDoc, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (busca.ok) {
          const data = await busca.json()
          const lista: any[] = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
          if (lista.length > 0) {
            const matchDoc = lista.find(p => {
              const pDoc = (p.cpf || p.cnpj || p.documento || '').replace(/\D/g, '')
              return pDoc === docLimpo
            })
            if (matchDoc) return matchDoc.id || matchDoc.uuid
          }
        }
      } catch (e) { console.warn('[cliente] erro na busca por doc:', e) }
    }

    // 2. Busca por nome
    const endpointsBusca = [
      `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=100&busca=${encodeURIComponent(nome)}&tipo_perfil=Cliente`,
      `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=100&busca=${encodeURIComponent(nome)}`,
    ]
    for (const url of endpointsBusca) {
      try {
        const busca = await fetchCA(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (busca.ok) {
          const data = await busca.json()
          const lista: any[] = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
          if (lista.length > 0) {
            const nomeBusca = nome.toLowerCase().trim()
            const matchExato = lista.find(p => (p.nome || p.name || '').toLowerCase().trim() === nomeBusca)
            if (matchExato) return matchExato.id || matchExato.uuid
          }
        }
      } catch (e) { console.warn(`[cliente] erro na busca em ${url}:`, e) }
    }

    // 3. Criar como Cliente com CPF/CNPJ
    const bodyCliente: Record<string, unknown> = {
      nome,
      tipo_pessoa: tipoPessoa,
      perfis: [{ tipo_perfil: 'Cliente' }],
      ativo: true,
    }
    if (docLimpo) {
      if (tipoPessoa === 'Jurídica') bodyCliente.cnpj = docLimpo
      else bodyCliente.cpf = docLimpo
    }
    if (endereco && (endereco.logradouro || endereco.cidade || endereco.cep)) {
      const endCA: any = {};
      if (endereco.logradouro) endCA.logradouro = endereco.logradouro;
      endCA.numero = endereco.numero || 'S/N';
      if (endereco.complemento) endCA.complemento = endereco.complemento;
      if (endereco.bairro) endCA.bairro = endereco.bairro;
      if (endereco.cidade) endCA.cidade = endereco.cidade;
      if (endereco.estado) endCA.estado = endereco.estado;
      if (endereco.cep) {
        let cepStr = endereco.cep.replace(/\D/g, '');
        if (cepStr.length === 8) {
          cepStr = `${cepStr.substring(0, 5)}-${cepStr.substring(5)}`;
        }
        endCA.cep = cepStr;
      }
      endCA.pais = 'Brasil';
      bodyCliente.enderecos = [endCA];
    }
    const criar = await fetchCA(`${BASE_URL}/pessoas`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyCliente),
    })
    if (criar.ok) { const novo: any = await criar.json(); return novo.id }

    const errTextPrincipal = await criar.text()
    console.error('[buscarOuCriarCliente] Erro POST /pessoas:', criar.status, errTextPrincipal)

    // Se o erro for "já existe pessoa com esse CPF/CNPJ", buscar essa pessoa pelo doc
    if (criar.status === 400 && errTextPrincipal.includes('CPF') && docLimpo) {
      console.log('[buscarOuCriarCliente] CPF/CNPJ duplicado, tentando buscar pessoa existente...')
      // Busca sem filtro de perfil para encontrar qualquer pessoa com esse doc
      const urlBuscaDoc = `${BASE_URL}/pessoas?pagina=1&tamanho_pagina=10&busca=${docLimpo}`
      try {
        const buscaDoc = await fetchCA(urlBuscaDoc, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (buscaDoc.ok) {
          const dataDoc = await buscaDoc.json()
          const listaDoc: any[] = dataDoc.itens || dataDoc.items || dataDoc.content || dataDoc.data || (Array.isArray(dataDoc) ? dataDoc : [])
          if (listaDoc.length > 0) {
            console.log('[buscarOuCriarCliente] Pessoa encontrada por CPF/CNPJ duplicado:', listaDoc[0].id, listaDoc[0].nome)
            return listaDoc[0].id || listaDoc[0].uuid
          }
        }
      } catch (e) { console.warn('[buscarOuCriarCliente] erro ao buscar por doc duplicado:', e) }
    }

    // Se o erro for por CPF inválido, tentar criar sem CPF
    if (criar.status === 400 && (errTextPrincipal.includes('CPF') || errTextPrincipal.includes('CNPJ')) && errTextPrincipal.includes('inválido')) {
      console.log('[buscarOuCriarCliente] CPF/CNPJ inválido, criando sem documento...')
      const bodySemDoc = { nome, tipo_pessoa: tipoPessoa, perfis: [{ tipo_perfil: 'Cliente' }], ativo: true }
      const criarSemDoc = await fetchCA(`${BASE_URL}/pessoas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodySemDoc),
      })
      if (criarSemDoc.ok) { const novo: any = await criarSemDoc.json(); return novo.id }
      const errSemDoc = await criarSemDoc.text()
      console.error('[buscarOuCriarCliente] Erro criar sem doc:', criarSemDoc.status, errSemDoc)
    }

    throw new Error(`Erro ao criar cliente '${nome}': ${criar.status} - ${errTextPrincipal}`)
  } catch (e: any) { console.error(`[buscarOuCriarCliente] erro:`, e); throw e }
}

// =====================================================================
// BUSCA DE VENDAS E NOTAS FISCAIS (para detecção de duplicidade)
// =====================================================================

export interface VendaContaAzul {
  id: string
  id_legado?: number
  numero?: number
  data_venda?: string
  situacao?: { nome?: string; descricao?: string } | string
  valor_total?: number
  // A API v2 retorna o cliente dentro de um objeto separado no GET por id,
  // mas no /venda/busca retorna campos planos: id_cliente, nome_cliente, documento_cliente
  id_cliente?: string
  nome_cliente?: string
  documento_cliente?: string
  // Fallback caso a estrutura mude
  cliente?: {
    uuid?: string
    id?: string
    nome?: string
    documento?: string
    tipo_pessoa?: string
  }
  // Composição de valor (API v2)
  valor_composicao?: {
    valor_bruto?: number
    valor_liquido?: number
    frete?: number
    desconto?: { tipo?: string; valor?: number }
  }
}

export interface NotaFiscalContaAzul {
  id: string
  numero_nota?: string
  status?: string
  data_emissao?: string
}

/**
 * Busca vendas no Conta Azul dentro de um período.
 * Endpoint correto da API v2: GET /v1/venda/busca
 * Parâmetros: data_inicio, data_fim, pagina, tamanho_pagina
 * Ref: https://developers.contaazul.com/ (Sales API)
 */
export async function buscarVendasContaAzul(
  accessToken: string,
  dataInicial: string, // YYYY-MM-DD
  dataFinal: string    // YYYY-MM-DD
): Promise<VendaContaAzul[]> {
  const todas: VendaContaAzul[] = []
  let pagina = 1
  let continuar = true

  while (continuar) {
    try {
      // Endpoint correto conforme documentação oficial: /v1/venda/busca
      const url = `${BASE_URL}/venda/busca?data_inicio=${dataInicial}&data_fim=${dataFinal}&pagina=${pagina}&tamanho_pagina=200`
      console.log(`[buscarVendasCA] Buscando página ${pagina}: ${url}`)
      const res = await fetchCA(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.warn(`[buscarVendasCA] Erro ao buscar vendas página ${pagina}: ${res.status} — ${errBody.substring(0, 300)}`)
        break
      }

      const data = await res.json()
      // A API v2 retorna { totais, quantidades, total_itens, itens: [...] }
      const itens: VendaContaAzul[] = data.itens || data.items || (Array.isArray(data) ? data : [])
      console.log(`[buscarVendasCA] Página ${pagina}: ${itens.length} vendas retornadas`)

      if (itens.length === 0) {
        continuar = false
      } else {
        todas.push(...itens)
        pagina++
        // Se retornou menos que o tamanho da página, é a última
        if (itens.length < 200) continuar = false
        // Segurança: não buscar mais que 20 páginas
        if (pagina > 20) continuar = false
      }
    } catch (e) {
      console.warn('[buscarVendasCA] Erro de rede ao buscar vendas:', e)
      break
    }
  }

  console.log(`[buscarVendasCA] Total: ${todas.length} vendas encontradas no período ${dataInicial} a ${dataFinal}`)
  return todas
}

/**
 * Busca notas fiscais associadas a uma venda específica pelo id da venda.
 * Retorna true se existe pelo menos uma NFe com status EMITIDA.
 */
export async function verificarNfeEmitidaDaVenda(
  accessToken: string,
  vendaId: string
): Promise<{ temNfe: boolean; numeroNota?: string }> {
  try {
    // Precisamos de data_inicial e data_final para a API de notas fiscais
    // Usamos um período amplo para garantir que encontramos a nota
    const url = `${BASE_URL}/notas-fiscais?id_venda=${vendaId}&data_inicial=2020-01-01&data_final=2030-12-31&tamanho_pagina=10`
    const res = await fetchCA(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!res.ok) return { temNfe: false }

    const data = await res.json()
    const itens: NotaFiscalContaAzul[] = data.itens || data.items || []

    if (itens.length > 0) {
      return { temNfe: true, numeroNota: itens[0].numero_nota || undefined }
    }

    return { temNfe: false }
  } catch (e) {
    console.warn(`[verificarNfeEmitidaDaVenda] Erro ao verificar NFe da venda ${vendaId}:`, e)
    return { temNfe: false }
  }
}

/**
 * Obtém as informações da empresa que está atualmente conectada (dona do token)
 * Útil para recuperar CNPJ e Razão Social automaticamente no processo de OAuth.
 */
export async function obterInfoContaConectada(accessToken: string): Promise<{
  id: string
  nome: string
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  email?: string
}> {
  try {
    const res = await fetchCA(`${BASE_URL}/pessoas/conta-conectada`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    
    if (!res.ok) {
      if (res.status === 401) throw new Error('TOKEN_EXPIRADO')
      const errText = await res.text()
      throw new Error(`[${res.status}] ${errText}`)
    }

    const data = await res.json()
    // O Conta Azul pode retornar os dados em vários formatos dependendo da API
    // Retornamos os campos mapeados de forma segura
    return {
      id: data.id || data.uuid || '0',
      nome: data.nome || data.nome_fantasia || data.razao_social || 'Empresa Conta Azul',
      cnpj: data.cnpj || data.cpf || data.documento,
      razao_social: data.razao_social || data.nome,
      nome_fantasia: data.nome_fantasia || data.nome,
      email: data.email
    }
  } catch (e) {
    console.warn(`[obterInfoContaConectada] Erro:`, e)
    throw e
  }
}
export interface ContaPagarResumo {
  id: string;
  data_vencimento: string;
  valor: number;
  status: string;
  fornecedor_id?: string;
  descricao?: string;
}

export async function buscarContasPagarPorPeriodo(
  accessToken: string,
  dtIni: string,
  dtFim: string
): Promise<ContaPagarResumo[]> {
  const todasContas: ContaPagarResumo[] = [];
  const endpoint = `${BASE_URL}/financeiro/eventos-financeiros/contas-a-pagar/buscar`;
  
  try {
    for (let page = 1; page <= 50; page++) {
      const url = `${endpoint}?pagina=${page}&tamanho_pagina=100&data_vencimento_de=${dtIni}&data_vencimento_ate=${dtFim}`;
      
      const res = await fetchCA(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error('TOKEN_EXPIRADO');
        console.warn(`[buscarContasPagar] erro ${res.status}:`, await res.text());
        break;
      }
      
      const data = await res.json();
      const lista: any[] = data.itens || data.items || [];
      
      if (lista.length === 0) break;
      
      for (const item of lista) {
        // A API v2 retorna a parcela. O valor total da parcela pode estar em valor_total_liquido
        // ou ser a soma de valor_pago + nao_pago.
        let valorDaConta = 0;
        if (typeof item.valor === 'number') valorDaConta = item.valor;
        else if (typeof item.valor_total_liquido === 'number') valorDaConta = item.valor_total_liquido;
        else if (typeof item.valor_pago === 'number' || typeof item.nao_pago === 'number') {
           valorDaConta = (item.valor_pago || 0) + (item.nao_pago || 0);
        } else if (item.evento && typeof item.evento.valor === 'number') {
           valorDaConta = item.evento.valor;
        }

        // Tentar obter o fornecedor de várias formas (evento.fornecedor, evento.contato, etc)
        let fornecedorNome = item.descricao || item.observacao || '';
        if (item.evento) {
           const contato = item.evento.contato || item.evento.fornecedor || item.evento.cliente;
           if (contato && contato.nome) fornecedorNome = contato.nome;
        }

        todasContas.push({
          id: item.id || item.uuid,
          data_vencimento: item.data_vencimento || item.vencimento,
          valor: valorDaConta,
          status: item.status || 'DESCONHECIDO',
          fornecedor_id: item.fornecedor?.id || item.contato?.id || item.evento?.contato?.id,
          descricao: fornecedorNome,
        });
      }
      
      if (lista.length < 100) break;
    }
  } catch (e: any) {
    if (e.message === 'TOKEN_EXPIRADO') throw e;
    console.error(`[buscarContasPagarPorPeriodo] Erro fatal:`, e);
  }
  
  return todasContas;
}
