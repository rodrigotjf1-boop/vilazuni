# Vilazuni — estado do projeto

Atualização: **20/10/2026, horário de Brasília**. Município do piloto: **Arraial do Cabo/RJ**.

A implementação das etapas restantes está reunida na entrega 0.2.0. A liberação para moradores, contratação de infraestrutura, domínio, assinatura de aplicativos e homologação de equipamentos constituem a próxima fase operacional solicitada pelo usuário. Não há endereço público de produção, conta de serviço contratada ou equipamento real acionado nesta entrega.

| Etapa | Entrega técnica |
|---|---|
| 0–3 | Fundação, identidade, casas/vínculos/estadias e operação do piloto, com os limites já registrados no plano |
| 4 | Financeiro gerencial e cobrança manual concluídos no escopo escolhido pelo usuário; banco/Pix/boleto continuam adiados |
| 5 | Passeio 3D ilustrativo concluído; fotografias e medidas reais são uma expansão separada |
| 6 | Fontes versionadas; consulta local e adaptador generativo com citações; propostas de tarefa confirmadas; alertas/triagem; Telegram opcional com fila e resumo diário; assembleias por unidade, quóruns configurados, ata e transferência de gestão |
| 7 | PWA Android/iPhone; avisos web push; projeto Android TWA e projeto iOS; simuladores e protocolo de adaptador para portão, placa e imagem instantânea de câmera |
| 8 | Vários condomínios/vínculos; configuração sem código por cliente; planos/limites; importação de unidades/exportação; encerramento com retenção; suporte sem conteúdo privado; PostgreSQL com RLS, anexos privados, backup cifrado, MFA e preparo de implantação |

Entrega técnica não equivale à validação jurídica, publicação em lojas ou homologação presencial. O escopo controlado dos aplicativos e adaptadores está descrito em [etapas 7–8](fundacao/ETAPAS_7_8_DISTRIBUICAO.md). Recursos amplos da especificação inicial que ficaram fora dos ciclos aceitos — integração bancária, imagens 360° reais, automações de parceiros, reconhecimento facial, inventário patrimonial completo e obras/medidores — continuam expansões; não são apresentados como implementados.

## Validação reproduzível

- `npm ci --prefix app --ignore-scripts` instala versões e integridades do lockfile.
- `npm test --prefix app`: 214 testes, incluindo PostgreSQL quando `VILAZUNI_PG_TEST_CONFIG` aponta para a base local descartável. Sem essa configuração, três testes PostgreSQL são explicitamente pulados.
- `npm run test:browser --prefix app`: fluxo sintético em Chromium desktop/móvel. Requer navegador Playwright instalado ou `CHROMIUM_PATH`.
- `npm audit --prefix app --omit=dev`: auditoria das dependências de execução.
- Workflows de validação e pacotes móveis estão em `.github/workflows/`. Android e iOS compilaram no GitHub Actions após liberar a execução pública; os pacotes de avaliação não são assinaturas de distribuição nem lançamento nas lojas.

A imagem também foi executada localmente como usuário não privilegiado, com sistema de arquivos somente leitura, PostgreSQL de teste, bootstrap protegido, cookie Secure, MFA obrigatório e base vazia de produção.

Os testes criam suas próprias contas e bases temporárias. Nenhuma conta ou senha de morador foi criada. Não inserir dados reais no piloto local. A nova base de produção começa sem casas, pessoas, estadias ou tarefas fictícias.

## Próxima fase, após esta entrega

Escolher hospedagem e domínio; configurar contas e segredos diretamente no servidor; preencher os documentos, unidades e regras reais; validar o canal e os equipamentos escolhidos; distribuir os pacotes apropriados. [Guia de implantação](deploy/README.md) e [preparo móvel](mobile/README.md) concentram os passos e insumos necessários. Credenciais nunca devem ser enviadas pela conversa ou incluídas no Git.
