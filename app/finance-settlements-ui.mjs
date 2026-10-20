import {esc,money} from './ui-common.mjs';
export const receivableStatuses={open:'Em aberto',partial:'Recebido parcialmente',received:'Entrada registrada',cancelled:'Cancelada',renegotiated:'Saldo em acordo'};
export const payableStatuses={open:'Em aberto',partial:'Pago parcialmente',paid:'Saída registrada',cancelled:'Cancelado'};
export const isOpen=r=>['open','partial'].includes(r.status);
export const remaining=r=>r.remainingCents??(['cancelled','renegotiated'].includes(r.status)?0:r.amountCents-(r.paidCents??r.receivedCents??0));
export function settlementSummary(r,kind){return `<p>Registrado ${money(kind==='payable'?r.paidCents:r.receivedCents)} · saldo restante ${money(remaining(r))}</p>${r.transferredCents?`<p>Saldo transferido ao acordo: ${money(r.transferredCents)}</p>`:''}`;}
export function settlementEntries(r,kind,entries){
 const key=kind==='payable'?'payableId':'receivableId',values=entries.filter(e=>e[key]===r.id&&e.kind!=='reversal');
 return `<details class="account-section"><summary>Baixas registradas (${values.length})</summary>${values.map(e=>`<button class="journey-card" data-settlement-entry="${e.id}"><p>${money(e.amountCents)} · ${esc(e.date)}${e.reversalId?' · estornada':''}</p><small>${esc(e.reference)}</small></button>`).join('')}</details>`;
}
export function bindSettlements(dock,entryDetail){dock.querySelectorAll('[data-settlement-entry]').forEach(b=>b.onclick=()=>entryDetail(b.dataset.settlementEntry));}
