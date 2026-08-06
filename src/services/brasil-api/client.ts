export interface BrasilApiCnpjResponse {
  cnpj: string
  identificador_matriz_filial: number
  descricao_matriz_filial: string
  razao_social: string
  nome_fantasia: string
  situacao_cadastral: number
  descricao_situacao_cadastral: string
  data_situacao_cadastral: string
  motivo_situacao_cadastral: number
  nome_cidade_no_exterior: string
  codigo_natureza_juridica: number
  data_inicio_atividade: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  descricao_tipo_de_logradouro: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  uf: string
  codigo_municipio: number
  municipio: string
  ddd_telefone_1: string
  ddd_telefone_2: string
  ddd_fax: string
  qualificacao_do_responsavel: number
  capital_social: number
  porte: number
  descricao_porte: string
  opcao_pelo_simples: boolean
  data_opcao_pelo_simples: string | null
  data_exclusao_do_simples: string | null
  opcao_pelo_mei: boolean
  situacao_especial: string | null
  data_situacao_especial: string | null
}

export interface BrasilApiCepResponse {
  cep: string
  state: string
  city: string
  neighborhood: string
  street: string
  service: string
}

export async function buscarCnpj(cnpj: string): Promise<BrasilApiCnpjResponse | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  if (cnpjLimpo.length !== 14) return null

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.warn(`Erro ao buscar CNPJ ${cnpjLimpo} na Brasil API:`, error)
    return null
  }
}

export async function buscarCep(cep: string): Promise<BrasilApiCepResponse | null> {
  const cepLimpo = cep.replace(/\D/g, '')
  if (cepLimpo.length !== 8) return null

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`)
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.warn(`Erro ao buscar CEP ${cepLimpo} na Brasil API:`, error)
    return null
  }
}

export interface EnderecoDatacar {
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  complemento?: string | null
}

/**
 * Enriquecer o endereço do Datacar usando dados da Brasil API.
 * Preserva o número e o complemento originais do Datacar,
 * pois a busca por CEP não fornece esses dados específicos da residência.
 */
export async function enriquecerEndereco(
  enderecoBase: EnderecoDatacar,
  dadosCnpj?: BrasilApiCnpjResponse | null
): Promise<EnderecoDatacar> {
  // Se já temos dados completos do CNPJ (que inclui endereço preciso), usamos eles
  if (dadosCnpj && dadosCnpj.logradouro) {
    return {
      logradouro: dadosCnpj.logradouro || enderecoBase.logradouro,
      numero: enderecoBase.numero || dadosCnpj.numero, // Prioriza o número que já tínhamos se existir
      bairro: dadosCnpj.bairro || enderecoBase.bairro,
      cidade: dadosCnpj.municipio || enderecoBase.cidade,
      estado: dadosCnpj.uf || enderecoBase.estado,
      cep: dadosCnpj.cep || enderecoBase.cep,
      complemento: enderecoBase.complemento || dadosCnpj.complemento
    }
  }

  // Se não temos dados do CNPJ, mas temos um CEP, tentamos enriquecer pelo CEP
  if (enderecoBase.cep) {
    const dadosCep = await buscarCep(enderecoBase.cep)
    if (dadosCep) {
      return {
        logradouro: dadosCep.street || enderecoBase.logradouro,
        numero: enderecoBase.numero, // CEP nunca retorna número
        bairro: dadosCep.neighborhood || enderecoBase.bairro,
        cidade: dadosCep.city || enderecoBase.cidade,
        estado: dadosCep.state || enderecoBase.estado,
        cep: dadosCep.cep || enderecoBase.cep,
        complemento: enderecoBase.complemento // CEP nunca retorna complemento
      }
    }
  }

  // Se nada funcionou, retorna o original
  return enderecoBase
}
