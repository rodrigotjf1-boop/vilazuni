# Vilazuni — modelo de dados do primeiro módulo

Versão 0.1 • 17/10/2026 • desenho para implementação, ainda sem banco provisionado.

## Escopo

Primeiro ciclo: identidade, autorização, condomínio, casas, pessoas, propriedade, ocupação, estadias, veículos e estacionamento. Tarefas, financeiro e demais módulos se ligam a essa fundação nas próximas etapas.

## Convenções

Identificadores UUID gerados pelo servidor. Todo registro de negócio pertence a um condomínio (`condominio_id`); a identidade de login é global. Relações de negócio usam chaves compostas `(condominio_id, id)` para impedir vínculos entre clientes distintos. Datas operacionais usam instante com fuso; a interface apresenta America/Sao_Paulo no piloto. Intervalos são início inclusivo e fim exclusivo: na hora exata do encerramento a autorização já expirou. Datas civis de documentos são campos de data, sem conversão de fuso.

Guardar criação, alteração, autor e versão de concorrência. Exclusões físicas de registros históricos não são uma operação comum; inativação e retenção têm regras próprias. Não duplicar documentos pessoais ou usar CPF como chave de login. Cadastros de pessoas são locais ao condomínio para evitar compartilhamento implícito de dados entre clientes.

## Entidades

| Entidade | Campos essenciais | Regras |
|---|---|---|
| Identidade | id, referência no provedor de autenticação, estado | Não armazena senha própria; existência não concede acesso |
| Condomínio | id, nome, fuso, endereço, regime jurídico, situação | Piloto Chandra; enquadramento jurídico pendente |
| Pessoa | id, condomínio, nome, contatos, identificação protegida quando necessária | Pode existir sem login; menor não precisa ter conta |
| Vínculo de acesso | id, condomínio, identidade, pessoa, situação, vigência | Pendente, ativo, suspenso, revogado ou encerrado; aprovação registrada |
| Concessão de papel | id, condomínio, vínculo, papel, escopo, vigência, origem | Escopo geral ou casas especificadas; negar acesso sem concessão aplicável |
| Organização | id, condomínio, nome, tipo | Administradora do condomínio ou imobiliária de locações; poderes distintos |
| Delegação | id, condomínio, concedente, organização/agente, ações, casas, vigência | Representação documentada; sem ampliação dos poderes do concedente |
| Mandato | id, condomínio, pessoa, cargo, início, fim, documento | Síndico/subsíndico; não basta escolher cargo no perfil |
| Convite | id, condomínio, destinatário verificado, permissões propostas, emissor, expiração, hash do token | Uso único; token em claro não vai ao banco nem à auditoria |
| Solicitação de acesso | id, condomínio, solicitante, vínculo pretendido, análise e decisão | Não permite autoaprovação ou escolha livre de papel privilegiado |
| Casa | id, condomínio, identificação visível, estado | Código único por condomínio, preservado no histórico; não reutilizar unidade inativada para outra casa |
| Versão estrutural | id, condomínio, casa, vigência, áreas, pavimentos, cômodos, fotos/documentos e motivo | Histórico de reformas; nova versão não muda automaticamente rateio/voto |
| Titularidade | id, condomínio, casa, pessoa, início/fim, participação quando documentada e validação | Múltiplos coproprietários; percentual não é presumido nem obrigatório sem base |
| Ocupação | id, condomínio, casa, modalidade, responsável, estado, período | Uso próprio, residencial contínua, temporada ou outro enquadramento validado |
| Pessoa na ocupação | id, condomínio, ocupação, pessoa, relação, período individual | Sem duplicidade da mesma pessoa; período contido no da ocupação |
| Estadia | id, condomínio, ocupação, origem, referência externa, entrada/saída previstas e efetivas | Especialização da ocupação de temporada; referência externa não significa integração |
| Contrato locatício | id, condomínio, ocupação, modalidade, vigência, partes e referências documentais | Separar contrato, ocupação e autorização de acesso |
| Veículo | id, condomínio, placa normalizada, país, características necessárias | Placa não é identidade definitiva do carro; histórico para mudanças e correções |
| Veículo na ocupação | id, condomínio, ocupação, veículo, responsável, período | Diversos veículos possíveis; nenhum veículo também é válido |
| Autorização | id, condomínio, origem, beneficiário pessoa/veículo, início/fim, estado, aprovador | Derivada de regra/vínculo válido; cancelamento e saída revogam autorizações correspondentes |
| Evento de acesso | id, condomínio, autorização quando existente, equipamento, decisão, instante, origem | Imutável; negar, permitir e executar abertura são eventos diferentes |
| Área de estacionamento | id, condomínio, nome, modalidade, capacidade, estado | Fixa, livre ou mista; pode haver várias áreas |
| Vaga | id, condomínio, área, código, características, estado | Obrigatória para alocação identificada; capacidade compartilhada não exige código por posição |
| Direito de estacionamento | id, condomínio, casa, área, limite simultâneo, vigência, fundamento | Quantidade não garante disponibilidade em vagas livres |
| Atribuição de vaga | id, condomínio, vaga, casa, vigência, fundamento | Exclusividade impede sobreposição incompatível |
| Registro de ocupação de vaga | id, condomínio, área/vaga, veículo, entrada/saída, fonte | Estado desconhecido se a captura não for confiável; não inferir por autorização de placa |
| Documento | id, condomínio, referência privada, finalidade, classificação, retenção e metadados | Acesso temporário após autorização; anexos nunca públicos por padrão |
| Regra versionada | id, condomínio, tipo, conteúdo validado, início/fim, documento e aprovação | Sem regra jurídica fictícia em produção; mudanças não reescrevem o passado |
| Auditoria | id, condomínio, ator, ação, recurso, resultado, instante e correlação | Sem senhas, tokens ou cópias integrais indiscriminadas de fichas |
| Evento para processamento | id, condomínio, tipo, recurso, versão, estado e tentativas | Gravado na mesma transação da mudança; permite notificações/revogação sem perda de evento |

## Relações principais

Condomínio 1:N casas, pessoas, acessos e áreas de estacionamento. Casa 1:N versões estruturais, titularidades e ocupações. Pessoa N:N casas por titularidade e N:N ocupações por participação. Ocupação 1:N pessoas, veículos e autorizações. Identidade 1:N vínculos de acesso; cada vínculo recebe concessões específicas. Imobiliária age por agentes identificados e delegações vigentes.

## Invariantes obrigatórias

1. Criar ou alterar relação nunca aceita condomínio informado pelo cliente sem validar o contexto autenticado.
2. Titularidade e ocupação têm históricos independentes: venda não cancela locação automaticamente.
3. Períodos encerrados admitem fim igual ao instante inicial somente em eventos de cancelamento representados como estado; intervalos efetivos de uso exigem fim posterior ao início. Fim aberto apenas para vínculos que o permitam, nunca para autorização de temporada.
4. Não somar coproprietários como múltiplos votos. Regras de representação pertencem ao módulo de governança.
5. Concessão revogada, suspensão ou fim de vigência é conferido no serviço a cada operação; não confiar exclusivamente em papel gravado em token antigo.
6. Total de ocupantes resulta da relação nominal; responsável presente participa da relação uma única vez. Se o contratante não estiver presente, identificar responsável local.
7. Registrar solicitação de prorrogação não estende automaticamente autorização; aprovação atualiza vigência e registra evento atomicamente.
8. Evitar autorização duplicada ou processamento repetido com chave de idempotência. Autorização vigente exige também origem e vínculo vigentes.
9. Regra de exclusividade de ocupação da casa é configurável e validada; sinalizar sobreposição, sem assumir que qualquer ocupação simultânea é proibida.
10. Alteração concorrente usa versão e conflito explícito, sem sobrescrever silenciosamente a edição anterior.
11. Expiração funciona pela comparação de horário no servidor, mesmo se o processo agendado estiver atrasado. Dispositivos locais devem respeitar prazo e política de sincronização próprios.
12. Auditoria não substitui backup nem retenção legal; acesso de suporte é excepcional, limitado e registrado.

## Banco e segurança antes de implementação

Gerar migração PostgreSQL com chaves, índices por condomínio e período, verificações de intervalos e exclusividade de atribuições fixas. Implementar políticas no banco e autorização no serviço antes de expor consultas. Serviço de negócio medeia aprovações e alterações sensíveis. Testar isolamento de registros, arquivos, exportações, buscas e eventos. SQL e configuração do provedor serão produzidos após definir o ambiente de execução; este documento não é uma migração executável.
### Registros locais da primeira entrega da etapa 6 — 20/10/2026

`knowledgeSources`: fonte por condomínio com controle de versão, disponibilidade, número da publicação atual, revisões imutáveis e histórico. Cada revisão guarda texto, referência, público, vigência, hash e dados de preparação/publicação. Rascunhos e revisões antigas ficam somente no escopo de gestão de fontes; a projeção comum contém apenas a publicação vigente permitida.

`knowledgeBriefings`: retrato por dia/público/conjunto de módulos, com versão, referências e hashes das fontes, contagens autorizadas, instante e responsável pela preparação. Revisões anteriores ficam na base para auditoria restrita, fora da projeção de leitura. A leitura confere os módulos atuais e a validade de todas as fontes citadas. Preparação interna não representa envio ou ciência em canal externo.

`consultativePolls`: pergunta, contexto, opções identificadas, público, encerramento, situação e histórico. Respostas internas guardam conta, opção e instante; uma resposta por conta. As projeções retornam somente totais quando permitidos e a própria escolha. Esse registro não modela votos legais por unidade, fração, copropriedade ou procuração.

Perguntas e resultados da consulta local não são persistidos. Nenhuma dessas coleções concede acesso ao conteúdo de documentos privados ou aos demais módulos. A persistência JSON e os limites do piloto estão descritos em [ETAPA_6_FONTES_E_GOVERNANCA.md](ETAPA_6_FONTES_E_GOVERNANCA.md); migrações, retenção e armazenamento de produção permanecem pendentes.
