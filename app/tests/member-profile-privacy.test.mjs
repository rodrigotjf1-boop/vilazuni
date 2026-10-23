import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {memberProfile,listMemberProfiles,saveMemberProfile,memberPhoto} from '../member-profiles.mjs';
import {grantCaretakerContacts,revokeCaretakerContacts} from '../household-access.mjs';

const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2gHkAAAAASUVORK5CYII=';
const now=Date.parse('2026-10-19T12:00:00-03:00');
const forbidden=fn=>assert.throws(fn,error=>error.status===403);
function sample(){
 const state=seed(),user=(id,role,extra={})=>({id,role,tenant:'chandra',active:true,name:'Pessoa '+id,email:id+'@example.invalid',houses:[],...extra});
 const syndic=user('syndic','sindico'),owner=user('owner','proprietario',{houses:['c02']}),otherOwner=user('other','proprietario',{houses:['c03']}),caretaker=user('caretaker','zelador'),manager=user('manager','administradora',{delegations:['residents'],validUntil:'2027-01-01'}),realEstate=user('realestate','imobiliaria',{houses:['c02'],validUntil:'2027-01-01'});
 state.residents=[{id:'lease-private',tenant:'chandra',houseId:'c02',kind:'annual',name:'Inquilino anual',startDate:'2026-10-01',contractEndDate:'2027-09-30',endedOn:null}];
 state.stays.push({id:'stay-private',tenant:'chandra',houseId:'c02',status:'approved',start:'2026-10-19T09:00:00-03:00',end:'2026-10-25T11:00:00-03:00'});
 const annual=user('annual','ocupante',{houses:['c02'],residentId:'lease-private',validUntil:'2027-10-01T00:00:00-03:00'}),temporary=user('temporary','temporario',{houses:['c02'],stayId:'stay-private',validUntil:'2026-10-25T11:00:00-03:00'}),foreign={...owner,id:'foreign',tenant:'other-tenant',houses:['c02']};
 const users=[syndic,owner,otherOwner,caretaker,manager,realEstate,annual,temporary,foreign];
 for(const tenant of [annual,temporary])saveMemberProfile(state,users,tenant,{version:0,age:38,phone:'5522999988888',whatsapp:'5522999977777',photo:portrait},now);
 return {state,users,syndic,owner,otherOwner,caretaker,manager,realEstate,annual,temporary,foreign};
}

test('perfis anuais e temporários não expõem contatos/fotos a delegações ou imobiliária sem autorização',()=>{
 const f=sample();
 for(const tenant of [f.annual,f.temporary]){
  for(const viewer of [tenant,f.syndic,f.owner]){
   const view=memberProfile(f.state,f.users,viewer,tenant.id,now);
   assert.equal(view.email,tenant.email);assert.equal(view.phone,'5522999988888');assert.equal(view.whatsapp,'5522999977777');assert.equal(view.photo,true);assert.equal(view.contactsVisible,true);
   assert.equal(memberPhoto(f.state,f.users,viewer,tenant.id,1,now).mime,'image/png');
  }
  const view=memberProfile(f.state,f.users,f.manager,tenant.id,now);
  assert.equal(view.name,tenant.name);assert.equal(view.contactsVisible,false);assert.equal(view.email,'');assert.equal(view.phone,'');assert.equal(view.whatsapp,'');assert.equal(view.photo,false);assert.equal(view.age,null);assert.equal(view.canEdit,false);
  forbidden(()=>memberPhoto(f.state,f.users,f.manager,tenant.id,1,now));
  for(const viewer of [f.otherOwner,f.caretaker,f.realEstate,f.foreign]){
   forbidden(()=>memberProfile(f.state,f.users,viewer,tenant.id,now));
   forbidden(()=>memberPhoto(f.state,f.users,viewer,tenant.id,1,now));
  }
 }
 const directory=listMemberProfiles(f.state,f.users,f.manager,now),redacted=directory.filter(p=>['ocupante','temporario'].includes(p.role));
 assert.equal(redacted.length,2);assert.ok(redacted.every(p=>!p.email&&!p.phone&&!p.whatsapp&&!p.photo));
 forbidden(()=>listMemberProfiles(f.state,f.users,f.owner,now));
 forbidden(()=>memberProfile(f.state,f.users,f.annual,f.temporary.id,now));
});

test('zeladoria lê perfil somente durante autorização da casa e perde acesso à foto após revogação ou expiração',()=>{
 const f=sample(),grant=grantCaretakerContacts(f.state,f.users,f.owner,{houseId:'c02',userId:f.caretaker.id,expiresOn:'2026-10-19',reason:'Acompanhar manutenção agendada com o inquilino'},now).grant;
 assert.equal(memberProfile(f.state,f.users,f.caretaker,f.annual.id,now).phone,'5522999988888');
 assert.equal(memberProfile(f.state,f.users,f.caretaker,f.temporary.id,now).photo,true);
 assert.equal(memberPhoto(f.state,f.users,f.caretaker,f.annual.id,1,Date.parse('2026-10-19T23:59:59-03:00')).mime,'image/png');
 forbidden(()=>memberPhoto(f.state,f.users,f.caretaker,f.annual.id,1,Date.parse('2026-10-20T00:00:00-03:00')));
 revokeCaretakerContacts(f.state,f.owner,{id:grant.id,reason:'Atendimento concluído'},now+1000);
 forbidden(()=>memberProfile(f.state,f.users,f.caretaker,f.annual.id,now+1000));
 forbidden(()=>memberPhoto(f.state,f.users,f.caretaker,f.temporary.id,1,now+1000));
});

test('consultar contato não autoriza editar a conta e só o próprio inquilino ou síndico altera seu perfil',()=>{
 const f=sample(),input={userId:f.annual.id,version:1,age:40,phone:'5522999966666',whatsapp:'5522999955555',photo:null};
 grantCaretakerContacts(f.state,f.users,f.syndic,{houseId:'c02',userId:f.caretaker.id,expiresOn:'2026-10-20',reason:'Contato autorizado para manutenção'},now);
 for(const viewer of [f.owner,f.caretaker,f.manager,f.realEstate,f.otherOwner]){
  forbidden(()=>saveMemberProfile(f.state,f.users,viewer,input,now));
 }
 const self=saveMemberProfile(f.state,f.users,f.annual,input,now).profile;
 assert.equal(self.version,2);assert.equal(self.canEdit,true);assert.equal(self.phone,input.phone);assert.equal(self.photo,false);
 const management=saveMemberProfile(f.state,f.users,f.syndic,{...input,version:2,age:41},now).profile;
 assert.equal(management.version,3);assert.equal(management.age,41);assert.equal(management.canEdit,true);
});
