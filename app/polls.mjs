import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {dateBRLocal} from './domain.mjs';
import {text} from './knowledge.mjs';

const eligible=(poll,user)=>poll.tenant===user.tenant&&(poll.audience==='all'||['proprietario','ocupante'].includes(user.role));
function find(state,user,id){const poll=(state.consultativePolls||[]).find(p=>p.id===id&&p.tenant===user.tenant);if(!poll||!eligible(poll,user)&&!can(user,'governance'))throw Object.assign(Error('Enquete indisponível.'),{status:403});return poll;}
function status(poll,now){return poll.status==='open'&&Date.parse(poll.closesAt)<=now?'closed':poll.status;}
function view(poll,user,now){
 const vote=poll.votes.find(v=>v.userId===user.id),currentStatus=status(poll,now),results=currentStatus!=='open'||can(user,'governance');
 return {id:poll.id,title:poll.title,description:poll.description,audience:poll.audience,version:poll.version,status:currentStatus,closesAt:poll.closesAt,createdAt:poll.createdAt,options:poll.options.map(option=>({...option,...(results?{count:poll.votes.filter(v=>v.optionId===option.id).length}:{})})),total:results?poll.votes.length:null,myOptionId:vote?.optionId||null,canVote:eligible(poll,user)&&currentStatus==='open'&&!vote,canManage:can(user,'governance'),notice:'Consulta de opinião: uma resposta por conta. Sem quórum, voto por unidade, procuração ou efeito de assembleia. Resposta identificada internamente; a interface mostra somente totais e sua própria escolha.',...(can(user,'governance')?{history:structuredClone(poll.history)}:{})};
}
export function pollsView(state,user,now=Date.now()){
 return {canManage:can(user,'governance'),polls:(state.consultativePolls||[]).filter(p=>p.tenant===user.tenant&&(eligible(p,user)||can(user,'governance'))).map(p=>view(p,user,now)).reverse()};
}
export function readPoll(state,user,id,now=Date.now()){return view(find(state,user,id),user,now);}
export function createPoll(state,user,input,now=Date.now()){
 if(!can(user,'governance'))throw Error('Cadastro restrito à gestão de enquetes consultivas.');
 if((state.consultativePolls||[]).filter(p=>p.tenant===user.tenant).length>=200)throw Error('Limite de duzentas enquetes por condomínio no piloto.');
 if(!['all','residents'].includes(input.audience))throw Error('Escolha o público da enquete.');
 const title=text(input.title,'Pergunta',200),description=text(input.description,'Contexto',2000),reason=text(input.reason,'Motivo',500),closesAt=dateBRLocal(input.closesAt);
 if(Date.parse(closesAt)<=now||Date.parse(closesAt)>now+90*86400000)throw Error('Encerramento deve ser futuro, em até noventa dias.');
 if(!Array.isArray(input.options)||input.options.length<2||input.options.length>6)throw Error('Informe de duas a seis opções.');
 const labels=input.options.map(label=>text(label,'Opção',120,1));if(new Set(labels.map(s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR'))).size!==labels.length)throw Error('As opções devem ser diferentes.');
 if(input.consultative!==true)throw Error('Confirme que esta enquete é somente consultiva.');
 const poll={id:randomUUID(),tenant:user.tenant,title,description,audience:input.audience,closesAt,status:'open',version:1,createdAt:new Date(now).toISOString(),options:labels.map(label=>({id:randomUUID(),label})),votes:[],history:[{at:new Date(now).toISOString(),actor:user.name,action:'Enquete consultiva publicada',reason}]};
 state.consultativePolls??=[];state.consultativePolls.push(poll);return view(poll,user,now);
}
export function votePoll(state,user,input,now=Date.now()){
 const poll=find(state,user,input.id);
 if(!eligible(poll,user)||status(poll,now)!=='open')throw Error('Esta enquete não recebe sua resposta.');
 if(input.version!==poll.version)throw Error('A enquete mudou. Atualize antes de responder.');
 if(!poll.options.some(o=>o.id===input.optionId))throw Error('Selecione uma opção desta enquete.');
 const previous=poll.votes.find(v=>v.userId===user.id);
 if(previous){if(previous.optionId!==input.optionId)throw Error('Sua resposta já foi registrada e não pode ser alterada.');return view(poll,user,now);}
 poll.votes.push({userId:user.id,optionId:input.optionId,at:new Date(now).toISOString()});return view(poll,user,now);
}
export function closePoll(state,user,input,now=Date.now()){
 if(!can(user,'governance'))throw Error('Encerramento restrito à gestão de enquetes consultivas.');const poll=find(state,user,input.id),reason=text(input.reason,'Motivo',500);
 if(input.version!==poll.version)throw Error('A enquete mudou. Atualize antes de continuar.');
 if(!['closed','cancelled'].includes(input.status)||poll.status==='cancelled'||poll.status==='closed')throw Error('Transição de enquete inválida.');
 poll.status=input.status;poll.version++;poll.history.push({at:new Date(now).toISOString(),actor:user.name,action:input.status==='closed'?'Consulta encerrada':'Consulta cancelada',reason});return view(poll,user,now);
}
