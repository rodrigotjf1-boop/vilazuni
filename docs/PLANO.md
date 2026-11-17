# Plano de implementação — Vilazuni v1 (piloto Chandra)

Base: especificação v1.0 de 17/11/2026 (`docs/especificacao/`). Decisões em `docs/adr/`. Situação de cada requisito em `docs/STATUS.md` e `docs/requisitos.md`.

Cada incremento é **vertical**: banco + API + autorização + tela + teste + documentação, num PR com o CI verde. "Pronto" só o que está no código, com teste executado; integração sem credencial fica em modo identificado (ADR-0008).

## Fase 0 — Preparação

| Item | Entrega |
|---|---|
| F0.1 | Inventário do repositório e decisão de reescrita (ADR-0001) |
| F0.2 | ADRs 0001–0008, plano, status, requisitos com IDs, matriz de permissões, modelo de dados, threat model, mapa de telas, pendências de implantação |
| F0.3 | Monorepo executável: `packages/domain` (regras puras com testes), `packages/contracts`, `packages/i18n`, `apps/api` (saúde/prontidão, OpenAPI), banco local, CI |

## Fase 1 — Base funcional

| Incremento | Escopo | Testes de aceite |
|---|---|---|
| **F1.1 Identidade, condomínio e permissões** | Condomínio, unidades, vagas, pessoas, contatos verificados; papéis por condomínio, mandatos, delegações; sessões web (cookie + CSRF) e nativa (bearer + refresh rotativo); entrar/sair/encerrar sessões; MFA TOTP para gestão; convites de uso único; solicitação de titularidade pendente → validada; copropriedade e mais de uma casa; RLS; seed de demonstração; telas Entrar, Aceitar convite, Minha casa, Gestão › Titularidades, Gestão › Pessoas e papéis | T01–T06, T19, T20, T54, T56 |
| **F1.2 Estadias e acesso temporal** | Estadia (dois responsáveis, exceção justificada), convite do hóspede, grants com janela −3 h / +30 min, cancelar, alterar datas, informações e segredos da casa (cofre, revelar com registro), Minha estadia | T07–T18, T45 (parte) |
| **F1.3 Regras e mural** | Normas em pt-BR/es/en com versão, vigência, aprovador e ciência; avisos com leitura/ciência | T53 |
| **F1.4 Garagem, ocorrências, tarefas, estoque e arquivos** | Vagas e veículos com restrição transacional; livro de ocorrências; tarefas e evidências; estoque com lotes e unidades; arquivos privados | T15, T30–T33, T44 |
| **F1.5 PWA e APK demonstrativo** | Service worker sem dados privados; Capacitor com sessão nativa; APK compilado | T13, T14, T51 (parte), T52 |

## Fase 2 — Operação e finanças

Piscina (perfil, volume estimado × confirmado, leituras, liberação, manual, calculadora de custos com a planilha), patrimônio e empréstimos, contratos (serviço × uso da casa de zelador), projetos 2027, prestação de contas, importação Tenaz, cobranças e conciliação em sandbox, notificações e preferências.
Testes: T21–T29, T34–T37, T47, T57.

## Fase 3 — Comunicação e IA

WhatsApp individual oficial, push, templates, opt-in, relatórios e Zelador Virtual com ferramentas autorizadas e aprovação humana.
Testes: T26, T40–T43, T45, T46, T50, T58.

## Fase 4 — Segurança física (observação)

Inventário e gateway de câmeras, zonas e horários, leitura de placas como sugestão, revisão de eventos. Portão e água continuam desligados por feature flag.
Testes: T38, T39, T48, T55.

## Fase 5 — Produção e expansão

Troca do app atual pela v1 (exportação dos dados atuais antes), backup restaurado em ambiente isolado, assinatura Android sob titularidade correta, política de privacidade e retenção, treinamento, monitoração.
Testes: T49, T52.

## Fora do código (dependem do condomínio)

Ver `docs/pendencias-implantacao.md`: cada pendência bloqueia só o efeito real ligado a ela; o desenvolvimento segue com dados de demonstração identificados.
