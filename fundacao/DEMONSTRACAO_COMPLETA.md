# Demonstração completa — versão 0.5.0

Para explorar os módulos com dados relacionados, abra **Condomínio → Explorar demonstração completa → Criar e explorar demonstração**. A conta de síndico cria um contexto próprio chamado **Condomínio Chandra · Demonstração**, separado dos registros operacionais do condomínio. A demonstração não utiliza uma das cinco implantações de clientes do pacote.

A faixa **Demonstração · dados fictícios** permanece visível. **Cadastros e perfis** abre o catálogo dos módulos e permite experimentar síndico, zelador, proprietário, inquilino anual, hóspede temporário, portaria, imobiliária e administração de apoio. A sessão continua vinculada à conta real que criou a demonstração, e cada perfil mantém suas permissões. **Voltar ao meu condomínio** retorna ao contexto original.

## O que vem preenchido

| Área | Exemplos relacionados |
|---|---|
| Casas e pessoas | 14 casas com proprietários, 2 contratos anuais, ocupação, placas, contatos e fotos ilustrativas; contas fictícias para os perfis |
| Equipe e mural | Síndico, zelador, vigência, agenda, aviso importante, publicações de moradores e leitura por pessoa |
| Estadias | Diária e temporada vigentes, estadia agendada, solicitação em análise e cancelamento; ocupantes e veículos |
| Tarefas e preventiva | 7 tarefas do dia/semana/mês, etapas de execução/revisão/conclusão, checklist e imagens de exemplo; 3 planos preventivos |
| Dependências | 4 locais ligados ao passeio 3D e 3 reservas em situações diferentes |
| Materiais e compras | 5 materiais, estoque e movimentações, 3 fornecedores, 4 compras com cotações; uma compra recebida gera conta a pagar |
| Atendimento | 3 ocorrências e 3 encomendas; acompanhamento e notificações por perfil |
| Documentos e consulta | 5 documentos PDF, versões, prazos e arquivamento; 4 fontes, 2 resumos e consulta local |
| Participação | 3 enquetes e 4 assembleias em rascunho/publicada/em andamento/encerrada, com votos e ata demonstrativa |
| Financeiro | 2 fundos, 3 contas, lançamentos, transferências, contas pagas/parciais/abertas, inadimplência fictícia, rateios, orçamento, recorrência, acordo, encargos, fechamento, extrato para conciliar, cobranças manuais e contestações |
| Privacidade e alertas | 3 pedidos em estágios diferentes, alertas de documentos/estoque/tarefas e notificações internas |
| Portaria e integrações | Portão e câmera simulados; passagem e placa sintéticas; canal externo desativado; telas de preparo Asaas e agente WhatsApp |

As datas são calculadas no momento da criação, no fuso de Brasília. A demonstração é persistida: reabrir reutiliza os registros e mantém as alterações feitas durante a exploração. Não há reposição automática de exemplos alterados ou encerrados.

## Contatos e fotos fictícios

Todos os nomes são identificados como fictícios, e os e-mails usam `example.invalid`. Os telefones/WhatsApp usam a faixa reservada **+1 202 555 0100–0199**, para não associar os exemplos a contatos de pessoas reais. Os botões de WhatsApp e ligação demonstram os links; não representam atendimento disponível.

As fotos usam uma ilustração com a indicação **Pessoa fictícia**. Retratos, fotos de tarefas e PDFs são gravados pelos mesmos controles de anexos privados do aplicativo. Na casa 02, o zelador recebe uma autorização temporária de exemplo para consultar contatos de inquilinos; nas demais casas, a restrição continua valendo. Proprietário e síndico podem retirar a autorização.

As identidades fictícias não aceitam login, recuperação de senha ou ativação por convite. Não existem senhas de teste compartilhadas: a troca de perfil ocorre exclusivamente dentro da sessão autenticada de quem criou a demonstração. Outra conta não pode entrar na demonstração privada de seu criador.

## Serviços externos

Os módulos locais funcionam com registros normais do sistema. **Asaas, WhatsApp/Evolution, Telegram, IA externa e push não enviam nada nem realizam operações externas no contexto demonstrativo**, mesmo quando o servidor tem credenciais de produção. As telas de integração mostram o preparo; não há emissão Asaas ou mensagem real simulada como confirmação de um provedor. O financeiro usa cobranças manuais e exemplos locais para explorar os fluxos.

Portão e câmera funcionam exclusivamente em modo simulador. O contexto real permanece com suas configurações e integrações existentes.

## Disponibilizar no site

No Easypanel, implante a `main` atualizada do serviço `app`, preservando banco, volume e chaves. Confira **0.5.0** em `/version.json` e atualize o aplicativo quando aparecer o aviso. Em seguida, use o botão de demonstração acima. A entrega não acessa uma sessão administrativa da VPS e não aplica preenchimentos remotamente sem essa ação autenticada.

O preenchimento anterior de sete casas continua disponível em **Condomínio → Preencher dados fictícios**. A demonstração completa é a opção para explorar todas as áreas sem misturar exemplos às operações reais.

Prévias sintéticas: [catálogo de módulos e perfis](../previa-demonstracao-completa.png), [ficha com contatos no celular](../previa-demonstracao-celular.png).
