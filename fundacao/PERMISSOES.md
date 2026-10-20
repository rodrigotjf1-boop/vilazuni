# Vilazuni — matriz de permissões inicial

Versão 0.1 • regras propostas para validação do piloto.

## Política vigente do piloto — 19/10/2026

A tabela de fundação abaixo continua sendo a direção do produto. A implementação atual atende oito perfis; detalhes atuais prevalecem sobre os históricos de 18/10:

| Módulo/ação | Política atual |
|---|---|
| Identidades e concessão de delegação | Exclusivamente síndico; não há convite para síndico ou autoelevação |
| Subsíndico/administradora | Somente módulos concedidos, com motivo e validade; atualizar revoga sessões; sem delegação em cadeia |
| Pessoas e estadias | Delegações independentes; permissão de pessoas não libera estadias nem vice-versa; ambas abrangem o condomínio |
| Tarefas/manutenção | Tarefas do condomínio para gestão delegada em tarefas; zelador somente atribuições próprias; gerar preventiva requer ambos os módulos; checklist recomeça ao reatribuir |
| Materiais | Gestão de materiais cadastra/recebe; consumo exige também acesso à tarefa; zelador somente tarefas próprias; histórico geral só gestão |
| Relatos privados | Autor e gestão com módulo ocorrências; delegar este módulo libera os relatos do condomínio, explicitamente informado |
| Ocupante | Vínculo anual vigente, prazo de acesso e uma casa; identificação da casa sem ficha de terceiros; encerramento do vínculo invalida login |
| Reservas | Moradores/proprietários/imobiliárias solicitam dentro das casas autorizadas; gestão de dependências decide/interdita; terceiros veem apenas intervalos ocupados |
| Encomendas | Portaria/gestão opera; destinatário com conta vê apenas as próprias encomendas e precisa manter vínculo à casa; copropriedade não amplia acesso |
| Compras e fornecedores | Preparação por módulo próprio; aprovador separado, com limite explícito; sem autoaprovação, mesmo para síndico; contatos do fornecedor apenas a quem prepara |
| Recebimento de compra | Preparação e, para consumíveis, acesso a materiais; gravação única de estoque e compra; versão atual obrigatória |
| Documentos privados | Somente contas com módulo de documentos; responsável precisa manter acesso; download de cada versão autenticado por condomínio; moradores não recebem arquivos ou prazos |
| Consulta financeira | Leitura de contas/fundos, lançamentos, contas a pagar/receber, orçamento e relatórios; sem escrita/exportação explícita |
| Operação financeira | Registro manual de receita/despesa, transferência entre contas, contas a pagar/receber, geração de rateios aprovados, baixa integral/parcial, proposta/ativação de acordo, estorno, emissão/cancelamento de aviso manual e preparação de lembretes; sem controle de contas/fundos, orçamento, regras/encargos ou fechamento |
| Controle financeiro | Cadastro/saldo inicial, realocação de fundos, ajustes, orçamento, rascunho/aprovação/cancelamento de rateio não gerado, modelos recorrentes, aprovação/cancelamento de acordos, conciliação, vínculo de pagador, suspensões/análises, régua, regras/apurações de encargos e fechamento; reabertura só síndico |
| Exportação financeira | Leitura e download de relatório JSON; não concede escrita |
| Cobrança privada do pagador | Proprietário/imobiliária/ocupante recebe somente avisos destinados explicitamente à conta; pode contestar/informar pagamento/comentar suas análises; sem razão, contas, fundos, saldo geral ou dívidas de terceiros |
| Avisos internos | Individuais e filtrados pela autorização atual; leitura não altera avisos de terceiros; sem envio externo |

A concessão manual do piloto não verifica mandato nem titularidade documental. Múltiplos vínculos por conta, substituição formal do síndico, recuperação de conta e MFA continuam pendentes.

## Fundação e histórico

Toda permissão exige identidade autenticada, vínculo ativo, condomínio correto, finalidade e vigência. Negação é o padrão. O cliente não escolhe seu papel. Dados disponíveis na ficha dependem da ação, não apenas da visibilidade da casa na lista.

| Ação | Síndico | Subsíndico | Administradora habilitada | Proprietário | Imobiliária de locação | Ocupante | Zelador/portaria |
|---|---|---|---|---|---|---|---|
| Cadastrar/alterar casa e estrutura | Sim | Delegado | Delegado | Solicita correção na sua casa | Solicita nas casas delegadas | Não | Não |
| Validar titularidade/transferência | Sim | Delegado | Delegado | Submete documentos da sua casa | Submete se delegado | Não | Não |
| Convidar/aprovar usuários comuns | Sim | Delegado | Conforme habilitação | Solicita; não aprova vínculo por padrão | Só no alcance expressamente delegado | Não | Não |
| Conceder cargo de gestão | Processo de mandato verificado | Não por padrão | Processo de habilitação | Não | Não | Não | Não |
| Cadastrar estadia | Dentro das atribuições | Delegado | Delegado | Suas casas com vínculo válido | Casas e ações delegadas | Pré-cadastro próprio por convite | Não |
| Autorizar estadia quando houver análise | Sim, conforme regra | Delegado | Delegado | Não por padrão | Não por padrão | Não | Só se houver atribuição específica |
| Consultar ficha de estadia | Necessário à gestão | Escopo delegado | Escopo delegado | Suas casas e finalidade | Escopo delegado | Sua participação e informações necessárias | Dados mínimos operacionais |
| Alterar pessoa/veículo da estadia | Gestão auditada | Delegado | Delegado | Suas casas; nova análise quando exigida | Escopo delegado | Solicita alteração | Registra divergência; não altera identidade livremente |
| Registrar entrada/saída | Operação autorizada | Delegado | Delegado | Consulta limitada | Consulta limitada | Sem autoconfirmação definitiva | Operador autorizado; zelador não recebe por padrão |
| Atribuir vagas/direitos | Conforme documentos | Delegado | Delegado | Consulta sua unidade | Consulta delegada | Consulta autorização aplicável | Operação mínima |
| Consultar histórico | Finalidade e período necessários | Delegado | Delegado | Limites da unidade/vínculo; sem documentos privados anteriores por padrão | Limites de delegação | Próprios dados permitidos | Somente necessidade operacional |
| Exportar dados | Permissão específica | Delegado explicitamente | Delegado explicitamente | Exportação limitada autorizada | Escopo explícito | Próprios dados pelo fluxo aplicável | Não por padrão |

O cadastro de cargos e delegações não autoriza ninguém a ampliar seus próprios poderes. O primeiro síndico ou administradora é habilitado no processo de implantação por operador autorizado, com evidência e auditoria; a conta técnica da plataforma não possui consulta livre aos dados.

## Matriz por campo

- Lista geral de casas: identificação e características liberadas; dados de ocupantes não são públicos automaticamente.
- Gestão: dados pessoais necessários à função; documentos e relatos sigilosos exigem permissão adicional.
- Proprietário: ficha de suas unidades e estadias pertinentes; não acessa dados privados das demais casas.
- Ocupante: suas autorizações, regras, período e serviços permitidos; não recebe lista completa de documentos dos demais hóspedes.
- Portaria: nomes necessários à conferência, casa, período, veículos autorizados e estado; documento completo apenas quando necessário e previsto no procedimento.
- Zelador: tarefas e local; sem documentos, contatos particulares e fichas completas por padrão.
- Grupo: conteúdo compatível com todos os participantes; cargo do solicitante não amplia visibilidade do público.

## Casos de teste indispensáveis

### Implementação local de 18/10/2026

O piloto aplica autenticação e autorização no servidor para cinco perfis: síndico, proprietário, imobiliária de locação, portaria e zeladoria. Os demais perfis da matriz continuam planejados. Convites de usuários comuns são emitidos exclusivamente pelo síndico; nenhum convite concede cargo de gestão. Imobiliária exige casas explícitas e data de término. O vínculo é verificado a cada requisição; suspensão invalida sessões e não existe autoampliação de escopo.

As credenciais são configuradas pelas próprias pessoas no aplicativo. A conta inicial somente pode ser criada uma vez na base local. Não há recuperação de senha por e-mail nesta etapa: a troca autenticada exige a senha atual. Convites não são enviados automaticamente. Uma conta pertence a um condomínio neste piloto; múltiplos vínculos ainda não estão implementados.

Sessões: token opaco de 32 bytes, cookie HttpOnly/SameSite=Strict, prazo absoluto de oito horas e ociosidade de trinta minutos verificados no servidor. Reiniciar o servidor encerra sessões. Alterar a senha encerra as sessões anteriores. Operações de escrita exigem origem local exata; tentativas de autenticação são limitadas. Dados de domínio e senhas não são disponibilizados pela rota de arquivos estáticos. Senhas usam scrypt com salt individual; códigos de convite são persistidos como hash. A API local não substitui PostgreSQL, RLS, HTTPS e revisão de segurança necessários à distribuição.

Referência técnica consultada: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Esta base HTTP é restrita ao loopback; Secure deverá ser obrigatório na implantação HTTPS.

Usuário do Chandra tenta consultar casa de outro condomínio; proprietário tenta trocar o id para uma casa alheia; imobiliária com delegação encerrada usa sessão antiga; usuário suspenso redefine senha; ocupante consulta após saída; portaria tenta exportar fichas; gestor tenta aprovar a própria promoção; usuário em dois condomínios muda contexto; arquivo privado é aberto sem permissão; mensagem de grupo pede dados restritos. Todos devem negar o acesso indevido, com registro adequado e sem revelar a existência de dados de outro cliente.


### Vínculos residenciais

Somente síndico cadastra/atualiza/encerra proprietários. Proprietários e imobiliárias de locação podem cadastrar, atualizar e encerrar vínculos anuais nas casas já atribuídas à sua conta. Casa e tipo do vínculo não podem ser trocados por edição. Atualizações exigem motivo e guardam a versão anterior para a gestão; encerramentos exigem data efetiva entre início e hoje e motivo. Registros encerrados não são retornados aos demais perfis. Portaria e zeladoria recebem lista vazia de vínculos residenciais. Convites e permissões de login não são derivados automaticamente da ficha administrativa.


### Zeladoria implementada no piloto local

- Síndico: cria, atribui, acompanha, revisa e cancela tarefas do seu condomínio.
- Zelador: consulta e executa apenas tarefas atribuídas à própria conta; envia fotos e solicita revisão. Não aprova a própria execução.
- Proprietário, imobiliária e portaria: sem acesso às tarefas ou fotos de zeladoria nesta etapa.
- Fotos: autorização conferida no servidor em cada leitura, sem URL pública. Reatribuição remove o acesso do responsável anterior e mantém as evidências no histórico da gestão e do novo responsável.

### Ocorrências implementadas — 19/10/2026

Os cinco perfis disponíveis abrem relatos identificados. Leitura e comentários limitados ao autor e à gestão do mesmo condomínio. Outros proprietários da unidade e operadores não recebem relatos de terceiros. Casa opcional validada pelo escopo no servidor; portaria e zeladoria abrem relatos de local sem vínculo residencial. Somente gestão atribui (a outra conta de gestão ativa ou a si), altera andamento, encerra ou reabre com justificativa. Registros encerrados não aceitam comentários até reabertura. Todas as alterações exigem versão atual e têm histórico compartilhado com o autor. Não há anônimo nem notas internas ocultas nesta etapa.

### Materiais e estoque — 19/10/2026

Gestão cadastra materiais e registra entradas; gestão e zeladoria consultam saldo/local/mínimo do próprio condomínio. Somente gestão consulta todos os movimentos; zeladoria recebe apenas os movimentos registrados por sua conta. Consumo exige tarefa aberta (a fazer/em execução) no mesmo condomínio; zeladoria precisa ser o responsável atual. Gestão pode registrar consumo nas tarefas abertas do condomínio. Demais perfis recebem lista vazia e não podem escrever. Cada consumo confere versões de material e tarefa e grava ambos atomicamente na persistência local. Histórico de consumo da tarefa acompanha as regras existentes de acesso/reatribuição da tarefa.

### Compras e documentos — 19/10/2026

Preparação de compras não concede aprovação nem acesso a arquivos; aprovação não concede edição de fornecedores, recebimento ou contatos do cadastro. O módulo de materiais é necessário para compras vinculadas a estoque; relacionar uma tarefa exige acesso a tarefas. Cada aprovador delegado tem limite em centavos, validado ao conceder/alterar e novamente ao aprovar. Mesmo o síndico não aprova compra que preparou ou proposta que registrou. Cotação única requer justificativa. Recebimento usa a proposta aprovada, valida versões de compra e estoque e não cria movimento financeiro.

Documentos só são visíveis à gestão explicitamente autorizada no módulo. Cada leitura binária confere o acesso atual e a integridade, sem URL pública. A projeção de estado omite conteúdo base64 de todas as versões. Arquivamento não libera arquivos nem elimina histórico. Avisos de compras/documentos acompanham as mesmas permissões; prazos de documentos são derivados do dia atual de Brasília, não enviados externamente.

### Base financeira — 19/10/2026

As quatro delegações financeiras são independentes e limitadas ao condomínio da conta. Consulta/operação/controle/exportação conferem leitura financeira; as escritas continuam limitadas ao módulo correspondente. Demais perfis não recebem saldos ou compromissos por vínculo a casa. O portal de cobrança dá acesso somente ao aviso destinado explicitamente à conta, sem prestação de contas geral. Prestação pública aos moradores continua pendente.

Conciliação por extrato: somente controle (`financeClose`) confere a prévia, importa CSV, vincula/ignora/desfaz movimentos e cancela extratos. Consulta, operação e exportação podem ler dados normalizados/histórico, sem escrever. Exportar relatório continua exigindo `financeExport`. Importação não cria receitas/despesas ou baixas; cada vínculo exige mesma conta, valor com sinal, versões atuais e exclusividade por conta. Alterações respeitam mês aberto e justificativa; cancelamento preserva histórico. Extratos e avisos usam condomínio/delegação atual, inclusive após revogação. Fechamento congela cobertura e ressalvas disponíveis, podendo ser feito com conciliação incompleta; reabertura preserva a versão anterior. O conteúdo é fornecido pelo operador, sem autenticação pelo banco.

Financeiro recebe somente a referência mínima da compra recebida necessária ao compromisso, sem obter contatos ou propostas privadas. Baixas são registros manuais, sem autorização ou execução bancária. Financeiro não amplia poderes de aprovação de compra. Exportação exige módulo explícito em cada solicitação HTTP.

Fechamento usa revisão do financeiro e congela o relatório; só o síndico reabre o último mês fechado. Ajuste/reclassificação de fundos é controle; estorno exige a permissão da operação original. Cadastro de conta, transferências, baixa e estorno verificam versão e saldo; idempotência e referências impedem repetição. Registros nunca são apagados por estorno ou reabertura. Avisos continuam sujeitos ao acesso atual.

Contas a receber seguem a mesma operação financeira e privacidade por condomínio: o cadastro não concede leitura ao morador nem gera cobrança externa. Consulta individual depende de vínculo explícito e aviso privado pelo fluxo de cobrança manual; dívida alheia e saldos gerais continuam indisponíveis. Rateios exigem preparação/aprovação pelo controle e emissão explícita pela operação. Recebimento integral/parcial registra receita vinculada; só estorno a reabre após baixa. Previsão/revisão de orçamento exige controle financeiro e mantém histórico de valores e justificativas. Consulta, operação e exportação não concedem revisão de previsão. Fechamento congela orçamento e situação dos recebíveis; reabertura mantém relatórios anteriores. Avisos desses recursos são filtrados pela delegação atual.

Rateios: controle financeiro prepara/revisa a distribuição e registra a aprovação; operação financeira gera as contas a receber aprovadas, sem mudar os valores. Controle isolado não emite recebíveis. Consulta/exportação não escrevem. O síndico possui ambos os poderes; não há exigência de segunda pessoa para aprovar rateio neste piloto. Pagadores e pesos são informados explicitamente conforme decisão aplicável, sem inferir titularidade/fração a partir de área ou copropriedade. Acesso financeiro recebe só identificador/número das unidades, sem fichas pessoais. Após emissão, cancelamentos/estornos são individuais nos recebíveis e não apagam a distribuição original. Avisos de rateios continuam privados e filtrados pela autorização atual.

Baixas parciais continuam na operação financeira, com referência/versão individual e saldo restante calculado pelo razão. Acordos: operação prepara proposta/ativa parcelas, controle aprova/cancela; consulta/exportação não escrevem. Ativação usa saldo e versão de origem aprovados, sem principal/encargos arbitrários do cliente. Origem em acordo bloqueia baixa/estorno; cancelamento ativo exige parcelas sem baixas líquidas e restaura residual sem alterar recebimentos anteriores. Parcelas mantêm termos e não são renegociadas/canceladas isoladamente. Modelos recorrentes exigem controle para cadastro/revisão/pausa e preparação de competência; cada rateio preparado ainda exige sua própria aprovação e emissão pela operação. Escopo por condomínio e filtragem atual dos avisos também se aplicam a acordos/modelos.

### Cobrança manual e encargos — 20/10/2026

O usuário optou por manter cobrança manual. Controle vincula uma conta residencial ativa ao recebível, com fundamento; rateios por unidade exigem acesso dessa conta à unidade. Operação emite aviso privado e orientações, sem execução bancária. Nenhum coproprietário/ocupante é inferido como devedor ou destinatário. Troca/remoção de vínculo cancela avisos anteriores e revoga consulta e notificações; relatos antigos não são transferidos ao novo pagador. Parcelas e encargos preservam o vínculo explícito da origem na criação; mudanças posteriores são individuais por recebível.

O destinatário vê apenas a projeção das próprias cobranças, pode contestar ou informar pagamento e acompanhar seus relatos. Informar pagamento não cria receita/baixa. Controle trata/resolve análises e suspensões; acompanhamentos são compartilhados com o destinatário vigente. Operação/consulta/exportação leem as análises do condomínio, sem poderes para resolver. Análise aberta ou suspensão administrativa impede novos avisos/lembretes/encargos e renegociação da origem. Resolver análise não dá baixa ou retira suspensão independente. Nenhum desses estados bloqueia acesso físico.

Controle configura a régua; operação prepara manualmente avisos internos do dia, somente para destinatários vigentes e saldos abertos sem suspensão/análise. Idempotência por recebível/vencimento/dia impede repetição. Regras de encargos exigem controle e aprovação por outra pessoa com controle, inclusive quando o autor é síndico. Aplicação/cancelamento também exige controle e preserva memória, sem conceder operação financeira geral. Juros simples anuais / 365 e multa única dependem do fundamento, vigência e percentuais explicitamente validados; não há taxa legal presumida. Encargo gera recebível separado; não modifica principal/caixa e não produz juros sobre encargos. Baixa, estorno, revisão de termos ou ativação de acordo em data coberta por apuração ativa exige revisar/cancelar a apuração antes de alterar a base.

Relatórios fechados preservam faixas de atraso, agrupamentos por unidade/competência, previsão, análises, avisos, lembretes e apurações no corte. Critérios e limites: [ETAPA_4_FINANCEIRO.md](ETAPA_4_FINANCEIRO.md). Integração com parceiro e retornos autenticados estão adiados; o piloto não os apresenta como validados.

### Passeio contextual — 19/10/2026

O servidor filtra catálogo e ficha por condomínio, unidade e módulo. Exteriores ilustrativos não concedem leitura de moradores/estadias ou atributos residenciais alheios. Catálogo não contém nomes, contatos, hóspedes, documentos ou placas; cada atalho revalida a ficha atual e atualiza a projeção antes de abrir o módulo. Portaria recebe somente campos operacionais e autorizações da casa escolhida; ocupante não recebe fichas pessoais/estadias. Gestão com apenas dependências/encomendas recebe na projeção auxiliar de casas somente identificação mínima para sua operação, sem área/quartos/proprietários.

Vincular dependência ao marcador exige `facilities`, registro do mesmo condomínio, versão atual e justificativa. Cada dependência ocupa no máximo um marcador, sem associação por nome. Troca/remoção conserva histórico; somente gestão de dependências recebe histórico e IDs de configuração do vínculo. Moradores consultam regras/agenda pelo fluxo de reservas já autorizado. Interdição é consultada/atualizada na ficha e continua bloqueando reserva no servidor. Sem esse módulo, o marcador não retorna regras ou situação privadas. Outros condomínios não recebem o cenário cadastral do Chandra.

Toque, teclado, interiores, mapa/lista e falta/perda de WebGL usam as mesmas fichas e validações; nenhum modo amplia poderes. Sessão expirada/revogada é recusada também nas rotas do passeio. Respostas atrasadas de outro painel/sessão não reabrem fichas após saída. Preferência visual é salva sem dados privados. Critérios: [ETAPA_5_PASSEIO_VIRTUAL.md](ETAPA_5_PASSEIO_VIRTUAL.md).

### Fontes, resumos internos e enquetes — 20/10/2026

`knowledge` (Fontes revisadas e resumos internos) e `governance` (Enquetes consultivas) são delegações independentes, concedidas somente pelo síndico, com validade/revogação existentes. Não ampliam módulos de documentos, pessoas, financeiro ou tarefas. Síndico possui as duas; gestão delegada existente não as recebe automaticamente.

Todos os usuários autenticados recebem somente fontes publicadas, ativas e vigentes para todas as contas. `knowledge` permite também fontes da gestão e seus rascunhos/históricos. Consulta direcionada à comunidade usa somente fontes comunitárias, mesmo para síndico. Referência antiga não concede acesso a revisão retirada, rascunho ou texto restrito. PDFs privados não são publicados por serem cadastrados como referência textual.

Resumo comunitário usa somente fontes liberadas para todas as contas. Resumo privado exige `knowledge` e todos os módulos dos indicadores incluídos, reavaliados em cada leitura. Fonte retirada, expirada ou substituída oculta o resumo anterior; histórico integral permanece na base, fora da API pública de leitura. Consultas/prévias não persistem perguntas ou resultados. Conteúdo de fonte é dado, sem executar comandos ou ampliar acesso.

Gestão com `governance` publica e encerra/cancela enquetes consultivas no condomínio. Público é definido na publicação: proprietários/ocupantes, ou todas as contas. Uma resposta por conta, sem voto por unidade/quórum. Gestão consulta totais durante a coleta; participantes somente ao encerrar. Nenhum perfil recebe pela API a relação de respostas individuais. Resposta guarda conta e data na base; não prometer anonimato. Permissão, prazo e opção são reavaliados em cada envio, inclusive concorrente ao encerramento.

Canal externo, modelo generativo, envio de resumos, ações assistidas e assembleias com representação formal não estão habilitados por essas delegações. Ver [etapa 6](ETAPA_6_FONTES_E_GOVERNANCA.md).
