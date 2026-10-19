# Vilazuni — piloto local com login

Requer Node.js 20 ou superior. Sem dependências externas.

## Abrir e configurar

Executar `Iniciar Vilazuni.cmd` na raiz ou `node server.mjs` nesta pasta. Usar o endereço 127.0.0.1 exibido e manter o servidor aberto. No primeiro acesso, criar a conta inicial da gestão com nome, e-mail e senha de pelo menos 12 caracteres. O agente não cria essa senha. Depois de entrar, clicar no próprio nome para convidar pessoas, consultar contas, suspender acessos e alterar a senha.

Os convites valem 48 horas, são de uso único e devem ser entregues manualmente. A pessoa usa “Recebi um convite” e define a própria senha. Não há envio de e-mail nem verificação de caixa postal nesta etapa; a entrega do convite deve ser feita à pessoa pretendida.

## Perfis disponíveis

- Síndico: gestão do condomínio e emissão de convites comuns.
- Proprietário: somente casas atribuídas e respectivas estadias.
- Imobiliária de locação: casas delegadas e prazo obrigatório de validade.
- Portaria: dados mínimos das autorizações aprovadas; sem contatos particulares ou proprietários.
- Zeladoria: tarefas; sem fichas residenciais ou de hóspedes.

Subsíndico, administradora e ocupante ainda não possuem fluxo próprio. O convite não concede cargos de gestão.

## Dados e sessões

Operações autenticadas são persistidas pelo servidor em `.data/store.json` (fora do Git). A variável VILAZUNI_DATA_DIR permite configurar outro diretório. O caminho padrão está dentro do workspace, que pode ser sincronizado pelo OneDrive. Não executar múltiplos servidores sobre a mesma base. Dados antigos do navegador não são importados automaticamente nem apagados.

Senhas são armazenadas com scrypt e salt; convites com hash. Sessões ficam em memória e expiram em oito horas ou após trinta minutos sem consultas. Reiniciar o servidor exige novo login. Suspender a conta invalida suas sessões; alterar a senha encerra as anteriores. Recuperação de senha esquecida ainda não está implementada; não existe senha mestra.

## Experiência e limites

Tour WebGL com 14 sobrados, áreas comuns e interiores ilustrativos em dois pavimentos. Consultas e cadastros abrem sobre o cenário. As operações usam o horário atual; o cenário e os dados operacionais são de exemplo. Login real local não significa ambiente de produção: não inserir dados reais de moradores antes de implantar a base central.

O serviço atende somente em 127.0.0.1. Para distribuição ainda faltam PostgreSQL com migrações e isolamento no banco, HTTPS e cookies Secure, recuperação verificada de conta, MFA da gestão, múltiplos vínculos, backups e revisão de segurança. Não há integração com portão, pagamentos, mensagens ou IA. A configuração inicial local não verifica mandato de síndico.

## Verificação

`npm test`: oito testes, incluindo integração HTTP com contas sintéticas temporárias e testes de domínio. Cobre escopo de casas e condomínios, convite único, sessão, suspensão, expiração de delegação, troca de senha e campos mínimos por perfil. O teste HTTP exige conexão de loopback permitida. A tela inicial foi conferida no navegador; a senha da conta real deve ser criada pelo usuário.


## Moradores e vínculos

Após entrar, selecione uma casa e abra “Moradores e vínculos”, ou use o marcador Pessoas dentro da casa. Cadastre cada coproprietário individualmente. Para locação anual/residencial, informe titular, contato, período e relação nominal de moradores; placas são opcionais. O término previsto é planejamento, não confirmação de saída. “Registrar saída / término” preserva o histórico para a gestão. As alterações exigem motivo. Esta etapa foi verificada com 13 testes e com cadastro/encerramento pela interface em base isolada.


## Zeladoria com revisão — 18/10/2026

Implementado no piloto local: criação de tarefa com local, orientações, prazo e responsável; tarefas visíveis ao zelador somente quando atribuídas à sua conta; fotos de execução; envio para revisão; aprovação, pedido de ajuste ou cancelamento pela gestão, com observação e histórico. Reatribuir reinicia o andamento e exige nova evidência. Uma versão por tarefa impede sobrescrita por uma tela desatualizada; use “Atualizar tarefas” para recarregar.

As fotos são servidas por rota autenticada, restrita à gestão do condomínio e ao zelador responsável. A interface reduz imagens para até 1600 pixels e converte em JPEG. Limites do piloto: oito fotos por tarefa, 2 MB por arquivo recebido e limite global de armazenamento próximo de 64 MB. Os arquivos ainda ficam na base JSON local; armazenamento de objetos, retenção e backups de produção continuam pendentes. A validação do servidor verifica formato e tamanho, sem análise de conteúdo ou antivírus.

Verificação atual: 17 testes aprovados, incluindo envio/leitura de foto pela API, negação de acesso sem sessão e por proprietário, controle de versão, atribuição e revisão. Criação e início de tarefa também conferidos pela interface em base temporária com dados fictícios. Prévia: `previa-zeladoria.png` na raiz do projeto. Nenhuma conta do usuário foi criada.

## Ocorrências privadas — 19/10/2026

No menu “Ocorrências”, abra um relato com título, local, descrição e casa opcional autorizada. Cada conta acompanha apenas seus relatos; a gestão acompanha os do condomínio. A gestão atribui um responsável de gestão, inicia apuração, resolve/cancela com justificativa e pode reabrir. Comentários, decisões e atribuições preservam histórico e versão. Ao receber aviso de conflito, use “Atualizar ocorrências”.

Não há relatos anônimos, anexos ou notificações nesta etapa. Não encaminhamos relatos privados automaticamente ao zelador. O autor vê todos os acompanhamentos da gestão no próprio relato. Testes atuais: 21 aprovados; interface nova ainda sem conferência visual em navegador.

## Materiais e estoque — 19/10/2026

Menu “Materiais”: gestão cadastra consumíveis, unidade, depósito e mínimo, depois registra entradas com motivo. Gestão e zeladoria registram consumo escolhendo tarefa aberta; zeladoria só pode consumir em tarefas atribuídas à sua conta. Saldo e histórico da tarefa são atualizados juntos. Até três casas decimais; saldo insuficiente e versões desatualizadas são recusados. Use “Atualizar estoque” após conflito. O painel de tarefas mostra os materiais consumidos.

Zeladoria consulta saldos e apenas os próprios movimentos. Não há compras, custos, estornos, ajustes de inventário ou empréstimos nesta entrega. Cancelar tarefa não devolve material automaticamente. Testes atuais: 25 aprovados.

Fluxo de materiais conferido no Chromium com base temporária: cadastro, entrada, tarefa, consumo e exibição na tarefa, sem erros JavaScript. Consulta do painel também verificada em viewport móvel. Nenhuma conta real criada.
