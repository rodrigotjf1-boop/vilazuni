import {randomBytes,createHash} from 'node:crypto';
import {createTask,advanceTask} from './tasks.mjs';
const hash=token=>createHash('sha256').update(token).digest('hex');
export function createTaskProposalStore(){
 const proposals=new Map();
 function apply(state,users,user,input,now){
  if(input.command==='create')return createTask(state,users,user,input.task,now);
  if(['start','requestReview'].includes(input.command))return advanceTask(state,user,{id:input.task?.id,version:input.task?.version,status:input.command==='start'?'doing':'review'},now);
  throw Error('Assistência permite preparar criação, início ou pedido de revisão de tarefa.');
 }
 return {
  preview(state,users,user,input,now=Date.now()){
   for(const [key,p] of proposals)if(p.expires<=now)proposals.delete(key);
   if([...proposals.values()].filter(p=>p.userId===user.id&&p.tenant===user.tenant).length>=10||proposals.size>=1000)throw Error('Há muitas propostas pendentes. Aguarde a expiração das anteriores.');
   const task=apply(structuredClone(state),users,user,input,now),token=randomBytes(32).toString('base64url');proposals.set(hash(token),{userId:user.id,tenant:user.tenant,input:structuredClone(input),expires:now+5*60000});
   return {token,expiresAt:new Date(now+5*60000).toISOString(),task:{title:task.title,area:task.area,due:task.due,status:task.status},notice:'Prévia sem gravação. Confirme após conferir a tarefa. A conclusão continua exigindo evidências e revisão pelo fluxo habitual.'};
  },
  confirm(state,users,user,input,now=Date.now()){
   const key=hash(String(input.token||'')),p=proposals.get(key);if(!p||p.expires<=now||p.userId!==user.id||p.tenant!==user.tenant||input.confirmed!==true)throw Error('Proposta indisponível, expirada ou sem confirmação.');
   const task=apply(state,users,user,p.input,now);return {task,consume(){proposals.delete(key);}};
  }
 };
}
