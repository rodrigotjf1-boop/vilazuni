import {createHash,randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {seed} from './domain.mjs';
import {createResident} from './residents.mjs';
import {saveCommunityProfile} from './community.mjs';
import {tenantSettings,usersInTenant} from './tenants.mjs';

export const PILOT_DEMO='chandra-pessoas-2026-v1';
const startDate='2026-10-01',contractEndDate='2027-09-30';
const fictional=name=>name+' (fictício)';
const homes=[
 {number:'01',owner:'Ricardo Almeida',email:'ricardo.almeida@example.invalid'},
 {number:'02',owner:'Mariana Costa',email:'mariana.costa@example.invalid',tenant:'Camila Rocha',tenantEmail:'camila.rocha@example.invalid'},
 {number:'03',owner:'Paulo Henrique',email:'paulo.henrique@example.invalid'},
 {number:'04',owner:'Fernanda Souza',email:'fernanda.souza@example.invalid'},
 {number:'05',owner:'André Martins',email:'andre.martins@example.invalid',tenant:'Lucas Barbosa',tenantEmail:'lucas.barbosa@example.invalid'},
 {number:'06',owner:'Juliana Ribeiro',email:'juliana.ribeiro@example.invalid'},
 {number:'07',owner:'Eduardo Lima',email:'eduardo.lima@example.invalid'}
];
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const number=value=>/^\d{1,2}$/.test(String(value))?String(Number(value)).padStart(2,'0'):String(value);
function authorize(db,u){
 if(u.role!=='sindico'||u.tenant!=='chandra'||!can(u,'residents'))fail('O preenchimento fictício está disponível ao síndico do piloto Chandra com gestão de pessoas.');
 if(tenantSettings(db.state,u.tenant).status==='closed')fail('O condomínio está encerrado.');
}
function plan(db,u){
 authorize(db,u);const s=db.state,units=s.houses.filter(h=>h.tenant===u.tenant),residents=(s.residents||[]).filter(r=>r.tenant===u.tenant),profiles=(s.communityProfiles||[]).filter(p=>p.tenant===u.tenant);
 const templates=seed().houses;
 const houses=homes.map(home=>{
  const matches=units.filter(h=>number(h.number)===home.number);if(matches.length>1)fail('Há identificações de unidade ambíguas. Confira a casa '+home.number+'.',409);
  const house=matches[0],records=residents.filter(r=>r.houseId===house?.id),id='c'+home.number;
  const originalOwners=templates.find(h=>h.number===home.number).owners;
  const populatedLegacyOwners=house?.owners?.length&&JSON.stringify(house.owners)!==JSON.stringify(originalOwners);
  const blocked=!!populatedLegacyOwners||records.some(r=>r.demoPack!==PILOT_DEMO)||!house&&units.some(h=>h.id===id);
  const ownerKey='owner:'+home.number,annualKey='annual:'+home.number;
  return {...home,houseId:house?.id||id,createHouse:!house&&!blocked,blocked,ownerKey,annualKey,addOwner:!blocked&&!records.some(r=>r.demoKey===ownerKey&&r.demoPack===PILOT_DEMO),addAnnual:!!home.tenant&&!blocked&&!records.some(r=>r.demoKey===annualKey&&r.demoPack===PILOT_DEMO)};
 });
 if(units.length+houses.filter(h=>h.createHouse).length>tenantSettings(s,u.tenant).limits.units)fail('Os dados fictícios excedem o limite de unidades do plano.',409);
 const staff=[{slot:'sindico',name:fictional('Ricardo Almeida'),age:52,email:homes[0].email,houseId:houses[0].blocked?null:houses[0].houseId,isOwner:!houses[0].blocked,termStart:startDate,termEnd:'2028-09-30'},
  {slot:'zelador',name:fictional('Carlos Ferreira'),age:47,email:'carlos.ferreira@example.invalid',houseId:null,isOwner:false,termStart:null,termEnd:null}].map(p=>({...p,add:!profiles.some(old=>old.slot===p.slot)}));
 const relevant={tenant:tenantSettings(s,u.tenant),units,residents,profiles};
 return {houses,staff,fingerprint:createHash('sha256').update(JSON.stringify(relevant)).digest('hex')};
}
export function previewPilotDemo(db,u){
 const p=plan(db,u);return {pack:PILOT_DEMO,fingerprint:p.fingerprint,startDate,contractEndDate,staff:p.staff.map(({slot,name,add})=>({slot,name,action:add?'add':'keep'})),houses:p.houses.map(h=>({number:h.number,owner:fictional(h.owner),annual:h.tenant?fictional(h.tenant):null,contractReference:h.tenant?'DEMO-'+h.number+'-2026':null,action:h.blocked?'keep':h.addOwner||h.addAnnual?'add':'ready',createHouse:h.createHouse})),counts:{houses:p.houses.filter(h=>h.createHouse).length,owners:p.houses.filter(h=>h.addOwner).length,annual:p.houses.filter(h=>h.addAnnual).length,staff:p.staff.filter(p=>p.add).length,protectedHouses:p.houses.filter(h=>h.blocked).length}};
}
export function applyPilotDemo(db,u,input,now=Date.now()){
 const p=plan(db,u);if(input.fingerprint!==p.fingerprint)fail('Os cadastros mudaram. Confira outra prévia antes de preencher.',409);
 const summary=previewPilotDemo(db,u).counts,next=structuredClone(db),s=next.state,templates=seed().houses;
 for(const home of p.houses){
  if(home.blocked)continue;
  if(home.createHouse){const template=templates.find(h=>h.number===home.number);s.houses.push({...template,owners:[],demoPack:PILOT_DEMO,version:1,history:[{at:new Date(now).toISOString(),actor:u.name,action:'Unidade ilustrativa criada para preenchimento fictício'}]});}
  const add=(kind,name,email,key)=>{
   const r=createResident(s,u,{houseId:home.houseId,kind,name:fictional(name),contact:'Dado fictício · '+email,startDate,...(kind==='annual'?{plannedEndDate:contractEndDate,contractEndDate,contractReference:'DEMO-'+home.number+'-2026',people:[fictional(name)],vehicles:[]}:{})},now).record;
   r.demoPack=PILOT_DEMO;r.demoKey=key;
  };
  if(home.addOwner)add('owner',home.owner,home.email,home.ownerKey);
  if(home.addAnnual)add('annual',home.tenant,home.tenantEmail,home.annualKey);
 }
 for(const profile of p.staff.filter(p=>p.add)){
  saveCommunityProfile(s,usersInTenant(next.users,u.tenant),u,{...profile,version:0,userId:null,phone:'',whatsapp:''},now);
  const record=s.communityProfiles.find(p=>p.tenant===u.tenant&&p.slot===profile.slot);record.demoPack=PILOT_DEMO;
 }
 if(Object.entries(summary).some(([key,n])=>key!=='protectedHouses'&&n>0)){s.audit??=[];s.audit.unshift({id:randomUUID(),tenant:u.tenant,actor:u.name,actorId:u.id,action:'Cadastros fictícios do piloto preenchidos',at:new Date(now).toISOString(),pack:PILOT_DEMO,summary});}
 Object.assign(db,next);return {pack:PILOT_DEMO,created:summary};
}
