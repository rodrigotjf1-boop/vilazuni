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
  await page.goto('/gestao/pessoas');
  await expect(page.getByRole('heading', {name: 'Papéis'})).toBeVisible();
  await page.getByRole('button', {name: 'Conceder papel'}).click();
  await semRolagemLateral(page);
});
