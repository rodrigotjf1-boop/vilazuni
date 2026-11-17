# ADR-0003 — Autenticação e sessões

- **Situação:** aceita como ponto de partida (17/11/2026); revisar ao implementar passkeys e MFA.

## Requisitos (especificação §6)

- Autocadastro nunca escolhe papel administrativo; titularidade nasce **pendente**.
- Convite individual, uso único, token aleatório guardado só como hash, validade e limite de tentativas.
- Navegador: cookie `HttpOnly` + `Secure` + `SameSite`, defesa CSRF e conferência de origem; o JavaScript nunca recebe o refresh.
- Android: `Authorization: Bearer` com access curto e refresh **rotativo** no armazenamento protegido (Keystore); revogação.
- Um cabeçalho "sou o app" nunca desliga CSRF de pedido autenticado por cookie (T56).
- MFA obrigatório para síndico, Tenaz com poder financeiro, suporte privilegiado e atos críticos.
- Recuperação de conta não concede propriedade; vínculo é verificado à parte do login.
- Encerrar uma sessão, todas as sessões, e revogar de verdade.

## Decisão

Camada de sessão **própria e pequena**, montada sobre bibliotecas mantidas para a parte criptográfica — nunca criptografia escrita à mão:

| Peça | Biblioteca |
|---|---|
| Hash de senha | `@node-rs/argon2` (argon2id, parâmetros OWASP) |
| TOTP (MFA) | `otplib` |
| Passkeys (fase seguinte) | `@simplewebauthn/server` |
| Tokens | `crypto.randomBytes(32)`; no banco só o SHA-256 |

- **Sessão** = linha em `auth_session` (usuário, dispositivo, transporte `web`/`native`, MFA cumprido em, criada, último uso, expira, revogada).
- **Web:** cookie de sessão opaco (`__Host-vz_sess`, `HttpOnly; Secure; SameSite=Lax; Path=/`) + token CSRF por sessão enviado em cabeçalho; pedidos que mudam estado exigem CSRF **e** `Origin` na lista permitida.
- **Nativo:** access opaco de 15 min + refresh de 30 dias; cada uso do refresh gera um novo e invalida o anterior; reuso de refresh antigo revoga a família inteira (roubo detectado).
- Toda requisição autenticada **relê a sessão e os vínculos no servidor** (nada de permissão guardada em JWT): mandato vencido, estadia cancelada ou vínculo encerrado valem na hora (T10, T11, T19).

## Alternativa avaliada

Biblioteca de autenticação completa (ex.: Better Auth). Não adotada agora: o modelo exigido (refresh rotativo com detecção de reuso, dois transportes com regras diferentes de CSRF, revalidação de vínculo a cada pedido, MFA por papel e por ato) teria de ser construído por cima dela, brigando com o modelo de sessão próprio da biblioteca. Rever se ela passar a cobrir esses pontos de forma nativa.

## Testes que guardam

T01, T06, T10, T11, T19, T56 e os de sessão (expiração, revogação, reuso de refresh).
