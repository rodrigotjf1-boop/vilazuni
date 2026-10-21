# Retomar Vilazuni

Consultar primeiro [STATUS_DO_PROJETO](STATUS_DO_PROJETO.md) e os critérios atuais das [etapas 6](fundacao/ETAPA_6_FONTES_E_GOVERNANCA.md) e [7–8](fundacao/ETAPAS_7_8_DISTRIBUICAO.md).

Usuário pediu concluir as etapas de desenvolvimento e avançou para a implantação: VPS Hostinger com Easypanel em Campinas/SP e domínio próprio adquiridos. Modificações pontuais serão avaliadas ao final. Município do condomínio confirmado: Arraial do Cabo/RJ. Cobrança permanece **somente manual**, sem Asaas/Pix/boleto ou parceiro financeiro contratado.

Usar o checkout existente. Instalar pelo lockfile com `npm ci --prefix app --ignore-scripts`; validar `npm test --prefix app` e, para interface, `npm run test:browser --prefix app`. Testes PostgreSQL exigem configuração descartável local; nunca apontar testes ou restauração a produção.

Servidor local: `npm start --prefix app`, loopback padrão 4173. Não criar conta/senha do usuário. Não iniciar dois processos sobre a mesma base JSON. Bases e chaves estão fora do Git. Próxima tarefa operacional: configurar DNS e [serviços nativos do Easypanel](deploy/easypanel/README.md), gerar configurações privadas na própria VPS, conferir HTTPS, banco restrito, volume e recuperação, homologar aparelhos/equipamentos e disponibilizar os canais escolhidos. Acesso ao painel/SSH não foi fornecido; não declarar a aplicação implantada com base somente no painel acessível. [Deploy](deploy/README.md) e [mobile](mobile/README.md) contêm os requisitos sem precisar expor segredos na conversa.
