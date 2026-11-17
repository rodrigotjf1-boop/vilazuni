# Vilazuni

Administração, convivência e segurança de condomínios — appweb/PWA e aplicativo Android. Piloto: **Condomínio Chandra**.

## Dois apps neste repositório, durante a transição

| | Onde | Situação |
|---|---|---|
| **Vilazuni v1** (novo) | `apps/`, `packages/`, `docs/` | Em construção pela especificação v1.0 (17/11/2026). Ainda não está em produção. |
| App anterior | `app/`, `deploy/` | No ar (0.7.9). Só correções e decisões do dono até a troca ([ADR-0001](docs/adr/0001-reescrita-em-monorepo.md)). |

## Vilazuni v1

Arquitetura (monólito modular): `apps/api` (NestJS 12, REST `/api/v1`), `apps/worker` (fila durável), `apps/web` (React + Vite), `apps/mobile` (Capacitor), `packages/domain` (regras puras), `packages/contracts`, `packages/i18n`, `infra`, `docs`.

```bash
npm ci
node infra/dev/pg-local.mjs start   # Postgres local do projeto (porta 55432; precisa do PostgreSQL instalado)
npm run build
npm test                            # cada rodada cria um banco novo e descartável
```

Rodar a API local com o condomínio **demonstrativo**:

```bash
npm run dev:db -w @vilazuni/api      # cria vilazuni_dev, papéis e migrations; imprime DATABASE_URL e DATABASE_OWNER_URL
# com as variáveis impressas acima:
VILAZUNI_ENV=demo DATABASE_URL=... npm run seed:demo -w @vilazuni/api
VILAZUNI_ENV=demo DATABASE_URL=... ALLOWED_ORIGINS=http://localhost:5173 COOKIE_SECURE=false \
  VILAZUNI_MASTER_KEYS="d1:<32 bytes em base64>" npm start -w @vilazuni/api
```

A semeadura cria 14 casas e 14 vagas provisórias e pessoas fictícias `[DEMO]`, com senhas geradas na hora (gravadas em `apps/api/.demo/credenciais-chandra.txt`, fora do git). Ela recusa rodar fora de `VILAZUNI_ENV=demo` e em banco com pessoas reais. Para limpar a base de teste depois: `VILAZUNI_ENV=demo DATABASE_OWNER_URL=... npm run limpar:demo -w @vilazuni/api` mostra o que sairia; com `-- --apagar` apaga só o que é de demonstração (nunca roda em produção — [ADR-0012](docs/adr/0012-fila-de-saida-e-cadastro-por-link.md)). Em servidor, as migrations rodam com `npm run migrate -w @vilazuni/api` e `DATABASE_OWNER_URL` (papel dono); a API usa sempre o papel sem BYPASSRLS.

Documentação:

- [Plano por fases](docs/PLANO.md) · [Situação](docs/STATUS.md) · [Requisitos com IDs](docs/requisitos.md)
- [Decisões (ADRs)](docs/adr/) · [Permissões](docs/matriz-permissoes.md) · [Modelo de dados](docs/modelo-dados.md)
- [Ameaças](docs/threat-model.md) · [Telas](docs/mapa-telas.md) · [Pendências do condomínio](docs/pendencias-implantacao.md)

Dados de demonstração são fictícios e identificados. Nenhuma cobrança, mensagem ou comando físico real sai sem ativação autorizada.

## App anterior

Documentação em [app/README.md](app/README.md), [deploy/README.md](deploy/README.md) e `fundacao/`. Não inserir dados reais de moradores no ambiente local.
