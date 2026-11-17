import {expect, test} from '@playwright/test';
import {apiComo} from './apoio';

const NOVA = 'nova.dona@demo.vilazuni.test';
const SENHA = 'Senha-demo-forte-2026';

test('aceitar convite cria a conta com titularidade pendente; o convite não vale de novo', async ({
  page,
  baseURL,
}) => {
  // a Tenaz (escopo cadastro) prepara o convite pela API, como a gestão fará pela tela
  const {ctx, headers} = await apiComo('tenaz', baseURL!);
  const casas = (await (await ctx.get('units')).json()).units as {id: string; label: string}[];
  const casa12 = casas.find((u) => u.label === 'Casa 12')!;
  const r = await ctx.post('auth/invitations', {
    headers,
    data: {purpose: 'ownership', unitId: casa12.id, contactValue: NOVA},
  });
  expect(r.status()).toBe(201);
  const {token} = await r.json();
  await ctx.dispose();

  await page.goto(`/convite/${token}`);
  await expect(page.getByText('Titularidade da Casa 12')).toBeVisible();
  await expect(page.getByText(/Convite enviado para n\*\*\*@d\*\*\*/)).toBeVisible();
  await page.getByLabel('Seu nome').fill('[DEMO] Nova Dona');
  await page.getByLabel('E-mail que recebeu o convite').fill(NOVA);
  await page.getByLabel('Senha', {exact: true}).fill(SENHA);
  await page.getByLabel('Repita a senha').fill('outra-senha-diferente');
  await expect(page.getByText('As senhas não são iguais.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Aceitar convite'})).toBeDisabled();
  await page.getByLabel('Repita a senha').fill(SENHA);
  await page.getByRole('button', {name: 'Aceitar convite'}).click();
  await expect(
    page.getByText('Pronto. Seu pedido de titularidade foi enviado e aguarda a validação da gestão.'),
  ).toBeVisible();

  await page.goto(`/convite/${token}`);
  await expect(page.getByRole('alert')).toContainText('Este convite já foi usado.');

  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(NOVA);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', {name: 'Entrar'}).click();
  await expect(page.getByRole('heading', {name: 'Casa 12'})).toBeVisible();
  await expect(page.getByText('Aguardando validação da gestão')).toBeVisible();
  // pendente não mostra os proprietários da casa (a API responde 404 para ela)
  await expect(page.getByText('Proprietários')).toHaveCount(0);
});

test('convite com contato errado avisa e não cria nada', async ({page, baseURL}) => {
  const {ctx, headers} = await apiComo('tenaz', baseURL!);
  const casas = (await (await ctx.get('units')).json()).units as {id: string; label: string}[];
  const r = await ctx.post('auth/invitations', {
    headers,
    data: {
      purpose: 'ownership',
      unitId: casas.find((u) => u.label === 'Casa 13')!.id,
      contactValue: 'certo@demo.vilazuni.test',
    },
  });
  const {token} = await r.json();
  await ctx.dispose();
  await page.goto(`/convite/${token}`);
  await page.getByLabel('Seu nome').fill('[DEMO] Outra Pessoa');
  await page.getByLabel('E-mail que recebeu o convite').fill('errado@demo.vilazuni.test');
  await page.getByLabel('Senha', {exact: true}).fill(SENHA);
  await page.getByLabel('Repita a senha').fill(SENHA);
  await page.getByRole('button', {name: 'Aceitar convite'}).click();
  await expect(page.getByRole('alert')).toHaveText('O e-mail não é o do convite.');
});

test('convite inexistente', async ({page}) => {
  await page.goto(`/convite/${'x'.repeat(43)}`);
  await expect(page.getByRole('alert')).toHaveText(
    'Convite não encontrado. Confira o link ou peça um novo à gestão.',
  );
});
