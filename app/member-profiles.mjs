import {randomUUID} from 'node:crypto';
import {can,ROLE_NAMES} from './permissions.mjs';
import {portraitAttachment} from './community.mjs';
import {accessPeriod} from './access-periods.mjs';

const deny=message=>{throw Object.assign(Error(message),{status:403});};
function person(users,u,id){const target=users.find(p=>p.tenant===u.tenant&&p.id===(id||u.id));if(!target||target.id!==u.id&&!can(u,'residents'))deny('Perfil fora do seu acesso.');return target;}
const stored=(s,u,id)=>(s.memberProfiles||[]).find(p=>p.tenant===u.tenant&&p.userId===id);
export function memberProfile(s,users,u,id){
 const target=person(users,u,id),p=stored(s,u,target.id);
 return {userId:target.id,version:p?.version||0,name:target.name,email:target.email,role:target.role,roleName:ROLE_NAMES[target.role],active:target.active,accessVersion:target.accessVersion||0,accessPeriod:accessPeriod(s,target),houses:s.houses.filter(h=>h.tenant===u.tenant&&target.houses?.includes(h.id)).map(({id,number})=>({id,number})),age:p?.age??null,phone:p?.phone||'',whatsapp:p?.whatsapp||'',photo:!!p?.photo,residentId:target.residentId||null,stayId:target.stayId||null};
}
export function listMemberProfiles(s,users,u){if(!can(u,'residents'))deny('A lista de pessoas exige gestão de moradores.');return users.filter(p=>p.tenant===u.tenant).map(p=>memberProfile(s,users,u,p.id));}
function phone(value){if(typeof value!=='string')throw Error('Telefone inválido.');const digits=value.replace(/[\s()+.-]/g,'');if(digits&&!/^\d{10,15}$/.test(digits))throw Error('Informe telefone com DDI e DDD.');return digits;}
export function saveMemberProfile(s,users,u,input,now=Date.now()){
 const target=person(users,u,input.userId),old=stored(s,u,target.id);
 if(!Number.isInteger(input.version)||input.version!==(old?.version||0))throw Object.assign(Error('O perfil mudou. Atualize antes de salvar.'),{status:409});
 const age=input.age===''||input.age==null?null:Number(input.age);if(age!==null&&(!Number.isInteger(age)||age<0||age>120))throw Error('Informe idade entre 0 e 120 anos.');
 const photo=input.photo===null?null:input.photo?portraitAttachment(input.photo):old?.photo||null;
 const p={id:old?.id||randomUUID(),tenant:u.tenant,userId:target.id,version:(old?.version||0)+1,age,phone:phone(input.phone||''),whatsapp:phone(input.whatsapp||''),photo,updatedAt:new Date(now).toISOString()};
 s.memberProfiles??=[];if(old)s.memberProfiles[s.memberProfiles.indexOf(old)]=p;else s.memberProfiles.push(p);
 s.audit??=[];s.audit.unshift({id:randomUUID(),tenant:u.tenant,actor:u.name,action:'Perfil pessoal atualizado',resource:p.id,at:new Date(now).toISOString()});
 return {profile:memberProfile(s,users,u,target.id)};
}
export function memberPhoto(s,users,u,id,version){const view=memberProfile(s,users,u,id),p=stored(s,u,view.userId);if(!p?.photo||String(version)!==String(p.version))deny('Foto indisponível.');return {mime:p.photo.mime,bytes:Buffer.from(p.photo.data,'base64')};}
