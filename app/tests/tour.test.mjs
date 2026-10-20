import {test} from 'node:test';import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';import {createFacility,toggleFacility} from '../facilities.mjs';import {tourView,tourPlace,linkTourFacility} from '../tour.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'chandra',role:'sindico'},owner={id:'p',name:'Proprietário',tenant:'chandra',role:'proprietario',houses:['c01']};
function facility(s,u=root,name='Piscina teste'){return createFacility(s,u,{name,rules:'Regras sintéticas, mediante aprovação',opens:'08:00',closes:'20:00',capacity:10,maxHours:2},now);}
const link=(s,f,patch={})=>linkTourFacility(s,root,{pointId:'pool',facilityId:f.id,version:0,reason:'Local conferido',...patch},now);

test('passeio separa exterior, ficha e ações sem retornar nomes, contatos ou estadias privadas',()=>{
 const s=seed(),mine=tourPlace(s,owner,'c01'),other=tourPlace(s,owner,'c02');assert.equal(mine.access,'allowed');assert.equal(mine.interior,true);assert.ok(mine.actions.some(a=>a.page==='stays'&&a.id==='c01'));assert.equal(other.access,'exterior');assert.equal(other.structure,null);assert.equal(other.houseId,null);assert.deepEqual(other.actions,[]);assert.equal(other.interior,false);assert.ok(!JSON.stringify(tourView(s,owner)).includes('Ana Demo'));assert.ok(!JSON.stringify(tourView(s,owner)).includes('Marina Exemplo'));assert.ok(!JSON.stringify(tourView(s,owner)).includes('DEMO-03'));
});
test('portaria recebe somente características operacionais e ocupante não recebe fichas pessoais/estadias',()=>{
 const s=seed(),gate={...owner,role:'portaria',houses:[]},p=tourPlace(s,gate,'c01');assert.equal(p.interior,false);assert.equal(p.structure.parking,2);assert.equal(p.structure.rooms,undefined);assert.equal(p.structure.floors,undefined);assert.ok(p.actions.some(a=>a.page==='access'&&a.id==='c01'));assert.ok(!p.actions.some(a=>['residents','stays','new'].includes(a.page)));
 const occupant=tourPlace(s,{...owner,role:'ocupante'},'c01');assert.equal(occupant.interior,true);assert.ok(occupant.actions.some(a=>a.page==='myCharges'));assert.ok(!occupant.actions.some(a=>['residents','stays','new'].includes(a.page)));
});
test('delegação de um módulo não abre outros e zeladoria não recebe ficha residencial pelo cenário',()=>{
 const s=seed(),facilityManager={...root,role:'subsindico',delegations:['facilities']},staysManager={...root,role:'subsindico',delegations:['stays']};assert.equal(tourPlace(s,facilityManager,'c01').access,'exterior');const p=tourPlace(s,staysManager,'c01');assert.ok(p.actions.some(a=>a.page==='stays'));assert.ok(!p.actions.some(a=>a.page==='residents'));assert.equal(tourPlace(s,{...owner,role:'zelador'},'c01').structure,null);assert.equal(tourView(s,facilityManager).canLink,true);assert.equal(tourView(s,staysManager).canLink,false);
});
test('nome semelhante não vincula dependência; vínculo explícito passa a mostrar regra e interdição atuais',()=>{
 const s=seed(),f=facility(s);assert.equal(tourPlace(s,owner,'pool').facility,null);assert.ok(tourView(s,owner).places.some(p=>p.id==='facility:'+f.id&&p.sceneId===null));link(s,f);let p=tourPlace(s,owner,'pool');assert.equal(p.facility.id,f.id);assert.equal(p.active,true);assert.equal(p.linkHistory,undefined);assert.equal(tourView(s,owner).places.some(p=>p.id==='facility:'+f.id),false);
 toggleFacility(s,root,{id:f.id,version:0,active:false,reason:'Manutenção sintética'},now);p=tourPlace(s,owner,'pool');assert.equal(p.active,false);assert.equal(p.status,'Interditada');assert.equal(p.actions[0].id,f.id);const portaria=tourPlace(s,{...owner,role:'portaria'},'pool');assert.equal(portaria.facility,null);assert.equal(portaria.active,null);assert.equal(tourPlace(s,root,'pool').linkHistory.length,1);
});
test('vínculos exigem versão, escopo e exclusividade e conservam histórico após remoção/substituição',()=>{
 const s=seed(),f=facility(s),g=facility(s,root,'Outra dependência'),r=link(s,f),before=structuredClone(s);assert.throws(()=>link(s,g),/mudou/);assert.throws(()=>link(s,f,{pointId:'party'}),/outro marcador/);assert.throws(()=>link(s,f,{pointId:'c01'}),/marcador/);assert.throws(()=>linkTourFacility(s,owner,{pointId:'pool',version:1,facilityId:g.id,reason:'Teste'},now),/gestão/);assert.deepEqual(s,before);
 link(s,g,{version:r.version});assert.equal(tourPlace(s,owner,'pool').facility.id,g.id);link(s,g,{version:2,facilityId:null});assert.equal(tourPlace(s,owner,'pool').facility,null);assert.equal(tourPlace(s,root,'pool').linkHistory.length,3);assert.equal(tourView(s,owner).places.filter(p=>p.id.startsWith('facility:')).length,2);
});
test('outro condomínio não recebe cenário/dados/vínculos do Chandra, mesmo com IDs de casas iguais',()=>{
 const s=seed(),f=facility(s),other={...root,tenant:'b'};link(s,f);s.houses.push({...s.houses[0],tenant:'b'});const g=facility(s,other,'Espaço isolado');const view=tourView(s,other);assert.equal(view.visual,null);assert.equal(view.canLink,false);assert.equal(view.places.length,2);assert.ok(view.places.some(p=>p.id==='house:c01'));assert.ok(view.places.some(p=>p.id==='facility:'+g.id));assert.throws(()=>tourPlace(s,other,'pool'),/indisponível/);assert.throws(()=>tourPlace(s,other,'facility:'+f.id),/indisponível/);assert.throws(()=>link(s,g,{version:1}),/condomínio/);
});
