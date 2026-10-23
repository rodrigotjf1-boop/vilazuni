import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,actor,createStay,changeStay,visibleStays,scopedStays,scopedHouses,readStayPhoto} from '../domain.mjs';
import {houseHousehold} from '../household.mjs';
import {grantCaretakerContacts,revokeCaretakerContacts} from '../household-access.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00');
const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2gHkAAAAASUVORK5CYII=';
const input={houseId:'c01',responsible:'Hóspede Sintético',people:['Hóspede Sintético'],vehicles:['TESTE-01'],source:'Direta',start:'2026-10-20T15:00',end:'2026-10-27T11:00',rentalKind:'daily',contact:'Contato reservado',phone:'55 22 99999-0000',whatsapp:'55 22 99999-0001',email:'hospede@example.invalid',photo:portrait};
const caretaker={id:'zelador',name:'Zelador Teste',role:'zelador',tenant:'chandra',active:true};
const syndic={...actor(),id:'sindico'};
const owner={...actor('proprietario'),id:'proprietario'};

test('estadia distingue diária e temporada, valida contatos e guarda foto fora da projeção',()=>{
 const s=seed();const {stay}=createStay(s,owner,input,now);assert.equal(stay.rentalKind,'daily');assert.equal(stay.phone,'5522999990000');assert.equal(stay.whatsapp,'5522999990001');assert.equal(stay.photo.mime,'image/png');
 const view=visibleStays(s,syndic,now).find(x=>x.id===stay.id);assert.equal(view.contactsVisible,true);assert.equal(view.photo,true);assert.ok(!JSON.stringify(view).includes(portrait.split(',')[1]));assert.equal(readStayPhoto(s,owner,stay.id,1,now).mime,'image/png');
 assert.equal(createStay(s,owner,{...input,rentalKind:'seasonal',photo:null},now).stay.rentalKind,'seasonal');
 for(const extra of [{rentalKind:'annual'},{phone:'x'},{email:'invalido'},{photo:'data:image/png;base64,bm90YW5pbWFnZQ=='}])assert.throws(()=>createStay(s,owner,{...input,...extra},now));
 assert.throws(()=>readStayPhoto(s,owner,stay.id,2,now),/indisponível/);
});

test('somente síndico e proprietário da casa consultam contatos/fotos de hóspedes sem autorização adicional',()=>{
 const s=seed();const {stay}=createStay(s,owner,input,now);
 const roles=[{...actor('imobiliaria'),houses:['c01']},{...actor('subsindico'),delegations:['stays']},{...actor('administradora'),delegations:['stays','residents']},actor('portaria')];
 for(const u of roles){const view=visibleStays(s,u,now).find(x=>x.id===stay.id);assert.ok(view);assert.equal(view.contactsVisible,false);assert.equal(view.photo,false);for(const field of ['contact','phone','whatsapp','email','history'])assert.equal(field in view,false);assert.throws(()=>readStayPhoto(s,u,stay.id,1,now),/indisponível/);}
 for(const u of [{...owner,houses:['c02']},caretaker,actor('temporario'),{...syndic,tenant:'outro'}]){assert.equal(visibleStays(s,u,now).some(x=>x.id===stay.id),false);assert.throws(()=>readStayPhoto(s,u,stay.id,1,now));}
 assert.equal(visibleStays(s,owner,now).find(x=>x.id===stay.id).email,input.email);
});

test('autorização da zeladoria limita casas e expira no dia de Brasília; revogação bloqueia foto imediatamente sem permitir decisões',()=>{
 const s=seed();const {stay}=createStay(s,owner,input,now);const second=createStay(s,syndic,{...input,houseId:'c03'},now).stay;
 const {grant}=grantCaretakerContacts(s,[caretaker],owner,{houseId:'c01',userId:caretaker.id,expiresOn:'2026-10-19',reason:'Acompanhar chegada autorizada'},now);
 assert.deepEqual(scopedHouses(s,caretaker,now).map(x=>x.id),['c01']);assert.equal(visibleStays(s,caretaker,now).some(x=>x.id===second.id),false);assert.equal(visibleStays(s,caretaker,now).find(x=>x.id===stay.id).phone,'5522999990000');assert.equal(readStayPhoto(s,caretaker,stay.id,1,now).mime,'image/png');
 assert.throws(()=>createStay(s,caretaker,input,now),/permissão/);assert.throws(()=>changeStay(s,caretaker,stay.id,'approved','Conferido',now),/gestão/);assert.throws(()=>changeStay(s,caretaker,stay.id,'cancelled','Conferido',now),/permissão/);
 assert.deepEqual(visibleStays(s,caretaker,Date.parse('2026-10-20T00:00:00-03:00')),[]);
 revokeCaretakerContacts(s,owner,{id:grant.id,reason:'Conferência finalizada'},now);assert.deepEqual(visibleStays(s,caretaker,now),[]);assert.throws(()=>readStayPhoto(s,caretaker,stay.id,1,now),/indisponível/);
});

test('projeção de estadias não altera o registro usado para decisão',()=>{
 const s=seed();const {stay}=createStay(s,owner,input,now);const manager={...actor('administradora'),delegations:['stays']};
 assert.equal(visibleStays(s,manager,now).find(x=>x.id===stay.id).contact,undefined);changeStay(s,manager,stay.id,'approved','Período conferido',now);assert.equal(stay.status,'approved');assert.equal(scopedStays(s,manager,now).find(x=>x.id===stay.id).contact,input.contact);
});


test('foto da ocupação segue permissão residencial mesmo com módulo de estadias desativado',()=>{
 const s=seed(),{stay}=createStay(s,owner,input,now),residentialSyndic={...syndic,enabledModules:['residents']};changeStay(s,syndic,stay.id,'approved','Período sintético conferido',now);
 const current=Date.parse('2026-10-20T16:00:00-03:00'),overview=houseHousehold(s,residentialSyndic,'c01',current);
 assert.equal(visibleStays(s,residentialSyndic,current).length,0);assert.equal(overview.occupancy.stays[0].photo,true);assert.equal(readStayPhoto(s,residentialSyndic,stay.id,1,current).mime,'image/png');
 assert.throws(()=>readStayPhoto(s,{...syndic,enabledModules:[]},stay.id,1,current),/indisponível/);
 assert.throws(()=>readStayPhoto(s,{...actor('administradora'),delegations:['residents'],enabledModules:['residents']},stay.id,1,current),/indisponível/);
});
