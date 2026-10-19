# Vilazuni — estado de desenvolvimento

Atualização: 19/10/2026.

## Ocorrências privadas — 19/10/2026

Etapa 3 (operação) avançou com o módulo de ocorrências no menu do cenário. Todos os cinco perfis autenticados podem abrir relatos e acompanhar os próprios registros. Somente o autor e a gestão do mesmo condomínio recebem o relato e seu histórico; ser proprietário da casa relacionada não concede acesso a relatos de outras pessoas.

Abertura com título, local, descrição e casa opcional dentro do escopo autorizado. Gestão atribui a uma conta de gestão ativa, inicia apuração, resolve ou cancela com justificativa e pode reabrir. Autor e gestão adicionam acompanhamentos enquanto o registro está aberto. Toda mudança exige a versão atual e preserva autor, data, ação e mensagem no histórico. Relatos identificados; não há denúncia anônima, anexos, notificações ou encaminhamento automático à zeladoria. Responsável operacional de zeladoria continua no módulo separado de tarefas.

Verificação: 21 testes aprovados, incluindo ciclo de ocorrência pela API, privacidade entre contas/condomínios, restrições de casas, atribuição, transições, justificativas e conflito de versões. Servidor real validado por HTTP com entrega da página/módulos, gravação em base temporária e reinício preservando a base e invalidando sessão. A interface nova ainda precisa de conferência visual em navegador. Nenhuma conta ou dado real foi criado.

Próxima frente recomendada: materiais e estoque ligados às tarefas; permanecem pendentes os demais módulos da etapa 3 e a infraestrutura de produção.

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
