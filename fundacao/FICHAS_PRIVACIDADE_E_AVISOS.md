# Fichas da casa e avisos importantes — 0.4.0

A ficha da casa começa pelo proprietário, pelo uso informado do imóvel (mora no local ou aluga) e pela ocupação atual. Contatos estruturados geram botões com ícones de WhatsApp, telefone e e-mail. Fotos de identificação são opcionais e privadas; as placas cadastradas aparecem com destaque e permanecem vinculadas ao titular ou à estadia.

Ocupação atual distingue contrato residencial, diária e temporada. Somente estadias aprovadas dentro do período e contratos iniciados e ainda vigentes compõem a situação atual; vínculos futuros não indicam presença. Datas são apresentadas no fuso de Brasília. Vínculos simultâneos pedem conferência, e contrato vencido não é apresentado como morador atual confirmado. O cadastro não comprova presença física nem libera portão ou estacionamento.

## Contatos de inquilinos

- Síndico: consulta os contatos e as fotos dos inquilinos do próprio condomínio.
- Proprietário: consulta os inquilinos das casas vinculadas à sua conta.
- Zelador: consulta somente as casas autorizadas pelo síndico ou pelo proprietário, até a data definida, inclusive esse dia em Brasília. A autorização pode ser revogada imediatamente.
- Imobiliária e gestão com delegações: continuam operando os módulos concedidos, mas não recebem contatos/fotos de inquilinos por causa da delegação genérica.
- Perfil pessoal: cada pessoa consulta e atualiza seus próprios contatos; isso não dá acesso aos contatos de outros inquilinos.

A restrição é aplicada na API, nas fichas do passeio, no histórico, nos perfis pessoais, na projeção de pagamentos e nos endereços privados de fotos. Fotografias não entram no cache público do aplicativo. Revogação e vencimento são conferidos a cada consulta.

Para autorizar: **Casas → casa → Moradores e vínculos → Autorizar contatos ao zelador**. Selecione uma conta ativa, validade e motivo. A mesma tela permite retirar o acesso. O nome fictício do zelador na ficha da equipe não cria uma conta: é necessário convidar uma pessoa para o perfil Zeladoria.

## Mural e navegação

O síndico pode marcar **Aviso importante do síndico** ao publicar ou editar um comunicado. Esses avisos aparecem no início do quadro. A exclamação indica versões ainda não lidas por cada pessoa; o destaque importante continua depois da leitura. Editar o comunicado renova o alerta, e expiração ou arquivamento o retira do mural.

O menu mostra os atalhos principais e agrupa os demais recursos em seções recolhíveis, com busca. Cada perfil recebe somente as opções que já pode acessar. Para uma imobiliária que auxilia na administração, use **Administradora / imobiliária de apoio** e conceda os módulos necessários com motivo e validade. O perfil Imobiliária das casas permanece restrito às unidades atribuídas.

Painéis, campos e fichas têm superfícies sólidas e textos mais escuros para facilitar leitura, inclusive no celular.

## Publicação

Implantar a versão **0.4.0** no serviço `app` do Easypanel e usar **Atualizar aplicativo** quando o aviso aparecer. Esta entrega não substitui dados existentes nem aplica preenchimento fictício automaticamente no servidor. Novos contatos, fotos, ocupação e modalidade da estadia são preenchidos nas respectivas fichas.
