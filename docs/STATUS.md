# Situação da implementação — Vilazuni v1

Atualizado a cada PR. "Implementado" = no código, com teste executado e resultado registrado. Mock, teste não executado ou integração sem homologação **não** contam como prontos.

Última atualização: 17/11/2026 — F1.1d, parte 3 (comando que limpa a base de teste); antes, o cadastro dos proprietários pelo link do condomínio (#42).

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
| Comandos: `dev:db` (banco local só na própria máquina), `migrate` (papel dono), `seed:demo`, `limpar:demo` (papel dono) — rodados contra o Postgres local, com a API compilada respondendo ao login demonstrativo | `apps/api/src/cli` | conferido à mão ✅ |
| Guarda contra consulta simultânea no mesmo cliente do banco (erro no pg 9) | `apps/api/test/support/api.ts` | 3 casos ✅ (provada com o defeito) |
| Sessão web (cookie HttpOnly SameSite=Lax + CSRF + origem permitida) e nativa (bearer de 15 min + refresh rotativo de 30 dias com detecção de reuso); sair, listar e encerrar sessões; limite de tentativas por conta e por endereço; respostas iguais para senha errada e e-mail inexistente | `apps/api/src/auth` | T56 + sessões — 13 casos ✅ |
| Convite de uso único (hash, validade, 5 tentativas, trava contra aceite duplo), aceite cria titularidade PENDENTE | `apps/api/src/invitations` | T01, T06 — 6 casos ✅ |
| Pedido, lista, validação e recusa de titularidade (versão, repetição idempotente, ninguém decide o próprio, recusa com motivo) | `apps/api/src/ownership` | 3 casos ✅ |
| Minhas casas, todas as casas (gestão/conselho), uma casa (a própria ou pela gestão; a de outra pessoa/condomínio = 404 igual a "não existe"); pessoa em dois condomínios escolhe qual | `apps/api/src/units` | T02, T03, T04, T05, T19, T20, T54 — 6 casos ✅ |
| API: saúde, prontidão, CORS, cabeçalhos seguros, configuração validada (id de correlação e "negar por padrão" contam nos casos de sessão) | `apps/api` | 6 casos ✅ |
| API para as telas: token CSRF recuperável depois de recarregar (derivado da sessão), "o que posso ver aqui" com aviso de mandato a 30 dias, lista mínima de casas para pedir titularidade, residência em "Minhas casas" | `apps/api/src/auth`, `authz/access.controller.ts`, `units` | 5 casos ✅ |
| **Telas (F1.1c-1)** — React + Vite, pt-BR/es/en: Entrar (com retorno seguro), Aceitar convite, Minha casa (vínculos, vaga, coproprietários, pedir outra casa), Verificação em duas etapas (QR Code, códigos de recuperação, confirmar, trocar de celular), Sessões e aparelhos, Escolher condomínio; avisos de demonstração e de fim de mandato | `apps/web` | 16 de ponta a ponta ✅ (computador e celular) + 2 de regra |
| **Telas de Gestão (F1.1c-2)**: Titularidades (pendentes, validadas, recusadas; validar com data; recusar com motivo que a pessoa vê; convidar proprietário com link de uso único mostrado uma vez), Pessoas e papéis (pessoas com casas e papéis; papéis com mandatos e delegações; conceder papel — síndico com mandato e ata; encerrar; registrar mandato; delegar só o delegável; encerrar delegação; convidar para papel; aviso "sem mandato vigente"), Auditoria (filtro por resultado e ação, mais antigos). O menu mostra cada área conforme o que a pessoa pode fazer; ação que pede o código mostra o pedido ali mesmo e repete a ação; quem não configurou vai configurar e volta. Formulário salvo fecha (nada preenchido para segundo envio) | `apps/web/src/pages/gestao` | 4 de ponta a ponta ✅ (Tenaz valida e convida; recusa com motivo visto pela pessoa; síndica configura o código pela Gestão, concede, delega, encerra e confere a auditoria; celular sem rolagem lateral) |
| **Entrada com o cenário 3D** aprovado em 12/11 (ADR-0001): a vila do condomínio ao fundo do "Entrar" (módulos WebGL do app anterior, sem biblioteca, carregados à parte — 16 KB comprimidos), tomadas de cartão-postal em sequência; parada com "reduzir movimento" e em aparelho fraco; sem WebGL, o fundo na cor da marca. Decorativa (sem foco, escondida do leitor de tela); o painel do formulário fica por cima, claro, à direita em tela larga | `apps/web/src/cena`, `components/CenaEntrada.tsx` | 2 de ponta a ponta ✅ + conferida por foto |
| **Cadastro pelo link do condomínio (F1.1d, ADR-0011/0012)**: a gestão gera o link (validade, limite de cadastros, mostrado uma vez com QR Code, lista com uso e situação, revogar); a página pública `/cadastro/:token` pede o e-mail, manda o código de 6 dígitos (15 min, uso único, 5 tentativas, 5 por e-mail/hora) e conclui com conta nova ou a senha da conta existente, pedindo até 5 casas — todas **pendentes**, sem papel, sem duplicar vínculo; origem de fora recusada; auditoria | `apps/api/src/signup`, `apps/web/src/pages/Cadastro.tsx`, `pages/gestao/SignupLinks.tsx`, migration `0004` | 14 casos da API ✅ + 2 de ponta a ponta ✅ (gerar, cadastrar com código errado e certo, pedido pendente na gestão, a conta nova entra, revogar; link inexistente) + celular sem rolagem lateral |
| **Fila de saída e e-mail por adaptador (ADR-0012)**: a mudança e o envio na mesma transação, chave de idempotência, despachante com `SKIP LOCKED`, 5 tentativas com espera crescente, `dead`/`skipped` com motivo, o código sai do registro depois do envio; e-mail `disabled` / `demo` (caixa da demonstração) / `sandbox`/`live` (Amazon SES, ainda sem credencial — P23); textos em pt-BR, es e en | `apps/api/src/messaging` | 3 casos ✅ (falha e desistência sem guardar o código, envio desligado, sem remetente, idioma) |
| **Limpeza da base de teste (F1.1d, ADR-0011 §2)**: `npm run limpar:demo` mostra o que sairia (prévia, nada apagado); com `-- --apagar` apaga os condomínios de demonstração com tudo deles e as contas de teste (`[DEMO]` e as criadas nos condomínios de demonstração), numa transação, e registra na auditoria geral. Nunca toca em condomínio de sandbox/produção nem em quem tem registro neles (mantém e conta). Recusa sem `VILAZUNI_ENV=demo`/`sandbox` escrito. Repetir não apaga mais nada; a semeadura volta a funcionar depois | `apps/api/src/seed/limpar-demo.ts`, `cli/limpar-demo.ts` | 5 casos ✅ num banco à parte + conferido à mão no banco local (prévia, apagar, nada na 2ª rodada) |

Total: **133 testes, 133 aprovados** (`npm test`, 17/11/2026, Postgres 18 local; CI com Postgres 17): 37 de regras puras, 94 da API (sessões 14, identidade 16, gestão 17, cadastro por link e fila 17, limpeza 5, semeadura 4, cofre 6, detector 1, saúde 6, RLS 8) e 2 de regra das telas. **Ponta a ponta:** 24 aprovados (`npm run e2e`: banco novo, semeadura, API compilada com o e-mail em modo demonstração, prévia das telas, Chromium no computador e no Pixel 7). Compilação sem erro. Telas conferidas também por foto no computador e a 375 px.

## Interface unificada na cópia de desenvolvimento

- O Portal, o Calendário de ocupação e a Mesa de operação usam a mesma navegação e os dados de estadias da v1. O calendário mostra noites por unidade no computador e a agenda diária no celular. A mesa usa a data do condomínio e inclui a ficha da chegada e a consulta manual de placa.
- A tela de entrada da v1 usa a marca do aplicativo e o formulário direto, substituindo a cena 3D descrita no histórico acima.
- O build de avaliação para Android abre a mesma interface web em uma instalação HTTPS da v1. Consulte [Vilazuni v1 no Android](../apps/mobile/README.md).

## Em andamento

- **F1.1 concluída** com a limpeza da base de teste.
- **F1.2 em desenvolvimento** (`docs/PLANO.md`). A cópia de desenvolvimento tem a migration 0005, o cadastro de estadias, a decisão pela gestão, a consulta manual de placas de temporada e o link de **Minha estadia**. A lista nominal exige titularidade vigente da casa, gestão autorizada ou delegação expressa à zeladoria. Alterar datas devolve a estadia para análise e invalida o link emitido.
- A F1.2 ainda inclui a entrega das informações e dos segredos da casa. As regras do condomínio e o guia para hóspedes entram à medida que o conteúdo for definido. O cadastro de placas permanentes e a leitura por câmera são etapas posteriores.

## Decidido

- ADR-0009 — entrada por convite no piloto, ninguém decide o próprio pedido, decisão com versão e repetição idempotente, e-mail normalizado no banco.
- ADR-0010 — segundo fator (TOTP no cofre, recuperação, trava), gestão com 2F, atos críticos com 2F recente, ninguém concede a si, delegação limitada, mandatos sem sobreposição.
- ADR-0011 — decisões do dono de 17/11: Amazon SES da DMS, cadastro dos proprietários por link do condomínio, repositório público até o fim (sensível fora do git), multa 2% + juros 1% ao mês no app atual, troca após a Fase 1.
- ADR-0002 revisto — SQL escrito à mão com o driver `pg` (sem Drizzle) e as versões exatas das telas.
- ADR-0012 — fila de saída dentro da API (sem worker separado no piloto), e-mail por adaptador (demo com caixa própria; SES no `live`), regras do link e do código de cadastro.

## Variáveis novas da API

`VILAZUNI_MASTER_KEYS` (obrigatória fora da demonstração; `id:base64` de 32 bytes, a primeira cifra) e `DATABASE_OWNER_URL` (só para `npm run migrate`). F1.1d: `MESSAGING_MODE` (`disabled` até o SES ser ligado), `SES_REGION` (padrão `sa-east-1`), `OUTBOX_INTERVAL_MS` (padrão 5000), `DEMO_MAILBOX_ROUTE` (só demonstração); no `live`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` de uma credencial que só envia. Nenhum valor real no repositório.

## Bloqueado por informação externa

Ver `docs/pendencias-implantacao.md` (P01–P23). Nada bloqueia o desenvolvimento; bloqueia só o efeito real ligado a cada item. P23: provedor (SES da DMS) e remetente (`chandra.vilazuni.com`) decididos; o código está pronto e testado em modo demonstração; falta verificar o subdomínio no SES e a credencial de envio, na implantação da v1.

## App anterior

`app/` segue no ar até a troca (ADR-0001), só com correções e decisões do dono.

- **0.7.9 — M4 (ADR-0011):** multa e juros da regra de encargos aprovada vão para o Asaas na cobrança (multa em %, juros em % ao mês); a prévia mostra os encargos. Pago com atraso: a conta quita pelo valor dela e os encargos entram à parte ("Encargos pagos pelo Asaas"); campos do Asaas que não conferem entre si mandam para conferência. Estorno devolve primeiro os encargos, depois reabre a conta. Testes: 4 casos novos em `app/tests/asaas.test.mjs` (3 falham contra o código anterior); suíte do Asaas 17/17. Deploy: clique do dono no Easypanel; conferir `/healthz` = 0.7.9.
