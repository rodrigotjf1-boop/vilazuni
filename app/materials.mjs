import {randomUUID} from 'node:crypto';
function text(v,label,max=160){if(typeof v!=='string'||v.trim().length<2||v.trim().length>max)throw Error(`${label}: use entre 2 e ${max} caracteres.`);return v.trim();}
function amount(v,zero=false){if(typeof v!=='number'||!Number.isFinite(v)||v<0||(!zero&&v===0)||v>1000000||Math.abs(v*1000-Math.round(v*1000))>0.000001)throw Error('Quantidade deve ser numérica, positiva e ter até três casas decimais (máximo 1000000).');return Math.round(v*1000);}
export function visibleMaterials(state,user){if(!['sindico','zelador'].includes(user.role))return [];return (state.materials||[]).filter(m=>m.tenant===user.tenant).map(m=>({...structuredClone(m),movements:m.movements.filter(e=>user.role==='sindico'||e.actorId===user.id)}));}
export function createMaterial(state,user,input){if(user.role!=='sindico')throw Error('Somente a gestão cadastra materiais.');const name=text(input.name,'Nome'),unit=text(input.unit,'Unidade',30),location=text(input.location,'Depósito / local');const minimum=amount(input.minimum,true)/1000;if((state.materials||[]).some(m=>m.tenant===user.tenant&&m.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')&&m.location.toLocaleLowerCase('pt-BR')===location.toLocaleLowerCase('pt-BR')))throw Error('Material já cadastrado neste local.');const m={id:randomUUID(),tenant:user.tenant,name,unit,location,minimum,balance:0,version:0,movements:[]};state.materials??=[];state.materials.push(m);return structuredClone(m);}
export function moveMaterial(state,user,input,now=Date.now()){
 if(!['sindico','zelador'].includes(user.role))throw Error('Perfil sem acesso ao estoque.');const m=(state.materials||[]).find(m=>m.id===input.id&&m.tenant===user.tenant);if(!m)throw Error('Material indisponível.');
 if(!Number.isInteger(input.version)||input.version!==m.version)throw Error('O estoque mudou. Atualize antes de continuar.');
 const quantity=amount(input.quantity),reason=text(input.reason,'Motivo',500);let task=null;
 if(input.kind==='entry'){if(user.role!=='sindico')throw Error('Somente a gestão registra entradas.');}
 else if(input.kind==='consume'){
  task=state.tasks.find(t=>t.id===input.taskId&&t.tenant===user.tenant&&(user.role==='sindico'||t.assigneeId===user.id));
  if(!task||!['todo','doing'].includes(task.status))throw Error('Selecione uma tarefa aberta autorizada.');
  if(!Number.isInteger(input.taskVersion)||input.taskVersion!==(task.version||0))throw Error('A tarefa mudou. Atualize antes de continuar.');
  if(quantity>Math.round(m.balance*1000))throw Error('Saldo insuficiente.');
 }else throw Error('Movimento não permitido.');
 const balance=Math.round(m.balance*1000)+(input.kind==='entry'?quantity:-quantity);if(balance>1000000000)throw Error('Saldo máximo do piloto excedido.');
 const movement={id:randomUUID(),at:new Date(now).toISOString(),actorId:user.id,actor:user.name,kind:input.kind,quantity:quantity/1000,reason,taskId:task?.id||null,taskTitle:task?.title||null,balance:balance/1000};m.balance=balance/1000;m.version++;m.movements.push(movement);
 if(task){task.version=(task.version||0)+1;task.history??=[];task.history.push({id:randomUUID(),at:movement.at,actor:user.name,action:`Consumo: ${movement.quantity} ${m.unit} de ${m.name} · ${reason}`});task.materialUses??=[];task.materialUses.push({movementId:movement.id,materialId:m.id,name:m.name,unit:m.unit,quantity:movement.quantity,at:movement.at,actor:user.name});}
 return {id:m.id,balance:m.balance,version:m.version,movement:structuredClone(movement)};
}
