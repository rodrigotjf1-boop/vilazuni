// Arraial do Cabo / Brasília: os contratos terminam no fim do dia informado.
export function contractEndInstant(day) {
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const date=new Date(day+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return null;
 date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10)+'T00:00:00-03:00';
}
export function accessPeriod(state,user) {
 let start=null,end=user?.validUntil||null,source='Vínculo de acesso';
 if(user?.role==='ocupante'){
  const resident=(state.residents||[]).find(r=>r.tenant===user.tenant&&r.id===user.residentId);
  start=resident?.startDate?resident.startDate+'T00:00:00-03:00':null;
  const contractEnd=contractEndInstant(resident?.contractEndDate);
  if(contractEnd&&(!end||Date.parse(contractEnd)<Date.parse(end)))end=contractEnd;
  source='Contrato residencial';
 }
 if(user?.role==='temporario'){
  const stay=(state.stays||[]).find(s=>s.tenant===user.tenant&&s.id===user.stayId);start=stay?.start||null;
  if(stay?.end&&(!end||Date.parse(stay.end)<Date.parse(end)))end=stay.end;source='Estadia autorizada';
 }
 return {start,end,source};
}
