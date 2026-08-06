'use client'

import { useAppConfig } from '@/contexts/AppConfigContext'

export default function Header() {
  const { config, accentClasses } = useAppConfig()

  return (
    <header className="h-16 bg-dark-900 border-b border-dark-700 flex items-center justify-end px-6 flex-shrink-0">
      {/* Logo/nome do app — canto direito */}
      <div className="flex items-center gap-2 px-3 py-2">
        {config.appLogoUrl ? (
          <img src={config.appLogoUrl} alt={config.appNome} className="h-9 max-w-[140px] object-contain mix-blend-screen opacity-95 hover:opacity-100 transition-opacity" />
        ) : (
          <span className={`text-sm font-bold ${accentClasses.text}`}>{config.appNome}</span>
        )}
      </div>
    </header>
  )
}
