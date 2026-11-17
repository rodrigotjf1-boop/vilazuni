# Mapa de telas

Identidade: Vilazuni (produto) e o condomínio ativo no cabeçalho. Paleta da especificação, contraste conferido por combinação: fundo `#F5F8F7`, superfície `#FFFFFF`, primária `#286A61`, texto `#173B3B`, areia `#E7D9BE`, informação `#42759A`, atenção `#886414`, erro `#B23A48`. Corpo ~16 px, foco visível, alvos de toque confortáveis. Validar em 360, 768 e 1440 px, teclado, leitor de tela e fonte ampliada.

Layout (decisão de 17/11/2026): as telas de uso seguem este layout; a tela **Entrar** tem ao fundo o cenário 3D da vila aprovado pelo dono em 12/11 (do app anterior), decorativo, com o formulário num painel claro por cima — parado com "reduzir movimento" e em aparelho fraco; sem WebGL, fundo na cor da marca.

## Navegação por perfil (celular: até 5 destinos)

| Perfil | Destinos |
|---|---|
| Proprietário | Início · Minha casa · Avisos · Ocorrências · Mais |
| Hóspede | Estadia · Regras · Avisos · Ajuda |
| Prestador | Hoje · Registrar · Estoque · Avisos · Mais |
| Gestão | Pendências · Financeiro · Operação · Condomínio |

Desktop: menu lateral agrupado em Meu espaço, Condomínio, Operação e Gestão.

## Telas da F1.1

| Tela | Rota web | Endpoints | Quem |
|---|---|---|---|
| Entrar | `/entrar` | `POST /auth/login`, `POST /auth/mfa/verify` | todos |
| Aceitar convite | `/convite/:token` | `GET/POST /auth/invitations/:token` | convidado |
| Pedir titularidade | `/minha-casa/pedido` | `POST /ownership-requests` | quem entrou sem vínculo |
| Minha casa | `/minha-casa` | `GET /me/units` | proprietário, morador |
| Sessões | `/conta/sessoes` | `GET/DELETE /auth/sessions` | todos |
| Gestão › Titularidades | `/gestao/titularidades` | `GET /ownership-requests`, `POST …/validate`, `…/reject` | síndico, delegação |
| Gestão › Pessoas e papéis | `/gestao/pessoas` | `GET /memberships`, `POST /auth/invitations`, `/mandates`, `/delegations` | síndico |
| Gestão › Unidades e vagas | `/gestao/unidades` | `GET/PATCH /units`, `/parking-spaces` | síndico |

Estados obrigatórios em toda tela: carregando, vazio com ação útil, erro com o motivo e caminho, sucesso com o resultado real. Sem botão decorativo.
