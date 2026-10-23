import os from 'node:os';import path from 'node:path';
import {privateFileStorage} from '../private-files.mjs';
import {previewFullDemo,createFullDemo} from '../full-demo.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import http from 'node:http';import pg from 'pg';
import {postgresStorage} from '../storage.mjs';import {seed} from '../domain.mjs';import {createAuthApi} from '../auth-api.mjs';
const config=process.env.VILAZUNI_PG_TEST_CONFIG?JSON.parse(await fs.readFile(process.env.VILAZUNI_PG_TEST_CONFIG,'utf8')):null;
if(config){for(const key of ['adminUrl','runtimeUrl']){const url=new URL(config[key]);if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/vilazuni_test(?:_[a-z0-9]+)?$/.test(url.pathname))throw Error('Testes PostgreSQL recusam destinos fora da base local descartável.');}}
const initial=()=>({schema:1,users:[],invites:[],events:[],state:seed()});
async function clear(){const pool=new pg.Pool({connectionString:config.adminUrl});try{await pool.query('TRUNCATE vilazuni_tenants,vilazuni_control');}finally{await pool.end();}}
test('PostgreSQL persiste partições, preserva coleções vazias e aplica RLS sem contexto e entre condomínios',{skip:!config},async()=>{
 await clear();const store=await postgresStorage(config.runtimeUrl,initial);const db=initial();db.users.push({id:'s',name:'Teste',email:'s@example.test',tenant:'chandra',active:true,role:'sindico'});db.state.residents=[];db.state.houses.push({...db.state.houses[0],id:'outro-id',tenant:'outro'});
 try{await store.load();await store.save(db);const again=await store.load();assert.equal(again.state.houses.length,15);assert.deepEqual(again.state.residents,[]);const pool=new pg.Pool({connectionString:config.runtimeUrl});
  try{assert.equal((await pool.query('SELECT * FROM vilazuni_tenants')).rows.length,0);const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('vilazuni.tenant','chandra',true)");const rows=(await client.query('SELECT tenant,payload FROM vilazuni_tenants')).rows;assert.deepEqual(rows.map(r=>r.tenant),['chandra']);assert.equal(rows[0].payload.state.houses.length,14);assert.equal((await client.query("SELECT * FROM vilazuni_tenants WHERE tenant='outro'")).rows.length,0);await client.query('ROLLBACK');}finally{client.release();}}finally{await pool.end();}
 }finally{await store.close();}
});
test('duas instâncias PostgreSQL recusam gravação obsoleta em vez de perder alterações',{skip:!config},async()=>{
 await clear();const a=await postgresStorage(config.runtimeUrl,initial),b=await postgresStorage(config.runtimeUrl,initial);
 try{const first=await a.load(),stale=await b.load();first.state.residents=[];await a.save(first);stale.state.tasks=[];await assert.rejects(()=>b.save(stale),/outra instância/);assert.equal((await b.load()).state.tasks.length,3);}finally{await a.close();await b.close();}
});
test('sessões de outra instância perdem acesso após suspensão e troca de senha persistidas',{skip:!config},async()=>{
 await clear();const apiA=await createAuthApi({databaseUrl:config.runtimeUrl}),apiB=await createAuthApi({databaseUrl:config.runtimeUrl}),servers=[http.createServer(apiA),http.createServer(apiB)];for(const s of servers)await new Promise(r=>s.listen(0,'127.0.0.1',r));
 async function req(index,route,data,cookie=''){const origin='http://127.0.0.1:'+servers[index].address().port,r=await fetch(origin+'/api'+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const password='Senha-sintetica-postgres-2026';
 try{const a=await req(0,'/setup',{name:'Gestão Teste',email:'root-pg@example.test',password});assert.equal(a.status,200);const b=await req(1,'/login',{email:'root-pg@example.test',password});assert.equal(b.status,200);
  const invited=await req(0,'/admin/invites',{email:'owner-pg@example.test',role:'proprietario',houses:['c01']},a.cookie),owner=await req(1,'/activate',{name:'Pessoa Teste',email:'owner-pg@example.test',password,code:invited.body.code});assert.equal(owner.status,200);await req(0,'/admin/suspend',{id:owner.body.user.id},a.cookie);assert.equal((await req(1,'/state',undefined,owner.cookie)).status,401);
  assert.equal((await req(0,'/password',{currentPassword:password,password:'Nova-senha-sintetica-postgres'},a.cookie)).status,200);assert.equal((await req(1,'/state',undefined,b.cookie)).status,401);assert.equal((await req(1,'/login',{email:'root-pg@example.test',password:'Nova-senha-sintetica-postgres'})).status,200);
 }finally{for(const s of servers)await new Promise(r=>s.close(r));await apiA.close();await apiB.close();}
});


test('PostgreSQL particiona a demonstração completa e restaura anexos privados sem alterar o condomínio de origem',{skip:!config},async()=>{
 await clear();const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-demo-pg-')),store=privateFileStorage(await postgresStorage(config.runtimeUrl,initial),directory);
 try{
  await store.load();const db=initial(),user={id:'demo-pg-owner',name:'Gestão sintética PostgreSQL',email:'demo-pg@example.invalid',tenant:'chandra',role:'sindico',active:true,houses:[]};db.users.push(user);const source=structuredClone(db.state.houses),created=createFullDemo(db,user,previewFullDemo(db,user),Date.parse('2026-10-23T15:00:00Z'));
  await store.save(db);const loaded=await store.load();assert.deepEqual(loaded.state.houses.filter(h=>h.tenant==='chandra'),source);assert.equal(loaded.state.houses.filter(h=>h.tenant===created.tenantId).length,14);assert.equal(loaded.state.residents.filter(r=>r.tenant===created.tenantId).length,16);assert.equal(loaded.state.financialAccounts.filter(r=>r.tenant===created.tenantId).length,3);assert.equal(loaded.users.filter(p=>p.demoIdentity).length,24);
  const portrait=loaded.state.residents.find(r=>r.tenant===created.tenantId).photo;assert.ok(portrait.data);assert.ok(portrait.bytes>100);assert.ok(loaded.state.documents.filter(r=>r.tenant===created.tenantId).every(d=>d.versions.every(v=>v.data)));
  const pool=new pg.Pool({connectionString:config.runtimeUrl});try{assert.equal((await pool.query('SELECT tenant FROM vilazuni_tenants')).rows.length,0);const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('vilazuni.tenant',$1,true)",[created.tenantId]);const rows=(await client.query('SELECT tenant,payload FROM vilazuni_tenants')).rows;assert.deepEqual(rows.map(r=>r.tenant),[created.tenantId]);assert.ok(!JSON.stringify(rows[0].payload).includes(portrait.data),'Bytes privados permanecem fora do payload PostgreSQL.');assert.equal(rows[0].payload.state.residents.length,16);await client.query('ROLLBACK');}finally{client.release();}}finally{await pool.end();}
 }finally{await store.close();await fs.rm(directory,{recursive:true,force:true});}
});
