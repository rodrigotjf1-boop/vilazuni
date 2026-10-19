import {ledger} from './finance-ledger.mjs';

export const isOutstanding=r=>['open','partial'].includes(r.status);
export function linkedEntries(s,tenant,kind,id,through='9999-12-31'){
 const key=kind==='payable'?'payableId':'receivableId';return ledger(s,tenant).filter(e=>e[key]===id&&e.date<=through);
}
export function settlementPosition(s,tenant,kind,r,through='9999-12-31'){
 const sign=kind==='payable'?-1:1,settledCents=sign*linkedEntries(s,tenant,kind,r.id,through).reduce((n,e)=>n+e.postings.reduce((sum,p)=>sum+p.amountCents,0),0);
 if(!Number.isSafeInteger(settledCents)||settledCents<0||settledCents>r.amountCents)throw Error('Saldo das baixas inconsistente. Confira o histórico financeiro.');
 const event=r.events.filter(e=>e.date<=through).at(-1),nominalRemaining=r.amountCents-settledCents;
 const status=event?.kind==='cancelled'?'cancelled':event?.kind==='renegotiated'?'renegotiated':settledCents===r.amountCents?(kind==='payable'?'paid':'received'):settledCents>0?'partial':'open';
 return {status,settledCents,remainingCents:['cancelled','renegotiated'].includes(status)?0:nominalRemaining,transferredCents:status==='renegotiated'?nominalRemaining:0,activeAgreementId:status==='renegotiated'?event.agreementId:null};
}
export function lastSettlementDate(s,tenant,kind,r){
 return [r.issuedOn,...r.events.map(e=>e.date),...r.terms.map(t=>t.date),...linkedEntries(s,tenant,kind,r.id).map(e=>e.date)].sort().at(-1);
}
export function syncSettlement(s,tenant,kind,r){
 const position=settlementPosition(s,tenant,kind,r);r.status=position.status;r.activeAgreementId=position.activeAgreementId;
 const last=linkedEntries(s,tenant,kind,r.id).filter(e=>e.kind===(kind==='payable'?'expense':'income')&&!e.reversalId).at(-1);
 r[kind==='payable'?'paymentEntryId':'receiptEntryId']=last?.id||null;return position;
}
export function settlementView(s,tenant,kind,r,through='9999-12-31'){
 const p=settlementPosition(s,tenant,kind,r,through);return {...structuredClone(r),...p,[kind==='payable'?'paidCents':'receivedCents']:p.settledCents};
}
