# Vilazuni — estado de desenvolvimento

Atualização: 19/10/2026.

## Estado atual — operação ampliada em 19/10/2026

A etapa 2 está funcional como piloto local, e a etapa 3 já possui tarefas com fotos/revisão, ocorrências, consumíveis/estoque, manutenção preventiva, dependências/reservas, encomendas, fornecedores/compras, documentos com vencimentos e avisos internos. A etapa 4 foi iniciada com contas/fundos, lançamentos e compromissos manuais, ligação de compras recebidas, contas a receber, orçamento versus realizado e fechamento mensal. O passeio 3D continua sendo prova de conceito ilustrativa. Esta entrega não implanta produção, PostgreSQL, HTTPS ou integrações externas.

### Perfis e delegações

O síndico convida subsíndico/administradora com validade obrigatória, justificativa e módulos explícitos: pessoas/vínculos, estadias/autorizações, tarefas/revisão, materiais, ocorrências privadas, preventiva, dependências/reservas, encomendas, preparação de compras, aprovação de compras com limite, documentos privados e quatro permissões financeiras independentes (consulta, operação, controle e exportação). Ser gestor delegado não dá acesso a módulos não concedidos, convites, suspensão de contas ou nova delegação. Somente o síndico atualiza as delegações (com controle de versão); a atualização encerra sessões antigas. Expiração e suspensão são verificadas em toda requisição. A delegação de ocorrências dá acesso aos relatos privados do condomínio e está identificada assim na interface. Não há verificação documental de mandato nem gestão de carteira de vários condomínios.

Ocupante é convidado pelo síndico para um vínculo anual vigente e com prazo de acesso. Recebe identificação da sua casa, próprios relatos, reservas e encomendas destinadas à conta, sem fichas residenciais, proprietários, estadias de terceiros ou estoque. Encerrar o vínculo anual invalida sua sessão e novos logins; a data prevista de término continua sendo planejamento, não saída efetiva. Os demais perfis mantêm seus escopos existentes.

### Manutenção preventiva

Gestão com delegação de preventiva cria plano com equipamento/local, orientações, intervalo em dias, primeiro prazo e checklist. A geração manual de tarefa exige também acesso a tarefas; só é permitida quando o prazo chega e não há execução aberta do mesmo plano. Avança o próximo prazo pela frequência configurada, sem geração automática ou sugestão de periodicidade legal. Plano pode ser pausado/reativado com motivo. Se o responsável do plano estiver suspenso ou expirado, a execução é gerada sem atribuição para revisão pela gestão. Reatribuição reinicia checklist; revisão exige checklist completo e foto da execução atual. Execuções e materiais usados continuam no histórico da tarefa. Não há edição de frequência, agendador de fundo ou importação de normas nesta etapa.

### Dependências e reservas

Gestão configura espaços exclusivos, capacidade, horário no fuso Brasília, duração máxima e regras. Proprietário, imobiliária e ocupante solicitam pelas casas autorizadas; gestão de reservas pode operar no condomínio. Solicitação exige ciência das regras e aprovação posterior. Horários futuros no mesmo dia; solicitações pendentes já ocupam o horário. Sobreposição é recusada mesmo com pedidos simultâneos; horários contíguos são permitidos. Agenda alheia mostra só período ocupado, sem autor/casa/pessoas/histórico. Autor cancela a própria reserva; gestão aprova/recusa/cancela com motivo. Interdição cancela solicitações/reservas futuras afetadas com histórico; reabrir não as restaura. Não há taxa, recorrência de reservas ou controle de entrada física.

### Encomendas e avisos

Portaria ou gestão de encomendas registra recebimento, casa, descrição breve e local de guarda, com conta destinatária opcional. Só a conta destinatária vinculada e os operadores autorizados consultam a encomenda; coproprietário não recebe encomendas de outra conta. Sem conta, somente a operação acompanha. Retirada exige registro pelo operador, nome de quem retirou e observação após conferência presencial. Controle de versão impede retirada repetida. O registro não é assinatura digital nem verificação documental.

Avisos internos individuais para alterações de tarefas, relatos, reservas e encomendas; sem conteúdo sensível na mensagem. Leitura e abertura conferem autorização atual, inclusive após reatribuição ou retirada de delegação. Há marcação de leitura e atualização manual. Nenhum push, e-mail, WhatsApp, resumo de IA ou mensagem externa foi ativado. Não há aviso retroativo ao conceder novos módulos.

### Fornecedores, orçamentos e compras

Cadastro de fornecedores com contato, categoria, edição justificada, inativação/reativação e histórico. Orçamentos preservam a identificação do fornecedor da época; aprovadores sem acesso a compras não recebem contatos ou histórico cadastral. Compras são privadas aos módulos de preparação e aprovação, separados na delegação.

Cada compra tem uma especificação, quantidade/unidade e vínculo opcional a material e tarefa. Propostas registram valor total em centavos (incluindo frete/tributos), validade, prazo de entrega e condições. A última proposta por fornecedor entra na comparação; versões anteriores permanecem no histórico. Fluxo: rascunho → análise → aprovação/recusa → recebimento integral, com reabertura justificada da recusa e cancelamento antes do recebimento.

Aprovação exige pessoa diferente de quem preparou a compra e registrou a proposta escolhida, mesmo para síndico. Aprovadores delegados precisam de limite explícito por compra, aplicado no servidor e revogado/reavaliado ao alterar a delegação. Proposta vencida, fornecedor inativo, versão antiga e valor acima do limite são recusados. Cotação única exige justificativa específica. Orçamento aprovado é congelado na decisão.

Recebimento de consumível exige também acesso a materiais e confere a versão do saldo. Compra, recibo e entrada no estoque são persistidos juntos, uma vez por compra. Referência já usada em recebimento do mesmo fornecedor é recusada. Uma compra sem material registra recebimento sem movimentar estoque. Não há pedido enviado ao fornecedor, pagamento, despesa financeira automática, itens múltiplos, recebimento parcial, devolução, contrato de fornecimento ou garantias estruturadas nesta etapa. Cada proposta pode ter até R$ 1.000.000,00 no piloto.

### Documentos privados e vencimentos

Gestão com módulo de documentos registra título, categoria, responsável ativo, vencimento opcional, antecedência de alerta e PDF. Arquivos ficam fora das projeções de estado: somente metadados são retornados. Download autenticado por condomínio e módulo, como anexo, sem URL pública e com conferência SHA-256 do conteúdo armazenado. Validação de formato e tamanho não equivale à análise de conteúdo/antivírus ou assinatura digital.

Novas versões exigem motivo, preservam arquivos/dados anteriores e atualizam responsável/vencimento. Arquivar conserva versões e retira o documento da lista de prazos; reativar exige motivo. Limites do piloto: PDF de 2 MB, dez versões por documento, 32 MB totais incluindo arquivados. PDF ainda é persistido na base JSON; armazenamento de objetos e backups de produção permanecem pendentes.

Alertas de documentos são calculados no servidor pelo dia de Brasília, usando a versão atual, e aparecem em Documentos e Avisos. Não dependem de agendador, e-mail ou mensagens externas; atualizar o painel consulta o prazo atual. Moradores, portaria, zeladoria e gestores sem esse módulo não recebem documentos nem alertas. Datas são informadas pela gestão; não há validação de exigências legais.

### Base financeira — 19/10/2026

Contas bancárias/caixa e fundos são visões do mesmo dinheiro, sem duplicação de saldo. Controle financeiro cadastra fundos, finalidade, contas e saldos iniciais com data/origem. Operação registra receitas, despesas e transferências entre contas; realocação entre fundos e ajustes exigem controle. Todos os valores são inteiros em centavos. Referência por conta, identificador de operação e versões impedem repetição e alterações sobre saldos desatualizados. Não são aceitos saldos negativos ao fim de cada dia na combinação conta/fundo, inclusive quando um registro retroativo afetaria datas posteriores.

Lançamentos não são editados/apagados: estorno cria registro inverso, preserva o original e reabre compromisso ou conta a receber vinculada quando aplicável. A nova baixa não pode anteceder o estorno. Registros só podem usar datas até o dia atual de Brasília e posteriores/iguais ao saldo inicial da conta. Inativar conta/fundo exige saldo zero; fundo com compromisso ou conta a receber aberta não pode ser inativado. Saldo inicial fica imutável; correção usa ajuste justificado em período aberto.

Contas a pagar podem ser manuais ou importadas de compra recebida. A importação usa exclusivamente o valor aprovado, fornecedor, referência e data do recebimento, mesmo sem liberar orçamentos/contatos para o operador financeiro. Cada compra gera no máximo um compromisso. Compromisso não altera caixa até registrar saída integral já conferida; a baixa grava despesa e estado do compromisso juntos. Cancelamento, reabertura e alteração de vencimento/fundo/categoria preservam histórico e efeito por data. Baixa não pode preceder emissão, reabertura ou última alteração. Não há baixa parcial ou edição do valor do compromisso.

Contas a receber são manuais, com pagador, referência, emissão, vencimento, fundo, categoria e valor fixo. Pagador/referência normalizados impedem duplicidade mesmo após cancelamento. Cadastro não aumenta caixa; recebimento integral conferido grava receita e situação do recebível juntos. Estorno reabre a conta, condicionado ao saldo histórico disponível. Cancelar, reabrir e atualizar prazo/fundo/categoria preservam a situação de cada data de corte. Sem baixa parcial, juros, multa, acordos, geração por unidade ou cobrança enviada. Os dados continuam privados às delegações financeiras.

Orçamento mensal por fundo, receita/despesa e categoria exige controle financeiro. Cada previsão tem versão, justificativa, autor e histórico de valores; zero retira a previsão sem apagar o registro. Meses futuros aceitam planejamento. Enquanto o período estiver aberto, a previsão pode ser revista, inclusive após o fim do mês; o relatório usa a revisão atual e o fechamento congela essa revisão. Categorias são comparadas pelo nome normalizado, ignorando maiúsculas/minúsculas. Realizado usa regime de caixa líquido: estornos reduzem a categoria original no mês do estorno, podendo gerar valor negativo. Saldos iniciais, transferências, ajustes, compromissos não pagos e valores não recebidos ficam fora do realizado. Categorias realizadas sem previsão aparecem explicitamente; diferença é realizado menos previsto, sem somar visões de conta e fundo.

Relatório mensal separa saldo anterior, inicial, receitas/despesas registradas, transferências, ajustes, estornos e saldo final. Receitas/despesas são valores antes dos estornos; estes compõem o saldo final em coluna própria. As visões por conta e por fundo não devem ser somadas. Relatório inclui compromissos abertos, quitados manualmente e cancelados na data de corte, além de compras recebidas ainda sem compromisso, contas a receber abertas/recebidas/canceladas na data de corte e orçamento comparado ao realizado líquido.

Fechamento só em mês já encerrado no calendário, com revisão atual do financeiro e compras recebidas do período já registradas como compromissos. Bloqueia registros no mês e nos anteriores. Meses seguintes são encerrados em sequência; somente síndico reabre o último fechamento, com motivo. Cada encerramento salva relatório e SHA-256; reabertura conserva a versão anterior e um novo fechamento cria outro registro. Relatórios históricos preservam a situação anterior, mesmo após estornos/alterações em mês posterior. Fechamentos antigos continuam legíveis sem alterar seu hash ou preencher retroativamente os novos campos. Exportação JSON requer delegação específica; não é assinatura digital ou prestação de contas pública aos moradores.

Consulta, operação, controle e exportação são delegações distintas, todas por condomínio; demais perfis não recebem dados financeiros. Operação não concede controle de contas/fundos ou fechamento. Controle não concede registro comum de receita/despesa. Exportação inclui leitura e não concede escrita. Suspensão, expiração e revogação usam o mecanismo existente. Avisos financeiros são individuais e filtrados pela autorização atual.

Limites: escrituração gerencial local, sem operação bancária, conciliação, geração de arrecadação/rateio ou cobrança, Pix/boleto ou parceiro financeiro. Não há validação de saldos reais, aprovação de transferência bancária ou tratamento contábil/fiscal completo. Teto por registro: R$ 1.000.000,00. Nenhum dinheiro foi movimentado; testes usam valores e contas sintéticos.

### Validação e continuidade

86 testes aprovados, incluindo API, permissões por módulo, expiração/suspensão, encerramento de vínculo anual, concorrência em consumo/reserva/geração de tarefas/retirada, persistência e reinício. Fluxos conferidos em Chromium com contas e bases temporárias: convite/ativação delegada e menus por escopo, plano/checklist, solicitação/aprovação de reserva, recebimento/aviso privado/retirada. Menu adaptado à quantidade de módulos e à navegação móvel. Também foram conferidos em Chromium: cadastro/edição de fornecedores, comparação de propostas, aprovação por segunda conta dentro do limite, recebimento no estoque, upload/download de PDF com bytes idênticos, renovação e preservação da versão anterior. Financeiro validado por testes de centavos/saldos, concorrência, segregação, fechamento, hash e reinício. Também conferido em Chromium: fundos/contas, receita/despesa, transferência/realocação, baixa/estorno, importação de compra recebida, fechamento/reabertura, exportação JSON e consulta móvel sem comandos de escrita. Recebíveis e orçamento também conferidos no Chromium: cadastro, entrada/estorno/nova entrada, revisão de prazo, cancelamento, revisão da previsão, comparação mensal, fechamento/exportação e consulta no celular sem escrita. Testes cobrem duplicidade, concorrência de baixa/revisão, segregação, corte histórico, compatibilidade com fechamentos antigos e reinício. Sem novas dependências de execução. Nenhuma conta ou dado pessoal real foi criado.

Pendências seguintes: rateios e geração de contribuições por unidade, baixas parciais/acordos, conciliação/cobrança com parceiro, evoluções de compras (itens múltiplos/recebimento parcial/devoluções), múltiplos vínculos por pessoa e troca formal de gestão; infraestrutura central e backups para produção. As seções abaixo preservam o histórico das entregas anteriores, com contagens de testes da época.

## Materiais e estoque — 19/10/2026

Consumíveis cadastrados pela gestão com nome, unidade de medida, depósito/local e estoque mínimo. Saldo inicial zero; entradas exigem quantidade e origem/motivo. Gestão e zeladoria consultam saldo e indicação de reposição quando saldo menor ou igual ao mínimo. Zeladoria vê apenas os movimentos que registrou; demais perfis não recebem estoque.

Consumo exige tarefa no mesmo condomínio, em estado a fazer/em execução, e atribuição à própria conta para zeladoria. Gestão pode consumir nas tarefas abertas do condomínio. Atualiza saldo, movimento e histórico/consumos da tarefa na mesma gravação. Quantidades até três casas decimais; saldo negativo, tarefa desatualizada e estoque desatualizado são recusados. Movimento não é apagado nem reverte automaticamente ao cancelar uma tarefa. Sem ajuste de inventário, estorno, empréstimo, compras ou integração financeira nesta entrega.

Verificação: 25 testes aprovados, incluindo integração HTTP, duas retiradas simultâneas sobre a mesma versão com apenas uma efetivada, saldo insuficiente, quantidades inválidas, isolamento, autorização e persistência no arquivo local. Fluxo conferido em Chromium: cadastro, entrada, criação de tarefa, seleção explícita da tarefa, consumo e exibição na tarefa; sem erros JavaScript. Consulta do painel também conferida em viewport móvel (390 × 844), com base temporária e dados sintéticos. Próximas frentes: perfis/delegações, manutenção preventiva e reservas; infraestrutura central ainda necessária para produção.

## Ocorrências privadas — 19/10/2026

Etapa 3 (operação) avançou com o módulo de ocorrências no menu do cenário. Todos os cinco perfis autenticados podem abrir relatos e acompanhar os próprios registros. Somente o autor e a gestão do mesmo condomínio recebem o relato e seu histórico; ser proprietário da casa relacionada não concede acesso a relatos de outras pessoas.

Abertura com título, local, descrição e casa opcional dentro do escopo autorizado. Gestão atribui a uma conta de gestão ativa, inicia apuração, resolve ou cancela com justificativa e pode reabrir. Autor e gestão adicionam acompanhamentos enquanto o registro está aberto. Toda mudança exige a versão atual e preserva autor, data, ação e mensagem no histórico. Relatos identificados; não há denúncia anônima, anexos, notificações ou encaminhamento automático à zeladoria. Responsável operacional de zeladoria continua no módulo separado de tarefas.

Verificação: 21 testes aprovados, incluindo ciclo de ocorrência pela API, privacidade entre contas/condomínios, restrições de casas, atribuição, transições, justificativas e conflito de versões. Servidor real validado por HTTP com entrega da página/módulos, gravação em base temporária e reinício preservando a base e invalidando sessão. A interface nova ainda precisa de conferência visual em navegador. Nenhuma conta ou dado real foi criado.

A frente seguinte de materiais e estoque foi implementada (ver seção acima); permanecem pendentes os demais módulos da etapa 3 e a infraestrutura de produção.

## Etapa anterior: proprietários e locações residenciais

Cadastros de proprietários/copropietários e locações anuais/residenciais ligados às casas, com contato, moradores, veículos, início, término previsto e saída efetiva. A interface funciona em etapas sobre o interior 3D, no atalho “Moradores e vínculos”. Estadias por temporada continuam em fluxo próprio.

Apenas a gestão registra ou altera propriedade. Proprietários e imobiliárias registram/atualizam locações nas casas autorizadas. Mudanças preservam a versão anterior; encerramento preserva o histórico, disponível apenas à gestão. Portaria e zeladoria não recebem fichas residenciais. O prazo previsto não confirma saída física. Encerrar um vínculo administrativo não altera automaticamente contas de login: suspensões continuam explícitas na gestão de acessos.

Verificação: 13 testes aprovados, incluindo integração HTTP. Cadastro de locação anual com dois moradores e veículo e encerramento com histórico conferidos no navegador em base temporária isolada. Nenhuma conta ou cadastro real do usuário foi criado. Ajustado o retorno ao topo ao trocar de painel.

## Etapa anterior: autenticação local e autorização no servidor

Login por e-mail e senha, configuração da primeira conta de gestão, convites de uso único (48 horas), casas autorizadas por vínculo, prazo de delegação da imobiliária, suspensão, encerramento de sessão e alteração de senha implementados. Perfis disponíveis: síndico, proprietário, imobiliária de locação, portaria e zeladoria. Subsíndico, administradora e ocupante ainda aguardam fluxos próprios de delegação e vínculo.

O seletor simulado de perfis foi removido. Dados e alterações passam pela API autenticada. A portaria recebe somente autorizações aprovadas e campos operacionais; a zeladoria recebe tarefas, sem fichas residenciais. Papéis, condomínio e casas são obtidos no servidor, não aceitos do cliente. O cenário 3D continua visível no login e nos painéis.

Persistência local em `app/.data/store.json`, ignorada pelo Git; senhas com scrypt e salt individual, tokens de convite armazenados como hash, sessões em memória. A pasta está dentro do workspace e pode ser sincronizada pelo OneDrive do usuário. Não usar essa persistência como solução de produção ou executar múltiplos servidores sobre a mesma base. Dados da demonstração anterior no navegador não são importados automaticamente; não foram apagados.

Verificação desta etapa: oito testes aprovados, incluindo integração HTTP com contas sintéticas em diretório temporário, escopo entre casas/condomínios, campos da portaria, tarefas da zeladoria, uso único de convite, suspensão, alteração de senha e expiração. A tela de configuração inicial foi inspecionada no navegador. Nenhuma conta real ou senha do usuário foi criada pelo agente.

Antes da distribuição: PostgreSQL/migrações, isolamento também no banco, hospedagem HTTPS, recuperação verificada de conta, MFA da gestão, vínculos em múltiplos condomínios, mandatos/delegações, backups e testes adicionais. O cookie local usa HttpOnly/SameSite=Strict; a implantação HTTPS deverá exigir Secure. O servidor permanece somente em 127.0.0.1. A primeira conta é habilitação manual de piloto, não verificação formal de mandato.

## Histórico da base inicial

- Plano consolidado e identidade conceitual inicial.
- Modelo de dados, matriz de permissões, fluxos, telas e backlog da fundação em `fundacao/`.
- Demonstração local executável em `app/`, sem dependências externas.
- Cadastro/análise/cancelamento de estadias, consulta de autorização por período e histórico local.
- Casas, pessoas fictícias, vagas e atualização básica de tarefas.
- Sete testes de domínio aprovados: isolamento de escopo, datas, responsável/quantidade, intervalo de autorização, decisão/cancelamento, avisos de vagas/conflito e restrições da portaria.

## Histórico da verificação inicial (superado pela etapa atual)

Inspeção visual não concluída: o navegador conectado retornou timeout ao tentar acessar o endereço local. A checagem HTTP também falhou, inclusive na tentativa fora da restrição do ambiente; não foi possível confirmar a causa. O processo do servidor anunciou o endereço e foi encerrado ao concluir as verificações. Não afirmar que abertura, layout ou formulários foram validados visualmente. Testes de domínio não substituem testes de segurança no serviço central, que ainda não existe.

## Histórico do planejamento seguinte

Atualização visual de 18/10: nova tela de exploração `/#world`, com cena WebGL navegável, marcadores de locais e painel contextual. Renderização e restrição contextual simulada foram verificadas no navegador. Rascunho real do Chandra aguardado para ajustar o cenário; detalhes em fundacao/EXPERIENCIA_IMERSIVA.md. Essa revisão atualiza a limitação anterior de inspeção visual somente para os fluxos efetivamente conferidos.

A autenticação local e as operações autenticadas foram implementadas nesta revisão. A base PostgreSQL, migrações e isolamento também no banco continuam pendentes para distribuição.

Não há hospedagem, domínio ou serviço financeiro contratado. Nenhuma integração física está ativa, nenhum resumo é enviado e nenhum dado pessoal real foi cadastrado. Revisão jurídica e documentação real do Chandra permanecem pendentes. O nome Vilazuni foi escolhido, mas marca e domínio não foram confirmados.


## Zeladoria com revisão — 18/10/2026

Implementado no piloto local: criação de tarefa com local, orientações, prazo e responsável; tarefas visíveis ao zelador somente quando atribuídas à sua conta; fotos de execução; envio para revisão; aprovação, pedido de ajuste ou cancelamento pela gestão, com observação e histórico. Reatribuir reinicia o andamento e exige nova evidência. Uma versão por tarefa impede sobrescrita por uma tela desatualizada; use “Atualizar tarefas” para recarregar.

As fotos são servidas por rota autenticada, restrita à gestão do condomínio e ao zelador responsável. A interface reduz imagens para até 1600 pixels e converte em JPEG. Limites do piloto: oito fotos por tarefa, 2 MB por arquivo recebido e limite global de armazenamento próximo de 64 MB. Os arquivos ainda ficam na base JSON local; armazenamento de objetos, retenção e backups de produção continuam pendentes. A validação do servidor verifica formato e tamanho, sem análise de conteúdo ou antivírus.

Verificação atual: 17 testes aprovados, incluindo envio/leitura de foto pela API, negação de acesso sem sessão e por proprietário, controle de versão, atribuição e revisão. Criação e início de tarefa também conferidos pela interface em base temporária com dados fictícios. Prévia: `previa-zeladoria.png` na raiz do projeto. Nenhuma conta do usuário foi criada.
