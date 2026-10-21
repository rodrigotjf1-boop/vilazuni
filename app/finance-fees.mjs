import {requireNoExternalCollection} from './finance-collection-policy.mjs';
import {randomUUID} from 'node:crypto';
import {localDay} from './residents.mjs';
import {requireFinance,text,date,amount,rows,revision,bump,openDate} from './finance-ledger.mjs';
import {registerReceivable} from './finance-receivables.mjs';
import {isOutstanding,settlementPosition,syncSettlement} from './finance-settlements.mjs';
import {collectionHeld,payerLink} from './finance-collection-policy.mjs';

const audit=(u,action,reason,now)=>({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason});
const shifted=(day,n)=>{const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const round=(n,d)=>Number((n+d/2n)/d);
export function createFeeRule(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');openDate(s,u,localDay(now),now);const reference=text(input.reference,'Referência da regra',100),basis=text(input.basis,'Fundamento documental e validação aplicável',1500),dueFrom=date(input.dueFrom),dueThrough=date(input.dueThrough),reason=text(input.reason,'Justificativa',500);
 if(dueFrom>dueThrough)throw Error('Vigência de vencimentos inválida.');
 if(!Number.isInteger(input.fineBps)||input.fineBps<0||input.fineBps>10000||!Number.isInteger(input.annualInterestBps)||input.annualInterestBps<0||input.annualInterestBps>10000||input.fineBps+input.annualInterestBps===0)throw Error('Informe multa e juros anuais explícitos, entre 0 e 100%, com ao menos um maior que zero.');
 if(rows(s,'financialFeeRules',u.tenant).some(r=>r.reference.normalize('NFKC').toLowerCase()===reference.normalize('NFKC').toLowerCase()))throw Error('Referência de regra já utilizada.');
 const r={id:randomUUID(),tenant:u.tenant,version:1,status:'draft',reference,basis,dueFrom,dueThrough,fineBps:input.fineBps,annualInterestBps:input.annualInterestBps,method:'Juros simples anuais / 365 sobre saldo ao fim de cada dia; arredondamento agregado em centavos. Multa única sobre saldo ao fim do vencimento.',createdBy:u.id,history:[audit(u,'Regra de encargos proposta; sem aplicação',reason,now)]};
 s.financialFeeRules??=[];s.financialFeeRules.push(r);bump(s,u.tenant);return structuredClone(r);
}
export function decideFeeRule(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');openDate(s,u,localDay(now),now);const r=rows(s,'financialFeeRules',u.tenant).find(r=>r.id===input.id),reason=text(input.reason,'Conferência documental / motivo',1500);
 if(!r||!Number.isInteger(input.version)||r.version!==input.version)throw Error('Regra indisponível ou desatualizada.');
 if(input.action==='approve'){
  if(r.status!=='draft'||r.createdBy===u.id||input.validated!==true)throw Error('Outra pessoa com controle deve confirmar a validação documental da regra proposta.');r.status='approved';r.approval={by:u.id,at:new Date(now).toISOString(),reason};
 }else if(input.action==='retire'){if(r.status==='retired')throw Error('Regra já retirada.');r.status='retired';}else throw Error('Decisão de regra inválida.');
 r.version++;r.history.push(audit(u,r.status==='approved'?'Regra conferida e aprovada por segunda pessoa':'Regra retirada para novas aplicações',reason,now));bump(s,u.tenant);return structuredClone(r);
}
function calculated(s,u,input,now){
 requireFinance(u,'financeClose');const today=openDate(s,u,localDay(now),now),r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===input.sourceId),rule=rows(s,'financialFeeRules',u.tenant).find(r=>r.id===input.ruleId&&r.status==='approved'),through=date(input.through);
 if(r)requireNoExternalCollection(s,u.tenant,r.id);if(!r||!Number.isInteger(input.sourceVersion)||r.version!==input.sourceVersion)throw Error('A origem mudou. Atualize antes de calcular.');
 if(!rule||input.ruleVersion!==rule.version)throw Error('Selecione regra aprovada e atual.');
 if(r.feeSourceId||!isOutstanding(settlementPosition(s,u.tenant,'receivable',r))||r.dueOn>=through||through>today)throw Error('Encargos exigem principal aberto e período vencido até hoje, sem juros sobre encargos.');
 if(r.dueOn<rule.dueFrom||r.dueOn>rule.dueThrough)throw Error('Regra não abrange o vencimento desta conta.');
 if(collectionHeld(s,u.tenant,r.id))throw Error('Resolva a suspensão ou contestação antes de aplicar encargos.');
 const applied=rows(s,'financialFeeAccruals',u.tenant).filter(a=>a.sourceId===r.id&&a.status==='active').sort((a,b)=>a.through.localeCompare(b.through)),previous=applied.at(-1),lastTerms=r.terms.at(-1).date;
 const from=[shifted(r.dueOn,1),lastTerms,previous?shifted(previous.through,1):'0000-01-01'].sort().at(-1);
 if(through<from)throw Error('Período já apurado ou anterior à vigência dos termos atuais.');
 const days=Math.floor((Date.parse(through+'T12:00Z')-Date.parse(from+'T12:00Z'))/86400000)+1;if(days>3660)throw Error('Apure no máximo 3.660 dias por vez.');
 const fineBaseCents=settlementPosition(s,u.tenant,'receivable',r,r.dueOn).remainingCents,fineCents=applied.some(a=>a.fineApplied)?0:round(BigInt(fineBaseCents)*BigInt(rule.fineBps),10000n);
 let weighted=0n;const daily=[];for(let day=from;day<=through;day=shifted(day,1)){
  const principalCents=settlementPosition(s,u.tenant,'receivable',r,day).remainingCents;weighted+=BigInt(principalCents)*BigInt(rule.annualInterestBps);
  const last=daily.at(-1);if(last?.principalCents===principalCents){last.through=day;last.days++;}else daily.push({from:day,through:day,days:1,principalCents});
 }
 const interestCents=round(weighted,3650000n),amountCents=fineCents+interestCents;amount(amountCents);
 return {sourceId:r.id,sourceVersion:r.version,ruleId:rule.id,ruleVersion:rule.version,from,through,days,fineBaseCents,fineCents,fineApplied:!applied.some(a=>a.fineApplied),interestCents,amountCents,daily,ruleReference:rule.reference,basis:rule.basis,method:rule.method,fineBps:rule.fineBps,annualInterestBps:rule.annualInterestBps,revision:revision(s,u.tenant)};
}
export function previewFeeAccrual(s,u,input,now=Date.now()){return calculated(s,u,input,now);}
export function applyFeeAccrual(s,u,input,now=Date.now()){
 const memo=calculated(s,u,input,now),reason=text(input.reason,'Conferência da memória de cálculo',500);if(input.revision!==memo.revision)throw Error('Financeiro mudou. Confira uma nova memória de cálculo.');
 const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===memo.sourceId),today=localDay(now),next=structuredClone(s);
 const child=registerReceivable(next,u,{debtor:r.debtor,reference:text(input.reference,'Referência única do encargo',100),description:'Encargos · '+r.description.slice(0,140),category:'Encargos aprovados',amountCents:memo.amountCents,fundId:r.fundId,issuedOn:today,dueOn:date(input.dueOn)},now);
 const id=randomUUID(),saved=next.financialReceivables.find(x=>x.id===child.id);Object.assign(saved,{feeSourceId:r.id,feeAccrualId:id,feeMemo:memo,houseId:r.houseId||null,houseNumber:r.houseNumber||null,competence:r.competence||null});
 const link=payerLink(next,u.tenant,r.id);if(link?.payerUserId){next.financialPayerLinks??=[];next.financialPayerLinks.push({id:randomUUID(),tenant:u.tenant,receivableId:child.id,payerUserId:link.payerUserId,payerName:link.payerName,version:1,history:[audit(u,'Pagador preservado da origem do encargo',reason,now)]});}
 const accrual={id,tenant:u.tenant,version:1,status:'active',...memo,receivableId:child.id,issuedOn:today,history:[audit(u,'Encargo registrado em recebível separado; caixa preservado',reason,now)]};next.financialFeeAccruals??=[];next.financialFeeAccruals.push(accrual);bump(next,u.tenant);
 s.financialReceivables=next.financialReceivables;s.financialPayerLinks=next.financialPayerLinks||s.financialPayerLinks;s.financialFeeAccruals=next.financialFeeAccruals;s.financialRevisions=next.financialRevisions;return structuredClone(accrual);
}
export function cancelFeeAccrual(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const today=openDate(s,u,localDay(now),now),a=rows(s,'financialFeeAccruals',u.tenant).find(a=>a.id===input.id),reason=text(input.reason,'Motivo do cancelamento do encargo',500);
 if(!a||a.status!=='active'||!Number.isInteger(input.version)||input.version!==a.version)throw Error('Apuração indisponível ou desatualizada.');
 if(rows(s,'financialFeeAccruals',u.tenant).some(x=>x.sourceId===a.sourceId&&x.status==='active'&&x.through>a.through))throw Error('Cancele primeiro a última apuração da origem.');
 const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===a.receivableId);if(settlementPosition(s,u.tenant,'receivable',r).settledCents||r.activeAgreementId)throw Error('Estorne as baixas do encargo antes de cancelar.');
 if(rows(s,'financialManualRequests',u.tenant).some(q=>q.receivableId===r.id&&!q.cancelledOn))throw Error('Cancele o aviso de cobrança do encargo antes de cancelar a apuração.');
 r.events.push({date:today,kind:'cancelled',reason});r.version++;syncSettlement(s,u.tenant,'receivable',r);r.history.push(audit(u,'Encargo cancelado com a apuração',reason,now));a.status='cancelled';a.cancelledOn=today;a.version++;a.history.push(audit(u,'Apuração cancelada; memória preservada',reason,now));bump(s,u.tenant);return structuredClone(a);
}
