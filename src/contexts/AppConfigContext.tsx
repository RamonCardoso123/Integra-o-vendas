'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type AccentColor = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan'

export interface AppConfig {
  accentColor: AccentColor
  appLogoUrl: string | null
  appNome: string
  darkMode: boolean
}

const DEFAULT: AppConfig = {
  accentColor: 'violet',
  appLogoUrl: null,
  appNome: 'Connecta AI',
  darkMode: true,
}

const STORAGE_KEY = 'connecta_app_config'

function load(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch { /* empty */ }
  return DEFAULT
}

function save(cfg: AppConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

const ACCENT_CLASSES: Record<AccentColor, { bg: string; text: string; border: string; ring: string }> = {
  violet: { bg: 'bg-violet-600', text: 'text-violet-400', border: 'border-violet-600', ring: 'ring-violet-500' },
  blue:   { bg: 'bg-blue-600',   text: 'text-blue-400',   border: 'border-blue-600',   ring: 'ring-blue-500' },
  emerald:{ bg: 'bg-emerald-600',text: 'text-emerald-400',border: 'border-emerald-600',ring: 'ring-emerald-500' },
  rose:   { bg: 'bg-rose-600',   text: 'text-rose-400',   border: 'border-rose-600',   ring: 'ring-rose-500' },
  amber:  { bg: 'bg-amber-500',  text: 'text-amber-400',  border: 'border-amber-500',  ring: 'ring-amber-400' },
  cyan:   { bg: 'bg-cyan-600',   text: 'text-cyan-400',   border: 'border-cyan-600',   ring: 'ring-cyan-500' },
}

interface AppConfigCtx {
  config: AppConfig
  accentClasses: typeof ACCENT_CLASSES[AccentColor]
  update: (partial: Partial<AppConfig>) => void
  ACCENT_CLASSES: typeof ACCENT_CLASSES
}

const Ctx = createContext<AppConfigCtx | null>(null)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(load)

  useEffect(() => {
    // aplica classe dark no html
    if (config.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [config.darkMode])

  const update = (partial: Partial<AppConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial }
      save(next)
      window.dispatchEvent(new Event('app-config-updated'))
      return next
    })
  }

  return (
    <Ctx.Provider value={{ config, accentClasses: ACCENT_CLASSES[config.accentColor], update, ACCENT_CLASSES }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAppConfig() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppConfig must be inside AppConfigProvider')
  return ctx
}
