# Vilazuni — especificação da plataforma de gestão de condomínios

Versão 0.1 • 17/10/2026 • Brasil

Documento de definição do produto. Ainda não representa um sistema implementado. O condomínio de demonstração usará dados fictícios.

Nome escolhido: **Vilazuni**. Condomínio piloto: **Condomínio Chandra**. Plano consolidado e sequência de execução: PLANO_DO_PROJETO.md. Marca e domínio ainda precisam de verificação específica.

## 1. Regra central confirmada

As casas podem variar, inclusive em estrutura e características. Proprietários e inquilinos também são variáveis. Cada casa mantém uma identidade estável enquanto existir como unidade cadastrada.

A casa possui identificador próprio e ficha histórica. Uma venda ou troca de inquilino encerra vínculos anteriores e cria novos; não substitui a casa nem apaga o histórico. O cadastro permite incluir casas, atualizar suas características e inativar unidades, preservando os registros. Alterações estruturais são versionadas com data, descrição, documentos e responsável; divisão ou união de unidades exige registrar a relação entre as unidades de origem e as resultantes.

Cada casa pode ter área de terreno e construída, pavimentos, quartos, banheiros, vagas, anexos, planta, fotos, acessibilidade e outras características próprias. Campos adicionais podem ser configurados por condomínio. Alteração física não modifica automaticamente fração ideal, rateio ou direito de voto: essas mudanças dependem da documentação e aprovação aplicáveis.

Uma casa pode ter vários proprietários simultâneos, incluindo casal ou outros coproprietários. Uma pessoa pode possuir várias casas. Ser cônjuge ou morador não torna alguém automaticamente proprietário: os vínculos precisam ser registrados conforme a documentação.

Uma pessoa pode ser proprietária e ocupante. Uma casa desocupada mantém seus proprietários. A ausência de inquilino não comprova que a casa está vazia.

## 2. Produto e canais

Plataforma para vários condomínios, começando por um condomínio exemplo de casas. Acesso por webapp e aplicativos Android e iPhone, com o mesmo serviço central de dados e permissões. Cada condomínio terá cadastros, regras, usuários, documentos e integrações isolados.

O acesso depende de papel, condomínio, casa, delegação, finalidade e vigência. RBAC define os papéis; regras adicionais limitam o alcance de cada permissão. Nenhuma interface, inclusive a navegação 3D, pode contornar essas verificações.

## 3. Cadastros e relações

| Registro | Conteúdo e comportamento |
|---|---|
| Condomínio | Identidade, endereço, natureza jurídica, convenção, regimento, regras e versões |
| Casa/unidade | Identificador permanente, número, localização, características, documentos e ponto no passeio virtual |
| Dependência/área comum | Piscina, depósito, sala de jogos, academia, sala de festas ou outro tipo configurável; ficha, localização, regras e situação |
| Reserva de dependência | Espaço, responsável, unidade, período, aprovação quando exigida, participantes quando necessários e situação |
| Estacionamento e vaga | Localização, identificação quando houver, modalidade de uso, vínculo com casa, restrições e situação |
| Assistente de IA e grupo | Canal, grupo autorizado, participantes/público, horário dos resumos, escopo de consulta e ações permitidas |
| Pessoa | Identidade, contatos e dados estritamente necessários; dados reais somente após definição de finalidade e proteção |
| Titularidade | Casa, proprietário, início e fim, participação quando aplicável, documento e situação de validação |
| Ocupação | Casa, modalidade, período previsto e efetivo, responsável e situação |
| Pessoa na ocupação | Ocupação, pessoa, relação com o responsável e período individual autorizado |
| Contrato/vínculo locatício | Locadores, locatários, modalidade, vigência, documentos e responsáveis |
| Imobiliária e delegação | Empresa, agentes, casas autorizadas, ações permitidas e validade |
| Mandato de gestão | Síndico, subsíndico, período, documento e delegações |
| Veículo e credencial | Placa, responsável, ocupação/casa, autorização, restrições e validade |
| Tarefa e evidência | Responsável, prazo, execução, fotos, revisão e histórico |
| Ocorrência | Avaria, relato ou denúncia, evidências, sigilo e andamento |
| Financeiro | Contas, fundos, lançamentos, comprovantes, conciliação e prestação de contas |
| Assembleia | Convocação, pauta, participantes, representação, votos, apuração e ata |
| Enquete | Pesquisa consultiva, público, prazo e resultado; separada da votação deliberativa |

Não colocar apenas um campo “proprietário atual” ou “inquilino atual” dentro da casa como fonte do cadastro. A situação atual deve ser obtida pelos vínculos válidos na data consultada. Guardar data do fato e data do registro, autor e motivo das alterações.

## 4. Ocupação e mudanças

Locação de temporada: período delimitado, responsável, pessoas autorizadas, veículos e horários de entrada e saída. A autorização de acesso termina conforme a vigência aprovada. Alterações e prorrogações ficam registradas.

O proprietário cadastra cada estadia de sua unidade, inclusive as originadas em Airbnb, Booking e outras plataformas, conforme o detalhamento da seção 16. Imobiliária poderá realizar o cadastro somente mediante delegação válida. A plataforma de origem é informação do cadastro; integração automática com esses serviços não está presumida.

Locação residencial contínua, chamada inicialmente de “anual”: fluxo próprio de cadastro, moradores, vigência e renovação. O produto não deve presumir que todo contrato residencial tem exatamente doze meses.

Na troca de proprietário: validar a transferência, encerrar a titularidade anterior e registrar a nova; revisar acessos e delegações. O histórico continua associado à casa. A documentação privada de antigos moradores não fica automaticamente disponível ao novo proprietário.

Na saída do inquilino: encerrar a ocupação, revogar credenciais correspondentes, preservar registros conforme política de retenção e registrar vistoria/avarias quando houver. A troca de titularidade não implica automaticamente encerramento da locação.

Exemplo fictício: Casa 01 permanece a mesma; Ana e Bruno são coproprietários até uma transferência registrada; Carla assume posteriormente. A ocupação de Diego tem seu próprio intervalo e não se confunde com a titularidade.

## 5. Perfis e limites iniciais

| Perfil | Alcance proposto |
|---|---|
| Síndico | Gestão do condomínio durante o mandato, tarefas, ocorrências, cadastros e prestação de contas conforme atribuições |
| Subsíndico | Suporte e substituição conforme convenção e delegação; poderes não presumidos iguais aos do síndico |
| Proprietário | Suas unidades, autorizações permitidas, documentos e informações coletivas conforme direito e regra aplicável |
| Inquilino residencial | Sua ocupação, serviços e comunicações autorizados; sem poderes automáticos de proprietário |
| Ocupante de temporada | Informações necessárias à estadia e acessos temporários |
| Zelador | Tarefas, fotos de execução e ocorrências; dados de moradores apenas quando necessários ao serviço |
| Imobiliária | Somente unidades delegadas e ações expressamente autorizadas |
| Operador de portaria, se houver | Verificação operacional de autorizações e entradas, com dados mínimos |
| Operador da plataforma | Administração técnica; consulta excepcional a dados mediante autorização e auditoria |

Uma pessoa pode acumular papéis. Toda operação deve verificar novamente condomínio, vínculo e validade. Encerramento de mandato, estadia ou delegação deve retirar os privilégios correspondentes, inclusive em sessões já abertas.

## 6. Passeio virtual tridimensional

Experiência semelhante à navegação do Street View, dentro do perímetro autorizado. Cada casa possui um ponto selecionável ligado ao seu identificador permanente.

As dependências também podem ter pontos selecionáveis, exibindo ficha, regras, disponibilidade e opção de reserva quando aplicável, conforme as permissões.

Definir em prova de conceito se a experiência será feita com panoramas 360° conectados, modelo 3D ou combinação. Panoramas não são equivalentes a um modelo geométrico 3D completo.

A ficha exibida é filtrada pelo servidor: características da unidade, situação de ocupação e dados pessoais somente conforme permissão e finalidade. Outros moradores não terão acesso geral a nomes, documentos ou datas de viagem. Imagens devem evitar exposição desnecessária de pessoas, placas e interiores. Capturas e atualizações precisarão de planejamento e autorização adequados.

## 7. Portões, câmeras e placas

Cadastrar equipamentos, localização, fornecedor e capacidades. A leitura de placa gera uma solicitação de acesso; uma regra verifica credencial ativa, período, portão e restrições antes de autorizar a abertura.

Não abrir apenas por reconhecer uma placa: avaliar risco de erro, clonagem, repetição e indisponibilidade. Prever controle local, operação manual, registros de decisão, revogação e comportamento definido para falhas de rede ou energia. A integração física depende de equipamentos e protocolos ainda não informados e exige testes presenciais.

## 8. Tarefas, fotos, avarias e denúncias

Síndico cadastra tarefa; subsíndico acompanha dentro de sua delegação; zelador recebe, executa e apresenta fotos; responsável revisa e conclui ou solicita ajuste. Registrar prazo, comentários e histórico.

Avarias têm local, descrição, evidências, prioridade e encaminhamento. Denúncias possuem canal restrito, protocolo e acompanhamento. Distinguir relato confidencial identificado de denúncia anônima. Para anonimato, estudar autenticação, registros técnicos e metadados das fotos antes de prometer impossibilidade de identificação. Não aplicar penalidades automaticamente por denúncia.

## 9. Financeiro e governança

Controlar despesas, receitas, saldos, fundos, documentos e conciliação. Diferenciar consulta à prestação de contas de autorização para movimentar uma conta bancária. A preferência informada é restringir saldos aos proprietários com participação na conta; essa participação precisa ser definida e conciliada com os direitos de informação e prestação de contas aplicáveis.

Assembleias: convocação, pauta, presença, procurações, elegibilidade, quórum por matéria, votação e ata. Copropriedade não pode multiplicar indevidamente votos da mesma unidade. Regras de peso e representação dependem dos documentos aplicáveis. Enquetes são consultivas e não substituem deliberações formais.

## 10. Base normativa inicial e pontos de validação

Pesquisa inicial em fontes oficiais, realizada em 17/10/2026. A aplicação concreta exige conferir o enquadramento do empreendimento, sua convenção, regimento, atas e normas locais. Condomínio edilício de casas, condomínio de lotes e loteamento de acesso controlado não devem ser tratados automaticamente como o mesmo regime.

- Código Civil, especialmente arts. 1.331–1.358 e disposições aplicáveis ao condomínio de lotes: direitos, deveres, convenção, gestão e assembleias. O art. 1.348 orienta atribuições do síndico; as atribuições do subsíndico precisam ser conferidas na convenção. Fonte: https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm
- Lei 4.591/1964: conferir disposições aplicáveis em conjunto com o Código Civil. Fonte: https://www.planalto.gov.br/ccivil_03/leis/l4591.htm
- Lei 8.245/1991: distinguir obrigações locatícias e modalidades; o art. 48 define locação para temporada com finalidade temporária e prazo não superior a 90 dias. A duração, isoladamente, não resolve o enquadramento de qualquer estadia ou a permissão de uso da unidade. Fonte: https://www.planalto.gov.br/ccivil_03/leis/l8245.htm
- Lei 14.309/2022: assembleias eletrônicas e condições legais, incorporadas ao Código Civil; não basta disponibilizar um botão de votar. Fonte: https://www2.camara.leg.br/legin/fed/lei/2022/lei-14309-8-marco-2022-792345-norma-pl.html
- LGPD, Lei 13.709/2018: finalidade, necessidade, bases legais, direitos, segurança e responsabilidades. Documentar a base legal de cada tratamento; consentimento não deve ser adotado indiscriminadamente. Fonte: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm

As regras do produto são propostas de implementação, não conclusões jurídicas definitivas. A plataforma deverá suportar versões de regras, datas de vigência e evidências de aprovação, sem permitir configuração que afaste normas obrigatórias.

## 11. Proteção de dados e segurança

Separação de dados por condomínio no servidor e no armazenamento; permissões verificadas em cada consulta e alteração; autenticação reforçada para gestores; arquivos privados com acesso temporário; registro de ações relevantes; cópias de segurança com restauração testada.

Definir quem atua como controlador e operador por finalidade e contrato. Manter inventário de dados, política de retenção por categoria, fluxo para direitos dos titulares, resposta a incidentes e regras para fornecedores. Não existe prazo único presumido para guardar imagens, documentos e registros de acesso.

Fotos, placas e registros de ocupação podem envolver dados pessoais. Reconhecimento facial, se vier a ser solicitado, constitui um escopo adicional que exige análise específica de dados biométricos.

## 12. Etapas de entrega

1. Fundação: confirmar regime do condomínio, documentos, modelo de casas com identidade estável e estrutura variável, vínculos temporais, permissões e dados fictícios.
2. Primeiro módulo funcional: condomínio exemplo, casas, múltiplos proprietários, ocupações, delegações e histórico; acesso web responsivo e validação de isolamento.
3. Operação: tarefas com fotos, avarias, relatos e autorizações com validade.
4. Prova do diferencial visual: passeio virtual com seleção de casas e filtros de acesso; pequeno conjunto de panoramas autorizado.
5. Financeiro e governança: prestação de contas, assembleias e enquetes, após validar regras e quóruns.
6. Integrações e distribuição: portões/câmeras em ambiente de teste, aplicativos Android/iPhone e implantação em outros condomínios.

O desenho técnico deve contemplar os três canais desde a fundação. A sequência de publicação pode priorizar o webapp para validar as regras antes da distribuição dos aplicativos.

## 13. Critérios de aceitação prioritários

- Alterar proprietários ou inquilinos preserva o identificador e o histórico da casa.
- Uma unidade admite múltiplos coproprietários e representação de voto controlada.
- Consultas por data recuperam os vínculos correspondentes, sem expor dados sem autorização.
- Usuário de um condomínio não consulta dados de outro, mesmo alterando identificadores nas requisições.
- Imobiliária acessa apenas unidades e operações delegadas durante a vigência.
- Encerramento de ocupação revoga os respectivos acessos sem retirar os de outros vínculos válidos.
- Passeio virtual aplica as mesmas permissões das demais telas.
- Fotos, documentos e denúncias não ficam disponíveis por endereço público permanente.
- Enquete não é contabilizada como decisão de assembleia.
- Reconhecimento de placa sem autorização válida não aciona o portão.

## 14. Informações pendentes

Nome fictício ou real do piloto, município/UF, natureza jurídica, quantidade e identificação das casas; convenção e regimento; regras de locação e representação; significado de participação nas contas; equipamentos existentes; material disponível para o passeio virtual.

Até essas definições, usar dados fictícios e manter integrações físicas desativadas.

## 15. Dependências e áreas comuns

Cada condomínio poderá cadastrar suas próprias dependências: piscina, depósitos, sala de jogos, academia, sala de festas e outros tipos. Poderá haver várias dependências do mesmo tipo, com características e regras diferentes. O cadastro permite inclusão, alteração e inativação sem apagar o histórico.

Ficha de cada dependência: identificador, nome, tipo, descrição, localização, fotos, características estruturais, capacidade quando aplicável, equipamentos, responsável operacional, horários, regras de uso, acessibilidade e situação (disponível, interditada, em manutenção ou inativa).

O uso poderá ser livre dentro das regras, sujeito a controle de acesso ou dependente de reserva. Reserva, cobrança, caução, aprovação e limite de convidados são opções por espaço, sem presumir que todas as dependências as exigem. As permissões para proprietários, inquilinos residenciais, ocupantes de temporada, convidados e funcionários serão configuradas conforme as regras aprovadas do condomínio.

Reservas devem respeitar horários, capacidade, antecedência, duração, intervalos de limpeza e manutenção, limites por unidade e política de cancelamento. Impedir conflitos em reservas exclusivas, inclusive em solicitações simultâneas; para uso compartilhado, controlar a capacidade configurada. Interdição deve bloquear novas reservas e encaminhar as existentes para tratamento e aviso aos responsáveis.

Depósitos podem ter acesso restrito a funcionários ou responsáveis autorizados. Registrar equipamentos e materiais associados quando necessário; inventário detalhado e movimentação de estoque ficam como expansão a definir.

Relacionar tarefas do zelador, fotos de execução, limpeza, manutenção, avarias e gastos à dependência correspondente. Permissões de consulta de reservas não devem expor desnecessariamente nomes de convidados ou outros dados pessoais.

Critérios de aceitação: cadastrar espaços distintos do mesmo tipo; aplicar regras por dependência; impedir reserva durante bloqueios; impedir conflitos de reserva exclusiva; preservar histórico após inativação; aplicar no passeio virtual as mesmas permissões usadas nas demais telas.

## 16. Controle de estadias e ocupantes de temporada

Requisito confirmado: cada proprietário cadastra o responsável pela estadia, quantas e quais pessoas estarão na casa, período de entrada e saída, veículos e placas, contatos e ficha do responsável. Cada registro pertence a uma casa e a um condomínio, com identificação de quem cadastrou e de quem autorizou alterações. Proprietário com várias casas deve selecionar a unidade correspondente.

### Ficha da estadia

- Casa, proprietário responsável pelo cadastro e origem: Airbnb, Booking, outra plataforma, contratação direta ou outra opção configurada.
- Referência externa da reserva, se disponível, sem exigir acesso à conta ou senha da plataforma de origem.
- Data e hora previstas de entrada e saída, no fuso do condomínio; registrar separadamente entrada e saída efetivas.
- Responsável principal pela estadia, que pode ser diferente de quem fez a reserva ou pagou por ela. Se não estiver entre os ocupantes, exigir a identificação de um responsável presente no local.
- Ficha do responsável: nome completo, telefone com código de país, contato alternativo/e-mail quando disponível e identificação necessária conforme política de cadastro. Aceitar documento adequado para estrangeiros. Não exigir cópia de documento indiscriminadamente.
- Relação nominal de todas as pessoas que ocuparão a casa, incluindo o responsável quando hospedado. A quantidade total é calculada a partir dessa relação, evitando divergência entre número informado e pessoas cadastradas.
- Para cada ocupante: nome, categoria adulto/menor quando necessária à operação, vínculo com o responsável e período individual caso seja diferente do período geral. Dados de menores devem ser limitados ao necessário; contato e representação pelo responsável quando aplicável.
- Veículos: placa e país de registro, tipo, marca/modelo e cor quando necessários, pessoa responsável e período autorizado. Permitir vários veículos ou informar que não haverá veículo; permitir completar dados de carro alugado antes de autorizar seu acesso.
- Ciência das regras de uso e contato do proprietário ou representante para resolução de pendências.

O formulário não deve solicitar dados de pagamento da reserva. Campos obrigatórios de identificação, documentos e retenção serão definidos conforme finalidade e validação das regras do condomínio, sem disponibilizar a ficha completa a todos os usuários.

### Fluxo operacional

1. Proprietário ou imobiliária delegada cadastra a estadia e seus ocupantes e veículos.
2. O sistema valida datas, completude, quantidade de pessoas, limites de ocupação e possíveis conflitos de uso da casa conforme regras cadastradas. Estadia cadastrada não representa confirmação automática de que aquela modalidade de locação é permitida.
3. Quando o condomínio exigir análise, a solicitação fica pendente até decisão do perfil autorizado; nas demais situações, segue a regra configurada. Distinguir cadastro da estadia de autorização de entrada.
4. Gerar autorizações individuais vinculadas à estadia, vigentes somente no intervalo autorizado. A placa identifica um veículo autorizado e não substitui a conferência das demais condições de acesso.
5. Registrar entradas e saídas operacionais sem confundir saída temporária de uma pessoa ou carro com encerramento da estadia. Exibir ocupação prevista, estadia em andamento e presença registrada como informações distintas; não presumir presença física sem registro confiável.
6. Inclusão ou substituição de pessoas, troca de veículo e prorrogação exigem atualização registrada e nova análise quando prevista. Nunca reutilizar silenciosamente uma credencial de outra pessoa ou estadia.
7. Cancelamento, encerramento ou fim da vigência revogam as autorizações correspondentes. Prorrogação deve ser autorizada antes de ampliar a validade; preservar histórico e tratar acessos posteriores pelo procedimento de exceção do condomínio.

Situações sugeridas: rascunho, pendente de análise quando aplicável, autorizada, recusada, cancelada e encerrada. A indicação “em andamento” depende do período e da confirmação operacional, com registro de ausências e divergências quando necessário. O histórico registra mudanças de situação, autor, data e motivo.

### Visibilidade por perfil

O proprietário acompanha as estadias de suas casas dentro das permissões e finalidades definidas. Imobiliária acessa somente as casas delegadas. Gestão consulta dados necessários à administração; portaria recebe dados mínimos para verificar acesso, validade, pessoas e veículos. Zelador não recebe automaticamente documentos e contatos completos. Outros moradores não acessam a lista de hóspedes nem datas detalhadas de estadias alheias. Os mesmos limites valem no passeio virtual.

### Critérios de aceitação

- Cadastrar estadia sem veículo ou com múltiplos veículos e múltiplos ocupantes.
- Calcular o total pela relação nominal, sem duplicar o responsável já incluído.
- Permitir períodos individuais somente dentro do intervalo autorizado da estadia.
- Bloquear acesso de pessoa ou veículo sem autorização válida, ainda que a casa tenha outra estadia ativa.
- Expirar a autorização na data e hora previstas e registrar cancelamentos e prorrogações.
- Alterar pessoas, veículos e datas preservando as versões anteriores e a autoria.
- Identificar a plataforma de origem sem pressupor sincronização automática.
- Exibir no cadastro da casa o responsável e período da estadia apenas para os perfis autorizados.

## 17. Estacionamento e vagas de veículos

Requisito confirmado: no cadastro das dependências, informar se o condomínio dispõe de vagas de carros; se houver, cadastrar quantas podem ser utilizadas por cada casa e se são identificadas ou de uso livre, sem lugar fixo. Permitir modelo misto. A configuração pode variar entre casas e áreas de estacionamento.

### Configuração

- Existência de estacionamento: sim, não ou ainda não informado. Ausência de informação não equivale a inexistência de vagas.
- Áreas de estacionamento e capacidade física de cada uma, distinguindo vagas internas à casa de estacionamento compartilhado quando necessário.
- Modalidade: vagas fixas identificadas, vagas livres sem atribuição fixa ou modelo misto.
- Quantidade de vagas/direito de uso por casa; permitir quantidades diferentes, inclusive zero, e registrar a origem e vigência dessa atribuição conforme documentos e regras aplicáveis.
- Para vagas identificadas: código/número, localização, características e casa vinculada quando houver. Registrar se a vaga é parte da unidade, unidade autônoma ou área comum com direito de uso, conforme documentação, sem presumir equivalência entre essas situações.
- Para vagas livres: capacidade do conjunto, limite de uso simultâneo por casa, critério de ocupação e eventual reserva, caso prevista. Ter limite de uso não garante lugar disponível, salvo regra expressa compatível com a capacidade.
- Regras específicas para visitantes, prestadores, ocupantes de temporada, acessibilidade, tipos/dimensões de veículos e bloqueios de manutenção, quando aplicáveis.

### Disponibilidade e uso

Distinguir capacidade física, direito de uso da casa, vagas bloqueadas, reservas quando existentes e ocupação registrada. Exibir a fonte e o horário da última atualização da disponibilidade. Sem controle confiável de ocupação, apresentar disponibilidade como não confirmada; não prometer monitoramento em tempo real.

O cadastro da estadia informa quantos veículos estão previstos e verifica o limite de uso da casa. A quantidade de veículos cadastrados pode ser diferente do número autorizado simultaneamente; excedentes exigem tratamento conforme regra do condomínio. Uma placa cadastrada ou uma autorização de entrada no portão não garante vaga de estacionamento.

Na ficha da casa e no cadastro da estadia, apresentar quantidade permitida, modalidade e identificação das vagas fixas quando houver. No passeio virtual, permitir localizar áreas e vagas identificadas conforme permissões. Alterações de atribuição, interdições e liberações mantêm histórico, sem retirar direitos documentados automaticamente por mudança de proprietário ou inquilino.

### Critérios de aceitação

- Registrar condomínio sem estacionamento e condomínio cuja informação ainda esteja pendente.
- Configurar vagas fixas, livres ou mistas, com quantidades diferentes por casa.
- Impedir atribuições fixas exclusivas conflitantes no mesmo período e sinalizar inconsistências entre capacidade e configuração de uso.
- Separar autorização de entrada de veículo de autorização ou garantia de estacionamento.
- Validar o uso simultâneo conforme limite da casa e regras da área, quando houver registro confiável de ocupação.
- Identificar disponibilidade não confirmada e impedir que vagas interditadas sejam oferecidas para nova alocação ou reserva.

## 18. Assistente de IA e atendimento no grupo

Requisito confirmado: assistente de IA para auxiliar no controle de tarefas, acompanhar andamento, produzir relatórios e enviar resumos diários no grupo do condomínio. Deve responder a dúvidas quando marcada ou chamada no grupo. A plataforma de mensagens ainda será definida; não presumir que qualquer aplicativo permite bots em grupos. A integração depende de suporte oficial, permissões e validação técnica do canal escolhido.

### Tarefas e acompanhamento

- Consultar tarefas abertas, responsáveis, prazos, atrasos, bloqueios e últimas atualizações.
- Responder perguntas como “quais tarefas estão atrasadas?” e “como está a manutenção da piscina?”, com referência aos registros consultados e indicação da data da informação.
- Apoiar cadastro de tarefas, atualização de andamento e registro de impedimentos por comandos de usuários identificados e autorizados. Se o pedido estiver ambíguo, pedir os dados necessários antes de gravar.
- Registrar autoria humana da solicitação, ação executada pela assistente e histórico. Não concluir uma tarefa apenas porque uma foto foi enviada: aplicar o fluxo de evidência e revisão definido para a tarefa.
- Produzir relatórios por período, dependência, responsável e situação, respeitando o acesso aos dados e distinguindo fatos registrados de interpretações ou sugestões.

### Resumo diário

Configurar grupo de destino, horário no fuso do condomínio e público autorizado. O envio diário foi solicitado, inclusive em dias sem movimentação: nesse caso, informar brevemente a ausência de novidades. Estes são requisitos do produto; nenhum envio ou agendamento externo está ativo nesta especificação.

Conteúdo proposto: tarefas concluídas, tarefas em andamento, atrasos, impedimentos, manutenções e interdições, eventos/reservas relevantes e próximas providências. Informações de reservas serão agregadas ou limitadas ao necessário, sem expor convidados e estadias particulares. O relatório financeiro só entra quando o grupo inteiro tiver autorização para o conteúdo correspondente.

Separar grupos de gestão, funcionários e moradores quando precisarem de informações distintas. A permissão individual de quem chamou a assistente não autoriza publicar dados restritos para todo o grupo. A identidade, o vínculo e o público do grupo devem ser verificados; grupo com participantes desconhecidos recebe somente conteúdo expressamente liberado para esse público.

Registrar período coberto, horário de geração, origem dos dados e resultado da entrega. Evitar duplicidade do resumo em novas tentativas; tratar falhas com registro e aviso ao administrador. Se os dados estiverem indisponíveis ou desatualizados, informar a limitação, sem inventar andamento ou conclusão.

### Dúvidas quando marcada ou chamada

Responder mediante menção, resposta direcionada à assistente ou comando/palavra de chamada configurado, conforme recursos do canal. Não responder automaticamente a toda conversa. Antes da resposta, identificar condomínio, solicitante e público de destino.

Consultar regras e documentos vigentes do condomínio, avisos, horários das dependências e registros operacionais autorizados. Para regras, indicar documento e versão ou trecho pertinente. Se não houver base suficiente, declarar que a informação não foi encontrada e encaminhar a questão ao responsável; não apresentar suposição como regra aprovada.

Não divulgar no grupo documentos pessoais, contatos particulares, listas de hóspedes, placas, datas detalhadas de ocupação, denúncias sigilosas ou identidade de denunciantes. Quando a resposta exigir informação restrita, orientar o solicitante a consultar a área autenticada do sistema ou canal privado habilitado, com nova verificação de permissão.

### Limites de atuação e proteção

A assistente usa as mesmas verificações de acesso do serviço central; não recebe acesso irrestrito a todos os condomínios. Mensagens, documentos e fotos são conteúdo de consulta, não instruções capazes de ampliar suas permissões. Proteger contra comandos inseridos nesses conteúdos, chamadas em massa e respostas duplicadas.

Por padrão, a assistente não abre portões, movimenta dinheiro, aplica multas, aprova cadastros de acesso, muda permissões, decide denúncias ou substitui deliberações de assembleia. Eventuais ações desse tipo exigem escopo próprio e regras explícitas. A assistência de tarefas não amplia os poderes do usuário que fez o pedido.

Definir tratamento de mensagens e anexos, retenção, transparência sobre uso de IA e fornecedores envolvidos. Não pressupor uso das conversas para treinamento de modelos. Processar apenas o conteúdo necessário à função e às condições técnicas do canal.

### Critérios de aceitação

- Enviar um resumo diário por grupo configurado, no horário local definido, com proteção contra duplicidade.
- Responder a menção/chamada válida e manter silêncio em conversas comuns sem acionamento.
- Impedir publicação de conteúdo restrito mesmo quando solicitado por um gestor em grupo de moradores.
- Impedir consulta cruzada entre condomínios e ações além da permissão do solicitante.
- Responder com base em registros e documentos identificáveis; informar ausência de dados e falhas de consulta.
- Registrar alterações em tarefas com autor, data e histórico, seguindo o fluxo de revisão.
- Validar o suporte oficial do canal a grupos, bots, chamadas e envios agendados antes de prometer a integração.

Pendências: aplicativo/canal do grupo, grupos de destino e respectivos públicos, horário do resumo, identificação dos participantes e ações de tarefa que poderão ser executadas pela assistente.

## 19. Alertas de inconformidades e reclamações

Requisito confirmado: a assistente envia alertas ao síndico e, quando cabível, aos proprietários envolvidos diante de inconformidades com as regras ou reclamações. O envio integra o fluxo do produto; nenhum canal externo está conectado ou enviando mensagens nesta etapa.

Fontes dos alertas: reclamação registrada, ocorrência encaminhada e verificação de condições objetivas com base em regra vigente, como vencimento de autorização, quantidade de ocupantes acima do limite cadastrado, conflito de reserva ou tarefa de manutenção vencida. Cada regra automática precisa ter condição, fonte de dados, vigência, destinatários e responsável por revisão definidos. A IA pode sinalizar possível relação com uma regra, mas não declarar culpa com base apenas em texto, imagem ou denúncia.

Distinguir claramente: reclamação recebida (alegação), possível inconformidade (sinal a verificar), inconformidade verificada (apuração registrada) e situação resolvida. Não converter automaticamente reclamação em infração comprovada. Ao citar uma regra, indicar documento/versão e condição detectada; se a regra não estiver cadastrada ou houver dúvida, encaminhar para análise.

### Destinatários e sigilo

- Síndico: recebe alertas operacionais e reclamações dentro de suas atribuições. Subsíndico recebe conforme delegação ou substituição vigente.
- Proprietário: recebe aviso referente à sua unidade quando pertinente e conforme política de encaminhamento; em caso de copropriedade, usar responsáveis/destinatários autorizados, sem presumir que qualquer coproprietário representa os demais.
- Reclamações com dados sensíveis, denúncias sigilosas ou riscos de identificação do denunciante passam por triagem antes de qualquer encaminhamento ao proprietário. Compartilhar somente os fatos necessários, preservando identidade, anexos e detalhes que possam identificar o relator.
- Usar notificação privada no aplicativo ou canal individual validado. Grupos recebem apenas avisos coletivos apropriados, como interdição de uma área, sem exposição pública de envolvidos.

### Fluxo e acompanhamento

Registrar ocorrência → classificar origem e situação → aplicar regra de encaminhamento → notificar destinatário autorizado → confirmar ciência quando disponível → apurar e registrar providências → concluir com histórico. Avisos automáticos objetivos podem seguir diretamente ao destinatário previsto; relatos e encaminhamentos de risco exigem triagem conforme configuração.

Cada alerta contém protocolo, data/hora, unidade ou dependência quando pertinente, descrição factual, situação da apuração, referência à regra quando existente, providência solicitada, prazo quando definido e acesso ao registro autenticado. Não colocar dados privados em prévias de notificações ou endereços públicos.

Configurar prioridade, horário de envio, tratamento de urgências, prazo de atendimento e escalonamento para substituto autorizado. Agrupar repetições do mesmo fato, limitar frequência e registrar tentativas e falhas de entrega. Não marcar ciência somente porque uma mensagem foi enviada.

O proprietário ou responsável poderá apresentar esclarecimentos e evidências pelo fluxo autorizado. A assistente acompanha pendências e prepara histórico para a gestão; não aplica multa ou outra penalidade automaticamente.

Critérios de aceitação: alertar somente destinatários autorizados; não expor denunciante; distinguir alegação de fato verificado; permitir esclarecimento e revisão; rastrear regra e dados que originaram o aviso; evitar duplicidades; acompanhar atendimento e falha de entrega; retirar acesso ao conteúdo restrito quando o vínculo do destinatário terminar.

## 20. Infraestrutura para distribuição

Recomendação inicial, sujeita a orçamento e prova técnica: produto SaaS com aplicação central e separação por condomínio, PostgreSQL gerenciado, autenticação gerenciada, armazenamento privado de arquivos e processamento separado para notificações, relatórios e IA. Não é obrigatório contratar VPS para começar. VPS é uma alternativa de execução da aplicação, não uma exigência de um produto distribuído.

| Componente | Destino proposto |
|---|---|
| Casas, vínculos, tarefas, regras, financeiro, estoque e auditoria | PostgreSQL gerenciado |
| Fotos, documentos e panoramas | Armazenamento de objetos privado; banco guarda referências, metadados e permissões |
| Webapp | Hospedagem web com HTTPS e distribuição dos arquivos estáticos |
| Regras e integrações | Serviço de aplicação e processos de fundo gerenciados ou em contêineres |
| Login | Serviço de identidade; associação ao condomínio e permissões ficam sob controle do produto |
| Vídeo contínuo de câmeras | Preferencialmente gravador local ou serviço especializado; não armazenar indiscriminadamente no banco nem junto dos documentos |
| Portões e leitura de placas | Integração com controlador local, com comportamento seguro durante indisponibilidade de internet |

Candidato para o piloto: Supabase hospedado para PostgreSQL, autenticação e arquivos privados, com região primária São Paulo quando disponível e adequada ao contrato. A escolha da região não garante que todo tratamento, suporte, backup e fornecedor permaneça no Brasil: revisar contrato e fluxos. Alternativa de maior composição operacional: serviços gerenciados AWS. Contratação e preços não foram aprovados nem há infraestrutura provisionada.

| Alternativa | Avaliação para este projeto |
|---|---|
| Serviços gerenciados | Recomendada inicialmente: reduz administração de servidor; exige configurar segurança, backups, custos e monitoramento |
| VPS com aplicação e banco juntos | Possível para demonstração, mas concentra falhas e exige manutenção, atualização e recuperação pela equipe |
| Aplicação em VPS + banco e arquivos gerenciados | Alternativa híbrida quando integrações ou processos contínuos justificarem; manter possibilidade de múltiplas instâncias |
| Instalação dedicada por cliente | Opção comercial futura para exigências específicas; maior custo de operação e atualização |

Estratégia inicial: banco compartilhado com identificador de condomínio em todo registro de negócio e políticas de isolamento no banco e no serviço. Chaves e relações devem impedir associação de registros de condomínios diferentes. Arquivos, filas, cache, busca e consultas da IA seguem o mesmo isolamento. Testar acessos cruzados e usuários com vínculos em mais de um condomínio. Clientes com exigências especiais poderão migrar para banco/projeto dedicado mediante processo planejado; isso não é automático.

Ambientes de desenvolvimento, homologação e produção separados; dados fictícios fora de produção. Migrações versionadas, limites de consumo por condomínio, monitoramento, alertas de falhas, trilha de suporte e plano de exportação/encerramento do cliente. Medir custo por condomínio para precificação.

Backups de banco e de arquivos são operações separadas. Definir perda máxima tolerável de dados e tempo de recuperação antes da produção; combinar recuperação pontual quando contratada, cópia independente, versionamento de arquivos e testes de restauração. Em base compartilhada, restaurar somente um condomínio exige procedimento específico, sem sobrescrever os demais. Definir retenção e localização também para backups.

Principais custos a estimar: banco, aplicação, volume e tráfego de fotos/panoramas, backups, mensagens, IA, integrações bancárias, monitoramento, lojas de aplicativos e suporte. Sem número de condomínios, usuários, fotos e volume de mensagens, não fixar orçamento mensal. Gravação contínua de vídeo deve ter orçamento próprio. Validar capacidade por teste de carga em cenário representativo.

Fontes técnicas consultadas em 17/10/2026:
- https://supabase.com/docs/guides/platform/regions
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-databases.html
- https://docs.aws.amazon.com/en_en/lightsail/latest/userguide/security.html

## 21. Login e autorização de usuários

Requisito confirmado: acesso por usuários autorizados pelo síndico ou pela imobiliária administradora formalmente habilitada para aquele condomínio. Separar imobiliária que administra o condomínio de imobiliária que administra apenas a locação de determinadas casas. A segunda não pode aprovar usuários ou gestores de todo o condomínio.

Fluxo: convite ou solicitação → verificação de identidade/vínculo pelo gestor autorizado → aprovação com condomínio, papel, unidades e validade → ativação pelo próprio usuário. Conta criada ou e-mail verificado não equivale a associação aprovada. Cadastro de hóspede pelo proprietário não concede automaticamente login; eventual convite segue a política aprovada.

Convites de uso único e validade curta, recuperação de conta segura, proteção contra tentativas abusivas e autenticação reforçada para gestores. Ninguém atribui a si mesmo poderes ou delega mais do que possui. Uma identidade pode participar de vários condomínios com papéis diferentes, selecionando o contexto ativo.

O primeiro gestor precisa de habilitação verificada no processo de implantação. Troca de síndico ou administradora exige revisão de vínculos, encerramento dos mandatos e continuidade dos dados do condomínio. Revogação deve invalidar o acesso correspondente mesmo em sessão aberta; recuperação de senha não reativa vínculo suspenso.

## 22. Taxas, inadimplência e cobranças

Requisito confirmado: controlar taxas condominiais, vencimentos, pagamentos, débitos e cobranças privadas. Registrar por unidade e competência, discriminando taxa ordinária, extraordinária e demais componentes aprovados. Preservar os responsáveis históricos e validar a responsabilidade jurídica em transferências; não atribuir toda dívida automaticamente ao ocupante atual.

Prever emissão via instituição/parceiro de pagamento, Pix Cobrança, boleto e Pix Automático quando suportado e autorizado pelo pagador. O produto não deve custodiar dinheiro dos condomínios sem escopo e estrutura próprios; recebimentos vão para contas contratadas de cada condomínio. Separar mensalidade do software de taxas condominiais.

Conciliação por retorno autenticado do parceiro, identificador único e proteção contra eventos duplicados; comprovante enviado pelo usuário fica pendente de verificação e não dá baixa definitiva sozinho. Tratar pagamentos parciais, duplicados, estornos, diferenças, acordos, parcelamentos e contestações, sem apagar lançamentos anteriores.

Régua configurável de lembretes antes e depois do vencimento, suspensão de cobrança automática para casos em análise e encaminhamento para gestão/jurídico. Relatórios por faixa de atraso, unidade, competência, arrecadação e previsão de caixa. Não publicar listas nominais de inadimplentes em grupos. Não vincular automaticamente atraso financeiro a bloqueio de entrada, equipamentos ou dependências.

Multa, juros e atualização devem usar regra validada, versionada e aplicável ao período, com memória de cálculo; não presumir juros universais de 1% ao mês. Conferir Código Civil e alterações da Lei 14.905/2024, convenção e orientação jurídica. Descontos, baixas manuais e acordos exigem permissão específica e auditoria; valores relevantes podem exigir segunda aprovação.

Fontes: https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm ; https://planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14905.htm ; https://www.bcb.gov.br/meubc/faqs/s/pix

## 23. Materiais, ferramentas e itens compartilhados

Requisito confirmado: controle dos materiais usados para manter o condomínio, incluindo limpeza, ferramentas de manutenção e itens disponíveis aos proprietários.

Separar consumíveis (baixa por uso), bens duráveis (identificação e conservação) e itens emprestáveis (retirada e devolução). Cada item tem categoria, unidade de medida, local/depósito, estoque mínimo quando aplicável, fornecedor, custo, foto e situação. Lote e validade para produtos que exijam esse acompanhamento; número de série, garantia e manutenção para equipamentos quando pertinentes.

Movimentações: compra/entrada, consumo em tarefa, transferência entre depósitos, empréstimo, devolução, perda, avaria, descarte e ajuste por inventário com motivo e autorização. Impedir saldo negativo ou empréstimo simultâneo incompatível; manter operações consistentes em solicitações concorrentes. Relacionar compra com despesa para evitar duplicar gasto no financeiro.

Empréstimos a proprietários: identificar pessoa e unidade, item, quantidade, condição na retirada, prazo e condição na devolução. Reservas quando previstas; alertas de atraso, avaria e indisponibilidade. Responsabilidade, cobrança ou caução dependem da regra aprovada, sem penalidade automática. Ferramentas de uso profissional podem ser restritas a funcionários habilitados.

Zelador registra consumo e movimentações dentro de suas permissões; gestão aprova compras e ajustes conforme limites. IA pode resumir consumo, apontar estoque baixo e sugerir reposição, sem comprar autonomamente. Inventários periódicos conciliam saldo físico e registros. Segurança e armazenamento de químicos devem seguir instruções e documentação dos produtos.
