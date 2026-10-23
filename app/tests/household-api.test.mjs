import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';
const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2gHkAAAAASUVORK5CYII=';
const annualContact={contact:'Contato privado contrato 02',phone:'5522999988888',whatsapp:'5522999977777',email:'contrato02@example.invalid'};
const stayContact={contact:'Contato privado temporada 04',phone:'5522999966666',whatsapp:'5522999955555',email:'temporada04@example.invalid'};
const secrets=[...Object.values(annualContact),...Object.values(stayContact),'Contato anterior reservado'];
function noSecrets(value){const text=JSON.stringify(value);for(const secret of secrets)assert.ok(!text.includes(secret),'Contato privado não deve aparecer: '+secret);assert.ok(!text.includes(portrait.split(',')[1]),'Foto privada não deve aparecer em JSON.');}
const picture=(f,route,cookie)=>fetch(f.origin+'/api'+route,{headers:cookie?{Cookie:cookie}:{}});
async function login(f,email){const r=await f.request('/login',{email,password:f.password});assert.equal(r.status,200,JSON.stringify(r.body));return r.cookie;}
async function prepare(f){
 const req=(r,d)=>f.request(r,d,f.admin.cookie),owner=await f.invite('proprietario',{houses:['c02','c04']}),otherOwner=await f.invite('proprietario',{houses:['c03']}),caretaker=await f.invite('zelador');
 const resident={houseId:'c02',kind:'annual',name:'Inquilina Contrato Sintético',startDate:'2026-10-01',contractEndDate:'2027-09-30',people:['Inquilina Contrato Sintético'],vehicles:['SYN2A02'],...annualContact,photo:portrait};
 const created=await req('/residents',{...resident,contact:'Contato anterior reservado'});assert.equal(created.status,200,JSON.stringify(created.body));const id=created.body.id;
 assert.equal((await req('/residents/update',{...resident,id,reason:'Atualização conferida de contatos'})).status,200);
 const record=(await req('/state')).body.state.residents.find(r=>r.id===id);
 const stay=await req('/stays',{houseId:'c04',responsible:'Hóspede Temporada Sintético',people:['Hóspede Temporada Sintético'],vehicles:['SYN4B04'],source:'Direta',start:'2026-10-19T09:00',end:'2026-10-28T11:00',rentalKind:'daily',...stayContact,photo:portrait});
 assert.equal(stay.status,200,JSON.stringify(stay.body));assert.equal(typeof stay.body.stay.photo,'boolean');assert.ok(!JSON.stringify(stay.body).includes(portrait.split(',')[1]));const stayId=stay.body.stay.id;
 assert.equal((await req('/stays/decision',{id:stayId,status:'approved',reason:'Período de hospedagem conferido'})).status,200);
 const ownerRecord=await req('/residents',{houseId:'c02',kind:'owner',name:'Proprietária Sintética',startDate:'2026-01-01',ownerOccupancy:'rented',phone:'5522999944444',whatsapp:'5522999933333',email:'proprietaria@example.invalid',vehicles:['SYN0C02'],photo:portrait});assert.equal(ownerRecord.status,200,JSON.stringify(ownerRecord.body));
 return {req,owner,otherOwner,caretaker,resident,id,record,stayId,ownerId:ownerRecord.body.id};
}

test('fichas, passeio e fotos aplicam a mesma privacidade por proprietário, inquilino e delegação',async()=>{
 const f=await fixture();try{
  const x=await prepare(f),realEstate=await f.invite('imobiliaria',{houses:['c02','c04'],validUntil:'2027-01-01'}),manager=await f.invite('administradora',{delegations:['residents','stays'],delegationReason:'Administração de apoio autorizada',validUntil:'2027-01-01'}),annual=await f.invite('ocupante',{residentId:x.id}),temporary=await f.invite('temporario',{stayId:x.stayId});
  const residentPhoto='/residents/photo?id='+x.id+'&version='+x.record.version,stayPhoto='/stays/photo?id='+x.stayId+'&version=1';
  for(const viewer of [f.admin,x.owner]){
   const state=(await f.request('/state',undefined,viewer.cookie)).body.state;
   assert.equal(state.residents.find(r=>r.id===x.id).phone,annualContact.phone);assert.equal(state.stays.find(s=>s.id===x.stayId).whatsapp,stayContact.whatsapp);
   assert.equal(state.households.c02.occupancy.kind,'annual');assert.equal(state.households.c02.occupancy.endDate,'2027-09-30');assert.deepEqual(state.households.c02.occupancy.vehicles,['SYN2A02']);assert.equal(state.households.c04.occupancy.kind,'daily');
   const place=(await f.request('/tour/place?id=c02',undefined,viewer.cookie)).body.place;assert.equal(place.household.owners[0].name,'Proprietária Sintética');assert.equal(place.household.occupancy.residents[0].email,annualContact.email);
   for(const route of [residentPhoto,stayPhoto]){const r=await picture(f,route,viewer.cookie);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(Buffer.from(await r.arrayBuffer()).length,Buffer.from(portrait.split(',')[1],'base64').length);}
  }
  for(const viewer of [realEstate,manager,x.otherOwner,annual,temporary,x.caretaker]){
   noSecrets((await f.request('/state',undefined,viewer.cookie)).body.state);noSecrets((await f.request('/tour',undefined,viewer.cookie)).body);noSecrets((await f.request('/tour/place?id=c02',undefined,viewer.cookie)).body);
   for(const route of [residentPhoto,stayPhoto])assert.notEqual((await picture(f,route,viewer.cookie)).status,200);
  }
  const redacted=(await f.request('/state',undefined,manager.cookie)).body.state.residents.find(r=>r.id===x.id);assert.equal(redacted.contactsVisible,false);assert.equal(redacted.photo,false);assert.ok(redacted.history.length>0);assert.ok(redacted.history.every(h=>!h.before?.contact&&!h.before?.phone&&!h.before?.whatsapp&&!h.before?.email));
  const annualState=(await f.request('/state',undefined,annual.cookie)).body.state;assert.equal(annualState.households.c02.owners[0].phone,'5522999944444','Contatos do proprietário da própria casa continuam disponíveis.');
  for(const route of [residentPhoto,stayPhoto])assert.equal((await picture(f,route)).status,401);
 }finally{await f.close();}
});

test('autorização nominal da zeladoria expira e revoga imediatamente inclusive a leitura direta de fotos',async()=>{
 const f=await fixture();try{
  const x=await prepare(f),annual=await f.invite('ocupante',{residentId:x.id}),grant={houseId:'c02',userId:x.caretaker.body.user.id,expiresOn:'2026-10-19',reason:'Atendimento autorizado pelo proprietário'};
  assert.equal((await f.request('/profiles/save',{version:0,phone:annualContact.phone,whatsapp:annualContact.whatsapp,photo:portrait},annual.cookie)).status,200);const memberRoute='/profiles/photo?id='+annual.body.user.id+'&version=1';
  assert.equal((await f.request('/residents/contacts?houseId=c02',undefined,x.owner.cookie)).body.canAuthorize,true);assert.equal((await f.request('/residents/contacts?houseId=c02',undefined,x.otherOwner.cookie)).status,403);
  assert.equal((await f.request('/residents/contacts/grant',grant,x.otherOwner.cookie)).status,403);assert.equal((await f.request('/residents/contacts/grant',{...grant,userId:x.otherOwner.body.user.id},x.owner.cookie)).status,400);
  const authorized=await f.request('/residents/contacts/grant',grant,x.owner.cookie);assert.equal(authorized.status,200,JSON.stringify(authorized.body));const route='/residents/photo?id='+x.id+'&version='+x.record.version;
  let state=(await f.request('/state',undefined,x.caretaker.cookie)).body.state;assert.deepEqual(state.houses.map(h=>h.id),['c02']);assert.equal(state.residents.find(r=>r.id===x.id).phone,annualContact.phone);assert.equal((await picture(f,route,x.caretaker.cookie)).status,200);assert.equal((await picture(f,memberRoute,x.caretaker.cookie)).status,200);
  assert.equal((await picture(f,'/stays/photo?id='+x.stayId+'&version=1',x.caretaker.cookie)).status,403,'Grant da casa 02 não alcança a casa 04.');
  const stayGrant=await f.request('/residents/contacts/grant',{...grant,houseId:'c04'},x.owner.cookie);assert.equal(stayGrant.status,200);assert.equal((await picture(f,'/stays/photo?id='+x.stayId+'&version=1',x.caretaker.cookie)).status,200);assert.equal((await f.request('/state',undefined,x.caretaker.cookie)).body.state.stays.find(s=>s.id===x.stayId).phone,stayContact.phone);
  assert.equal((await f.request('/residents/contacts/revoke',{id:stayGrant.body.grant.id,reason:'Conferência da hospedagem concluída'},x.owner.cookie)).status,200);
  assert.equal((await f.request('/residents/contacts/revoke',{id:authorized.body.grant.id,reason:'Atendimento encerrado'},x.otherOwner.cookie)).status,403);assert.equal((await f.request('/residents/contacts/revoke',{id:authorized.body.grant.id,reason:'Atendimento encerrado'},x.owner.cookie)).status,200);
  assert.notEqual((await picture(f,route,x.caretaker.cookie)).status,200);assert.equal((await picture(f,memberRoute,x.caretaker.cookie)).status,403);state=(await f.request('/state',undefined,x.caretaker.cookie)).body.state;noSecrets(state);assert.deepEqual(state.houses,[]);
  assert.equal((await f.request('/residents/contacts/grant',grant,x.owner.cookie)).status,200);f.advance(12*3600000);const caretakerCookie=await login(f,x.caretaker.email);
  assert.notEqual((await picture(f,route,caretakerCookie)).status,200);assert.equal((await picture(f,memberRoute,caretakerCookie)).status,403);state=(await f.request('/state',undefined,caretakerCookie)).body.state;noSecrets(state);assert.deepEqual(state.houses,[]);
  const adminCookie=await login(f,'admin@example.test'),grants=(await f.request('/residents/contacts?houseId=c02',undefined,adminCookie)).body.grants;assert.ok(grants.every(g=>!g.active));
 }finally{await f.close();}
});

test('fotos privadas persistem fora do JSON e os contatos de pagadores inquilinos não vazam pelo financeiro',async()=>{
 const f=await fixture();try{
  const x=await prepare(f),annual=await f.invite('ocupante',{residentId:x.id}),manager=await f.invite('administradora',{delegations:['financeRead','financeClose'],delegationReason:'Consulta e controle financeiro autorizados',validUntil:'2027-01-01'});
  assert.equal((await x.req('/payments/payers/save',{userId:annual.body.user.id,version:0,document:'52998224725',mobilePhone:annualContact.phone})).status,200);
  let payments=(await x.req('/payments')).body;assert.equal(payments.payers.find(p=>p.userId===annual.body.user.id).mobilePhone,annualContact.phone);
  payments=(await f.request('/payments',undefined,manager.cookie)).body;const payer=payments.payers.find(p=>p.userId===annual.body.user.id);assert.equal(payer.contactsVisible,false);assert.ok(!payer.email&&!payer.mobilePhone);assert.ok(!JSON.stringify(payments).includes(annual.email));
  assert.ok(!JSON.stringify((await f.request('/payments/settings',undefined,manager.cookie)).body).includes(annual.email));assert.ok(!JSON.stringify((await f.request('/finance/payers',undefined,manager.cookie)).body).includes(annual.email));
  const state=(await f.request('/state',undefined,manager.cookie)).body.state;noSecrets(state);assert.ok(!JSON.stringify(state.payments).includes(annual.email));
  const raw=await fs.readFile(path.join(f.directory,'store.json'),'utf8');assert.ok(!raw.includes(portrait.split(',')[1]));assert.ok(raw.includes('"blob"'));
  await f.restart();const cookie=await login(f,x.owner.email);assert.equal((await picture(f,'/residents/photo?id='+x.id+'&version='+x.record.version,cookie)).status,200);assert.equal((await picture(f,'/stays/photo?id='+x.stayId+'&version=1',cookie)).status,200);
  const restored=(await f.request('/state',undefined,cookie)).body.state;assert.equal(restored.residents.find(r=>r.id===x.id).photo,true);assert.ok(!JSON.stringify(restored).includes(portrait.split(',')[1]));
 }finally{await f.close();}
});
