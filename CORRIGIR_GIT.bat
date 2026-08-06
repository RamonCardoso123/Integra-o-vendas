@echo off
chcp 65001 > nul
title Corrigir Git - Remover historico bloqueado

echo.
echo =============================================
echo   Corrigindo historico do Git
echo =============================================
echo.

echo Removendo historico antigo que causou o bloqueio...
rmdir /s /q .git > nul 2>&1

echo Iniciando repositorio limpo...
git init
git config user.email "suporte@dinheiroemcaixa.com.br"
git config user.name "Dinheiro em Caixa"

echo Adicionando todos os arquivos...
git add -A

echo Criando commit limpo...
git commit -m "feat: sistema BPO financeiro completo"

echo Configurando repositorio remoto...
git branch -M main
git remote add origin https://github.com/Dinheiroemcaixa/INTEGRA-O-CONATAS-A-PAGAR-RECEBER.git

echo.
echo Enviando para o GitHub...
echo.
echo IMPORTANTE: Quando pedir usuario e senha:
echo   Usuario: Dinheiroemcaixa
echo   Senha:   SEU_TOKEN_AQUI
echo.
git push -u origin main --force

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO no push. Verifique usuario e senha acima.
    pause
    exit /b 1
)

echo.
echo =============================================
echo   PRONTO! Codigo enviado ao GitHub!
echo =============================================
echo.
echo Agora acesse https://vercel.com para o deploy.
echo.
pause
