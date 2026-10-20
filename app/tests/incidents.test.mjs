import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createIncident,updateIncident,visibleIncidents} from '../incidents.mjs';
const manager={id:'m',name:'Gestão',tenant:'a',role:'sindico',active:true};
const author={id:'p',name:'Autor',tenant:'a',role:'proprietario',houses:['h']};
const input={title:'Vazamento',area:'Piscina',description:'Água no piso',houseId:'h'};
const fresh=()=>({houses:[{id:'h',tenant:'a'},{id:'other',tenant:'a'},{id:'foreign',tenant:'b'}]});
test('ocorrências são privadas ao autor e gestão do mesmo condomínio',()=>{
 const s=fresh();createIncident(s,author,{...input,tenant:'b',authorId:'intruso',status:'resolved'});
 assert.equal(visibleIncidents(s,author).length,1);assert.equal(visibleIncidents(s,manager).length,1);
 for(const u of [{...author,id:'outro'},{...manager,tenant:'b'},{...author,role:'guest'}])assert.deepEqual(visibleIncidents(s,u),[]);
 assert.throws(()=>createIncident(s,author,{...input,houseId:'other'}));assert.throws(()=>createIncident(s,manager,{...input,houseId:'foreign'}));
 const copy=visibleIncidents(s,author);copy[0].history.length=0;assert.equal(s.incidents[0].history.length,1);
});
test('atribuição, apuração, resolução e reabertura preservam histórico e versões',()=>{
 const s=fresh();let r=createIncident(s,author,input);const change=data=>r=updateIncident(s,[manager],manager,{id:r.id,version:r.version,message:'Justificativa registrada',...data});
 assert.throws(()=>change({action:'status',status:'doing'}));
 change({action:'assign',assigneeId:'m'});change({action:'status',status:'doing'});change({action:'status',status:'resolved'});
 assert.equal(r.history.length,4);assert.equal(r.status,'resolved');assert.throws(()=>change({action:'comment'}));
 change({action:'status',status:'open'});assert.equal(r.history.length,5);assert.equal(r.status,'open');
 assert.throws(()=>updateIncident(s,[manager],manager,{id:r.id,version:1,action:'comment',message:'Tela antiga'}));
});
test('autor comenta mas não atribui, encerra ou acessa relatos de terceiros',()=>{
 const s=fresh();let r=createIncident(s,author,input);
 r=updateIncident(s,[],author,{id:r.id,version:r.version,action:'comment',message:'Mais informações'});
 for(const action of ['assign','status'])assert.throws(()=>updateIncident(s,[manager],author,{id:r.id,version:r.version,action,status:'cancelled',assigneeId:'m',message:'Tentativa indevida'}));
 assert.throws(()=>updateIncident(s,[],{...author,id:'outro'},{id:r.id,version:r.version,action:'comment',message:'Tentativa indevida'}));
 assert.throws(()=>updateIncident(s,[],author,{id:r.id,version:r.version,action:'comment',message:' '}));
});
test('responsável exige gestão ativa e cancelamento exige justificativa',()=>{
 const s=fresh(),r=createIncident(s,author,input),base={id:r.id,version:r.version,action:'assign',assigneeId:'m',message:'Designação da gestão'};
 for(const m of [{...manager,active:false},{...manager,tenant:'b'},{...manager,role:'zelador'},{...manager,validUntil:'2020-01-01'}])assert.throws(()=>updateIncident(s,[m],manager,base));
 assert.throws(()=>updateIncident(s,[],manager,{...base,action:'status',status:'cancelled',message:''}));
 assert.equal(updateIncident(s,[],manager,{...base,action:'status',status:'cancelled'}).status,'cancelled');
});
