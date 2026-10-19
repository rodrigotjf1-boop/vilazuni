# Retomar o Vilazuni

Este repositório é a fonte de recuperação do código e do planejamento. A conversa do aplicativo não substitui os arquivos nem o histórico Git.

## Ponto atual — 19/10/2026

Piloto local do Condomínio Chandra: cenário 3D com 14 sobrados, painéis flutuantes, interiores ilustrativos, autenticação e permissões no servidor, estadias, moradores/coproprietários/locação anual e tarefas da zeladoria com fotos e revisão pela gestão e ocorrências privadas com atribuição, acompanhamento e encerramento justificado. Consulte STATUS_DO_PROJETO.md, PLANO_DO_PROJETO.md e fundacao/PERMISSOES.md antes de continuar.

Disposição aprovada: à direita da entrada casas 01–07; à esquerda 08–14. Churrasqueira junto à casa 14, antes do salão de festas. Festas à esquerda, jogos à direita e piscina no patamar superior. Preservar a navegação visual e os painéis sobre o cenário.

O usuário criará a primeira conta posteriormente. Não cadastrar uma senha real em seu nome. Para testar, usar um diretório temporário por VILAZUNI_DATA_DIR. Não usar dados pessoais reais neste piloto.

## Abrir em outro computador ou ambiente de desenvolvimento

1. Acessar o repositório privado `https://github.com/rodrigotjf1-boop/vilazuni` com a conta autorizada.
2. Clonar ou baixar o código. Instalar Node.js 20 ou superior.
3. Na pasta app, executar `npm test` e depois `npm start`.
4. Abrir o endereço local informado pelo servidor. No Windows também é possível usar Iniciar Vilazuni.cmd.
5. Em um novo chat com acesso ao repositório, pedir: “Leia RETOMAR_PROJETO.md e STATUS_DO_PROJETO.md e continue o Vilazuni a partir do estado existente.”

Acesso ao GitHub não importa automaticamente este histórico de conversa para outro produto ou chat. Se usar um ambiente remoto, ele precisa ter acesso ao repositório privado e executar o projeto no próprio ambiente.

## O que é preservado no GitHub

Código, testes, documentos e prévias do protótipo. A base `app/.data/`, credenciais, arquivos .env, diagnósticos e backups locais ficam excluídos. Portanto, o GitHub não restaura contas, senhas, fotos anexadas ou cadastros feitos no piloto. Esses dados exigirão backup privado próprio quando começarem a ser usados.

## Continuidade

Ao concluir cada etapa, atualizar STATUS_DO_PROJETO.md, executar os testes relevantes e salvar um commit. Enviar ao repositório autorizado quando solicitado ou autorizado na sessão. Alterações futuras só ficam no GitHub depois de enviadas; o repositório não é uma sincronização automática de toda a pasta.

Próximas frentes previstas: materiais e estoque vinculados às tarefas; expansão dos perfis (subsíndico, administradora e inquilino); infraestrutura central, backups e preparação para distribuição. Ainda não há portão, cobranças bancárias, mensagens automáticas, IA ou hospedagem de produção conectados.
