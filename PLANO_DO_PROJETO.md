# Vilazuni — plano consolidado do projeto

Versão 1.0 • 17/10/2026

Nome escolhido pelo usuário: **Vilazuni**. Condomínio piloto: **Condomínio Chandra**. A escolha do nome não representa confirmação de disponibilidade jurídica, domínio ou perfis sociais; essas verificações permanecem pendentes. Este documento consolida o plano de execução; os detalhes funcionais e as referências estão em ESPECIFICACAO_INICIAL.md e SUGESTOES_E_PRIORIDADES.md. Atualização de execução em 18/10/2026: fundação documentada e primeira demonstração local em app/; serviço central e implantação de produção ainda não implementados. Consultar STATUS_DO_PROJETO.md.

## 1. Objetivo

Plataforma de gestão, convivência e operação de condomínios, distribuída como serviço para vários empreendimentos, com webapp e aplicativos Android/iPhone. Diferenciais: controle de estadias e vínculos históricos das casas, operação com evidências, assistente de IA e passeio virtual com acesso contextual às fichas.

## 2. Fundamentos do cadastro

Condomínio → casas/unidades e dependências → vínculos de propriedade e ocupação → autorizações e operações.

Casas podem ter estruturas e características diferentes e receber alterações. Cada casa conserva identidade e histórico; inclusão, inativação, reformas, união ou divisão seguem procedimentos registrados. Proprietários e inquilinos mudam ao longo do tempo. Uma casa pode ter múltiplos coproprietários e uma pessoa pode possuir ou ocupar várias unidades. Proprietário, ocupante, pagador, representante e autorizador são vínculos distintos.

Cada condomínio possui regras, documentos e dados isolados. Histórico não significa acesso irrestrito a documentos de antigos moradores.

## 3. Módulos consolidados

| Módulo | Escopo planejado |
|---|---|
| Identidade e permissões | Login por convite/solicitação aprovada pelo síndico ou administradora habilitada; papéis, unidades, delegações e vigência; autenticação reforçada para gestores |
| Gestão de pessoas e casas | Fichas de unidades, estrutura, fotos, documentos, copropriedade, moradores e histórico temporal |
| Locação e estadias | Residencial contínua e temporada; Airbnb, Booking, direta e outras origens; ficha do responsável, relação nominal de ocupantes, contatos, veículos, entrada e saída |
| Portaria e acesso | Visitantes, prestadores, credenciais, veículos, registros de entrada/saída, chaves e controles; expiração e revogação |
| Estacionamento | Existência, capacidade, quantidade por casa, vagas fixas identificadas, livres ou mistas; bloqueios e disponibilidade confirmada ou desconhecida |
| Dependências | Piscinas, depósitos, jogos, academia, festas e outros espaços; fichas, horários, capacidade, acesso, reservas, limpeza e interdições |
| Tarefas e manutenção | Síndico e subsíndico acompanham; zelador executa e apresenta fotos; prazos, revisão, checklists e manutenção preventiva |
| Ocorrências e reclamações | Avarias, relatos confidenciais, denúncias anônimas, apuração, esclarecimentos e acompanhamento privado |
| Materiais e patrimônio | Consumíveis, ferramentas, bens e itens emprestáveis; depósitos, compras, consumo por tarefa, empréstimo/devolução, inventário e estoque mínimo |
| Fornecedores e compras | Cadastro, orçamentos, aprovações por valor, ordens de serviço, recebimento, garantias e vínculo financeiro |
| Financeiro | Receitas, despesas, fundos, contas, orçamento versus realizado, compromissos, conciliação, fechamento mensal e prestação de contas |
| Taxas e cobrança | Competências, rateios aprovados, vencimentos, inadimplência, encargos validados, lembretes privados, acordos, contestação e pagamentos conciliados |
| Governança | Mandatos, delegações, procurações, convocação, assembleias, quóruns por matéria, votos e atas; enquetes consultivas separadas |
| Documentos e prazos | Convenção, regimento, versões, contratos, seguros, laudos, licenças aplicáveis e alertas de vencimento |
| Comunicação e encomendas | Avisos por público, notificações, ciência quando disponível, recebimento e comprovação de retirada de encomendas |
| Obras e consumos | Solicitações de obras/mudanças, prestadores, documentos e atualização da casa; leituras e histórico de medidores quando existentes |
| Passeio virtual | Panoramas 360° ou solução 3D a validar, casas e dependências selecionáveis, fichas filtradas, alternativa por mapa/lista |
| Assistente de IA | Consultas fundamentadas, acompanhamento de tarefas, relatórios, resumo diário, resposta a menção/chamada e alertas privados |
| Administração do produto | Implantação, importação, carteira da administradora, módulos/limites por plano, suporte auditado, exportação e encerramento do cliente |

## 4. Regras indispensáveis

- RBAC combinado com condomínio, casa, finalidade, validade e delegação. Imobiliária de locação não recebe automaticamente poderes de administradora do condomínio.
- Cadastro de hóspede não concede login automaticamente. E-mail verificado não substitui aprovação do vínculo. Troca de gestão revoga privilégios antigos e preserva dados.
- Estadia identifica todas as pessoas e veículos; total calculado pela relação nominal. Separar datas previstas, efetivas e presença registrada. Autorização expira no período aprovado.
- Origem Airbnb/Booking inicialmente cadastrada manualmente; sincronização depende de APIs e condições dos parceiros. Formulário seguro de pré-cadastro pode reduzir trabalho, com validação antes da autorização.
- Placa reconhecida não basta para abrir portão; autorização de entrada não garante vaga. Acesso físico necessita integração validada e controle local de contingência.
- Tarefa não é concluída automaticamente por foto. Reclamação não é infração comprovada. IA não aplica penalidades, decide denúncias ou movimenta dinheiro.
- Resumos e respostas em grupos consideram o público inteiro. Dados privados e cobranças não são publicados em grupos de moradores. Identificar fonte e data das respostas da IA.
- Financeiro distingue consulta, prestação de contas e movimentação bancária. Revisar o significado de participação em conta e direitos de informação antes de configurar restrições.
- Cobranças usam parceiro financeiro e conta do respectivo condomínio; comprovante isolado não gera baixa definitiva. Não bloquear entrada automaticamente por inadimplência.
- Estoque conecta consumo, reposição, compra e despesa sem duplicidade. Empréstimos registram conservação, responsável e devolução.
- Copropriedade não multiplica votos indevidamente. Regras de representação, rateio e quórum dependem de documentação e enquadramento válidos.

## 5. Infraestrutura recomendada

Iniciar com serviços gerenciados, sem VPS obrigatória: PostgreSQL, identidade, arquivos privados, aplicação e processos de fundo. Supabase hospedado com região primária São Paulo é candidato, sujeito a avaliação técnica, contratual e de custo. Nenhum fornecedor está contratado.

Banco armazena registros e referências; armazenamento de objetos guarda fotos, documentos e panoramas. Vídeo contínuo fica em gravador local ou serviço especializado, com orçamento e retenção próprios. Portões precisam continuar com procedimento local definido em falhas de internet.

Isolamento por condomínio no banco, arquivos, filas, cache, busca e IA. Verificações no servidor e políticas no banco; credenciais privilegiadas nunca nos aplicativos. Prever possibilidade de ambiente dedicado para clientes com exigências específicas, sem duplicar o produto.

Desenvolvimento, homologação e produção separados. Backups de banco e arquivos, restauração testada, monitoramento, exportação por cliente, limites de consumo e plano de incidentes. Definir metas de disponibilidade e recuperação antes da produção. Estimar custos por condomínio considerando mídia, tráfego, mensagens, IA, banco, suporte e integrações.

## 6. Base de regras e proteção de dados

Confirmar município/UF e regime jurídico do Chandra antes de transformar regras em configuração. Reunir convenção, regimento e atas relevantes; estudar Código Civil, legislação locatícia, assembleias eletrônicas e LGPD, com validação jurídica quando necessária. A especificação inicial contém fontes oficiais e pontos de atenção.

Definir finalidade e base legal dos tratamentos, responsáveis por dados, retenção por categoria, acesso de fornecedores, atendimento a titulares e resposta a incidentes. Região brasileira do banco não garante localização de todo tratamento. Dados fictícios no piloto de desenvolvimento; documentos reais somente em ambiente apropriado.

## 7. Entregas por etapa

| Etapa | Entrega | Condição para avançar |
|---|---|---|
| 0 — Nome e identidade | Vilazuni escolhido; verificar marca/domínios; criar kit visual conceitual e registrar padrões | Direção visual escolhida; disponibilidade não apresentada como garantida |
| 1 — Fundação | Regras do piloto, modelo de dados, matriz de acesso, navegação, arquitetura e estimativa de custo | Vínculos, aprovações e isolamento definidos; decisões pendentes registradas |
| 2 — Primeiro módulo funcional | Webapp responsivo com login aprovado, Chandra fictício, casas, coproprietários, ocupações, veículos e vagas | Fluxo de estadia completo; testes de isolamento, revogação e datas |
| 3 — Operação | Dependências/reservas, tarefas com fotos, manutenção, ocorrências, materiais, fornecedores, encomendas e notificações | Fluxos completos com permissões e histórico; reservas/estoque sem conflitos |
| 4 — Financeiro | Despesas/receitas, contas/fundos, taxas, cobrança, acordos e conciliação com parceiro | Retornos autenticados, cálculos revisados, pagamentos duplicados/estornos tratados |
| 5 — Passeio virtual | Prova de conceito pequena iniciada durante a fundação; integração às fichas após estabilizar cadastros | Funciona em celular, respeita permissões e valida custo/captura antes de ampliar |
| 6 — IA e governança | IA consultiva, resumos/alertas e depois ações limitadas; assembleias e enquetes | Canal suporta integração oficial; avaliação de privacidade e precisão; regras de votação validadas |
| 7 — Aplicativos e acesso físico | Android/iPhone, notificações, câmeras, placas e portões em teste controlado | Testes nos dispositivos/equipamentos e procedimento para indisponibilidade |
| 8 — Distribuição | Implantação de outro condomínio, importação/exportação, planos, limites, suporte e continuidade | Segundo cliente configurável sem alterar o código por condomínio |

Os três canais orientam a arquitetura desde a etapa 1. Sensores, automação avançada e integrações adicionais ficam para expansão após validar operação e custo. Prazos serão estimados ao decompor as entregas e confirmar capacidade da equipe; não há data de lançamento prometida.

### Execução em 19/10/2026

O piloto local já implementa as jornadas da etapa 2 e parte ampla da etapa 3: tarefas com revisão/fotos, ocorrências, estoque consumível, manutenção preventiva com checklist, dependências/reservas, encomendas, fornecedores/compras com aprovação separada, documentos PDF privados com vencimentos e avisos internos. Subsíndico/administradora têm delegações por módulo; ocupante é vinculado à locação anual. Testes atuais: 58 aprovados, incluindo reinício e concorrência. A etapa 3 ainda não está encerrada: faltam evoluções operacionais (como itens múltiplos e recebimentos parciais), integração financeira e preparo para uso real; infraestrutura de produção, comunicação externa, múltiplos vínculos e governança formal seguem pendentes. Consulte STATUS_DO_PROJETO.md para limites e validações.

## 8. Primeiro ciclo de trabalho

1. Confirmar os dados e documentos disponíveis do Condomínio Chandra; enquanto isso, usar casas, pessoas e regras explicitamente fictícias.
2. Produzir matriz de permissões, modelo de dados e fluxos de convite, transferência de proprietário e estadia.
3. Definir telas iniciais: login, painel por perfil, casas, ficha da casa, pessoas, estadias, veículos/vagas e configurações.
4. Validar fornecedores, orçamento e metas de recuperação; preparar ambientes antes de receber dados reais.
5. Implementar uma jornada completa: gestor habilita proprietário → proprietário cadastra estadia → análise quando exigida → autorizações válidas → encerramento e revogação → histórico consultável.

## 9. Critérios de qualidade e lançamento

Testes de acesso cruzado, delegação, expiração e revogação; alterações concorrentes em reservas/estoque; consistência temporal de vínculos; conciliação sem duplicidade; arquivos privados; acessibilidade; funcionamento em celulares; restauração de backup; respostas da IA sem exposição indevida. Piloto real só após validação operacional e tratamento das pendências aplicáveis.

## 10. Identidade visual a produzir

Kit inicial Vilazuni: logo principal, versão compacta/ícone, versões para fundos claro e escuro, paleta e tipografia sugeridas, imagem conceitual de apresentação e guia breve de uso. Registrar prompts e arquivos finais no projeto. O Condomínio Chandra aparece como cliente/piloto, sem se confundir com a marca do produto. Não reaproveitar como finais os criativos do nome descartado VilaElo.

## 11. Pendências de decisão

Disponibilidade de marca/domínio; dados físicos e jurídicos do Chandra; quantidade de casas; regras e documentos; canal dos grupos; horários/públicos dos resumos; equipamentos de portaria; banco/parceiro de cobrança; materiais para passeio virtual; orçamento e prioridades de publicação dos aplicativos.
