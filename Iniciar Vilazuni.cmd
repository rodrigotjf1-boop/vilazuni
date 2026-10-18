@echo off
setlocal
cd /d "%~dp0app"
if not exist "server.mjs" (
  echo Nao foi encontrada a pasta app ao lado deste arquivo.
  echo Abra este inicializador na pasta original do projeto.
  pause
  exit /b 1
)
set "VILAZUNI_NODE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined VILAZUNI_NODE set "VILAZUNI_NODE=%%N"
if not defined VILAZUNI_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "VILAZUNI_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined VILAZUNI_NODE (
  echo E necessario instalar Node.js 20 ou superior para abrir a demonstracao.
  pause
  exit /b 1
)
echo Vilazuni - demonstracao com dados ficticios
echo Aguarde a mensagem Vilazuni pronto. O navegador sera aberto automaticamente.
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
"%VILAZUNI_NODE%" server.mjs --open
echo O servidor foi encerrado. Se houve um erro, a mensagem aparece acima.
pause
