# Condomínio Chandra — piloto e primeiro backlog

Município/UF informado pelo usuário em 20/10/2026: **Arraial do Cabo/RJ**. O regime jurídico e os documentos aprovados ainda precisam ser identificados.

## Dados de demonstração

Somente o nome Condomínio Chandra foi confirmado. Quantidade de casas, características, capacidade, regras, localização e pessoas abaixo são fictícias para teste e não descrevem o condomínio real.

| Unidade fictícia | Estrutura de exemplo | Vínculos de exemplo | Estacionamento de exemplo |
|---|---|---|---|
| Casa 01 | Sobrado, 3 quartos | Dois coproprietários; ocupação própria | Duas vagas fixas A01/A02 |
| Casa 02 | Térrea, 2 quartos | Um proprietário; locação residencial contínua | Limite de um veículo na área livre |
| Casa 03 | Sobrado com anexo | Um proprietário; estadia de temporada | Duas vagas fixas A03/A04 |
| Casa 04 | Térrea, estrutura distinta | Um proprietário; sem ocupação confirmada | Zero vagas atribuídas |

Pessoas de teste serão identificadas como fictícias, sem CPF, telefone, e-mail ou placa reais. Credenciais de desenvolvimento não serão entregues como contas de produção. Dependências de exemplo: piscina, depósito restrito, academia, sala de jogos e sala de festas. Regras de reserva e acesso a essas áreas ainda dependem de validação.

## Backlog em ordem de dependência

| Item | Entrega | Aceitação |
|---|---|---|
| F01 | Esquema e migrações da fundação | Relações por condomínio; intervalos válidos; migração reproduzível |
| F02 | Identidade e convite | Convite único, expirável, sem autoatribuição de papel |
| F03 | Vínculos e autorização | Negação padrão; suspensão/revogação efetiva com sessão antiga |
| F04 | Chandra e segundo condomínio fictício | Isolamento comprovado, inclusive usuário com dois vínculos |
| F05 | Casas e versões estruturais | Alteração preserva identidade e histórico |
| F06 | Pessoas e titularidades | Copropriedade e transferência sem apagar ocupação |
| F07 | Ocupações e estadias | Responsável, relação nominal, período, rascunho/análise/decisão |
| F08 | Veículos e estacionamento | Zero/múltiplos veículos; limites e atribuição sem conflito |
| F09 | Autorizações e eventos | Expiração pela hora do servidor; prorrogação/cancelamento auditados |
| F10 | Interface responsiva | Jornada completa por perfil, erros claros, acessibilidade básica |
| F11 | Arquivos privados e auditoria | Download autorizado; sem exposição de tokens/documentos em logs |
| F12 | Preparação de homologação | Testes de segurança/consistência, backup e restauração antes de dados reais |

Fluxo de avaliação ponta a ponta: gestor habilita proprietário → proprietário cadastra estadia → responsável/pessoas/veículos conferidos → política decide autorização → operador registra chegada → período encerra → acesso expira → histórico permanece disponível apenas a quem pode consultá-lo.

## Decisões ainda necessárias, sem bloquear o desenho

- Natureza jurídica do Chandra, casas e dependências reais. Município/UF informado: Arraial do Cabo/RJ.
- Convenção, regimento, regras de temporada e critérios de aprovação.
- Preferência de canal para mensagens e recursos oficiais disponíveis.
- Orçamento para serviços gerenciados, testes e publicação.
- Equipamentos físicos e materiais para passeio virtual.

## Estado da entrega

Fundação funcional documentada: modelo de dados, permissões, fluxos, telas e backlog. Atualização de 18/10/2026: demonstração local executável em app/, com perfis simulados e armazenamento no navegador. Não há migração executada, login real, hospedagem contratada ou integração ativa. Próxima execução: escolher ambiente técnico e transformar F01–F04 em uma base central executável, preservando os critérios definidos.
