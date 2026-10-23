import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {credentialVault,totp} from '../security.mjs';
import {runtimeConfig} from '../runtime-config.mjs';

const raw=async f=>JSON.parse(await fs.readFile(path.join(f.directory,'store.json'),'utf8'));
const sourceRows=db=>JSON.stringify(Object.fromEntries(Object.entries(db.state).filter(([,v])=>Array.isArray(v)).map(([key,records])=>[key,records.filter(r=>r.tenant==='chandra')]).filter(([,records])=>records.length)));
const image=(f,id,version,cookie,kind='residents')=>fetch(f.origin+'/api/'+kind+'/photo?id='+encodeURIComponent(id)+'&version='+version,{headers:cookie?{Cookie:cookie}:{}});
async function populate(f,cookie=f.admin.cookie){const preview=await f.request('/demo/preview',undefined,cookie);assert.equal(preview.status,200,JSON.stringify(preview.body));const created=await f.request('/demo/create',{fingerprint:preview.body.fingerprint},cookie);assert.equal(created.status,200,JSON.stringify(created.body));return created.body;}
async function enter(f,tenantId,cookie=f.admin.cookie){const r=await f.request('/demo/enter',{tenantId},cookie);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(r.cookie);assert.equal(r.body.user.tenant,tenantId);assert.equal(r.body.user.demoMode,true);return r;}
async function profiles(f,cookie){const r=await f.request('/demo',undefined,cookie);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
async function choose(f,cookie,profile){const r=await f.request('/demo/profile',{userId:profile.id},cookie);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(r.cookie);assert.equal(r.body.user.id,profile.id);assert.equal(r.body.user.demoIdentity,true);assert.equal((await f.request('/state',undefined,cookie)).status,401,'Trocar de perfil invalida a sessão anterior.');return r;}

// These tests use only local disposable data and reserved fictitious contacts.
test('HTTP cria a demonstração completa separada, preserva dados da origem e reabre sem duplicar',async()=>{
 const f=await fixture();try{
  const fund=await f.request('/finance/funds/create',{name:'Fundo anterior sintético',purpose:'Registro existente que deve permanecer'},f.admin.cookie);assert.equal(fund.status,200);
  const account=await f.request('/finance/accounts/create',{name:'Conta anterior sintética',kind:'bank',fundId:fund.body.id,openingOn:'2026-10-01',openingCents:91825,reason:'Saldo sintético anterior à demonstração'},f.admin.cookie);assert.equal(account.status,200);
  const before=await raw(f),original=sourceRows(before),identity=before.users.find(u=>u.id===f.admin.body.user.id),created=await populate(f);assert.equal(created.created,true);assert.notEqual(created.tenantId,'chandra');assert.equal(created.counts.houses,14);assert.equal(created.counts.residents,16);
  const saved=await raw(f);assert.equal(sourceRows(saved),original);const {memberships,...preserved}=saved.users.find(u=>u.id===identity.id);assert.deepEqual(preserved,identity);assert.equal(memberships.filter(m=>m.tenant===created.tenantId).length,1);
  const live=(await f.request('/state',undefined,f.admin.cookie)).body;assert.equal(live.user.tenant,'chandra');assert.equal(live.state.finance.totalCents,91825);
  const entered=await enter(f,created.tenantId),state=(await f.request('/state',undefined,entered.cookie)).body.state,view=await profiles(f,entered.cookie);
  assert.equal(state.deployment.demoMode,true);assert.equal(state.tenant.demoMode,true);assert.equal(state.houses.length,14);assert.equal(state.residents.length,16);assert.ok(state.tour.visual,'O cenário ilustrativo continua disponível no contexto fictício.');
  for(const key of ['tasks','maintenance','materials','incidents','facilities','reservations','parcels','suppliers','purchases','documents','notifications'])assert.ok(state[key].length>0,'Módulo visível com exemplos: '+key);
  for(const key of ['funds','accounts','entries','payables','receivables','budgets','assessments','agreements','statements','closures'])assert.ok(state.finance[key].length>0,'Módulo financeiro com exemplos: '+key);
  assert.ok(view.modules.length>=20);assert.ok(view.modules.filter(m=>m.status==='ready').every(m=>m.count>0));assert.equal(view.profiles.filter(p=>p.role==='proprietario').length,14);assert.equal(view.profiles.filter(p=>p.role==='ocupante').length,2);assert.equal(view.profiles.filter(p=>p.role==='temporario').length,2);assert.ok(state.residents.every(r=>r.phone.startsWith('120255501')));assert.ok(state.residents.every(r=>r.photo===true));
  const exited=await f.request('/demo/exit',{},entered.cookie);assert.equal(exited.status,200);assert.equal(exited.body.user.tenant,'chandra');assert.equal(exited.body.user.id,identity.id);assert.equal((await f.request('/state',undefined,entered.cookie)).status,401);
  const again=await populate(f,exited.cookie);assert.equal(again.created,false);assert.equal(again.tenantId,created.tenantId);assert.deepEqual(again.counts,created.counts);assert.equal(sourceRows(await raw(f)),original);
 }finally{await f.close();}
});

test('perfis fictícios mantêm escopo e privacidade, trocam com a identidade autorizada e não concedem acesso cruzado',async()=>{
 const f=await fixture();try{
  const outsider=await f.invite('proprietario',{houses:['c01']}),created=await populate(f),entered=await enter(f,created.tenantId),view=await profiles(f,entered.cookie);let cookie=entered.cookie;
  assert.equal((await f.request('/demo/enter',{tenantId:created.tenantId},outsider.cookie)).status,403);assert.equal((await f.request('/demo/preview',undefined,outsider.cookie)).status,403);assert.equal((await f.request('/demo/profile',{userId:view.profiles[0].id},outsider.cookie)).status,403);
  assert.equal((await f.request('/demo/profile',{userId:f.admin.body.user.id},cookie)).status,403);assert.equal((await f.request('/state',undefined,cookie)).status,200);
  const owner=view.profiles.find(p=>p.role==='proprietario'&&p.houses.some(h=>h.id==='c02'));cookie=(await choose(f,cookie,owner)).cookie;let s=(await f.request('/state',undefined,cookie)).body.state;assert.deepEqual(s.houses.map(h=>h.id),['c02']);assert.ok(s.residents.find(r=>r.kind==='annual').contactsVisible);assert.ok(s.residents.find(r=>r.kind==='annual').phone);assert.equal((await f.request('/admin/users',undefined,cookie)).status,403);assert.equal(s.finance,null);assert.deepEqual(s.tasks,[]);
  const caretaker=view.profiles.find(p=>p.role==='zelador');cookie=(await choose(f,cookie,caretaker)).cookie;s=(await f.request('/state',undefined,cookie)).body.state;assert.deepEqual(s.houses.map(h=>h.id),['c02']);assert.ok(s.tasks.length>0);assert.ok(s.tasks.every(t=>t.assigneeId===caretaker.id));assert.ok(s.residents.find(r=>r.kind==='annual').contactsVisible);assert.ok(s.residents.every(r=>r.houseId==='c02'));assert.equal((await f.request('/profiles?id='+view.profiles.find(p=>p.role==='ocupante'&&p.houses.some(h=>h.id==='c05')).id,undefined,cookie)).status,403);
  const estate=view.profiles.find(p=>p.role==='imobiliaria');cookie=(await choose(f,cookie,estate)).cookie;s=(await f.request('/state',undefined,cookie)).body.state;assert.deepEqual(s.houses.map(h=>h.id),['c03','c04']);assert.ok(s.stays.length>0);assert.ok(s.stays.every(r=>r.contactsVisible===false&&!r.phone&&!r.whatsapp&&!r.email&&!r.contact&&!r.photo));assert.equal((await f.request('/payments/settings',undefined,cookie)).status,403);
  const annual=view.profiles.find(p=>p.role==='ocupante'&&p.houses.some(h=>h.id==='c02'));cookie=(await choose(f,cookie,annual)).cookie;s=(await f.request('/state',undefined,cookie)).body.state;assert.deepEqual(s.houses.map(h=>h.id),['c02']);assert.deepEqual(s.residents,[]);assert.deepEqual(s.stays,[]);assert.deepEqual(s.tasks,[]);assert.equal((await f.request('/profiles',undefined,cookie)).body.profile.contactsVisible,true);assert.equal((await f.request('/profiles?id='+caretaker.id,undefined,cookie)).status,403);
  const temporary=view.profiles.find(p=>p.role==='temporario'&&p.houses.some(h=>h.id==='c03'));cookie=(await choose(f,cookie,temporary)).cookie;s=(await f.request('/state',undefined,cookie)).body.state;assert.deepEqual(s.houses.map(h=>h.id),['c03']);assert.deepEqual(s.residents,[]);assert.deepEqual(s.stays,[]);assert.equal((await f.request('/community/notices/save',{title:'Tentativa de destaque',body:'Somente o síndico pode destacar como importante',important:true,version:0},cookie)).status,403);
  const contexts=await f.request('/tenants',undefined,cookie);assert.equal(contexts.status,200);assert.ok(contexts.body.contexts.some(c=>c.tenant==='chandra'));assert.ok(contexts.body.contexts.some(c=>c.tenant===created.tenantId));
  const switched=await f.request('/session/context',{tenant:'chandra'},cookie);assert.equal(switched.status,200);assert.equal(switched.body.user.id,f.admin.body.user.id);assert.equal(switched.body.user.role,'sindico');assert.equal(switched.body.user.demoIdentity,false);assert.equal((await f.request('/state',undefined,cookie)).status,401);assert.equal((await f.request('/demo',undefined,switched.cookie)).status,403);
 }finally{await f.close();}
});

test('perfis demonstrativos não autenticam, não enviam recuperação e não ativam convites reais',async()=>{
 const sent=[],f=await fixture({mailProvider:{async sendReset(email){sent.push(email);}}});try{
  const created=await populate(f),db=await raw(f),sample=db.users.find(p=>p.demoIdentity&&p.tenant===created.tenantId&&p.role==='proprietario');assert.ok(sample);
  assert.equal((await f.request('/login',{email:sample.email,password:f.password})).status,401);const recovery=await f.request('/recovery/request',{email:sample.email});assert.equal(recovery.status,200);assert.deepEqual(sent,[]);assert.equal((await f.request('/recovery/reset',{token:'invented-token',password:f.password})).status,400);
  const sourceInvite=await f.request('/admin/invites',{email:sample.email,role:'proprietario',houses:['c01']},f.admin.cookie);assert.equal(sourceInvite.status,201);assert.equal((await f.request('/activate',{name:sample.name,email:sample.email,password:f.password,code:sourceInvite.body.code})).status,403,'Um convite real não transforma uma identidade fictícia em conta com senha.');assert.equal((await f.request('/login',{email:sample.email,password:f.password})).status,401);
  const entered=await enter(f,created.tenantId),view=await profiles(f,entered.cookie),sampleSyndic=view.profiles.find(p=>p.role==='sindico'),selected=await choose(f,entered.cookie,sampleSyndic);
  for(const route of ['/admin/invites','/password','/mfa/enroll','/mfa/confirm','/tenants/create','/tenants/close','/tenants/plan'])assert.equal((await f.request(route,{email:'new@example.invalid',password:f.password},selected.cookie)).status,409,route);
  assert.equal((await f.request('/activate',{name:sample.name,email:sample.email,password:f.password,code:'invented-code'})).status,400);assert.ok((await raw(f)).invites.every(i=>i.tenant!==created.tenantId));assert.ok((await raw(f)).users.filter(p=>p.demoIdentity).every(p=>!p.reset&&!p.mfa&&!p.pendingMfa));
  await f.request('/logout',{},selected.cookie);assert.equal((await f.request('/state',undefined,selected.cookie)).status,401);assert.equal((await f.request('/login',{email:sample.email,password:f.password})).status,401);
 }finally{await f.close();}
});

test('demonstração usa consulta local, bloqueia Asaas antes de chamadas e persiste fotos privadas após reinício',async()=>{
 let generated=0,payments=0;const f=await fixture({assistantProvider:{name:'synthetic',model:'test',async answer(){generated++;throw Error('Não chamar IA externa.');}},asaasClientFactory:()=>{payments++;throw Error('Não construir cliente Asaas externo.');}});try{
  const created=await populate(f),entered=await enter(f,created.tenantId);let cookie=entered.cookie;
  const answer=await f.request('/assistant/answer',{question:'Qual o horário da piscina?',audience:'community'},cookie);assert.equal(answer.status,200,JSON.stringify(answer.body));assert.equal(answer.body.mode,'extractive');assert.ok(answer.body.excerpts.length>0);assert.equal(generated,0);
  for(const route of ['/payments/asaas/connect','/payments/asaas/issue','/payments/asaas/check','/payments/asaas/reconcile'])assert.equal((await f.request(route,{environment:'production',apiKey:'synthetic-not-a-real-key'},cookie)).status,409,route);await f.api.paymentTick();await f.api.automationTick();assert.equal(payments,0);
  let state=(await f.request('/state',undefined,cookie)).body.state;const annual=state.residents.find(r=>r.kind==='annual'&&r.houseId==='c02'),portrait=await image(f,annual.id,annual.version,cookie);assert.equal(portrait.status,200);assert.equal(portrait.headers.get('cache-control'),'no-store');assert.equal(portrait.headers.get('x-content-type-options'),'nosniff');const imageBytes=Buffer.from(await portrait.arrayBuffer());assert.ok(imageBytes.length>100);
  const persisted=await fs.readFile(path.join(f.directory,'store.json'),'utf8');assert.ok(!persisted.includes(imageBytes.toString('base64')));assert.ok(!JSON.stringify(state).includes(imageBytes.toString('base64')));assert.notEqual((await image(f,annual.id,annual.version,'')).status,200);
  await f.restart();assert.equal((await f.request('/state',undefined,cookie)).status,401);const login=await f.request('/login',{email:'admin@example.test',password:f.password});assert.equal(login.status,200);const again=await enter(f,created.tenantId,login.cookie);cookie=again.cookie;assert.deepEqual(Buffer.from(await (await image(f,annual.id,annual.version,cookie)).arrayBuffer()),imageBytes);state=(await f.request('/state',undefined,cookie)).body.state;assert.equal(state.houses.length,14);assert.ok(state.finance.totalCents>0);
  const view=await profiles(f,cookie),selected=await choose(f,cookie,view.profiles.find(p=>p.role==='imobiliaria'));assert.notEqual((await image(f,annual.id,annual.version,selected.cookie)).status,200);assert.equal(generated,0);assert.equal(payments,0);
 }finally{await f.close();}
});

test('MFA real permanece válido nos perfis de síndico e administradora fictícios, sem exigir MFA das identidades de exemplo',async()=>{
 const f=await fixture({vault:credentialVault('b'.repeat(64)),config:{...runtimeConfig({}),requireManagerMfa:true}});try{
  assert.equal(f.admin.body.user.mfaRequired,true);const factor=await f.request('/mfa/enroll',{password:f.password},f.admin.cookie);assert.equal(factor.status,200);const confirmed=await f.request('/mfa/confirm',{otp:totp(factor.body.secret,f.now)},f.admin.cookie);assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));
  const created=await populate(f,confirmed.cookie),entered=await enter(f,created.tenantId,confirmed.cookie),view=await profiles(f,entered.cookie);assert.equal(entered.body.user.mfaRequired,false);assert.equal(entered.body.user.mfaEnabled,true);let cookie=entered.cookie;
  for(const role of ['sindico','administradora']){const selected=await choose(f,cookie,view.profiles.find(p=>p.role===role));cookie=selected.cookie;assert.equal(selected.body.user.mfaRequired,false);assert.equal(selected.body.user.mfaEnabled,true);assert.equal((await f.request('/state',undefined,cookie)).status,200);assert.equal((await f.request('/session',undefined,cookie)).body.user.mfaRequired,false);}
  const saved=await raw(f);assert.ok(saved.users.find(p=>p.id===f.admin.body.user.id).mfa);assert.ok(saved.users.filter(p=>p.demoIdentity).every(p=>!p.mfa));assert.equal((await f.request('/mfa/enroll',{password:f.password},cookie)).status,409);
  const exit=await f.request('/demo/exit',{},cookie);assert.equal(exit.status,200);assert.equal(exit.body.user.id,f.admin.body.user.id);assert.equal(exit.body.user.mfaEnabled,true);
 }finally{await f.close();}
});
