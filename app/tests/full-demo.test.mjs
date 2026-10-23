import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {seed} from '../domain.mjs';
import {financeView} from '../finance.mjs';
import {balance,ledger} from '../finance-ledger.mjs';
import {validBinding} from '../access.mjs';
import {createTenant,effectiveBinding,usersInTenant} from '../tenants.mjs';
import {FULL_DEMO_PACK,previewFullDemo,createFullDemo,fullDemoView,demoMembership,demoProfile,demoSource} from '../full-demo.mjs';
import {fixture} from './helpers.mjs';

const now=Date.parse('2026-10-23T12:00:00-03:00');
const live={id:'real-syndic',tenant:'chandra',role:'sindico',name:'Gestão existente',email:'real-manager@example.test',houses:[],active:true,validUntil:null,salt:'existing-salt',hash:'existing-hash',credentialVersion:4,mfa:{sealed:'existing-mfa-secret'}};
const database=()=>({schema:1,users:[structuredClone(live)],invites:[],events:[{tenant:'chandra',actor:live.id,at:'2026-10-22T12:00:00Z',action:'Evento anterior'}],state:{...seed(),residents:[],communityNotices:[{id:'existing-notice',tenant:'chandra',title:'Comunicado existente',body:'Não alterar.',version:7}],financialAccounts:[{id:'real-account',tenant:'chandra',name:'Conta existente',openingCents:91825,openingOn:'2026-01-01',openingFundId:'real-fund',version:9,active:true}],financialFunds:[{id:'real-fund',tenant:'chandra',name:'Fundo existente',active:true}],financialEntries:[],automationConnections:[{id:'real-connection',tenant:'chandra',enabled:true,tokenHash:'existing-token',version:8}],automationMessages:[{id:'existing-message',tenant:'chandra',status:'queued',kind:'notice',sourceId:'existing-notice',sourceVersion:7}]}});
const sourceState=(db,tenant)=>JSON.stringify(Object.fromEntries(Object.entries(db.state).filter(([,v])=>Array.isArray(v)).map(([key,values])=>[key,values.filter(v=>v.tenant===tenant)]).filter(([,values])=>values.length)));
const realIdentity=db=>db.users.find(p=>p.id===live.id);
const populate=(db,user=effectiveBinding(db,realIdentity(db),'chandra'))=>createFullDemo(db,user,{fingerprint:previewFullDemo(db,user).fingerprint},now);
const own=(db,key,tenant)=>(db.state[key]||[]).filter(r=>r.tenant===tenant);

test('demonstração completa popula as bases de exploração sem modificar registros, credenciais ou integrações do condomínio real',()=>{
 const db=database(),source=sourceState(db,'chandra'),credentials=structuredClone(realIdentity(db)),events=JSON.stringify(db.events),preview=previewFullDemo(db,live);
 assert.equal(preview.exists,false);assert.equal(preview.isolated,true);assert.equal(preview.counts.houses,14);
 const result=createFullDemo(db,live,{fingerprint:preview.fingerprint},now),tenant=result.tenantId,t=db.state.tenants.find(t=>t.id===tenant),identity=realIdentity(db),manager=demoMembership(db,identity,tenant);
 assert.equal(result.created,true);assert.equal(t.demoMode,true);assert.equal(t.demoSourceTenant,'chandra');assert.equal(t.demoOwnerId,live.id);assert.equal(t.demoPack,FULL_DEMO_PACK);
 assert.equal(sourceState(db,'chandra'),source);assert.equal(JSON.stringify(db.events),events);
 const {memberships,...preserved}=identity;assert.deepEqual(preserved,credentials);assert.equal(memberships.filter(m=>m.tenant===tenant).length,1);
 assert.equal(own(db,'houses',tenant).length,14);const residents=own(db,'residents',tenant);assert.equal(residents.length,16);assert.equal(residents.filter(r=>r.kind==='owner').length,14);assert.equal(residents.filter(r=>r.kind==='annual').length,2);
 for(const r of residents){assert.match(r.name,/\(fictício\)$/);assert.match(r.phone,/^120255501\d\d$/);assert.equal(r.whatsapp,r.phone);assert.match(r.email,/@example\.invalid$/);assert.ok(r.photo?.data);assert.ok(r.vehicles.length>0);assert.equal(r.demoPack,FULL_DEMO_PACK);}
 for(const key of ['stays','memberProfiles','communityProfiles','householdContactGrants','tasks','maintenance','materials','incidents','facilities','reservations','parcels','suppliers','purchases','documents','communityNotices','consultativePolls','assemblies','knowledgeSources','knowledgeBriefings','operationalAlerts','privacyRequests','notifications','accessDevices','accessCommands','physicalEvents','plateEvents','channels'])assert.ok(own(db,key,tenant).length>0,'Base de exploração deve conter exemplos: '+key);
 assert.ok(own(db,'tasks',tenant).some(t=>t.status==='todo'));assert.ok(own(db,'tasks',tenant).some(t=>t.status==='doing'));assert.ok(own(db,'tasks',tenant).some(t=>t.status==='review'));assert.ok(own(db,'tasks',tenant).some(t=>t.status==='done'));
 assert.ok(own(db,'stays',tenant).some(s=>s.rentalKind==='daily'&&s.status==='approved'));assert.ok(own(db,'stays',tenant).some(s=>s.rentalKind==='seasonal'&&s.status==='approved'));assert.ok(own(db,'communityNotices',tenant).some(n=>n.important&&!n.archivedAt));
 assert.ok(own(db,'accessDevices',tenant).every(d=>d.mode==='simulator'&&!d.adapterKey));assert.ok(own(db,'channels',tenant).every(c=>!c.active&&!c.scheduled));assert.deepEqual(own(db,'asaasConnections',tenant),[]);assert.deepEqual(own(db,'automationConnections',tenant),[]);assert.deepEqual(own(db,'pushSubscriptions',tenant),[]);
 const view=fullDemoView(db,identity,manager,now);assert.equal(view.demo,true);assert.equal(view.sourceTenant,'chandra');assert.ok(view.modules.length>=20);assert.ok(view.modules.filter(m=>!['payments','automation'].includes(m.key)).every(m=>m.count>0),'Todos os módulos locais devem ter exemplos');assert.deepEqual(view.modules.filter(m=>['payments','automation'].includes(m.key)).map(m=>m.status),['simulation','simulation']);
 assert.deepEqual(view.counts,result.counts);assert.ok(!JSON.stringify(view).includes('existing-mfa-secret'));assert.ok(!JSON.stringify(view).includes('existing-token'));
});

test('identidades fictícias têm vínculos coerentes e permanecem separadas da identidade administrativa real',()=>{
 const db=database(),{tenantId}=populate(db),identity=realIdentity(db),manager=demoMembership(db,identity,tenantId),view=fullDemoView(db,identity,manager,now),people=usersInTenant(db.users,tenantId),samples=people.filter(p=>p.demoIdentity);
 assert.equal(samples.filter(p=>p.role==='proprietario').length,14);assert.equal(samples.filter(p=>p.role==='ocupante').length,2);assert.equal(samples.filter(p=>p.role==='temporario').length,2);
 for(const p of samples){assert.equal(p.tenant,tenantId);assert.equal(p.demoPack,FULL_DEMO_PACK);assert.match(p.email,/@example\.invalid$/);assert.match(p.salt,/^[a-f0-9]{32}$/);assert.match(p.hash,/^[a-f0-9]{128}$/);assert.equal(p.mfa,undefined);assert.equal(p.pendingMfa,undefined);assert.equal(p.reset,undefined);assert.equal(validBinding(db.state,p,now),true);assert.equal(demoProfile(db,identity,tenantId,p.id,now).id,p.id);assert.ok(view.profiles.some(v=>v.id===p.id));}
 assert.ok(!view.profiles.some(p=>p.id===identity.id));assert.equal(demoSource(db,identity,tenantId).tenant,'chandra');
 for(const p of samples.filter(p=>['ocupante','temporario'].includes(p.role))){assert.equal(p.houses.length,1);const record=own(db,p.role==='ocupante'?'residents':'stays',tenantId).find(r=>r.id===(p.residentId||p.stayId));assert.ok(record);assert.equal(p.houses[0],record.houseId);assert.ok(p.validUntil);}
 assert.throws(()=>demoProfile(db,identity,tenantId,live.id,now),/fora da demonstração/);assert.throws(()=>demoMembership(db,identity,'chandra'),/fora do seu acesso/);assert.throws(()=>demoMembership(db,{...identity,id:'another-owner'},tenantId),/fora do seu acesso/);
 assert.equal(db.invites.length,0);assert.equal(new Set(db.users.map(p=>p.email)).size,db.users.length);
});

test('financeiro fictício tem saldos coerentes, situações variadas e exemplos de orçamento, acordo, encargos e conciliação',()=>{
 const db=database(),{tenantId}=populate(db),user=demoMembership(db,realIdentity(db),tenantId),s=db.state,finance=financeView(s,user,now);
 for(const key of ['financialFunds','financialAccounts','financialEntries','financialPayables','financialReceivables','financialBudgets','financialAssessments','financialRecurringTemplates','financialAgreements','financialStatements','financialClosures','financialFeeRules','financialFeeAccruals','financialManualRequests','financialCollectionCases','financialReminders','financialPayerLinks','financialCollectionHolds'])assert.ok(own(db,key,tenantId).length>0,'Coleção financeira deve estar preenchida: '+key);
 assert.equal(finance.totalCents,finance.accounts.reduce((sum,a)=>sum+a.balanceCents,0));assert.equal(finance.totalCents,finance.funds.reduce((sum,f)=>sum+f.balanceCents,0));assert.equal(finance.totalCents,balance(s,tenantId));assert.ok(finance.totalCents>0);
 const transactions=ledger(s,tenantId);for(const entry of transactions)for(const posting of entry.postings){assert.ok(finance.accounts.some(a=>a.id===posting.accountId));assert.ok(finance.funds.some(f=>f.id===posting.fundId));assert.ok(Number.isSafeInteger(posting.amountCents));}
 for(const account of finance.accounts)assert.ok(account.balanceCents>=0);
 assert.ok(finance.receivables.some(r=>r.status==='open'));assert.ok(finance.receivables.some(r=>r.status==='partial'));assert.ok(finance.receivables.some(r=>r.status==='received'));assert.ok(finance.payables.some(p=>p.status==='open'));assert.ok(finance.payables.some(p=>p.status==='partial'));assert.ok(finance.payables.some(p=>p.status==='paid'));
 assert.ok(finance.agreements.some(a=>a.status==='active'));assert.ok(finance.statements.some(s=>s.rows.length>0));assert.ok(finance.closures.some(c=>c.status==='closed'));assert.ok(own(db,'financialManualRequests',tenantId).every(r=>!r.instructions||/DEMONSTRAÇÃO/.test(r.instructions)));
});

test('reabrir a demonstração preserva alterações, não cria duplicatas e recusa prévia antiga',()=>{
 const db=database(),preview=previewFullDemo(db,live),first=createFullDemo(db,live,{fingerprint:preview.fingerprint},now);
 assert.throws(()=>createFullDemo(db,live,{fingerprint:preview.fingerprint},now),e=>e.status===409);
 const sample=own(db,'tasks',first.tenantId)[0];sample.title='Demonstração editada durante exploração';const before=JSON.stringify(db),nextPreview=previewFullDemo(db,effectiveBinding(db,realIdentity(db),'chandra'));
 assert.equal(nextPreview.exists,true);assert.equal(nextPreview.tenantId,first.tenantId);const result=createFullDemo(db,effectiveBinding(db,realIdentity(db),'chandra'),{fingerprint:nextPreview.fingerprint},now+3600000);
 assert.equal(result.created,false);assert.equal(result.tenantId,first.tenantId);assert.equal(JSON.stringify(db),before);assert.equal(own(db,'tasks',first.tenantId)[0].title,'Demonstração editada durante exploração');
 assert.throws(()=>previewFullDemo(db,demoMembership(db,realIdentity(db),first.tenantId)),/já está na demonstração/);
});

test('criação é transacional, exige síndico real e mantém conjuntos isolados entre origens',()=>{
 const db=database(),before=JSON.stringify(db);assert.throws(()=>createFullDemo(db,live,{fingerprint:'outdated'},now),e=>e.status===409);assert.equal(JSON.stringify(db),before);
 assert.throws(()=>previewFullDemo(db,{...live,role:'proprietario',houses:['c01']}),/conta de síndico/);assert.throws(()=>previewFullDemo(db,{...live,id:'unknown'}),/conta de síndico/);
 const first=populate(db),firstState=sourceState(db,first.tenantId),identity=realIdentity(db);
 db.state.tenants.push({id:'second-source',tenant:'second-source',name:'Outra origem real',status:'pilot',version:1,limits:{users:100,units:500},features:null});identity.memberships.push({id:identity.id,name:identity.name,email:identity.email,tenant:'second-source',role:'sindico',houses:[],active:true,validUntil:null,delegations:[],accessVersion:0});
 const secondUser=effectiveBinding(db,identity,'second-source'),second=populate(db,secondUser);assert.notEqual(first.tenantId,second.tenantId);assert.equal(sourceState(db,first.tenantId),firstState);assert.equal(own(db,'houses',second.tenantId).length,14);assert.equal(own(db,'residents',second.tenantId).length,16);
 const aUsers=db.users.filter(p=>p.demoIdentity&&p.tenant===first.tenantId),bUsers=db.users.filter(p=>p.demoIdentity&&p.tenant===second.tenantId);assert.ok(aUsers.every(a=>bUsers.every(b=>a.id!==b.id&&a.email!==b.email)));
 assert.throws(()=>demoProfile(db,realIdentity(db),first.tenantId,bUsers[0].id,now),/fora da demonstração/);
 const fake=aUsers.find(p=>p.role==='sindico');assert.throws(()=>previewFullDemo(db,fake),/conta de síndico/);assert.equal(own(db,'residents','chandra').length,0);
});

test('demonstração não consome uma das cinco implantações reais permitidas à identidade',()=>{
 const db=database(),input=n=>({name:'Condomínio real de teste '+n,municipality:'Arraial do Cabo',state:'RJ',reason:'Implantação de contexto real sintético para conferir a cota.'});
 for(let n=2;n<=4;n++)createTenant(db,effectiveBinding(db,realIdentity(db),'chandra'),input(n),now);
 const demo=populate(db),demoState=sourceState(db,demo.tenantId),identity=realIdentity(db);
 assert.equal([identity,...identity.memberships].filter(b=>b.role==='sindico').length,5);
 const fifth=createTenant(db,effectiveBinding(db,identity,'chandra'),input(5),now);assert.ok(fifth.tenant.id);assert.equal(sourceState(db,demo.tenantId),demoState);
 assert.equal(db.state.tenants.filter(t=>!t.demoMode).length,5);assert.equal(db.state.tenants.filter(t=>t.demoMode).length,1);
 const before=JSON.stringify(db);assert.throws(()=>createTenant(db,effectiveBinding(db,realIdentity(db),'chandra'),input(6),now),/cinco implantações/);assert.equal(JSON.stringify(db),before);
});

test('API cria, troca perfis fictícios e volta ao condomínio original sem novos logins; fotos privadas persistem após reinício',async()=>{
 const f=await fixture();try{
  const request=(route,data,cookie=f.admin.cookie)=>f.request(route,data,cookie),before=(await request('/state')).body.state;
  const outsider=await f.invite('proprietario',{houses:['c01']}),preview=await request('/demo/preview');assert.equal(preview.status,200,JSON.stringify(preview.body));
  assert.equal((await request('/demo/create',{fingerprint:preview.body.fingerprint},outsider.cookie)).status,403);
  const created=await request('/demo/create',{fingerprint:preview.body.fingerprint});assert.equal(created.status,200,JSON.stringify(created.body));const tenantId=created.body.tenantId;
  assert.equal((await request('/demo/enter',{tenantId},outsider.cookie)).status,403);const entered=await request('/demo/enter',{tenantId});assert.equal(entered.status,200,JSON.stringify(entered.body));assert.equal(entered.body.user.demoMode,true);let cookie=entered.cookie;
  let current=await request('/state',undefined,cookie);assert.equal(current.body.state.tenant.demoMode,true);assert.equal(current.body.state.houses.length,14);assert.equal(current.body.state.residents.length,16);assert.ok(current.body.state.tour.visual);assert.ok(current.body.state.finance.totalCents>0);
  const panel=await request('/demo',undefined,cookie);assert.equal(panel.status,200);const worker=panel.body.profiles.find(p=>p.role==='zelador'),owner=panel.body.profiles.find(p=>p.role==='proprietario');assert.ok(worker&&owner);
  const actor=await request('/demo/profile',{userId:worker.id},cookie);assert.equal(actor.status,200,JSON.stringify(actor.body));cookie=actor.cookie;assert.equal(actor.body.user.demoIdentity,true);assert.equal(actor.body.user.role,'zelador');
  current=await request('/state',undefined,cookie);assert.equal(current.body.user.id,worker.id);assert.equal(current.body.state.finance,null);assert.ok(current.body.state.tasks.length>0);assert.ok(current.body.state.tasks.every(t=>t.assigneeId===worker.id));
  assert.equal((await request('/admin/invites',{role:'proprietario',email:'no-real-invite@example.invalid',houses:['c01']},cookie)).status,409);
  assert.equal((await request('/password',{currentPassword:f.password,password:'Outro-login-inexistente-2026'},cookie)).status,409);
  assert.equal((await request('/demo/profile',{userId:f.admin.body.user.id},cookie)).status,403);
  const exited=await request('/demo/exit',{},cookie);assert.equal(exited.status,200,JSON.stringify(exited.body));cookie=exited.cookie;assert.equal(exited.body.user.id,f.admin.body.user.id);assert.equal(exited.body.user.tenant,'chandra');assert.equal(exited.body.user.demoMode,false);
  current=await request('/state',undefined,cookie);assert.deepEqual(current.body.state.houses,before.houses);assert.deepEqual(current.body.state.stays,before.stays);assert.deepEqual(current.body.state.tasks,before.tasks);assert.deepEqual(current.body.state.finance,before.finance);
  const repeated=await request('/demo/preview',undefined,cookie);assert.equal(repeated.body.exists,true);const reopening=await request('/demo/create',{fingerprint:repeated.body.fingerprint},cookie);assert.equal(reopening.body.created,false);assert.equal(reopening.body.tenantId,tenantId);
  const store=await fs.readFile(path.join(f.directory,'store.json'),'utf8'),avatar=(await fs.readFile(new URL('../demo-avatar.png',import.meta.url))).toString('base64');assert.ok(!store.includes(avatar),'Retratos privados não são armazenados em base64 no documento JSON.');
  const db=JSON.parse(store),sample=db.users.find(p=>p.demoIdentity&&p.tenant===tenantId);assert.ok(sample);assert.equal((await request('/login',{email:sample.email,password:f.password})).status,401);
  await f.restart();const login=await request('/login',{email:'admin@example.test',password:f.password});assert.equal(login.status,200);const again=await request('/demo/enter',{tenantId},login.cookie);assert.equal(again.status,200);current=await request('/state',undefined,again.cookie);const resident=current.body.state.residents.find(r=>r.kind==='owner');assert.equal(resident.photo,true);assert.equal(current.body.state.residents.length,16);
  const image=await fetch(f.origin+'/api/residents/photo?id='+resident.id+'&version='+resident.version,{headers:{Cookie:again.cookie}});assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'no-store');assert.ok((await image.arrayBuffer()).byteLength>100);
  assert.equal((await request('/demo/profile',{userId:owner.id},again.cookie)).status,200);
 }finally{await f.close();}
});
