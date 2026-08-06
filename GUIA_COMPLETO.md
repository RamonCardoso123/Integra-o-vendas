# 🚀 Guia Completo de Setup — BPO Financeiro

## ✅ O que foi construído

- **Login seguro** com Supabase Auth
- **Multiempresa** — cada empresa tem seus próprios dados
- **Import DataCar** — lê o arquivo CpRl010 (Excel) com precisão total
- **Preview interativo** — revisão antes de salvar
- **Envio automático** para o Conta Azul via API OAuth2
- **Renovação de token** automática
- **Logs de integração** para auditoria
- Suporte a **Excel, CSV, PDF e Imagem**

---

## 📋 PASSO 1 — Instalar o banco de dados (Supabase)

1. Acesse: https://supabase.com/dashboard
2. Abra seu projeto
3. Vá em **SQL Editor** (ícone de banco de dados no menu lateral)
4. Clique em **"New Query"**
5. Copie todo o conteúdo do arquivo:  
   `supabase/migrations/001_schema_inicial.sql`
6. Cole no editor e clique em **"Run"**
7. Deve aparecer "Success" — banco criado!

---

## 📋 PASSO 2 — Rodar o setup no seu computador

> **Pré-requisito:** Ter o Node.js instalado (https://nodejs.org — versão LTS)

1. Abra a pasta do projeto no Windows Explorer
2. Dê **duplo clique** no arquivo `SETUP_E_DEPLOY.bat`
3. Aguarde (pode levar 2-3 minutos na primeira vez)
4. O script vai:
   - Instalar as dependências automaticamente
   - Fazer o push do código para o GitHub
   - Mostrar as instruções do Vercel

---

## 📋 PASSO 3 — Deploy no Vercel

1. Acesse: https://vercel.com
2. Faça login com **sua conta GitHub**
3. Clique em **"Add New... → Project"**
4. Selecione o repositório **INTEGRA-O-CONATAS-A-PAGAR-RECEBER**
5. Na seção **"Environment Variables"**, adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jyztzfikcccayzwnbrjv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_6gBVOcaOh8oYuLGzyqGW_Q_KXX0QEIw` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` (sua service_role key) |
| `CONTA_AZUL_CLIENT_ID` | *(deixar em branco por enquanto)* |
| `CONTA_AZUL_CLIENT_SECRET` | *(deixar em branco por enquanto)* |
| `CONTA_AZUL_REDIRECT_URI` | `https://SEU-APP.vercel.app/api/conta-azul/callback` |

6. Clique em **"Deploy"**
7. Aguarde ~2 minutos
8. Seu app estará em: `https://nome-do-projeto.vercel.app`

---

## 📋 PASSO 4 — Configurar o Conta Azul (quando precisar)

1. Acesse o portal de desenvolvedor do Conta Azul:  
   https://developers.contaazul.com/
2. Crie um **aplicativo** e obtenha:
   - `client_id`
   - `client_secret`
3. Adicione a URL de callback no Conta Azul:  
   `https://seu-app.vercel.app/api/conta-azul/callback`
4. Atualize as variáveis de ambiente no Vercel com esses valores
5. Na tela **Empresas** do app, clique em **"Conectar Conta Azul"**

---

## 📋 PASSO 5 — Primeiro uso

1. Acesse seu app no Vercel
2. Clique em **"Criar conta"** com seu e-mail
3. Confirme o e-mail (Supabase vai enviar)
4. Faça login
5. Vá em **Empresas** → Clique em **"Nova Empresa"** → Informe o nome
6. Vá em **Contas a Pagar** → Arraste o arquivo DataCar CpRl010 (Excel)
7. Revise os dados → Clique em **"Confirmar e Salvar"**
8. Clique no botão verde **"Enviar para Conta Azul"**

---

## 🗂️ Estrutura do projeto

```
src/
  app/
    (auth)/login/          → Tela de login
    (dashboard)/
      dashboard/           → Dashboard com estatísticas
      contas-pagar/        → Upload + Preview + Envio
      empresas/            → Gestão de empresas
    api/
      parse-pdf/           → Processamento de PDF/imagem
      conta-azul/
        autorizar/         → Início do OAuth2
        callback/          → Recebe o token do Conta Azul
        enviar/            → Envia contas via API
  components/
    layout/               → Sidebar + Header
    upload/               → DropZone + TabelaPreview + TabelaContas
  lib/
    supabase/             → Cliente browser/server/middleware
    conta-azul/           → API client
    parsers/datacar.ts    → Parser especializado DataCar CpRl010
  contexts/
    EmpresaContext.tsx    → Estado global de empresa ativa
supabase/
  migrations/001_schema_inicial.sql  → SQL completo do banco
```

---

## 🔧 Rodar localmente (desenvolvimento)

```bash
npm run dev
# Acesse: http://localhost:3000
```

---

## ❓ Dúvidas frequentes

**P: O arquivo DataCar não leu corretamente.**  
R: O parser foi calibrado exatamente para o formato CpRl010 (colunas N=Fornecedor, T=Vencimento, X=Valor). Se o arquivo tiver outra estrutura, entre em contato.

**P: O botão "Enviar para Conta Azul" deu erro.**  
R: Provavelmente a integração OAuth2 ainda não foi configurada. Siga o Passo 4.

**P: Esqueci a senha.**  
R: Na tela de login, crie uma nova conta com o mesmo e-mail. Ou use o Supabase Dashboard → Authentication para resetar.

---

*Desenvolvido para Dinheiro em Caixa — BPO Financeiro*
