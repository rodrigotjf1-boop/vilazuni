# ADR-0004 — Isolamento por condomínio: chave composta, autorização no servidor e RLS

- **Situação:** aceita (17/11/2026).

## Decisão

1. **Toda tabela de negócio tem `condominium_id`**, com chave primária `id` (UUID v7) e índice único `(condominium_id, id)`. Referências entre tabelas de negócio usam **chave estrangeira composta** `(condominium_id, x_id) → (condominium_id, id)`: o banco recusa ligar a unidade de um condomínio à estadia de outro.
2. O `condominium_id` de um pedido **nunca vem do cliente**: sai do vínculo do usuário autenticado (membership) conferido no servidor.
3. **Autorização no serviço** (primeira barreira): papel + condomínio + unidade + vínculo + período + ação, negar por padrão, em consultas, buscas, downloads, exportações e ferramentas de IA (`packages/domain/policies`).
4. **RLS do PostgreSQL** (segunda barreira):
   - papel de aplicação `vilazuni_app` **sem** `SUPERUSER`/`BYPASSRLS` e **não dono** das tabelas; migrations rodam como `vilazuni_owner`;
   - `vilazuni_owner` tem `BYPASSRLS`: é usado só pelas migrations e pelas **funções de interface estreita** (`SECURITY DEFINER`) que respondem perguntas antes de existir contexto — "em quais condomínios esta pessoa tem vínculo?" e "de qual condomínio é este convite?" — devolvendo só os ids. Sendo dono, ele já poderia desligar a RLS; o atributo não aumenta o risco, e a credencial dele nunca vai para a API;
   - toda tabela de negócio com `ENABLE` + `FORCE ROW LEVEL SECURITY` e política `condominium_id = current_setting('app.condominium_id', true)::uuid`;
   - o contexto é posto **por transação** com `set_config('app.condominium_id', $1, true)` — some no `COMMIT`/`ROLLBACK`, então não vaza pelo pool de conexões;
   - sem contexto, a política não devolve nada (falha fechada).
5. Tabelas globais (pessoa, sessão) não têm `condominium_id`; o acesso a elas passa só pelos serviços de identidade.

## Testes que guardam

T02, T03, T04, T54 — inclusive a prova de que, com o contexto do condomínio A, uma consulta crua ao banco não enxerga linhas do B, e de que o papel de aplicação não consegue desligar a RLS.
