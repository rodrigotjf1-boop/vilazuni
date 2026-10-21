import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {saveCommunityProfile,communityProfile,communityView,communitySummary,communityEditor,readCommunityPhoto,saveCommunityNotice,readCommunityNotice,markCommunityNoticeRead,archiveCommunityNotice} from '../community.mjs';
import {calendarRange,calendarTasks} from '../community-calendar.mjs';
import {createTask} from '../tasks.mjs';

const now=Date.parse('2026-10-21T12:00:00-03:00');
const manager={id:'s',name:'Gestão sintética',tenant:'chandra',role:'sindico',active:true};
const worker={id:'z',name:'Zeladoria sintética',tenant:'chandra',role:'zelador',active:true};
const owner={id:'p',name:'Proprietário sintético',tenant:'chandra',role:'proprietario',houses:['c01'],active:true};
const occupant={id:'o',name:'Ocupante sintético',tenant:'chandra',role:'ocupante',active:true};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
const profile=(patch={})=>({slot:'sindico',version:0,userId:'s',name:'Gestor sintético',age:'42',phone:'+55 (22) 99999-9999',whatsapp:'5522999999999',email:'gestao@example.test',termStart:'2026-01-01',termEnd:'2027-12-31',houseId:'c01',isOwner:true,photo:image,...patch});
const notice=(patch={})=>({version:0,title:'Aviso sintético',body:'Texto público no condomínio de teste.',...patch});

test('fichas publicam apenas cadastro explícito, fotos protegidas e vínculo ativo do mesmo condomínio',()=>{
 const s=seed(),users=[manager,worker];
 assert.equal(communityProfile(s,users,owner,'sindico',now).profile.configured,false);
 for(const u of [worker,owner,occupant])assert.throws(()=>saveCommunityProfile(s,users,u,profile(),now),/Somente/);
 const p=saveCommunityProfile(s,users,manager,profile(),now).profile;
 assert.equal(p.phone,'5522999999999');assert.equal(p.age,42);assert.equal(p.house.number,'01');assert.equal(p.isOwner,true);assert.equal(p.photo,true);
 const view=communityProfile(s,users,occupant,'sindico',now);
 assert.ok(!JSON.stringify(view).includes(image.split(',')[1]));assert.ok(!JSON.stringify(view).includes('history'));assert.equal(view.profile.name,'Gestor sintético');
 assert.ok(readCommunityPhoto(s,users,owner,'sindico',1,now).bytes.length>0);
 assert.throws(()=>readCommunityPhoto(s,users,{...owner,tenant:'other'},'sindico',1,now),/indisponível/);
 assert.throws(()=>readCommunityPhoto(s,users,owner,'sindico',0,now),/indisponível/);
 assert.equal(communityProfile(s,[{...manager,active:false}],owner,'sindico',now).profile.configured,false);
 assert.throws(()=>readCommunityPhoto(s,[{...manager,role:'proprietario'}],owner,'sindico',1,now),/indisponível/);
 assert.throws(()=>communityEditor(s,users,owner,'sindico',now),/Somente/);
});

test('fichas recusam versões antigas, casa/conta alheia e dados que não correspondem a uma foto',()=>{
 const s=seed(),users=[manager,worker];
 for(const patch of [{houseId:'estranha'},{userId:'z'},{age:'17'},{age:'42.5'},{phone:'javascript:123'},{email:'a@b\nBcc:email@example.test'},{termEnd:'2025-12-31'},{termEnd:'2027-02-30'},{photo:'data:image/svg+xml;base64,PHN2Zz4='},{photo:'data:image/png;base64,YWJjZGVmZ2hpamtsbW5vcA=='}])assert.throws(()=>saveCommunityProfile(s,users,manager,profile(patch),now));
 saveCommunityProfile(s,users,manager,profile(),now);assert.throws(()=>saveCommunityProfile(s,users,manager,profile(),now),/mudou/);
 saveCommunityProfile(s,users,manager,profile({version:1,photo:null}),now);assert.equal(communityProfile(s,users,owner,'sindico',now).profile.photo,false);
});

test('agenda mostra apenas tarefas atribuídas à conta do zelador e compartilhadas para moradores',()=>{
 const s=seed(),users=[manager,worker],secret='Orientação privada sintética';
 saveCommunityProfile(s,users,manager,profile({slot:'zelador',userId:worker.id,name:worker.name}),now);
 const a=createTask(s,users,manager,{title:'Limpeza compartilhada',area:'Piscina',due:'2026-10-21',assigneeId:worker.id,description:secret,publicSchedule:true},now);
 createTask(s,users,manager,{title:'Inspeção interna privada',area:'Portaria',due:'2026-10-21',assigneeId:worker.id,description:secret},now);
 s.tasks.push({...s.tasks.find(t=>t.id===a.id),id:'outro',tenant:'other'});
 const publicAgenda=communityProfile(s,users,occupant,'zelador',now);assert.equal(publicAgenda.tasks.length,1);assert.equal(publicAgenda.tasks[0].id,a.id);assert.equal(publicAgenda.canOpenTasks,false);assert.ok(!JSON.stringify(publicAgenda).includes(secret));
 assert.equal(communityProfile(s,users,worker,'zelador',now).tasks.length,2);assert.equal(communityProfile(s,users,manager,'zelador',now).tasks.length,2);
 assert.deepEqual(communityProfile(s,[{...worker,active:false}],occupant,'zelador',now).tasks,[]);
});

test('mural permite gestão/zelador/proprietário/inquilino, isola condomínio e impede alterar aviso alheio',()=>{
 const s=seed();for(const u of [manager,worker,owner,occupant])assert.ok(saveCommunityNotice(s,u,notice(),now).notice.id);
 for(const role of ['portaria','imobiliaria'])assert.throws(()=>saveCommunityNotice(s,{...owner,role},notice(),now),/não publica/);
 const n=saveCommunityNotice(s,owner,notice({title:'Somente autor altera'}),now).notice;
 assert.throws(()=>saveCommunityNotice(s,worker,notice({...n,body:'Alteração por outro usuário'}),now),/seus avisos/);
 assert.throws(()=>archiveCommunityNotice(s,worker,n,now),/seus avisos/);
 assert.equal(communityView(s,[],{...owner,tenant:'other'},now).notices.length,0);
 assert.throws(()=>readCommunityNotice(s,{...owner,tenant:'other'},n.id,now),/indisponível/);
 assert.throws(()=>markCommunityNoticeRead(s,{...owner,tenant:'other'},n,now),/indisponível/);
 saveCommunityNotice(s,manager,notice({...n,body:'Edição moderada válida'}),now);
});

test('leitura é individual e por versão; listar/consultar não apaga alertas, edição volta a avisar',()=>{
 const s=seed(),n=saveCommunityNotice(s,manager,notice(),now).notice;
 assert.equal(communitySummary(s,manager,now).unreadCount,0);assert.equal(communitySummary(s,owner,now).unreadCount,1);
 const before=structuredClone(s);communityView(s,[],owner,now);readCommunityNotice(s,owner,n.id,now);assert.deepEqual(s,before);
 markCommunityNoticeRead(s,owner,n,now);markCommunityNoticeRead(s,owner,n,now);assert.equal(s.communityReads.filter(r=>r.userId===owner.id).length,1);
 assert.equal(communitySummary(s,owner,now).unreadCount,0);assert.equal(communitySummary(s,worker,now).unreadCount,1);
 const updated=saveCommunityNotice(s,manager,notice({...n,body:'Novo texto precisa ser visto'}),now+1).notice;
 assert.equal(communitySummary(s,owner,now).unreadCount,1);assert.throws(()=>markCommunityNoticeRead(s,owner,n,now),/mudou/);
 markCommunityNoticeRead(s,owner,updated,now);assert.equal(communitySummary(s,owner,now).unreadCount,0);
 archiveCommunityNotice(s,manager,updated,now);assert.equal(communitySummary(s,worker,now).unreadCount,0);
});

test('validade do aviso considera Brasília e expira sem criar registros de leitura',()=>{
 const s=seed(),n=saveCommunityNotice(s,manager,notice({expiresOn:'2026-10-21'}),now).notice;
 assert.equal(communitySummary(s,owner,Date.parse('2026-10-22T02:59:59Z')).unreadCount,1);
 assert.equal(communitySummary(s,owner,Date.parse('2026-10-22T03:00:00Z')).unreadCount,0);
 assert.throws(()=>readCommunityNotice(s,owner,n.id,now+86400000),/indisponível/);
 assert.throws(()=>saveCommunityNotice(s,manager,notice({expiresOn:'2026-10-20'}),now),/validade/);
});

test('calendário usa semana segunda/domingo, mês civil e exclui tarefas canceladas',()=>{
 assert.deepEqual(calendarRange('week','2026-11-01'),{from:'2026-10-26',through:'2026-11-01'});
 assert.deepEqual(calendarRange('month','2028-02-29'),{from:'2028-02-01',through:'2028-02-29'});
 const tasks=[{id:'1',title:'Hoje',due:'2026-10-21',status:'todo'},{id:'2',title:'Cancelada',due:'2026-10-21',status:'cancelled'},{id:'3',title:'Semana',due:'2026-10-23',status:'doing'},{id:'4',title:'Mês',due:'2026-10-30',status:'done'}];
 assert.equal(calendarTasks(tasks,'day','2026-10-21').tasks.length,1);assert.equal(calendarTasks(tasks,'week','2026-10-21').tasks.length,2);assert.equal(calendarTasks(tasks,'month','2026-10-21').tasks.length,3);
 for(const day of ['2026-02-30','invalid','2026-1-01'])assert.throws(()=>calendarRange('week',day));
});
