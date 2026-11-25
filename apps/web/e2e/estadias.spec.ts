import {randomUUID} from 'node:crypto';
import {expect, test} from '@playwright/test';
import {generateSync} from 'otplib';
import {apiComo, entrar, semRolagemLateral, senhaDe} from './apoio';

test('Portal, Mesa e Calendário consultam a mesma estadia com os acessos de cada perfil', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await apiComo('duas-casas', baseURL!);
  const list = await owner.ctx.get('stays?scope=own');
  expect(list.ok()).toBeTruthy();
  const {ownUnits, serverNow} = await list.json();
  const now = Date.parse(serverNow);
  const request = await owner.ctx.post('stays', {
    headers: owner.headers,
    data: {
      unitId: ownUnits[0].id,
      requestId: randomUUID(),
      checkInAt: serverNow,
      checkOutAt: new Date(now + 86_400_000).toISOString(),
      members: [
        {name: 'Responsável de teste', band: 'adult', contact: 'responsavel@example.test'},
        {name: 'Integrante de teste', band: 'adult', contact: 'integrante@example.test'},
      ],
      plates: ['ABC1D23'],
    },
  });
  expect(request.status()).toBe(201);
  const {id} = await request.json();
  await owner.ctx.dispose();

  await entrar(page, 'duas-casas');
  await expect(page.getByRole('heading', {name: 'Sua casa no condomínio'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Calendário de ocupação'})).toHaveCount(0);
  await page.getByRole('link', {name: /Casa 03/}).click();
  await expect(page).toHaveURL(new RegExp(`estadia=${id}`));
  await expect(page.getByText('Responsável de teste', {exact: false})).toBeVisible();

  const session = await browser.newContext({
    baseURL,
    locale: 'pt-BR',
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
  });
  try {
    const team = await session.newPage();
    await entrar(team, 'subsindica');
    await team.goto('/verificacao?de=%2Foperacao');
    await team.getByLabel('Confirme sua senha para começar').fill(senhaDe('subsindica'));
    await team.getByRole('button', {name: 'Configurar'}).click();
    const secret = (await team.locator('code').innerText()).replace(/\s/g, '');
    await team.getByLabel(/Digite o código de 6 dígitos/).fill(generateSync({secret}));
    await team.getByRole('button', {name: 'Confirmar'}).click();
    await team.getByLabel('Guardei os códigos em lugar seguro').check();
    await team.getByRole('button', {name: 'Concluir'}).click();

    await expect(team.getByRole('heading', {name: 'Mesa de operação'})).toBeVisible();
    await expect(team.getByRole('button', {name: /Responsável de teste/})).toBeVisible();
    await expect(team.getByRole('textbox', {name: 'Placa', exact: true})).toHaveValue('ABC1D23');
    await semRolagemLateral(team);

    await team.getByRole('link', {name: 'Calendário de ocupação'}).click();
    await expect(team.getByRole('heading', {name: 'Calendário de ocupação'})).toBeVisible();
    await expect(team.getByRole('link', {name: /Responsável de teste/})).toBeVisible();
    await semRolagemLateral(team);

    await team.setViewportSize({width: 1360, height: 900});
    await expect(team.getByRole('region', {name: 'Noites por unidade'})).toBeVisible();
    await team.getByRole('button', {name: 'Próxima semana'}).click();
    await expect(team.getByRole('region', {name: 'Noites por unidade'})).toBeVisible();
    await expect(team.getByRole('link', {name: /Responsável de teste/})).toHaveCount(0);
  } finally {
    await session.close();
  }
});
