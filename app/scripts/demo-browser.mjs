import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function demoBrowser({page,api,open}){
 const folder=process.env.VILAZUNI_DEMO_ARTIFACTS;if(folder)await fs.mkdir(folder,{recursive:true});
 await open('Condomínio');await page.getByRole('button',{name:'Preencher dados fictícios',exact:true}).click();await page.getByRole('heading',{name:'Pessoas para explorar o piloto.',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Ricardo Almeida (fictício)',exact:true}).first().waitFor();await page.getByRole('heading',{name:'Carlos Ferreira (fictício)',exact:true}).waitFor();assert.equal(await page.locator('.float-feed article').count(),9);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(folder)await page.screenshot({path:path.join(folder,'previa-mobile.png'),animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Preencher cadastros fictícios',exact:true}).click();await page.getByRole('button',{name:'Condomínio',exact:true}).waitFor();
 let s=(await api('/state')).state;assert.equal(s.residents.filter(r=>r.kind==='owner').length,7);assert.equal(s.residents.filter(r=>r.kind==='annual').length,2);assert.equal(s.residents.find(r=>r.houseId==='c02'&&r.kind==='annual').contractReference,'DEMO-02-2026');
 await open('Equipe');await page.getByRole('button',{name:/Síndico.*Ricardo Almeida/}).click();await page.getByRole('heading',{name:'Ricardo Almeida (fictício)',exact:true}).first().waitFor();await page.getByText(/Casa 01 · Proprietário/).waitFor();
 await open('Casas');await page.locator('#tour-results [data-tour-point=c02]').click();await page.getByRole('button',{name:'Moradores e vínculos',exact:true}).click();await page.getByRole('button',{name:/Camila Rocha/}).click();await page.getByText('Contrato DEMO-02-2026',{exact:true}).waitFor();await page.getByText('Acesso pelo contrato até 30/09/2027.',{exact:true}).waitFor();if(folder)await page.screenshot({path:path.join(folder,'contrato-anual.png'),animations:'disabled'});
 await open('Condomínio');await page.getByRole('button',{name:'Preencher dados fictícios',exact:true}).click();await page.getByText(/Novos cadastros: 0 proprietário/).waitFor();await page.getByRole('button',{name:'Preencher cadastros fictícios',exact:true}).click();await page.getByRole('button',{name:'Condomínio',exact:true}).waitFor();s=(await api('/state')).state;assert.equal(s.residents.length,9);
 console.log('Preenchimento fictício desktop/celular: síndico, zelador, 7 proprietários, 2 contratos anuais e repetição sem duplicação aprovados.');
}
