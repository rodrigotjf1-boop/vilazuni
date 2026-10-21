import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepare} from '../../deploy/easypanel/prepare.mjs';
import {runtimeConfig,clientAddress} from '../runtime-config.mjs';

test('primeira instalação Easypanel gera segredos privados coerentes e recusa sobrescrita, URL indevida e saída no checkout',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-easypanel-'));
 try{
  const output=path.join(directory,'first'),options={origin:'https://vilazuni.example.test',databaseHost:'vilazuni_banco',databaseName:'vilazuni_test',output};
  const result=await prepare(options);assert.deepEqual(result.files,['application.env','database.sql','backup.key']);
  const text=await fs.readFile(path.join(output,'application.env'),'utf8'),env=Object.fromEntries(text.trim().split('\n').map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];})),sql=await fs.readFile(path.join(output,'database.sql'),'utf8');
  const config=runtimeConfig(env),url=new URL(env.DATABASE_URL);assert.equal(config.production,true);assert.equal(config.clientIpHeader,'x-forwarded-for');assert.equal(url.username,'vilazuni_app');assert.equal(url.hostname,'vilazuni_banco');assert.equal(url.pathname,'/vilazuni_test');assert.equal(url.password.length,64);assert.ok(sql.includes("PASSWORD '"+url.password+"'"));assert.ok(sql.includes('NOBYPASSRLS'));assert.ok(sql.includes('A base Vilazuni já existe'));assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));assert.match(env.MFA_SECRET_KEY,/^[a-f\d]{64}$/);assert.notEqual(env.MFA_SECRET_KEY,url.password);assert.notEqual(env.MFA_SECRET_KEY,env.BOOTSTRAP_TOKEN);assert.equal(env.MIGRATION_DATABASE_URL,undefined);assert.equal((await fs.stat(output)).mode&0o777,0o700);
  for(const file of result.files)assert.equal((await fs.stat(path.join(output,file))).mode&0o777,0o600);
  await assert.rejects(()=>prepare(options),e=>e.code==='EEXIST');assert.equal(await fs.readFile(path.join(output,'application.env'),'utf8'),text);
  for(const patch of [{origin:'http://example.test'},{origin:'https://example.test/'},{origin:'https://user:password@example.test'},{databaseHost:'bad\nNODE_ENV=test'},{databaseName:'other; DROP TABLE users'}])await assert.rejects(()=>prepare({...options,...patch,output:path.join(directory,'invalid')}));
  const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');await assert.rejects(()=>prepare({...options,output:path.join(repository,'deploy/should-not-exist')}),/fora do checkout/);
  await fs.symlink(repository,path.join(directory,'checkout'));await assert.rejects(()=>prepare({...options,output:path.join(directory,'checkout/should-not-exist')}),/diretório pai/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('Easypanel aceita somente cabeçalho configurado de um proxy privado e ignora IP forjado em conexão pública ou cadeia ambígua',()=>{
 const config=runtimeConfig({TRUST_PROXY:'true',CLIENT_IP_HEADER:'x-forwarded-for'}),request={socket:{remoteAddress:'172.20.0.2'},headers:{'x-forwarded-for':'203.0.113.9','x-vilazuni-client-ip':'198.51.100.1'}};
 assert.equal(clientAddress(request,config),'203.0.113.9');assert.equal(clientAddress(request,runtimeConfig({TRUST_PROXY:'true'})),'198.51.100.1');assert.equal(clientAddress(request,{...config,trustProxy:false}),'172.20.0.2');assert.equal(clientAddress({...request,socket:{remoteAddress:'198.51.100.20'}},config),'198.51.100.20');assert.equal(clientAddress({...request,headers:{'x-forwarded-for':'198.51.100.30, 203.0.113.9'}},config),'172.20.0.2');assert.throws(()=>runtimeConfig({CLIENT_IP_HEADER:'x-any-user-header'}),/CLIENT_IP_HEADER/);
});

test('provisionamento Easypanel aplica SQL transacional em PostgreSQL real e preserva instalação/credencial ao recusar repetição',{skip:!process.env.VILAZUNI_PG_TEST_CONFIG},async()=>{
 const {randomBytes}=await import('node:crypto'),{default:pg}=await import('pg');const config=JSON.parse(await fs.readFile(process.env.VILAZUNI_PG_TEST_CONFIG,'utf8')),url=new URL(config.adminUrl);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&/^\/vilazuni_test(?:_[a-z0-9]+)?$/.test(url.pathname),'Somente PostgreSQL local descartável.');
 const suffix=randomBytes(5).toString('hex'),databaseName='vilazuni_test_ep_'+suffix,databaseRole='vilazuni_ep_'+suffix,directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-easypanel-pg-')),admin=new pg.Pool({connectionString:url.href});let database,roleCreated=false,created=false;
 try{
  await admin.query('CREATE DATABASE "'+databaseName+'"');created=true;url.pathname='/'+databaseName;database=new pg.Pool({connectionString:url.href});
  const options={origin:'https://synthetic.example.test',databaseHost:'localhost',databaseName,databaseRole,output:path.join(directory,'correct')};await prepare(options);await prepare({...options,databaseName:databaseName+'_wrong',output:path.join(directory,'wrong')});
  const sql=(await fs.readFile(path.join(options.output,'database.sql'),'utf8')).replace(/^\\set[^\n]*\n/,'');const wrong=(await fs.readFile(path.join(directory,'wrong/database.sql'),'utf8')).replace(/^\\set[^\n]*\n/,'');
  await assert.rejects(()=>database.query(wrong),/Banco incorreto/);await database.query('ROLLBACK');assert.equal((await database.query("SELECT to_regclass('public.vilazuni_control') AS relation")).rows[0].relation,null);
  await database.query(sql);roleCreated=true;
  const env=await fs.readFile(path.join(options.output,'application.env'),'utf8'),runtimeUrl=new URL(env.split('\n').find(line=>line.startsWith('DATABASE_URL=')).slice(13));runtimeUrl.hostname=url.hostname;runtimeUrl.port=url.port;
  const runtime=new pg.Pool({connectionString:runtimeUrl.href});try{const role=(await runtime.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false});assert.deepEqual((await runtime.query('SELECT * FROM vilazuni_tenants')).rows,[]);await runtime.query("INSERT INTO vilazuni_control(id,revision,payload) VALUES(1,1,'{}')");await assert.rejects(()=>runtime.query('DROP TABLE vilazuni_control'),/owner/);}finally{await runtime.end();}
  await assert.rejects(()=>database.query(sql),/base Vilazuni já existe/);await database.query('ROLLBACK');assert.equal((await database.query('SELECT count(*) FROM vilazuni_control')).rows[0].count,'1');
  const retained=new pg.Pool({connectionString:runtimeUrl.href});try{assert.equal((await retained.query('SELECT count(*) FROM vilazuni_control')).rows[0].count,'1');}finally{await retained.end();}
 }finally{await database?.end();if(created)await admin.query('DROP DATABASE "'+databaseName+'" WITH (FORCE)');if(roleCreated)await admin.query('DROP ROLE "'+databaseRole+'"');await admin.end();await fs.rm(directory,{recursive:true,force:true});}
});
