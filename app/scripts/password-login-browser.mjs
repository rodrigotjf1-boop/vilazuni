import assert from 'node:assert/strict';

export async function passwordLoginBrowser({browser,base,password}) {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 try {
  const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(base);
  await page.getByRole('heading',{name:'Entre no seu espaço.',exact:true}).waitFor();
  assert.equal(await page.locator('#auth-entry [name=otp],#auth-entry [name=recoveryCode]').count(),0);
  await page.getByLabel('E-mail',{exact:true}).fill('browser@example.test');
  await page.getByLabel('Senha',{exact:true}).fill('Senha-incorreta-para-teste');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByText('E-mail, senha ou vínculo inválido.',{exact:true}).waitFor();
  await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.locator('.world-shell:not(.is-locked) #my-account').waitFor();
  assert.equal(await page.locator('#auth-entry').count(),0);
  await page.locator('#my-account').click();await page.getByText('Entrada com e-mail e senha.',{exact:true}).waitFor();
  assert.equal(await page.locator('#mfa-enroll').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('Entrada no celular apenas com e-mail e senha: senha incorreta rejeitada, sem campos MFA nem ativação obrigatória.');
 } finally {await context.close();}
}
