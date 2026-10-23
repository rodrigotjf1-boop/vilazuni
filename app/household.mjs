import {canViewHousehold,canViewTenantContacts,canAuthorizeCaretakerContacts,householdStayView} from './household-access.mjs';
import {residentView,localDay} from './residents.mjs';
const unique=values=>[...new Set(values.filter(Boolean))];
const labels={owner:'Proprietário mora no local',annual:'Inquilino com contrato',daily:'Inquilino de diária',seasonal:'Inquilino de temporada',unspecified:'Ocupação não informada'};
export function houseHousehold(state,user,houseId,now=Date.now()){
 if(!canViewHousehold(state,user,houseId,now))return null;
 const house=state.houses.find(h=>h.id===houseId&&h.tenant===user.tenant),today=localDay(now),records=(state.residents||[]).filter(r=>r.tenant===user.tenant&&r.houseId===houseId&&!r.endedOn&&r.startDate<=today);
 const owners=records.filter(r=>r.kind==='owner').map(r=>residentView(state,user,r,now));
 const annual=records.filter(r=>r.kind==='annual'&&(!r.contractEndDate||r.contractEndDate>=today));
 const stays=(state.stays||[]).filter(s=>s.tenant===user.tenant&&s.houseId===houseId&&s.status==='approved'&&Date.parse(s.start)<=now&&now<Date.parse(s.end));
 const residingOwners=owners.filter(r=>r.ownerOccupancy==='resident'),tenants=annual.map(r=>residentView(state,user,r,now)),guests=stays.map(s=>householdStayView(state,user,s,now));
 let kind=annual.length?'annual':stays.length?(stays.every(s=>s.rentalKind==='daily')?'daily':stays.every(s=>s.rentalKind==='seasonal')?'seasonal':'unspecified'):residingOwners.length?'owner':'unspecified';
 let label=labels[kind];if(stays.length&&kind==='unspecified')label='Estadia vigente · modalidade não informada';
 const conflict=annual.length>1||stays.length>1||annual.length>0&&stays.length>0||residingOwners.length>0&&(annual.length>0||stays.length>0);
 if(conflict)label='Conferir ocupação: há vínculos simultâneos';
 if(!annual.length&&!stays.length&&!residingOwners.length&&owners.some(r=>r.ownerOccupancy==='rented'))label='Proprietário aluga a casa · ocupação não informada';
 const current=[...annual,...stays],period=current.length===1?current[0]:null;
 return {houseId,number:house.number,owners,occupancy:{kind,label,conflict,people:unique(annual.flatMap(r=>r.people||[r.name]).concat(stays.flatMap(s=>s.people||[s.responsible]),!annual.length&&!stays.length?residingOwners.map(r=>r.name):[])),startDate:period?.startDate||period?.start||null,endDate:period?.contractEndDate||period?.end||null,contractReference:period?.contractReference||null,vehicles:unique(current.flatMap(r=>r.vehicles||[]).concat(!current.length?residingOwners.flatMap(r=>r.vehicles||[]):[])),residents:tenants,stays:guests},canViewTenantContacts:canViewTenantContacts(state,user,houseId,now),canAuthorizeCaretaker:canAuthorizeCaretakerContacts(state,user,houseId),contactsRestricted:!canViewTenantContacts(state,user,houseId,now),alerts:records.filter(r=>r.kind==='annual'&&r.contractEndDate&&r.contractEndDate<today).map(r=>'Contrato de '+r.name+' terminou em '+r.contractEndDate+'; confirme a ocupação atual.')};
}
