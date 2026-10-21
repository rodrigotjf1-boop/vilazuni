#!/usr/bin/env bash
set -euo pipefail
umask 077

# Executado somente pelo operador, na VPS. A aplicação permanece parada até
# receber o novo ambiente pelo painel e passar por uma nova implantação.
vlz_repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
vlz_private=$(cd -- "${1:-$HOME/vilazuni-private/primeira-instalacao}" && pwd)
test -f "$vlz_private/application.env"
vlz_database=$(docker ps -q --filter label=com.docker.swarm.service.name=vilazuni_banco)
if [ "$(printf '%s\n' "$vlz_database" | awk 'NF {n++} END {print n+0}')" -ne 1 ]; then
  echo 'Esperada uma instância do banco do projeto vilazuni.' >&2
  exit 1
fi
vlz_replicas=$(docker service inspect vilazuni_app --format '{{.Spec.Mode.Replicated.Replicas}}')
if [ "$vlz_replicas" != 0 ] && [ "$vlz_replicas" != 1 ]; then
  echo 'Procedimento exclusivo da aplicação inicial com uma réplica.' >&2
  exit 1
fi
vlz_image=$(docker service inspect vilazuni_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
docker image inspect "$vlz_image" >/dev/null
docker service scale --detach=true vilazuni_app=0 >/dev/null
for vlz_attempt in {1..30}; do
  vlz_running=$(docker ps -q --filter label=com.docker.swarm.service.name=vilazuni_app)
  [ -z "$vlz_running" ] && break
  sleep 1
done
if [ -n "$vlz_running" ]; then
  echo 'Aguarde o encerramento da aplicação antes de tentar novamente.' >&2
  exit 1
fi
echo 'Aplicação parada para renovar as credenciais iniciais.'
docker run --rm --user 0:0 --network "container:$vlz_database" \
  -v "$vlz_private":/config \
  -v "$vlz_repo/app/scripts/rotate-initial-secrets.mjs":/opt/vilazuni/scripts/rotate-initial-secrets.mjs:ro \
  "$vlz_image" node scripts/rotate-initial-secrets.mjs \
  --directory /config --database-host 127.0.0.1 --database-port 5432
echo 'No Easypanel: copie o novo application.env para app > Ambiente, confira Réplicas = 1 e clique em Implantar.'
