import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {credentialVault} from '../security.mjs';
import {createAsaasClient} from '../asaas-client.mjs';
import {reconcileAsaasPayment} from '../asaas.mjs';

const key='synthetic-integration-key-no-real-access';
function provider(){const payments=[],customers=[],calls=[];let timeout=false,sequence=0,webhook;
 const factory=({environment})=>({
  async account(){return {commercial:{name:'Condomínio Sintético',cpfCnpj:'11222333000181'},status:{general:'APPROVED'}};},
  async webhook(data){webhook=data;return {id:'whk_synthetic'};},
  async customers(reference){return {data:customers.filter(c=>c.externalReference===reference)};},
  async createCustomer(data){const c={...data,id:'cus_synthetic_'+(++sequence)};customers.push(c);return c;},
  async updateCustomer(id,data){calls.push({action:'customer-update',id,data});return {id,...data};},
  async createPayment(data){calls.push({action:'issue',environment,data});const p={...data,id:'pay_synthetic_'+(++sequence),status:'PENDING',netValue:8.01,invoiceUrl:'https://www.asaas.com/i/synthetic',dueDate:data.dueDate};payments.push(p);if(timeout){timeout=false;throw Object.assign(Error('Timeout sintético'),{uncertain:true});}return p;},
  async payments(reference){return {data:payments.filter(p=>p.externalReference===reference)};},
  async payment(id){const p=payments.find(p=>p.id===id);assert.ok(p);return structuredClone(p);},
  async cancel(id){payments.find(p=>p.id===id).deleted=true;return {deleted:true};}
 });return {factory,payments,customers,calls,get webhook(){return webhook;},setTimeout(){timeout=true;}};
}
async function setup(environment='production'){
 const remote=provider(),f=await fixture({vault:credentialVault('a'.repeat(64)),asaasClientFactory:remote.factory}),req=(r,d)=>f.request(r,d,f.admin.cookie);
 const fund=(await req('/finance/funds/create',{name:'Fundo teste',purpose:'Operação sintética'})).body;
 const account=(await req('/finance/accounts/create',{name:'Conta Asaas sintética',kind:'bank',fundId:fund.id,openingOn:'2026-10-01',openingCents:0,reason:'Saldo inicial conferido'})).body;
 const owner=await f.invite('proprietario',{houses:['c01']});
 const receivable=(await req('/finance/receivables/create',{debtor:'Pagador Sintético',reference:'REF-01',description:'Contribuição teste',category:'Condomínio',fundId:fund.id,amountCents:1000,issuedOn:'2026-10-01',dueOn:'2026-10-19'})).body;
 assert.equal((await req('/finance/collection/assign',{id:receivable.id,version:receivable.version,linkVersion:0,payerUserId:owner.body.user.id,reason:'Vínculo sintético conferido'})).status,200);
 assert.equal((await req('/payments/asaas/connect',{version:0,environment,apiKey:key,accountId:account.id,confirmAccount:true,confirmProduction:true})).status,200);
 assert.equal((await req('/payments/asaas/webhook-configure',{})).status,200);
 assert.equal((await req('/payments/payers/save',{userId:owner.body.user.id,version:0,document:'52998224725',mobilePhone:'22999999999'})).status,200);
 const preview=await req('/payments/preview',{receivableId:receivable.id,receivableVersion:receivable.version,billingType:'PIX'});assert.equal(preview.status,200,JSON.stringify(preview.body));
 const issue={...preview.body,confirm:true,confirmProduction:true};
 const webhook=async(id,payment)=>{const response=await fetch(f.origin+'/api/payments/asaas/webhook/'+remote.webhook.url.split('/').at(-1),{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':remote.webhook.token},body:JSON.stringify({id,event:'PAYMENT_RECEIVED',payment})});return {status:response.status,body:await response.json()};};
 return {f,req,remote,fund,account,owner,receivable,issue,webhook};
}
test('Asaas: emissão única, webhook autenticado consultado, conciliação bruta/tarifa e privacidade',async()=>{const x=await setup();const {f,req,remote,issue,owner,webhook}=x;try{
 const results=await Promise.all([req('/payments/asaas/issue',issue),req('/payments/asaas/issue',issue)]);assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));assert.equal(remote.calls.filter(c=>c.action==='issue').length,1);assert.equal(remote.customers[0].notificationDisabled,true);assert.deepEqual(remote.calls.find(c=>c.action==='customer-update').data,{notificationDisabled:true});
 let view=(await req('/payments')).body;assert.equal(view.charges[0].status,'open');assert.ok(!JSON.stringify(view).includes(key));assert.ok(!JSON.stringify(view).includes('52998224725'));
 const other=await f.invite('proprietario',{houses:['c02']});assert.deepEqual((await f.request('/payments',undefined,other.cookie)).body.charges,[]);assert.equal((await f.request('/payments/settings',undefined,owner.cookie)).status,403);
 const forged=await fetch(remote.webhook.url,{method:'POST',headers:{'Content-Type':'application/json','asaas-access-token':'wrong'},body:JSON.stringify({})});assert.equal(forged.status,403);
 assert.equal((await webhook('evt_forged_body',{id:remote.payments[0].id,status:'RECEIVED',value:999999})).status,200);await f.api.paymentTick();assert.equal((await req('/state')).body.state.finance.totalCents,0,'webhook body never supplies settlement amounts');
 remote.payments[0].status='RECEIVED';assert.equal((await webhook('evt_received',{id:remote.payments[0].id})).status,200);await f.api.paymentTick();
 let finance=(await req('/state')).body.state.finance;assert.equal(finance.totalCents,801);assert.equal(finance.receivables[0].status,'received');assert.equal(finance.entries.filter(e=>e.kind==='income').length,1);assert.equal(finance.entries.filter(e=>e.kind==='expense').length,1);
 assert.equal((await webhook('evt_received',{id:remote.payments[0].id})).body.duplicate,true);assert.equal((await webhook('evt_received_again',{id:remote.payments[0].id})).status,200);await f.api.paymentTick();assert.equal((await req('/state')).body.state.finance.totalCents,801);
 const mine=(await f.request('/payments',undefined,owner.cookie)).body;assert.equal(mine.charges[0].status,'received');assert.ok(!('paymentId' in mine.charges[0]));
 const exported=(await req('/tenants/export')).body;assert.ok(!JSON.stringify(exported).includes('webhookCredential'));assert.ok(!JSON.stringify(exported).includes('credential"'));
 remote.payments[0].status='REFUNDED';await webhook('evt_refund',{id:remote.payments[0].id});await f.api.paymentTick();assert.equal((await req('/payments')).body.charges[0].status,'review');assert.equal((await req('/state')).body.state.finance.totalCents,801,'refund requires checked ledger adjustment');
 }finally{await f.close();}});
test('Asaas: timeout mantém bloqueio e consulta recupera emissão sem repetir POST',async()=>{const x=await setup();const {f,req,remote,issue,receivable,account}=x;try{
 remote.setTimeout();assert.equal((await req('/payments/asaas/issue',issue)).status,502);let q=(await req('/payments')).body.charges[0];assert.equal(q.status,'uncertain');assert.notEqual((await req('/payments/asaas/issue',issue)).status,200);assert.equal(remote.payments.length,1);
 assert.notEqual((await req('/finance/receivables/status',{id:receivable.id,version:1,status:'cancelled',reason:'Teste de bloqueio externo'})).status,200);
 assert.equal((await req('/payments/asaas/reconcile',{id:q.id,version:q.version})).status,200);q=(await req('/payments')).body.charges[0];assert.equal(q.status,'open');assert.ok(q.invoiceUrl);
 assert.equal((await req('/payments/asaas/cancel',{id:q.id,version:q.version,confirm:true})).status,200);assert.equal((await req('/payments')).body.charges[0].status,'cancelled');assert.equal((await req('/state')).body.state.finance.receivables[0].status,'open');
 const raw=await fs.readFile(path.join(f.directory,'store.json'),'utf8');assert.ok(!raw.includes(key));
 assert.equal(remote.calls.filter(c=>c.action==='issue').length,1);assert.ok(account.id);
 }finally{await f.close();}});
test('Asaas: homologação não movimenta caixa e permite passar à conta de produção sem subcontas',async()=>{const x=await setup('sandbox');const {f,req,remote,issue,account}=x;try{
 assert.equal((await req('/payments/asaas/issue',issue)).status,200);remote.payments[0].status='RECEIVED';let q=(await req('/payments')).body.charges[0];assert.equal((await req('/payments/asaas/reconcile',{id:q.id,version:q.version})).status,200);let s=(await req('/state')).body.state;assert.equal(s.finance.totalCents,0);assert.equal(s.finance.receivables[0].status,'open');
 const c=(await req('/payments/settings')).body.connection;assert.equal((await req('/payments/asaas/connect',{version:c.version,environment:'production',apiKey:key,accountId:account.id,confirmAccount:true,confirmProduction:true})).status,200);assert.equal((await req('/payments')).body.connection.environment,'production');assert.ok(remote.calls.every(c=>!String(c.action).includes('subaccount')));
 }finally{await f.close();}});
test('Asaas client limita destinos, suprime erros externos e nunca repete POST após falha',async()=>{let count=0;const c=createAsaasClient({environment:'sandbox',apiKey:key,fetcher:async(url,options)=>{count++;assert.equal(new URL(url).origin,'https://api-sandbox.asaas.com');assert.equal(options.redirect,'error');return new Response(JSON.stringify({errors:[{description:key}]}),{status:500});}});
 await assert.rejects(c.createPayment({value:1}),e=>e.uncertain===true&&!e.message.includes(key));assert.equal(count,1);assert.throws(()=>createAsaasClient({environment:'https://attacker.invalid',apiKey:key}));await assert.rejects(c.request('GET','//attacker.invalid'));
});
test('lembretes Asaas privados são optativos, únicos no dia e interrompidos por suspensão',async()=>{const {f,req,issue,owner,receivable}=await setup();try{
 await req('/payments/asaas/issue',issue);await f.api.paymentTick();let s=(await f.request('/state',undefined,owner.cookie)).body.state;assert.equal(s.notifications.filter(n=>n.kind==='asaasReminders').length,0);
 const c=(await req('/payments/settings')).body.connection;assert.equal((await req('/payments/reminders',{version:c.version,enabled:true})).status,200);await f.api.paymentTick();await f.api.paymentTick();s=(await f.request('/state',undefined,owner.cookie)).body.state;assert.equal(s.notifications.filter(n=>n.kind==='asaasReminders').length,1);
 await req('/finance/collection/hold',{id:receivable.id,version:0,held:true,reason:'Conferência de contestação'});f.advance(86400000);await f.api.paymentTick();const login=await f.request('/login',{email:owner.email,password:f.password});s=(await f.request('/state',undefined,login.cookie)).body.state;assert.equal(s.notifications.filter(n=>n.kind==='asaasReminders').length,1);
 }finally{await f.close();}});
test('Asaas: conciliação é atômica quando a destinação financeira diverge',()=>{
 const s={asaasConnections:[{id:'connection-test',tenant:'chandra'}],asaasPayers:[{id:'payer-test',tenant:'chandra',customers:{'connection-test':'cus_test'}}],asaasCharges:[{id:'charge-test',tenant:'chandra',connectionId:'connection-test',payerId:'payer-test',externalReference:'vilazuni:test',amountCents:1000,billingType:'PIX',dueOn:'2026-10-19',status:'open',version:1,environment:'production',receivableId:'missing'}]};const before=structuredClone(s);assert.throws(()=>reconcileAsaasPayment(s,'connection-test',{id:'pay_test',customer:'cus_test',externalReference:'vilazuni:test',value:10,netValue:8.01,billingType:'PIX',dueDate:'2026-10-19',status:'RECEIVED'}));assert.deepEqual(s,before);
});
