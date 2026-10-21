# Vilazuni no Easypanel

Implantação inicial em VPS com Easypanel, usando seus serviços nativos **App** e **Postgres**. O painel já controla as portas 80/443 e o HTTPS: não executar `deploy/compose.yaml` nem instalar outro Caddy nessa VPS. Este guia prepara uma instalação nova; não substitui uma base existente.

## 1. Domínio e projeto

No provedor DNS do domínio, criar um registro **A**, nome `app`, apontando para o IPv4 da VPS. Preservar MX/TXT do e-mail. Não deixar um AAAA de `app` apontar para outro servidor. Se houver Cloudflare, começar com o registro sem proxy, para validar a conexão direta ao Easypanel.

Abrir o Easypanel pelo painel do provedor e criar o projeto `vilazuni`. No exemplo abaixo, a aplicação será `https://app.SEU_DOMINIO`. Substituir pelo domínio real; não usar a URL HTTP do painel ou o IP como `APP_ORIGIN`.

## 2. Serviço de banco

No projeto, **New Service → Postgres**:

| Campo | Valor |
|---|---|
| Nome do serviço | `banco` |
| Imagem | `postgres:17-bookworm` |
| Database name | `vilazuni` |
| User | `postgres` |
| Password | Gerada pelo painel, guardada somente pelo operador |

Iniciar o banco e conferir os logs. Em **Credentials**, anotar somente o **host interno** (normalmente `vilazuni_banco`; usar o exibido). Deixar **Expose desativado**: não publicar a porta 5432. O endereço administrativo exibido pelo painel serve para administração; a aplicação usará um papel separado criado no passo 5.

## 3. Serviço da aplicação

**New Service → App**, nome `app`:

| Campo | Valor |
|---|---|
| Source | GitHub |
| Owner / Repository | `rodrigotjf1-boop` / `vilazuni` |
| Branch | `main` |
| Build Path | `/` (raiz do repositório) |
| Build | Dockerfile |
| Dockerfile | `deploy/Dockerfile` |
| Réplicas | `1` |

Não configurar Build Path como `/app`: o Dockerfile copia arquivos a partir da raiz. O repositório público dispensa token para clonagem. Manter o comando de inicialização da imagem e desativar implantação sem interrupção/zero downtime; duas instâncias simultâneas não são suportadas.

Em **Domains**, adicionar o domínio `app.SEU_DOMINIO`, com HTTPS e destino **HTTP, porta 4173**. Definir como domínio principal. Usar essa mesma origem, sem barra final, no passo 4. A aplicação não precisa de uma porta publicada em **Ports**. O certificado depende do DNS e do acesso público às portas 80/443 do gateway.

Em **Mounts/Storage**, criar um **Volume** exclusivo, montado em `/var/lib/vilazuni`. PostgreSQL e anexos devem persistir após redeploy. O usuário da imagem é `node`, UID/GID `1000`; o volume precisa ser gravável por ele.

## 4. Gerar configurações privadas na VPS

No terminal da própria VPS, obter o checkout atualizado e gerar arquivos fora dele. O comando usa Node em Docker; não exige instalar Node no Ubuntu. Se o checkout já existir, atualizar a cópia limpa em vez de cloná-la por cima.

```sh
git clone https://github.com/rodrigotjf1-boop/vilazuni.git
cd vilazuni
mkdir -p "$HOME/vilazuni-private"
chmod 700 "$HOME/vilazuni-private"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD":/work:ro \
  -v "$HOME/vilazuni-private":/config \
  -w /work node:24.19.0-bookworm-slim \
  node deploy/easypanel/prepare.mjs \
  --origin https://app.SEU_DOMINIO \
  --database-host HOST_INTERNO_EXIBIDO_NO_EASYPANEL \
  --output /config/primeira-instalacao
```

Substituir os dois valores de exemplo antes de executar. Os arquivos estarão em `$HOME/vilazuni-private/primeira-instalacao` no host:

- `database.sql`: primeira migração e criação do usuário restrito `vilazuni_app`.
- `application.env`: variáveis da aplicação, com senha própria, chave MFA e código de instalação aleatórios.
- `backup.key`: chave do backup cifrado, independente da senha do banco e da chave MFA.

O gerador não imprime segredos, recusa gravar dentro do checkout e não sobrescreve um destino existente. Diretório e arquivos têm permissões 700/600. Guardar cópia protegida de todo o conjunto fora da VPS; não enviar arquivos ou conteúdos pela conversa, Git ou tickets. Não regenerar para atualizar ou reiniciar o sistema: perder a chave MFA impede decifrar os autenticadores já cadastrados.

## 5. Inicializar banco e implantar

1. Abrir `database.sql` **somente no terminal privado do operador**. No serviço `banco`, selecionar **Shell → psql**, conectado ao banco `vilazuni`, e executar seu conteúdo. Não usar um editor SQL genérico: a primeira linha é um comando do psql. O script confirma o banco, executa em transação e recusa tabelas ou papel preexistentes. Se falhar, sair da sessão ou executar `ROLLBACK;` antes de investigar. Não contornar a recusa apagando dados.
2. Copiar o conteúdo de `application.env` para **Environment** do serviço `app`. Não copiar a URL administrativa do Postgres: o runtime recusa SUPERUSER/BYPASSRLS. Conferir `APP_ORIGIN`, host interno e volume; salvar.
3. Executar **Deploy** da aplicação. Salvar configurações sem Deploy não aplica as alterações ao processo. Conferir logs de build e inicialização sem publicar valores de conexão.
4. No **Shell** da aplicação, executar `id` e `test -w /var/lib/vilazuni`. O usuário deve ser UID 1000 e o teste deve terminar com sucesso. Se o volume estiver sem permissão, corrigir **somente esse volume dedicado**, pelo terminal administrativo, para UID/GID 1000; manter a aplicação sem privilégios de root.
5. Copiar `backup.key` para o volume, conforme o próximo passo, e conferir leitura antes de ensaiar o backup.

### Instalar a chave de backup no volume

No terminal da VPS, após o primeiro Deploy, localizar **uma única instância** do serviço `vilazuni_app` e copiar a chave sem imprimi-la ou colocá-la na linha de comando. Este trecho pressupõe exatamente os nomes de projeto/serviço indicados no guia; se diferentes, ajustar o filtro para o serviço correto.

```sh
(
  set -eu
  instances=$(docker ps -q --filter label=com.docker.swarm.service.name=vilazuni_app)
  count=$(printf '%s\n' "$instances" | awk 'NF {n++} END {print n+0}')
  [ "$count" -eq 1 ] || { echo 'Esperada uma instância da aplicação; conferir o serviço no painel.'; exit 1; }
  docker exec -i --user 1000:1000 "$instances" sh -c \
    'set -e; umask 077; set -C; cat > /var/lib/vilazuni/backup.key' \
    < "$HOME/vilazuni-private/primeira-instalacao/backup.key"
  docker exec --user 1000:1000 "$instances" test -r /var/lib/vilazuni/backup.key
)
```

O comando não sobrescreve uma chave existente. Se o teste de escrita falhar por permissão, identificar o volume em **Storage** e corrigir somente seu proprietário; não alterar permissões de outros projetos nem usar `chmod 777`.

### Endereço do cliente e gateway

O ambiente gerado configura `TRUST_PROXY=true` e `CLIENT_IP_HEADER=x-forwarded-for` para o Traefik do Easypanel, com conexão privada até a aplicação. Manter a limpeza padrão dos cabeçalhos encaminhados: não ativar `forwardedHeaders.insecure` nem confiar em remetentes públicos arbitrários. Não acrescentar CDN/proxy intermediário sem ajustar e validar a cadeia.

O servidor aceita apenas um IP válido do cabeçalho vindo de um par privado; conexão pública, confiança desativada ou cadeia de múltiplos IPs usa o endereço da conexão. Isso preserva o limite de tentativas por cliente sem aceitar o cabeçalho de uma conexão pública direta. Na composição com Caddy, o padrão continua `x-vilazuni-client-ip`.

## 6. Conferir e criar a primeira conta

Com DNS e certificado válidos, abrir `https://app.SEU_DOMINIO`. Pelo terminal, estes pedidos não levam credenciais:

```sh
curl --fail --show-error https://app.SEU_DOMINIO/healthz
curl --fail --show-error https://app.SEU_DOMINIO/readyz
curl --silent --output /dev/null --write-out '%{http_code}\n' https://app.SEU_DOMINIO/api/state
```

Os dois primeiros devem responder 200; o terceiro, **401** sem sessão. Conferir redirecionamento HTTP para HTTPS, ausência de acesso público ao banco e à porta 4173 e volume persistente após redeploy. Não desativar a verificação de certificado para considerar o HTTPS aprovado.

O responsável cria sua própria conta com o código privado `BOOTSTRAP_TOKEN`, habilita TOTP e guarda os códigos de recuperação. Não criar uma senha em nome do usuário. Cadastrar condomínio, documentos, unidades e regras reais somente após a conferência; a base nova não contém dados fictícios.

Cobrança permanece manual. IA, Telegram, portão real e envio de e-mail não são ativados por este guia. Uma caixa de suporte já criada pode receber contato, mas recuperação automática exige o adaptador Resend com `MAIL_API_KEY` e `MAIL_FROM`, remetente verificado e teste de entrega. Configurar credenciais somente no servidor; não trocar MX do e-mail para implantar o aplicativo.

### Trocar os segredos antes da primeira conta

Se uma captura ou compartilhamento revelar os valores iniciais, substituir a senha do usuário runtime, a chave MFA e o código de instalação antes de criar a primeira conta. Para a aplicação já implantada uma vez, com imagem disponível na VPS, existe um procedimento específico:

```sh
cd "$HOME/vilazuni"
git pull --ff-only
bash deploy/easypanel/rotate-initial-secrets.sh
```

Usar o caminho do checkout efetivamente clonado; por exemplo, `vilazuni-config` se esse foi o nome escolhido. O procedimento pressupõe os nomes de projeto/serviços deste guia (`vilazuni`, `app`, `banco`) e configurações em `$HOME/vilazuni-private/primeira-instalacao`. Para outro diretório privado, passá-lo como primeiro argumento do script, com caminho absoluto.

O script para temporariamente a aplicação, usa sua imagem existente na rede do contêiner PostgreSQL e troca a senha pelo próprio papel runtime, sem pedir a senha administrativa. O contêiner de manutenção executa como root somente para ler/gravar os arquivos privados do operador; o usuário da aplicação continua `node`. A troca bloqueia a tabela de controle em transação e **recusa qualquer base que já tenha contas**. Não é um procedimento para trocar a chave MFA de usuários existentes.

O novo `application.env` e o SQL inicial ficam no mesmo diretório, com modo 600. A chave de backup é preservada. As versões anteriores são arquivadas em subpasta privada `rotation-*`; não há impressão dos segredos. Se ocorrer falha depois da possível confirmação no banco, `.rotation-pending` preserva os valores preparados: manter a aplicação parada e conferir a recuperação, sem gerar outras chaves ou apagar essa pasta.

Depois do sucesso, copiar **o novo** `application.env` para **app → Environment/Ambiente**, conferir **Réplicas = 1** e executar **Deploy/Implantar**. A aplicação permanece parada até essa implantação; tentar reiniciar com o ambiente antigo falha na conexão. Conferir novamente `/healthz`, `/readyz` e o primeiro acesso. Não compartilhar capturas do terminal ou editor que contenham os valores.

## 7. Backup, atualizações e distribuição

No Shell da aplicação, criar o backup cifrado no volume (nome novo a cada execução):

```sh
npm run backup -- create /var/lib/vilazuni/backup-inicial.json
```

Copiar o arquivo cifrado para armazenamento externo privado e ensaiar a restauração em banco/volume separados e vazios, com a aplicação de destino parada. O backup não inclui sua própria chave nem a chave MFA. Backup automático da VPS não substitui a verificação de recuperação do sistema. Definir frequência, retenção e responsável antes de liberar moradores; ver [operação e recuperação](../README.md#backups-e-recuperação).

Antes de atualizações, obter backup recuperável e guardar as configurações existentes. Fazer Deploy da revisão validada, preservando volume, banco e chaves. Não repetir `database.sql`, não executar o gerador novamente para trocar as chaves e não excluir serviços/volumes com dados.

Depois de confirmar o domínio final funcionando, usar essa origem nos pacotes Android/iOS e publicar apenas os artefatos adequadamente assinados. A PWA pode ser instalada pelo navegador em HTTPS; os pacotes de avaliação existentes não são uma publicação nas lojas. Ver [preparo móvel](../../mobile/README.md).

Referências: [App](https://easypanel.io/docs/services/app), [Postgres](https://easypanel.io/docs/services/postgres) e [cabeçalhos de proxy no Traefik](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/#forwardedheaders).
