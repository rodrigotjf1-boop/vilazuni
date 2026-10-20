import {randomUUID} from 'node:crypto';import {can} from './permissions.mjs';import {localDay} from './residents.mjs';import {createTask} from './tasks.mjs';
function text(v,label,max=160){if(typeof v!=='string'||v.trim().length<3||v.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return v.trim();}
function day(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00Z'))||new Date(v+'T12:00Z').toISOString().slice(0,10)!==v)throw Error('Informe uma data válida.');return v;}
const permit=u=>{if(!can(u,'maintenance'))throw Error('Acesso restrito à manutenção preventiva.');};
export function visibleMaintenance(state,user){return can(user,'maintenance')?structuredClone((state.maintenance||[]).filter(p=>p.tenant===user.tenant)):[];}
export function createMaintenance(state,users,user,input,now=Date.now()){
 permit(user);const intervalDays=input.intervalDays;if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>3660)throw Error('Intervalo deve ser de 1 a 3660 dias.');
 const checklist=Array.isArray(input.checklist)?input.checklist.map(s=>text(s,'Item do checklist',200)):[];if(!checklist.length||checklist.length>20)throw Error('Informe de 1 a 20 itens de checklist.');
 let assigneeId=input.assigneeId||null;if(assigneeId&&!users.some(p=>p.id===assigneeId&&p.tenant===user.tenant&&p.role==='zelador'&&p.active&&(!p.validUntil||Date.parse(p.validUntil)>now)))throw Error('Selecione uma conta ativa da zeladoria.');
 const plan={id:randomUUID(),tenant:user.tenant,title:text(input.title,'Título'),area:text(input.area,'Equipamento / local'),description:text(input.description,'Orientações',1500),intervalDays,nextDue:day(input.nextDue),checklist,assigneeId,active:true,version:0,history:[{at:new Date(now).toISOString(),actor:user.name,action:'Plano criado'}]};state.maintenance??=[];state.maintenance.push(plan);return structuredClone(plan);
}
function editable(state,user,input){permit(user);const plan=(state.maintenance||[]).find(p=>p.id===input.id&&p.tenant===user.tenant);if(!plan)throw Error('Plano indisponível.');if(!Number.isInteger(input.version)||input.version!==plan.version)throw Error('O plano mudou. Atualize antes de continuar.');return plan;}
export function toggleMaintenance(state,user,input,now=Date.now()){const p=editable(state,user,input),reason=text(input.reason,'Motivo',500);if(typeof input.active!=='boolean'||input.active===p.active)throw Error('Alteração de plano inválida.');p.active=input.active;p.version++;p.history.push({at:new Date(now).toISOString(),actor:user.name,action:(p.active?'Plano reativado':'Plano pausado')+' · '+reason});return structuredClone(p);}
export function generateMaintenance(state,users,user,input,now=Date.now()){
 const p=editable(state,user,input);if(!can(user,'tasks'))throw Error('Gerar execução exige também delegação de tarefas.');if(!p.active||p.nextDue>localDay(now))throw Error('Plano pausado ou ainda fora do prazo de geração.');
 if(state.tasks.some(t=>t.tenant===user.tenant&&t.maintenanceId===p.id&&!['done','cancelled'].includes(t.status)))throw Error('Já existe execução aberta deste plano.');
 const nextDue=new Date(Date.parse(p.nextDue+'T12:00Z')+p.intervalDays*86400000).toISOString().slice(0,10);day(nextDue);
 const assigneeId=users.some(u=>u.id===p.assigneeId&&u.tenant===user.tenant&&u.role==='zelador'&&u.active&&(!u.validUntil||Date.parse(u.validUntil)>now))?p.assigneeId:null;
 const task=createTask(state,users,user,{title:p.title,area:p.area,description:p.description,due:p.nextDue,assigneeId},now);const stored=state.tasks.find(t=>t.id===task.id);stored.maintenanceId=p.id;stored.cycleDate=p.nextDue;stored.checklist=p.checklist.map(label=>({id:randomUUID(),label,done:false}));
 p.nextDue=nextDue;p.version++;p.history.push({at:new Date(now).toISOString(),actor:user.name,action:'Execução gerada para '+stored.cycleDate+(p.assigneeId&&!assigneeId?' · Responsável indisponível; atribuir na tarefa':''),taskId:task.id});return {plan:structuredClone(p),taskId:task.id};
}
