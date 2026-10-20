import {randomUUID} from 'node:crypto';
import {DELEGATIONS} from './permissions.mjs';
import {validBinding} from './access.mjs';
import {text,fingerprint} from './knowledge.mjs';

export const allBindings=users=>users.flatMap(u=>[u,...(u.memberships||[])]);
export const usersInTenant=(users,tenant)=>allBindings(users).filter(u=>u.tenant===tenant);
export const bindingFor=(identity,tenant)=>identity&&(identity.tenant===tenant?identity:(identity.memberships||[]).find(m=>m.tenant===tenant));
const legacy={id:'chandra',tenant:'chandra',name:'Condomínio Chandra',municipality:'Arraial do Cabo',state:'RJ',timezone:'America/Sao_Paulo',legalRegime:null,version:0,status:'pilot',plan:'Piloto',limits:{users:100,units:500},features:null,history:[]};
export function tenantSettings(state,id){return structuredClone((state.tenants||[]).find(t=>t.id===id)||(id==='chandra'?legacy:{...legacy,id,tenant:id,name:'Condomínio',municipality:'A configurar',state:'A configurar'}));}
export function tenantView(state,user){const t=tenantSettings(state,user.tenant);if(user.role==='sindico')return t;const {history,limits,features,...safe}=t;return safe;}
export function effectiveBinding(db,identity,tenant){
 const binding=bindingFor(identity,tenant);if(!binding)return null;
 return {...binding,active:binding.active&&tenantSettings(db.state,tenant).status!=='closed',name:identity.name,email:identity.email,enabledModules:tenantSettings(db.state,tenant).features||Object.keys(DELEGATIONS)};
}
export function availableContexts(db,identity,now=Date.now()){
 return [identity,...(identity?.memberships||[])].filter(b=>b&&tenantSettings(db.state,b.tenant).status!=='closed'&&validBinding(db.state,b,now)).map(b=>({tenant:b.tenant,name:tenantSettings(db.state,b.tenant).name,role:b.role}));
}
function manager(user){if(user.role!=='sindico')throw Object.assign(Error('Configuração restrita ao síndico deste condomínio.'),{status:403});}
function location(input){
 const municipality=text(input.municipality,'Município',120),uf=String(input.state||'').toUpperCase();
 if(!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf))throw Error('Selecione uma UF brasileira.');
 return {municipality,state:uf};
}
function note(record,user,action,reason,now){record.history.push({at:new Date(now).toISOString(),actorId:user.id,actor:user.name,action,reason});}
export function createTenant(db,user,input,now=Date.now()){
 if(user.id!==(db.platformOwnerId||db.users[0]?.id))throw Error('Implantação de novos clientes restrita ao responsável da plataforma.');
 const identity=db.users.find(u=>u.id===user.id);if([identity,...(identity.memberships||[])].filter(b=>b.role==='sindico').length>=5)throw Error('Limite de cinco implantações por identidade neste pacote.');
 const name=text(input.name,'Nome do condomínio'),where=location(input),reason=text(input.reason,'Motivo da implantação',500);
 const id=randomUUID(),record={...structuredClone(legacy),id,tenant:id,name,...where,legalRegime:input.legalRegime?text(input.legalRegime,'Regime jurídico',200):null,version:1,history:[]};
 db.state.tenants??=[structuredClone(legacy)];db.state.tenants.push(record);note(record,user,'Cliente implantado em modo piloto',reason,now);
 identity.memberships??=[];identity.memberships.push({id:identity.id,name:identity.name,email:identity.email,tenant:id,role:'sindico',houses:[],active:true,validUntil:null,delegations:[],accessVersion:0});
 db.platformOwnerId??=db.users[0].id;return {tenant:structuredClone(record)};
}
export function updateTenant(db,user,input,now=Date.now()){
 manager(user);const current=tenantSettings(db.state,user.tenant);if(input.version!==current.version)throw Error('A configuração mudou. Atualize antes de continuar.');
 const reason=text(input.reason,'Motivo',500),name=text(input.name,'Nome do condomínio'),where=location(input),legalRegime=input.legalRegime?text(input.legalRegime,'Regime jurídico',200):null;
 const record={...current,name,...where,legalRegime,version:current.version+1};note(record,user,'Identificação do condomínio atualizada',reason,now);
 db.state.tenants??=[];const index=db.state.tenants.findIndex(t=>t.id===user.tenant);if(index<0)db.state.tenants.push(record);else db.state.tenants[index]=record;return {tenant:structuredClone(record)};
}
export function configurePlan(db,user,input,now=Date.now()){
 if(user.id!==(db.platformOwnerId||db.users[0]?.id))throw Error('Plano e limites restritos ao responsável da plataforma.');
 const current=tenantSettings(db.state,user.tenant);if(input.version!==current.version)throw Error('A configuração mudou.');
 const plan=text(input.plan,'Identificação do plano',80),reason=text(input.reason,'Motivo',500),features=input.features;
 if(!Array.isArray(features)||!features.length||features.some(m=>!Object.hasOwn(DELEGATIONS,m)))throw Error('Escolha módulos disponíveis.');
 const limits=input.limits;if(!limits||!Number.isInteger(limits.users)||limits.users<1||limits.users>10000||!Number.isInteger(limits.units)||limits.units<1||limits.units>500)throw Error('Limites: 1–10.000 contas e 1–500 unidades.');
 if(usersInTenant(db.users,user.tenant).length>limits.users||db.state.houses.filter(h=>h.tenant===user.tenant).length>limits.units)throw Error('O limite não pode ser menor que o uso atual.');
 const record={...current,plan,features:[...new Set(features)],limits:{users:limits.users,units:limits.units},version:current.version+1};note(record,user,'Plano e limites atualizados',reason,now);
 db.state.tenants??=[];const index=db.state.tenants.findIndex(t=>t.id===user.tenant);if(index<0)db.state.tenants.push(record);else db.state.tenants[index]=record;return {tenant:structuredClone(record)};
}
function unit(input,tenant){
 const number=text(input.number,'Identificação da unidade',40,1),type=text(input.type||'Unidade','Tipo',80),parking=Number(input.parking),floors=Number(input.floors),rooms=Number(input.rooms);
 if(![parking,floors,rooms].every(n=>Number.isInteger(n)&&n>=0&&n<=100))throw Error('Vagas, pavimentos e quartos: inteiros de 0 a 100.');
 const area=input.area==null||input.area===''?null:Number(input.area);if(area!==null&&(!Number.isFinite(area)||area<=0||area>100000))throw Error('Área inválida.');
 return {id:randomUUID(),tenant,number,type,parking,floors,rooms,area,parkingType:text(input.parkingType||'Disponibilidade a confirmar','Tipo de vaga',200),owners:[],active:true,version:1,side:'Localização a configurar'};
}
export function saveUnit(db,user,input,now=Date.now()){
 manager(user);const reason=text(input.reason,'Motivo',500),fresh=unit(input,user.tenant),current=input.id?db.state.houses.find(h=>h.id===input.id&&h.tenant===user.tenant):null;
 if(input.id&&!current)throw Error('Unidade indisponível.');if(current&&input.version!==(current.version||0))throw Error('A unidade mudou. Atualize.');
 if(db.state.houses.some(h=>h.tenant===user.tenant&&h.id!==current?.id&&h.number.toLocaleLowerCase('pt-BR')===fresh.number.toLocaleLowerCase('pt-BR')))throw Error('Identificação de unidade já utilizada.');
 if(!current&&db.state.houses.filter(h=>h.tenant===user.tenant).length>=tenantSettings(db.state,user.tenant).limits.units)throw Error('Limite de unidades do plano atingido.');
 if(current){const keys=['number','type','floors','rooms','area','parking','parkingType'],previous=Object.fromEntries(keys.map(key=>[key,current[key]??null]));const {id,owners,version,active,side,...fields}=fresh;Object.assign(current,fields,{version:(current.version||0)+1});current.history??=[];note(current,user,'Características atualizadas',reason,now);Object.assign(current.history.at(-1),{previous,current:Object.fromEntries(keys.map(key=>[key,current[key]??null]))});return {unit:structuredClone(current)};}
 fresh.history=[];note(fresh,user,'Unidade cadastrada',reason,now);db.state.houses.push(fresh);return {unit:structuredClone(fresh)};
}
export function exportTenant(db,user,now=Date.now()){
 manager(user);const state={};for(const [key,value] of Object.entries(db.state))if(Array.isArray(value)&&!['notifications','pushSubscriptions'].includes(key))state[key]=structuredClone(value.filter(r=>r.tenant===user.tenant));
 if(state.consultativePolls)state.consultativePolls=state.consultativePolls.map(({votes,...poll})=>({...poll,responseTotals:poll.options.map(o=>({optionId:o.id,count:votes.filter(v=>v.optionId===o.id).length})),privacy:'Respostas individuais excluídas da exportação de cliente.'}));
 const payload={format:'vilazuni-tenant-export-v1',generatedAt:new Date(now).toISOString(),tenant:tenantSettings(db.state,user.tenant),state,accounts:usersInTenant(db.users,user.tenant).map(({id,name,email,role,active,validUntil,houses})=>({id,name,email,role,active,validUntil,houses})),events:structuredClone(db.events.filter(e=>e.tenant===user.tenant))};
 return {...payload,sha256:fingerprint(payload)};
}
// Imports master data only. Financial/audit snapshots remain intact in the full export;
// identity, credentials, access rights and historical balances cannot be injected here.
export function previewMasterImport(db,user,input){
 manager(user);const data=input.data;if(!data||data.format!=='vilazuni-master-data-v1'||!Array.isArray(data.units)||data.units.length>500)throw Error('Envie o formato de cadastro mestre do Vilazuni, com até 500 unidades.');
 const units=data.units.map(item=>unit(item,user.tenant)),seen=new Set(db.state.houses.filter(h=>h.tenant===user.tenant).map(h=>h.number.toLocaleLowerCase('pt-BR')));
 for(const h of units){const key=h.number.toLocaleLowerCase('pt-BR');if(seen.has(key))throw Error('Unidade duplicada: '+h.number);seen.add(key);}
 if(seen.size>tenantSettings(db.state,user.tenant).limits.units)throw Error('Importação excede o limite de unidades.');
 const canonical=units.map(({id,...fields})=>fields);return {units:canonical,count:units.length,fingerprint:fingerprint({tenant:user.tenant,existing:[...seen].sort(),data:canonical})};
}
export function importMasterData(db,user,input,now=Date.now()){
 const preview=previewMasterImport(db,user,input),reason=text(input.reason,'Motivo da importação',500);if(preview.fingerprint!==input.fingerprint)throw Error('A prévia mudou. Confira outra vez.');
 for(const item of preview.units){const record={...item,id:randomUUID(),history:[]};note(record,user,'Unidade importada com conferência',reason,now);db.state.houses.push(record);}
 return {count:preview.count};
}
export function closeTenant(db,user,input,now=Date.now()){
 manager(user);const current=tenantSettings(db.state,user.tenant);if(current.version!==input.version||input.confirmation!==current.name||input.exportSaved!==true)throw Error('Confira a versão, digite o nome do condomínio e confirme que guardou a exportação.');const reason=text(input.reason,'Motivo e política de retenção do encerramento',1000);db.state.tenants??=[structuredClone(legacy)];let record=db.state.tenants.find(t=>t.id===user.tenant);if(!record){record=current;db.state.tenants.push(record);}record.status='closed';record.closedAt=new Date(now).toISOString();record.version++;note(record,user,'Cliente encerrado; acessos e entregas interrompidos, histórico preservado',reason,now);for(const c of db.state.channels||[])if(c.tenant===user.tenant){c.active=false;c.version++;}db.state.pushSubscriptions=(db.state.pushSubscriptions||[]).filter(r=>r.tenant!==user.tenant);return {status:'closed',notice:'Cliente encerrado com histórico preservado para retenção e restauração controlada. Nenhum dado foi apagado.'};
}
