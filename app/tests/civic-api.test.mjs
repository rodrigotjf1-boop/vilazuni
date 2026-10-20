import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixture} from './helpers.mjs';

const delegation={validUntil:'2026-12-31',delegationReason:'Operação sintética'};
const source={title:'Piscina de teste',reference:'Regimento sintético, artigo 1',body:'Piscina: conferir as regras antes do uso.',audience:'community',effectiveFrom:'2026-10-01',reason:'Preparação sintética'};
async function publish(f,audience='community'){
 const created=await f.request('/knowledge/sources/create',{...source,audience},f.admin.cookie);assert.equal(created.status,200);
 const result=await f.request('/knowledge/sources/publish',{id:created.body.id,version:created.body.version,reviewed:true,reason:'Revisado em teste'},f.admin.cookie);assert.equal(result.status,200);return result.body;
}
test('API protege rascunhos e públicos; consultas e prévias não gravam nem expõem outros módulos',async()=>{
 const f=await fixture();try{const owner=await f.invite('proprietario',{houses:['c01']}),editor=await f.invite('subsindico',{...delegation,delegations:['knowledge']});
 assert.equal((await f.request('/knowledge')).status,401);assert.equal((await f.request('/knowledge/sources/create',source,owner.cookie)).status,403);
 const publicSource=await publish(f),restricted=await publish(f,'management');
 const before=await fs.readFile(f.directory+'/store.json','utf8');const result=await f.request('/knowledge/consult',{question:'Piscina',audience:'community'},f.admin.cookie);assert.equal(result.body.excerpts.length,1);assert.equal(result.body.excerpts[0].sourceId,publicSource.id);
 assert.equal((await f.request('/knowledge/source?id='+restricted.id,undefined,owner.cookie)).status,403);assert.equal((await f.request('/knowledge/briefings/preview',{audience:'management'},editor.cookie)).body.sections.length,0);assert.equal((await f.request('/documents/owners',undefined,editor.cookie)).status,403);
 assert.equal(await fs.readFile(f.directory+'/store.json','utf8'),before);
 }finally{await f.close();}
});
test('API serializa publicações e resumos concorrentes, revoga fonte e preserva revisões após reinício',async()=>{
 const f=await fixture();try{const created=await f.request('/knowledge/sources/create',source,f.admin.cookie),payload={id:created.body.id,version:1,reviewed:true,reason:'Revisão concorrente'};
 const results=await Promise.all([f.request('/knowledge/sources/publish',payload,f.admin.cookie),f.request('/knowledge/sources/publish',payload,f.admin.cookie)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
 const preview=await f.request('/knowledge/briefings/preview',{audience:'community'},f.admin.cookie);const saves=await Promise.all([f.request('/knowledge/briefings/save',preview.body,f.admin.cookie),f.request('/knowledge/briefings/save',preview.body,f.admin.cookie)]);assert.deepEqual(saves.map(r=>r.status).sort(),[200,403]);assert.equal((await f.request('/knowledge/briefings',undefined,f.admin.cookie)).body.briefings.length,1);
 await f.restart();const login=await f.request('/login',{email:'admin@example.test',password:f.password});const read=await f.request('/knowledge/source?id='+created.body.id,undefined,login.cookie);assert.equal(read.body.source.publishedNumber,1);assert.equal(read.body.source.history.length,2);
 await f.request('/knowledge/sources/toggle',{id:created.body.id,version:2,active:false,reason:'Retirar em teste'},login.cookie);assert.equal((await f.request('/knowledge/briefings',undefined,login.cookie)).body.briefings.length,0);
 }finally{await f.close();}
});
test('API recebe uma resposta por conta em concorrência, preserva totais e recusa resposta após encerramento',async()=>{
 const f=await fixture();try{const owner=await f.invite('proprietario',{houses:['c01','c02']}),other=await f.invite('proprietario',{houses:['c01']});const created=await f.request('/polls/create',{title:'Atividade preferida?',description:'Planejamento sintético sem deliberação.',options:['Leitura','Caminhada'],audience:'residents',closesAt:'2026-10-22T18:00',reason:'Consulta de teste',consultative:true},f.admin.cookie);assert.equal(created.status,200);const p=created.body,payload={id:p.id,version:1,optionId:p.options[0].id};
 const results=await Promise.all([f.request('/polls/vote',payload,owner.cookie),f.request('/polls/vote',payload,owner.cookie),f.request('/polls/vote',payload,other.cookie)]);assert.ok(results.every(r=>r.status===200));assert.equal(results[0].body.total,null);
 await f.request('/polls/close',{id:p.id,version:1,status:'closed',reason:'Encerramento sintético'},f.admin.cookie);const read=await f.request('/polls/detail?id='+p.id,undefined,owner.cookie);assert.equal(read.body.poll.total,2);assert.equal(read.body.poll.options[0].count,2);assert.equal(read.body.poll.votes,undefined);assert.equal((await f.request('/polls/vote',payload,other.cookie)).status,403);
 await f.restart();const login=await f.request('/login',{email:owner.email,password:f.password});assert.equal((await f.request('/polls/detail?id='+p.id,undefined,login.cookie)).body.poll.total,2);
 }finally{await f.close();}
});
test('delegação e suspensão são reavaliadas a cada chamada e não concedem acesso cruzado a fontes e enquetes',async()=>{
 const f=await fixture();try{const editor=await f.invite('administradora',{...delegation,delegations:['knowledge']}),governor=await f.invite('subsindico',{...delegation,delegations:['governance']});const restricted=await publish(f,'management');
 assert.equal((await f.request('/knowledge/source?id='+restricted.id,undefined,editor.cookie)).status,200);assert.equal((await f.request('/knowledge/source?id='+restricted.id,undefined,governor.cookie)).status,403);assert.equal((await f.request('/polls/create',{},editor.cookie)).status,403);
 await f.request('/admin/delegation',{id:editor.body.user.id,version:0,...delegation,delegations:['governance']},f.admin.cookie);assert.equal((await f.request('/knowledge',undefined,editor.cookie)).status,401);
 const login=await f.request('/login',{email:editor.email,password:f.password});assert.equal((await f.request('/knowledge/source?id='+restricted.id,undefined,login.cookie)).status,403);assert.equal((await f.request('/knowledge/sources/create',source,login.cookie)).status,403);
 await f.request('/admin/suspend',{id:governor.body.user.id},f.admin.cookie);assert.equal((await f.request('/polls',undefined,governor.cookie)).status,401);
 }finally{await f.close();}
});
