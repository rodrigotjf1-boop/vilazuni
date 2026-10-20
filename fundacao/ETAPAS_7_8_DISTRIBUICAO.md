# Etapas 7 e 8 — aplicativos, operação física e distribuição

Atualização: 20/10/2026, Brasília. Escopo técnico de avaliação controlada da versão 0.2.0. A homologação presencial e a distribuição pública dependem dos ambientes e credenciais que serão escolhidos após o desenvolvimento.

## Celular e notificações

PWA com manifesto, ícones, instalação Android/iPhone e service worker. O cache contém somente recursos públicos da interface; nunca `/api`, PDFs, fotos privadas, sessão ou respostas de conta. Sem rede, o aplicativo informa indisponibilidade; não permite gravar operações offline. O passeio ilustrativo continua com alternativa por mapa/lista.

Celular permite instalação e adesão voluntária a avisos. Web push usa VAPID no servidor, permissão do navegador e inscrição por usuário/condomínio; não reutiliza inscrição de outra conta/contexto. No iOS exige aplicação adicionada à tela inicial e versão compatível. A mensagem é genérica, sem nome, débito ou relato privado; abrir exige login e direitos atuais. Inscrição expirada é removida; entrega incerta não é repetida automaticamente. Suspensão, expiração e encerramento do cliente impedem novas entregas. Permissão negada não bloqueia uso do sistema.

Projetos nativos e workflows estão em [mobile](../mobile/README.md). Android usa TWA vinculada ao mesmo serviço HTTPS, com alternativa de aba do navegador enquanto o domínio não estiver verificado. iOS abre a aplicação web por SafariServices. Não há reconhecimento facial nem armazenamento de senha em código nativo. Push web deve ser homologado no PWA/navegador; não é prometido como push nativo no contêiner iOS.

## Portaria física e câmeras

Módulo `physicalAccess`; portaria possui operação limitada. Cadastro de dispositivos distingue portão/câmera, simulador e adaptador HTTPS. O identificador seleciona configuração fixa do servidor: o navegador não fornece URL de comando nem credencial. Imagem instantânea de câmera é consultada pelo servidor, com autenticação, limite de 2 MiB e auditoria. Não há vídeo contínuo, gravador NVR ou transcodificação RTSP.

Abertura exige autorização aprovada/vigente, conferência humana, motivo e identificador idempotente. Comando expira em quinze segundos, é gravado antes da chamada e não admite segundo despacho. Simulador não usa rede nem equipamento. Adaptador recebe HMAC, ID e prazo e precisa implementar rejeição de duplicatas/expiração. Confirmação do adaptador não prova movimento do portão ou passagem.

Timeout deixa comando incerto, sem repetição automática. Interrupção em despacho exige conferência presencial. Operador registra chegada/saída observada separadamente; o período previsto não comprova presença. Não existe bloqueio de portão por inadimplência.

Eventos de placa exigem equipamento cadastrado, HMAC sobre o corpo exato, janela de sessenta segundos e nonce único. Leituras ficam por trinta dias para conferência e não abrem portão. Reconhecimento/OCR ocorre no equipamento/adaptador; este aplicativo recebe o evento autenticado. Simulação não substitui teste do fabricante.

Para homologar: fabricante/modelo, protocolo oficial, ambiente de teste, responsáveis, permissões de captura, retenção e procedimento presencial em queda de internet/energia. Câmera, leitor e portão reais não foram conectados neste ciclo.

## Vários condomínios e clientes

Condomínio permite configurar identidade/localidade/regime, cadastrar unidades com UUID estável, alterar características por versão/histórico, implantar outro cliente e trocar contexto. O novo cliente começa sem dados copiados. Conta existente aceita novo convite somente com sua senha e MFA quando ativo; identidade não é duplicada e nenhum convite redefine senha.

Somente contextos vigentes aparecem. Trocar contexto rota a sessão e descarta respostas de telas antigas. Cada domínio filtra condomínio/módulo/unidade; PostgreSQL também aplica RLS sobre as partições. Proprietário da plataforma só implanta clientes nos próprios vínculos e não ganha consulta universal a condomínios.

Plano define módulos e limites operacionais. É configuração do produto, não assinatura ou cobrança comercial automática. A gestão importa JSON de unidades com prévia/fingerprint e confirmação, sem importar privilégios, senhas ou saldos. Exportação por cliente contém seus dados, sem credenciais, inscrições push, caixas individuais ou votos individuais de enquetes; é um arquivo privado. Importação completa de base/histórico e restauração ocorrem pelas ferramentas do servidor, em destino vazio.

Encerrar cliente exige nome exato, versão, motivo/política de retenção e confirmação de exportação guardada. Acessos, canais e inscrições são interrompidos; históricos não são apagados. Reativação é uma operação de suporte autorizada, com manutenção e auditoria, não um novo cadastro sobre a base antiga.

## Continuidade, suporte e privacidade

PostgreSQL com migração reproduzível, transações, revisão otimista e papel de execução sem SUPERUSER/BYPASSRLS. Escrita obsoleta retorna conflito. A versão atual usa partições JSONB por condomínio e identidade central; não se anuncia esquema relacional completo por módulo ou escala horizontal pronta. Sessões ficam em memória: operar uma instância da aplicação; reinício exige novo login. Banco não é exposto na composição de implantação.

Anexos usam volume privado, caminhos derivados de condomínio/hash e leitura autenticada; o banco guarda referência e integridade, sem URLs públicas. Volume persistente precisa acompanhar o banco. Essa implementação usa arquivos privados no servidor; armazenamento S3 é uma expansão opcional, não uma integração já homologada.

Backup lógico contém base e bytes dos anexos, cifrados com scrypt/AES-256-GCM, compressão e verificação de integridade. Restauração recusa destino com contas e não substitui arquivos originais. Limite lógico de 192 MiB; além disso usar backup físico coordenado PostgreSQL + volume, cifrado, testado e com acesso limitado. Guardar a chave MFA e a chave do backup separadamente. Só guardar banco sem volume/chaves é insuficiente.

Gestores precisam de TOTP em produção; segredo cifrado por chave externa, prevenção de reutilização e códigos de recuperação de uso único. Recuperação de senha é opcional por provedor de e-mail, tem token expirável/uso único, resposta sem enumerar contas e não desativa MFA. Convites continuam entregues pela gestão; não há envio implícito a moradores.

Privacidade permite pedido de acesso/correção/análise de eliminação e resposta registrada da gestão. Não apaga automaticamente evidência ou obrigação de retenção. Responsáveis e prazos reais de resposta/retenção devem ser definidos na implantação. Diagnóstico de suporte mostra contagens, sem nomes, PDFs, conteúdo de mensagens ou credenciais. Não há acesso universal de suporte ao conteúdo dos clientes.

Monitoramento dispõe de `/healthz` e `/readyz`; indisponibilidade não expõe erro de conexão/segredo. Produção exige HTTPS público, origem exata, cookies Secure, PostgreSQL, chave MFA, código inicial de instalação e diretório persistente. Base inicial de produção não contém os dados fictícios do piloto.

## Insumos restantes para disponibilizar o uso

1. Hospedagem/região, domínio/DNS, orçamento, política de backup e responsáveis de operação.
2. Dados reais das unidades, regime/documentos e parâmetros de assembleia conferidos.
3. Conta do modelo e limite de gasto, se a síntese for habilitada; canal/grupo/bot e remetente de e-mail escolhidos.
4. Chaves VAPID; assinatura Android e associação do domínio; conta Apple/assinatura se houver distribuição iOS.
5. Homologação em Android/iPhone físicos e equipamentos reais com contingência presencial.

Esses itens não exigem alteração do produto por condomínio, mas exigem configuração e validação externa. A conclusão do código não os transforma em já contratados, publicados ou homologados.
