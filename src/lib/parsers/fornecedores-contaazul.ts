/**
 * Parser do CSV de fornecedores exportado do ContaAzul
 * Formato: colunas separadas por ; dentro de cada linha
 * Colunas usadas: Nome, CNPJ
 */

export interface FornecedorContaAzul {
  nome: string
  cnpj: string
  categoria?: string
  nomeNormalizado: string
}

/**
 * Normaliza nome para comparação: uppercase, sem pontuação, sem espaços duplos
 */
export function normalizarNome(nome: string): string {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^A-Z0-9\s]/g, ' ')   // remove pontuação
    .replace(/\s+/g, ' ')            // colapsa espaços
    .trim()
}

/**
 * Lê o CSV de fornecedores do ContaAzul e retorna lista normalizada
 */
export function parseFornecedoresCSV(csvText: string): FornecedorContaAzul[] {
  const linhas = csvText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (linhas.length < 2) return []

  // Cabeçalho: detectar índices de Nome, CNPJ e Categoria
  const cabecalho = linhas[0].split(';').map((c) => c.replace(/"/g, '').trim().toUpperCase())
  const idxNome = cabecalho.findIndex((c) => c === 'NOME')
  const idxCNPJ = cabecalho.findIndex((c) => c.includes('CNPJ'))
  const idxCategoria = cabecalho.findIndex((c) => c.includes('CATEGORIA'))

  if (idxNome < 0) return []

  const fornecedores: FornecedorContaAzul[] = []

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(';').map((c) => c.replace(/^"|"$/g, '').trim())
    const nome = cols[idxNome] || ''
    const cnpj = idxCNPJ >= 0 ? (cols[idxCNPJ] || '').replace(/\D/g, '') : ''
    const categoria = idxCategoria >= 0 ? (cols[idxCategoria] || '') : ''

    if (!nome) continue

    fornecedores.push({
      nome,
      cnpj,
      categoria,
      nomeNormalizado: normalizarNome(nome),
    })
  }

  return fornecedores
}

/**
 * Lê arquivo CSV via File API (browser)
 */
export async function parseFornecedoresArquivo(file: File): Promise<FornecedorContaAzul[]> {
  const text = await file.text()
  return parseFornecedoresCSV(text)
}
