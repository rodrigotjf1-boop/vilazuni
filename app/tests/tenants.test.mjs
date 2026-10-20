import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixture} from './helpers.mjs';import {createBackup,restoreBackup} from '../backup.mjs';import {seed} from '../domain.mjs';

test('segundo condomínio é configurado sem alterar código; contexto e convite de conta existente não cruzam dados',async()=>{
 const f=await fixture();try{
  const owner=await f.invite('proprietario',{houses:['c01']}),created=await f.request('/tenants/create',{name:'Condomínio de teste B',municipality:'Arraial do Cabo',state:'RJ',reason:'Implantação sintética'},f.admin.cookie);assert.equal(created.status,200);const tenant=created.body.tenant.id;
  const switched=await f.request('/session/context',{tenant},f.admin.cookie);assert.equal(switched.status,200);let admin=switched.cookie;
  assert.equal((await f.request('/state',undefined,f.admin.cookie)).status,401);const state=(await f.request('/state',undefined,admin)).body.state;assert.deepEqual(state.houses,[]);assert.deepEqual(state.stays,[]);assert.equal(state.tenant.name,'Condomínio de teste B');assert.equal(state.tour.visual,null);
  const unit=await f.request('/tenants/units/save',{number:'B01',type:'Apartamento',parking:1,floors:1,rooms:2,reason:'Cadastro sintético'},admin);assert.equal(unit.status,200);
  const invitation=await f.request('/admin/invites',{email:owner.email,role:'proprietario',houses:[unit.body.unit.id]},admin);assert.equal(invitation.status,201);
  const wrong=await f.request('/activate',{email:owner.email,name:'Nome trocado',password:'Senha-errada-para-teste',code:invitation.body.code});assert.equal(wrong.status,401);
  const joined=await f.request('/activate',{email:owner.email,name:'Nome trocado',password:f.password,code:invitation.body.code});assert.equal(joined.status,200);assert.equal(joined.body.user.id,owner.body.user.id);assert.notEqual(joined.body.user.name,'Nome trocado');
  assert.deepEqual((await f.request('/state',undefined,joined.cookie)).body.state.houses.map(h=>h.number),['B01']);assert.equal((await f.request('/tenants',undefined,joined.cookie)).body.contexts.length,2);
  assert.equal((await f.request('/session/context',{tenant:'desconhecido'},joined.cookie)).status,403);assert.equal((await f.request('/tenants/create',{name:'Indevido',municipality:'Teste',state:'RJ',reason:'Teste'},joined.cookie)).status,403);
  const back=await f.request('/session/context',{tenant:'chandra'},joined.cookie);assert.equal(back.status,200);assert.deepEqual((await f.request('/state',undefined,back.cookie)).body.state.houses.map(h=>h.id),['c01']);
  const raw=JSON.parse(await fs.readFile(f.directory+'/store.json','utf8'));assert.equal(raw.users.filter(u=>u.email===owner.email).length,1);assert.equal(raw.users.find(u=>u.email===owner.email).memberships.length,1);
 }finally{await f.close();}
});
test('importação de unidades tem prévia sem gravação, duplicidade/limite e confirmação; exportação não inclui credenciais',async()=>{
 const f=await fixture();try{const data={format:'vilazuni-master-data-v1',units:[{number:'Extra',type:'Sobrado',parking:1,floors:2,rooms:3}]},before=await fs.readFile(f.directory+'/store.json','utf8'),preview=await f.request('/tenants/import/preview',{data},f.admin.cookie);assert.equal(preview.status,200);assert.equal(await fs.readFile(f.directory+'/store.json','utf8'),before);
  assert.equal((await f.request('/tenants/import',{data,fingerprint:'errado',reason:'Teste'},f.admin.cookie)).status,403);assert.equal((await f.request('/tenants/import',{data,fingerprint:preview.body.fingerprint,reason:'Importação sintética conferida'},f.admin.cookie)).status,200);assert.equal((await f.request('/tenants/import/preview',{data},f.admin.cookie)).status,403);
  const original=(await f.request('/state',undefined,f.admin.cookie)).body.state.houses.find(h=>h.id==='c01'),edit={id:original.id,version:original.version||0,number:original.number,type:'Sobrado revisado',floors:2,rooms:5,parking:2,reason:'Alteração estrutural sintética'},updated=await f.request('/tenants/units/save',edit,f.admin.cookie);assert.equal(updated.status,200);assert.equal(updated.body.unit.id,original.id);assert.deepEqual(updated.body.unit.owners,original.owners);assert.equal(updated.body.unit.history.at(-1).previous.rooms,original.rooms);assert.equal(updated.body.unit.history.at(-1).current.rooms,5);assert.equal((await f.request('/tenants/units/save',edit,f.admin.cookie)).status,403);
  const owner=await f.invite('proprietario',{houses:['c01']});assert.equal((await f.request('/tenants/export',undefined,owner.cookie)).status,403);const exported=await f.request('/tenants/export',undefined,f.admin.cookie);assert.equal(exported.status,200);assert.ok(exported.body.state.houses.every(h=>h.tenant==='chandra'));for(const account of exported.body.accounts){assert.equal(account.hash,undefined);assert.equal(account.salt,undefined);}assert.equal(exported.body.sha256.length,64);
 }finally{await f.close();}
});
test('backup cifra credenciais e dados, autentica conteúdo/chave e preserva exatamente o retrato restaurado',()=>{
 const db={schema:1,users:[{id:'s',tenant:'chandra',email:'s@example.test',hash:'credencial-sintetica'}],invites:[],events:[],state:seed()},password='Chave-sintetica-de-backup-2026',bytes=createBackup(db,password);
 assert.ok(!bytes.toString().includes('credencial-sintetica'));assert.deepEqual(restoreBackup(bytes,password),db);assert.throws(()=>restoreBackup(bytes,'outra-chave-para-teste'),/inválidos/);const parsed=JSON.parse(bytes);parsed.data=parsed.data.slice(0,-4)+'AAAA';assert.throws(()=>restoreBackup(Buffer.from(JSON.stringify(parsed)),password),/inválidos/);assert.throws(()=>createBackup(db,'curta'),/dezesseis/);
});
