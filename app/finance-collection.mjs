import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {can} from './permissions.mjs';
import {canReadFinance,requireFinance,text,date,rows,bump,openDate} from './finance-ledger.mjs';
import {isOutstanding,settlementPosition} from './finance-settlements.mjs';
import {receivablesAt} from './finance-receivables.mjs';
import {payerLink,ownsCollection,collectionHeld} from './finance-collection-policy.mjs';

const audit=(u,action,reason,now)=>({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason});
export const daysBetween=(from,through)=>Math.floor((Date.parse(through+'T12:00Z')-Date.parse(from+'T12:00Z'))/86400000);
function receivable(s,u,id,version){
 const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===id);if(!r)throw Error('Conta a receber indisponível.');
 if(arguments.length>=4&&(!Number.isInteger(version)||r.version!==version))throw Error('A conta a receber mudou. Atualize antes de continuar.');return r;
}
export function assignFinancialPayer(s,users,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const today=openDate(s,u,localDay(now),now),r=receivable(s,u,input.id,input.version),reason=text(input.reason,'Fundamento do vínculo ao pagador',500),current=payerLink(s,u.tenant,r.id);
 if(input.linkVersion!==(current?.version||0))throw Error('O vínculo mudou. Atualize antes de continuar.');
 const payer=input.payerUserId?users.find(p=>p.tenant===u.tenant&&p.id===input.payerUserId&&p.active&&['proprietario','imobiliaria','ocupante'].includes(p.role)):null;
 if(input.payerUserId&&!payer)throw Error('Selecione conta residencial ativa deste condomínio.');
 if(payer&&r.houseId&&!payer.houses?.includes(r.houseId))throw Error('O pagador deve ter acesso à unidade desta contribuição.');
 if((current?.payerUserId||null)===(payer?.id||null))throw Error('O vínculo já está nessa situação.');
 const link=current||{id:randomUUID(),tenant:u.tenant,receivableId:r.id,version:0,history:[]};
 const before={payerUserId:link.payerUserId||null,payerName:link.payerName||null};Object.assign(link,{payerUserId:payer?.id||null,payerName:payer?.name||null,version:link.version+1});link.history.push({...audit(u,payer?'Pagador explicitamente vinculado':'Acesso do pagador removido',reason,now),before,after:{payerUserId:link.payerUserId,payerName:link.payerName}});
 s.financialPayerLinks??=[];if(!current)s.financialPayerLinks.push(link);
 for(const request of rows(s,'financialManualRequests',u.tenant).filter(q=>q.receivableId===r.id&&!q.cancelledOn)){request.cancelledOn=today;request.version++;request.history.push(audit(u,'Aviso cancelado por alteração do pagador',reason,now));}
 bump(s,u.tenant);return structuredClone(link);
}
export function issueManualRequest(s,u,input,now=Date.now()){
 requireFinance(u,'finance');const today=openDate(s,u,localDay(now),now),r=receivable(s,u,input.id,input.version),link=payerLink(s,u.tenant,r.id),position=settlementPosition(s,u.tenant,'receivable',r);
 if(!isOutstanding(position))throw Error('Emita aviso somente para saldo aberto.');
 if(!link?.payerUserId||input.linkVersion!==link.version)throw Error('Controle deve conferir o vínculo ao pagador antes de emitir.');
 if(collectionHeld(s,u.tenant,r.id))throw Error('Cobrança suspensa ou em contestação. Aguarde análise do controle.');
 if(rows(s,'financialManualRequests',u.tenant).some(q=>q.receivableId===r.id&&!q.cancelledOn))throw Error('Há aviso ativo para esta conta. Consulte ou cancele antes de substituir.');
 const reference=text(input.reference,'Referência do aviso',100),instructions=text(input.instructions,'Orientações de pagamento',1500),reason=text(input.reason,'Conferência da cobrança manual',500);
 if(rows(s,'financialManualRequests',u.tenant).some(q=>q.reference.normalize('NFKC').toLowerCase()===reference.normalize('NFKC').toLowerCase()))throw Error('Referência de aviso já utilizada.');
 const request={id:randomUUID(),tenant:u.tenant,version:1,receivableId:r.id,payerUserId:link.payerUserId,reference,description:r.description,debtor:r.debtor,issuedOn:today,dueOn:r.dueOn,amountCents:position.remainingCents,instructions,houseNumber:r.houseNumber||null,competence:r.competence||null,history:[audit(u,'Aviso privado de cobrança manual emitido',reason,now)]};
 s.financialManualRequests??=[];s.financialManualRequests.push(request);bump(s,u.tenant);return structuredClone(request);
}
export function cancelManualRequest(s,u,input,now=Date.now()){
 requireFinance(u,'finance');const today=openDate(s,u,localDay(now),now),q=rows(s,'financialManualRequests',u.tenant).find(q=>q.id===input.id),reason=text(input.reason,'Motivo do cancelamento',500);
 if(!q||q.cancelledOn||!Number.isInteger(input.version)||q.version!==input.version)throw Error('Aviso indisponível ou desatualizado.');q.cancelledOn=today;q.version++;q.history.push(audit(u,'Aviso manual cancelado; dívida preservada',reason,now));bump(s,u.tenant);return structuredClone(q);
}
export function setCollectionHold(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const today=openDate(s,u,localDay(now),now),r=receivable(s,u,input.id),reason=text(input.reason,'Motivo da suspensão/liberação',500),old=rows(s,'financialCollectionHolds',u.tenant).find(h=>h.receivableId===r.id);
 if(typeof input.held!=='boolean'||input.version!==(old?.version||0))throw Error('Suspensão mudou. Atualize antes de continuar.');
 if(input.held===!!old?.events.at(-1)?.held)throw Error('Suspensão já está nessa situação.');
 const hold=old||{id:randomUUID(),tenant:u.tenant,receivableId:r.id,version:0,events:[],history:[]};hold.version++;hold.events.push({date:today,held:input.held});hold.history.push(audit(u,input.held?'Cobrança suspensa pela gestão':'Suspensão administrativa retirada',reason,now));s.financialCollectionHolds??=[];if(!old)s.financialCollectionHolds.push(hold);bump(s,u.tenant);return structuredClone(hold);
}
export function createCollectionCase(s,u,input,now=Date.now()){
 const today=openDate(s,u,localDay(now),now),r=receivable(s,u,input.id),link=payerLink(s,u.tenant,r.id);
 const own=link?.payerUserId===u.id&&rows(s,'financialManualRequests',u.tenant).some(q=>q.receivableId===r.id&&ownsCollection(s,u,q)&&!q.cancelledOn);
 if(!own&&!can(u,'financeClose'))throw Error('Cobrança indisponível para contestação.');
 if(rows(s,'financialCollectionCases',u.tenant).some(c=>c.receivableId===r.id&&['open','review'].includes(c.status)))throw Error('Já há análise aberta para esta conta. Acrescente acompanhamento.');
 const message=text(input.message,'Contestação ou informação de pagamento',1500);if(!['dispute','paymentNotice'].includes(input.kind))throw Error('Selecione contestação ou informação de pagamento.');
 const c={id:randomUUID(),tenant:u.tenant,version:1,receivableId:r.id,payerUserId:link?.payerUserId||null,authorId:u.id,kind:input.kind,status:'open',openedOn:today,events:[{date:today,status:'open'}],history:[audit(u,input.kind==='paymentNotice'?'Pagamento informado; aguardando conferência':'Contestação aberta; cobrança suspensa',message,now)]};
 s.financialCollectionCases??=[];s.financialCollectionCases.push(c);bump(s,u.tenant);return structuredClone(c);
}
export function updateCollectionCase(s,u,input,now=Date.now()){
 const today=openDate(s,u,localDay(now),now),c=rows(s,'financialCollectionCases',u.tenant).find(c=>c.id===input.id),manager=can(u,'financeClose');
 if(!c||!manager&&!ownsCollection(s,u,c))throw Error('Análise indisponível.');if(!Number.isInteger(input.version)||c.version!==input.version)throw Error('A análise mudou. Atualize antes de continuar.');
 const message=text(input.message,'Acompanhamento compartilhado com o pagador',1500);
 if(input.action==='comment'){if(c.status==='resolved')throw Error('Análise encerrada. Abra nova solicitação se necessário.');}
 else if(input.action==='status'){if(!manager||!['review','resolved','open'].includes(input.status)||input.status===c.status)throw Error('Alteração de análise não autorizada.');c.status=input.status;c.events.push({date:today,status:c.status});}
 else throw Error('Ação de análise inválida.');
 c.version++;c.history.push(audit(u,input.action==='status'?'Análise: '+c.status:'Acompanhamento registrado',message,now));bump(s,u.tenant);return structuredClone(c);
}
export function saveReminderPolicy(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');openDate(s,u,localDay(now),now);const reason=text(input.reason,'Fundamento dos lembretes',500),old=rows(s,'financialReminderPolicies',u.tenant)[0];
 if(input.version!==(old?.version||0)||typeof input.enabled!=='boolean')throw Error('Configuração mudou. Atualize antes de continuar.');
 if(!Array.isArray(input.offsets)||!input.offsets.length||input.offsets.length>12||new Set(input.offsets).size!==input.offsets.length||input.offsets.some(n=>!Number.isInteger(n)||n< -30||n>120))throw Error('Informe até 12 dias distintos, entre -30 e 120 em relação ao vencimento.');
 const p=old||{id:randomUUID(),tenant:u.tenant,version:0,history:[]};Object.assign(p,{enabled:input.enabled,offsets:[...input.offsets].sort((a,b)=>a-b),version:p.version+1});p.history.push(audit(u,'Régua de lembretes privados atualizada',reason,now));s.financialReminderPolicies??=[];if(!old)s.financialReminderPolicies.push(p);bump(s,u.tenant);return structuredClone(p);
}
export function prepareFinancialReminders(s,users,u,input,now=Date.now()){
 requireFinance(u,'finance');const today=openDate(s,u,localDay(now),now),p=rows(s,'financialReminderPolicies',u.tenant)[0],reason=text(input.reason,'Conferência dos lembretes',500);
 if(!p?.enabled||input.version!==p.version)throw Error('Controle deve habilitar e conferir a régua de lembretes.');
 const created=[];for(const q of rows(s,'financialManualRequests',u.tenant).filter(q=>!q.cancelledOn)){
  const r=receivable(s,u,q.receivableId),link=payerLink(s,u.tenant,r.id),position=settlementPosition(s,u.tenant,'receivable',r),offset=daysBetween(r.dueOn,today);
  if(!isOutstanding(position)||!p.offsets.includes(offset)||collectionHeld(s,u.tenant,r.id)||link?.payerUserId!==q.payerUserId||!users.some(p=>p.tenant===u.tenant&&p.id===q.payerUserId&&p.active))continue;
  if(rows(s,'financialReminders',u.tenant).some(x=>x.receivableId===r.id&&x.dueOn===r.dueOn&&x.offset===offset))continue;
  const item={id:randomUUID(),tenant:u.tenant,version:1,receivableId:r.id,requestId:q.id,payerUserId:q.payerUserId,on:today,dueOn:r.dueOn,offset,remainingCents:position.remainingCents,history:[audit(u,'Lembrete interno privado preparado',reason,now)]};s.financialReminders??=[];s.financialReminders.push(item);created.push(structuredClone(item));
 }
 if(created.length)bump(s,u.tenant);return {created,count:created.length};
}
export function visiblePayerCharges(s,u){
 if(!['proprietario','imobiliaria','ocupante'].includes(u.role))return [];
 return rows(s,'financialManualRequests',u.tenant).filter(q=>ownsCollection(s,u,q)).map(q=>{
  const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===q.receivableId),p=settlementPosition(s,u.tenant,'receivable',r);
  return {id:q.id,receivableId:r.id,reference:q.reference,description:q.description,issuedOn:q.issuedOn,dueOn:r.dueOn,issuedAmountCents:q.amountCents,amountCents:r.amountCents,...p,instructions:q.instructions,cancelledOn:q.cancelledOn||null,houseNumber:q.houseNumber,competence:q.competence,held:collectionHeld(s,u.tenant,r.id),feeMemo:r.feeMemo||null,cases:structuredClone(rows(s,'financialCollectionCases',u.tenant).filter(c=>c.receivableId===r.id&&ownsCollection(s,u,c))),reminders:rows(s,'financialReminders',u.tenant).filter(x=>x.receivableId===r.id&&ownsCollection(s,u,x)).map(({on,remainingCents})=>({on,remainingCents}))};
 });
}
export function collectionReport(s,tenant,through){
 date(through);const items=receivablesAt(s,tenant,through).filter(isOutstanding).map(r=>({...r,daysLate:Math.max(0,daysBetween(r.dueOn,through)),held:collectionHeld(s,tenant,r.id,through)}));
 const grouped=dimension=>{const groups=new Map();for(const r of items){const key=dimension==='unit'?r.houseId||'unlinked':r.competence||'unspecified',label=dimension==='unit'?r.houseNumber?'Casa '+r.houseNumber:'Sem unidade vinculada':r.competence||'Sem competência vinculada',g=groups.get(key)||{key,label,count:0,remainingCents:0,overdueCents:0};g.count++;g.remainingCents+=r.remainingCents;if(r.daysLate)g.overdueCents+=r.remainingCents;groups.set(key,g);}return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label));};
 const buckets=[{key:'current',label:'A vencer',min:0,max:0},{key:'1-30',label:'1–30 dias',min:1,max:30},{key:'31-60',label:'31–60 dias',min:31,max:60},{key:'61-90',label:'61–90 dias',min:61,max:90},{key:'91+',label:'Mais de 90 dias',min:91,max:Infinity}].map(({key,label,min,max})=>{const part=items.filter(r=>r.daysLate>=min&&r.daysLate<=max);return {key,label,count:part.length,remainingCents:part.reduce((n,r)=>n+r.remainingCents,0)};});
 return {through,items,buckets,byUnit:grouped('unit'),byCompetence:grouped('competence'),totalCents:items.reduce((n,r)=>n+r.remainingCents,0),heldCents:items.filter(r=>r.held).reduce((n,r)=>n+r.remainingCents,0),forecast:items.filter(r=>r.dueOn>=through).map(r=>({id:r.id,dueOn:r.dueOn,remainingCents:r.remainingCents,held:r.held})),requests:rows(s,'financialManualRequests',tenant).filter(q=>q.issuedOn<=through).map(q=>({id:q.id,receivableId:q.receivableId,payerUserId:q.payerUserId,reference:q.reference,issuedOn:q.issuedOn,dueOn:q.dueOn,amountCents:q.amountCents,cancelled:!!q.cancelledOn&&q.cancelledOn<=through})),reminders:rows(s,'financialReminders',tenant).filter(r=>r.on<=through).map(r=>({id:r.id,requestId:r.requestId,on:r.on,dueOn:r.dueOn,remainingCents:r.remainingCents})),cases:rows(s,'financialCollectionCases',tenant).filter(c=>c.openedOn<=through).map(c=>({id:c.id,receivableId:c.receivableId,kind:c.kind,status:c.events.filter(e=>e.date<=through).at(-1).status}))};
}
export function collectionView(s,u,now=Date.now()){
 if(!canReadFinance(u))return null;
 return {report:collectionReport(s,u.tenant,localDay(now)),links:structuredClone(rows(s,'financialPayerLinks',u.tenant)),requests:structuredClone(rows(s,'financialManualRequests',u.tenant)),holds:structuredClone(rows(s,'financialCollectionHolds',u.tenant)),cases:structuredClone(rows(s,'financialCollectionCases',u.tenant)),reminderPolicy:structuredClone(rows(s,'financialReminderPolicies',u.tenant)[0]||null),reminders:structuredClone(rows(s,'financialReminders',u.tenant))};
}
