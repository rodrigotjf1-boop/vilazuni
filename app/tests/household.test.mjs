import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,actor} from '../domain.mjs';
import {createResident,updateResident,visibleResidents,readResidentPhoto} from '../residents.mjs';
import {canViewTenantContacts,authorizedCaretakerHouses,caregiverContactGrants,grantCaretakerContacts,revokeCaretakerContacts} from '../household-access.mjs';
import {houseHousehold} from '../household.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),photo='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
const syndic={...actor(),id:'syndic'},owner={...actor('proprietario'),id:'owner'},caretaker={...actor('zelador'),id:'caretaker',active:true},delegate={...actor('administradora'),id:'delegate',delegations:['residents','stays']};
const input={houseId:'c01',kind:'annual',name:'Inquilina Exemplo',contact:'Contato privado reservado',phone:'5521999990001',whatsapp:'5521999990002',email:'inquilina@example.test',people:['Inquilina Exemplo'],vehicles:['ABC1D23'],startDate:'2026-10-01',contractEndDate:'2027-09-30',photo};
function setup(){const state=seed(),resident=createResident(state,syndic,input,now).record;return {state,resident};}
test('contatos e foto de inquilinos pertencem ao síndico e proprietário da unidade; delegação operacional não amplia esse acesso',()=>{
 const {state,resident}=setup();updateResident(state,owner,{...input,id:resident.id,contact:'Contato privado atualizado',reason:'Atualização do contato'},now);
 for(const u of [syndic,owner]){const view=visibleResidents(state,u,now)[0];assert.equal(view.phone,input.phone);assert.equal(view.whatsapp,input.whatsapp);assert.equal(view.photo,true);assert.equal(view.contactsVisible,true);assert.ok(readResidentPhoto(state,u,resident.id,resident.version,now).bytes.length);}
 for(const u of [delegate,{...actor('imobiliaria'),houses:['c01']}]){
  const view=visibleResidents(state,u,now)[0];assert.equal(view.contactsVisible,false);assert.equal(view.photo,false);for(const key of ['contact','phone','whatsapp','email'])assert.equal(Object.hasOwn(view,key),false);
  assert.equal(JSON.stringify(view).includes('Contato privado'),false);assert.equal(JSON.stringify(view).includes(input.phone),false);assert.equal(JSON.stringify(view).includes(input.email),false);assert.throws(()=>readResidentPhoto(state,u,resident.id,resident.version,now),/indisponível/);
 }
 const occupant={...actor('ocupante'),houses:['c01'],residentId:resident.id};assert.deepEqual(visibleResidents(state,occupant,now),[]);assert.equal(JSON.stringify(houseHousehold(state,occupant,'c01',now)).includes(input.phone),false);
 assert.deepEqual(visibleResidents(state,{...owner,houses:['c02']},now),[]);assert.throws(()=>readResidentPhoto(state,{...owner,houses:['c02']},resident.id,resident.version,now),/indisponível/);
 assert.equal(JSON.stringify(state.residents[0].history).includes(photo.split(',')[1]),false);
});
test('autorização da zeladoria vale somente para pessoa, unidade, condomínio e período concedidos; revogação é imediata',()=>{
 const {state,resident}=setup(),users=[caretaker,{...caretaker,id:'other',name:'Outro zelador'},{...caretaker,id:'foreign',tenant:'outro'}];
 assert.equal(canViewTenantContacts(state,caretaker,'c01',now),false);assert.deepEqual(visibleResidents(state,caretaker,now),[]);
 assert.throws(()=>grantCaretakerContacts(state,users,{...owner,houses:['c02']},{houseId:'c01',userId:caretaker.id,expiresOn:'2026-10-20',reason:'Atender morador'},now),/Somente/);
 assert.throws(()=>grantCaretakerContacts(state,users,owner,{houseId:'c01',userId:'foreign',expiresOn:'2026-10-20',reason:'Atender morador'},now),/ativo/);
 const {grant}=grantCaretakerContacts(state,users,owner,{houseId:'c01',userId:caretaker.id,expiresOn:'2026-10-20',reason:'Atendimento autorizado pelo proprietário'},now);
 assert.deepEqual(authorizedCaretakerHouses(state,caretaker,now),['c01']);assert.equal(visibleResidents(state,caretaker,now)[0].phone,input.phone);assert.ok(readResidentPhoto(state,caretaker,resident.id,1,now));
 assert.equal(canViewTenantContacts(state,users[1],'c01',now),false);assert.equal(canViewTenantContacts(state,caretaker,'c02',now),false);assert.equal(canViewTenantContacts(state,{...caretaker,tenant:'outro'},'c01',now),false);
 assert.equal(canViewTenantContacts(state,caretaker,'c01',Date.parse('2026-10-21T00:00:00-03:00')),false);
 assert.equal(caregiverContactGrants(state,users,owner,'c01',now).caretakers.length,2);assert.equal(caregiverContactGrants(state,users,caretaker,'c01',now).caretakers.length,0);
 revokeCaretakerContacts(state,syndic,{id:grant.id,reason:'Atendimento concluído'},now);
 assert.equal(canViewTenantContacts(state,caretaker,'c01',now),false);assert.throws(()=>readResidentPhoto(state,caretaker,resident.id,1,now),/indisponível/);assert.deepEqual(visibleResidents(state,caretaker,now),[]);
});
test('clientes com dados redigidos preservam contatos privados e não podem substituir nem apagar a foto',()=>{
 const {state,resident}=setup(),view=visibleResidents(state,delegate,now)[0];
 updateResident(state,delegate,{...view,people:[input.name,'Outra pessoa'],contact:'',phone:'',whatsapp:'',email:'',photo:false,reason:'Atualizar relação de moradores'},now);
 assert.equal(resident.contact,input.contact);assert.equal(resident.phone,input.phone);assert.equal(resident.photo.data,photo.split(',')[1]);assert.equal(resident.version,2);
 assert.throws(()=>updateResident(state,delegate,{...view,version:resident.version,phone:'5521999997777',reason:'Alterar telefone privado'},now),/só podem/);
 assert.throws(()=>readResidentPhoto(state,owner,resident.id,1,now),/indisponível/);assert.ok(readResidentPhoto(state,owner,resident.id,2,now));
 updateResident(state,owner,{...input,id:resident.id,photo:true,reason:'Preservar foto de identificação'},now);assert.ok(resident.photo.data);assert.throws(()=>updateResident(state,owner,{...input,id:resident.id,version:1,reason:'Versão antiga'},now),/cadastro mudou/);
});
test('ficha destaca propriedade, modalidade, contrato vigente e placas sem inferir ocupações futuras ou modalidade de estadia antiga',()=>{
 const {state}=setup();createResident(state,syndic,{houseId:'c01',kind:'owner',name:'Proprietária Exemplo',phone:'5521999991111',whatsapp:'5521999992222',contact:'proprietaria@example.test',ownerOccupancy:'rented',startDate:'2020-01-01',vehicles:['OWN1A23']},now);
 const view=houseHousehold(state,syndic,'c01',now);assert.equal(view.owners[0].name,'Proprietária Exemplo');assert.equal(view.owners[0].ownerOccupancy,'rented');assert.equal(view.owners[0].whatsapp,'5521999992222');assert.deepEqual(view.owners[0].vehicles,['OWN1A23']);assert.equal(view.occupancy.kind,'annual');assert.equal(view.occupancy.startDate,'2026-10-01');assert.equal(view.occupancy.endDate,'2027-09-30');assert.deepEqual(view.occupancy.vehicles,['ABC1D23']);
 const other=houseHousehold(state,delegate,'c01',now);assert.equal(JSON.stringify(other).includes(input.phone),false);assert.equal(other.contactsRestricted,true);assert.equal(houseHousehold(state,{...owner,houses:['c02']},'c01',now),null);assert.equal(houseHousehold(state,actor('portaria'),'c01',now),null);
 assert.equal(houseHousehold(state,syndic,'c03',now).occupancy.kind,'unspecified');assert.match(houseHousehold(state,syndic,'c03',now).occupancy.label,/modalidade não informada/);
 state.stays[0].rentalKind='daily';assert.equal(houseHousehold(state,syndic,'c03',now).occupancy.kind,'daily');
 state.residents[0].startDate='2026-11-01';assert.equal(houseHousehold(state,syndic,'c01',now).occupancy.kind,'unspecified');
 state.residents[0].startDate='2026-10-01';state.residents[0].contractEndDate='2026-10-18';assert.equal(houseHousehold(state,syndic,'c01',now).occupancy.kind,'unspecified');assert.equal(houseHousehold(state,syndic,'c01',now).alerts.length,1);
});
