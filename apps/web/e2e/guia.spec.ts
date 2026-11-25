import {randomUUID} from 'node:crypto';
import {expect, test, devices} from '@playwright/test';
import {apiComo, entrar, semRolagemLateral} from './apoio';

test('proprietário publica a atração e hóspede lê o guia no telefone', async ({page, browser, baseURL}) => {
  await entrar(page, 'duas-casas');
  await page.goto('/minha-casa');
  const guideLinks = page.getByRole('link', {name: 'Guia da casa'});
  await expect(guideLinks).toHaveCount(2);
  const link = guideLinks.last();
  await expect(link).toBeVisible();
  const unitId = (await link.getAttribute('href'))!.split('/')[2];
  await link.click();
  await page.getByRole('button', {name: 'Cadastrar atração'}).click();
  await page.getByLabel('Nome da atração').fill('Mirante do teste');
  await page.getByLabel('Descrição').fill('Um ponto para observar a enseada.');
  await page
    .getByLabel('Como chegar saindo do condomínio')
    .fill('Saia do condomínio e siga pela rua principal.');
  await page.getByLabel('Opções de transporte').fill('A pé ou de táxi.');
  await page.getByLabel('Dicas importantes', {exact: false}).fill('Leve água.');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQTk4GAAGWAOoM8hk0AAAAAElFTkSuQmCC',
    'base64',
  );
  await page
    .getByLabel('Foto 1', {exact: true})
    .setInputFiles({name: 'mirante.png', mimeType: 'image/png', buffer: png});
  await page.getByRole('button', {name: 'Salvar atração'}).click();
  await expect(page.getByText('Atração salva.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Mirante do teste'})).toBeVisible();

  const {ctx, headers} = await apiComo('duas-casas', baseURL!);
  const guest = await browser.newPage({...devices['Pixel 7'], locale: 'pt-BR'});
  try {
    const list = await ctx.get('stays?scope=own&view=context');
    const {serverNow} = await list.json();
    const start = Date.parse(serverNow) + 20 * 60 * 1000;
    const stay = await ctx.post('stays', {
      headers,
      data: {
        unitId,
        requestId: randomUUID(),
        checkInAt: new Date(start).toISOString(),
        checkOutAt: new Date(start + 10 * 60 * 1000).toISOString(),
        members: [
          {name: 'Responsável do guia', band: 'adult', contact: 'guia@example.test'},
          {name: 'Segundo responsável', band: 'adult', contact: 'visita@example.test'},
        ],
      },
    });
    expect(stay.status()).toBe(201);
    const {id} = await stay.json();
    const issued = await ctx.post(`stays/${id}/guest-link`, {headers, data: {version: 1}});
    expect(issued.status()).toBe(200);
    const {token} = await issued.json();
    await guest.goto(new URL(`/minha-estadia#${token}`, baseURL).href);
    await guest.getByRole('button', {name: 'Ver atrações'}).click();
    await guest.getByRole('button', {name: 'Ver detalhes'}).click();
    await expect(guest.getByText('Saia do condomínio e siga pela rua principal.')).toBeVisible();
    await expect(guest.getByText('A pé ou de táxi.')).toBeVisible();
    await expect(guest.getByText('Leve água.')).toBeVisible();
    const image = guest.getByRole('img', {name: 'Mirante do teste, foto 1'});
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(guest.getByRole('button', {name: 'Editar atração'})).toHaveCount(0);
    await semRolagemLateral(guest);
  } finally {
    await guest.close();
    await ctx.dispose();
  }
});
