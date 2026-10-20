# Implantação do Vilazuni 0.2.0

Arquivos preparados para aplicação Node.js + PostgreSQL + volume privado + Caddy/HTTPS. Nenhuma hospedagem ou domínio foi contratado/publicado neste desenvolvimento. Usar inicialmente homologação com dados sintéticos; configurar produção depois da escolha do usuário.

## Preparar ambiente

Requer Docker Engine/Compose, DNS apontando para o servidor e portas 80/443 disponíveis. Caddy emite o certificado para o domínio configurado. Banco e aplicação não têm portas públicas na composição.

1. Copiar `.env.example` para `.env` nesta pasta, restringir leitura ao operador e preencher domínio, `APP_ORIGIN` HTTPS, senhas diferentes para banco administrativo/runtime, URL do papel runtime, código de instalação e chave MFA aleatória de 32 bytes em hexadecimal. Não usar placeholders. Percent-encode caracteres reservados da senha na URL.
2. Guardar segredos em gerenciador/arquivos privados; nunca em Git, ticket ou conversa. O código de instalação é apresentado somente ao responsável para criar a primeira conta. MFA exige autenticador TOTP e guarda privada dos códigos de recuperação.
3. Na raiz: `docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet`, depois `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build`. Não executar `config` sem `--quiet` em logs compartilhados, pois a saída pode conter segredos.
4. Conferir `/healthz`, `/readyz`, HTTPS e login. Sem sessão, `/api/state` deve retornar 401. Origem diferente deve retornar 403; cookie de autenticação deve ter Secure/HttpOnly/SameSite. A produção nova começa sem casas/estadias/tarefas de exemplo.
5. Criar a conta inicial usando o código da instalação. Ativar TOTP antes de operar a gestão. Em Condomínio, cadastrar identidade, regime e unidades reais conferidos. Não importar o piloto fictício como cadastro real.

`001_storage.sql` e o script de inicialização criam tabelas/RLS e o papel `vilazuni_app` sem SUPERUSER/BYPASSRLS no primeiro volume vazio. Para banco existente, aplicar migrações com papel administrativo separado (`MIGRATION_DATABASE_URL`, `npm run db:migrate --prefix app`) e conceder somente USAGE no schema e SELECT/INSERT/UPDATE nas tabelas de execução. A aplicação recusa papel privilegiado e não faz fallback para JSON se PostgreSQL falhar.

O gateway sobrescreve `X-Vilazuni-Client-IP`; a composição habilita `TRUST_PROXY=true` somente para a aplicação na rede privada. Isso preserva o limite de autenticação por cliente, em vez de compartilhar a mesma cota de todas as pessoas no endereço do gateway. Não expor a porta da aplicação diretamente nem habilitar confiança em proxy fora dessa topologia.

Instâncias atuais: **uma aplicação** e processos de fundo internos. Sessões em memória exigem novo login após reinício. Não escalar réplicas sem implementar sessão compartilhada e coordenação de trabalhadores. Atualizações concorrentes do banco retornam conflito e precisam de nova leitura, não de repetição cega.

## Backups e recuperação

O volume privado e o banco formam uma unidade operacional. Backup lógico hidrata os bytes dos anexos e cifra tudo com scrypt + AES-256-GCM. Gere uma chave de pelo menos 16 caracteres e mantenha-a em arquivo privado externo ao Git. Faça backup separado e protegido da `MFA_SECRET_KEY`; sem ela, os autenticadores existentes não podem ser decifrados. Nunca imprima chaves em logs.

Dentro do ambiente da aplicação, com `DATABASE_URL`, `VILAZUNI_DATA_DIR` e `VILAZUNI_BACKUP_KEY_FILE` configurados:

```sh
npm run backup -- create /backups/vilazuni-cifrado.json
npm run backup -- restore /backups/vilazuni-cifrado.json
```

Criar usa arquivo novo; restaurar exige **base de destino vazia**, diretório privado gravável e manutenção sem servidor de aplicação concorrente. Não apontar restauração para produção existente. Testar periodicamente login, anexos, totais e isolamento em ambiente separado. A chave de backup não é gravada no envelope. Arquivo truncado, chave errada ou integridade inválida falham antes de restaurar. Há limite lógico de 192 MiB; para bases maiores, definir snapshot físico coordenado do PostgreSQL/volume, cifrado e com restauração ensaiada.

Para migrar o piloto explicitamente autorizado: parar aplicação de origem, guardar backup original, informar `VILAZUNI_SOURCE_FILES_DIR` quando os anexos não estiverem ao lado de `store.json`, configurar destino vazio e executar `npm run db:import-json -- <store.json>` em `app`. O script preserva a origem e confere conteúdo completo após recarregar o destino. Migração não transforma dados fictícios em registros reais.

Definir antes do lançamento: frequência, destino externo separado, retenção, pessoa responsável, prazo de recuperação e ensaio documentado. O código fornece a operação; não promete backup agendado/armazenado fora do servidor sem configuração operacional.

## Integrações opcionais

| Frente | Configuração do servidor | Conferência antes de habilitar |
|---|---|---|
| Síntese OpenAI | `AI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Conta/modelo, política de dados, orçamento, avaliação com fontes reais |
| Telegram Bot API | `TELEGRAM_ENABLED`, token e segredo próprio do webhook | Bot oficial, grupo exclusivo, nome, horário e fontes explicitamente externas |
| Recuperação por e-mail | `MAIL_API_KEY`, `MAIL_FROM` (adaptador Resend) | Remetente/domínio verificados e teste real de entrega; reset não remove MFA |
| Web push | VAPID pública/privada e `VAPID_SUBJECT` mailto | Permissão e entrega nos aparelhos; inscrição voluntária |
| Portão | `ACCESS_<CHAVE>_URL`, `_SECRET` | HTTPS, HMAC, idempotência, expiração, ambiente controlado e procedimento presencial |
| Placa | `ACCESS_<CHAVE>_EVENT_SECRET` | HMAC do corpo exato, timestamp em milissegundos, nonce e conferência humana |
| Câmera instantânea | `ACCESS_<CHAVE>_SNAPSHOT_URL`, `_CAMERA_TOKEN` | HTTPS autenticado, JPEG/PNG ≤ 2 MiB; não é vídeo contínuo |
| Android TWA | `ANDROID_SHA256_CERT_FINGERPRINTS` separados por vírgula | Impressão do certificado real, domínio e pacote br.com.vilazuni.app |

Webhook Telegram: `POST /api/channels/telegram/webhook`, cabeçalho `X-Telegram-Bot-Api-Secret-Token`; cadastrar somente depois de conferir o domínio HTTPS e a configuração do grupo. API oficial do Telegram deve ser usada para registrar o webhook; token nunca vai em arquivo público. Não há envio a conversas comuns nem WhatsApp automatizado.

Evento de placa: `POST /api/physical/plate-event?device=<UUID>`, `X-Vilazuni-Signature` = HMAC-SHA256 hexadecimal do corpo UTF-8 exato. Corpo: `{"plate":"ABC1D23","timestamp":<milissegundos>,"nonce":"<identificador único de 16–100 caracteres>"}`. Isso registra leitura a conferir; nunca abre portão.

Adaptador de portão recebe `{commandId,operation:"pulse",expiresAt}`, `Idempotency-Key` e HMAC do corpo. Deve rejeitar ID repetido e prazo expirado. Resposta de aceitação: `{commandId,accepted:true}`. Não repetir automaticamente após timeout. A confirmação técnica não comprova passagem; registre o evento observado separadamente.

Credenciais permanecem desativadas/ausentes no desenvolvimento. Não há mensagem externa, custo contratado ou equipamento real homologado nesta entrega.

## Operação e atualização

Preservar volumes e segredos; nunca usar `docker compose down -v` em ambiente com dados. Fazer backup/restauração de ensaio antes de atualizar, aplicar migração com conta administrativa em manutenção e subir a versão revisada. Uma instância indisponível deve ser investigada pelo operador usando diagnóstico mínimo; não publicar dumps, arquivos `.env`, anexos ou logs de conexão.

`/healthz` verifica processo; `/readyz` verifica carregamento da base e integridade dos anexos. Monitorar externamente disponibilidade, espaço do banco/volume, sucesso do backup e entregas incertas. Os endpoints não substituem contratação de monitoramento. Encerramento de cliente interrompe acessos/canais e conserva histórico; reativação exige suporte autorizado e alteração auditada do status em manutenção.
