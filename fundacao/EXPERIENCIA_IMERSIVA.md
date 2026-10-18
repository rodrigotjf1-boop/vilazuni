# Vilazuni — experiência imersiva

Atualização de direção: 18/10/2026. O usuário solicitou interface com linguagem de jogo, minimalista e ilustrativa, objetos clicáveis, ícones modernos nos cantos e janelas contextuais conforme permissões. Rascunho do ambiente real está sendo preparado pelo usuário; a cena atual é provisória.

## Implementação da demonstração

Tela principal em `/#world`, com cena geométrica WebGL, quatro casas de características distintas, piscina, espaço de convivência, vias, paisagismo e portaria. Sem biblioteca remota ou novo serviço contratado.

Arrastar gira a vista; rolagem e botões aproximam/afastam; modo passeio permite câmera baixa e movimento por setas/WASD. Não há colisão física, interiores ou reconstrução real nesta versão. Marcadores são o alvo principal de seleção; o clique no cenário usa proximidade do ponto projetado, não seleção exata de cada malha. Próxima evolução: seleção precisa por objeto, navegação com colisão/caminhos e controles de passeio por toque.

Casa autorizada oferece ficha, consulta de estadias e novo cadastro já associado à unidade, conforme perfil. Casa fora do escopo mostra somente sua referência visual e aviso de restrição. Portaria abre autorizações somente para os perfis simulados de gestão/portaria. Áreas comuns identificam os módulos futuros sem fingir efetuar reservas. Ferramentas dos cantos levam aos módulos existentes.

O modelo de permissões é demonstrativo no navegador. A proteção de produção depende de autorização no servidor e no banco, inclusive arquivos e informações retornadas para objetos que aparecem na cena.

## Acessibilidade e alternativas

Lista de locais, botões rotulados, foco por teclado, controles visíveis de zoom e fallback por lista quando WebGL não estiver disponível. A geometria visual não contém nomes/documentos de moradores ou placas reais. Em telas pequenas, o painel contextual vira uma folha inferior. A alternativa por lista deve permanecer disponível no produto final.

## Validação realizada

Cena renderizada no navegador conectado; clique em Casa 01 exibiu ficha, estadias e novo cadastro; troca para proprietária e seleção de Casa 03 exibiram restrição sem ações ou dados pessoais. Esta inspeção não certifica RBAC de produção. Disposição responsiva foi ajustada após observação da tela de largura intermediária. Planta e capacidade reais ainda não confirmadas.

## Adaptação ao rascunho

Usar identificação das casas, ruas, portões, áreas comuns e orientação indicadas pelo usuário. Registrar posições e dimensões em um arquivo de cena separado antes de ampliar o ambiente; dados físicos continuam separados dos vínculos, permissões e ocupações. Não inferir medidas exatas a partir de um desenho sem escala.


## Atualização de 18/10/2026 — cenário como aplicação

O ponto de entrada agora é immersive.mjs. Casas, estadias, vagas, tarefas e autorizações abrem no painel flutuante sem desmontar o cenário. A seleção de uma casa autorizada muda o fundo para um interior tridimensional conceitual; fechar o painel mantém o interior. O botão de retorno sai para o condomínio. Há atalhos flutuantes de pessoas e vagas e cadastro de estadia em quatro etapas.

As fotografias enviadas orientam fachadas amarelas, telhas terracota, madeira, varandas e piso em pedra. A referência da entrada orienta portão ripado de madeira, cobertura cerâmica, pilares brancos e base de pedra. Não inferir medidas, limites, numeração ou quantidade real de unidades a partir das imagens. A distribuição permanece demonstrativa até receber o rascunho; o interior não representa uma unidade real. Os arquivos fotográficos não foram publicados nem usados como identificação de moradores ou veículos.

Permissões continuam simuladas no cliente. A implementação de autorização real no servidor permanece obrigatória antes do uso com dados reais. Testes do domínio: sete aprovados. Verificação visual: entrada em casa, navegação para estadias mantendo o interior, avanço do cadastro e bloqueio da casa 03 no perfil proprietária.


## Distribuição confirmada pelo usuário — 18/10/2026

O Chandra possui 14 casas, todas com dois pavimentos. Visto da entrada para o fundo: casas 01 a 07 à direita e 08 a 14 à esquerda, avançando sequencialmente. Após e junto à casa 14 fica a churrasqueira com área reservada. Um lance de escadas leva ao patamar com salão de jogos à direita e salão de festas à esquerda. Outro lance leva à piscina.

Térreo: sala, cozinha e área de serviço. Pavimento superior: quartos e banheiro. Quantidade de quartos, medidas, vagas e detalhes internos não foram confirmados. O modelo permite alternar entre dois interiores conceituais e mantém os painéis flutuantes. O catálogo da demonstração foi expandido para 14 unidades preservando estadias, tarefas e auditoria locais. Proprietários e veículos continuam fictícios; permissões são simuladas.

Verificação: 7 testes de domínio aprovados; cena com 14 marcadores e quatro espaços de lazer; entrada na casa e alternância para o pavimento superior conferidas no navegador.


## Vegetação e confirmação da churrasqueira

Mantida a numeração original: 01–07 à direita e 08–14 à esquerda, da entrada para o fundo. O usuário confirmou que “casa 1” foi erro de digitação: a churrasqueira fica entre a casa 14 e o salão de festas. Nenhuma renumeração foi aplicada. Acrescentadas copas facetadas, palmeiras, canteiros, jardineiras floridas, balizadores e mobiliário externo ilustrativos. A distribuição e os dados existentes permanecem preservados.
