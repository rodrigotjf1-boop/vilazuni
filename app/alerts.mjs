import {randomUUID} from 'node:crypto';import {can} from './permissions.mjs';import {validBinding} from './access.mjs';import {localDay} from './residents.mjs';import {documentAlerts} from './documents.mjs';import {text} from './knowledge.mjs';

const active=(state,user,now)=>validBinding(state,user,now);
function mayRead(alert,user){return alert.tenant===user.tenant&&(can(user,'communications')&&can(user,alert.module)||alert.recipients.includes(user.id)&&(!alert.houseId||user.houses?.includes(alert.houseId)));}
function view(alert,user){const manager=can(user,'communications')&&can(user,alert.module),{sourceId,recipients,...safe}=structuredClone(alert);return {...safe,canManage:manager,...(manager?{sourceId,recipients}:{})};}
export function alertsView(state,user){return (state.operationalAlerts||[]).filter(a=>mayRead(a,user)).map(a=>view(a,user)).reverse();}
export function prepareAlerts(state,users,user,input,now=Date.now()){
 if(!can(user,'communications'))throw Error('Preparação de alertas exige gestão de comunicação.');const day=localDay(now),facts=[];
 if(can(user,'tasks'))for(const t of state.tasks.filter(t=>t.tenant===user.tenant&&['todo','doing','review'].includes(t.status)&&t.due&&t.due<day))facts.push({module:'tasks',sourceId:t.id,kind:'task-overdue',title:'Prazo de tarefa vencido',message:'Uma tarefa permanece aberta após o prazo cadastrado.',sourceVersion:t.version||0});
 if(can(user,'materials'))for(const m of (state.materials||[]).filter(m=>m.tenant===user.tenant&&m.balance<m.minimum))facts.push({module:'materials',sourceId:m.id,kind:'stock-low',title:'Estoque abaixo do mínimo',message:'O saldo cadastrado está abaixo do mínimo informado.',sourceVersion:m.version||0});
 if(can(user,'maintenance'))for(const p of (state.maintenance||[]).filter(p=>p.tenant===user.tenant&&p.active&&p.nextDue<=day))facts.push({module:'maintenance',sourceId:p.id,kind:'maintenance-due',title:'Preventiva com geração devida',message:'Um plano ativo atingiu a data cadastrada para gerar execução.',sourceVersion:p.version||0});
 if(can(user,'documents'))for(const d of documentAlerts(state,user,now))facts.push({module:'documents',sourceId:d.id,kind:'document-due',title:'Prazo de documento a conferir',message:'Um documento entrou no período de alerta cadastrado.',sourceVersion:d.version});
 state.operationalAlerts??=[];let created=0;
 for(const fact of facts){const key=[user.tenant,day,fact.kind,fact.sourceId,fact.sourceVersion].join(':');if(state.operationalAlerts.some(a=>a.key===key))continue;
  const recipients=users.filter(u=>u.tenant===user.tenant&&active(state,u,now)&&can(u,fact.module)&&can(u,'communications')).map(u=>u.id);state.operationalAlerts.push({id:randomUUID(),tenant:user.tenant,key,...fact,recipients,houseId:null,status:'checking',version:1,day,createdAt:new Date(now).toISOString(),history:[{at:new Date(now).toISOString(),actor:user.name,action:'Sinal objetivo preparado para conferência',message:'Condição baseada no cadastro, sem concluir infração.'}]});created++;
 }
 return {created};
}
export function createIncidentAlert(state,users,user,input,now=Date.now()){
 if(!can(user,'communications')||!can(user,'incidents'))throw Error('Triagem exige comunicação e ocorrências privadas.');
 const source=(state.incidents||[]).find(i=>i.id===input.incidentId&&i.tenant===user.tenant);if(!source)throw Error('Ocorrência indisponível.');
 const ids=[...new Set(input.recipients||[])];if(!ids.length||ids.length>20)throw Error('Escolha de um a vinte destinatários.');
 for(const id of ids){const u=users.find(u=>u.id===id&&u.tenant===user.tenant&&active(state,u,now));if(!u||!(can(u,'communications')&&can(u,'incidents'))&&!(source.houseId&&u.houses?.includes(source.houseId)&&['proprietario','imobiliaria','ocupante'].includes(u.role)))throw Error('Destinatário fora do escopo desta triagem.');}
 const alert={id:randomUUID(),tenant:user.tenant,key:randomUUID(),module:'incidents',kind:'incident-triage',sourceId:source.id,houseId:source.houseId||null,title:text(input.title,'Assunto factual',160),message:text(input.message,'Mensagem revisada aos destinatários',1500),recipients:ids,status:'allegation',version:1,day:localDay(now),createdAt:new Date(now).toISOString(),history:[{at:new Date(now).toISOString(),actor:user.name,action:'Alegação encaminhada para conferência',message:text(input.reason,'Justificativa da triagem',500)}]};
 if(input.reviewed!==true)throw Error('Confira a mensagem sem dados do denunciante ou conteúdo privado desnecessário.');state.operationalAlerts??=[];state.operationalAlerts.push(alert);return view(alert,user);
}
export function updateAlert(state,user,input,now=Date.now()){
 const alert=(state.operationalAlerts||[]).find(a=>a.id===input.id&&mayRead(a,user));if(!alert)throw Error('Alerta indisponível.');if(input.version!==alert.version)throw Error('O alerta mudou. Atualize.');
 const message=text(input.message,'Acompanhamento',1500),manager=can(user,'communications')&&can(user,alert.module);
 if(input.status&&(!manager||!['checking','verified','resolved'].includes(input.status)))throw Error('Apuração e encerramento exigem o módulo da origem e comunicação.');
 if(input.status)alert.status=input.status;alert.version++;alert.history.push({at:new Date(now).toISOString(),actor:user.name,action:input.status?'Apuração atualizada':'Esclarecimento recebido',message});return view(alert,user);
}
