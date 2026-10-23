import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeConfig} from '../runtime-config.mjs';

const production={NODE_ENV:'production',APP_ORIGIN:'https://synthetic.example.test',DATABASE_URL:'postgresql://synthetic:synthetic@localhost/vilazuni_test',MFA_SECRET_KEY:'a'.repeat(64),BOOTSTRAP_TOKEN:'synthetic-installation-code',VILAZUNI_DATA_DIR:'/tmp/vilazuni-test'};

test('MFA é desabilitado por padrão no desenvolvimento e na produção, incluindo configuração legada que o exigia para a gestão',()=>{
 for(const env of [{},production,{...production,REQUIRE_MANAGER_MFA:'true'},{...production,MFA_ENABLED:'false',REQUIRE_MANAGER_MFA:'true'}]){
  const config=runtimeConfig(env);assert.equal(config.mfaEnabled,false);assert.equal(config.requireManagerMfa,false);
 }
});

test('MFA disponível e obrigação para gestores são opções independentes e explícitas',()=>{
 for(const env of [{MFA_ENABLED:'true'},{...production,MFA_ENABLED:'true'},{...production,MFA_ENABLED:'true',REQUIRE_MANAGER_MFA:'false'}]){
  const config=runtimeConfig(env);assert.equal(config.mfaEnabled,true);assert.equal(config.requireManagerMfa,false);
 }
 const required=runtimeConfig({...production,MFA_ENABLED:'true',REQUIRE_MANAGER_MFA:'true'});assert.equal(required.mfaEnabled,true);assert.equal(required.requireManagerMfa,true);
});

test('desabilitar MFA preserva exigência da chave de cifragem e controles de produção',()=>{
 const disabled={...production,MFA_ENABLED:'false',REQUIRE_MANAGER_MFA:'false'};
 for(const field of ['MFA_SECRET_KEY','DATABASE_URL','BOOTSTRAP_TOKEN','VILAZUNI_DATA_DIR','APP_ORIGIN']){
  const env={...disabled};delete env[field];assert.throws(()=>runtimeConfig(env),/Produção exige/);
 }
 assert.throws(()=>runtimeConfig({...disabled,MFA_SECRET_KEY:'invalid'}),/Produção exige/);
 assert.throws(()=>runtimeConfig({...disabled,APP_ORIGIN:'http://synthetic.example.test'}),/HTTPS/);
 assert.equal(runtimeConfig(disabled).secure,true);
});
