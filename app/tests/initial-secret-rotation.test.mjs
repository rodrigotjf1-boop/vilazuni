import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {prepare} from '../../deploy/easypanel/prepare.mjs';
import {rotateInitialSecrets} from '../scripts/rotate-initial-secrets.mjs';

const parse=text=>Object.fromEntries(text.trim().split('\n').map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
test('troca inicial recusa arquivos públicos, links, SQL divergente e operação pendente antes de conectar',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-rotate-'));
 try{
  const output=path.join(directory,'config');await prepare({origin:'https://synthetic.example.test',databaseHost:'localhost',output});
  const options={directory:output};const original=await fs.readFile(path.join(output,'application.env'),'utf8');
  await fs.chmod(output,0o755);await assert.rejects(()=>rotateInitialSecrets(options),/privados/);await fs.chmod(output,0o700);
  await fs.chmod(path.join(output,'application.env'),0o644);await assert.rejects(()=>rotateInitialSecrets(options),/privados/);await fs.chmod(path.join(output,'application.env'),0o600);
  await fs.rename(path.join(output,'application.env'),path.join(output,'source.env'));await fs.symlink(path.join(output,'source.env'),path.join(output,'application.env'));await assert.rejects(()=>rotateInitialSecrets(options),/links/);await fs.unlink(path.join(output,'application.env'));await fs.rename(path.join(output,'source.env'),path.join(output,'application.env'));
  const sql=await fs.readFile(path.join(output,'database.sql'),'utf8');await fs.writeFile(path.join(output,'database.sql'),'SQL divergente');await assert.rejects(()=>rotateInitialSecrets(options),/não corresponde/);await fs.writeFile(path.join(output,'database.sql'),sql);
  await fs.mkdir(path.join(output,'.rotation-pending'),{mode:0o700});await assert.rejects(()=>rotateInitialSecrets(options),/troca pendente/);
  assert.equal(await fs.readFile(path.join(output,'application.env'),'utf8'),original);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('PostgreSQL real troca somente os três segredos iniciais, invalida senha anterior e preserva MFA/base quando já existe conta',{skip:!process.env.VILAZUNI_PG_TEST_CONFIG},async()=>{
 const config=JSON.parse(await fs.readFile(process.env.VILAZUNI_PG_TEST_CONFIG,'utf8')),url=new URL(config.adminUrl);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&/^\/vilazuni_test(?:_[a-z0-9]+)?$/.test(url.pathname),'Somente PostgreSQL local descartável.');
 const suffix=randomBytes(5).toString('hex'),databaseName='vilazuni_test_rotate_'+suffix,databaseRole='vilazuni_rotate_'+suffix,directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-rotate-pg-')),admin=new pg.Client({connectionString:url.href});let database,created=false,roleCreated=false;
 try{
  await admin.connect();await admin.query('CREATE DATABASE "'+databaseName+'"');created=true;url.pathname='/'+databaseName;database=new pg.Client({connectionString:url.href});await database.connect();
  const output=path.join(directory,'config');await prepare({origin:'https://synthetic.example.test',databaseHost:'localhost',databaseName,databaseRole,output});
  const oldText=await fs.readFile(path.join(output,'application.env'),'utf8'),oldEnv=parse(oldText),oldSql=await fs.readFile(path.join(output,'database.sql'),'utf8'),backup=await fs.readFile(path.join(output,'backup.key'),'utf8');
  await database.query(oldSql.replace(/^\\set[^\n]*\n/,''));roleCreated=true;
  await database.query('INSERT INTO vilazuni_control(id,revision,payload) VALUES(1,1,$1)',[{schema:1,users:[]}]);
  const options={directory:output,databaseHost:url.hostname,databasePort:url.port||5432};
  await database.query('ALTER ROLE "'+databaseRole+'" CREATEDB');await assert.rejects(()=>rotateInitialSecrets(options),/usuário restrito/);assert.equal(await fs.readFile(path.join(output,'application.env'),'utf8'),oldText);await database.query('ALTER ROLE "'+databaseRole+'" NOCREATEDB');
  const result=await rotateInitialSecrets(options),newText=await fs.readFile(path.join(output,'application.env'),'utf8'),newEnv=parse(newText),newSql=await fs.readFile(path.join(output,'database.sql'),'utf8');
  for(const key of Object.keys(oldEnv))if(['DATABASE_URL','MFA_SECRET_KEY','BOOTSTRAP_TOKEN'].includes(key))assert.notEqual(newEnv[key],oldEnv[key]);else assert.equal(newEnv[key],oldEnv[key]);
  const newUrl=new URL(newEnv.DATABASE_URL);assert.ok(newSql.includes("PASSWORD '"+newUrl.password+"'"));assert.ok(!newSql.includes("PASSWORD '"+new URL(oldEnv.DATABASE_URL).password+"'"));assert.equal(await fs.readFile(path.join(output,'backup.key'),'utf8'),backup);
  assert.equal(await fs.readFile(path.join(result.archive,'application.previous.env'),'utf8'),oldText);assert.equal(await fs.readFile(path.join(result.archive,'database.previous.sql'),'utf8'),oldSql);
  for(const file of ['application.env','database.sql','backup.key'])assert.equal((await fs.stat(path.join(output,file))).mode&0o777,0o600);assert.equal((await fs.stat(result.archive)).mode&0o777,0o700);
  const connect=env=>{const connection=new URL(env.DATABASE_URL);connection.hostname=url.hostname;connection.port=url.port;return new pg.Client({connectionString:connection.href});};
  const old=connect(oldEnv);try{await assert.rejects(()=>old.connect(),/password authentication/);}finally{await old.end();}
  const current=connect(newEnv);try{await current.connect();assert.deepEqual((await current.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false});}finally{await current.end();}
  const identity={schema:1,users:[{id:'synthetic',mfa:{sealed:'synthetic-encrypted-value'}}]};await database.query('UPDATE vilazuni_control SET revision=2,payload=$1 WHERE id=1',[identity]);
  await assert.rejects(()=>rotateInitialSecrets(options),/Já existem contas/);assert.equal(await fs.readFile(path.join(output,'application.env'),'utf8'),newText);assert.equal(await fs.readFile(path.join(output,'database.sql'),'utf8'),newSql);assert.deepEqual((await database.query('SELECT payload FROM vilazuni_control')).rows[0].payload,identity);await assert.rejects(()=>fs.stat(path.join(output,'.rotation-pending')),error=>error.code==='ENOENT');
  const retained=connect(newEnv);try{await retained.connect();assert.equal((await retained.query('SELECT 1 AS ok')).rows[0].ok,1);}finally{await retained.end();}
 }finally{await database?.end();if(created)await admin.query('DROP DATABASE "'+databaseName+'"');if(roleCreated)await admin.query('DROP ROLE "'+databaseRole+'"');await admin.end();await fs.rm(directory,{recursive:true,force:true});}
});
