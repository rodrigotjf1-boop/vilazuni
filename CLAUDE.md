# Vilazuni — instruções do repositório

Administração condominial (web/PWA + Android). Piloto: Condomínio Chandra. **Especificação:** `docs/especificacao/` (os originais ficam fora do git enquanto o repositório for público).

## Comandos (raiz)

- `npm ci` — dependências (versões exatas, lockfile).
- `npm run build` — compila `packages/domain` e `apps/api` (TypeScript 6.0.3).
- `npm test` — Vitest (regras puras e API).
- `npm run format:check` / `npm run format` — Prettier.
- `npm run start:api` — API compilada (`DATABASE_URL` obrigatória; ver `apps/api/src/config.ts`).

## Invariantes (não negociar sem ADR)

1. Autorização **no servidor** em todo pedido: papel + condomínio + unidade + vínculo + período + ação; negar por padrão. Esconder menu não é barreira.
2. `condominium_id` vem do vínculo autenticado, nunca do cliente; chave estrangeira composta + RLS por transação (ADR-0004).
3. Janela do hóspede `check_in − 3 h ≤ agora_do_servidor < check_out + 30 min`; o app não decide pelo relógio do aparelho.
4. Dinheiro em centavos inteiros; medidas com unidade; ausente ≠ zero confirmado; sem ponto flutuante em conta (ADR-0005).
5. Integração sem credencial fica `disabled`/`demo`/`sandbox` identificada; nunca aparece como sucesso real; produção recusa `demo` (ADR-0008).
6. Segredo da casa: cofre AEAD com chave fora do banco; nunca em push, e-mail, grupo, log ou IA (ADR-0007).
7. Efeito externo só por outbox + worker, com idempotência e revalidação antes do envio (ADR-0006).
8. Nada de dado real inventado: valor desconhecido = pendente; demonstração identificada.

## Onde está cada coisa

- Plano por fases: `docs/PLANO.md` · Situação: `docs/STATUS.md` · Requisitos com IDs: `docs/requisitos.md`
- Decisões: `docs/adr/` · Permissões: `docs/matriz-permissoes.md` · Dados: `docs/modelo-dados.md`
- Ameaças: `docs/threat-model.md` · Telas: `docs/mapa-telas.md` · Pendências do condomínio: `docs/pendencias-implantacao.md`

## Fluxo

Branch → PR → CI verde → merge squash. Testes que falham sem a correção. O app anterior (`app/`, `deploy/`) só muda por pedido explícito.
