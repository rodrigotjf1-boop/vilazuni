import {randomUUID} from 'node:crypto';import {can} from './permissions.mjs';
const operator=u=>can(u,'parcels')||u.role==='portaria';
function text(v,label,max=160){if(typeof v!=='string'||v.trim().length<3||v.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return v.trim();}
export const canReadParcel=(p,u)=>p.tenant===u.tenant&&(operator(u)||['proprietario','imobiliaria','ocupante','temporario'].includes(u.role)&&p.recipientUserId===u.id&&u.houses?.includes(p.houseId));
export function visibleParcels(state,user){return structuredClone((state.parcels||[]).filter(p=>canReadParcel(p,user)));}
export function createParcel(state,users,user,input,now=Date.now()){
 if(!operator(user))throw Error('Recebimento restrito à portaria e gestão de encomendas.');
 if(!state.houses.some(h=>h.id===input.houseId&&h.tenant===user.tenant))throw Error('Casa indisponível.');
 let recipientUserId=input.recipientUserId||null,recipientName;
 if(recipientUserId){const recipient=users.find(p=>p.id===recipientUserId&&p.tenant===user.tenant&&['proprietario','imobiliaria','ocupante','temporario'].includes(p.role)&&p.houses?.includes(input.houseId)&&p.active&&(!p.validUntil||Date.parse(p.validUntil)>now));if(!recipient)throw Error('Conta destinatária fora do vínculo autorizado.');recipientName=recipient.name;}else recipientName=text(input.recipientName,'Destinatário');
 const p={id:randomUUID(),tenant:user.tenant,houseId:input.houseId,recipientUserId,recipientName,description:text(input.description,'Descrição',300),location:text(input.location,'Local de guarda'),status:'received',version:1,receivedAt:new Date(now).toISOString(),history:[{at:new Date(now).toISOString(),actor:user.name,action:'Encomenda recebida'}]};state.parcels??=[];state.parcels.push(p);return structuredClone(p);
}
export function updateParcel(state,user,input,now=Date.now()){
 if(!operator(user))throw Error('Retirada restrita à portaria e gestão de encomendas.');const p=(state.parcels||[]).find(p=>p.id===input.id&&p.tenant===user.tenant);if(!p)throw Error('Encomenda indisponível.');if(!Number.isInteger(input.version)||input.version!==p.version)throw Error('A encomenda mudou. Atualize antes de continuar.');if(p.status!=='received'||!['collected','cancelled'].includes(input.status))throw Error('Alteração não permitida.');const reason=text(input.reason,'Observação',500);const pickedUpBy=input.status==='collected'?text(input.pickedUpBy,'Pessoa que retirou'):null;
 p.status=input.status;p.version++;p.pickedUpBy=pickedUpBy;p.history.push({at:new Date(now).toISOString(),actor:user.name,action:input.status==='collected'?'Retirada registrada':'Registro cancelado',reason,pickedUpBy});return structuredClone(p);
}
