import {visibleIncidents,createIncident,updateIncident} from './incidents.mjs';
import {visibleTasks,createTask,assignTask,advanceTask,addTaskPhoto,readTaskPhoto} from './tasks.mjs';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {visibleResidents,createResident,updateResident,endResident,localDay} from './residents.mjs';
import {seed,scopedHouses,scopedStays,createStay,changeStay} from './domain.mjs';
const scrypt=promisify(scryptCallback),digest=v=>createHash('sha256').update(v).digest('hex');
const permittedRoles=['proprietario','imobiliaria','portaria','zelador'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,tenant:u.tenant,houses:u.houses,active:u.active,validUntil:u.validUntil});
function identity(input){const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase();if(name.length<3||name.length>120||email.length>200||!/^\S+@\S+\.\S+$/.test(email))fail(400,'Informe nome e e-mail válidos.');return {name,email};}
async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'Use uma senha entre 12 e 128 caracteres.');const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return {salt,hash:hash.toString('hex')};}
async function passwordMatches(password,record){if(typeof password!=='string'||password.length>128)return false;const hash=await scrypt(password,record.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(hash,Buffer.from(record.hash,'hex'));}
export async function createAuthApi({directory,now=()=>Date.now(),sessionMs=8*3600000,idleMs=30*60000}={}){
 await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'store.json');let db;
 try{db=JSON.parse(await fs.readFile(file,'utf8'));if(db.schema!==1||!Array.isArray(db.users)||!db.state)throw Error('Formato inválido');}catch(e){if(e.code!=='ENOENT')throw new Error('Não foi possível ler a base local. Nenhum dado foi sobrescrito.');db={schema:1,users:[],invites:[],events:[],state:seed()};}
 db.state.residents??=[];
 const sessions=new Map(),attempts=new Map();let queue=Promise.resolve();const dummy=await passwordHash(randomBytes(32).toString('hex'));
 async function persist(next){const temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,file);db=next;}
 function event(next,user,action){next.events.push({at:new Date(now()).toISOString(),actor:user.id,tenant:user.tenant,action});}
 const valid=u=>u&&u.active&&(!u.validUntil||Date.parse(u.validUntil)>now());
 function getSession(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('vilazuni_session='))?.slice(17);const key=token?digest(token):'',s=sessions.get(key),u=s&&db.users.find(u=>u.id===s.userId);if(!s||s.until<=now()||s.last+idleMs<=now()||!valid(u)){sessions.delete(key);return null;}s.last=now();return {key,user:u};}
 function issue(res,u){const token=randomBytes(32).toString('base64url');sessions.set(digest(token),{userId:u.id,until:now()+sessionMs,last:now()});res.setHeader('Set-Cookie',`vilazuni_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionMs/1000)}`);}
 function revoke(id){for(const [key,s] of sessions)if(s.userId===id)sessions.delete(key);}
 function limit(req){const key=req.socket.remoteAddress||'local',t=now();for(const [k,v] of attempts)if(v.until<=t)attempts.delete(k);const a=attempts.get(key)||{count:0,until:t+15*60000};if(++a.count>25)fail(429,'Muitas tentativas. Aguarde 15 minutos.');attempts.set(key,a);}
 function projection(u){let houses=scopedHouses(db.state,u).map(h=>{const owners=db.state.residents.filter(r=>r.tenant===u.tenant&&r.houseId===h.id&&r.kind==='owner');return owners.length?{...h,owners:owners.filter(r=>!r.endedOn&&r.startDate<=localDay(now())).map(r=>r.name)}:h;}),stays=scopedStays(db.state,u);if(u.role==='zelador'){houses=[];stays=[];}if(u.role==='portaria'){houses=houses.map(h=>({id:h.id,tenant:h.tenant,number:h.number,parking:h.parking,parkingType:h.parkingType}));stays=stays.filter(s=>s.status==='approved').map(s=>({id:s.id,tenant:s.tenant,houseId:s.houseId,responsible:s.responsible,people:s.people,vehicles:s.vehicles,start:s.start,end:s.end,status:s.status}));}return {version:1,houses,stays,residents:visibleResidents(db.state,u),tasks:visibleTasks(db.state,u),incidents:visibleIncidents(db.state,u),audit:[]};}
 async function body(req,maxBytes=32768){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Envie dados no formato JSON.');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>maxBytes)fail(413,'Solicitação muito grande.');}try{const obj=JSON.parse(raw||'{}');if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error();return obj;}catch{fail(400,'Dados inválidos.');}}
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
 async function handle(req,res){try{
  const url=new URL(req.url,'http://localhost'),route=url.pathname,method=req.method;
  const expectedHost='127.0.0.1:'+req.socket.localPort;
  if(req.headers.host!==expectedHost)fail(403,'Endereço local não autorizado.');
  if(method!=='GET'&&req.headers.origin!=='http://'+expectedHost)fail(403,'Origem não autorizada.');
  const session=getSession(req);
  if(method==='GET'&&route==='/api/session')return send(res,200,{setupRequired:db.users.length===0,user:session?publicUser(session.user):null});
  if(method==='POST'&&['/api/setup','/api/login','/api/activate'].includes(route)){
   limit(req);const input=await body(req);let user;
   if(route==='/api/setup'){
    if(db.users.length)fail(409,'A conta inicial já foi configurada.');const who=identity(input),credential=await passwordHash(input.password);const next=structuredClone(db);user={id:randomUUID(),...who,...credential,tenant:'chandra',role:'sindico',houses:[],active:true,validUntil:null};next.users.push(user);event(next,user,'Conta inicial local configurada');await persist(next);
   }else if(route==='/api/login'){
    const email=String(input.email||'').trim().toLowerCase();user=db.users.find(u=>u.email===email);const matches=await passwordMatches(input.password,user||dummy);if(!matches||!valid(user))fail(401,'E-mail, senha ou vínculo inválido.');
   }else{
    const token=String(input.code||'');const invite=db.invites.find(i=>i.hash===digest(token)&&!i.used&&i.expires>now());if(!invite)fail(400,'Convite inválido ou expirado.');const who=identity(input);if(who.email!==invite.email)fail(400,'Use o e-mail indicado no convite.');if(db.users.some(u=>u.email===who.email))fail(409,'Essa conta já existe.');const credential=await passwordHash(input.password),next=structuredClone(db);user={id:randomUUID(),...who,...credential,tenant:invite.tenant,role:invite.role,houses:invite.houses,active:true,validUntil:invite.validUntil};if(!valid(user))fail(400,'O vínculo do convite expirou.');next.users.push(user);next.invites.find(i=>i.id===invite.id).used=true;event(next,user,'Convite ativado');await persist(next);
   }
   if(session)sessions.delete(session.key);issue(res,user);return send(res,200,{user:publicUser(user)});
  }
  if(!session)fail(401,'Entre para continuar.');const u=session.user;
  if(method==='GET'&&route==='/api/tasks/photo'){let photo;try{photo=readTaskPhoto(db.state,u,url.searchParams.get('task'),url.searchParams.get('photo'));}catch(e){fail(403,e.message);}res.writeHead(200,{'Content-Type':photo.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});return res.end(photo.bytes);}
  if(method==='POST'&&route==='/api/logout'){sessions.delete(session.key);res.setHeader('Set-Cookie','vilazuni_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
  if(method==='GET'&&route==='/api/state')return send(res,200,{state:projection(u),user:publicUser(u)});
  if(method==='POST'&&route==='/api/password'){limit(req);const input=await body(req);if(!await passwordMatches(input.currentPassword,u))fail(400,'Senha atual inválida.');const credential=await passwordHash(input.password),next=structuredClone(db);Object.assign(next.users.find(x=>x.id===u.id),credential);event(next,u,'Senha alterada; sessões encerradas');await persist(next);revoke(u.id);issue(res,u);return send(res,200,{ok:true});}
  if(route.startsWith('/api/admin/')){
   if(u.role!=='sindico')fail(403,'Acesso restrito à gestão.');
   if(method==='GET'&&route==='/api/admin/users')return send(res,200,{users:db.users.filter(x=>x.tenant===u.tenant).map(publicUser),invites:db.invites.filter(i=>i.tenant===u.tenant&&!i.used&&i.expires>now()).map(({hash,...i})=>i)});
   const input=await body(req),next=structuredClone(db);
   if(method==='POST'&&route==='/api/admin/invites'){
    const email=identity({name:'Convidado',email:input.email}).email;if(!permittedRoles.includes(input.role))fail(400,'Perfil não disponível para convite.');if(next.users.some(x=>x.email===email))fail(409,'Essa conta já existe.');const ids=[...new Set(Array.isArray(input.houses)?input.houses:[])];if(ids.some(id=>!next.state.houses.some(h=>h.id===id&&h.tenant===u.tenant)))fail(400,'Casa fora do condomínio.');if(['proprietario','imobiliaria'].includes(input.role)&&!ids.length)fail(400,'Selecione ao menos uma casa.');let validUntil=input.validUntil||null;if(validUntil&&(!Number.isFinite(Date.parse(validUntil))||Date.parse(validUntil)<=now()))fail(400,'Informe validade futura.');if(input.role==='imobiliaria'&&!validUntil)fail(400,'Defina a validade da delegação da imobiliária.');const code=randomBytes(24).toString('base64url');next.invites.filter(i=>i.email===email&&i.tenant===u.tenant).forEach(i=>i.used=true);next.invites.push({id:randomUUID(),hash:digest(code),email,role:input.role,tenant:u.tenant,houses:['proprietario','imobiliaria'].includes(input.role)?ids:[],validUntil,expires:now()+48*3600000,used:false});event(next,u,'Convite criado: '+email);await persist(next);return send(res,201,{code,expiresInHours:48});
   }
   if(method==='POST'&&route==='/api/admin/suspend'){
    const target=next.users.find(x=>x.id===input.id&&x.tenant===u.tenant);if(!target||target.role==='sindico')fail(400,'Conta indisponível para esta ação.');target.active=false;event(next,u,'Conta suspensa: '+target.id);await persist(next);revoke(target.id);return send(res,200,{ok:true});
   }
   if(method==='POST'&&route==='/api/admin/revoke-invite'){const invite=next.invites.find(i=>i.id===input.id&&i.tenant===u.tenant);if(!invite)fail(404,'Convite indisponível.');invite.used=true;event(next,u,'Convite revogado');await persist(next);return send(res,200,{ok:true});}
   fail(404,'Ação não encontrada.');
  }
  if(method==='POST'){
   const input=await body(req,route==='/api/tasks/photo'?3*1024*1024:32768),next=structuredClone(db);let result;
   try{if(['/api/residents','/api/residents/update','/api/residents/end'].includes(route)){const handler=route.endsWith('/update')?updateResident:route.endsWith('/end')?endResident:createResident;const r=handler(next.state,u,input,now());result={id:r.record.id};}else if(route==='/api/incidents/create'){result={incident:createIncident(next.state,u,input,now())};}else if(route==='/api/incidents/update'){result={incident:updateIncident(next.state,next.users,u,input,now())};}else if(route==='/api/stays')result=createStay(next.state,u,input,now());else if(route==='/api/stays/decision'){changeStay(next.state,u,input.id,input.status,input.reason,now());result={ok:true};}else if(route==='/api/tasks/create'){result={task:createTask(next.state,next.users,u,input,now())};}else if(route==='/api/tasks/assign'){result={task:assignTask(next.state,next.users,u,input,now())};}else if(route==='/api/tasks'){result={task:advanceTask(next.state,u,input,now())};}else if(route==='/api/tasks/photo'){result={task:addTaskPhoto(next.state,u,input,now())};}else fail(404,'Ação não encontrada.');}catch(e){if(e.status)throw e;fail(403,e.message);}
   await persist(next);return send(res,200,result);
  }
  fail(404,'Ação não encontrada.');
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir. Tente novamente.'});}}
 return (req,res)=>{const run=queue.then(()=>handle(req,res));queue=run.catch(()=>{});return run;};
}
