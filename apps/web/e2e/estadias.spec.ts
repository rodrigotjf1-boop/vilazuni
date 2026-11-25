import {expect, test} from '@playwright/test';
import {generateSync} from 'otplib';
import {stayTimeInput} from '../src/lib/stay-time';
import {apiComo, entrar, semRolagemLateral, senhaDe} from './apoio';

test('Portal, Mesa e Calendário consultam a mesma estadia com os acessos de cada perfil', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await apiComo('duas-casas', baseURL!);
  const list = await owner.ctx.get('stays?scope=own');
  expect(list.ok()).toBeTruthy();
  const {ownUnits, serverNow, timezone} = await list.json();
  const after = new Date(Date.parse(serverNow) + 86_400_000).toISOString();
  await owner.ctx.dispose();

  await entrar(page, 'duas-casas');
  await expect(page.getByRole('heading', {name: 'Sua casa no condomínio'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Calendário de ocupação'})).toHaveCount(0);
  await page.getByRole('link', {name: 'Cadastrar estadia'}).click();
  await page.getByLabel('Casa', {exact: true}).selectOption(ownUnits[0].id);
  await page.getByLabel('Check-in', {exact: true}).fill(stayTimeInput(serverNow, timezone));
  await page.getByLabel('Checkout', {exact: true}).fill(stayTimeInput(after, timezone));
  await page.getByLabel('Nome do responsável principal').fill('Responsável de teste');
  await page.getByLabel('Contato do responsável principal').fill('responsavel@example.test');
  await page.getByLabel('Nome do segundo responsável').fill('Integrante de teste');
  await page.getByLabel('Contato do segundo responsável').fill('integrante@example.test');
  await page.getByLabel('Placas previstas').fill('ABC1D23');
  await page.getByLabel('Orientações de chegada').fill('Procure a recepção de teste ao chegar.');
  await page.getByRole('button', {name: 'Comunicar estadia'}).click();
  await expect(page).toHaveURL(/estadia=[0-9a-f-]{36}/);
  await expect(page.getByText('Responsável de teste', {exact: false})).toBeVisible();
  await expect(page.getByText('Comunicada', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Gerar link do hóspede'}).click();
  const link = page.getByRole('textbox', {name: 'Link do hóspede'});
  await expect(link).toHaveValue(/minha-estadia#/);
  const guest = await browser.newPage({locale: 'pt-BR'});
  try {
    await guest.goto(await link.inputValue());
    await expect(guest.getByText('Procure a recepção de teste ao chegar.')).toBeVisible();
    await expect(guest.getByText('Responsável de teste', {exact: false})).toHaveCount(0);
  } finally {
    await guest.close();
  }

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
    await expect(team.getByRole('heading', {name: 'Check-ins e checkouts de hoje'})).toBeVisible();
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
