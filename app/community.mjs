import {randomUUID} from 'node:crypto';
import {can,ROLES,ROLE_NAMES} from './permissions.mjs';
import {validBinding} from './access.mjs';
import {localDay} from './residents.mjs';

export const COMMUNITY_SLOTS = ['sindico','zelador'];
const fail = (message,status=403) => { throw Object.assign(Error(message),{status}); };
const editor = u => can(u,'residents');
const moderator = u => can(u,'communications');
const publisher = u => moderator(u)||['zelador','proprietario','ocupante','temporario'].includes(u.role);
function member(u) { if (!u?.id || !u.tenant || !ROLES.includes(u.role)) fail('Entre com um vínculo vigente neste condomínio.'); }
function text(value,label,max,required=false) {
 if (typeof value !== 'string' && value != null) fail(label+' inválido.',400);
 const result=(value||'').trim();
 if (result.length>max || required&&result.length<3 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) fail('Confira '+label.toLowerCase()+'.',400);
 return result;
}
function date(value) {
 if (!value) return null;
 if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) fail('Informe uma data válida.',400);
 return value;
}
function phone(value) {
 const raw=text(value,'Telefone',30);if (!raw) return '';
 const digits=raw.replace(/[\s()+.-]/g,'');if(!/^\d{10,15}$/.test(digits))fail('Informe telefone com DDI e DDD, somente números.',400);
 return digits;
}
function slot(value) { if(!COMMUNITY_SLOTS.includes(value))fail('Personagem indisponível.',404);return value; }
function record(s,u,name,resource,now) { s.audit??=[];s.audit.unshift({id:randomUUID(),tenant:u.tenant,actor:u.name,actorId:u.id,action:name,resource,at:new Date(now).toISOString()}); }
function version(input,current) { if(!Number.isInteger(input.version)||input.version!==(current?.version||0))fail('O cadastro mudou. Atualize antes de salvar.',409); }
const profileRecord=(s,u,which)=>(s.communityProfiles||[]).find(p=>p.tenant===u.tenant&&p.slot===slot(which));
function linked(s,users,u,p,now) { return !p?.userId || users.some(x=>x.id===p.userId&&x.tenant===u.tenant&&x.role===p.slot&&validBinding(s,x,now)); }
function profileView(s,users,u,which,now) {
 const p=profileRecord(s,u,which),available=!!p&&linked(s,users,u,p,now),house=p?.houseId&&s.houses.find(h=>h.tenant===u.tenant&&h.id===p.houseId);
 if(!available)return {slot:which,version:p?.version||0,configured:false,unavailable:!!p,canEdit:editor(u)};
 return {slot:which,version:p.version,configured:true,canEdit:editor(u),name:p.name,age:p.age,phone:p.phone,whatsapp:p.whatsapp,email:p.email,termStart:p.termStart,termEnd:p.termEnd,inTerm:(!p.termStart||p.termStart<=localDay(now))&&(!p.termEnd||p.termEnd>=localDay(now)),house:house?{id:house.id,number:house.number}:null,isOwner:!!house&&p.isOwner,photo:!!p.photo,userId:p.userId||null};
}
export function portraitAttachment(data) {
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)fail('Use uma foto JPEG, PNG ou WebP.',400);
 const bytes=Buffer.from(match[2],'base64'),mime=match[1];
 if(bytes.length<12||bytes.length>1024*1024||bytes.toString('base64')!==match[2])fail('Use uma foto de até 1 MB.',400);
 const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid)fail('O conteúdo da foto não corresponde ao formato.',400);
 return {mime,data:match[2],bytes:bytes.length};
}
export function communityEditor(s,users,u,which,now=Date.now()) {
 member(u);if(!editor(u))fail('Somente a gestão de pessoas configura os personagens.');
 const p=profileRecord(s,u,which),{photo:attachment,...values}=p||{slot:which,version:0};
 return {profile:{...values,photo:!!attachment},users:users.filter(x=>x.tenant===u.tenant&&x.role===which&&validBinding(s,x,now)).map(({id,name})=>({id,name})),houses:s.houses.filter(h=>h.tenant===u.tenant).map(({id,number})=>({id,number}))};
}
export function saveCommunityProfile(s,users,u,input,now=Date.now()) {
 member(u);if(!editor(u))fail('Somente a gestão de pessoas configura os personagens.');
 const which=slot(input.slot),current=profileRecord(s,u,which);version(input,current);
 const name=text(input.name,'Nome',120,true),email=text(input.email,'E-mail',200);
 if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))fail('Informe um e-mail válido.',400);
 const age=input.age===''||input.age==null?null:Number(input.age);
 if(age!==null&&(!Number.isInteger(age)||age<18||age>120))fail('Informe idade entre 18 e 120 anos.',400);
 const termStart=date(input.termStart),termEnd=date(input.termEnd);
 if(termStart&&termEnd&&termEnd<termStart)fail('O fim da vigência deve ser posterior ao início.',400);
 const houseId=which==='sindico'?(input.houseId||null):null;
 if(houseId&&!s.houses.some(h=>h.tenant===u.tenant&&h.id===houseId))fail('Casa fora deste condomínio.');
 if(input.isOwner!=null&&typeof input.isOwner!=='boolean')fail('Confira a indicação de proprietário.',400);
 const userId=input.userId||null;
 if(userId&&!users.some(x=>x.id===userId&&x.tenant===u.tenant&&x.role===which&&validBinding(s,x,now)))fail('Selecione uma conta ativa deste perfil e condomínio.');
 if(input.photo!=null&&typeof input.photo!=='string')fail('Foto inválida.',400);
 const attachment=input.photo===null?null:input.photo?portraitAttachment(input.photo):current?.photo||null;
 const p={id:current?.id||randomUUID(),tenant:u.tenant,slot:which,version:(current?.version||0)+1,name,age,email,phone:phone(input.phone),whatsapp:phone(input.whatsapp),termStart,termEnd,houseId,isOwner:!!houseId&&input.isOwner===true,userId,photo:attachment,updatedAt:new Date(now).toISOString()};
 s.communityProfiles??=[];if(current)s.communityProfiles[s.communityProfiles.indexOf(current)]=p;else s.communityProfiles.push(p);
 record(s,u,'Ficha do personagem atualizada: '+which,p.id,now);
 return {profile:profileView(s,users,u,which,now)};
}
export function readCommunityPhoto(s,users,u,which,expectedVersion,now=Date.now()) {
 member(u);const view=profileView(s,users,u,which,now),p=profileRecord(s,u,which);
 if(!view.configured||!p?.photo||String(p.version)!==String(expectedVersion))fail('Foto indisponível.',404);
 return {mime:p.photo.mime,bytes:Buffer.from(p.photo.data,'base64')};
}
export function communityProfile(s,users,u,which,now=Date.now()) {
 member(u);const profile=profileView(s,users,u,slot(which),now);
 const tasks=which==='zelador'&&profile.configured&&profile.userId?(s.tasks||[]).filter(t=>t.tenant===u.tenant&&t.assigneeId===profile.userId&&(can(u,'tasks')||u.role==='zelador'&&u.id===profile.userId||t.publicSchedule===true)).map(({id,title,area,due,status})=>({id,title,area,due,status})):[];
 return {profile,tasks,today:localDay(now),canOpenTasks:can(u,'tasks')||u.role==='zelador'&&u.id===profile.userId};
}
function visibleNotices(s,u,now) { return (s.communityNotices||[]).filter(n=>n.tenant===u.tenant&&!n.archivedAt&&(!n.expiresOn||n.expiresOn>=localDay(now))); }
function noticeView(s,u,n,detail=false) {
 const read=(s.communityReads||[]).some(r=>r.tenant===u.tenant&&r.userId===u.id&&r.noticeId===n.id&&r.version===n.version);
 return {id:n.id,version:n.version,title:n.title,...(detail?{body:n.body}:{}),author:n.author,authorRole:ROLE_NAMES[n.authorRole]||n.authorRole,createdAt:n.createdAt,updatedAt:n.updatedAt,expiresOn:n.expiresOn,important:n.important===true,read,canEdit:(!n.important||u.role==='sindico')&&(u.id===n.authorId||moderator(u))};
}
export function communitySummary(s,u,now=Date.now()) {
 member(u);const notices=visibleNotices(s,u,now).map(n=>noticeView(s,u,n));
 return {unreadCount:notices.filter(n=>!n.read).length,importantCount:notices.filter(n=>n.important).length,importantUnreadCount:notices.filter(n=>n.important&&!n.read).length};
}
export function communityView(s,users,u,now=Date.now()) {
 member(u);return {...communitySummary(s,u,now),canPublish:publisher(u),canSetImportant:u.role==='sindico',profiles:COMMUNITY_SLOTS.map(which=>profileView(s,users,u,which,now)),notices:visibleNotices(s,u,now).sort((a,b)=>Number(b.important===true)-Number(a.important===true)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(n=>noticeView(s,u,n))};
}
export function readCommunityNotice(s,u,id,now=Date.now()) {
 member(u);const n=visibleNotices(s,u,now).find(n=>n.id===id);if(!n)fail('Aviso indisponível.',404);return noticeView(s,u,n,true);
}
function markRead(s,u,n,now) {
 s.communityReads??=[];const previous=s.communityReads.find(r=>r.tenant===u.tenant&&r.userId===u.id&&r.noticeId===n.id);
 const receipt={id:previous?.id||randomUUID(),tenant:u.tenant,userId:u.id,noticeId:n.id,version:n.version,readAt:new Date(now).toISOString()};
 if(previous)Object.assign(previous,receipt);else s.communityReads.push(receipt);
}
export function saveCommunityNotice(s,u,input,now=Date.now()) {
 member(u);if(!publisher(u))fail('Este perfil não publica avisos no mural.');
 const existing=input.id?(s.communityNotices||[]).find(n=>n.tenant===u.tenant&&n.id===input.id&&!n.archivedAt):null;
 if(input.id&&!existing)fail('Aviso indisponível.',404);
 if(existing&&existing.authorId!==u.id&&!moderator(u))fail('Você só pode alterar os seus avisos.');version(input,existing);
 if(existing?.important&&u.role!=='sindico')fail('Somente o síndico altera avisos destacados como importantes.');
 if(input.important!==undefined&&typeof input.important!=='boolean')fail('Confira a indicação de aviso importante.',400);
 const important=input.important===undefined?existing?.important===true:input.important;
 if(important!==!!existing?.important&&u.role!=='sindico')fail('Somente o síndico destaca avisos importantes.');
 const title=text(input.title,'Título',160,true),body=text(input.body,'Texto do aviso',5000,true),expiresOn=date(input.expiresOn);
 if(expiresOn&&expiresOn<localDay(now))fail('A validade deve ser hoje ou uma data futura.',400);
 if(!existing&&visibleNotices(s,u,now).length>=300)fail('Arquive avisos antigos antes de publicar novos.',409);
 const n=existing||{id:randomUUID(),tenant:u.tenant,authorId:u.id,author:u.name,authorRole:u.role,createdAt:new Date(now).toISOString(),version:0};
 Object.assign(n,{title,body,expiresOn,important:important===true,version:n.version+1,updatedAt:new Date(now).toISOString()});s.communityNotices??=[];if(!existing)s.communityNotices.push(n);
 markRead(s,u,n,now);record(s,u,existing?'Aviso do mural alterado':'Aviso publicado no mural',n.id,now);return {notice:noticeView(s,u,n,true)};
}
export function markCommunityNoticeRead(s,u,input,now=Date.now()) {
 member(u);const n=visibleNotices(s,u,now).find(n=>n.id===input.id);if(!n)fail('Aviso indisponível.',404);version(input,n);markRead(s,u,n,now);return communitySummary(s,u,now);
}
export function archiveCommunityNotice(s,u,input,now=Date.now()) {
 member(u);const n=visibleNotices(s,u,now).find(n=>n.id===input.id);if(!n)fail('Aviso indisponível.',404);if(n.authorId!==u.id&&!moderator(u))fail('Você só pode arquivar os seus avisos.');version(input,n);
 if(n.important&&u.role!=='sindico')fail('Somente o síndico arquiva avisos destacados como importantes.');
 n.archivedAt=new Date(now).toISOString();n.version++;record(s,u,'Aviso do mural arquivado',n.id,now);return communitySummary(s,u,now);
}
