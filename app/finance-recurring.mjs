import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {requireFinance,text,date,rows,bump,openDate,activeFund} from './finance-ledger.mjs';
import {saveAssessment} from './finance-assessments.mjs';
const normalize=v=>v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const audit=(u,action,reason,now)=>({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason});
function month(value){if(typeof value!=='string'||!/^\d{4}-\d{2}$/.test(value))throw Error('Informe uma competência válida.');date(value+'-01');return value;}
function record(s,u,input){requireFinance(u,'financeClose');const t=rows(s,'financialRecurringTemplates',u.tenant).find(t=>t.id===input.id);if(!t)throw Error('Modelo recorrente indisponível.');if(!Number.isInteger(input.version)||input.version!==t.version)throw Error('O modelo mudou. Atualize antes de continuar.');return t;}
export function saveRecurringTemplate(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const existing=input.id?record(s,u,input):null,name=text(input.name,'Nome do modelo',100),referencePrefix=text(input.referencePrefix,'Prefixo de referência',60),reason=text(input.reason,'Justificativa',500),startMonth=month(input.startMonth),endMonth=input.endMonth==null||input.endMonth===''?null:month(input.endMonth);
 if(endMonth&&endMonth<startMonth)throw Error('Fim da vigência anterior ao início.');if(!Number.isInteger(input.dueDay)||input.dueDay<1||input.dueDay>31)throw Error('Dia de vencimento deve estar entre 1 e 31.');
 if(existing&&referencePrefix!==existing.referencePrefix)throw Error('O prefixo do modelo é fixo. Crie outro modelo para trocar a referência.');
 if(rows(s,'financialRecurringTemplates',u.tenant).some(t=>t.id!==existing?.id&&normalize(t.referencePrefix)===normalize(referencePrefix)))throw Error('Prefixo de modelo já registrado.');
 const a=rows(s,'financialAssessments',u.tenant).find(a=>a.id===input.sourceAssessmentId&&['approved','generated'].includes(a.status));if(!a)throw Error('Selecione um rateio aprovado ou gerado deste condomínio.');if(input.sourceVersion!==a.version)throw Error('O rateio de base mudou. Atualize antes de salvar o modelo.');activeFund(s,u,a.fundId);
 const source={assessmentId:a.id,version:a.version,title:a.title,fundId:a.fundId,fundName:a.fundName,category:a.category,basis:a.basis,totalCents:a.totalCents,method:a.method,lines:a.lines.map(l=>({houseId:l.houseId,houseNumber:l.houseNumber,debtor:l.debtor,weight:l.weight})),approval:structuredClone(a.approval)};
 const values={name,referencePrefix,startMonth,endMonth,dueDay:input.dueDay,source};
 if(existing){const before=Object.fromEntries(Object.keys(values).map(k=>[k,structuredClone(existing[k])]));Object.assign(existing,values,{version:existing.version+1});existing.history.push({...audit(u,'Modelo revisado para próximas competências',reason,now),before});bump(s,u.tenant);return structuredClone(existing);}
 const t={id:randomUUID(),tenant:u.tenant,version:1,active:true,...values,generations:[],history:[audit(u,'Modelo recorrente registrado',reason,now)]};s.financialRecurringTemplates??=[];s.financialRecurringTemplates.push(t);bump(s,u.tenant);return structuredClone(t);
}
export function toggleRecurringTemplate(s,u,input,now=Date.now()){
 const t=record(s,u,input),reason=text(input.reason,'Motivo',500);if(typeof input.active!=='boolean'||input.active===t.active)throw Error('Alteração do modelo inválida.');t.active=input.active;t.version++;t.history.push(audit(u,t.active?'Modelo reativado':'Modelo pausado',reason,now));bump(s,u.tenant);return structuredClone(t);
}
export function prepareRecurringAssessment(s,u,input,now=Date.now()){
 const t=record(s,u,input),competence=month(input.month),issuedOn=openDate(s,u,input.issuedOn||localDay(now),now),reason=text(input.reason,'Conferência da competência',500);
 if(!t.active)throw Error('Reative o modelo antes de preparar nova competência.');if(competence<t.startMonth||t.endMonth&&competence>t.endMonth)throw Error('Competência fora da vigência do modelo.');
 if(t.generations.some(g=>g.month===competence))throw Error('Competência já preparada por este modelo, inclusive se o rateio foi cancelado. Consulte o registro existente.');
 if(typeof input.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId))throw Error('Identificador da operação inválido.');
 if(rows(s,'financialRecurringTemplates',u.tenant).some(x=>x.generations.some(g=>g.operationId===input.operationId)))throw Error('Preparação já registrada.');
 const end=new Date(competence+'-01T12:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);const dueOn=date(competence+'-'+String(Math.min(t.dueDay,end.getUTCDate())).padStart(2,'0'));
 const next=structuredClone(s),template=rows(next,'financialRecurringTemplates',u.tenant).find(x=>x.id===t.id),a=saveAssessment(next,u,{...structuredClone(t.source),reference:t.referencePrefix+' · '+competence,month:competence,issuedOn,dueOn,reason},now);
 const saved=next.financialAssessments.find(x=>x.id===a.id);Object.assign(saved,{recurringTemplateId:t.id,recurringTemplateVersion:t.version,recurringTemplateName:t.name});
 template.generations.push({month:competence,assessmentId:a.id,templateVersion:t.version,operationId:input.operationId,at:new Date(now).toISOString(),actor:u.name});template.version++;template.history.push(audit(u,'Rascunho preparado para '+competence,reason,now));bump(next,u.tenant);
 s.financialAssessments=next.financialAssessments;s.financialRecurringTemplates=next.financialRecurringTemplates;s.financialRevisions=next.financialRevisions;return {template:structuredClone(template),assessment:structuredClone(saved)};
}
