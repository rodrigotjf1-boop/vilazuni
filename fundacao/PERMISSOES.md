# Vilazuni — matriz de permissões inicial

Versão 0.1 • regras propostas para validação do piloto.

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
