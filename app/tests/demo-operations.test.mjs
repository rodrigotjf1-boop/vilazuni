import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {DELEGATIONS} from '../permissions.mjs';
import {seedDemoOperations} from '../demo-operations.mjs';
import {visibleTasks,addTaskPhoto,advanceTask} from '../tasks.mjs';
import {visibleIncidents} from '../incidents.mjs';
import {visibleParcels} from '../parcels.mjs';
import {visibleReservations} from '../facilities.mjs';
import {receivePurchase} from '../purchases.mjs';
const now=Date.parse('2026-10-23T12:00:00-03:00'),portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
function fixture(){
 const state=seed();state.stays=[];state.tasks=[];state.audit=[];state.tenants=[{id:'chandra',tenant:'chandra',demoMode:true,status:'pilot'}];
 const user={id:'demo-syndic',tenant:'chandra',role:'sindico',name:'Síndico fictício',active:true,houses:[]},caretaker={id:'demo-worker',tenant:'chandra',role:'zelador',name:'Zelador fictício',active:true},owner={id:'demo-owner',tenant:'chandra',role:'proprietario',name:'Proprietário fictício',active:true,houses:['c01']},administrator={id:'demo-admin',tenant:'chandra',role:'administradora',name:'Administração fictícia',active:true,delegations:Object.keys(DELEGATIONS)},portaria={id:'demo-gate',tenant:'chandra',role:'portaria',name:'Porteiro fictício',active:true};
 const db={schema:1,users:[user,caretaker,owner,administrator,portaria],invites:[],events:[],state};
 return {db,user,ctx:{pack:'vilazuni-completo-v1',houses:state.houses,users:{syndic:user,caretaker,owners:[owner],administrator,portaria},portrait,phone:n=>'1202555'+String(100+n).padStart(4,'0')}};
}
test('demonstração operacional cria fluxos relacionados e estados que continuam operáveis',()=>{
 const {db,user,ctx}=fixture(),result=seedDemoOperations(db,user,ctx,now),s=db.state;
 assert.deepEqual(result.counts,{facilities:4,reservations:3,stays:5,tasks:7,maintenance:3,materials:5,incidents:3,parcels:3,suppliers:3,purchases:4,tourLinks:4});
 assert.deepEqual(new Set(result.stays.map(r=>r.status)),new Set(['approved','pending','cancelled']));assert.equal(result.stays.filter(r=>r.status==='approved'&&Date.parse(r.start)<=now&&now<Date.parse(r.end)).length,2);
 assert.ok(result.stays.every(r=>r.phone.startsWith('1202555')&&r.whatsapp===r.phone&&r.email.endsWith('@example.invalid')));
 assert.deepEqual(new Set(result.tasks.map(t=>t.status)),new Set(['todo','doing','review','done']));assert.ok(result.tasks.every(t=>t.assigneeId===ctx.users.caretaker.id));assert.equal(result.maintenance.length,3);assert.deepEqual(result.maintenance.map(p=>p.intervalDays),[1,7,30]);
 const generated=result.tasks.find(t=>t.maintenanceId);assert.equal(generated.checklist.filter(i=>i.done).length,1);assert.equal(s.materials.find(m=>m.demoKey.endsWith('material:chlorine')).balance,16);assert.ok(s.materials.some(m=>m.balance<m.minimum));
 const received=result.purchases.find(p=>p.status==='received');assert.notEqual(received.createdBy,received.approval.approvedBy);assert.equal(received.approval.approvedBy,user.id);assert.ok(received.receipt.movementId);assert.ok(s.materials.some(m=>m.movements.some(move=>move.id===received.receipt.movementId&&move.purchaseId===received.id)));
 let approved=result.purchases.find(p=>p.status==='approved'),material=s.materials.find(m=>m.id===approved.materialId);receivePurchase(s,ctx.users.administrator,{id:approved.id,version:approved.version,materialVersion:material.version,reference:'DEMO-EXPLORACAO-RECEBIMENTO',reason:'Continuação do fluxo fictício pelo explorador'},now);assert.equal(approved.status,'received');
 const task=result.tasks.find(t=>t.demoKey.endsWith('task:pool-today'));addTaskPhoto(s,ctx.users.caretaker,{id:task.id,version:task.version,data:portrait,caption:'Registro ilustrativo de exploração'},now);advanceTask(s,ctx.users.caretaker,{id:task.id,version:task.version,status:'review'},now);advanceTask(s,user,{id:task.id,version:task.version,status:'done',reason:'Execução fictícia conferida durante exploração'},now);assert.equal(task.status,'done');
});
test('repetir o preenchimento operacional preserva edições e não duplica saldos nem históricos',()=>{
 const {db,user,ctx}=fixture();seedDemoOperations(db,user,ctx,now);const material=db.state.materials[0];material.name='Nome editado durante exploração';const before=structuredClone(db);seedDemoOperations(db,user,ctx,now+86400000);assert.deepEqual(db,before);
});
test('perfis fictícios continuam submetidos às permissões e o preenchimento não afeta outro condomínio',()=>{
 const {db,user,ctx}=fixture(),foreign={id:'foreign-task',tenant:'outro',title:'Tarefa existente',status:'todo',assigneeId:'fora'};db.state.tasks.push(foreign);const copy=structuredClone(foreign);seedDemoOperations(db,user,ctx,now);
 assert.deepEqual(db.state.tasks.find(t=>t.id===foreign.id),copy);assert.equal(visibleTasks(db.state,ctx.users.caretaker).length,7);assert.deepEqual(visibleTasks(db.state,ctx.users.owners[0]),[]);assert.deepEqual(visibleTasks(db.state,{...ctx.users.caretaker,id:'outro-worker'}),[]);
 assert.equal(visibleIncidents(db.state,ctx.users.owners[0]).length,3);assert.deepEqual(visibleIncidents(db.state,{...ctx.users.owners[0],id:'outro-owner'}),[]);assert.equal(visibleParcels(db.state,ctx.users.owners[0]).length,3);assert.deepEqual(visibleParcels(db.state,{...ctx.users.owners[0],id:'outro-owner'}),[]);
 const other={...ctx.users.owners[0],id:'outro-owner'},reservations=visibleReservations(db.state,other);assert.equal(reservations.length,2);assert.ok(reservations.every(r=>!('author' in r)&&!('people' in r)));
 const real=fixture();real.db.state.tenants[0].demoMode=false;const before=structuredClone(real.db);assert.throws(()=>seedDemoOperations(real.db,real.user,real.ctx,now),/somente no ambiente de demonstração/);assert.deepEqual(real.db,before);
 const bad=fixture();bad.ctx.users.administrator={...bad.user,tenant:'outro'};const beforeBad=structuredClone(bad.db);assert.throws(()=>seedDemoOperations(bad.db,bad.user,bad.ctx,now),/perfis fictícios/);assert.deepEqual(bad.db,beforeBad);
});
