/**
 * Cliente HTTP para comunicação com a API do Datacar
 * Base URL: https://datalog.com.br/datacarapi
 * 
 * Todos os endpoints usam autenticação via query params:
 * - token: Token da empresa fornecido pela Datalog
 * - codEmp: Código da empresa
 * - idOperador: ID do operador
 */

const DATACAR_BASE_URL = 'https://datalog.com.br/datacarapi'

export interface DatacarCredentials {
  token: string
  codEmp: string
  idOperador: string
}

export interface DatacarContaPagar {
  seq: number
  codEmp: string | null
  siglaEmp: string | null
  numNF: string | null
  modeloNF: string | null
  serieNF: string | null
  parcela: string | null
  cnpjEmit: string | null
  nomeEmit: string | null
  vlParc: number
  vlDesc: number
  vlJuros: number
  dtEmis: string | null
  dtVenc: string | null
  dtPgto: string | null
  dtDigit: string | null
  doc: string | null
  obs: string | null
  localPgto: string | null
  bancoPgto: string | null
  grupoDesp: string | null
  subgrupoDesp: string | null
  grupoDRE: string | null
}

export interface DatacarProdutoOS {
  codigo: string | null
  descricao: string | null
  quantidade: number
  valorUnitario: number
  valorTotal: number
  [key: string]: unknown
}

export interface DatacarServicoOS {
  codigo: string | null
  descricao: string | null
  quantidade: number
  valorUnitario: number
  valorTotal: number
  [key: string]: unknown
}

export interface DatacarRecebimentoOS {
  [key: string]: unknown
}

export interface DatacarOSPedido {
  seq: number
  venda_Id: number
  venda_Numero: number
  empresa_sigla: string | null
  venda_DtCriacao: string | null
  venda_DtConclusao: string | null
  venda_DtEncerramento: string | null
  venda_DtCancelamento: string | null
  venda_Setor: string | null
  venda_Parcelamento: string | null
  venda_qtParcelas: string | null
  venda_Obs: string | null
  cliente_Cpf_Cnpj: string | null
  cliente_Nome: string | null
  cliente_RazaoSocial: string | null
  cliente_Fone1: string | null
  cliente_Fone2: string | null
  cliente_Fone3: string | null
  cliente_Email: string | null
  cliente_Logradouro?: string | null
  cliente_Endereco?: string | null
  cliente_Numero?: string | null
  cliente_Complemento?: string | null
  cliente_Bairro?: string | null
  cliente_Cidade?: string | null
  cliente_Municipio?: string | null
  cliente_Uf?: string | null
  cliente_Estado?: string | null
  cliente_UF?: string | null
  cliente_Cep?: string | null
  cliente_CEP?: string | null
  end_Rua?: string | null
  end_Numero?: string | null
  end_Bairro?: string | null
  end_Cidade?: string | null
  end_Uf?: string | null
  end_Cep?: string | null
  end_Complemento?: string | null
  vendedor_Nome: string | null
  veiculo_Placa: string | null
  veiculo_Marca: string | null
  veiculo_Modelo: string | null
  veiculo_AnoFabric: string | null
  veiculo_AnoModelo: string | null
  frete_Valor: number
  produtos: DatacarProdutoOS[]
  servicos: DatacarServicoOS[]
  recebimentos: DatacarRecebimentoOS[]
}

// ========== Funções de consulta ==========

async function fetchDatacar<T>(endpoint: string, credentials: DatacarCredentials, extraParams: Record<string, string> = {}): Promise<T> {
  const params = new URLSearchParams({
    token: credentials.token,
    codEmp: credentials.codEmp,
    idOperador: credentials.idOperador,
    ...extraParams,
  })

  const url = `${DATACAR_BASE_URL}${endpoint}?${params.toString()}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erro na API Datacar (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Busca contas a pagar do Datacar
 * tipoPeriodo: 'emis' | 'venc' | 'pgto' | 'digit'
 */
export async function buscarContasPagar(
  credentials: DatacarCredentials,
  tipoPeriodo: string,
  dtIni: string,
  dtFim: string,
  noPagina?: string,
): Promise<DatacarContaPagar[]> {
  const extra: Record<string, string> = { tipoPeriodo, dtIni, dtFim }
  if (noPagina) extra.noPagina = noPagina
  return fetchDatacar<DatacarContaPagar[]>('/contaspagar', credentials, extra)
}

/**
 * Busca OS/Pedidos (vendas) do Datacar
 * tipoPeriodo: 'criacao' | 'previsao' | 'conclusao' | 'encerramento' | 'cancelamento'
 */
export async function buscarOSPedidos(
  credentials: DatacarCredentials,
  tipoPeriodo: string,
  dtIni: string,
  dtFim: string,
  noPagina?: string,
): Promise<DatacarOSPedido[]> {
  const extra: Record<string, string> = { tipoPeriodo, dtIni, dtFim }
  if (noPagina) extra.noPagina = noPagina
  return fetchDatacar<DatacarOSPedido[]>('/ospedido', credentials, extra)
}

/**
 * Testa a conexão com o Datacar consultando as empresas
 */
export async function testarConexao(credentials: DatacarCredentials): Promise<{ ok: boolean; mensagem: string; dados?: unknown }> {
  try {
    const data = await fetchDatacar('/empresas', credentials)
    return { ok: true, mensagem: 'Conexão com o Datacar realizada com sucesso!', dados: data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return { ok: false, mensagem: msg }
  }
}

export interface DatacarProdutoResponse {
  codigo: string | null
  descricao: string | null
  precoVenda: number | null
  ncm: string | null
  origem: string | null
  grupo: string | null
  cest?: string | null
  unidade_medida?: string | null
}

export async function buscarProdutos(
  credentials: DatacarCredentials,
  codigo: string,
  noPagina?: string,
): Promise<DatacarProdutoResponse[]> {
  const extra: Record<string, string> = { codigo }
  if (noPagina) extra.noPagina = noPagina
  return fetchDatacar<DatacarProdutoResponse[]>('/produtos', credentials, extra)
}
