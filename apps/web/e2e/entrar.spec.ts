import {expect, test} from '@playwright/test';
import {emailDe, entrar, senhaDe} from './apoio';

test('a entrada tem o cenário do condomínio ao fundo, só decorativo', async ({page}) => {
  await page.goto('/entrar');
  const cena = page.locator('canvas[data-cena]');
  // desenhado (3D) ou, sem WebGL, o fundo parado — nunca "carregando" para sempre
  await expect(cena).toHaveAttribute('data-cena', /^(3d|estatica)$/, {timeout: 15_000});
  await expect(cena).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('[aria-hidden="true"]').filter({has: cena})).toHaveCount(1);
  // o formulário continua por cima e recebe o clique
  await page.getByLabel('E-mail').click();
  await expect(page.getByLabel('E-mail')).toBeFocused();
});

test('com "reduzir movimento", a cena fica numa tomada só e a entrada funciona', async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({baseURL, locale: 'pt-BR', reducedMotion: 'reduce'});
  const page = await ctx.newPage();
  await entrar(page, 'duas-casas');
  await expect(page.getByRole('heading', {name: 'Minha casa', exact: true})).toBeVisible();
  await ctx.close();
});

test('senha errada mostra o motivo e não entra', async ({page}) => {
  await entrar(page, 'duas-casas', 'senha-errada-123', {esperar: false});
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  await expect(page).toHaveURL(/\/entrar/);
});

test('proprietário de duas casas vê as duas, com vaga e situação', async ({page}) => {
  await entrar(page, 'duas-casas');
  await expect(page).toHaveURL(/\/minha-casa$/);
  await expect(page.getByRole('heading', {name: 'Minha casa'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Casa 03'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Casa 04'})).toBeVisible();
  await expect(page.getByText('Vaga 03', {exact: true})).toBeVisible();
  await expect(page.getByText(/Validada desde/).first()).toBeVisible();
  await expect(page.getByText('Ambiente de demonstração: pessoas e dados fictícios.')).toBeVisible();
});

test('copropriedade: as duas pessoas na mesma casa e a mesma vaga', async ({page}) => {
  await entrar(page, 'coproprietaria-a');
  await expect(page.getByRole('heading', {name: 'Casa 05'})).toBeVisible();
  await expect(page.getByText(/\[DEMO\] Coproprietária A/)).toBeVisible();
  await expect(page.getByText(/\[DEMO\] Coproprietário B/)).toBeVisible();
  await expect(page.getByText('Vaga 05', {exact: true})).toHaveCount(1);
});

test('morador de contrato vê a casa como morador', async ({page}) => {
  await entrar(page, 'morador-contrato');
  await expect(page.getByRole('heading', {name: 'Casa 06'})).toBeVisible();
  await expect(page.getByText('Morador', {exact: true})).toBeVisible();
  await expect(page.getByText(/Ativa desde/)).toBeVisible();
});

test('rota protegida manda entrar e volta para onde estava', async ({page}) => {
  await page.goto('/conta/sessoes');
  await expect(page).toHaveURL(/\/entrar\?de=%2Fconta%2Fsessoes/);
  await page.getByLabel('E-mail').fill(emailDe('duas-casas'));
  await page.getByLabel('Senha').fill(senhaDe('duas-casas'));
  await page.getByRole('button', {name: 'Entrar'}).click();
  await expect(page).toHaveURL(/\/conta\/sessoes$/);
  await expect(page.getByRole('heading', {name: 'Sessões e aparelhos'})).toBeVisible();
});

test('retorno para fora do site é ignorado depois de entrar', async ({page}) => {
  await page.goto(`/entrar?de=${encodeURIComponent('/\\outro.exemplo')}`);
  await page.getByLabel('E-mail').fill(emailDe('duas-casas'));
  await page.getByLabel('Senha').fill(senhaDe('duas-casas'));
  await page.getByRole('button', {name: 'Entrar'}).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/minha-casa$/);
});

test('idioma: espanhol e inglês', async ({page}) => {
  await entrar(page, 'coproprietaria-a');
  await page.getByLabel('Idioma').selectOption('es');
  await expect(page.getByRole('heading', {name: 'Mi casa'})).toBeVisible();
  await page.getByLabel('Idioma').selectOption('en');
  await expect(page.getByRole('heading', {name: 'My home'})).toBeVisible();
  await expect(page.getByText('Demo environment: fictitious people and data.')).toBeVisible();
});

test('depois de recarregar a página, os botões continuam funcionando (token recuperado)', async ({page}) => {
  await entrar(page, 'conselheiro-2');
  await expect(page.getByRole('heading', {name: 'Casa 08'})).toBeVisible();
  await page.reload();
  await page.getByLabel('Casa', {exact: true}).selectOption({label: 'Casa 14'});
  await page.getByRole('button', {name: 'Enviar pedido'}).click();
  await expect(page.getByText('Pedido enviado. A gestão vai validar.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Casa 14'})).toBeVisible();
});

test('sair encerra a sessão', async ({page}) => {
  await entrar(page, 'duas-casas');
  await expect(page.getByRole('heading', {name: 'Minha casa'})).toBeVisible();
  await page.getByRole('button', {name: 'Sair'}).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto('/minha-casa');
  await expect(page).toHaveURL(/\/entrar\?de=/);
});
