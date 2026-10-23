# Cadastros fictícios do piloto — versão 0.3.1

Para explorar todas as áreas, a versão **0.5.0** acrescenta **Condomínio → Explorar demonstração completa**, com um contexto separado, contatos, tarefas e demais módulos preenchidos. Consulte o [guia completo](DEMONSTRACAO_COMPLETA.md). O conjunto menor abaixo permanece disponível.

Conjunto solicitado para visualizar o Condomínio Chandra. Todos os nomes são fictícios e aparecem com essa indicação; os e-mails usam o domínio reservado `example.invalid`. Não há telefone de pessoa real.

| Casa | Proprietário fictício | Inquilino anual fictício |
|---|---|---|
| 01 | Ricardo Almeida — também síndico informativo | — |
| 02 | Mariana Costa | Camila Rocha |
| 03 | Paulo Henrique | — |
| 04 | Fernanda Souza | — |
| 05 | André Martins | Lucas Barbosa |
| 06 | Juliana Ribeiro | — |
| 07 | Eduardo Lima | — |

Zelador: **Carlos Ferreira**, 47 anos. Síndico: **Ricardo Almeida**, 52 anos, casa 01, proprietário, vigência fictícia de **01/10/2026 a 30/09/2028**.

Os dois contratos anuais vão de **01/10/2026 a 30/09/2027**, identificados como **DEMO-02-2026** e **DEMO-05-2026**. Cada contrato tem o titular informado como morador. A referência e o término podem ser consultados e editados na ficha residencial. Esses registros demonstram o cadastro de contratos; não representam contratos reais assinados nem geram aluguel ou cobrança.

## Aplicar no aplicativo publicado

1. No Easypanel, implante a `main` atualizada do serviço `app`, mantendo banco, volume e chaves existentes. Confira a versão **0.3.1** em `/version.json`.
2. Entre com sua conta de síndico e abra **Condomínio → Preencher dados fictícios**.
3. A tela mostra nomes, casas, contratos e quantos registros serão acrescentados. Clique **Preencher cadastros fictícios**.
4. Consulte as fichas em **Equipe**, nos personagens do passeio e em **Casas → casa desejada → Moradores e vínculos**.

O preenchimento é restrito ao síndico do piloto Chandra com gestão de pessoas. A operação cria somente os registros ausentes. Casas com vínculos anteriores ou proprietários já identificados, fora dos placeholders originais, são preservadas; fichas de síndico/zelador já preenchidas também são mantidas. A prévia informa esses casos. Se uma casa ainda não estiver cadastrada, cria-se sua unidade ilustrativa, respeitando o limite do plano. Nenhuma característica existente da casa é alterada.

Repetir o preenchimento não duplica os registros nem restaura dados editados ou encerrados. As atualizações são verificadas contra a prévia e gravadas como uma operação atômica. A conta real da gestão, senhas, acessos, saldo, estadias e filas de mensagem permanecem sob os controles existentes. As fichas informativas não criam logins ou convites.

O conjunto foi aplicado e conferido em uma base local descartável por API e navegador, incluindo celular. A aplicação no servidor publicado depende da implantação e da ação autenticada acima; não foi acessada uma sessão administrativa da VPS.

Prévia sintética da ficha de contrato: [imagem](../previa-contrato-ficticio.png).
