import {expect, test} from '@playwright/test';
import {generateSync} from 'otplib';
import {entrar, senhaDe} from './apoio';

test('prestador configura a verificação, guarda os códigos e usa um deles noutro aparelho', async ({
  page,
  browser,
  baseURL,
}) => {
  await entrar(page, 'prestador');
  await page.getByRole('link', {name: 'Verificação em duas etapas'}).click();
  await expect(page.getByText('Não configurada')).toBeVisible();
  await page.getByLabel('Confirme sua senha para começar').fill(senhaDe('prestador'));
  await page.getByRole('button', {name: 'Configurar'}).click();
  await expect(page.getByRole('img', {name: 'QR Code para o aplicativo autenticador'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Abrir no aplicativo'})).toHaveAttribute(
    'href',
    /^otpauth:\/\/totp\//,
  );

  const secret = (await page.locator('code').innerText()).replace(/\s/g, '');
  await page.getByLabel(/Digite o código de 6 dígitos/).fill('000000'.replace(/0/g, () => '1'));
  await page.getByRole('button', {name: 'Confirmar'}).click();
  await expect(page.getByRole('alert')).toHaveText('Código inválido ou já usado.');
  await page.getByLabel(/Digite o código de 6 dígitos/).fill(generateSync({secret}));
  await page.getByRole('button', {name: 'Confirmar'}).click();

  await expect(page.getByRole('heading', {name: 'Guarde seus códigos de recuperação'})).toBeVisible();
  const codes = await page
    .getByRole('list', {name: 'Guarde seus códigos de recuperação'})
    .locator('li')
    .allInnerTexts();
  expect(codes).toHaveLength(10);
  const concluir = page.getByRole('button', {name: 'Concluir'});
  await expect(concluir).toBeDisabled();
  await page.getByLabel('Guardei os códigos em lugar seguro').check();
  await concluir.click();
  await expect(page.getByText('Confirmada nesta sessão')).toBeVisible();
  await expect(page.getByText('10 códigos de recuperação restantes')).toBeVisible();

  // outro aparelho: entra e confirma com um código de recuperação, voltando para onde ia
  const outro = await browser.newContext({baseURL, locale: 'pt-BR'});
  const p2 = await outro.newPage();
  await entrar(p2, 'prestador');
  await p2.goto('/verificacao?de=%2Fconta%2Fsessoes');
  await expect(p2.getByRole('heading', {name: 'Confirme o código para continuar'})).toBeVisible();
  await p2.getByRole('button', {name: 'Usar um código de recuperação'}).click();
  await p2.getByLabel('Código de recuperação').fill(codes[0]!.toLowerCase());
  await p2.getByRole('button', {name: 'Confirmar'}).click();
  await expect(p2).toHaveURL(/\/conta\/sessoes$/);
  await outro.close();

  await page.reload();
  await expect(page.getByText('9 códigos de recuperação restantes')).toBeVisible();
});
