# Pendências para a ativação real

Cada item vira um registro no painel de implantação (Fase 2) com responsável, finalidade, situação e a funcionalidade cuja ativação depende dele. **A pendência bloqueia só o efeito real ligado a ela**; o desenvolvimento segue com dados de demonstração identificados.

| # | Informação ou decisão | Bloqueia |
|---|---|---|
| P01 | Convenção, regimento e atas | Regras publicadas como vigentes; votação vinculante |
| P02 | Nomes/números oficiais das casas e vagas | Cadastro real das unidades e vagas |
| P03 | Titulares, copropriedades e contatos — **vão chegar pelo próprio app**: o dono envia o link de cadastro aos proprietários (ADR-0011) | Validação real de titularidade |
| P04 | Datas do mandato e escopo da isenção do síndico | Poderes de gestão reais; isenção na cobrança |
| P05 | Atribuições da Tenaz | Escopos reais do papel `administrator` |
| P06 | Contrato do prestador e acordo de uso da casa de zelador | Tarefas contratuais; receita e despesa separadas |
| P07 | Contribuição, rateio, vencimento e regras financeiras | Emissão real de cobrança |
| P08 | Titularidade e dados do banco/PSP | Cobrança real |
| P09 | Data de corte da migração Tenaz | Emissor único por competência |
| P10 | Horários da piscina, lixo e silêncio | Regras e respostas do Zelador sobre horários |
| P11 | Regras de temporada | Política de estadia do condomínio |
| P12 | Política de privacidade e retenção por categoria | Produção (expurgo, vídeo, cadastros) |
| P13 | Responsáveis por segurança e atendimento | Alertas e contatos de emergência reais |
| P14 | Infraestrutura de internet do condomínio | Gateway de câmeras e sensores |
| P15 | Modelos de câmeras, portão e fechaduras | Integrações físicas (desligadas por flag) |
| P16 | Bomba/filtro e mapa dos registros | Manual definitivo da piscina; energia real |
| P17 | Volume útil da piscina e protocolo de tratamento | Recomendação de dose; liberação automática pelo protocolo |
| P18 | Tarifas reais (energia, água) | Custo real da piscina |
| P19 | Produtos utilizados | Estoque e consumo reais |
| P20 | Documentação técnica da elétrica | Projeto elétrico 2027 |
| P21 | Número oficial de WhatsApp, templates aprovados e opt-in | Mensagens reais |
| P22 | Conta e chave de assinatura Android do condomínio/projeto | APK de produção |
| P23 | E-mail transacional — **provedor decidido: Amazon SES da DMS; remetente `chandra.vilazuni.com`** (ADR-0011); falta verificar o subdomínio no SES (registros no DNS da Hostinger) e a credencial de envio | Cadastro por link com e-mail confirmado, envio automático do convite e "esqueci a senha" (até lá a gestão envia o link do convite — ADR-0009) |
