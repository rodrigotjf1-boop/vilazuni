import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,actor} from '../domain.mjs';
import {createResident,updateResident,endResident,visibleResidents} from '../residents.mjs';
const now=Date.parse('2026-10-18T15:00:00-03:00');
const owner={houseId:'c01',kind:'owner',name:'Ana Fictícia',contact:'Contato fictício',startDate:'2026-01-01'};
const rental={...owner,kind:'annual',name:'Pessoa Fictícia',people:['Pessoa Fictícia','Outra Fictícia'],vehicles:['demo-01'],plannedEndDate:'2027-01-01'};
test('coproprietários têm vínculos independentes e apenas a gestão altera propriedade',()=>{
 const s=seed();const a=createResident(s,actor(),owner,now).record;const b=createResident(s,actor(),{...owner,name:'Bruno Fictício'},now).record;assert.notEqual(a.id,b.id);assert.equal(visibleResidents(s,actor()).length,2);assert.throws(()=>createResident(s,actor('proprietario'),owner,now),/gestão/);assert.throws(()=>endResident(s,actor('proprietario'),{id:a.id,endedOn:'2026-10-18',reason:'Transferência'},now),/gestão/);assert.throws(()=>createResident(s,actor(),owner,now),/Já existe/);
});
test('locação anual exige titular nominal, datas reais e casa autorizada',()=>{
 const s=seed();assert.throws(()=>createResident(s,actor('proprietario'),{...rental,houseId:'c03'},now),/permissão/);assert.throws(()=>createResident(s,actor(),{...rental,startDate:'2026-02-30'},now),/data/);assert.throws(()=>createResident(s,actor(),{...rental,plannedEndDate:'2025-12-31'},now),/anterior/);assert.throws(()=>createResident(s,actor(),{...rental,people:['Outro Nome']},now),/titular/);const r=createResident(s,actor('proprietario'),rental,now).record;assert.deepEqual(r.vehicles,['DEMO-01']);assert.equal(r.tenant,'chandra');
});
test('atualização preserva versão anterior e não transfere tipo ou casa',()=>{
 const s=seed(),u=actor('proprietario'),r=createResident(s,u,rental,now).record;assert.throws(()=>updateResident(s,u,{...rental,id:r.id,kind:'owner',reason:'Mudança'},now),/transferidos/);assert.throws(()=>updateResident(s,u,{...rental,id:r.id,houseId:'c02',reason:'Mudança'},now),/transferidos/);updateResident(s,u,{...rental,id:r.id,contact:'Novo contato fictício',reason:'Atualização solicitada'},now);assert.equal(r.history[0].before.contact,'Contato fictício');assert.equal(r.contact,'Novo contato fictício');assert.equal(visibleResidents(s,u)[0].history,undefined);
});
test('prazo previsto não encerra vínculo; saída efetiva preserva histórico restrito',()=>{
 const s=seed(),u=actor('proprietario'),r=createResident(s,u,{...rental,plannedEndDate:'2026-10-01'},now).record;assert.equal(visibleResidents(s,u).length,1);assert.throws(()=>endResident(s,u,{id:r.id,endedOn:'2026-10-19',reason:'Saída futura'},now),/saída efetiva/);endResident(s,u,{id:r.id,endedOn:'2026-10-18',reason:'Saída confirmada'},now);assert.equal(visibleResidents(s,u).length,0);assert.equal(visibleResidents(s,actor()).length,1);assert.equal(s.residents.length,1);assert.throws(()=>updateResident(s,u,{...rental,id:r.id,reason:'Reabrir'},now),/encerrado/);
});
test('histórico não atravessa condomínio e não é entregue a portaria ou zeladoria',()=>{
 const s=seed();createResident(s,actor(),rental,now);s.residents.push({...s.residents[0],id:'foreign',tenant:'outro'});assert.equal(visibleResidents(s,actor()).length,1);assert.deepEqual(visibleResidents(s,actor('portaria')),[]);assert.deepEqual(visibleResidents(s,actor('zelador')),[]);assert.throws(()=>endResident(s,actor(),{id:'foreign',endedOn:'2026-10-18',reason:'Indevido'},now),/indisponível/);
});
