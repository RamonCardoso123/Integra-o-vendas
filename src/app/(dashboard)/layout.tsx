import { EmpresaProvider } from '@/contexts/EmpresaContext'
import { AppConfigProvider } from '@/contexts/AppConfigContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import AuthGuard from '@/components/AuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppConfigProvider>
        <EmpresaProvider>
          <div className="flex h-screen bg-dark-950 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6 relative">
                {children}
                {/* Logo duplicado removido para não conflitar com a sidebar */}
                {/* Watermark dev — sutil, canto inferior direito */}
                <span className="fixed bottom-3 right-4 text-[9px] text-dark-800 select-none pointer-events-none z-0">
                  dev: AH Cardoso
                </span>
              </main>
            </div>
          </div>
        </EmpresaProvider>
      </AppConfigProvider>
    </AuthGuard>
  )
}
