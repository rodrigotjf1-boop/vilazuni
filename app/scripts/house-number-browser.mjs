import assert from 'node:assert/strict';

// Achado M18 da auditoria: o número da casa entrava nas telas sem escape. O cadastro agora recusa marcação,
// mas uma casa gravada antes pode ter: o roteiro troca o número na resposta do /api/state e confere que nada
// vira elemento nos painéis de estadias, vagas, acessos e no assistente de nova estadia.
export async function houseNumberBrowser({page, open}) {
  const photo = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=',
      'base64',
    ),
    br = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 16),
    injected = page.locator('.vz-injetado'),
    dock = page.locator('#experience-dock'),
    literal = /<b class="vz-injetado">/;
  const swap = async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    for (const h of body.state?.houses || []) h.number = `<b class="vz-injetado">${h.number}</b>`;
    await route.fulfill({response, json: body});
  };
  const check = async (where) => {
    assert.equal(await injected.count(), 0, 'marcação virou elemento: ' + where);
    assert.match(await dock.innerText(), literal, 'o número aparece como texto: ' + where);
  };
  await page.route('**/api/state', swap);
  try {
    await page.reload();
    await open('Estadias');
    await page.locator('[data-stay]').first().waitFor();
    await check('lista de estadias');
    await open('Vagas');
    await page.getByRole('heading', {name: 'Um lugar para chegar.', exact: true}).waitFor();
    await check('vagas');
    await open('Acessos');
    await page.getByRole('heading', {name: 'Entradas com contexto.', exact: true}).waitFor();
    await check('acessos');
    await open('Estadias');
    await page.getByRole('button', {name: '＋ Receber uma estadia', exact: true}).click();
    const option = page.locator('#float-wizard select[name=houseId] option').first();
    assert.equal(await injected.count(), 0, 'marcação virou elemento: casas do assistente');
    assert.match(await option.textContent(), literal);
    await page.getByLabel('Chegada · Brasília', {exact: true}).fill(br(Date.now() + 86400000));
    await page.getByLabel('Saída · Brasília', {exact: true}).fill(br(Date.now() + 2 * 86400000));
    await page.getByRole('button', {name: 'Continuar →', exact: true}).click();
    await page.getByLabel('Responsável presente', {exact: true}).fill('Hóspede sintético do escape');
    await page.getByLabel('Todos os ocupantes', {exact: true}).fill('Hóspede sintético do escape');
    await page
      .getByLabel('Foto de identificação do responsável', {exact: true})
      .setInputFiles({name: 'escape-sintetico.png', mimeType: 'image/png', buffer: photo});
    await page.getByRole('button', {name: 'Continuar →', exact: true}).click();
    await page.getByText('O cadastro não garante uma vaga disponível.', {exact: true}).waitFor();
    await check('veículos do assistente');
    await page.getByRole('button', {name: 'Continuar →', exact: true}).click();
    await page.locator('#float-wizard .people-bubbles').waitFor();
    await check('resumo do assistente');
    console.log(
      'Número da casa com marcação aparece como texto em estadias, vagas, acessos e nos 4 passos da nova estadia.',
    );
  } finally {
    await page.unroute('**/api/state', swap);
    await page.reload();
  }
}
