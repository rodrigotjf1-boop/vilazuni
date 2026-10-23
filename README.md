# Vilazuni

Plataforma de gestão e convivência para múltiplos condomínios. Piloto: **Condomínio Chandra**.

## Documentação

- [Plano consolidado](PLANO_DO_PROJETO.md)
- [Especificação funcional](ESPECIFICACAO_INICIAL.md)
- [Pesquisa e prioridades](SUGESTOES_E_PRIORIDADES.md)
- [Modelo de dados](fundacao/MODELO_DE_DADOS.md)
- [Permissões](fundacao/PERMISSOES.md)
- [Fichas, privacidade e avisos importantes](fundacao/FICHAS_PRIVACIDADE_E_AVISOS.md)
- [Fluxos e telas](fundacao/FLUXOS_E_TELAS.md)
- [Piloto e backlog](fundacao/CHANDRA_E_BACKLOG.md)
- [Conceito de identidade visual](marca/IDENTIDADE.md)

## Demonstração local

Há uma versão executável em [app](app/README.md). Para abrir no Windows, executar `Iniciar Vilazuni.cmd` e visitar o endereço informado. O primeiro acesso solicita a criação da conta local de gestão; depois, a gestão emite convites pelo botão com seu nome. Login e permissões são verificados no servidor. Casas e operações locais continuam com dados fictícios; a versão 0.2.0 inclui preparo de PostgreSQL, MFA, recuperação e implantação. A primeira implantação web na VPS Hostinger com Easypanel foi realizada; a ativação operacional segue o [guia Easypanel](deploy/easypanel/README.md). Não inserir dados reais de moradores no piloto local.

[Estado de desenvolvimento e limitações](STATUS_DO_PROJETO.md).

## Entrega 0.2.0

As etapas técnicas 6–8 incluem assistência/governança, PWA e projetos móveis, teste controlado de equipamentos e distribuição para vários condomínios. Veja [estado atual](STATUS_DO_PROJETO.md), [implantação](deploy/README.md) e [aplicativos](mobile/README.md). Credenciais, domínio, distribuição assinada e homologação real pertencem à ativação operacional posterior.
