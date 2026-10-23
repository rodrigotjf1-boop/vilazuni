import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,createStay,changeStay} from '../domain.mjs';
import {createResident} from '../residents.mjs';
import {seedDemoCommunity} from '../demo-community.mjs';
import {communitySummary,communityProfile,readCommunityPhoto} from '../community.mjs';
import {readDocumentFile,documentAlerts} from '../documents.mjs';
import {consultSources} from '../knowledge.mjs';
import {visibleBriefings} from '../briefings.mjs';
import {exportMinutes} from '../assemblies.mjs';
import {physicalView,cameraSnapshot} from '../physical.mjs';
import {validBinding} from '../access.mjs';
const now=Date.parse('2026-10-23T12:00:00-03:00'),DAY=86400000,br=ms=>new Date(ms-3*3600000).toISOString().slice(0,16);
const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2gHkAAAAASUVORK5CYII=';
function fixture(){
 const tenant='demo-community',state=seed();state.houses=state.houses.map(h=>({...h,tenant,owners:[]}));state.stays=[];state.tasks=state.tasks.map(t=>({...t,tenant,due:'2026-10-20',version:1}));state.tenants=[{id:tenant,tenant,name:'Condomínio fictício',demoMode:true,status:'demo',limits:{users:100,units:500}}];
 const user={id:'demo-syndic',tenant,role:'sindico',name:'Síndico fictício',active:true,houses:[]},caretaker={id:'demo-worker',tenant,role:'zelador',name:'Zelador fictício',active:true,houses:[]},owners=state.houses.map((h,i)=>({id:'owner-'+i,tenant,role:'proprietario',name:'Proprietário fictício '+h.number,email:'owner'+i+'@example.invalid',active:true,houses:[h.id]})),portaria={id:'demo-porter',tenant,role:'portaria',name:'Porteiro fictício',active:true,houses:[]};
 const r=createResident(state,user,{houseId:'c02',kind:'annual',name:'Inquilina fictícia',startDate:'2026-09-01',contractEndDate:'2027-09-01',people:['Inquilina fictícia']},now).record,annual={id:'demo-annual',tenant,role:'ocupante',residentId:r.id,name:'Inquilina fictícia',active:true,houses:['c02'],validUntil:'2027-09-02T00:00:00-03:00'};
 const {stay}=createStay(state,user,{houseId:'c03',responsible:'Hóspede fictício',contact:'Contato fictício',people:['Hóspede fictício'],vehicles:['DEMO03'],source:'Direta',rentalKind:'daily',start:br(now-DAY),end:br(now+DAY)},now);changeStay(state,user,stay.id,'approved','Período fictício conferido',now);
 const users=[user,caretaker,...owners,portaria,annual],db={schema:1,users,invites:[],events:[],state};return {db,user,ctx:{pack:'vilazuni-completo-v1',houses:state.houses,users:{syndic:user,caretaker,owners,annualTenants:[annual],portaria},portrait,phone:n=>'1202555'+String(100+n).padStart(4,'0')},owners,caretaker};
}
test('comunidade fictícia preenche fichas, avisos, documentos, fontes e governança com relações válidas',()=>{
 const {db,user,ctx,owners,caretaker}=fixture();assert.ok(validBinding(db.state,ctx.users.annualTenants[0],now));const result=seedDemoCommunity(db,user,ctx,now),s=db.state;
 assert.equal(result.counts.communityProfiles,2);assert.equal(result.counts.communityNotices,5);assert.equal(result.counts.documents,5);assert.equal(result.counts.consultativePolls,3);assert.equal(result.counts.assemblies,4);assert.equal(result.counts.knowledgeSources,4);assert.equal(result.counts.knowledgeBriefings,2);assert.equal(result.counts.privacyRequests,3);
 const view=communityProfile(s,db.users,user,'zelador',now);assert.equal(view.profile.userId,caretaker.id);assert.equal(view.profile.whatsapp,'12025550171');assert.equal(view.profile.photo,true);assert.equal(readCommunityPhoto(s,db.users,user,'zelador',1,now).mime,'image/png');
 const explorer={...user,id:'real-manager'};assert.ok(communitySummary(s,explorer,now).importantUnreadCount>0);assert.equal(communitySummary(s,owners[0],now).importantUnreadCount,0);
 for(const d of s.documents)for(const v of d.versions){const file=readDocumentFile(s,user,d.id,v.id);assert.equal(file.bytes.subarray(0,5).toString(),'%PDF-');assert.ok(file.bytes.toString().includes('DOCUMENTO')||file.bytes.toString().includes('FICTICIO'));}
 assert.equal(s.documents.filter(d=>d.active).length,4);assert.equal(s.documents[0].versions.length,2);assert.ok(documentAlerts(s,user,now).some(a=>a.status==='expired'));assert.ok(documentAlerts(s,user,now).some(a=>a.status==='due'));
 assert.ok(consultSources(s,user,{question:'Qual horário de funcionamento da piscina?'},now).found);assert.equal(visibleBriefings(s,user,now).length,2);const communityBriefing=visibleBriefings(s,owners[0],now);assert.equal(communityBriefing.length,1);assert.equal(communityBriefing[0].audience,'community');
 assert.deepEqual(s.assemblies.map(a=>a.status),['draft','published','running','closed']);const closed=s.assemblies.find(a=>a.status==='closed');assert.equal(exportMinutes(s,user,closed.id).minutes.roll.length,14);assert.equal(closed.agenda.length,2);assert.ok(closed.agenda.every(item=>item.votes.length===14&&item.result.approved));
 for(const [key,records] of Object.entries(s)){if(!Array.isArray(records))continue;for(const record of records.filter(r=>r.demoKey?.startsWith('community:')))assert.equal(record.demoPack,ctx.pack,key);}
});
test('canal desativado e dispositivos simulados não configuram nem despacham integrações externas',async()=>{
 const {db,user,ctx}=fixture(),previous=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('Não realizar acesso externo na demonstração.');};try{
  seedDemoCommunity(db,user,ctx,now);const s=db.state,view=physicalView(s,user);assert.ok(s.channels.every(c=>c.active===false&&c.scheduled===false));assert.deepEqual(s.channelOutbox||[],[]);assert.equal(view.devices.length,2);assert.ok(view.devices.every(d=>d.mode==='simulator'&&d.adapterKey===null));assert.equal(view.commands.length,1);assert.equal(view.commands[0].status,'simulated');assert.equal(view.events.length,1);assert.equal(view.plateEvents.length,1);assert.ok(view.plateEvents[0].notice.includes('sintética'));assert.equal((await cameraSnapshot(view.devices.find(d=>d.kind==='camera'))).mime,'image/png');assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('preenchimento comunitário recusa condomínio operacional e não duplica demonstração pronta',()=>{
 const {db,user,ctx}=fixture(),foreign={id:'foreign-doc',tenant:'other',title:'Documento real protegido',versions:[]};db.state.documents=[foreign];db.state.tenants[0].demoMode=false;const before=structuredClone(db);assert.throws(()=>seedDemoCommunity(db,user,ctx,now),/demonstração separado/);assert.deepEqual(db,before);
 db.state.tenants[0].demoMode=true;seedDemoCommunity(db,user,ctx,now);assert.deepEqual(db.state.documents.find(d=>d.id==='foreign-doc'),foreign);const ready=structuredClone(db);assert.equal(seedDemoCommunity(db,user,ctx,now).repeated,true);assert.deepEqual(db,ready);
});

test('canais fictícios usam grupo reservado distinto por contexto demonstrativo',()=>{
 const first=fixture();seedDemoCommunity(first.db,first.user,first.ctx,now);const previous=structuredClone(first.db.state.channels),second=fixture(),tenant='demo-community-second';
 for(const collection of Object.values(second.db.state))if(Array.isArray(collection))for(const record of collection)if(record.tenant===second.user.tenant)record.tenant=tenant;
 second.db.state.tenants[0].id=tenant;for(const person of second.db.users)person.tenant=tenant;second.db.state.channels=previous;
 seedDemoCommunity(second.db,second.user,second.ctx,now);assert.equal(second.db.state.channels.length,2);const channels=second.db.state.channels;assert.notEqual(channels[0].chatId,channels[1].chatId);assert.deepEqual(channels[0],previous[0]);assert.ok(channels.every(channel=>!channel.active&&!channel.scheduled));
});
