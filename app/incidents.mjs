import {randomUUID} from 'node:crypto';
const roles=['sindico','proprietario','imobiliaria','portaria','zelador'];
function text(value,label,max){if(typeof value!=='string'||value.trim().length<3||value.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return value.trim();}
const allowed=(r,u)=>r.tenant===u.tenant&&(u.role==='sindico'||roles.includes(u.role)&&r.authorId===u.id);
export function visibleIncidents(state,user){return (state.incidents||[]).filter(r=>allowed(r,user)).map(r=>structuredClone(r));}
function record(r,user,action,message,now){r.version++;r.updatedAt=new Date(now).toISOString();r.history.push({id:randomUUID(),at:r.updatedAt,actor:user.name,action,message});}
export function createIncident(state,user,input,now=Date.now()){
 if(!roles.includes(user.role))throw Error('Perfil sem acesso a ocorrências.');
 const houseId=input.houseId||null;
 if(houseId&&!state.houses.some(h=>h.id===houseId&&h.tenant===user.tenant&&(user.role==='sindico'||['proprietario','imobiliaria'].includes(user.role)&&user.houses?.includes(h.id))))throw Error('Casa indisponível para este perfil.');
 const r={id:randomUUID(),tenant:user.tenant,authorId:user.id,author:user.name,title:text(input.title,'Título',160),area:text(input.area,'Local',160),description:text(input.description,'Relato',3000),houseId,status:'open',assigneeId:null,owner:'Aguardando atribuição',createdAt:new Date(now).toISOString(),version:0,history:[]};
 record(r,user,'Ocorrência aberta',r.description,now);state.incidents??=[];state.incidents.push(r);return structuredClone(r);
}
export function updateIncident(state,users,user,input,now=Date.now()){
 const r=(state.incidents||[]).find(r=>r.id===input.id&&allowed(r,user));if(!r)throw Error('Ocorrência indisponível.');
 if(!Number.isInteger(input.version)||input.version!==r.version)throw Error('A ocorrência mudou. Atualize a lista antes de continuar.');
 const message=text(input.message,'Atualização / justificativa',1500);
 let action='Comentário registrado';
 if(input.action==='assign'){
  if(user.role!=='sindico'||['resolved','cancelled'].includes(r.status))throw Error('Atribuição não permitida.');
  const person=users.find(p=>p.id===input.assigneeId&&p.tenant===user.tenant&&p.role==='sindico'&&p.active&&(!p.validUntil||Date.parse(p.validUntil)>now));if(!person)throw Error('Escolha uma conta de gestão ativa deste condomínio.');
  r.assigneeId=person.id;r.owner=person.name;action='Responsável definido: '+person.name;
 }else if(input.action==='status'){
  if(user.role!=='sindico')throw Error('Somente a gestão altera o andamento.');
  const transitions={open:['doing','cancelled'],doing:['resolved','cancelled'],resolved:['open'],cancelled:['open']};
  if(!transitions[r.status]?.includes(input.status))throw Error('Mudança de andamento não permitida.');
  if(input.status==='doing'&&!r.assigneeId)throw Error('Defina um responsável antes de iniciar.');
  r.status=input.status;action=({open:'Ocorrência reaberta',doing:'Em apuração',resolved:'Ocorrência resolvida',cancelled:'Ocorrência cancelada'})[r.status];
 }else if(input.action!=='comment'||['resolved','cancelled'].includes(r.status))throw Error('Comentário não permitido. Solicite à gestão a reabertura.');
 record(r,user,action,message,now);return structuredClone(r);
}
