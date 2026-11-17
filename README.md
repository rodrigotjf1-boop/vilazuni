# Vilazuni

Administração, convivência e segurança de condomínios — appweb/PWA e aplicativo Android. Piloto: **Condomínio Chandra**.

## Dois apps neste repositório, durante a transição

| | Onde | Situação |
|---|---|---|
| **Vilazuni v1** (novo) | `apps/`, `packages/`, `docs/` | Em construção pela especificação v1.0 (17/11/2026). Ainda não está em produção. |
| App anterior | `app/`, `deploy/` | No ar (0.7.8). Continua sem mudança até a troca ([ADR-0001](docs/adr/0001-reescrita-em-monorepo.md)). |

## Vilazuni v1

Arquitetura (monólito modular): `apps/api` (NestJS 12, REST `/api/v1`), `apps/worker` (fila durável), `apps/web` (React + Vite), `apps/mobile` (Capacitor), `packages/domain` (regras puras), `packages/contracts`, `packages/i18n`, `infra`, `docs`.

```bash
npm ci
npm run build
npm test
```

Documentação:

- [Plano por fases](docs/PLANO.md) · [Situação](docs/STATUS.md) · [Requisitos com IDs](docs/requisitos.md)
- [Decisões (ADRs)](docs/adr/) · [Permissões](docs/matriz-permissoes.md) · [Modelo de dados](docs/modelo-dados.md)
- [Ameaças](docs/threat-model.md) · [Telas](docs/mapa-telas.md) · [Pendências do condomínio](docs/pendencias-implantacao.md)

Dados de demonstração são fictícios e identificados. Nenhuma cobrança, mensagem ou comando físico real sai sem ativação autorizada.

## App anterior

Documentação em [app/README.md](app/README.md), [deploy/README.md](deploy/README.md) e `fundacao/`. Não inserir dados reais de moradores no ambiente local.
