# Situação da implementação — Vilazuni v1

Atualizado a cada PR. "Implementado" = no código, com teste executado e resultado registrado. Mock, teste não executado ou integração sem homologação **não** contam como prontos.

Última atualização: 17/11/2026 — F1.1b (segundo fator, papéis, mandatos, delegações, auditoria e semeadura demonstrativa).

## Implementado e testado

| Item | Onde | Testes (resultado) |
|---|---|---|
| Janela do hóspede (−3 h / +30 min, semiaberta, relógio do servidor); entrada física separada | `packages/domain/src/time` | T07, T08, T09 e janelas independentes por estadia — 7 casos ✅ |
| Volume da piscina exato (19.305 + 9.045 = 28.350 L), confirmado > 0, provisório | `packages/domain/src/pool/volume.ts` | T34 — 3 casos ✅ |
| Energia da bomba, pendente × zero confirmado, união de horas da mesma bomba | `packages/domain/src/pool/energy.ts` | T35, T36 — 3 casos ✅ |
| Calculadora de custos idêntica à planilha | `packages/domain/src/pool/budget.ts` | 4 casos ✅ |
| Unidades do estoque (kg/g, L/mL; massa↔volume só com densidade e fonte) | `packages/domain/src/stock` | T32 — 4 casos ✅ |
| Multa até 2% em centavos; juros sem regra = pendente | `packages/domain/src/money` | T28 — 4 casos ✅ |
| Motor de permissões puro: papel + condomínio + unidade + vínculo + período + ação; mandato e delegação pelo relógio do servidor; gestão exige o segundo fator, ato crítico exige o recente; delegação nunca repassa ato crítico | `packages/domain/src/authz` | T01, T04, T19, T20 — 12 casos ✅ |
| Banco da F1.1: condomínio, casas, vagas (uma por casa), pessoas, contatos verificados (e-mail normalizado), credenciais, sessões, vínculos, papéis, mandatos, delegações, convites, auditoria só acréscimo, códigos de recuperação; RLS por transação; papel da aplicação sem BYPASSRLS | `apps/api/migrations/0001–0003` | T03, T54 no banco — 8 casos ✅ |
| Cofre de campo (XChaCha20-Poly1305 com envelope, contexto por pessoa, rotação de chave-mestra) | `apps/api/src/crypto` | 6 casos ✅ |
| Segundo fator: configurar com a senha, confirmar (10 códigos de recuperação), verificar (código do app ou de recuperação), código repetido recusado, 5 erros travam 15 min, trocar de aparelho com senha + código recente | `apps/api/src/auth/mfa.controller.ts` | T06 (código repetido) — 6 casos ✅ |
| Gestão › Pessoas e papéis: pessoas do condomínio, papéis, mandatos (sem sobreposição), delegações (até o fim do mandato), convite de papel, encerrar papel; ninguém concede a si; auditoria paginada | `apps/api/src/governance` | T20 — 7 casos ✅ |
| Semeadura demonstrativa do Chandra: 14 casas e 14 vagas provisórias, 14 pessoas `[DEMO]` com senhas geradas, casos da §24 da F1.1; repetível; recusa fora de demonstração e com dados reais | `apps/api/src/seed`, `npm run seed:demo` | RQ-019 — 4 casos ✅ |
| Comandos: `dev:db` (banco local só na própria máquina), `migrate` (papel dono), `seed:demo` — rodados contra o Postgres local, com a API compilada respondendo ao login demonstrativo | `apps/api/src/cli` | conferido à mão ✅ |
| Guarda contra consulta simultânea no mesmo cliente do banco (erro no pg 9) | `apps/api/test/support/api.ts` | 3 casos ✅ (provada com o defeito) |
| Sessão web (cookie HttpOnly SameSite=Lax + CSRF + origem permitida) e nativa (bearer de 15 min + refresh rotativo de 30 dias com detecção de reuso); sair, listar e encerrar sessões; limite de tentativas por conta e por endereço; respostas iguais para senha errada e e-mail inexistente | `apps/api/src/auth` | T56 + sessões — 13 casos ✅ |
| Convite de uso único (hash, validade, 5 tentativas, trava contra aceite duplo), aceite cria titularidade PENDENTE | `apps/api/src/invitations` | T01, T06 — 6 casos ✅ |
| Pedido, lista, validação e recusa de titularidade (versão, repetição idempotente, ninguém decide o próprio, recusa com motivo) | `apps/api/src/ownership` | 3 casos ✅ |
| Minhas casas, todas as casas (gestão/conselho), uma casa (a própria ou pela gestão; a de outra pessoa/condomínio = 404 igual a "não existe"); pessoa em dois condomínios escolhe qual | `apps/api/src/units` | T02, T03, T04, T05, T19, T20, T54 — 6 casos ✅ |
| API: saúde, prontidão, CORS, cabeçalhos seguros, configuração validada (id de correlação e "negar por padrão" contam nos casos de sessão) | `apps/api` | 6 casos ✅ |

Total: **105 testes, 105 aprovados** (`npm test`, 17/11/2026, Postgres 18 local; CI com Postgres 17): 37 de regras puras e 68 da API (sessões 13, identidade 16, gestão 14, semeadura 4, cofre 6, detector 1, saúde 6, RLS 8). Compilação TypeScript 6.0.3 estrita sem erro; `npm audit` sem vulnerabilidade.

## Em andamento

- **F1.1c**: telas (React 19 + Vite, pt-BR/es/en) — Entrar, Aceitar convite, Verificação em duas etapas, Minha casa, Gestão › Titularidades, Gestão › Pessoas e papéis, Gestão › Auditoria; aviso de mandato a 30 dias do fim.

## Decidido

- ADR-0009 — entrada por convite no piloto, ninguém decide o próprio pedido, decisão com versão e repetição idempotente, e-mail normalizado no banco.
- ADR-0010 — segundo fator (TOTP no cofre, recuperação, trava), gestão com 2F, atos críticos com 2F recente, ninguém concede a si, delegação limitada, mandatos sem sobreposição.

## Variáveis novas da API

`VILAZUNI_MASTER_KEYS` (obrigatória fora da demonstração; `id:base64` de 32 bytes, a primeira cifra) e `DATABASE_OWNER_URL` (só para `npm run migrate`). Nenhum valor real no repositório.

## Bloqueado por informação externa

Ver `docs/pendencias-implantacao.md` (P01–P23). Nada bloqueia o desenvolvimento; bloqueia só o efeito real ligado a cada item. Novo: P23 (provedor de e-mail transacional).

## App anterior

`app/` (0.7.8) segue no ar sem mudança até a troca (ADR-0001).
