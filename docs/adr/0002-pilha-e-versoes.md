# ADR-0002 — Pilha e versões fixadas

- **Situação:** aceita (17/11/2026). Versões conferidas no registro do npm em 17/11/2026; lockfile fixa as exatas.

| Camada | Escolha | Versão | Observação |
|---|---|---|---|
| Runtime | Node.js | 24.22.1 (produção e CI) | O PC de desenvolvimento tem 22.23.4; os motores das bibliotecas aceitam ≥ 20.19/22.12. Boletim de segurança de 21/10/2026 exige ≥ 24.22.1 em produção. |
| Linguagem | TypeScript | **6.0.3** | A 7.0.2 (compilador nativo, 16/11/2026) não traz API programática e a compatibilidade com `experimentalDecorators` + `emitDecoratorMetadata` (de que o NestJS depende) não está confirmada em fonte oficial. Rever na 7.1. |
| API | NestJS | 12.5.x | Módulos de domínio, DTO validado por Zod, OpenAPI (`@nestjs/swagger`). |
| Banco | PostgreSQL | 17 (CI e produção), 18 no PC | Recursos usados existem nos dois. |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45.x / 0.31.x | SQL das políticas RLS em migration escrita à mão, revisada. |
| Validação / contratos | Zod | 4.x | Em `packages/contracts`, compartilhado entre API e web, sem segredo. |
| Fila durável | pg-boss | 12.x | Fila no próprio Postgres; outbox transacional (ADR-0006). Redis só com benefício concreto. |
| Front | React + Vite + React Router + TanStack Query | 19.3 / 8.3 / 8.5 / 5.107 | Build estático (sem SSR) para servir web e Android. |
| Estilo | Tailwind CSS | 4.3 | Tokens da paleta da especificação, contraste conferido. |
| i18n | i18next + react-i18next | 27 / 18 | pt-BR, es, en. |
| Android | Capacitor | 8.6 | Build web embutido; sem `server.url` remoto em produção. Requisitos de JDK/SDK conferidos ao gerar o primeiro APK. |
| Testes | Vitest + Playwright | 5.1 / 1.65 | Relógio injetável nas regras temporais. |

## Regras

- Versão exata no `package.json` (sem `^`), lockfile no git, CI com `npm ci`.
- Atualização de versão em PR próprio, com a nota da mudança e a suíte verde.
