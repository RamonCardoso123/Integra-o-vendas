@echo off
chcp 65001 > nul
title BPO Financeiro - Setup e Deploy

echo.
echo =============================================
echo   BPO Financeiro - Setup e Deploy
echo =============================================
echo.

echo [1/5] Verificando Node.js...
node --version > nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js nao encontrado!
    echo Baixe em: https://nodejs.org  versao LTS
    pause
    exit /b 1
)
echo OK - Node.js encontrado!

echo.
echo [2/5] Verificando Git...
git --version > nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERRO: Git nao encontrado!
    echo Baixe em: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo OK - Git encontrado!

echo.
echo [3/5] Instalando dependencias do projeto...
call npm install --legacy-peer-deps
IF %ERRORLEVEL% NEQ 0 (
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)
echo OK - Dependencias instaladas!

echo.
echo [4/5] Configurando Git...
git init > nul 2>&1
git config user.email "suporte@dinheiroemcaixa.com.br"
git config user.name "Dinheiro em Caixa"

git remote remove origin > nul 2>&1
git remote add origin https://github.com/Dinheiroemcaixa/INTEGRA-O-CONATAS-A-PAGAR-RECEBER.git

echo OK - Git configurado!

echo.
echo [5/5] Enviando codigo para o GitHub...
git add -A
git commit -m "feat: sistema BPO financeiro completo"
git branch -M main
git push -u origin main --force
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo O GitHub pediu usuario e senha.
    echo.
    echo - Usuario: Dinheiroemcaixa
    echo - Senha: cole o seu token do GitHub
    echo   (aquele codigo que comeca com ghp_)
    echo.
    pause
    exit /b 1
)
echo OK - Codigo enviado ao GitHub!

echo.
echo =============================================
echo   CONCLUIDO! Proximo passo: Vercel
echo =============================================
echo.
echo 1. Acesse: https://vercel.com
echo 2. Login com GitHub
echo 3. Clique em Add New Project
echo 4. Selecione: INTEGRA-O-CONATAS-A-PAGAR-RECEBER
echo 5. Adicione as variaveis de ambiente
echo 6. Clique Deploy
echo.
pause
