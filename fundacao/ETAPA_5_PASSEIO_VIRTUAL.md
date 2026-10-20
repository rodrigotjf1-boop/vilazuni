# Etapa 5 — passeio virtual contextual do piloto

Atualização: 19/10/2026, horário de Brasília. Etapa concluída para o **piloto 3D ilustrativo do Chandra**, usando a distribuição já aprovada. Não houve reconstrução fotográfica, medição em campo ou captura de novos panoramas. A implementação continua local, com login e autorização no servidor; hospedagem de produção segue na preparação de infraestrutura.

## Critérios de aceite

| Critério | Entrega e evidência |
|---|---|
| Integração às fichas | Casas abrem moradores/vínculos, estadias, cadastro já associado à unidade, vagas e autorizações conforme perfil. Dependência vinculada abre sua própria regra/agenda/reserva |
| Mesmas permissões | Catálogo e ficha são filtrados no servidor; cada atalho revalida acesso. Exterior ilustrativo não concede ficha privada, nomes, contatos ou estadias. Portaria recebe somente campos operacionais e ocupante não recebe fichas pessoais |
| Dependências e interdição | Gestão de dependências vincula explicitamente o registro ao marcador, com versão/histórico. Não há associação pelo nome. Situação atual é refletida na ficha/marcador; reserva continua bloqueada no servidor durante interdição |
| Alternativa sem 3D | Busca, filtros por tipo/acesso, mapa e lista com fichas. Preferência pelo mapa é preservada no navegador sem guardar dados privados; nesse modo o WebGL nem é alocado |
| Teclado e toque | Lista e ações por teclado; retorno de foco e Escape; zoom, pinça, controles de caminhada por toque, setas/WASD, pisos ilustrativos e movimento reduzido |
| Seleção e percurso | Raio intersecta a geometria visível, considerando objetos opacos; não seleciona por proximidade de marcador. Caminhada fica na alameda/escadas e para antes da piscina e das casas |
| Falha gráfica | Inicialização sem WebGL e perda de contexto preservam mapa, lista, fichas e operações autorizadas. Nova tentativa de 3D é explícita |
| Desempenho/custo | Sem dependências ou serviços externos. Renderização por demanda, pausada com painel aberto/aba oculta/modo mapa. Medições e plano de captura abaixo |

## Usar o passeio

**Explorar** ou o botão **Mapa** abre mapa/lista. Busque casa ou dependência; filtros consultam somente nomes e descrições dos locais, sem buscar pessoas/estadias privadas. Fichas do meu perfil oculta locais cujo acesso se limita ao exterior. **Atualizar locais** consulta o estado atual.

Selecionar local abre a ficha conforme seu perfil. **Localizar na vista 3D** posiciona a câmera. Em casa autorizada, **Entrar no interior ilustrativo** habilita térreo/superior e atalhos permitidos. Fechar ficha mantém a vista; **Voltar ao condomínio** sai do interior. Os ambientes são conceituais e não representam a planta interna real.

Em **Passear**, arraste para olhar e use controles de direção ou setas/WASD. Soltar/cancelar toque, perder foco ou ocultar a aba interrompe a caminhada. A alameda e as escadas são um percurso visual limitado; não representam rota física acessível, sistema de colisão universal ou orientação de emergência. Para navegação sem movimento, use mapa/lista.

Gestão com `facilities` abre um marcador de área comum e usa **Vincular ou retirar dependência**. Selecione o cadastro correto e informe motivo. Uma dependência ocupa no máximo um marcador; versão antiga, registro de outro condomínio e troca concorrente são recusados. Retirar vínculo conserva histórico. Dependências sem marcador permanecem na lista, sem inventar posição. Outros condomínios usam sua lista autorizada enquanto não possuem cenário definido.

Os 14 exteriores continuam localizáveis no piloto, sem revelar quem mora ou está presente. Casas 01–07 ficam à direita e 08–14 à esquerda de quem entra. Churrasqueira junto à 14, antes do salão de festas; festas à esquerda e jogos à direita no primeiro patamar; piscina acima do segundo lance. A geometria contém somente referências visuais; ficha e ações usam cadastro e autorização atuais.

## Medição do piloto e limites de custo

Conferência em Chromium com bases e contas temporárias, janela de 1440×1000 e emulação móvel com toque em 390×844. Alternativa 2D também conferida em 320×568. Não substitui homologação em aparelhos Android/iPhone físicos, que permanece necessária antes de distribuir a usuários reais.

| Medida | Resultado observado / limite do piloto |
|---|---|
| Scripts carregados pela aplicação | Aproximadamente 248 KiB; verificação com teto de 600 KiB |
| Geometria | 84.120 vértices no conjunto; 80.250 no exterior |
| Buffer de geometria | 2.018.880 bytes; verificação com teto de 12 MiB. Memória total de navegador/GPU é maior que o buffer |
| Cena ociosa | Zero novos quadros em 500 ms, após estabilização |
| Soltar controle de caminhada | Renderização contínua interrompida após liberação |
| Modo mapa salvo | Nenhum buffer/canvas WebGL alocado na próxima abertura |
| Requisições externas | Zero na conferência; sem texturas, mapas de terceiros ou SDK remoto |

O aumento do conjunto 3D não está autorizado automaticamente por esta medição. Para comparar versões, repetir carregamento, bytes transferidos, tempo até primeira interação, memória, responsividade por toque e consumo de quadros; medir em aparelho de entrada real antes de aumentar detalhes. Os números acima são do ambiente de teste, não uma promessa de FPS ou disponibilidade em toda rede/aparelho.

Não há tarifa de API visual/mapa nem licença de renderizador contratada nesta entrega. Computador, rede, hospedagem, suporte e produção continuam tendo custos próprios. Armazenamento/tráfego de fotos ainda não foi contratado ou estimado como preço fechado.

## Antes de ampliar para imagens reais ou panoramas

Para essa ampliação serão necessários do usuário: planta/rascunho autorizado com identificação dos pontos, confirmação do material que pode ser utilizado, responsável pelas autorizações de captura e orçamento disponível. Solicitar cotação datada quando houver fornecedor; nenhum preço de captura foi inventado ou contratado.

Começar por três pontos externos autorizados: entrada, alameda e patamar comum. Evitar interiores, pessoas, placas e documentos; revisar a mídia antes de disponibilizar. Registrar por ponto fonte/autoria, autorização, data da captura, data da revisão, público permitido e necessidade de atualização. Os marcadores atuais não afirmam uma data de fotografia: `captureDate` é nulo e a interface informa atualização do modelo ilustrativo.

Antes da captura integral, comparar o 3D atual com uma amostra de panoramas: legibilidade no celular, cobertura, tamanho/tempo de carregamento, versão leve e esforço de atualização. Cálculo de dimensionamento, sem tarifa presumida:

- Armazenamento: pontos × bytes por mídia × versões mantidas, incluindo derivados e backups.
- Tráfego: visitas mensais × pontos efetivamente carregados por visita × bytes por ponto; carregar somente o necessário.
- Implantação: captura + deslocamento + tratamento/remoção de dados identificáveis + montagem e revisão dos pontos.
- Continuidade: hospedagem/armazenamento/tráfego cotados + recaptura após alterações + suporte e revisão de permissões.

Captura real, upload/versionamento de panoramas, fornecedor de imagens e expansão geométrica não foram apresentados como concluídos. A etapa encerra o passeio funcional no cenário ilustrativo disponível, com um critério verificável para decidir essa expansão.

## Verificação e próxima etapa

165 testes aprovados, incluindo 14 novos testes de passeio, geometria e API: escopo por condomínio/perfil, campos mínimos, vínculos concorrentes e histórico/reinício, interdição, revogação/expiração, seleção/oclusão, limites do percurso e continuidade das escadas. Chromium: contexto de casa/dependência, cadastro na casa correta, interdição, teclado, foco, toque, pinça, memória de preferência, falta/perda de WebGL e perfis restritos. Respostas atrasadas de ficha/vínculo não reabrem o painel após fechar ou navegar para outra opção. Fluxos financeiros também conferidos após a alteração da navegação.

Prévias sintéticas: [mapa](../previa-passeio-mapa.png), [dependência](../previa-passeio-dependencia.png), [ficha no celular](../previa-passeio-ficha-mobile.png), [caminhada por toque](../previa-passeio-toque-mobile.png) e [sem WebGL](../previa-passeio-sem-webgl.png).

Próxima etapa: **6 — IA consultiva e governança**. Integrações de canais e regras de assembleia continuam dependendo das decisões e fontes previstas no plano. A integração bancária permanece adiada, mantendo a cobrança manual escolhida para a etapa 4.
