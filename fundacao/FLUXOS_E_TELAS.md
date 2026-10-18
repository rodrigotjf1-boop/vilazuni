# Vilazuni — fluxos e telas iniciais

## Jornada de login

Convite/solicitação → confirmação de identidade → vínculo pendente ou aprovado pelo gestor → ativação → seleção do condomínio quando houver mais de um → painel do perfil. Estados pendente, expirado, recusado e suspenso têm mensagens claras e caminho de suporte. Nenhum deles libera consulta aos dados do condomínio.

O convite aprovado tem permissões pré-definidas; consumi-lo não permite mudar o papel. Token expirado exige reemissão. Recuperação de conta recupera autenticação, sem restaurar delegações revogadas.

## Jornada de estadia

1. Proprietário seleciona sua casa e cria rascunho.
2. Informa origem, período, responsável, ocupantes e veículos; pode solicitar pré-cadastro ao responsável por link limitado, de uso controlado e com expiração.
3. Confere vagas e regras aplicáveis. O formulário informa que cadastro e autorização de entrada são etapas distintas.
4. Envia para análise se exigida; caso contrário, o serviço aplica a política vigente e registra a decisão automática como tal.
5. Gestão aprova/recusa com justificativa; aprovar cria autorizações individuais somente dentro do período aprovado.
6. Portaria consulta lista operacional e registra eventos; passagem pelo portão não significa que todos os hóspedes chegaram.
7. Alteração relevante exige atualização e reanálise conforme regra. Pedido pendente não amplia permissão anterior.
8. Cancelamento, encerramento ou expiração invalida as autorizações correspondentes; vínculos independentes permanecem ativos quando aplicáveis.

## Jornada de troca de proprietário

Solicitação com evidência → análise por gestor habilitado → data efetiva → encerrar titularidade anterior e criar nova → revisar acessos e delegações vinculados → notificar envolvidos privadamente → preservar a casa e seu histórico. Não cancelar ocupação ou contrato apenas pela venda; não liberar documentos de antigos ocupantes ao novo dono automaticamente.

## Telas do primeiro módulo

| Tela | Conteúdo principal | Ações e estados |
|---|---|---|
| Entrada | Identidade Vilazuni, login, convite e recuperação | Carregando, erro, tentativa limitada, convite expirado |
| Meu acesso | Situação da solicitação e contato da gestão | Pendente, recusado, suspenso, ativo |
| Seleção de condomínio | Somente vínculos aprovados | Selecionar contexto, sem misturar dados |
| Painel da gestão | Solicitações, estadias previstas, saídas e divergências | Acessos às filas; dados limitados ao papel |
| Painel do proprietário | Suas casas, estadias e pendências | Cadastrar estadia, solicitar correções |
| Casas | Busca por identificação, características e filtros autorizados | Lista/mapa; passeio virtual entra posteriormente |
| Ficha da casa | Estrutura, coproprietários, ocupações, vagas e histórico | Abas e campos por permissão; versão e data |
| Pessoas e vínculos | Pessoa, titularidade, ocupação e acesso separados | Cadastro, análise e encerramento auditado |
| Estadias | Listagem por casa/período e situação | Criar, revisar, cancelar, solicitar prorrogação |
| Formulário de estadia | Casa/período → responsável → pessoas → veículos/vagas → revisão | Salvar rascunho; erros por campo; preservar preenchimento |
| Detalhe da estadia | Ficha, autorizações, alterações e eventos | Decidir, corrigir ou encerrar conforme perfil |
| Operação de portaria | Busca mínima por nome/casa/placa e vigência | Conferir e registrar; indicar dados desatualizados |
| Estacionamento | Áreas, vagas fixas, limites e disponibilidade com fonte/data | Configuração restrita; desconhecido não equivale a livre |
| Gestão de acesso | Convites, solicitações, papéis, mandatos e delegações | Aprovar, suspender e revogar sem autoelevação |
| Histórico e configuração | Eventos auditáveis, regras e versões | Consulta/exportação restrita, sem edição destrutiva |

## Experiência e navegação

Português claro; layout responsivo com foco em celular; navegação por teclado, contraste e rótulos acessíveis. Estado vazio oferece a próxima ação permitida. Falha de rede não aparece como sucesso. Duplicar envio não cria duas estadias. Datas mostram o fuso e a revisão apresenta horário completo. Não exibir documento pessoal em notificações, listas amplas ou mensagens de erro.

Itens financeiros, tarefas, IA e governança não terão botões aparentemente funcionais no primeiro módulo sem implementação. A navegação poderá apresentar apenas módulos disponíveis ao perfil e à versão entregue.
