# Etapa 6 — fontes, consultas e enquetes do piloto

Atualização: 20/10/2026, horário de Brasília. Primeira entrega da etapa 6 no piloto local. As etapas 4 (cobrança manual) e 5 (passeio 3D ilustrativo) continuam concluídas nos respectivos escopos.

## Entrega e limites

| Frente | Estado nesta entrega |
|---|---|
| Fontes de consulta | Texto transcrito pela gestão, origem/trecho, público, vigência, revisões e publicação após conferência registrada |
| Consulta fundamentada | Busca local por palavras, sem diferenciar acentos, em fontes publicadas e vigentes. Retorna até cinco trechos literais com referência, revisão, hash e data da consulta |
| Resumos internos | Prévia sem gravação; confirmação manual por dia/público/escopo, sem duplicar uma versão idêntica. Contagens privadas dependem dos módulos autorizados |
| Enquetes consultivas | Pergunta/opções/público/prazo fixos, uma resposta por conta, encerramento/cancelamento justificado e resultados agregados |
| Modelo de IA | Pendente de escolha do fornecedor, avaliação de precisão/privacidade/custo e configuração no servidor. A busca local não é um modelo generativo nem uma interpretação jurídica |
| Canal externo | Canal, grupos, participantes, suporte oficial e horários ainda pendentes. Não há bot, envio, agendamento ou confirmação de entrega externa |
| Assembleias formais | Pendentes de regime jurídico, convenção, representação, quóruns por matéria, convocação, regras de voto e validação aplicável. Enquete não é deliberação |
| Ações assistidas e alertas | Consulta não executa operações. Acompanhamento com comandos, alertas com triagem e ações limitadas continuam na etapa 6 |

## Fontes e consulta

O síndico pode operar as fontes. Subsíndico/administradora precisam da nova delegação **Fontes revisadas e resumos internos** (`knowledge`). Delegações existentes não recebem esse módulo automaticamente. Esta delegação não dá acesso aos PDFs de Documentos, ao financeiro ou às fichas de pessoas.

Em **Consultar → Fontes → Preparar fonte**, informar título, documento e trecho de origem, texto conferido, público, vigência e motivo. O padrão é **Gestão de fontes**, restrito a `knowledge`. **Todos os usuários do condomínio** inclui todas as contas autorizadas do condomínio, inclusive operadores e imobiliárias; conferir o conteúdo antes de escolher esse público.

Salvar cria rascunho. Publicar exige confirmação da revisão humana, motivo e vigência atual. A publicação registra autor e data; não comprova autenticidade do documento nem substitui validação jurídica. PDFs privados não são extraídos, importados ou tornados públicos por essa operação. Usar somente material sintético no ambiente local até preparar a infraestrutura para dados reais.

Nova revisão em rascunho preserva a publicação anterior. Publicar substitui a revisão usada nas próximas consultas; retirar a fonte interrompe sua consulta. Reativar conserva a publicação e o histórico, sujeito à vigência. O último dia de vigência é inclusivo, no fuso de Brasília. Somente a gestão de fontes consulta revisões antigas, rascunhos e histórico administrativo.

Em **Consultar fontes**, informar uma pergunta e escolher **Meu acesso** ou **Todos os usuários do condomínio**. O segundo público filtra fontes restritas mesmo quando o solicitante é o síndico. A busca mostra trechos, não uma resposta sintetizada: conferir o contexto na fonte. Sem correspondência, informa a ausência e orienta consultar a gestão. Mensagens e documentos são tratados como dados; conteúdo não altera permissões nem dispara ações.

Perguntas e resultados de busca não são persistidos. Consultas e prévias não escrevem na base. Não há chamada a modelo, pesquisa externa ou envio de conteúdo a fornecedor nesta entrega.

## Resumos por público

Em **Consultar → Resumos internos**, gestão com `knowledge` escolhe o público, confere a prévia e salva. A versão comunitária inclui somente fontes expressamente publicadas para todas as contas; não inclui indicadores operacionais, nomes, hóspedes, placas, cobranças ou denúncias vindos desses módulos.

A versão de gestão inclui fontes restritas permitidas e os seguintes indicadores, somente com a delegação correspondente:

- Tarefas: quantidade aberta e em atraso, sem nomes ou descrições.
- Materiais: quantidade de materiais abaixo do mínimo.
- Preventiva: planos ativos cujo prazo de geração chegou.
- Documentos: quantidade de alertas de vencimento, sem títulos ou PDFs.

Até dez fontes são incluídas, pela ordem de cadastro, com seu primeiro parágrafo limitado a 300 caracteres. O resumo não substitui a consulta completa das fontes. Não inclui automaticamente regras de dependências, dados financeiros, ocorrências ou reservas. Qualquer texto liberado à comunidade continua dependendo da revisão humana de publicação da fonte.

Cada resumo preserva dia, público, módulos necessários, fontes/revisões/hashes, indicadores e instante de geração. Confirmação revalida a prévia e a versão existente; alterações concorrentes exigem nova prévia. Repetir um conteúdo idêntico com a versão atual reutiliza o mesmo registro. Atualizar o conteúdo cria nova revisão no mesmo registro diário, conservando o retrato anterior na base para auditoria restrita. A interface mostra somente a revisão atual.

Leitura revalida condomínio, público e todos os módulos usados no resumo privado. Retirar, expirar ou substituir uma fonte citada oculta o resumo anterior inteiro; preparar nova prévia para publicar um resumo atual. O retrato de indicadores conserva sua data de geração, não é atualizado silenciosamente na leitura. Retirar delegação ou suspender a conta interrompe os acessos correspondentes.

**Preparado no aplicativo** é o estado do registro; não equivale a envio, leitura ou ciência em grupo. Não há rotina de fundo nem calendário externo.

## Enquetes de opinião

Em **Enquetes**, o síndico ou gestão com a nova delegação **Enquetes consultivas** (`governance`) publica pergunta, contexto, duas a seis opções, público, prazo e motivo. Essa delegação não concede acesso a fontes restritas, documentos ou cadastros de moradores.

Públicos: **Proprietários e ocupantes**, ou **Todas as contas autorizadas**. Imobiliária, portaria, zeladoria e gestão só participam quando o segundo público é escolhido. Gestão de enquetes pode acompanhar resultados do seu condomínio mesmo sem pertencer ao público participante.

Uma conta registra uma opinião, mesmo que possua várias casas. Contas distintas de coproprietários registram opiniões distintas. Não há peso por fração, mandato, procuração, quórum ou validação de titularidade para assembleia. A interface e a API identificam expressamente esse caráter consultivo.

Resposta não pode ser alterada; repetição idêntica não duplica a opinião. As opções ficam fixas depois da publicação. Gestão acompanha os totais durante a consulta; participantes recebem os totais ao encerrar por prazo ou decisão. Cancelamento conserva respostas e histórico. A consulta pode durar até noventa dias.

Respostas são identificadas internamente pela conta, com data. A interface não promete anonimato: mostra somente os totais e a própria escolha; nenhum perfil recebe a relação de respostas individuais pela API. Permissão e público são conferidos em cada leitura/envio, e a fila de gravação resolve disputas entre resposta e encerramento.

## Validação e capacidade do piloto

`npm test --prefix app`: 186 testes aprovados, incluindo 21 novos de fontes, resumos, enquetes e API. Cobrem isolamento entre condomínios/perfis, vigência de Brasília, ausência de evidência, conteúdo tratado como texto, versões, concorrência, revogação, persistência/reinício e consultas/prévias sem gravação.

Conferência em Chromium desktop e emulação móvel com toque: rascunho/publicação/revisão, consulta com referência, público completo, resumos e retirada de fonte, enquete/resposta/encerramento, delegações e navegação após consultas atrasadas. Conferência em 320 pixels para o painel. A homologação em aparelhos físicos continua no preparo para uso real.

Limites por condomínio: cem fontes, vinte revisões por fonte, 12.000 caracteres por texto e 1 MiB de textos somando revisões; 366 registros de resumo no total, cada um identificado por dia/público/escopo, com até dez revisões por registro; duzentas enquetes. A base JSON local continua sendo a persistência do piloto. Retenção, exportação, descarte e políticas de arquivo de produção permanecem pendentes.

Não foi contratado modelo, canal ou serviço novo. Não há tarifa de modelo/mensagem nesta entrega local; custos de implantação, hospedagem e suporte permanecem próprios. Antes da integração, estimar volume × contexto × preço vigente do modelo, além de mensagens, armazenamento e revisão, com limites de consumo e cotações datadas.

Prévias sintéticas: [consulta](../previa-consulta-fontes.png), [consulta no celular](../previa-consulta-fontes-mobile.png), [resumos](../previa-resumos-internos.png) e [enquete no celular](../previa-enquete-consultiva-mobile.png).

## Decisões para continuar a etapa 6

Do usuário: município/UF, regime jurídico do Chandra e identificação dos documentos aprovados; canal pretendido, grupos/públicos e horários dos resumos. Essas perguntas foram adiantadas, sem presumir uma resposta. Enquanto não forem definidos, o piloto permanece interno e usa fontes sintéticas.

Depois: validar suporte oficial do canal e identificação dos participantes; escolher modelo, política de dados, orçamento e configuração segura no servidor; montar avaliação de respostas corretas, ausência de fontes, fontes contraditórias e tentativas de ampliar acesso. Só então habilitar síntese generativa e envios. Credenciais devem ser configuradas em ambiente seguro, nunca copiadas para código ou conversa.

Assembleias exigem ainda representação por unidade, copropriedade, procurações e validade de poderes, quóruns por matéria e regras de convocação/voto/ata conferidas. Nenhuma dessas condições foi presumida a partir das enquetes. A etapa 6 continua aberta nessas frentes; não avançar o roadmap para a etapa 7 como se estivessem concluídas.
