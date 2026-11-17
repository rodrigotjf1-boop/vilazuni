# Modelo de ameaças (inicial)

Referência: OWASP ASVS nível 2 nos requisitos aplicáveis, sem declarar certificação. Revisar a cada fase.

| # | Ameaça | Onde | Defesa | Teste |
|---|---|---|---|---|
| A01 | Pessoa de uma casa lê ou altera dados de outra casa trocando o id | API, busca, exportação, download | Autorização no serviço por vínculo + chave composta + RLS | T02, T04 |
| A02 | Condomínio A enxerga dados do B | API, banco, RAG | `condominium_id` vem do vínculo, nunca do cliente; RLS por transação | T03, T41, T54 |
| A03 | Autocadastro se dá papel de síndico | Cadastro | Papel enviado é ignorado; titularidade nasce pendente | T01 |
| A04 | Tomada de conta / número de telefone reciclado | Login, recuperação | Recuperação não concede vínculo; MFA para gestão; limite por conta e por endereço | T06 |
| A05 | Reuso de convite, OTP ou refresh | Convites, sessões | Hash + uso único + validade + tentativas; refresh rotativo com detecção de reuso | T06, T56 |
| A06 | Ex-síndico ou ex-hóspede continua com acesso | Sessões abertas | Vínculo e mandato relidos a cada pedido; janela conferida pelo relógio do servidor | T09–T11, T19 |
| A07 | Vazamento de segredo da casa | Push, e-mail, IA, logs, cache | Cofre AEAD com chave fora do banco; revelação só por rota autenticada; `no-store`; nunca no contexto da IA | T14, T41, T52 |
| A08 | Webhook falso ou repetido quita cobrança | Webhooks | Autenticação do provedor, conta esperada, chave única do evento, consulta ao provedor | T23, T24 |
| A09 | Prompt injection em foto/documento/mensagem | Zelador Virtual | Conteúdo externo é dado, não instrução; ferramentas com permissão do solicitante; aprovação humana | T40–T43 |
| A10 | Replay de comando ao portão | Portão (futuro) | Desligado por flag; TTL curto, anti-replay, controlador local | T38, T55 |
| A11 | Câmera ou NVR exposto na internet | Rede física | Rede segregada, gateway local de saída, sem portas abertas | Fase 4 |
| A12 | Upload malicioso / SSRF | Arquivos, busca de URL | Assinatura de arquivo, reprocessamento de imagem, lista de destinos permitidos | T44 |
| A13 | Vazamento por contagem, nome de arquivo ou mensagem de erro | API, relatórios | Respostas iguais para "não existe" e "sem acesso"; relatórios filtrados antes de contar | T54 |
| A14 | Segredo no APK, bundle web, log ou repositório | Build | Varredura do bundle e do APK no CI; redação de logs | T52 |
| A15 | CSRF em sessão de navegador | API | Token CSRF + `Origin` permitido; cabeçalho "nativo" não desliga CSRF | T56 |
