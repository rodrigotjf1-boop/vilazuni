# ADR-0002 — Pilha e versões fixadas

- **Situação:** aceita (17/11/2026), **revista em 17/11/2026 na F1.1** para dizer o que o código usa de fato. Versões conferidas no registro do npm; lockfile fixa as exatas. Regra de escolha: a **maior** versão estável publicada há pelo menos 14 dias (a última publicada pode ser correção de uma linha antiga).

| Camada | Escolha | Versão no código | Observação |
|---|---|---|---|
| Runtime | Node.js | 24.22.1 (produção e CI) | O PC de desenvolvimento tem 22.23.4; o React Router 8 pede ≥ 22.22. Boletim de segurança de 21/10/2026 exige ≥ 24.22.1 em produção. |
| Linguagem | TypeScript | **6.0.3** | A 7.0 (compilador nativo) não traz API programática e a compatibilidade com `experimentalDecorators` + `emitDecoratorMetadata` (de que o NestJS depende) não está confirmada em fonte oficial. Rever na 7.1. |
| API | NestJS | 12.5.1 | Injeção sempre explícita (`@Inject`), porque o executor de testes não gera metadados de tipo. |
| Banco | PostgreSQL | 17 (CI e produção), 18 no PC | Recursos usados existem nos dois. |
| Acesso ao banco | **SQL escrito à mão + driver `pg`** | 8.23.1 | **Revisto:** o Drizzle previsto não foi adotado. O isolamento (RLS), as funções estreitas, as travas e as conferências já são SQL; o driver direto evita uma camada que precisaria ser contornada. Migrations `apps/api/migrations/NNNN_*.sql`, aplicadas em ordem com conferência do conteúdo (SHA-256). |
| Validação | Zod | 4.6.7 | Esquemas estritos (campo desconhecido é recusado) nas rotas. **Pendente:** `packages/contracts` compartilhado entre API e telas; até lá os formatos das telas ficam em `apps/web/src/lib/types.ts` e os testes de ponta a ponta conferem. |
| Senha e segundo fator | `@node-rs/argon2`, `otplib`, `@noble/ciphers` | 2.2.2 / 13.6.0 / 2.4.0 | ADR-0003, ADR-0007, ADR-0010. |
| Fila durável | pg-boss | 12.x | Fila no próprio Postgres; outbox transacional (ADR-0006), a partir do primeiro envio externo. |
| Telas | React + Vite + React Router + TanStack Query | 19.3.1 / 8.3.5 / 8.5.1 / 5.105.3 | Build estático (sem SSR), servido na mesma origem da API e embutido no Android. |
| Estilo | Tailwind CSS | 4.3.4 | Tokens da paleta da especificação; fonte do sistema (nenhuma requisição a terceiros). |
| Idiomas | i18next + react-i18next | 26.7.1 / 17.1.11 | pt-BR, es, en; o TypeScript recusa idioma com chave faltando ou sobrando. As linhas 27/18 saíram em 16/11/2026: rever depois de 14 dias. |
| QR Code | uqr | 0.1.3 | Sem dependências; desenhado como SVG sem `innerHTML`. |
| Android | Capacitor | 8.6 | Build web embutido; sem `server.url` remoto em produção. Requisitos de JDK/SDK conferidos ao gerar o primeiro APK. |
| Testes | Vitest + Playwright | 5.1.0 / 1.64.1 | Vitest nas regras e na API (Postgres de verdade, relógio injetável); Playwright de ponta a ponta contra a API compilada, no computador e na largura de celular. |

## Regras

- Versão exata no `package.json` (sem `^`), lockfile no git, CI com `npm ci`.
- Atualização de versão em PR próprio, com a nota da mudança e a suíte verde.
