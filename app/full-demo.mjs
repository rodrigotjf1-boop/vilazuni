import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {seed} from './domain.mjs';
import {DELEGATIONS,ROLE_NAMES} from './permissions.mjs';
import {effectiveBinding,tenantSettings,usersInTenant} from './tenants.mjs';
import {prepareBinding,validBinding} from './access.mjs';
import {createResident,localDay} from './residents.mjs';
import {saveMemberProfile} from './member-profiles.mjs';
import {grantCaretakerContacts} from './household-access.mjs';
import {notifyChanges} from './notifications.mjs';
import {seedDemoOperations} from './demo-operations.mjs';
import {seedDemoFinance} from './demo-finance.mjs';
import {seedDemoCommunity} from './demo-community.mjs';

export const FULL_DEMO_PACK='vilazuni-completo-v1';
const portrait='data:image/png;base64,'+(await readFile(new URL('./demo-avatar.png',import.meta.url))).toString('base64');
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const phone=n=>'1202555'+String(100+Number(n)).padStart(4,'0');
const fictitious=name=>name+' (fictício)';
const names=['Ricardo Almeida','Mariana Costa','Paulo Henrique','Fernanda Souza','André Martins','Juliana Ribeiro','Eduardo Lima','Beatriz Santos','Rafael Oliveira','Patrícia Gomes','Marcelo Nunes','Renata Alves','Bruno Teixeira','Luciana Dias'];
const moduleDefinitions=[
 ['people','Pessoas, casas e contatos','houses',['residents','memberProfiles','communityProfiles']],
 ['stays','Estadias e autorizações','stays',['stays']],
 ['tasks','Tarefas e agenda do zelador','tasks',['tasks']],
 ['maintenance','Manutenção preventiva','maintenance',['maintenance']],
 ['materials','Materiais e movimentações','materials',['materials','materialMovements']],
 ['incidents','Ocorrências e acompanhamento','incidents',['incidents']],
 ['facilities','Dependências e reservas','facilities',['facilities','reservations']],
 ['parcels','Encomendas e entregas','parcels',['parcels']],
 ['purchases','Fornecedores, cotações e compras','purchases',['suppliers','purchases']],
 ['documents','Documentos e versões','documents',['documents']],
 ['finance','Financeiro, orçamento e cobranças manuais','finance',['financialFunds','financialAccounts','financialEntries','financialPayables','financialReceivables','financialBudgets','financialAssessments','financialRecurringTemplates','financialAgreements','financialStatements','financialClosures','financialFeeRules','financialFeeAccruals','financialManualRequests','financialCollectionCases','financialReminders']],
 ['board','Mural e avisos importantes','board',['communityNotices']],
 ['polls','Enquetes da comunidade','polls',['consultativePolls']],
 ['assemblies','Assembleias, votos e atas','assemblies',['assemblies']],
 ['knowledge','Documentos de referência e consultas','consult',['knowledgeSources','knowledgeBriefings']],
 ['alerts','Alertas para conferência','alerts',['operationalAlerts']],
 ['privacy','Pedidos de privacidade','privacy',['privacyRequests']],
 ['notifications','Notificações por perfil','notifications',['notifications']],
 ['physical','Portaria e câmeras simuladas','physical',['accessDevices','accessCommands','physicalEvents']],
 ['channels','Canais e resumos de exemplo','channels',['channels','channelOutbox']],
 ['payments','Conexão Asaas: preparo sem emissão real','payments',[]],
 ['automation','Agente WhatsApp: preparo sem envio real','automation',[]]
];
function ownerIdentity(db,user){const identity=db.users.find(p=>p.id===user.id&&!p.demoIdentity);if(!identity||user.role!=='sindico'||!validBinding(db.state,user))fail('A demonstração completa é criada pela conta de síndico.');return identity;}
function existingFor(db,identity,source){return (db.state.tenants||[]).find(t=>t.demoMode===true&&t.demoOwnerId===identity.id&&t.demoSourceTenant===source&&t.demoPack===FULL_DEMO_PACK);}
function demoTenant(db,identity,tenantId){const t=(db.state.tenants||[]).find(t=>t.id===tenantId&&t.demoMode===true&&t.demoOwnerId===identity.id),binding=t&&effectiveBinding(db,identity,t.id);if(!t||t.status==='closed'||!binding||binding.role!=='sindico'||!validBinding(db.state,binding))fail('Demonstração fora do seu acesso.');return t;}
function catalogue(db,tenantId){return moduleDefinitions.map(([key,label,page,collections])=>({key,label,page,count:collections.reduce((sum,name)=>sum+(db.state[name]||[]).filter(r=>r.tenant===tenantId).length,0),status:['payments','automation'].includes(key)?'simulation':'ready'}));}
function counts(db,tenantId){return Object.fromEntries(Object.entries(db.state).filter(([,v])=>Array.isArray(v)).map(([key,records])=>[key,records.filter(r=>r.tenant===tenantId).length]));}
export function previewFullDemo(db,user){
 const identity=ownerIdentity(db,user),source=tenantSettings(db.state,user.tenant);if(source.demoMode)fail('Você já está na demonstração. Use os perfis para explorar.');
 const t=existingFor(db,identity,user.tenant),fingerprint=createHash('sha256').update(JSON.stringify({pack:FULL_DEMO_PACK,owner:identity.id,source:user.tenant,version:source.version,demo:t?.id||null})).digest('hex');
 return {pack:FULL_DEMO_PACK,fingerprint,exists:!!t,tenantId:t?.id||null,name:'Condomínio Chandra · Demonstração',counts:t?counts(db,t.id):{houses:14,owners:14,annual:2,profiles:24},modules:t?catalogue(db,t.id):moduleDefinitions.map(([key,label,page])=>({key,label,page,count:null,status:['payments','automation'].includes(key)?'simulation':'ready'})),isolated:true};
}
function addPerson(db,syndic,tenant,name,key,binding={},now=Date.now()){
 const email='demo-'+key+'-'+tenant.slice(0,8)+'@example.invalid',id=randomUUID();
 const credential={salt:randomBytes(16).toString('hex'),hash:randomBytes(64).toString('hex')};
 const data=binding.role==='sindico'?{role:'sindico',houses:['c01'],delegations:[],validUntil:null,accessVersion:0}:prepareBinding(db.state,syndic,binding,now);
 const p={id,name:fictitious(name),email,tenant,active:true,...data,...credential,demoIdentity:true,demoPack:FULL_DEMO_PACK,demoKey:key,credentialVersion:0};db.users.push(p);return p;
}
export function createFullDemo(db,user,input,now=Date.now()){
 const preview=previewFullDemo(db,user);if(input.fingerprint!==preview.fingerprint)fail('A prévia mudou. Abra novamente a demonstração.',409);
 if(preview.exists)return {tenantId:preview.tenantId,created:false,counts:preview.counts};
 const next=structuredClone(db),identity=next.users.find(p=>p.id===user.id),tenant=randomUUID(),source=user.tenant,date=days=>localDay(now+days*86400000);let s=next.state;
 const t={id:tenant,tenant,name:'Condomínio Chandra · Demonstração',municipality:'Arraial do Cabo',state:'RJ',timezone:'America/Sao_Paulo',legalRegime:'Cenário fictício de exploração; regras ilustrativas',version:1,status:'pilot',plan:'Demonstração completa',limits:{users:100,units:500},features:Object.keys(DELEGATIONS),history:[],demoMode:true,demoPack:FULL_DEMO_PACK,demoOwnerId:user.id,demoSourceTenant:source,demoCreatedAt:new Date(now).toISOString()};
 s.tenants??=[];s.tenants.push(t);identity.memberships??=[];identity.memberships.push({id:identity.id,name:identity.name,email:identity.email,tenant,role:'sindico',houses:[],active:true,validUntil:null,delegations:[],accessVersion:0});
 const houses=seed().houses.map(h=>({...h,tenant,owners:[],demoPack:FULL_DEMO_PACK,version:1}));s.houses.push(...houses);
 const sampleSyndic={id:'creating-demo',tenant,role:'sindico',name:'Preenchimento fictício',active:true},syndic=addPerson(next,sampleSyndic,tenant,'Ricardo Almeida','syndic',{role:'sindico'},now);
 const actors={syndic,owners:[],annualTenants:[],temporaryTenants:[]};
 for(let i=0;i<14;i++){
  const house=houses[i],owner=addPerson(next,syndic,tenant,names[i],'owner-'+house.number,{role:'proprietario',houses:[house.id]},now);actors.owners.push(owner);
  createResident(s,syndic,{houseId:house.id,kind:'owner',name:owner.name,email:owner.email,phone:phone(i+1),whatsapp:phone(i+1),contact:'Contato fictício reservado para demonstração',ownerOccupancy:[1,2,3,4,5,6,8].includes(i)?'rented':'resident',startDate:date(-180),vehicles:['FIC'+String(i+1).padStart(4,'0')],photo:portrait},now);
 }
 for(const [n,name] of [[2,'Camila Rocha'],[5,'Lucas Barbosa']]){
  const record=createResident(s,syndic,{houseId:'c'+String(n).padStart(2,'0'),kind:'annual',name:fictitious(name),email:'contrato-'+n+'@example.invalid',phone:phone(20+n),whatsapp:phone(20+n),contact:'Inquilino e contrato fictícios',startDate:date(-45),contractEndDate:date(320),plannedEndDate:date(320),contractReference:'DEMO-ANUAL-'+n,people:[fictitious(name),fictitious(n===2?'Pedro Rocha':'Ana Barbosa')],vehicles:['LOC'+String(n).padStart(4,'0')],photo:portrait},now).record;
  actors.annualTenants.push(addPerson(next,syndic,tenant,name,'annual-'+n,{role:'ocupante',residentId:record.id},now));
 }
 actors.caretaker=addPerson(next,syndic,tenant,'Carlos Ferreira','caretaker',{role:'zelador'},now);
 actors.portaria=addPerson(next,syndic,tenant,'Joana Ribeiro','portaria',{role:'portaria'},now);
 actors.administrator=addPerson(next,syndic,tenant,'Imobiliária Horizonte','administrator',{role:'administradora',delegations:Object.keys(DELEGATIONS),delegationReason:'Apoio fictício à administração',purchaseLimitCents:10000000,validUntil:new Date(now+365*86400000).toISOString()},now);
 actors.subsindico=addPerson(next,syndic,tenant,'Helena Duarte','subsindico',{role:'subsindico',delegations:['tasks','maintenance','communications','facilities'],delegationReason:'Apoio fictício à operação',validUntil:new Date(now+365*86400000).toISOString()},now);
 actors.realEstate=addPerson(next,syndic,tenant,'Locação Praia Azul','real-estate',{role:'imobiliaria',houses:['c03','c04'],validUntil:new Date(now+365*86400000).toISOString()},now);
 const ctx={pack:FULL_DEMO_PACK,houses,users:actors,portrait,phone};
 ctx.operations=seedDemoOperations(next,syndic,ctx,now);
 for(const stay of (ctx.operations.stays||[]).filter(r=>r.status==='approved'&&Date.parse(r.start)<=now&&now<Date.parse(r.end)).slice(0,2))actors.temporaryTenants.push(addPerson(next,syndic,tenant,stay.responsible.replace(/ \(fictício\)$/,''),'guest-'+stay.houseId,{role:'temporario',stayId:stay.id},now));
 const people=usersInTenant(next.users,tenant);
 for(let i=0;i<people.length;i++){const p=people[i];if(!p.demoIdentity)continue;const ownerIndex=actors.owners.findIndex(person=>person.id===p.id),residential=(s.residents||[]).find(r=>r.tenant===tenant&&r.id===p.residentId),stay=(s.stays||[]).find(r=>r.tenant===tenant&&r.id===p.stayId),number=p.role==='sindico'?phone(70):p.role==='zelador'?phone(71):ownerIndex>=0?phone(ownerIndex+1):residential?.phone||stay?.phone||phone(40+i);saveMemberProfile(s,people,syndic,{userId:p.id,version:0,age:p.role==='sindico'?52:p.role==='zelador'?47:25+i%38,phone:number,whatsapp:number,photo:portrait},now);}
 grantCaretakerContacts(s,people,syndic,{houseId:'c02',userId:actors.caretaker.id,expiresOn:date(30),reason:'Demonstração de autorização temporária para atendimento'},now);
 ctx.finance=seedDemoFinance(next,syndic,ctx,now);s=next.state;ctx.community=seedDemoCommunity(next,syndic,ctx,now);s=next.state;
 notifyChanges(db.state,s,usersInTenant(next.users,tenant),{id:'demo-import',tenant,name:'Preenchimento fictício'},now);
 for(const [key,records] of Object.entries(s))if(Array.isArray(records))for(const record of records)if(record.tenant===tenant){record.demoPack??=FULL_DEMO_PACK;if(key!=='tenants')record.demoKey??=key+':'+record.id;}
 s.audit??=[];s.audit.unshift({id:randomUUID(),tenant,actor:user.name,actorId:user.id,action:'Demonstração completa criada com dados fictícios',at:new Date(now).toISOString(),demoPack:FULL_DEMO_PACK});
 Object.assign(db,next);return {tenantId:tenant,created:true,counts:counts(db,tenant)};
}
export function fullDemoView(db,identity,user,now=Date.now()){
 const t=demoTenant(db,identity,user.tenant),profiles=usersInTenant(db.users,t.id).filter(p=>p.demoIdentity&&validBinding(db.state,p,now)).map(p=>({id:p.id,name:p.name,role:p.role,roleName:ROLE_NAMES[p.role],houses:(p.houses||[]).map(id=>({id,number:db.state.houses.find(h=>h.tenant===t.id&&h.id===id)?.number||id}))}));
 return {demo:true,tenantId:t.id,sourceTenant:t.demoSourceTenant,name:t.name,createdAt:t.demoCreatedAt,profiles,modules:catalogue(db,t.id),counts:counts(db,t.id),simulatedIntegrations:['Asaas sem emissão real','WhatsApp/Evolution e Telegram sem envios','IA em consulta local','Portaria e câmera em simulador','Notificações locais']};
}
export function demoMembership(db,identity,tenantId){const t=demoTenant(db,identity,tenantId);return effectiveBinding(db,identity,t.id);}
export function demoProfile(db,identity,tenantId,userId,now=Date.now()){
 demoTenant(db,identity,tenantId);const target=db.users.find(p=>p.id===userId&&p.tenant===tenantId&&p.demoIdentity===true),user=target&&effectiveBinding(db,target,tenantId);if(!user||!validBinding(db.state,user,now))fail('Perfil fictício fora da demonstração ou com período encerrado.');return user;
}
export function demoSource(db,identity,tenantId){const t=demoTenant(db,identity,tenantId),target=effectiveBinding(db,identity,t.demoSourceTenant);if(!target||!validBinding(db.state,target))fail('O vínculo do condomínio de origem não está disponível.');return target;}
