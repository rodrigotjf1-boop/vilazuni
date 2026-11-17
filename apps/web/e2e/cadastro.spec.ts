import {expect, test, type Page} from '@playwright/test';
import {codigoDoEmail, entrar} from './apoio';

// Cadastro pelo link do condomínio (ADR-0011): a gestão gera o link, o proprietário confirma o e-mail com o código,
// cria a conta e pede as casas; os pedidos aparecem pendentes na gestão; revogar para o link na hora.
// Pessoas FICTÍCIAS; o e-mail fica na caixa da demonstração.

const NOVA = 'nova.pelo.link@demo.vilazuni.test';
const SENHA = 'Senha-do-cadastro-2026';

const linhaDoLink = (page: Page) => page.getByRole('listitem').filter({hasText: /cadastros/}).first();

test('link de cadastro: gerar, cadastrar com código, pedido pendente na gestão e revogar', async ({
  page,
  browser,
  baseURL,
}) => {
  await entrar(page, 'tenaz');
  await page.goto('/gestao/titularidades');
  await expect(page.getByRole('heading', {name: 'Link de cadastro do condomínio'})).toBeVisible();
  await page.getByRole('button', {name: 'Gerar link de cadastro'}).click();
  await page.getByLabel('Validade').selectOption({label: '7 dias'});
  await page.getByLabel('Limite de cadastros').fill('5');
  await page.getByRole('button', {name: 'Gerar link', exact: true}).click();
  await expect(page.getByText(/Link gerado\. Copie agora/)).toBeVisible();
  await expect(page.getByRole('img', {name: 'QR Code do link de cadastro'})).toBeVisible();
  const campoDoLink = page.getByRole('textbox', {name: 'Link de cadastro'});
  const link = await campoDoLink.inputValue();
  expect(link).toMatch(/\/cadastro\/[A-Za-z0-9_-]{40,}$/);
  await expect(linhaDoLink(page)).toContainText('Ativo');
  await expect(linhaDoLink(page)).toContainText('0 de 5 cadastros');
  // fechado, o link não aparece de novo
  await page.getByRole('button', {name: 'Fechar'}).click();
  await expect(campoDoLink).toHaveCount(0);

  const outro = await browser.newContext({baseURL, locale: 'pt-BR'});
  const visitante = await outro.newPage();
  await visitante.goto(new URL(link).pathname);
  await expect(visitante.getByRole('heading', {name: 'Cadastro de proprietário'})).toBeVisible();
  await expect(visitante.getByText('[DEMO] Condomínio Chandra')).toBeVisible();
  await visitante.getByLabel('E-mail').fill(NOVA);
  await visitante.getByRole('button', {name: 'Enviar código'}).click();
  await expect(visitante.getByText(`Enviamos o código para ${NOVA}.`, {exact: false})).toBeVisible();

  const codigo = await codigoDoEmail(baseURL!, NOVA);
  // código errado: avisa e não cria nada
  await visitante.getByLabel('Código do e-mail').fill(codigo === '000000' ? '111111' : '000000');
  await visitante.getByLabel('Seu nome').fill('[DEMO] Nova pelo link');
  await visitante.getByLabel('Senha', {exact: true}).fill(SENHA);
  await visitante.getByLabel('Repita a senha').fill(SENHA);
  await visitante.getByRole('checkbox', {name: 'Casa 12'}).check();
  await visitante.getByRole('checkbox', {name: 'Casa 14'}).check();
  await visitante.getByRole('button', {name: 'Concluir cadastro'}).click();
  await expect(visitante.getByRole('alert')).toHaveText('Código inválido ou já usado.');

  await visitante.getByLabel('Código do e-mail').fill(codigo);
  await visitante.getByRole('button', {name: 'Concluir cadastro'}).click();
  await expect(
    visitante.getByText('Pronto. Seus pedidos foram enviados e aguardam a validação da gestão.'),
  ).toBeVisible();
  await expect(visitante.getByText('Pedidas agora: Casa 12, Casa 14')).toBeVisible();

  // a gestão vê os pedidos pendentes e o uso do link
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Casa 12 · [DEMO] Nova pelo link'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Casa 14 · [DEMO] Nova pelo link'})).toBeVisible();
  await expect(linhaDoLink(page)).toContainText('1 de 5 cadastros');

  // a conta nova entra; a casa ainda não aparece (pendente)
  const dona = await outro.newPage();
  await dona.goto('/entrar');
  await dona.getByLabel('E-mail').fill(NOVA);
  await dona.getByLabel('Senha').fill(SENHA);
  await dona.getByRole('button', {name: 'Entrar'}).click();
  await expect(dona).not.toHaveURL(/\/entrar/);

  // revogar: o link para na hora
  await linhaDoLink(page).getByRole('button', {name: 'Revogar'}).click();
  await page.getByRole('button', {name: 'Sim, revogar'}).click();
  await expect(linhaDoLink(page)).toContainText('Revogado');
  await expect(linhaDoLink(page).getByRole('button', {name: 'Revogar'})).toHaveCount(0);
  await visitante.goto(new URL(link).pathname);
  await expect(visitante.getByRole('alert')).toHaveText(
    'Este link de cadastro foi revogado. Peça um novo à gestão.',
  );
  await outro.close();
});

test('link de cadastro inexistente', async ({page}) => {
  await page.goto(`/cadastro/${'x'.repeat(43)}`);
  await expect(page.getByRole('alert')).toHaveText(
    'Link de cadastro não encontrado. Confira o link ou peça um novo à gestão.',
  );
});
