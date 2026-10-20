import {test} from 'node:test';import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {createPoll,votePoll,closePoll,pollsView,readPoll} from '../polls.mjs';

const now=Date.parse('2026-10-20T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'chandra',role:'sindico'},owner={id:'p',name:'Opinião identificada',tenant:'chandra',role:'proprietario',houses:['c01','c02']};
const input={title:'Qual atividade prefere?',description:'Consulta de opinião para planejar atividade sintética.',options:['Leitura','Caminhada'],audience:'residents',closesAt:'2026-10-21T18:00',reason:'Planejamento sintético',consultative:true};
test('uma resposta por conta, inclusive com várias casas; resultados ficam fechados aos participantes enquanto aberta',()=>{
 const s=seed(),p=createPoll(s,root,input,now),payload={id:p.id,version:1,optionId:p.options[0].id};
 assert.equal(readPoll(s,owner,p.id,now).total,null);const voted=votePoll(s,owner,payload,now);assert.equal(voted.myOptionId,payload.optionId);assert.equal(voted.canVote,false);assert.equal(voted.total,null);assert.equal(voted.options[0].count,undefined);assert.equal(JSON.stringify(voted).includes(owner.name),false);assert.equal(voted.votes,undefined);
 votePoll(s,owner,payload,now);assert.equal(s.consultativePolls[0].votes.length,1);assert.throws(()=>votePoll(s,owner,{...payload,optionId:p.options[1].id},now),/já foi registrada/);assert.equal(readPoll(s,root,p.id,now).total,1);
});
test('enquete consultiva é separada de assembleia; coproprietários com contas distintas são opiniões distintas',()=>{
 const s=seed(),p=createPoll(s,root,input,now);for(const id of ['p','q'])votePoll(s,{...owner,id,houses:['c01']},{id:p.id,version:1,optionId:p.options[0].id},now);
 closePoll(s,root,{id:p.id,version:1,status:'closed',reason:'Consulta concluída'},now);const results=readPoll(s,owner,p.id,now);assert.equal(results.total,2);assert.equal(results.options[0].count,2);assert.match(results.notice,/Sem quórum, voto por unidade/);assert.equal(results.history,undefined);assert.equal(results.votes,undefined);
});
test('público e condomínio são reavaliados na lista, ficha e envio; gestão de fontes não concede governança',()=>{
 const s=seed(),p=createPoll(s,root,input,now),gate={...owner,role:'portaria'},other={...owner,tenant:'outro'},editor={...root,role:'subsindico',delegations:['knowledge']};
 for(const u of [gate,other]){assert.equal(pollsView(s,u,now).polls.length,0);assert.throws(()=>readPoll(s,u,p.id,now),/indisponível/);assert.throws(()=>votePoll(s,u,{id:p.id,version:1,optionId:p.options[0].id},now),/indisponível/);}
 assert.throws(()=>createPoll(s,editor,input,now),/restrito/);assert.throws(()=>closePoll(s,editor,{id:p.id,version:1,status:'closed',reason:'Teste'},now),/restrito/);
 const all=createPoll(s,root,{...input,audience:'all'},now);assert.equal(readPoll(s,gate,all.id,now).canVote,true);
});
test('encerramento por prazo ou decisão bloqueia resposta, opção de outra enquete e versão antiga não são aceitas',()=>{
 const s=seed(),p=createPoll(s,root,input,now),q=createPoll(s,root,input,now),payload={id:p.id,version:1,optionId:p.options[0].id};
 assert.throws(()=>votePoll(s,owner,{...payload,optionId:q.options[0].id},now),/desta enquete/);assert.throws(()=>votePoll(s,owner,payload,Date.parse(p.closesAt)),/não recebe/);assert.equal(readPoll(s,owner,p.id,Date.parse(p.closesAt)).status,'closed');
 closePoll(s,root,{id:p.id,version:1,status:'cancelled',reason:'Consulta retirada'},now);assert.throws(()=>votePoll(s,owner,payload,now),/não recebe/);assert.throws(()=>closePoll(s,root,{id:p.id,version:1,status:'closed',reason:'Versão antiga'},now),/mudou/);
 assert.equal(s.consultativePolls[0].votes.length,0);
});
test('opções duplicadas, público inválido, prazo e reconhecimento consultivo são validados antes de gravar',()=>{
 const s=seed(),before=structuredClone(s);
 for(const patch of [{options:['Ação','acao']},{options:['Única']},{audience:'procuradores'},{closesAt:'2026-10-01T18:00'},{closesAt:'2026-02-30T18:00'},{closesAt:'2027-12-01T18:00'},{consultative:false}])assert.throws(()=>createPoll(s,root,{...input,...patch},now));
 assert.deepEqual(s,before);
});
