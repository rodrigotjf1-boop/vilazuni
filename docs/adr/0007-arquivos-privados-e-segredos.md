# ADR-0007 — Arquivos privados e segredos da casa

- **Situação:** aceita (17/11/2026).

## Arquivos

- Armazenamento **compatível com S3**, bucket privado (MinIO no ambiente local; provedor a escolher em produção). Nada público.
- Nome do objeto gerado pelo servidor; metadados no banco (condomínio, dono, finalidade, MIME conferido pela assinatura, tamanho, digest SHA-256, retenção).
- Entrada: extensão + MIME + assinatura do arquivo; limite de tamanho e dimensão; imagens **decodificadas e reprocessadas** (remove EXIF e conteúdo ativo); SVG/HTML/executável recusados (T44).
- Saída: **sempre por rota autenticada** que confere a autorização no momento do download (sem URL assinada longa — T15); `Content-Disposition` correto e `Cache-Control: no-store` no que é privado.

## Segredos da casa (Wi-Fi, código de porta)

- Criptografia de campo **AEAD** (XChaCha20-Poly1305, `@noble/ciphers`) com **envelope**: chave de dados por segredo, embrulhada por chave-mestra que **não fica no banco** (variável de ambiente/KMS, rotação documentada).
- Revelar só por rota autenticada, para quem tem acesso naquele instante; o registro de revelação guarda quem, quando e qual segredo — **nunca o valor**.
- Segredo nunca vai para push, e-mail automático, grupo ou contexto de IA.
