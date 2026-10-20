import {randomUUID,createHash} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
const MAX_FILE=2*1024*1024,MAX_TOTAL=32*1024*1024;
function text(value,label,max=160){if(typeof value!=='string'||value.trim().length<3||value.trim().length>max)throw Error(`${label}: use entre 3 e ${max} caracteres.`);return value.trim();}
function expiry(value){
 if(value==null||value==='')return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00Z'))||new Date(value+'T12:00Z').toISOString().slice(0,10)!==value)throw Error('Informe vencimento válido ou deixe sem vencimento.');
 return value;
}
function owner(users,user,id,now){const p=users.find(p=>p.id===id&&p.tenant===user.tenant&&can(p,'documents')&&p.active&&(!p.validUntil||Date.parse(p.validUntil)>now));if(!p)throw Error('Selecione responsável ativo com acesso a documentos.');return p;}
function pdf(state,input){
 const fileName=text(input.fileName,'Nome do arquivo',120);
 if(!/\.pdf$/i.test(fileName)||/[\x00-\x1f\x7f/\\]/.test(fileName)||fileName.startsWith('.'))throw Error('Envie arquivo PDF com nome simples, sem caminhos.');
 const match=/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(input.data||''));if(!match)throw Error('Envie um arquivo PDF.');
 const bytes=Buffer.from(match[1],'base64');
 if(bytes.length<16||bytes.length>MAX_FILE||bytes.toString('base64')!==match[1]||bytes.subarray(0,5).toString('ascii')!=='%PDF-'||!bytes.subarray(-1024).toString('ascii').includes('%%EOF'))throw Error('PDF inválido ou maior que 2 MB.');
 const used=(state.documents||[]).reduce((n,d)=>n+d.versions.reduce((sum,v)=>sum+v.bytes,0),0);if(used+bytes.length>MAX_TOTAL)throw Error('Limite de 32 MB de documentos do piloto atingido.');
 return {fileName,mime:'application/pdf',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),data:match[1]};
}
function settings(input){const expiresOn=expiry(input.expiresOn);if(!Number.isInteger(input.alertDays)||input.alertDays<0||input.alertDays>365)throw Error('Antecedência de alerta de 0 a 365 dias.');return {expiresOn,alertDays:input.alertDays};}
function view(d){return {...structuredClone(d),versions:d.versions.map(({data,...v})=>structuredClone(v))};}
export function visibleDocuments(state,user){return can(user,'documents')?(state.documents||[]).filter(d=>d.tenant===user.tenant).map(view):[];}
export function documentAlerts(state,user,now=Date.now()){
 if(!can(user,'documents'))return [];
 const today=Date.parse(localDay(now)+'T12:00Z');
 return (state.documents||[]).filter(d=>d.tenant===user.tenant&&d.active).flatMap(d=>{
  const v=d.versions.at(-1);if(!v.expiresOn)return [];const daysRemaining=Math.round((Date.parse(v.expiresOn+'T12:00Z')-today)/86400000);if(daysRemaining>v.alertDays)return [];
  return [{id:d.id,title:d.title,expiresOn:v.expiresOn,daysRemaining,status:daysRemaining<0?'expired':daysRemaining===0?'today':'due',responsible:v.responsible,version:v.number}];
 }).sort((a,b)=>a.daysRemaining-b.daysRemaining);
}
export function createDocument(state,users,user,input,now=Date.now()){
 if(!can(user,'documents'))throw Error('Cadastro restrito à gestão de documentos.');
 const title=text(input.title,'Título'),category=text(input.category,'Categoria');
 const person=owner(users,user,input.responsibleId,now),config=settings(input),file=pdf(state,input);
 const d={id:randomUUID(),tenant:user.tenant,title,category,active:true,version:1,versions:[{id:randomUUID(),number:1,...file,...config,responsibleId:person.id,responsible:person.name,createdAt:new Date(now).toISOString(),createdBy:user.name,reason:text(input.reason,'Descrição da versão',500)}],history:[{at:new Date(now).toISOString(),actor:user.name,action:'Documento cadastrado'}]};
 state.documents??=[];state.documents.push(d);return view(d);
}
function editable(state,user,input){
 if(!can(user,'documents'))throw Error('Documento indisponível.');const d=(state.documents||[]).find(d=>d.id===input.id&&d.tenant===user.tenant);if(!d)throw Error('Documento indisponível.');
 if(!Number.isInteger(input.version)||input.version!==d.version)throw Error('O documento mudou. Atualize antes de continuar.');return d;
}
export function addDocumentVersion(state,users,user,input,now=Date.now()){
 const d=editable(state,user,input);if(!d.active)throw Error('Reative o documento antes de incluir versão.');if(d.versions.length>=10)throw Error('Limite de dez versões por documento no piloto.');
 const person=owner(users,user,input.responsibleId,now),config=settings(input),file=pdf(state,input),reason=text(input.reason,'Motivo da nova versão',500);
 const v={id:randomUUID(),number:d.versions.length+1,...file,...config,responsibleId:person.id,responsible:person.name,createdAt:new Date(now).toISOString(),createdBy:user.name,reason};
 d.versions.push(v);d.version++;d.history.push({at:new Date(now).toISOString(),actor:user.name,action:'Versão '+v.number+' registrada · '+reason});return view(d);
}
export function toggleDocument(state,user,input,now=Date.now()){
 const d=editable(state,user,input),reason=text(input.reason,'Motivo',500);if(typeof input.active!=='boolean'||input.active===d.active)throw Error('Alteração inválida.');
 d.active=input.active;d.version++;d.history.push({at:new Date(now).toISOString(),actor:user.name,action:(d.active?'Documento reativado':'Documento arquivado')+' · '+reason});return view(d);
}
export function readDocumentFile(state,user,id,versionId){
 const d=can(user,'documents')&&(state.documents||[]).find(d=>d.id===id&&d.tenant===user.tenant),v=d&&d.versions.find(v=>v.id===versionId);
 if(!v)throw Object.assign(Error('Documento indisponível.'),{status:403});const bytes=Buffer.from(v.data,'base64');
 if(bytes.length!==v.bytes||createHash('sha256').update(bytes).digest('hex')!==v.sha256)throw Error('Integridade do documento não confirmada.');
 return {fileName:v.fileName,mime:v.mime,bytes};
}
