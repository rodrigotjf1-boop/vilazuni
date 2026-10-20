import {rows} from './finance-ledger.mjs';

export const payerLink=(s,tenant,id)=>rows(s,'financialPayerLinks',tenant).find(r=>r.receivableId===id);
export function collectionHeld(s,tenant,id,through='9999-12-31'){
 const hold=rows(s,'financialCollectionHolds',tenant).find(r=>r.receivableId===id)?.events.filter(e=>e.date<=through).at(-1);
 return !!hold?.held||rows(s,'financialCollectionCases',tenant).some(c=>c.receivableId===id&&['open','review'].includes(c.events.filter(e=>e.date<=through).at(-1)?.status));
}
export function ownsCollection(s,u,r){return r.tenant===u.tenant&&r.payerUserId===u.id&&payerLink(s,u.tenant,r.receivableId)?.payerUserId===u.id;}
export function requireUnbilledDate(s,tenant,id,day){
 if(rows(s,'financialFeeAccruals',tenant).some(a=>a.sourceId===id&&a.status==='active'&&day<=a.through))throw Error('Há encargos apurados nessa data. Revise e cancele as apurações antes de alterar sua base.');
}
