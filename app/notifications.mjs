import {canReadFinance} from './finance-ledger.mjs';
import {randomUUID} from 'node:crypto';import {can} from './permissions.mjs';import {canReadParcel} from './parcels.mjs';
const resources={financialStatements:{module:'finance',label:'Conferência de extrato atualizada',page:'finance'},financialAgreements:{module:'finance',label:'Acordo de parcelamento atualizado',page:'finance'},financialRecurringTemplates:{module:'finance',label:'Modelo recorrente atualizado',page:'finance'},financialAssessments:{module:'finance',label:'Rateio de contribuições atualizado',page:'finance'},financialReceivables:{module:'finance',label:'Conta a receber atualizada',page:'finance'},financialBudgets:{module:'finance',label:'Previsão orçamentária atualizada',page:'finance'},financialEntries:{module:'finance',label:'Lançamento financeiro registrado',page:'finance'},financialPayables:{module:'finance',label:'Compromisso financeiro atualizado',page:'finance'},financialClosures:{module:'finance',label:'Fechamento financeiro atualizado',page:'finance'},tasks:{module:'tasks',label:'Tarefa atualizada',page:'tasks'},incidents:{module:'incidents',label:'Ocorrência atualizada',page:'incidents'},reservations:{module:'facilities',label:'Reserva atualizada',page:'facilities'},purchases:{module:'purchases',label:'Compra atualizada',page:'purchases'},documents:{module:'documents',label:'Documento atualizado',page:'documents'},parcels:{module:'parcels',label:'Encomenda atualizada',page:'parcels'}};
function visibleResource(kind,r,u){if(r.tenant!==u.tenant)return false;if(['financialEntries','financialPayables','financialClosures','financialReceivables','financialBudgets','financialAssessments','financialAgreements','financialRecurringTemplates','financialStatements'].includes(kind))return canReadFinance(u);if(kind==='tasks')return can(u,'tasks')||u.role==='zelador'&&r.assigneeId===u.id;if(kind==='incidents')return can(u,'incidents')||r.authorId===u.id;if(kind==='reservations')return can(u,'facilities')||r.authorId===u.id;if(kind==='purchases')return can(u,'purchases')||can(u,'purchaseApproval');if(kind==='documents')return can(u,'documents');if(kind==='parcels')return canReadParcel(r,u);return false;}
export function visibleNotifications(state,user){return (state.notifications||[]).filter(n=>n.tenant===user.tenant&&n.userId===user.id&&(state[n.kind]||[]).some(r=>r.id===n.resourceId&&visibleResource(n.kind,r,user))).map(n=>structuredClone(n)).reverse();}
export function notifyChanges(previous,next,users,actor,now=Date.now()){
 for(const [kind,config] of Object.entries(resources)){
  const before=new Map((previous[kind]||[]).map(r=>[r.id,r.version||0]));
  for(const r of next[kind]||[]){if(before.has(r.id)&&before.get(r.id)===(r.version||0))continue;
   for(const u of users){if(!u.active||u.id===actor.id||!visibleResource(kind,r,u))continue;
    // Task operators are notified only about their assignments; parcel operators handle their own queue.
    if(kind==='tasks'&&u.role==='zelador'&&r.assigneeId!==u.id)continue;
    if(kind==='parcels'&&u.id!==r.recipientUserId&&!can(u,'parcels'))continue;
    next.notifications??=[];next.notifications.push({id:randomUUID(),tenant:r.tenant,userId:u.id,kind,resourceId:r.id,page:config.page,title:config.label,at:new Date(now).toISOString(),readAt:null});
   }
  }
 }
}
export function readNotifications(state,user,input,now=Date.now()){
 if(!Array.isArray(input.ids)||input.ids.length>500||input.ids.some(id=>typeof id!=='string'))throw Error('Selecione até 500 avisos.');const permitted=new Set(visibleNotifications(state,user).map(n=>n.id));if(input.ids.some(id=>!permitted.has(id)))throw Error('Aviso indisponível.');for(const n of state.notifications||[])if(input.ids.includes(n.id)&&!n.readAt)n.readAt=new Date(now).toISOString();return {ok:true};
}
