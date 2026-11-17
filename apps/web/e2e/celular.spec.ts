import {expect, test} from '@playwright/test';
import {entrar, semRolagemLateral} from './apoio';

// Na largura de um telefone: nada rola para o lado e o que importa aparece sem procurar.
test('telas sem rolagem lateral no celular', async ({page}) => {
  await page.goto('/entrar');
  await semRolagemLateral(page);
  await page.goto(`/convite/${'x'.repeat(43)}`);
  await semRolagemLateral(page);

  await entrar(page, 'subsindica');
  await expect(page.getByRole('heading', {name: 'Minha casa'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Casa 11'})).toBeVisible();
  await expect(page.getByRole('navigation', {name: 'Navegação principal'})).toBeVisible();
  await semRolagemLateral(page);
  for (const rota of ['/verificacao', '/conta/sessoes']) {
    await page.goto(rota);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    await semRolagemLateral(page);
  }
});

test('telas de Gestão sem rolagem lateral no celular', async ({page}) => {
  await entrar(page, 'tenaz');
  await page.goto('/gestao/titularidades');
  await expect(page.getByRole('heading', {name: 'Titularidades', level: 1})).toBeVisible();
  await page.getByRole('button', {name: 'Convidar proprietário'}).click();
  await semRolagemLateral(page);
  // link de cadastro: o link longo e o QR cabem; a página pública também, nos dois passos
  await page.getByRole('button', {name: 'Gerar link de cadastro'}).click();
  await semRolagemLateral(page);
  await page.getByRole('button', {name: 'Gerar link', exact: true}).click();
  const link = await page.getByRole('textbox', {name: 'Link de cadastro'}).inputValue();
  await expect(page.getByRole('img', {name: 'QR Code do link de cadastro'})).toBeVisible();
  await semRolagemLateral(page);
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('heading', {name: 'Cadastro de proprietário'})).toBeVisible();
  await semRolagemLateral(page);
  await page.getByLabel('E-mail').fill('celular.cadastro@demo.vilazuni.test');
  await page.getByRole('button', {name: 'Enviar código'}).click();
  await expect(page.getByRole('group', {name: 'Suas casas'})).toBeVisible();
  await semRolagemLateral(page);
  await page.goto('/gestao/pessoas');
  await expect(page.getByRole('heading', {name: 'Papéis', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Conceder papel'}).click();
  await semRolagemLateral(page);
});
