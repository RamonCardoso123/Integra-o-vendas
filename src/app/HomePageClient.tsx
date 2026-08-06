'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, Loader2, X } from 'lucide-react'

export default function HomePageClient() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [modoRegistro, setModoRegistro] = useState(false)
  const [mostrarCard, setMostrarCard] = useState(false)
  const supabase = createClient()

  const fazerLogin = async (emailVal: string, senhaVal: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailVal,
      password: senhaVal,
    })
    if (error) throw error

    // Aguarda o supabase/ssr gravar os cookies no browser
    await new Promise(r => setTimeout(r, 1000))

    // Verifica via API se os cookies chegaram ao servidor
    const check = await fetch('/api/auth/check')
    const { authenticated } = await check.json()

    if (authenticated) {
      window.location.replace('/dashboard')
    } else {
      // Fallback: tenta mais uma vez com delay maior
      await new Promise(r => setTimeout(r, 1500))
      window.location.replace('/dashboard')
    }

    return data
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    try {
      if (modoRegistro) {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        toast.success('Conta criada! Fazendo login...')
        await fazerLogin(email, senha)
      } else {
        await fazerLogin(email, senha)
        toast.success('Bem-vindo!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      if (msg.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos')
      } else if (msg.includes('Email not confirmed')) {
        toast.error('Confirme seu e-mail antes de entrar')
      } else {
        toast.error(msg)
      }
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>

      {/* ambient background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(900px 600px at 78% -8%,rgba(91,108,255,.18),transparent 60%),radial-gradient(700px 500px at 12% 8%,rgba(34,211,238,.10),transparent 55%)', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 27% 62%,#cfd6ff,transparent),radial-gradient(1.5px 1.5px at 44% 28%,#fff,transparent),radial-gradient(1px 1px at 63% 72%,#bfe9ff,transparent),radial-gradient(1px 1px at 79% 22%,#fff,transparent),radial-gradient(1.5px 1.5px at 88% 58%,#fff,transparent),radial-gradient(1px 1px at 52% 88%,#cfd6ff,transparent),radial-gradient(1px 1px at 33% 8%,#fff,transparent)', animation: 'twinkle 4s ease-in-out infinite' }}></div>
      <div style={{ position: 'absolute', left: '50%', bottom: '-62vw', transform: 'translateX(-50%)', width: '130vw', height: '130vw', borderRadius: '50%', background: 'radial-gradient(circle at 50% 30%,rgba(34,52,120,.55),rgba(10,16,38,.2) 42%,transparent 60%)', borderTop: '1px solid rgba(120,150,255,.18)', animation: 'riseGlow 8s ease-in-out infinite', zIndex: 0, pointerEvents: 'none' }}></div>

      {/* NAV */}
      <nav style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', maxWidth: '1200px', margin: '0 auto', padding: '22px 32px' }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'linear-gradient(135deg,var(--accent-a),var(--accent-b))', display: 'grid', placeItems: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#06080f', fontSize: '15px' }}>C</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '.14em', fontSize: '15px' }}>CONNECTA<span style={{ color: 'var(--accent-b)' }}> AI</span></span>
        </a>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14.5px', color: 'var(--muted)' }}>
          <a href="#como" className="nav-link">Como funciona</a>
          <a href="#integracoes" className="nav-link">Integrações</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setMostrarCard(true)} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--bd)', fontSize: '14px', fontWeight: 600, color: '#e8ecf5' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
            Login
          </button>
        </div>
      </nav>

      {/* HERO */}
      <header id="top" style={{ position: 'relative', zIndex: 4, maxWidth: '1040px', margin: '0 auto', padding: '64px 32px 30px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 15px', borderRadius: '999px', border: '1px solid var(--bd)', background: 'var(--panel)', fontSize: '12.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-b)', boxShadow: '0 0 8px var(--accent-b)' }}></span>
          BPO Financeiro · Automação Inteligente
        </div>

        <div style={{ margin: '34px 0 6px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(40px,8vw,86px)', letterSpacing: '.06em', lineHeight: 1, color: '#fff', textShadow: '0 0 38px rgba(120,140,255,.55),0 0 90px rgba(34,211,238,.25)' }}>CONNECTA AI</div>

        <h1 style={{ margin: '24px auto 0', maxWidth: '760px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 'clamp(26px,4.4vw,46px)', lineHeight: 1.1, letterSpacing: '-.01em', color: '#fff', textWrap: 'balance' }}>Do Datacar ao Conta Azul,<br/>seus lançamentos em <span style={{ background: 'linear-gradient(120deg,var(--accent-a),var(--accent-b))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>um clique</span>.</h1>

        <p style={{ margin: '20px auto 0', maxWidth: '600px', fontSize: 'clamp(15px,2.2vw,18px)', lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' }}>O CONNECTA AI busca contas a pagar, contas a receber e vendas no seu sistema, deixa você conferir tudo, e lança no Conta Azul automaticamente. Sem digitação, sem retrabalho.</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center', marginTop: '34px' }}>
          <a href="#contato" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '15px 26px', borderRadius: '12px', background: 'linear-gradient(135deg,var(--accent-a),var(--accent-b))', color: '#06080f', fontWeight: 700, fontSize: '15.5px', boxShadow: '0 10px 34px -10px rgba(34,197,94,.7)' }}>
            Agendar demonstração
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </a>
          <button onClick={() => setMostrarCard(true)} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 26px', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--panel)', color: '#e8ecf5', fontWeight: 600, fontSize: '15.5px' }}>
            Entrar na minha conta
          </button>
        </div>

        {/* FLOW STRIP */}
        <div className="flow" style={{ margin: '62px auto 0', maxWidth: '880px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'nowrap' }}>
          <div style={{ flex: 1, minWidth: '120px', animation: 'floaty 6s ease-in-out infinite' }}>
            <div style={{ border: '1px solid var(--bd)', background: 'rgba(13,18,34,.7)', backdropFilter: 'blur(8px)', borderRadius: '16px', padding: '18px 14px', textAlign: 'center' }}>
              <div style={{ width: '42px', height: '42px', margin: '0 auto 10px', borderRadius: '11px', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', border: '1px solid var(--bd)' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#9aa3bd" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M12 18v2"/><path d="M7 9h6M7 13h10"/></svg>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#fff' }}>Datacar</div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>Sistema de origem</div>
            </div>
          </div>

          <div className="flow-line" style={{ flex: .9, minWidth: '90px', position: 'relative', height: '2px', background: 'linear-gradient(90deg,transparent,rgba(120,140,255,.5),transparent)', margin: '0 -6px' }}>
            <div style={{ position: 'absolute', top: '-9px', left: 0, fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', width: '100%', textAlign: 'center', transform: 'translateY(-12px)' }}>extrai</div>
            <span style={{ position: 'absolute', top: '-2.5px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-b)', boxShadow: '0 0 10px var(--accent-b)', animation: 'flowDot 2.6s linear infinite' }}></span>
          </div>

          <div style={{ flex: 1.05, minWidth: '130px', position: 'relative', zIndex: 2 }}>
            <div style={{ border: '1px solid rgba(120,140,255,.45)', background: 'linear-gradient(160deg,rgba(30,40,90,.85),rgba(13,18,34,.85))', backdropFilter: 'blur(8px)', borderRadius: '18px', padding: '20px 14px', textAlign: 'center', animation: 'corePulse 3.6s ease-in-out infinite' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 11px', borderRadius: '14px', background: 'linear-gradient(135deg,var(--accent-a),var(--accent-b))', display: 'grid', placeItems: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: '#06080f' }}>C</div>
              <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#fff' }}>CONNECTA AI</div>
              <div style={{ fontSize: '11.5px', color: '#bfe9ff', marginTop: '2px' }}>Confere & valida</div>
            </div>
          </div>

          <div className="flow-line" style={{ flex: .9, minWidth: '90px', position: 'relative', height: '2px', background: 'linear-gradient(90deg,transparent,rgba(34,211,238,.5),transparent)', margin: '0 -6px' }}>
            <div style={{ position: 'absolute', top: '-9px', left: 0, fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', width: '100%', textAlign: 'center', transform: 'translateY(-12px)' }}>importa</div>
            <span style={{ position: 'absolute', top: '-2.5px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-b)', boxShadow: '0 0 10px var(--accent-b)', animation: 'flowDot 2.6s linear infinite', animationDelay: '1.3s' }}></span>
          </div>

          <div style={{ flex: 1, minWidth: '120px', animation: 'floaty 6s ease-in-out infinite', animationDelay: '1s' }}>
            <div style={{ border: '1px solid var(--bd)', background: 'rgba(13,18,34,.7)', backdropFilter: 'blur(8px)', borderRadius: '16px', padding: '18px 14px', textAlign: 'center' }}>
              <div style={{ width: '42px', height: '42px', margin: '0 auto 10px', borderRadius: '11px', background: 'rgba(56,189,248,.12)', display: 'grid', placeItems: 'center', border: '1px solid rgba(56,189,248,.3)' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#56c8f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/></svg>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#fff' }}>Conta Azul</div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>Sistema de destino</div>
            </div>
          </div>
        </div>
      </header>

      {/* COMO FUNCIONA */}
      <section id="como" style={{ position: 'relative', zIndex: 4, maxWidth: '1120px', margin: '0 auto', padding: '96px 32px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '12.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent-b)', marginBottom: '12px' }}>Como funciona</div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 'clamp(26px,4vw,40px)', color: '#fff', letterSpacing: '-.01em' }}>Três passos. Zero digitação.</h2>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
          <div style={{ border: '1px solid var(--bd)', background: 'var(--panel)', borderRadius: '18px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'rgba(91,108,255,.14)', border: '1px solid rgba(91,108,255,.3)', display: 'grid', placeItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9fb0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-4.3-4.3"/><circle cx="11" cy="11" r="7"/></svg></div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '38px', color: 'rgba(255,255,255,.1)' }}>01</span>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '19px', color: '#fff', marginBottom: '8px' }}>Conecta & busca</h3>
            <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)' }}>O CONNECTA AI acessa o Datacar e extrai automaticamente as contas a pagar, contas a receber e vendas do período.</p>
          </div>
          <div style={{ border: '1px solid var(--bd)', background: 'var(--panel)', borderRadius: '18px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'rgba(34,211,238,.12)', border: '1px solid rgba(34,211,238,.3)', display: 'grid', placeItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7fe3f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '38px', color: 'rgba(255,255,255,.1)' }}>02</span>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '19px', color: '#fff', marginBottom: '8px' }}>Confere no painel</h3>
            <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)' }}>Tudo aparece organizado no seu painel. Você revisa e valida se os lançamentos estão corretos antes de enviar.</p>
          </div>
          <div style={{ border: '1px solid var(--bd)', background: 'var(--panel)', borderRadius: '18px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)', display: 'grid', placeItems: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#56c8f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg></div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '38px', color: 'rgba(255,255,255,.1)' }}>03</span>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '19px', color: '#fff', marginBottom: '8px' }}>Importa com um clique</h3>
            <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: 'var(--muted)' }}>Clica em "Importar para o Conta Azul" e pronto: todos os lançamentos vão para o destino, prontos e conferidos.</p>
          </div>
        </div>
      </section>

      {/* INTEGRACOES */}
      <section id="integracoes" style={{ position: 'relative', zIndex: 4, maxWidth: '1120px', margin: '0 auto', padding: '96px 32px 0' }}>
        <div className="integ" style={{ border: '1px solid var(--bd)', background: 'linear-gradient(160deg,rgba(16,22,42,.7),rgba(10,14,28,.5))', borderRadius: '24px', padding: 'clamp(28px,5vw,56px)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent-b)', marginBottom: '12px' }}>Integrações</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 'clamp(24px,3.4vw,34px)', color: '#fff', letterSpacing: '-.01em', marginBottom: '14px' }}>Datacar e Conta Azul, conectados de verdade.</h2>
            <p style={{ fontSize: '15px', lineHeight: 1.65, color: 'var(--muted)', marginBottom: '22px' }}>A ponte entre o seu sistema de gestão e o seu financeiro. Hoje conectamos Datacar ao Conta Azul — e estamos abrindo novas integrações.</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--bd)', background: 'var(--panel)', fontSize: '13px', color: 'var(--muted)' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-b)', boxShadow: '0 0 8px var(--accent-b)' }}></span>
              Novas integrações em breve
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: '22px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--bd)', display: 'grid', placeItems: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9aa3bd" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M12 18v2M7 9h6M7 13h10"/></svg></div>
              <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>Datacar</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', color: 'var(--accent-b)' }}>
              <svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 9h28M24 3l6 6-6 6"/></svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: '22px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.28)', display: 'grid', placeItems: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#56c8f5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/></svg></div>
              <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>Conta Azul</div>
            </div>
          </div>
        </div>
      </section>



      {/* FOOTER */}
      <footer style={{ position: 'relative', zIndex: 4, maxWidth: '1120px', margin: '0 auto', padding: '80px 32px 48px' }}>
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '32px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,var(--accent-a),var(--accent-b))', display: 'grid', placeItems: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#06080f', fontSize: '14px' }}>C</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '.12em', fontSize: '14px' }}>CONNECTA<span style={{ color: 'var(--accent-b)' }}> AI</span></span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>BPO Financeiro · Automação Inteligente · Gestão Eficiente</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>© 2026 CONNECTA AI</div>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {mostrarCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md animate-fade-in z-20">
            <button 
              onClick={() => setMostrarCard(false)}
              className="absolute -top-4 -right-4 p-2 bg-dark-800 text-dark-300 hover:text-white rounded-full border border-dark-700 shadow-xl transition-colors z-50"
            >
              <X size={20} />
            </button>
            <div className="text-center mb-8">
              <div className="flex flex-col items-center justify-center gap-4 mb-4">
                {/* Logo Dinheiro em Caixa */}
                <img 
                  src="/images/dinheiro-em-caixa-logo.png" 
                  alt="Dinheiro em Caixa" 
                  className="h-16 w-auto object-contain drop-shadow-md" 
                />
                
                {/* Separador */}
                <div className="w-16 h-px bg-dark-700/50"></div>

                {/* Logo Connecta AI */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl shadow-lg shadow-green-900/50">
                  <span className="text-2xl font-bold text-white">$</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">Connecta AI</h1>
              <p className="text-dark-400 mt-1 text-sm">Inteligência Artificial para BPO Financeiro</p>
            </div>

            <div className="bg-dark-800 rounded-2xl border border-dark-700 p-8 shadow-2xl relative">
              <h2 className="text-xl font-semibold text-white mb-6">
                {modoRegistro ? 'Criar conta' : 'Entrar no sistema'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com.br"
                    required
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Senha</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                    >
                      {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-green-900/30 mt-2"
                >
                  {carregando ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                  {modoRegistro ? 'Criar conta' : 'Entrar'}
                </button>
              </form>

              <p className="text-center text-sm text-dark-400 mt-6">
                {modoRegistro ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
                <button
                  onClick={() => setModoRegistro(!modoRegistro)}
                  className="text-green-400 hover:text-green-300 font-medium transition-colors"
                >
                  {modoRegistro ? 'Fazer login' : 'Criar conta'}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
