import {expect, test, type Page} from '@playwright/test';
import {generateSync} from 'otplib';
import {apiComo, entrar, senhaDe} from './apoio';

const cartao = (page: Page, titulo: string) =>
  page.getByRole('listitem').filter({has: page.getByRole('heading', {name: titulo})});

test('Tenaz (escopo cadastro, sem código) valida a titularidade pendente e convida proprietário', async ({
  page,
  browser,
  baseURL,
}) => {
  await entrar(page, 'tenaz');
  const nav = page.getByRole('navigation', {name: 'Navegação principal'});
  await nav.getByRole('link', {name: 'Mais', exact: true}).click();
  const links = page.getByRole('main');
  await expect(links.getByRole('link', {name: 'Titularidades'})).toBeVisible();
  await expect(links.getByRole('link', {name: 'Pessoas e papéis'})).toBeVisible();
  await expect(links.getByRole('link', {name: 'Auditoria'})).toHaveCount(0);

  await links.getByRole('link', {name: 'Titularidades'}).click();
  const pedido = cartao(page, 'Casa 10 · [DEMO] Pedido Pendente');
  await expect(pedido).toBeVisible();
  await pedido.getByRole('button', {name: 'Validar'}).click();
  await pedido.getByRole('button', {name: 'Confirmar validação'}).click();
  await expect(pedido).toHaveCount(0);
  await page.getByRole('button', {name: 'Validadas'}).click();
  await expect(cartao(page, 'Casa 10 · [DEMO] Pedido Pendente').getByText(/Titular desde/)).toBeVisible();

  await page.getByRole('button', {name: 'Convidar proprietário'}).click();
  await page.getByLabel('Casa', {exact: true}).selectOption({label: 'Casa 13'});
  await page.getByLabel('E-mail da pessoa').fill('casa13@demo.vilazuni.test');
  await page.getByRole('button', {name: 'Gerar link do convite'}).click();
  await expect(
    page.getByText('Link gerado. Copie agora e envie à pessoa: ele não aparece de novo.'),
  ).toBeVisible();
  const link = await page.getByLabel('Link do convite').inputValue();
  expect(link).toMatch(/\/convite\/[A-Za-z0-9_-]{40,}$/);

  const outro = await browser.newContext({baseURL, locale: 'pt-BR'});
  const visitante = await outro.newPage();
  await visitante.goto(new URL(link).pathname);
  await expect(visitante.getByText('Titularidade da Casa 13')).toBeVisible();
  // quem tinha o pedido pendente agora vê a casa validada
  const dona = await outro.newPage();
  await entrar(dona, 'pedido-pendente');
  await dona.goto('/minha-casa');
  await expect(dona.getByRole('heading', {name: 'Casa 10'})).toBeVisible();
  await expect(dona.getByText(/Validada desde/)).toBeVisible();
  await outro.close();
});

test('recusa exige motivo, e a pessoa vê o motivo em Minha casa', async ({page, browser, baseURL}) => {
  const {ctx, headers} = await apiComo('proprietaria-06', baseURL!);
  const casas = (await (await ctx.get('unit-labels')).json()).units as {id: string; label: string}[];
  const r = await ctx.post('ownership-requests', {
    headers,
    data: {unitId: casas.find((u) => u.label === 'Casa 13')!.id},
  });
  expect(r.status()).toBe(201);
  await ctx.dispose();

  await entrar(page, 'tenaz');
  await page.goto('/gestao/titularidades');
  const pedido = cartao(page, 'Casa 13 · [DEMO] Proprietária da Casa 06');
  await pedido.getByRole('button', {name: 'Recusar'}).click();
  await expect(pedido.getByRole('button', {name: 'Confirmar recusa'})).toBeDisabled();
  await pedido.getByLabel('Motivo da recusa').fill('Documento da casa não confere [DEMO]');
  await pedido.getByRole('button', {name: 'Confirmar recusa'}).click();
  await expect(pedido).toHaveCount(0);

  const outro = await browser.newContext({baseURL, locale: 'pt-BR'});
  const dona = await outro.newPage();
  await entrar(dona, 'proprietaria-06');
  await dona.goto('/minha-casa');
  const casa13 = cartao(dona, 'Casa 13');
  await expect(casa13.getByText('Recusada')).toBeVisible();
  await expect(casa13.getByText('Motivo: Documento da casa não confere [DEMO]')).toBeVisible();
  await outro.close();
});

test('síndica configura a verificação a partir da Gestão, concede papel, delega, encerra e confere na auditoria', async ({
  page,
}) => {
  await entrar(page, 'sindica');
  const nav = page.getByRole('navigation', {name: 'Navegação principal'});
  await nav.getByRole('link', {name: 'Mais', exact: true}).click();
  await page.getByRole('main').getByRole('link', {name: 'Pessoas e papéis'}).click();
  await expect(
    page.getByText(
      'Esta área pede a verificação em duas etapas, que ainda não está configurada na sua conta.',
    ),
  ).toBeVisible();
  await page.getByRole('link', {name: 'Configurar'}).click();
  await expect(page).toHaveURL(/\/verificacao\?de=%2Fgestao%2Fpessoas/);
  await page.getByLabel('Confirme sua senha para começar').fill(senhaDe('sindica'));
  await page.getByRole('button', {name: 'Configurar'}).click();
  const secret = (await page.locator('code').innerText()).replace(/\s/g, '');
  await page.getByLabel(/Digite o código de 6 dígitos/).fill(generateSync({secret}));
  await page.getByRole('button', {name: 'Confirmar'}).click();
  await page.getByLabel('Guardei os códigos em lugar seguro').check();
  await page.getByRole('button', {name: 'Concluir'}).click();
  await expect(page).toHaveURL(/\/gestao\/pessoas$/);
  await expect(page.getByRole('heading', {name: 'Papéis', exact: true})).toBeVisible();

  // conceder papel (ato crítico: o código acabou de ser confirmado)
  await page.getByRole('button', {name: 'Conceder papel'}).click();
  await page.getByLabel('Pessoa', {exact: true}).selectOption({label: '[DEMO] Proprietário de Duas Casas'});
  await page.getByLabel('Papel', {exact: true}).selectOption({label: 'Conselho fiscal'});
  await page.getByLabel('Motivo', {exact: true}).fill('Eleito em assembleia [DEMO]');
  await page.getByRole('button', {name: 'Conceder papel'}).click();
  await expect(page.getByText('Papel concedido.')).toBeVisible();
  // salvo, o formulário fecha: nada fica preenchido para um segundo envio por engano
  await expect(page.getByLabel('Pessoa', {exact: true})).toHaveCount(0);
  const novo = cartao(page, 'Conselho fiscal · [DEMO] Proprietário de Duas Casas');
  await expect(novo).toBeVisible();

  // delegar ao prestador a leitura da auditoria
  const prestador = cartao(page, 'Prestador de serviços · [DEMO] Prestador de Serviços');
  await prestador.getByRole('button', {name: 'Delegar'}).click();
  await prestador.getByLabel('Ler a auditoria').check();
  await prestador.getByLabel('Fim', {exact: true}).fill('2027-01-31');
  await prestador.getByLabel('Documento da delegação (referência)').fill('Ata de delegação [DEMO]');
  await prestador.getByRole('button', {name: 'Delegar'}).click();
  await expect(prestador.getByText('Delegação registrada.')).toBeVisible();
  await expect(prestador.getByLabel('Ler a auditoria')).toHaveCount(0);
  await expect(prestador.getByText(/Ler a auditoria/)).toBeVisible();

  // encerrar o papel concedido
  await novo.getByRole('button', {name: 'Encerrar papel'}).click();
  await novo.getByLabel('Motivo', {exact: true}).fill('Concedido por engano [DEMO]');
  await novo.getByRole('button', {name: 'Confirmar encerramento'}).click();
  await expect(novo.getByText('Encerrado', {exact: true})).toBeVisible();

  // auditoria: as três ações e a negação do começo (faltava o código)
  await nav.getByRole('link', {name: 'Mais', exact: true}).click();
  await page.getByRole('main').getByRole('link', {name: 'Auditoria'}).click();
  const registro = page.getByRole('list', {name: 'Auditoria'});
  await expect(registro.getByText('Papel concedido').first()).toBeVisible();
  await expect(registro.getByText('Delegação concedida').first()).toBeVisible();
  await expect(registro.getByText('Papel encerrado').first()).toBeVisible();
  await page.getByLabel('Resultado').selectOption('denied');
  await page.getByRole('button', {name: 'Filtrar'}).click();
  await expect(registro.getByText('Motivo: faltou o código de verificação').first()).toBeVisible();
  await expect(registro.getByText('Feito')).toHaveCount(0);
});
