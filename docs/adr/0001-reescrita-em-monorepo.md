# ADR-0001 — Reescrita do Vilazuni em monorepo modular

- **Situação:** aceita (17/11/2026)
- **Decisão do dono:** "usar o prompt e os arquivos como principal; se necessário mudar o que já criamos, como um reset; só utilizar o que já temos se for reaproveitável" (17/11/2026).

## Contexto

O app atual (`app/`, versão 0.7.8 no ar) é Node puro com toda a API em um arquivo, o banco inteiro guardado como **um documento JSON** (no Postgres, uma linha por condomínio regravada a cada mudança), uma fila única para todos os condomínios, sessões em memória e anexos em base64 na memória. A especificação v1.0 (`docs/especificacao/`) exige:

- PostgreSQL com chaves estrangeiras compostas por condomínio e **RLS como segunda barreira**;
- transações e restrições para reservas, vagas e estoque concorrentes;
- fila durável com outbox, idempotência e reprocessamento;
- arquivos privados em armazenamento compatível com S3;
- app Android com o build web embutido (Capacitor) e sessão nativa no Keystore;
- 58 testes de aceite (T01–T58).

Nenhum desses pontos cabe no desenho atual sem trocar a base de dados, a autorização e o front. A especificação manda propor adaptação por ADR quando a arquitetura existente é coerente; aqui ela não atende aos invariantes.

## Decisão

1. Construir a v1 no **mesmo repositório**, como monorepo modular (`apps/api`, `apps/worker`, `apps/web`, `apps/mobile`, `packages/*`, `infra`, `docs`), seguindo a seção 4 da especificação.
2. O app atual (`app/`, `deploy/`) **continua no ar sem mudança** até a v1 atingir os fluxos da Fase 1 em demonstração. A troca em produção é um passo próprio (ADR futuro), com exportação dos dados atuais antes.
3. Reaproveitar só o que serve:
   - o **cenário 3D da tela de entrada** (`app/world-*.mjs`, aprovado pelo dono em 12/11), embrulhado como componente;
   - o conhecimento das correções da auditoria de 12/11 (multa até 2%, juros que recomeçam só com o vencimento, estorno pelo valor devolvido, id de evento do Asaas com `&`, fila que não trava com item ruim, cobrança incerta com saída conferida, aprovação por outra pessoa, limite de login por conta, vínculo de grupo por código), que viram testes da v1;
   - a experiência de implantação no Easypanel (Node 24.22.1 fixo, Caddy, segredos fora do repositório).
4. Banco do Vilazuni isolado dos projetos Regem/DMS.

## Consequências

- Dois apps no repositório durante a transição; o CI valida os dois.
- Nada da v1 vai a produção antes do passo de troca.
- O registro de erros do app atual (`ERROS-CONHECIDOS.md`, local) continua valendo como conhecimento.
