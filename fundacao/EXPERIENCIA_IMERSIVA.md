# Vilazuni — experiência imersiva

Atualização: 19/10/2026. Direção aprovada: interface ilustrativa com linguagem de jogo, objetos clicáveis, controles nos cantos e painéis conforme permissões. Etapa 5 concluída para o piloto 3D local. Critérios, medições e captura: [ETAPA_5_PASSEIO_VIRTUAL.md](ETAPA_5_PASSEIO_VIRTUAL.md).

## Distribuição e referências

Chandra: 14 casas de dois pavimentos, 01–07 à direita e 08–14 à esquerda de quem entra, em sequência. Churrasqueira junto à 14, antes do salão de festas. Primeiro patamar: festas à esquerda e jogos à direita. Segundo lance: piscina. A menção anterior a “casa 1” junto à churrasqueira foi corrigida pelo usuário; não houve renumeração.

Térreo ilustrativo: sala, cozinha e serviço. Superior: quartos e banheiro. Quantidade de quartos, medidas, vagas e detalhes internos reais não confirmados. Fachadas amarelas, telhas terracota, madeira, varandas e piso em pedra seguem a direção informada. Fotografias de referência não foram publicadas como identificação de pessoas/veículos ou reconstrução medida.

## Implementação atual

world.mjs organiza controles/marcadores; world-renderer.mjs constrói WebGL; tour-layout.mjs centraliza posições e percurso ilustrativos. Sem biblioteca, textura ou mapa remoto. Renderização por demanda, pausada com painel, aba oculta ou modo mapa.

Arrastar olha/gira; pinça, rolagem e botões ajustam zoom. Passear usa setas/WASD ou controles de toque. Percurso limitado à alameda/escadas, com altura contínua e parada antes da piscina/casas. Seleção intersecta triângulos visíveis com oclusão, em vez de proximidade de marcador. Interiores permitem térreo/superior; não há simulação física universal ou rota real de acessibilidade.

Explorar oferece busca, filtros, mapa/lista e fichas. Preferência pelo mapa é salva sem dados privados e evita alocar WebGL na próxima abertura. Falta/perda do contexto preserva a alternativa 2D. Teclado, Escape, foco, movimento reduzido e tela pequena fazem parte da conferência.

## Dados e permissões

tour.mjs monta catálogo/ficha no servidor por condomínio/perfil; cada atalho revalida acesso e atualiza dados antes de abrir o módulo. Exterior não concede ficha privada. Cena sem nomes, contatos, documentos, hóspedes ou placas. Portaria recebe campos operacionais; ocupante não recebe fichas pessoais/estadias. Gestão delegada fica nos seus módulos. Contas exclusivas de dependências/encomendas recebem identificação mínima de unidades na projeção auxiliar, sem características residenciais.

Casa autorizada aponta para moradores/vínculos, estadias, novo cadastro associado, vagas e autorizações conforme papel. Dependência aponta para seu cadastro/regra/agenda. Gestão escolhe o vínculo explicitamente com versão/histórico; nomes não são inferidos. Dependências sem posição permanecem na lista. Interdição é consultada/atualizada no local e reserva continua sujeita ao servidor.

## Aceite e ampliação

165 testes aprovados; Chromium no computador/emulação móvel, incluindo falta/perda de WebGL, revogação e alternativa 2D em 320×568. Cerca de 248 KiB de scripts, buffer de 2.018.880 bytes e zero novos quadros em 500 ms ociosos. A geometria ilustrativa não exige tarifa de API visual.

Antes de imagens reais: material/planta autorizados, responsável pela captura, revisão de privacidade, cobertura, orçamento/cotação e teste físico. Atualização do modelo não é data de fotografia. Nenhuma captura, contratação ou implantação de produção foi realizada; ver plano detalhado antes de ampliar.
