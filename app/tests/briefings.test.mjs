import {test} from 'node:test';import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {createSource,publishSource,toggleSource} from '../knowledge.mjs';
import {previewBriefing,saveBriefing,visibleBriefings} from '../briefings.mjs';

const now=Date.parse('2026-10-20T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'chandra',role:'sindico'},owner={id:'p',tenant:'chandra',role:'proprietario',houses:['c01']},editor={...root,role:'administradora',delegations:['knowledge']};
function publish(s,audience='community'){const r=createSource(s,root,{title:audience==='community'?'Regra pública sintética':'Segredo interno sintético',reference:'Regimento de teste, item 1',body:audience==='community'?'Piscina: conferir a regra antes do uso.':'Manutenção restrita, sem publicação aos moradores.',audience,effectiveFrom:'2026-10-01',reason:'Teste sintético'},now);return publishSource(s,root,{id:r.id,version:1,reviewed:true,reason:'Revisão sintética'},now);}
function save(s,u,audience){return saveBriefing(s,u,previewBriefing(s,u,{audience},now),now);}

test('resumo da comunidade usa somente fontes liberadas e exclui indicadores e dados pessoais mesmo solicitado pelo síndico',()=>{
 const s=seed();publish(s);publish(s,'management');s.tasks.push({id:'privada',tenant:'outro',status:'todo',due:'2020-01-01',title:'Tarefa sigilosa'});
 const preview=previewBriefing(s,root,{audience:'community'},now),serialized=JSON.stringify(preview);
 assert.equal(preview.sources.length,1);assert.deepEqual(preview.sections,[]);assert.deepEqual(preview.requiredModules,[]);assert.ok(!serialized.includes('Segredo'));assert.ok(!serialized.includes('Marina'));assert.ok(!serialized.includes('Tarefa sigilosa'));
 saveBriefing(s,root,preview,now);assert.equal(visibleBriefings(s,owner,now).length,1);assert.equal(visibleBriefings(s,{...root,tenant:'outro'},now).length,0);
});
test('resumo privado exige todos os módulos dos indicadores em cada leitura e não concede esses módulos ao editor',()=>{
 const s=seed();publish(s,'management');const own=previewBriefing(s,editor,{audience:'management'},now);assert.deepEqual(own.sections,[]);
 const full=previewBriefing(s,root,{audience:'management'},now);assert.equal(full.sections.find(s=>s.module==='tasks').open,3);saveBriefing(s,root,full,now);
 assert.equal(visibleBriefings(s,root,now).length,1);assert.equal(visibleBriefings(s,editor,now).length,0);assert.equal(visibleBriefings(s,owner,now).length,0);assert.throws(()=>previewBriefing(s,owner,{audience:'community'},now),/restritos/);
});
test('prévia não grava; confirmação recusa mudança de dados e preserva revisões sem duplicar tentativas iguais',()=>{
 const s=seed();publish(s);const before=structuredClone(s),p=previewBriefing(s,root,{audience:'management'},now);assert.deepEqual(s,before);
 s.tasks[0].status='done';assert.throws(()=>saveBriefing(s,root,p,now),/mudaram/);assert.equal(s.knowledgeBriefings,undefined);
 const fresh=previewBriefing(s,root,{audience:'management'},now),r=saveBriefing(s,root,fresh,now);assert.throws(()=>saveBriefing(s,root,fresh,now),/resumo mudou/);
 const repeated=save(s,root,'management');assert.equal(repeated.id,r.id);assert.equal(repeated.repeated,true);assert.equal(s.knowledgeBriefings.length,1);
 s.tasks[1].status='done';save(s,root,'management');assert.equal(s.knowledgeBriefings[0].version,2);assert.equal(s.knowledgeBriefings[0].history[0].sections.find(s=>s.module==='tasks').open,2);
 assert.equal(visibleBriefings(s,root,now)[0].history,undefined);
});
test('retirar fonte revoga acesso ao resumo armazenado; nova prévia gera revisão com a fonte retirada excluída',()=>{
 const s=seed(),r=publish(s);const saved=save(s,root,'community');assert.equal(visibleBriefings(s,owner,now).length,1);
 toggleSource(s,root,{id:r.id,version:r.version,active:false,reason:'Revisão necessária'},now);assert.equal(visibleBriefings(s,owner,now).length,0);
 const replacement=save(s,root,'community');assert.equal(replacement.id,saved.id);assert.equal(replacement.version,2);assert.equal(visibleBriefings(s,owner,now)[0].sources.length,0);
});
test('indicadores limitam-se ao condomínio, são calculados por módulo e o dia muda à meia-noite de Brasília',()=>{
 const s=seed();s.materials=[{tenant:'chandra',balance:0,minimum:2},{tenant:'outro',balance:0,minimum:2}];s.maintenance=[{tenant:'chandra',active:true,nextDue:'2026-10-20'},{tenant:'chandra',active:false,nextDue:'2026-10-01'}];
 const p=previewBriefing(s,root,{audience:'management'},now);assert.equal(p.sections.find(s=>s.module==='materials').belowMinimum,1);assert.equal(p.sections.find(s=>s.module==='maintenance').due,1);
 assert.equal(previewBriefing(s,root,{audience:'community'},Date.parse('2026-10-21T02:59:59Z')).day,'2026-10-20');assert.equal(previewBriefing(s,root,{audience:'community'},Date.parse('2026-10-21T03:00:00Z')).day,'2026-10-21');
});
