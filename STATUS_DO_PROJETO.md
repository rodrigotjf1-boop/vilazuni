# Vilazuni — estado do projeto

Atualização: **21/10/2026, horário de Brasília**. Município do piloto: **Arraial do Cabo/RJ**.

A implementação das etapas restantes está reunida na entrega 0.2.0. Na fase operacional, o usuário adquiriu VPS Hostinger com Easypanel em Campinas/SP, domínio próprio e criou o e-mail de suporte. A primeira implantação web foi realizada pelo usuário: aplicação em HTTPS, `/healthz` e `/readyz` com resposta 200 e `/api/state` com 401 sem login. O usuário confirmou a criação da conta de gestão, e a captura mostrou segundo fator ativo. Volume e recuperação ainda exigem conferência operacional; assinatura de aplicativos e homologação de equipamentos permanecem posteriores. Nenhum equipamento real foi acionado nesta entrega.

| Etapa | Entrega técnica |
|---|---|
| 0–3 | Fundação, identidade, casas/vínculos/estadias e operação do piloto, com os limites já registrados no plano |
| 4 | Financeiro gerencial e cobrança manual concluídos no escopo escolhido pelo usuário; banco/Pix/boleto continuam adiados |
| 5 | Passeio 3D ilustrativo concluído; fotografias e medidas reais são uma expansão separada |
| 6 | Fontes versionadas; consulta local e adaptador generativo com citações; propostas de tarefa confirmadas; alertas/triagem; Telegram opcional com fila e resumo diário; assembleias por unidade, quóruns configurados, ata e transferência de gestão |
| 7 | PWA Android/iPhone; avisos web push; projeto Android TWA e projeto iOS; simuladores e protocolo de adaptador para portão, placa e imagem instantânea de câmera |
| 8 | Vários condomínios/vínculos; configuração sem código por cliente; planos/limites; importação de unidades/exportação; encerramento com retenção; suporte sem conteúdo privado; PostgreSQL com RLS, anexos privados, backup cifrado, MFA e preparo de implantação |

Entrega técnica não equivale à validação jurídica, publicação em lojas ou homologação presencial. O escopo controlado dos aplicativos e adaptadores está descrito em [etapas 7–8](fundacao/ETAPAS_7_8_DISTRIBUICAO.md). Recursos amplos da especificação inicial que ficaram fora dos ciclos aceitos — integração bancária, imagens 360° reais, automações de parceiros, reconhecimento facial, inventário patrimonial completo e obras/medidores — continuam expansões; não são apresentados como implementados.

## Comunidade e navegação

A nova entrega adiciona personagens do síndico e zelador com fichas/contatos e foto privada, calendário de tarefas, mural por condomínio e alerta individual por versão não vista. O nome do condomínio ganha destaque e o menu tem busca, grupos, seleção e gaveta móvel. Fluxos e limites estão em [comunidade e próximas integrações](fundacao/COMUNIDADE_E_PROXIMAS_INTEGRACOES.md). Prévias sintéticas: [cenário e menu](previa-menu-comunidade.png), [mural no celular](previa-mural-mobile.png).

O usuário também solicitou, para o próximo ciclo, perfis ampliados e expiração por estadia/contrato, avisos no WhatsApp e integração Asaas. Esses pedidos estão registrados; o financeiro em execução continua manual e o canal de grupo existente continua Telegram até implementar/homologar os novos adaptadores.

## Validação reproduzível

- `npm ci --prefix app --ignore-scripts` instala versões e integridades do lockfile.
- `npm test --prefix app`: 230 testes, incluindo PostgreSQL quando `VILAZUNI_PG_TEST_CONFIG` aponta para a base local descartável. Sem essa configuração, cinco testes PostgreSQL são explicitamente pulados.
- `npm run test:browser --prefix app`: fluxo sintético em Chromium desktop/móvel. Requer navegador Playwright instalado ou `CHROMIUM_PATH`.
- `npm audit --prefix app --omit=dev`: auditoria das dependências de execução.
- Workflows de validação e pacotes móveis estão em `.github/workflows/`. Android e iOS compilaram no GitHub Actions após liberar a execução pública; os pacotes de avaliação não são assinaturas de distribuição nem lançamento nas lojas.

A imagem também foi executada localmente como usuário não privilegiado, com sistema de arquivos somente leitura, PostgreSQL de teste, bootstrap protegido, cookie Secure, MFA obrigatório e base vazia de produção.

O preparo Easypanel foi conferido com 220 testes aprovados em PostgreSQL 17 descartável; o fluxo sintético de interface foi validado em Chromium desktop/móvel. As verificações cobrem permissões dos arquivos privados, recusa de sobrescrita, SQL transacional, papel runtime restrito, preservação da base ao recusar repetição e cabeçalho de IP aceito somente na configuração de proxy prevista. A troca de segredos antes da primeira conta invalida a senha anterior, preserva a chave de backup e recusa alterar MFA quando já existem usuários; sua CLI também foi executada em imagem real da aplicação na rede de um contêiner PostgreSQL descartável. A operação da VPS continua exigindo as conferências do guia.

Os testes criam suas próprias contas e bases temporárias. Nenhuma conta ou senha de morador foi criada. Não inserir dados reais no piloto local. A nova base de produção começa sem casas, pessoas, estadias ou tarefas fictícias.

A entrega de comunidade e navegação foi conferida com **230 testes aprovados em PostgreSQL 17 descartável**, sem testes pulados, e com Chromium em computador/celular. A conferência inclui clique na malha dos dois personagens, foto privada, links de contato, calendário, leitura por versão, busca e gaveta do menu. A auditoria de dependências de execução não encontrou vulnerabilidades.

## Próxima fase, após esta entrega

Concluir a conferência dos [serviços nativos do Easypanel](deploy/easypanel/README.md), sem executar a composição com Caddy no mesmo servidor. O gerador cria SQL transacional de primeira instalação e segredos fora do checkout, com usuário PostgreSQL restrito, MFA e chave de backup independentes; recusa substituir configurações ou reprovisionar uma base existente. A compatibilidade com o proxy do painel é explícita e mantém a confiança restrita a conexões privadas.

Configurar contas e segredos diretamente no servidor; preencher os documentos, unidades e regras reais; validar o canal e os equipamentos escolhidos; distribuir os pacotes apropriados. E-mail de suporte criado não ativa o envio automático: configurar o provedor e verificar entrega quando escolhido. [Guia de implantação](deploy/README.md) e [preparo móvel](mobile/README.md) concentram os passos e insumos necessários. Credenciais nunca devem ser enviadas pela conversa ou incluídas no Git.
