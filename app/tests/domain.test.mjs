import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,actor,scopedHouses,scopedStays,createStay,changeStay,authorizationStatus,dateBRLocal,changeTask} from '../domain.mjs';
const now=Date.parse('2026-10-17T12:00:00-03:00');
const input={houseId:'c01',responsible:'Ana Teste',contact:'Contato fictício',people:['Ana Teste','Outro Teste'],vehicles:[],source:'Direta',start:'2026-10-25T15:00',end:'2026-10-27T11:00'};
test('escopo não mistura condomínios nem casas de outros proprietários',()=>{
 const s=seed(),u=actor('proprietario');s.houses.push({...s.houses[0],id:'outro',tenant:'outro'});s.stays.push({...s.stays[0],id:'externa',tenant:'outro',houseId:'c01'});
 assert.deepEqual(scopedHouses(s,u).map(h=>h.id),['c01','c02']);assert.equal(scopedStays(s,u).length,1);assert.equal(scopedHouses(s,{...u,tenant:'inexistente'}).length,0);
 assert.throws(()=>createStay(s,u,{...input,houseId:'c03'},now),/permissão/);
});
test('cadastro exige período válido e responsável presente e mantém total nominal',()=>{
 const s=seed(),u=actor('proprietario');
 assert.throws(()=>createStay(s,u,{...input,end:input.start},now),/posterior/);
 assert.throws(()=>createStay(s,u,{...input,people:['Outra Pessoa']},now),/responsável/);
 const {stay}=createStay(s,u,{...input,people:['Ana Teste','Ana Teste']},now);assert.equal(stay.people.length,1);assert.equal(stay.status,'pending');assert.equal(s.audit.length,1);
});
test('datas inválidas e ano bissexto são conferidos',()=>{
 assert.throws(()=>dateBRLocal('2026-02-30T12:00'),/inválida/);assert.throws(()=>dateBRLocal('2026-01-01T25:00'),/inválida/);assert.equal(dateBRLocal('2028-02-29T12:00'),'2028-02-29T12:00:00-03:00');
});
test('autorização é válida em intervalo fechado no início e aberto no fim',()=>{
 const e=seed().stays[0];assert.equal(authorizationStatus(e,Date.parse(e.start)-1),'Agendada');assert.equal(authorizationStatus(e,Date.parse(e.start)),'Vigente');assert.equal(authorizationStatus(e,Date.parse(e.end)),'Expirada');assert.equal(authorizationStatus({...e,status:'cancelled'},Date.parse(e.start)),'Sem autorização');
});
test('aprovação exige gestão e motivo; cancelamento invalida autorização',()=>{
 const s=seed(),u=actor('proprietario');
 assert.throws(()=>changeStay(s,u,'e02','approved','ok',now),/gestão/);assert.throws(()=>changeStay(s,actor(),'e02','approved','',now),/motivo/);
 changeStay(s,actor(),'e02','approved','Conferido',now);changeStay(s,u,'e02','cancelled','Reserva cancelada',now);assert.equal(authorizationStatus(s.stays[1],Date.parse(s.stays[1].start)),'Sem autorização');assert.throws(()=>changeStay(s,actor(),'e02','approved','reabrir',now),/inválida/);
});
test('avisa sobre sobreposição e excesso de veículos, sem garantir vaga',()=>{
 const s=seed();const r=createStay(s,actor('proprietario'),{...input,start:'2026-10-20T15:00',end:'2026-10-22T11:00',vehicles:['DEMO-1','DEMO-2','DEMO-3']},now);assert.equal(r.warnings.length,2);
});
test('portaria não cria estadia nem altera tarefa',()=>{assert.throws(()=>createStay(seed(),actor('portaria'),input,now),/permissão/);assert.throws(()=>changeTask(seed(),actor('portaria'),'t01','done',now),/gestão/);});
