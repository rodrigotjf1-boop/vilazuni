import {randomUUID} from 'node:crypto';
import {can,ROLE_NAMES} from './permissions.mjs';
import {portraitAttachment} from './community.mjs';
import {accessPeriod} from './access-periods.mjs';
import {canViewTenantContacts} from './household-access.mjs';

const deny=message=>{throw Object.assign(Error(message),{status:403});};
const tenantProfile=p=>['ocupante','temporario'].includes(p.role);
function targetHouses(s,target){
 const binding=target.role==='ocupante'?(s.residents||[]).find(r=>r.id===target.residentId&&r.tenant===target.tenant):(s.stays||[]).find(r=>r.id===target.stayId&&r.tenant===target.tenant);
 return (target.houses||[]).filter(id=>s.houses.some(h=>h.id===id&&h.tenant===target.tenant)&&(!binding||binding.houseId===id));
}
function contactsVisible(s,u,target,now){return target.id===u.id||!tenantProfile(target)||targetHouses(s,target).some(id=>canViewTenantContacts(s,u,id,now));}
function editable(u,target){return target.id===u.id||can(u,'residents')&&(!tenantProfile(target)||u.role==='sindico');}
function person(s,users,u,id,now){const target=users.find(p=>p.tenant===u.tenant&&p.id===(id||u.id));if(!target||target.id!==u.id&&!can(u,'residents')&&!(tenantProfile(target)&&contactsVisible(s,u,target,now)))deny('Perfil fora do seu acesso.');return target;}
const stored=(s,u,id)=>(s.memberProfiles||[]).find(p=>p.tenant===u.tenant&&p.userId===id);
export function memberProfile(s,users,u,id,now=Date.now()){
 const target=person(s,users,u,id,now),p=stored(s,u,target.id),visible=contactsVisible(s,u,target,now);
 return {userId:target.id,version:p?.version||0,name:target.name,email:visible?target.email:'',role:target.role,roleName:ROLE_NAMES[target.role],active:target.active,accessVersion:target.accessVersion||0,accessPeriod:accessPeriod(s,target),houses:s.houses.filter(h=>h.tenant===u.tenant&&target.houses?.includes(h.id)).map(({id,number})=>({id,number})),age:visible?p?.age??null:null,phone:visible?p?.phone||'':'',whatsapp:visible?p?.whatsapp||'':'',photo:visible&&!!p?.photo,contactsVisible:visible,canEdit:editable(u,target),residentId:target.residentId||null,stayId:target.stayId||null};
}
export function listMemberProfiles(s,users,u,now=Date.now()){if(!can(u,'residents'))deny('A lista de pessoas exige gestão de moradores.');return users.filter(p=>p.tenant===u.tenant).map(p=>memberProfile(s,users,u,p.id,now));}
function phone(value){if(typeof value!=='string')throw Error('Telefone inválido.');const digits=value.replace(/[\s()+.-]/g,'');if(digits&&!/^\d{10,15}$/.test(digits))throw Error('Informe telefone com DDI e DDD.');return digits;}
export function saveMemberProfile(s,users,u,input,now=Date.now()){
 const target=person(s,users,u,input.userId,now),old=stored(s,u,target.id);
 if(!editable(u,target))deny('Somente a própria pessoa ou o síndico pode editar o perfil do inquilino.');
 if(!Number.isInteger(input.version)||input.version!==(old?.version||0))throw Object.assign(Error('O perfil mudou. Atualize antes de salvar.'),{status:409});
 const age=input.age===''||input.age==null?null:Number(input.age);if(age!==null&&(!Number.isInteger(age)||age<0||age>120))throw Error('Informe idade entre 0 e 120 anos.');
 const photo=input.photo===null?null:input.photo?portraitAttachment(input.photo):old?.photo||null;
 const p={id:old?.id||randomUUID(),tenant:u.tenant,userId:target.id,version:(old?.version||0)+1,age,phone:phone(input.phone||''),whatsapp:phone(input.whatsapp||''),photo,updatedAt:new Date(now).toISOString()};
 s.memberProfiles??=[];if(old)s.memberProfiles[s.memberProfiles.indexOf(old)]=p;else s.memberProfiles.push(p);
 s.audit??=[];s.audit.unshift({id:randomUUID(),tenant:u.tenant,actor:u.name,action:'Perfil pessoal atualizado',resource:p.id,at:new Date(now).toISOString()});
 return {profile:memberProfile(s,users,u,target.id,now)};
}
export function memberPhoto(s,users,u,id,version,now=Date.now()){const view=memberProfile(s,users,u,id,now),p=stored(s,u,view.userId);if(!view.photo||!p?.photo||String(version)!==String(p.version))deny('Foto indisponível.');return {mime:p.photo.mime,bytes:Buffer.from(p.photo.data,'base64')};}
