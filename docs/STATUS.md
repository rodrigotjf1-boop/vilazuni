# Situação da implementação — Vilazuni v1

Atualizado a cada PR. "Implementado" = no código, com teste executado e resultado registrado. Mock, teste não executado ou integração sem homologação **não** contam como prontos.

Última atualização: 17/11/2026 — F1.1a (base de identidade, sessões, convite, titularidade e permissões na API).

## Implementado e testado

| Item | Onde | Testes (resultado) |
|---|---|---|
| Janela do hóspede (−3 h / +30 min, semiaberta, relógio do servidor); entrada física separada | `packages/domain/src/time` | T07, T08, T09 e janelas independentes por estadia — 7 casos ✅ |
| Volume da piscina exato (19.305 + 9.045 = 28.350 L), confirmado > 0, provisório | `packages/domain/src/pool/volume.ts` | T34 — 3 casos ✅ |
| Energia da bomba, pendente × zero confirmado, união de horas da mesma bomba | `packages/domain/src/pool/energy.ts` | T35, T36 — 3 casos ✅ |
| Calculadora de custos idêntica à planilha | `packages/domain/src/pool/budget.ts` | 4 casos ✅ |
| Unidades do estoque (kg/g, L/mL; massa↔volume só com densidade e fonte) | `packages/domain/src/stock` | T32 — 4 casos ✅ |
| Multa até 2% em centavos; juros sem regra = pendente | `packages/domain/src/money` | T28 — 4 casos ✅ |
| Motor de permissões puro: papel + condomínio + unidade + vínculo + período + ação; mandato e delegação pelo relógio do servidor | `packages/domain/src/authz` | T01, T04, T19, T20 — casos de regra ✅ |
| Banco da F1.1: condomínio, casas, vagas (uma por casa), pessoas, contatos verificados (e-mail normalizado), credenciais, sessões, vínculos, papéis, mandatos, delegações, convites, auditoria só acréscimo; RLS por transação; papel da aplicação sem BYPASSRLS | `apps/api/migrations/0001–0002` | T03, T54 no banco — 8 casos ✅ |
| Sessão web (cookie HttpOnly SameSite=Lax + CSRF + origem permitida) e nativa (bearer de 15 min + refresh rotativo de 30 dias com detecção de reuso); sair, listar e encerrar sessões; limite de tentativas por conta e por endereço; respostas iguais para senha errada e e-mail inexistente | `apps/api/src/auth` | T56 + sessões — 13 casos ✅ |
| Convite de uso único (hash, validade, 5 tentativas, trava contra aceite duplo), aceite cria titularidade PENDENTE | `apps/api/src/invitations` | T01, T06 — 6 casos ✅ |
| Pedido, lista, validação e recusa de titularidade (versão, repetição idempotente, ninguém decide o próprio, recusa com motivo) | `apps/api/src/ownership` | 3 casos ✅ |
| Minhas casas, todas as casas (gestão/conselho), uma casa (a própria ou pela gestão; a de outra pessoa/condomínio = 404 igual a "não existe"); pessoa em dois condomínios escolhe qual | `apps/api/src/units` | T02, T03, T04, T05, T19, T20, T54 — 6 casos ✅ |
| API: saúde, prontidão, CORS, cabeçalhos seguros, configuração validada (id de correlação e "negar por padrão" contam nos casos de sessão) | `apps/api` | 6 casos ✅ |

Total: **76 testes, 76 aprovados** (`npm test`, 17/11/2026, Postgres 18 local; CI com Postgres 17). Compilação TypeScript 6.0.3 estrita sem erro; `npm audit` sem vulnerabilidade.

## Em andamento

- **F1.1b**: MFA TOTP (obrigatório para síndico e atos críticos), rotas de mandato, delegação e papel; leitura da auditoria; semeadura demonstrativa do Chandra (14 casas, 14 vagas, casos da §24); telas Entrar, Aceitar convite, Minha casa, Gestão › Titularidades e Gestão › Pessoas e papéis.

## Decidido nesta etapa

ADR-0009 — entrada por convite no piloto, ninguém decide o próprio pedido, decisão com versão e repetição idempotente, e-mail normalizado no banco.

## Bloqueado por informação externa

Ver `docs/pendencias-implantacao.md` (P01–P23). Nada bloqueia o desenvolvimento; bloqueia só o efeito real ligado a cada item. Novo: P23 (provedor de e-mail transacional).

## App anterior

`app/` (0.7.8) segue no ar sem mudança até a troca (ADR-0001).
