# Correção de abertura — 18/10/2026

O servidor iniciado dentro do ambiente restrito não respondia às consultas de outro processo. Ao iniciar no Windows fora dessa restrição, a verificação retornou HTTP 200 e o HTML do Vilazuni. Isso confirma o serviço local, mas não substitui revisão visual da interface.

O inicializador agora abre o navegador depois que o servidor está pronto, procura o Node.js também no diretório padrão do Windows, mostra falhas sem fechar a janela e tenta outra porta se 4173 estiver ocupada. O endereço efetivo é mostrado no terminal. O servidor permanece limitado a 127.0.0.1.

Para abrir novamente: executar `Iniciar Vilazuni.cmd` na raiz do projeto e manter a janela aberta. Se já houver uma instância ativa, usar o endereço dela em vez de iniciar várias cópias. Cada porta tem armazenamento local próprio na demonstração.
