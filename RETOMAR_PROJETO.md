# Retomar o Vilazuni

Este repositório é a fonte de recuperação do código e do planejamento. A conversa do aplicativo não substitui os arquivos nem o histórico Git.

## Ponto atual — 19/10/2026

Piloto local do Condomínio Chandra: cenário 3D com 14 sobrados, painéis flutuantes, interiores ilustrativos, autenticação e permissões no servidor, estadias, moradores/coproprietários/locação anual e tarefas da zeladoria com fotos e revisão pela gestão e ocorrências privadas com atribuição, acompanhamento e encerramento justificado, além de materiais e estoque com consumo ligado às tarefas. Agora também há perfis delegados por módulo, ocupante vinculado à locação anual, planos de manutenção/checklists, reservas com interdição, encomendas e avisos internos privados. Fornecedores, orçamentos comparáveis, aprovação separada por alçada, recebimento ligado ao estoque e documentos PDF privados com versões/vencimentos também estão implementados. A base financeira tem contas/fundos, receitas/despesas manuais, compromissos de compras, contas a receber manuais, orçamento versus realizado, rateios aprovados por unidade, baixas parciais, acordos e modelos recorrentes, estornos e fechamento mensal com relatório/exportação. Consulte STATUS_DO_PROJETO.md, PLANO_DO_PROJETO.md e fundacao/PERMISSOES.md antes de continuar.

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

Próximas frentes previstas: conciliação por extrato/cobrança com parceiro; consolidação/encargos de acordos e evolução dos rateios; evoluções de compras e documentos; múltiplos vínculos e troca formal de gestão; infraestrutura central, backups e preparação para distribuição. Os três novos perfis já existem no piloto com limites descritos em STATUS_DO_PROJETO.md. Ainda não há portão, cobranças bancárias, mensagens automáticas, IA ou hospedagem de produção conectados.

## Verificação atual

Em app, `npm test`: 119 testes. Os testes HTTP usam bases e contas sintéticas temporárias, incluindo reinício e preservação dos novos módulos. O servidor continua `node server.mjs`, sem instalação de dependências. Não execute dois servidores sobre a mesma base JSON. Para conferência visual use base temporária via VILAZUNI_DATA_DIR; nenhuma senha do usuário é criada pelo agente.

Compras exigem duas pessoas: preparador/registrador da proposta não pode aprovar a própria compra. O síndico concede os módulos “Fornecedores e compras”, “Aprovação de compras” (com limite monetário) e “Documentos privados” pelo menu de delegações. Não há envio de pedidos ou pagamentos externos. PDFs sintéticos devem ser usados no piloto; nenhuma versão real de documento foi cadastrada pelo agente.

Financeiro: conceder explicitamente consulta, operação, controle e/ou exportação. Primeiro cadastrar fundo e conta com saldo inicial conferido. Importar compromissos das compras recebidas antes do fechamento do período. Baixa é somente registro manual de saída ou entrada já conferida, sem movimentação bancária. Somente o síndico reabre o último fechamento; registros e versões anteriores são preservados.

Contas a receber: cadastrar pagador/referência e receber integral ou parcialmente; entrada e recebível são gravados juntos. Estorno reabre o valor e impede nova baixa em data anterior ao estorno. Orçamento: controle financeiro registra/revisa previsões mensais por fundo, tipo e categoria, com justificativa/histórico. Comparação usa caixa líquido de estornos na data do estorno; difere das colunas brutas de receita/despesa do relatório. Previsões podem mudar enquanto o mês estiver aberto; cada fechamento congela sua revisão. Cobrança externa permanece pendente.

Rateios por unidade: controle financeiro prepara/revisa a prévia e aprova; operação gera um lote único de contas a receber. Informar pagadores, fundamento e divisão igual ou por pesos inteiros; não inferir frações/isenções do cadastro físico. Centavos por maiores sobras com desempate fixo. Geração é atômica e não altera caixa; após gerar, tratar cada recebível pelo fluxo existente. Não há cancelamento em lote depois da geração. Fechar mês exige gerar ou cancelar rateios aprovados com emissão no período. Relatórios preservam distribuição original e situação por data de corte. Competência/emissão devem estar abertas; emissão nunca futura.

Três etapas concluídas: baixas parciais a pagar/receber (residual em centavos, referências individuais e estorno por baixa); acordos sobre uma origem (operação propõe, controle aprova, operação ativa 2–36 parcelas, sem juros/multa/desconto ou duplicar dívida); modelos recorrentes de rateio (controle copia distribuição aprovada e prepara cada competência manualmente como rascunho, ainda sujeito a aprovação/emissão). Acordo bloqueia baixas/estornos na origem; cancelar exige estornar todas as parcelas e restaura o residual original. Parcelas mantêm vencimentos/destinação e não podem ser canceladas isoladamente. Referências e competências preparadas não são reutilizadas. Atualizar financeiro após ações em outra conta. Sem agendador ou integração bancária.
