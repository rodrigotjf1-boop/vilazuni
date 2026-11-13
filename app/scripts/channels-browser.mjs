import assert from 'node:assert/strict';

// Achado M5 da auditoria: o grupo do Telegram só vale depois do código de vínculo postado nele. A tela mostra o
// código uma vez, a situação "Aguardando o código no grupo" e não oferece preparar resumo antes disso.
export async function channelsBrowser({page, open}) {
  await open('Canais');
  await page.locator('summary', {hasText: 'Configurar grupo Telegram'}).click();
  await page.getByLabel('Nome do grupo', {exact: true}).fill('Grupo sintético do navegador');
  await page.getByLabel('Identificador oficial do grupo', {exact: true}).fill('-1001234567890');
  await page.getByLabel('Nome do bot', {exact: true}).fill('@vilazuni_bot');
  await page.getByLabel('Resumo diário · Brasília', {exact: true}).fill('08:00');
  await page
    .getByLabel('Registro da conferência', {exact: true})
    .fill('Grupo sintético conferido no navegador');
  await page.getByLabel('Conferi o grupo e a autorização de divulgação externa', {exact: true}).check();
  await page.getByRole('button', {name: 'Salvar grupo conferido', exact: true}).click();
  const heading = page.getByRole('heading', {name: /^Código de vínculo: [A-Z2-9]{4}-[A-Z2-9]{4}$/});
  await heading.waitFor();
  const first = await heading.textContent();
  await page.getByText(/Aguardando o código no grupo/).waitFor();
  await page
    .getByText('No grupo -1001234567890, envie a mensagem: /vincular ' + first.split(': ')[1])
    .waitFor();
  assert.equal(await page.getByRole('button', {name: 'Preparar resumo de hoje', exact: true}).count(), 0);
  await page.getByRole('button', {name: 'Gerar novo código de vínculo', exact: true}).click();
  await page.waitForFunction((old) => {
    const h = [...document.querySelectorAll('#experience-dock h3')].find((e) =>
      e.textContent.startsWith('Código de vínculo:'),
    );
    return h && h.textContent !== old;
  }, first);
  console.log(
    'Telegram: grupo salvo fica aguardando o código de vínculo, com o código mostrado uma vez e sem preparar resumo.',
  );
}
