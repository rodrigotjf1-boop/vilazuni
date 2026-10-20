# Retomar Vilazuni

Consultar primeiro [STATUS_DO_PROJETO](STATUS_DO_PROJETO.md) e os critérios atuais das [etapas 6](fundacao/ETAPA_6_FONTES_E_GOVERNANCA.md) e [7–8](fundacao/ETAPAS_7_8_DISTRIBUICAO.md).

Usuário pediu concluir as etapas de desenvolvimento, deixando hospedagem, domínio e distribuição para depois; modificações pontuais serão avaliadas ao final. Município confirmado: Arraial do Cabo/RJ. Cobrança permanece **somente manual**, sem Asaas/Pix/boleto ou serviços contratados.

Usar o checkout existente. Instalar pelo lockfile com `npm ci --prefix app --ignore-scripts`; validar `npm test --prefix app` e, para interface, `npm run test:browser --prefix app`. Testes PostgreSQL exigem configuração descartável local; nunca apontar testes ou restauração a produção.

Servidor local: `npm start --prefix app`, loopback padrão 4173. Não criar conta/senha do usuário. Não iniciar dois processos sobre a mesma base JSON. Bases e chaves estão fora do Git. Próxima tarefa operacional: escolher hospedagem/domínio, preencher configuração segura, homologar aparelhos/equipamentos e disponibilizar os canais escolhidos. [Deploy](deploy/README.md) e [mobile](mobile/README.md) contêm os requisitos sem precisar expor segredos na conversa.
