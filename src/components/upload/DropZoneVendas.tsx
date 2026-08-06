'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, FileText, Image, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseVendasExcel } from '@/lib/parsers/vendas'
import type { ResultadoImportacaoVendas } from '@/types'
import toast from 'react-hot-toast'

const TIPOS_ACEITOS = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

const TAMANHO_MAXIMO = 20 * 1024 * 1024 // 20 MB

interface Props {
  onResultado: (resultado: ResultadoImportacaoVendas, arquivo: File) => void
  processando?: boolean
}

function IconeArquivo({ tipo }: { tipo?: string }) {
  const t = tipo || ''
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) {
    return <FileSpreadsheet size={32} className="text-green-400" />
  }
  if (t.includes('pdf')) {
    return <FileText size={32} className="text-red-400" />
  }
  return <Image size={32} className="text-blue-400" />
}

export default function DropZoneVendas({ onResultado, processando }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)

  const processarArquivo = useCallback(async (file: File) => {
    setArquivo(file)
    setCarregando(true)
    try {
      const resultado = await parseVendasExcel(file)
      if (resultado.total === 0) {
        toast.error('Nenhum dado encontrado no arquivo. Verifique o formato.')
        setArquivo(null)
        return
      }
      onResultado(resultado, file)
      if (resultado.aviso) {
        toast(resultado.aviso, { icon: '⚠️', duration: 6000 })
      } else {
        toast.success(`${resultado.validos} registros identificados!`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo'
      toast.error(msg)
      setArquivo(null)
    } finally {
      setCarregando(false)
    }
  }, [onResultado])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) processarArquivo(acceptedFiles[0])
  }, [processarArquivo])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: TIPOS_ACEITOS,
    maxSize: TAMANHO_MAXIMO,
    maxFiles: 1,
    disabled: carregando || processando,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0]
      if (err?.code === 'file-too-large') {
        toast.error('Arquivo muito grande. Máximo 20 MB.')
      } else if (err?.code === 'file-invalid-type') {
        toast.error('Formato não aceito. Use: Excel, CSV, PDF ou imagem.')
      } else {
        toast.error('Arquivo inválido.')
      }
    },
  })

  const limpar = () => setArquivo(null)

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : arquivo
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-dark-600 bg-dark-800/50 hover:border-brand-600 hover:bg-brand-600/5',
          (carregando || processando) && 'opacity-60 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        {carregando ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-brand-400 animate-spin" />
            <p className="text-white font-medium">Processando arquivo...</p>
            <p className="text-dark-400 text-sm">Extraindo dados do DataCar</p>
          </div>
        ) : arquivo ? (
          <div className="flex flex-col items-center gap-3">
            <IconeArquivo tipo={arquivo.type} />
            <div>
              <p className="text-white font-medium">{arquivo.name}</p>
              <p className="text-dark-400 text-sm mt-0.5">
                {(arquivo.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <p className="text-green-400 text-sm">✓ Arquivo processado</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
              isDragActive ? 'bg-brand-500/20' : 'bg-dark-700'
            )}>
              <Upload size={28} className={cn(isDragActive ? 'text-brand-400' : 'text-dark-400')} />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo DataCar'}
              </p>
              <p className="text-dark-400 text-sm mt-1">
                ou <span className="text-brand-400 font-medium">clique para selecionar</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              {['Excel .xlsx', 'CSV .csv', 'PDF .pdf', 'Imagem .png/.jpg'].map((fmt) => (
                <span key={fmt} className="text-xs bg-dark-700 text-dark-400 px-2.5 py-1 rounded-full">
                  {fmt}
                </span>
              ))}
            </div>
            <p className="text-dark-500 text-xs">Tamanho máximo: 20 MB</p>
          </div>
        )}
      </div>

      {arquivo && !carregando && (
        <button
          onClick={limpar}
          className="flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors"
        >
          <X size={14} /> Remover e carregar outro arquivo
        </button>
      )}
    </div>
  )
}
