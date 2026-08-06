import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split(/[-/]/)
  if (parts.length !== 3) return dateStr
  // Se vier no formato YYYY-MM-DD
  if (parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  // Se vier no formato DD/MM/YYYY ou DD-MM-YYYY
  return `${parts[0]}/${parts[1]}/${parts[2]}`
}

export function parseDate(dateStr: string): string {
  if (!dateStr) return ''
  const str = String(dateStr).trim()

  // Tenta DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
  }

  // Tenta YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) return str

  // Tenta número serial do Excel
  const serial = parseFloat(str)
  if (!isNaN(serial) && serial > 40000) {
    const date = new Date((serial - 25569) * 86400 * 1000)
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return str
}

export function parseCurrency(value: string | number): number {
  if (typeof value === 'number') return value
  const str = String(value).trim()

  // Se não tem vírgula e tem ponto, pode ser o formato internacional/JS (decimal ponto)
  // Ex: "774.12" ou "1234.5"
  if (!str.includes(',') && str.includes('.')) {
    const parts = str.split('.')
    // Se tem apenas um ponto e ele está no final (1 ou 2 casas), tratamos como decimal
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      return parseFloat(str.replace(/[^\d.]/g, '')) || 0
    }
  }

  // Caso contrário, tratamos como formato brasileiro (ponto = milhar, vírgula = decimal)
  const cleaned = str
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  return parseFloat(cleaned) || 0
}


export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
