import {randomUUID,createHash} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';

export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function text(value,label,max=160,min=3){
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error(`${label}: use de ${min} a ${max} caracteres.`);
 return value.trim();
}
function date(value,label){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00Z'))||new Date(value+'T12:00Z').toISOString().slice(0,10)!==value)throw Error(label+': informe uma data válida.');
 return value;
}
function content(input,number,user,now){
 if(!['community','management'].includes(input.audience))throw Error('Escolha o público da fonte.');
 const effectiveFrom=date(input.effectiveFrom,'Início da vigência'),expiresOn=input.expiresOn?date(input.expiresOn,'Fim da vigência'):null;
 if(expiresOn&&expiresOn<effectiveFrom)throw Error('O fim da vigência deve ser igual ou posterior ao início.');
 const fields={title:text(input.title,'Título'),reference:text(input.reference,'Documento e trecho de origem',500),body:text(input.body,'Texto conferido',12000),audience:input.audience,effectiveFrom,expiresOn};
 return {...fields,number,sha256:fingerprint(fields),createdAt:new Date(now).toISOString(),createdBy:user.id,status:'draft'};
}
function manager(user){if(!can(user,'knowledge'))throw Error('Ação restrita à gestão de fontes e resumos.');}
function editable(state,user,input){
 manager(user);const source=(state.knowledgeSources||[]).find(s=>s.id===input.id&&s.tenant===user.tenant);
 if(!source)throw Error('Fonte indisponível.');
 if(!Number.isInteger(input.version)||input.version!==source.version)throw Error('A fonte mudou. Atualize antes de continuar.');
 return source;
}
function capacity(state,user,revision){
 const used=(state.knowledgeSources||[]).filter(s=>s.tenant===user.tenant).reduce((total,s)=>total+s.revisions.reduce((n,r)=>n+Buffer.byteLength(r.body,'utf8'),0),0);
 if(used+Buffer.byteLength(revision.body,'utf8')>1024*1024)throw Error('Limite de 1 MiB de textos por condomínio no piloto.');
}
function audit(source,user,action,reason,now){source.history.push({at:new Date(now).toISOString(),actor:user.name,actorId:user.id,action,reason});}
export function createSource(state,user,input,now=Date.now()){
 manager(user);if((state.knowledgeSources||[]).filter(s=>s.tenant===user.tenant).length>=100)throw Error('Limite de cem fontes por condomínio no piloto.');
 const revision=content(input,1,user,now),reason=text(input.reason,'Motivo',500);capacity(state,user,revision);
 const source={id:randomUUID(),tenant:user.tenant,version:1,active:true,publishedNumber:null,revisions:[revision],history:[]};
 audit(source,user,'Rascunho cadastrado',reason,now);state.knowledgeSources??=[];state.knowledgeSources.push(source);return structuredClone(source);
}
export function reviseSource(state,user,input,now=Date.now()){
 const source=editable(state,user,input);if(!source.active)throw Error('Reative a fonte antes de incluir uma revisão.');
 if(source.revisions.length>=20)throw Error('Limite de vinte revisões por fonte no piloto.');
 const revision=content(input,source.revisions.length+1,user,now),reason=text(input.reason,'Motivo',500);capacity(state,user,revision);
 source.revisions.push(revision);source.version++;audit(source,user,'Revisão '+revision.number+' preparada',reason,now);return structuredClone(source);
}
export function publishSource(state,user,input,now=Date.now()){
 const source=editable(state,user,input),revision=source.revisions.at(-1),today=localDay(now),reason=text(input.reason,'Registro da revisão humana',500);
 if(!source.active||revision.status!=='draft')throw Error('Selecione uma fonte ativa com revisão ainda não publicada.');
 if(input.reviewed!==true)throw Error('Confirme a revisão do texto, da origem e do público antes de publicar.');
 if(revision.effectiveFrom>today||revision.expiresOn&&revision.expiresOn<today)throw Error('Publique uma revisão com vigência atual.');
 Object.assign(revision,{status:'published',publishedAt:new Date(now).toISOString(),reviewedBy:user.id});
 source.publishedNumber=revision.number;source.version++;audit(source,user,'Revisão '+revision.number+' publicada para '+revision.audience,reason,now);return structuredClone(source);
}
export function toggleSource(state,user,input,now=Date.now()){
 const source=editable(state,user,input),reason=text(input.reason,'Motivo',500);
 if(typeof input.active!=='boolean'||input.active===source.active)throw Error('Alteração de disponibilidade inválida.');
 source.active=input.active;source.version++;audit(source,user,input.active?'Fonte reativada':'Fonte retirada de consulta',reason,now);return structuredClone(source);
}
export function publishedSources(state,user,audience='private',now=Date.now()){
 if(!['private','community'].includes(audience))throw Error('Público de consulta inválido.');
 const today=localDay(now);
 return (state.knowledgeSources||[]).filter(s=>s.tenant===user.tenant&&s.active).flatMap(source=>{
  const r=source.revisions.find(r=>r.number===source.publishedNumber&&r.status==='published');
  if(!r||r.effectiveFrom>today||r.expiresOn&&r.expiresOn<today||r.audience==='management'&&(audience==='community'||!can(user,'knowledge')))return [];
  return [{id:source.id,...structuredClone(r)}];
 });
}
const metadata=r=>r?Object.fromEntries(['number','title','reference','audience','effectiveFrom','expiresOn','status','sha256','publishedAt'].map(key=>[key,r[key]??null])):null;
export function knowledgeView(state,user,now=Date.now()){
 const managing=can(user,'knowledge'),published=publishedSources(state,user,'private',now);
 const sources=managing?(state.knowledgeSources||[]).filter(s=>s.tenant===user.tenant).map(s=>({id:s.id,version:s.version,active:s.active,current:metadata(published.find(r=>r.id===s.id)),latest:metadata(s.revisions.at(-1))})):published.map(r=>({id:r.id,active:true,current:metadata(r)}));
 return {canManage:managing,mode:'local-excerpts',sources};
}
export function readSource(state,user,id,now=Date.now()){
 if(can(user,'knowledge')){const source=(state.knowledgeSources||[]).find(s=>s.tenant===user.tenant&&s.id===id);if(source)return structuredClone(source);}
 const revision=publishedSources(state,user,'private',now).find(s=>s.id===id);
 if(!revision)throw Object.assign(Error('Fonte indisponível para este acesso.'),{status:403});
 // Reading a citation never reveals withdrawn revisions, drafts or reviewer identities.
 const {createdBy,reviewedBy,...safe}=revision;return {id,active:true,publishedNumber:revision.number,revisions:[safe]};
}
const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
const stop=new Set('que qual quais como onde quando porque para sobre pelo pela pelos pelas uma umas uns dos das com sem esse essa isso este esta sao tem ser pode posso deve devo meu minha seus suas'.split(' '));
function tokens(value){return [...new Set((normalize(value).match(/[\p{L}\p{N}]{2,}/gu)||[]).filter(t=>!stop.has(t)))];}
export function consultSources(state,user,input,now=Date.now()){
 const question=text(input.question,'Pergunta',1000),audience=input.audience||'private',terms=tokens(question),excerpts=[];
 for(const r of publishedSources(state,user,audience,now)){
  for(const [index,paragraph] of r.body.split(/\n\s*\n|\n/).filter(p=>p.trim()).entries()){
   const words=new Set(tokens(paragraph+' '+r.title)),matched=terms.filter(term=>words.has(term)).length;
   if(!matched)continue;
   excerpts.push({sourceId:r.id,title:r.title,reference:r.reference,revision:r.number,sha256:r.sha256,effectiveFrom:r.effectiveFrom,expiresOn:r.expiresOn,publishedAt:r.publishedAt,paragraph:index+1,quote:paragraph.slice(0,900),matched});
  }
 }
 excerpts.sort((a,b)=>b.matched-a.matched||a.sourceId.localeCompare(b.sourceId)||a.paragraph-b.paragraph);
 return {mode:'local-excerpts',audience,asOf:new Date(now).toISOString(),found:excerpts.length>0,notice:excerpts.length?'Trechos encontrados nas fontes vigentes. Confira o contexto na fonte; a busca não interpreta regras nem executa ações.':'Não encontrei trechos correspondentes nas fontes vigentes disponíveis para este público. Consulte a gestão.',excerpts:excerpts.slice(0,5).map(({matched,...excerpt})=>excerpt)};
}
