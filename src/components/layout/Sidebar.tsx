'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle,
  Building2, Settings, ChevronRight, User, LogOut, ShoppingCart, Database, FileKey2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppConfig } from '@/contexts/AppConfigContext'
import { createClient } from '@/lib/supabase/client'
import ModalPerfil from './ModalPerfil'
import toast from 'react-hot-toast'

type NavItem = { label: string; href: string; icon: any; badge?: string; disabled?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Vendas Produtos', href: '/vendas', icon: ShoppingCart },
  { label: 'Vendas Serviços', href: '/vendas-servicos', icon: ShoppingCart, badge: 'NOVO' },
  { label: 'Notas Emitidas', href: '/notas-emitidas', icon: Database, badge: 'NOVO' },
  { label: 'Empresas', href: '/empresas', icon: Building2 },
  { label: 'Config. Fiscal', href: '/config-fiscal', icon: FileKey2, badge: 'NOVO' },
  { label: 'Configuracoes', href: '/configuracoes', icon: Settings, disabled: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { config, accentClasses } = useAppConfig()
  const [modalPerfil, setModalPerfil] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Saindo...')
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col">

        {/* Logo do app — integrado ao fundo */}
        <div className="p-4 flex flex-col items-center justify-center gap-4 min-h-[120px] border-b border-dark-700/50 mb-2">
          {/* Logo Dinheiro em Caixa - Grande */}
          <img 
            src="/images/dinheiro-em-caixa-logo.png" 
            alt="Dinheiro em Caixa" 
            className="w-full max-w-[180px] h-auto object-contain drop-shadow-md" 
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                  isActive ? `${accentClasses.bg} text-white shadow-md` : 'text-dark-400 hover:text-white hover:bg-dark-800',
                  item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                )}
              >
                <Icon size={18} className={cn(isActive ? 'text-white' : 'text-dark-400 group-hover:text-white')} />
                <span className="flex-1">{item.label}</span>
                {item.badge && !item.disabled && (
                  <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full font-semibold tracking-wider">{item.badge}</span>
                )}
                {item.badge && item.disabled && (
                  <span className="text-[10px] bg-dark-700 text-dark-500 px-1.5 py-0.5 rounded-full font-semibold">{item.badge}</span>
                )}
                {isActive && !item.disabled && <ChevronRight size={14} className="text-white/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer — perfil + sair */}
        <div className="p-4 border-t border-dark-700 space-y-2">
          <button
            onClick={() => setModalPerfil(true)}
            className="w-full flex items-center gap-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-dark-600 rounded-xl px-3 py-3 transition-all text-left group"
          >
            <div className={`w-8 h-8 ${accentClasses.bg}/20 border ${accentClasses.border}/40 rounded-full flex items-center justify-center flex-shrink-0`}>
              <User size={14} className={accentClasses.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{userEmail || '...'}</p>
              <p className="text-[10px] text-dark-500">Conta ativa</p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all group"
          >
            <LogOut size={16} className="text-dark-400 group-hover:text-rose-400 transition-colors" />
            <span>Sair do sistema</span>
          </button>

          {/* Logo Connecta AI no rodapé */}
          <div className="pt-4 border-t border-dark-700/50 flex flex-col items-center mt-2">
            {config.appLogoUrl ? (
              <img src={config.appLogoUrl} alt={config.appNome} className="h-8 max-w-[120px] object-contain mix-blend-screen opacity-70 hover:opacity-100 transition-opacity" />
            ) : (
              <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                <div className={`w-7 h-7 ${accentClasses.bg} rounded-lg flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <span className="text-white font-black text-sm">{config.appNome.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-xs leading-tight">{config.appNome}</p>
                  <p className="text-dark-500 text-[8px] uppercase tracking-wider">Inteligencia Financeira</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[9px] text-dark-800 text-center mt-2 select-none">dev: AH Cardoso</p>
        </div>
      </aside>

      <ModalPerfil
        open={modalPerfil}
        onClose={() => setModalPerfil(false)}
        userEmail={userEmail}
      />
    </>
  )
}
