# Sugestões e prioridades do produto

Atualização: plataforma nomeada **Vilazuni**, com **Condomínio Chandra** como piloto. As propostas deste estudo foram incorporadas ao PLANO_DO_PROJETO.md, distribuídas por etapas de execução.

Estudo inicial em 17/10/2026. As propostas abaixo são recomendações para avaliação, não funcionalidades já implementadas nem todas aprovadas para a primeira versão. Complementam a especificação principal.

## Direção recomendada

Construir primeiro uma operação confiável de unidades, pessoas, estadias, permissões, tarefas e financeiro. Desenvolver uma prova pequena do passeio virtual em paralelo para validar o diferencial visual. Distribuição para vários condomínios exige implantação simples, isolamento de dados, suporte e controle de custos, além das telas dos moradores.

A consulta às páginas oficiais de Superlógica e TownSq mostra oferta de encomendas, visitantes, reservas, comunicação e recursos financeiros. Isso indica módulos esperados em parte do mercado; não comprova qualidade, cobertura ou equivalência entre fornecedores. O diferencial proposto combina estadias temporárias, ficha histórica da casa, operação com evidências e passeio virtual contextual.

Fontes: https://superlogica.com/recursos/funcionalidades-condominios/ ; https://townsq.com.br/planos/

## Recursos adicionais recomendados

| Prioridade | Recurso ainda não detalhado | Benefício e escopo sugerido |
|---|---|---|
| Alta | Manutenção preventiva | Planos recorrentes por equipamento/dependência, checklists, inspeções, peças, evidências e próxima execução; evitar depender apenas de chamados |
| Alta | Documentos e vencimentos | Contratos, seguros, laudos, licenças aplicáveis e garantias; responsável, versão e alertas. Exigências variam por município/UF e tipo de empreendimento |
| Alta | Fornecedores e compras | Cadastro, orçamentos comparáveis, aprovação por valor, ordem de serviço, recebimento e vínculo à despesa/estoque; impedir que a mesma pessoa aprove tudo sem limites |
| Alta | Visitantes e prestadores | Autorizações pontuais/recorrentes, janela de acesso, responsável, revogação e registro de atendimento, separados de estadias |
| Alta | Encomendas e correspondências | Recebimento, local de guarda, aviso privado e comprovação de retirada; limitar fotos de etiquetas e exposição de dados |
| Alta | Passagem de gestão e de turno | Pendências, chaves, contratos, incidentes e responsabilidades; encerrar acesso antigo sem perder continuidade |
| Alta | Emergência e contingência | Procedimentos aprovados, contatos operacionais, interdições e comunicação de indisponibilidade. Não prometer despacho de emergência nem depender de IA para resposta crítica |
| Média | Medidores e consumos | Leituras com fotos e histórico de água/energia/gás onde existirem; alertas de variação, revisão antes do rateio e registro de correções |
| Média | Obras e mudanças nas casas | Solicitação, documentos necessários, responsável técnico quando aplicável, períodos de trabalho, prestadores e vistorias; refletir alterações na ficha da unidade |
| Média | Chaves, controles e credenciais | Quem retirou, devolveu ou perdeu; vincular ao equipamento, unidade e validade; revogação quando possível |
| Média | Guia de chegada para temporada | Instruções de acesso, regras, descarte de lixo, vagas e uso das dependências; versão em outros idiomas e ciência das regras |
| Média | Acessibilidade e conectividade limitada | Interface acessível, textos claros, envio posterior de fotos quando sem rede; comandos sensíveis continuam sujeitos à validação atual no servidor |
| Média | Implantação e importação | Assistente de configuração, importação validada de planilhas, duplicidades, treinamento por perfil e exportação de dados do cliente |
| Média | Portal da administradora | Carteira de condomínios e visão de pendências com dados isolados e delegação por funcionário; evitar uma credencial coletiva |
| Posterior | Sensores e eficiência | Medição de reservatórios, vazamentos ou consumo após validar hardware, manutenção, custo e confiabilidade |

## Melhorias nos recursos já solicitados

1. **Casa e histórico:** manter identidade estável e versões de estrutura; distinguir proprietário, ocupante, pagador, representante e autorizador. Não dar a um novo dono acesso automático aos documentos pessoais anteriores.
2. **Estadias:** reduzir trabalho com formulário seguro de pré-cadastro enviado ao responsável; o proprietário/gestor valida antes da autorização. Não exigir integração com Airbnb/Booking para o primeiro módulo. Estudar APIs e condições de cada parceiro antes de prometer sincronização; calendários, quando suportados, não substituem relação de hóspedes e veículos.
3. **Estacionamento:** distinguir número de veículos cadastrados, limite simultâneo por unidade e disponibilidade física. Não estimar vagas livres apenas pelo número de placas autorizadas.
4. **Passeio virtual:** oferecer também busca e mapa/lista simples. Separar o conteúdo visual da ficha privada. Exibir data de atualização das imagens e locais interditados. Validar cobertura, desempenho em celular e custo dos panoramas antes de capturar todo o empreendimento.
5. **IA:** respostas com origem e data, permissões por público, indicação de incerteza e escalonamento humano. Resumos de gestão e de moradores devem ter conteúdos diferentes. Medir respostas corretas, vazamentos de dados e ações indevidas antes de liberar escrita em tarefas.
6. **Financeiro:** orçamento versus realizado, fundos separados, fechamento mensal, conciliação e segunda aprovação para operações críticas. Saldo bancário e valor livre para gastar são indicadores diferentes.
7. **Cobranças:** memória de cálculo, canal privado, contestação e acordos. Pix Automático depende de autorização do pagador e de instituição/parceiro habilitado; não confundir com Pix agendado pelo usuário.
8. **Fotos e tarefas:** checklists de inspeção, revisão, evidência antes/depois quando necessária e motivo de reabertura. Evitar transformar cada foto em conclusão automática ou em fiscalização contínua de funcionário.
9. **Materiais:** conectar tarefa → consumo → reposição proposta → compra aprovada → entrada → despesa. Assim o custo de manutenção não fica espalhado em módulos desconectados.
10. **Reclamações:** prazo, responsável, atualização privada, direito de esclarecimento e encerramento justificado. Evitar ranking público de denunciados ou julgamento automático.
11. **Governança:** regras, procurações e mandatos com vigência; distinguir assembleia formal de enquete. Troca de gestão precisa de revisão das permissões e não de criação de outro condomínio.
12. **Distribuição:** planos por módulos e limites transparentes de armazenamento, mensagens e IA; marca do condomínio sem duplicar o código; contrato, suporte e exportação na saída. Separar cobrança do software de arrecadação do condomínio.

## Infraestrutura e continuidade

Recomendação: iniciar com serviços gerenciados e infraestrutura compartilhada com isolamento por condomínio. Avaliar Supabase em São Paulo como candidato, sem fechar fornecedor até estimar carga, contrato e orçamento. VPS poderá hospedar processos específicos, mas não é pré-requisito do produto. Banco, arquivos e controle local de portões têm necessidades diferentes.

Backups precisam abranger banco e arquivos; a documentação do Supabase informa que o backup de banco não inclui os objetos armazenados. Seleção de região primária também não resolve sozinha residência de todos os dados. Para distribuição, incluir restauração testada, isolamento de clientes, limites de consumo e tratamento de falhas desde o início.

Fontes: https://supabase.com/docs/guides/database/overview ; https://supabase.com/docs/guides/platform/regions ; https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq

## Ordem de execução sugerida

1. Validar documentos do condomínio piloto, regras de acesso, titularidades e modelo de distribuição; desenhar dados e permissões.
2. Entregar login aprovado, casas, pessoas, estadias, veículos e vagas; testar isolamento e expiração de acessos.
3. Entregar tarefas, dependências, ocorrências, manutenção preventiva, materiais e notificações privadas.
4. Entregar cobrança e conciliação com parceiro financeiro, importando saldos iniciais conferidos.
5. Publicar passeio virtual piloto; evoluir para cobertura maior após teste em celular.
6. Habilitar IA consultiva e resumos com dados autorizados; liberar ações limitadas após validação.
7. Expandir assembleias, integrações físicas, aplicativos e recursos opcionais. Os três canais devem orientar a arquitetura desde a primeira etapa.

## Base da pesquisa e limites

As prioridades e o desenho sugerido são análise do projeto; não são obrigações legais universais. Normas de manutenção e segurança devem ser confirmadas para a localização e instalações do piloto, sem presumir periodicidades únicas.

- Funcionalidades de mercado: https://superlogica.com/recursos/funcionalidades-condominios/ e https://townsq.com.br/planos/
- Pagamentos recorrentes e autorização: https://www.bcb.gov.br/meubc/faqs/s/pix
- Encargos financeiros e alterações legais: https://planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14905.htm
- Material orientativo de segurança da informação: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf

Nenhum serviço foi contratado, nenhuma integração foi ativada e nenhum envio externo foi realizado por este estudo.
