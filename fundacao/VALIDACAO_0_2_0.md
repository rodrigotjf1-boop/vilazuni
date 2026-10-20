# Evidências de validação — Vilazuni 0.2.0

20/10/2026, Brasília. Dados e contas exclusivamente sintéticos, em diretórios temporários e PostgreSQL descartável. Nenhuma credencial real de usuário, conta externa ou equipamento foi utilizado.

| Verificação | Resultado |
|---|---|
| Suíte Node.js + PostgreSQL 17 real | 214 aprovados, sem falhas ou skips com configuração PostgreSQL de teste |
| RLS | Sem contexto não retorna partições; contexto de um condomínio não retorna outro; papel sem SUPERUSER/BYPASSRLS |
| Concorrência | Gravação obsoleta retorna conflito; tarefa/reserva/financeiro mantêm as verificações anteriores |
| Identidade | Conta com dois vínculos, troca de contexto e convite com senha existente; suspensão/senha revogam sessões de outra instância |
| MFA/recuperação | Vetor TOTP conhecido, prevenção de repetição, recuperação de uso único, reset sem remover MFA e sem enumerar conta |
| Assembleia | Pesos explícitos, instalação/aprovação distintas, empate, representação, voto único por unidade, ata íntegra e transferência de mandato |
| Assistência | Evidência por público, referências inválidas, insuficiência, cota, confirmação de tarefa e fonte retirada durante chamada não bloqueante |
| Canais/alertas | Fonte externa separada, webhook/menção/grupo, deduplicação e retirada de fonte; triagem sem relato privado original |
| Equipamentos | Simulador sem rede, comando único/vigente, timeout incerto, passagem observada distinta; placa com HMAC/nonce/prazo e câmera sintética |
| Arquivos/backup | Anexo fora do JSON, integridade, bytes no backup cifrado, chave/corrupção rejeitadas e restauração em destino vazio |
| Chromium | Desktop e 390×844: tarefa confirmada, alertas, assembleia com duas matérias/votos/ata, portaria simulada, edição com histórico de unidade, segundo condomínio, privacidade e PWA |
| Cache | Apenas interface pública; sem `/api`, sessão, PDFs ou evidências privadas |
| Imagem de implantação | Executada como não-root, raiz somente leitura e volume privado; PostgreSQL runtime, prontidão, código inicial, cookie Secure, MFA obrigatório, origem exata e produção sem dados fictícios |
| Dependências Node de execução | Auditoria sem vulnerabilidades na data da execução |
| Android | APK de depuração compilado no GitHub Actions, Gradle 8.11.1/AGP 8.10.1/SDK 36, origem de teste sem hospedagem |
| iOS | Aplicativo de simulador compilado no macOS/Xcode, sem assinatura de distribuição |

Execuções de pacotes com ícones e de aplicação aprovadas no commit `a08bae3ac359f00af4b6b561d35c4adc4b38dd8b`:

- [Validação no GitHub](https://github.com/rodrigotjf1-boop/vilazuni/actions/runs/39387028444).
- [Android e iOS no GitHub](https://github.com/rodrigotjf1-boop/vilazuni/actions/runs/39387028465).

A conferência posterior de histórico estrutural de unidade também passou nos testes de API e na jornada Chromium. A PR mantém a validação da revisão final. Os diretórios nativos permanecem iguais aos usados na execução de pacotes acima.

A primeira tentativa do Actions foi impedida por cobrança/limite de conta, antes de iniciar os jobs. Após o usuário tornar o repositório público, a execução foi liberada e os problemas de configuração de SDK/healthcheck foram corrigidos. Não há falha de aplicação omitida como aprovação.

O ambiente local não alcança o registry npm de dentro do Docker; a compilação local utilizou o cache público npm, com integridades do lockfile, e rede desligada. No GitHub, o Dockerfile original compilou com `npm ci`, sem esse ajuste de teste. Nenhuma verificação TLS foi desativada.

## Limites de aceitação

Compilação, testes de navegador e simuladores não certificam documentos/regras reais, precisão de modelo externo, entrega de mensagens reais, presença física, funcionamento de equipamento, assinatura de loja ou disponibilidade pública. Antes do lançamento: domínio/hospedagem, configuração segura dos provedores escolhidos, teste em aparelhos/equipamentos reais, contingência e restauração operacional ensaiada. Banco/Pix/boleto permanecem adiados pela decisão de cobrança manual.
