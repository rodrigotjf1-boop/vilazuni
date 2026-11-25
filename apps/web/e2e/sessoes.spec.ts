import {expect, test} from '@playwright/test';
import {entrar} from './apoio';

test('encerrar outra sessão derruba o outro aparelho na hora', async ({page, browser, baseURL}) => {
  const outro = await browser.newContext({baseURL, locale: 'pt-BR'});
  const celular = await outro.newPage();
  await entrar(celular, 'conselheiro-1');
  await expect(celular).toHaveURL(/\/$/);

  await entrar(page, 'conselheiro-1');
  await page.goto('/conta/sessoes');
  await expect(page.getByText('Esta sessão')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Encerrar', exact: true})).toHaveCount(1);
  await page.getByRole('button', {name: 'Encerrar', exact: true}).click();
  await expect(page.getByText('Sessão encerrada.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Encerrar', exact: true})).toHaveCount(0);

  await celular.reload();
  await expect(celular).toHaveURL(/\/entrar\?de=/);
  await outro.close();
});

test('sair de todos os aparelhos pede confirmação e encerra inclusive esta', async ({page}) => {
  await entrar(page, 'conselheiro-3');
  await page.goto('/conta/sessoes');
  await page.getByRole('button', {name: 'Sair de todos os aparelhos'}).click();
  await expect(page.getByText('Encerrar todas as sessões, inclusive esta?')).toBeVisible();
  await page.getByRole('button', {name: 'Sim, sair de todos'}).click();
  await expect(page).toHaveURL(/\/entrar$/);
});
