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
| Operação financeira | Registro manual de receita/despesa, transferência entre contas, contas a pagar/receber, geração de rateios aprovados, baixa integral e estorno; sem controle de contas/fundos, orçamento, aprovação de rateio ou fechamento |
| Controle financeiro | Cadastro/saldo inicial, realocação de fundos, ajustes, previsões orçamentárias, rascunho/aprovação/cancelamento de rateio não gerado e fechamento; reabertura só síndico |
| Exportação financeira | Leitura e download de relatório JSON; não concede escrita |
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

As quatro delegações financeiras são independentes e limitadas ao condomínio da conta. Consulta/operação/controle/exportação conferem leitura financeira; as escritas continuam limitadas ao módulo correspondente. Demais perfis não recebem saldos ou compromissos por vínculo a casa. Acesso consultivo de moradores e prestação pública ainda dependem de fluxo próprio.

Financeiro recebe somente a referência mínima da compra recebida necessária ao compromisso, sem obter contatos ou propostas privadas. Baixas são registros manuais, sem autorização ou execução bancária. Financeiro não amplia poderes de aprovação de compra. Exportação exige módulo explícito em cada solicitação HTTP.

Fechamento usa revisão do financeiro e congela o relatório; só o síndico reabre o último mês fechado. Ajuste/reclassificação de fundos é controle; estorno exige a permissão da operação original. Cadastro de conta, transferências, baixa e estorno verificam versão e saldo; idempotência e referências impedem repetição. Registros nunca são apagados por estorno ou reabertura. Avisos continuam sujeitos ao acesso atual.

Contas a receber seguem a mesma operação financeira e privacidade por condomínio: não concedem ao morador leitura de dívida própria/alheia nem geram cobrança externa. Rateios exigem preparação/aprovação pelo controle e emissão explícita pela operação. Recebimento integral registra receita vinculada; só estorno a reabre após baixa. Previsão/revisão de orçamento exige controle financeiro e mantém histórico de valores e justificativas. Consulta, operação e exportação não concedem revisão de previsão. Fechamento congela orçamento e situação dos recebíveis; reabertura mantém relatórios anteriores. Avisos desses recursos são filtrados pela delegação atual.

Rateios: controle financeiro prepara/revisa a distribuição e registra a aprovação; operação financeira gera as contas a receber aprovadas, sem mudar os valores. Controle isolado não emite recebíveis. Consulta/exportação não escrevem. O síndico possui ambos os poderes; não há exigência de segunda pessoa para aprovar rateio neste piloto. Pagadores e pesos são informados explicitamente conforme decisão aplicável, sem inferir titularidade/fração a partir de área ou copropriedade. Acesso financeiro recebe só identificador/número das unidades, sem fichas pessoais. Após emissão, cancelamentos/estornos são individuais nos recebíveis e não apagam a distribuição original. Avisos de rateios continuam privados e filtrados pela autorização atual.
