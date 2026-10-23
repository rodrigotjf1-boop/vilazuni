import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {runtimeConfig} from '../runtime-config.mjs';
import {credentialVault,totp} from '../security.mjs';

const identity=async f=>JSON.parse(await fs.readFile(path.join(f.directory,'store.json'),'utf8')).users.find(u=>u.email==='admin@example.test');

test('gestão em produção usa e-mail e senha sem ativação obrigatória de autenticador',async()=>{
 const policy=runtimeConfig({NODE_ENV:'production',APP_ORIGIN:'https://condominio.example.test',DATABASE_URL:'postgresql://synthetic',MFA_SECRET_KEY:'a'.repeat(64),BOOTSTRAP_TOKEN:'installation-synthetic',VILAZUNI_DATA_DIR:'/tmp/synthetic'});
 const f=await fixture({config:{...policy,origin:null,secure:false,bootstrapToken:null},vault:credentialVault('a'.repeat(64))});
 try {
  assert.equal(f.admin.body.user.mfaRequired,false);
  assert.equal(f.admin.body.user.mfaAvailable,false);
  assert.equal((await f.request('/state',undefined,f.admin.cookie)).status,200);
  assert.equal((await f.request('/mfa/enroll',{password:f.password},f.admin.cookie)).status,409);
  assert.equal((await f.request('/mfa/confirm',{otp:'123456'},f.admin.cookie)).status,409);
  const session=await f.request('/session');assert.equal(session.body.mfaAvailable,false);
  const login=await f.request('/login',{email:'admin@example.test',password:f.password});assert.equal(login.status,200);
  assert.equal((await f.request('/login',{email:'admin@example.test',password:'Senha-incorreta-2026'})).status,401);
  assert.equal((await f.request('/state')).status,401);
 } finally {await f.close();}
});

test('desativar MFA libera contas existentes sem consumir fatores ou recuperação e reativação explícita restaura proteção',async()=>{
 const policy=runtimeConfig({MFA_ENABLED:'true'}),vault=credentialVault('b'.repeat(64)),f=await fixture({config:policy,vault});
 try {
  const factor=await f.request('/mfa/enroll',{password:f.password},f.admin.cookie);assert.equal(factor.status,200);
  const confirmed=await f.request('/mfa/confirm',{otp:totp(factor.body.secret,f.now)},f.admin.cookie);assert.equal(confirmed.status,200);
  const before=await identity(f);assert.equal(confirmed.body.codes.length,8);
  policy.mfaEnabled=false;policy.requireManagerMfa=true;await f.restart();
  const login=await f.request('/login',{email:'admin@example.test',password:f.password});assert.equal(login.status,200);
  assert.equal(login.body.user.mfaAvailable,false);assert.equal(login.body.user.mfaEnabled,false);assert.equal(login.body.user.mfaRequired,false);
  assert.equal((await f.request('/state',undefined,login.cookie)).status,200);
  assert.equal((await f.request('/mfa/confirm',{otp:'123456'},login.cookie)).status,409);
  assert.deepEqual(await identity(f),before,'a dispensa de código preserva identidade, chave cifrada e códigos de recuperação');
  policy.mfaEnabled=true;policy.requireManagerMfa=false;await f.restart();f.advance(30000);
  assert.equal((await f.request('/login',{email:'admin@example.test',password:f.password})).status,401);
  assert.equal((await f.request('/login',{email:'admin@example.test',password:f.password,otp:totp(factor.body.secret,f.now)})).status,200);
 } finally {await f.close();}
});

test('conta com autenticador antigo aceita convite de outro condomínio sem código quando MFA está desligado',async()=>{
 const policy=runtimeConfig({MFA_ENABLED:'true'}),vault=credentialVault('c'.repeat(64)),f=await fixture({config:policy,vault});
 try {
  const owner=await f.invite('proprietario',{houses:['c01']});
  const factor=await f.request('/mfa/enroll',{password:f.password},owner.cookie);assert.equal(factor.status,200);
  assert.equal((await f.request('/mfa/confirm',{otp:totp(factor.body.secret,f.now)},owner.cookie)).status,200);
  policy.mfaEnabled=false;await f.restart();
  const login=await f.request('/login',{email:'admin@example.test',password:f.password});
  const created=await f.request('/tenants/create',{name:'Condomínio sintético B',municipality:'Arraial do Cabo',state:'RJ',reason:'Teste de convite'},login.cookie);assert.equal(created.status,200);
  const selected=await f.request('/session/context',{tenant:created.body.tenant.id},login.cookie);assert.equal(selected.status,200);
  const invite=await f.request('/admin/invites',{email:owner.email,role:'portaria'},selected.cookie);assert.equal(invite.status,201);
  const accepted=await f.request('/activate',{name:'Pessoa sintética',email:owner.email,password:f.password,code:invite.body.code});assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  assert.equal(accepted.body.user.tenant,created.body.tenant.id);assert.equal(accepted.body.user.mfaRequired,false);
  assert.equal((await f.request('/state',undefined,accepted.cookie)).status,200);
 } finally {await f.close();}
});
