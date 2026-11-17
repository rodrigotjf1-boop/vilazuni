import {expect, request, type Page} from '@playwright/test';

/** Credenciais DEMONSTRATIVAS geradas pela semeadura desta rodada (global-setup). */
const creds = (): {email: string; password: string}[] => JSON.parse(process.env.VZ_E2E_CREDS || '[]');
export const emailDe = (key: string) => `${key}@demo.vilazuni.test`;
export const senhaDe = (key: string) => {
  const c = creds().find((x) => x.email === emailDe(key));
  if (!c) throw new Error(`Sem credencial demonstrativa para ${key}.`);
  return c.password;
};

/**
 * Entra e ESPERA o login terminar (sair da tela de entrar): um `goto` logo depois do clique interromperia o pedido
 * e a pessoa voltaria para "Entrar". Para testar senha errada, `esperar: false`.
 */
export async function entrar(page: Page, key: string, password = senhaDe(key), {esperar = true} = {}) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(emailDe(key));
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', {name: 'Entrar'}).click();
  if (esperar) await expect(page).not.toHaveURL(/\/entrar/);
}

/** Chamada direta à API como uma pessoa (para preparar o cenário, ex.: criar um convite). */
export async function apiComo(key: string, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const ctx = await request.newContext({baseURL: `${origin}/api/v1/`, extraHTTPHeaders: {origin}});
  const login = await ctx.post('auth/login', {data: {email: emailDe(key), password: senhaDe(key)}});
  expect(login.status(), `entrar como ${key}`).toBe(200);
  const {csrfToken} = await login.json();
  return {ctx, headers: {'x-csrf-token': csrfToken, origin}};
}

/**
 * O código de cadastro que chegou na caixa da DEMONSTRAÇÃO (o e-mail não sai do servidor no modo demo). Espera o
 * despachante da fila entregar. Use um e-mail novo por teste: devolve o código do e-mail mais recente.
 */
export async function codigoDoEmail(baseURL: string, email: string): Promise<string> {
  const origin = new URL(baseURL).origin;
  const ctx = await request.newContext({baseURL: `${origin}/api/v1/`});
  try {
    let codigo = '';
    await expect
      .poll(
        async () => {
          const r = await ctx.get(`demo/mailbox?to=${encodeURIComponent(email)}`);
          const texto: string = (await r.json()).messages?.[0]?.text ?? '';
          codigo = /: (\d{6})\b/.exec(texto)?.[1] ?? '';
          return codigo;
        },
        {message: `código na caixa de ${email}`, timeout: 10_000},
      )
      .toMatch(/^\d{6}$/);
    return codigo;
  } finally {
    await ctx.dispose();
  }
}

/** O corpo da página nunca rola na horizontal (regra de toda tela). */
export async function semRolagemLateral(page: Page) {
  const {scroll, client} = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'a página rola para o lado').toBeLessThanOrEqual(client);
}
