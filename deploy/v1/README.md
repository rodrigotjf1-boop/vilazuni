# Homologação do Vilazuni v1 no EasyPanel

O serviço da v1 serve a interface e a API na mesma origem HTTPS. Use um projeto ou serviços separados para a primeira homologação, com PostgreSQL novo e dados de demonstração. O repositório tem dois Dockerfiles durante a transição.

## PostgreSQL da v1

No EasyPanel, crie um serviço **Postgres** dedicado à v1, sem exposição da porta 5432. Abra o console psql desse serviço com a conta administrativa e execute uma vez:

```sql
CREATE ROLE vilazuni_owner LOGIN BYPASSRLS;
\password vilazuni_owner
CREATE ROLE vilazuni_app LOGIN NOBYPASSRLS;
\password vilazuni_app
CREATE DATABASE vilazuni_v1 OWNER vilazuni_owner;
\connect vilazuni_v1
REVOKE ALL ON DATABASE vilazuni_v1 FROM PUBLIC;
GRANT CONNECT ON DATABASE vilazuni_v1 TO vilazuni_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO vilazuni_owner;
```

O comando interativo `\password` pede uma senha própria para cada papel. Guarde ambas e use o host e a porta internos informados em **Credentials**. Use o papel `vilazuni_app` na aplicação e o papel `vilazuni_owner` só para rodar as migrations.

## Serviço web e API

1. Crie um serviço **App** e selecione o repositório `rodrigotjf1-boop/vilazuni`. Escolha a branch que contém este Dockerfile. Na publicação definitiva, use `main` depois da integração.
2. Em **Build**, escolha Dockerfile, com contexto na raiz do repositório, e arquivo `deploy/v1/Dockerfile`.
3. Em **Domains**, adicione um endereço HTTPS de homologação com porta interna **3100**. O endereço fornecido pelo próprio EasyPanel também pode ser usado.
4. Em **Environment**, defina as variáveis abaixo e faça o deploy. Substitua os valores de exemplo por valores do serviço novo. Se a senha contiver caracteres reservados, codifique-os para a URL.

```dotenv
VILAZUNI_ENV=demo
DATABASE_URL=postgresql://vilazuni_app:<senha-da-aplicacao>@<host-interno>:5432/vilazuni_v1
ALLOWED_ORIGINS=https://<dominio-da-homologacao>
COOKIE_SECURE=true
TRUST_PROXY=true
VILAZUNI_MASTER_KEYS=piloto:<chave-de-32-bytes-em-base64>
MESSAGING_MODE=disabled
```

Gere a chave localmente com `openssl rand -base64 32` e guarde-a junto dos segredos do ambiente. O domínio em `ALLOWED_ORIGINS` é a origem exata, sem barra final.

## Migrations e dados fictícios

Abra o console do contêiner da aplicação. Informe a URL do papel dono no prompt do Bash para usar a credencial apenas no comando de migração.

```bash
bash
read -rs -p 'URL do papel vilazuni_owner: ' DATABASE_OWNER_URL
printf '\n'
DATABASE_OWNER_URL="$DATABASE_OWNER_URL" node /opt/vilazuni/apps/api/dist/cli/migrate.js
unset DATABASE_OWNER_URL
```

Copie a URL interna do banco e use o banco `vilazuni_v1` e o usuário `vilazuni_owner`. Para criar as contas fictícias, execute no mesmo console, com o `DATABASE_URL` já configurado pelo serviço:

```bash
cd "$(mktemp -d)"
node /opt/vilazuni/apps/api/dist/cli/seed-demo.js
```

Guarde as credenciais geradas pelo comando em local privado. O perfil proprietário pode cadastrar uma estadia. O perfil síndico consegue abrir a Mesa e o Calendário após configurar a verificação em duas etapas.

## Conferência antes de trocar o domínio

- Abra `/api/v1/health` e `/api/v1/ready`. Faça login e recarregue uma página interna como `/estadias`.
- Valide Portal, Mesa e Calendário com as contas fictícias. No APK de avaliação, digite a mesma origem HTTPS usada no navegador.
- Para ajustar o domínio de produção, teste um backup restaurado do aplicativo anterior e valide a transferência de contas, titularidades, casas, estadias e registros usados no condomínio. As migrations da v1 criam o novo esquema. A transferência dos registros do aplicativo anterior é uma tarefa própria da troca.
- Revise os módulos usados pelo Chandra e cubra o que ainda não estiver disponível na v1. Faça a troca do domínio em uma janela combinada, com o serviço anterior preservado para uma reversão. [Plano da v1](../../docs/PLANO.md).

