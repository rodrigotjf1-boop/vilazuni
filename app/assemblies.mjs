import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {validBinding} from './access.mjs';
import {dateBRLocal} from './domain.mjs';
import {text,fingerprint} from './knowledge.mjs';
import {usersInTenant} from './tenants.mjs';

const permit=u=>{if(!can(u,'assemblies'))throw Object.assign(Error('Gestão de assembleias não autorizada.'),{status:403});};
function find(state,user,id){const a=(state.assemblies||[]).find(a=>a.id===id&&a.tenant===user.tenant);if(!a||!canReadAssembly(a,user))throw Object.assign(Error('Assembleia indisponível.'),{status:403});return a;}
export const canReadAssembly=(a,u)=>a.tenant===u.tenant&&(can(u,'assemblies')||a.status!=='draft'&&a.roll.some(r=>r.representativeId===u.id));
function editable(state,user,input){permit(user);const a=find(state,user,input.id);if(input.version!==a.version)throw Error('A assembleia mudou. Atualize antes de continuar.');return a;}
function event(a,u,action,reason,now){a.history.push({at:new Date(now).toISOString(),actorId:u.id,actor:u.name,action,reason});}
function fraction(value,label,zero=false){if(!value||!Number.isInteger(value.numerator)||!Number.isInteger(value.denominator)||value.denominator<1||value.denominator>10000||value.numerator<(zero?0:1)||value.numerator>value.denominator||!['gte','gt'].includes(value.comparison))throw Error(label+': informe numerador, denominador e comparação válidos.');return {numerator:value.numerator,denominator:value.denominator,comparison:value.comparison};}
function agenda(input){if(!Array.isArray(input)||!input.length||input.length>20)throw Error('Informe de uma a vinte matérias.');return input.map(item=>{if(!['all','present','valid'].includes(item.approval?.base))throw Error('Defina a base de aprovação de cada matéria.');return {id:randomUUID(),title:text(item.title,'Matéria',200),basis:text(item.basis,'Fundamento do quórum',1000),attendance:fraction(item.attendance,'Quórum de instalação',true),approval:{...fraction(item.approval,'Quórum de aprovação'),base:item.approval.base},status:'pending',version:0,eligible:[],votes:[]};});}
export function createAssembly(state,user,input,now=Date.now()){
 permit(user);if((state.assemblies||[]).filter(a=>a.tenant===user.tenant).length>=100)throw Error('Limite de cem assembleias no pacote.');
 const startsAt=dateBRLocal(input.startsAt),endsAt=dateBRLocal(input.endsAt);if(Date.parse(endsAt)<=Date.parse(startsAt)||Date.parse(endsAt)<=now||Date.parse(endsAt)-Date.parse(startsAt)>7*86400000)throw Error('Período deve terminar no futuro, durar até sete dias e ter início anterior ao fim.');
 const a={id:randomUUID(),tenant:user.tenant,title:text(input.title,'Título',200),legalRegime:text(input.legalRegime,'Regime jurídico informado',200),convocationReference:text(input.convocationReference,'Referência da convocação',1000),rulesReference:text(input.rulesReference,'Convenção/regra aplicável',1000),startsAt,endsAt,status:'draft',version:1,roll:state.houses.filter(h=>h.tenant===user.tenant&&h.active!==false).map(h=>({houseId:h.id,houseNumber:h.number,weight:null,representativeId:null,powerReference:null,powerUntil:null})),presences:[],agenda:agenda(input.agenda),history:[]};
 if(!a.roll.length)throw Error('Cadastre as unidades antes de preparar a assembleia.');event(a,user,'Rascunho de assembleia preparado',text(input.reason,'Motivo',500),now);state.assemblies??=[];state.assemblies.push(a);return assemblyView(a,user);
}
export function setRepresentation(state,users,user,input,now=Date.now()){
 const a=editable(state,user,input);if(a.status!=='draft')throw Error('Representação e pesos só podem mudar no rascunho.');
 if(!Array.isArray(input.roll)||input.roll.length!==a.roll.length||new Set(input.roll.map(r=>r.houseId)).size!==a.roll.length)throw Error('Confira uma linha por unidade, sem omissões ou duplicatas.');
 const reason=text(input.reason,'Conferência da representação',500),roll=input.roll.map(row=>{
  const previous=a.roll.find(r=>r.houseId===row.houseId);if(!previous)throw Error('Unidade fora desta assembleia.');if(!Number.isInteger(row.weight)||row.weight<1||row.weight>1000000)throw Error('Defina peso inteiro de 1 a 1.000.000 para cada unidade.');
  if(!row.representativeId)return {...previous,weight:row.weight,representativeId:null,powerReference:null,powerUntil:null};
  const representative=users.find(u=>u.id===row.representativeId&&u.tenant===user.tenant&&validBinding(state,u,now));if(!representative)throw Error('Representante precisa de conta vigente no condomínio.');
  const powerReference=text(row.powerReference,'Referência da titularidade ou procuração',500),powerUntil=dateBRLocal(row.powerUntil);if(Date.parse(powerUntil)<Date.parse(a.endsAt)||representative.validUntil&&Date.parse(representative.validUntil)<Date.parse(a.endsAt)||row.verified!==true)throw Error('Confirme os poderes e sua validade até o fim da assembleia.');
  return {...previous,weight:row.weight,representativeId:representative.id,powerReference,powerUntil};
 });
 a.roll=roll;a.version++;event(a,user,'Representação e pesos conferidos',reason,now);return assemblyView(a,user);
}
export function publishAssembly(state,user,input,now=Date.now()){
 const a=editable(state,user,input);if(a.status!=='draft'||input.rulesReviewed!==true||a.roll.some(r=>!Number.isInteger(r.weight)))throw Error('Confira convocação, regras e pesos de todas as unidades antes de publicar.');
 if(Date.parse(a.endsAt)<=now)throw Error('Período da assembleia encerrado.');a.status='published';a.version++;event(a,user,'Convocação registrada no aplicativo',text(input.reason,'Registro da conferência',500),now);return assemblyView(a,user);
}
export function changeAssembly(state,user,input,now=Date.now()){
 const a=editable(state,user,input),reason=text(input.reason,'Motivo',1000);
 if(input.action==='start'){if(a.status!=='published'||now<Date.parse(a.startsAt)||now>=Date.parse(a.endsAt))throw Error('Abertura exige convocação publicada e período vigente.');a.status='running';}
 else if(input.action==='cancel'){if(['closed','cancelled'].includes(a.status))throw Error('Assembleia já encerrada.');a.status='cancelled';}
 else throw Error('Encaminhamento inválido.');a.version++;event(a,user,input.action==='start'?'Assembleia iniciada':'Assembleia cancelada',reason,now);return assemblyView(a,user);
}
export function declarePresence(state,user,input,now=Date.now()){
 const a=find(state,user,input.id);if(a.status!=='running'||now>=Date.parse(a.endsAt)||input.confirmed!==true)throw Error('Presença exige assembleia em curso e confirmação da participação.');
 const own=a.roll.filter(r=>r.representativeId===user.id&&Date.parse(r.powerUntil)>=now);if(!own.length)throw Error('Nenhuma unidade com representação vigente para esta conta.');
 for(const r of own)if(!a.presences.some(p=>p.houseId===r.houseId))a.presences.push({houseId:r.houseId,userId:user.id,at:new Date(now).toISOString(),kind:'self-declared'});
 return assemblyView(a,user);
}
function currentItem(a,id){const item=a.agenda.find(i=>i.id===id);if(!item)throw Error('Matéria fora desta assembleia.');return item;}
export function openAgenda(state,user,input,now=Date.now()){
 const a=editable(state,user,input),item=currentItem(a,input.agendaId);if(a.status!=='running'||now>=Date.parse(a.endsAt)||item.status!=='pending'||a.agenda.some(i=>i.status==='open'))throw Error('Abra uma matéria pendente por vez, dentro do período.');
 const eligible=a.roll.filter(r=>a.presences.some(p=>p.houseId===r.houseId&&p.userId===r.representativeId));if(!eligible.length)throw Error('Registre a presença declarada dos representantes antes de abrir a votação.');
 item.eligible=eligible.map(r=>r.houseId);item.status='open';item.openedAt=new Date(now).toISOString();item.version++;a.version++;event(a,user,'Matéria aberta: '+item.title,text(input.reason,'Motivo',500),now);return assemblyView(a,user);
}
export function voteAgenda(state,user,input,now=Date.now()){
 const a=find(state,user,input.id),item=currentItem(a,input.agendaId),r=a.roll.find(r=>r.houseId===input.houseId&&r.representativeId===user.id);
 if(a.status!=='running'||item.status!=='open'||now>=Date.parse(a.endsAt)||!r||Date.parse(r.powerUntil)<now||!item.eligible.includes(r.houseId))throw Error('Voto fora da representação, presença ou período permitido.');
 if(input.itemVersion!==item.version||!['yes','no','abstain'].includes(input.choice))throw Error('Matéria mudou ou opção inválida.');
 const previous=item.votes.find(v=>v.houseId===r.houseId);if(previous){if(previous.choice!==input.choice)throw Error('A unidade já registrou seu voto definitivo.');return assemblyView(a,user);}
 item.votes.push({houseId:r.houseId,userId:user.id,choice:input.choice,weight:r.weight,at:new Date(now).toISOString()});return assemblyView(a,user);
}
const compare=(actual,total,rule)=>rule.comparison==='gt'?BigInt(actual)*BigInt(rule.denominator)>BigInt(total)*BigInt(rule.numerator):BigInt(actual)*BigInt(rule.denominator)>=BigInt(total)*BigInt(rule.numerator);
export function countAgenda(a,item){
 const all=a.roll.reduce((n,r)=>n+r.weight,0),present=a.roll.filter(r=>item.eligible.includes(r.houseId)).reduce((n,r)=>n+r.weight,0),counts=Object.fromEntries(['yes','no','abstain'].map(c=>[c,item.votes.filter(v=>v.choice===c).reduce((n,v)=>n+v.weight,0)])),base=item.approval.base==='all'?all:item.approval.base==='present'?present:counts.yes+counts.no;
 const attendanceReached=present>0&&compare(present,all,item.attendance),approvalReached=base>0&&compare(counts.yes,base,item.approval);
 return {...counts,allWeight:all,presentWeight:present,approvalBase:base,unitsResponded:item.votes.length,attendanceReached,approvalReached,approved:attendanceReached&&approvalReached,notice:'Apuração conforme parâmetros registrados. Validade jurídica depende da convocação, poderes e regras conferidos.'};
}
export function closeAgenda(state,user,input,now=Date.now()){
 const a=editable(state,user,input),item=currentItem(a,input.agendaId);if(a.status!=='running'||!['pending','open'].includes(item.status)||!['closed','cancelled'].includes(input.status))throw Error('Matéria não pode receber esse encaminhamento.');
 if(input.status==='closed'&&item.status!=='open')throw Error('Abra a matéria antes de apurar.');item.status=input.status;item.version++;item.closedAt=new Date(now).toISOString();if(input.status==='closed')item.result=countAgenda(a,item);a.version++;event(a,user,(input.status==='closed'?'Matéria apurada: ':'Matéria cancelada: ')+item.title,text(input.reason,'Justificativa',1000),now);return assemblyView(a,user);
}
export function closeAssembly(state,user,input,now=Date.now()){
 const a=editable(state,user,input);if(a.status!=='running'||a.agenda.some(i=>!['closed','cancelled'].includes(i.status))||input.minutesReviewed!==true)throw Error('Encerre as matérias e confirme a revisão da ata.');
 const minutes={text:text(input.minutes,'Ata revisada',30000,20),approvedBy:user.id,approvedAt:new Date(now).toISOString(),legalRegime:a.legalRegime,convocationReference:a.convocationReference,rulesReference:a.rulesReference,roll:structuredClone(a.roll),presences:structuredClone(a.presences),agenda:structuredClone(a.agenda)};
 a.minutes={...minutes,sha256:fingerprint(minutes),notice:'Hash de integridade; não é assinatura digital ou certificação jurídica.'};a.status='closed';a.version++;event(a,user,'Ata revisada registrada e assembleia encerrada',text(input.reason,'Motivo',1000),now);return assemblyView(a,user);
}
export function assemblyView(a,user){
 const managing=can(user,'assemblies');return {id:a.id,tenant:a.tenant,title:a.title,legalRegime:a.legalRegime,convocationReference:a.convocationReference,rulesReference:a.rulesReference,startsAt:a.startsAt,endsAt:a.endsAt,status:a.status,version:a.version,canManage:managing,roll:a.roll.map(r=>managing?structuredClone(r):{houseId:r.houseId,houseNumber:r.houseNumber,weight:r.weight,myRepresentation:r.representativeId===user.id}),myPresences:a.presences.filter(p=>p.userId===user.id).map(p=>p.houseId),agenda:a.agenda.map(({votes,...item})=>({...structuredClone(item),myVotes:votes.filter(v=>v.userId===user.id).map(v=>({houseId:v.houseId,choice:v.choice})),...(managing?{received: votes.length}:{})})),...(managing?{history:structuredClone(a.history)}:{}),...(a.minutes?{minutes:{text:a.minutes.text,approvedAt:a.minutes.approvedAt,sha256:a.minutes.sha256,notice:a.minutes.notice}}:{})};
}
export function assembliesView(state,user){return {canManage:can(user,'assemblies'),assemblies:(state.assemblies||[]).filter(a=>canReadAssembly(a,user)).map(a=>assemblyView(a,user)).reverse()};}
export function readAssembly(state,user,id){return assemblyView(find(state,user,id),user);}
export function exportMinutes(state,user,id){permit(user);const a=find(state,user,id);if(!a.minutes)throw Error('Ata ainda não registrada.');const {sha256,notice,...record}=a.minutes;if(fingerprint(record)!==sha256)throw Error('Integridade da ata não confirmada.');return {id:a.id,title:a.title,minutes:structuredClone(a.minutes)};}
export function proposeHandover(db,user,input,now=Date.now()){
 if(user.role!=='sindico')throw Error('Somente o síndico atual propõe transferência de gestão.');const target=usersInTenant(db.users,user.tenant).find(u=>u.id===input.targetId&&u.id!==user.id&&validBinding(db.state,u,now));if(!target)throw Error('Escolha outra conta vigente deste condomínio.');
 const mandateUntil=dateBRLocal(input.mandateUntil);if(Date.parse(mandateUntil)<=now)throw Error('Informe término futuro do mandato.');
 const proposal={id:randomUUID(),tenant:user.tenant,from:user.id,to:target.id,mandateUntil,basis:text(input.basis,'Evidência da escolha/mandato',1000),reason:text(input.reason,'Motivo',500),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000).toISOString(),status:'pending',version:1};db.state.managementHandovers??=[];db.state.managementHandovers.push(proposal);return {id:proposal.id,status:proposal.status};
}
export function acceptHandover(db,user,input,now=Date.now()){
 const p=(db.state.managementHandovers||[]).find(p=>p.id===input.id&&p.tenant===user.tenant&&p.to===user.id&&p.status==='pending');if(!p||input.accepted!==true||Date.parse(p.expiresAt)<=now||Date.parse(p.mandateUntil)<=now)throw Error('Transferência indisponível ou sem aceitação.');
 const users=usersInTenant(db.users,user.tenant),previous=users.find(u=>u.id===p.from&&u.role==='sindico'&&validBinding(db.state,u,now)),target=users.find(u=>u.id===user.id&&validBinding(db.state,u,now));if(!previous||!target)throw Error('Os vínculos mudaram. Prepare outra transferência.');
 previous.active=false;previous.accessVersion=(previous.accessVersion||0)+1;Object.assign(target,{role:'sindico',active:true,houses:[],delegations:[],residentId:null,validUntil:p.mandateUntil,accessVersion:(target.accessVersion||0)+1});p.status='accepted';p.version++;p.acceptedAt=new Date(now).toISOString();return {status:p.status,revokeUserIds:[previous.id,target.id]};
}
