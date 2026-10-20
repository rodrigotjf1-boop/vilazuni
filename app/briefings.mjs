import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
import {documentAlerts} from './documents.mjs';
import {publishedSources,fingerprint} from './knowledge.mjs';

const modules=['tasks','materials','maintenance','documents'];
const requireManager=user=>{if(!can(user,'knowledge'))throw Error('Resumos restritos à gestão de fontes e resumos.');};
function content(state,user,audience,now){
 requireManager(user);if(!['community','management'].includes(audience))throw Error('Escolha o público do resumo.');
 const day=localDay(now),requiredModules=audience==='management'?modules.filter(m=>can(user,m)):[];
 const sources=publishedSources(state,user,audience==='community'?'community':'private',now).slice(0,10).map(r=>({sourceId:r.id,title:r.title,reference:r.reference,revision:r.number,sha256:r.sha256,quote:r.body.split(/\n/).find(p=>p.trim()).slice(0,300)}));
 const sections=[];
 if(requiredModules.includes('tasks')){const tasks=(state.tasks||[]).filter(t=>t.tenant===user.tenant);sections.push({module:'tasks',label:'Tarefas',open:tasks.filter(t=>['todo','doing','review'].includes(t.status)).length,overdue:tasks.filter(t=>['todo','doing','review'].includes(t.status)&&t.due&&t.due<day).length});}
 if(requiredModules.includes('materials')){const materials=(state.materials||[]).filter(m=>m.tenant===user.tenant);sections.push({module:'materials',label:'Estoque',belowMinimum:materials.filter(m=>m.balance<m.minimum).length});}
 if(requiredModules.includes('maintenance')){const plans=(state.maintenance||[]).filter(p=>p.tenant===user.tenant&&p.active);sections.push({module:'maintenance',label:'Preventiva',due:plans.filter(p=>p.nextDue<=day).length});}
 if(requiredModules.includes('documents'))sections.push({module:'documents',label:'Documentos',due:documentAlerts(state,user,now).length});
 const body={day,audience,requiredModules,sources,sections,notice:audience==='community'?'Somente fontes expressamente publicadas para todos os usuários do condomínio.':'Resumo interno conforme os módulos autorizados. Contagens são registros administrativos, sem confirmar execução ou presença.'};
 return {...body,fingerprint:fingerprint(body)};
}
export function previewBriefing(state,user,input,now=Date.now()){
 const result=content(state,user,input.audience,now),previous=(state.knowledgeBriefings||[]).find(b=>b.tenant===user.tenant&&b.day===result.day&&b.audience===result.audience&&b.requiredModules.join(',')===result.requiredModules.join(','));
 return {...result,existingVersion:previous?.version||0};
}
export function saveBriefing(state,user,input,now=Date.now()){
 const preview=previewBriefing(state,user,input,now);
 if(input.fingerprint!==preview.fingerprint)throw Error('As fontes ou os indicadores mudaram. Gere outra prévia.');
 if(!Number.isInteger(input.existingVersion)||input.existingVersion!==preview.existingVersion)throw Error('O resumo mudou. Gere outra prévia.');
 const previous=(state.knowledgeBriefings||[]).find(b=>b.tenant===user.tenant&&b.day===preview.day&&b.audience===preview.audience&&b.requiredModules.join(',')===preview.requiredModules.join(','));
 if(previous?.fingerprint===preview.fingerprint)return {id:previous.id,version:previous.version,repeated:true};
 if(previous&&previous.version>=10)throw Error('Limite de dez revisões diárias por público e escopo no piloto.');
 if(!previous&&(state.knowledgeBriefings||[]).filter(b=>b.tenant===user.tenant).length>=366)throw Error('Limite de 366 resumos por condomínio no piloto.');
 const {existingVersion,...snapshot}=preview,record={id:previous?.id||randomUUID(),tenant:user.tenant,...snapshot,version:(previous?.version||0)+1,generatedAt:new Date(now).toISOString(),preparedBy:user.id,channel:'internal',delivery:'prepared',history:[...(previous?.history||[]),...(previous?[Object.fromEntries(Object.entries(structuredClone(previous)).filter(([key])=>key!=='history'))]:[])]};
 state.knowledgeBriefings??=[];if(previous)state.knowledgeBriefings[state.knowledgeBriefings.indexOf(previous)]=record;else state.knowledgeBriefings.push(record);
 return {id:record.id,version:record.version,repeated:false};
}
export function visibleBriefings(state,user,now=Date.now()){
 const community=publishedSources(state,user,'community',now),privateSources=can(user,'knowledge')?publishedSources(state,user,'private',now):[];
 return (state.knowledgeBriefings||[]).filter(b=>b.tenant===user.tenant&&(b.audience==='community'||can(user,'knowledge')&&b.requiredModules.every(m=>can(user,m)))&&b.sources.every(c=>(b.audience==='community'?community:privateSources).some(r=>r.id===c.sourceId&&r.number===c.revision&&r.sha256===c.sha256))).map(({preparedBy,history,...safe})=>structuredClone(safe)).reverse();
}
