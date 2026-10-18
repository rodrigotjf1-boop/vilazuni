import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAuthApi} from '../auth-api.mjs';
import {seed} from '../domain.mjs';

test('autenticação local, escopo no servidor, convites, revogação e expiração',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vilazuni-auth-test-'));
 const initial=seed();initial.houses.push({...initial.houses[0],id:'foreign-house',tenant:'outro'});initial.stays.push({...initial.stays[0],id:'foreign-stay',tenant:'outro',houseId:'foreign-house'});
 await fs.writeFile(path.join(directory,'store.json'),JSON.stringify({schema:1,users:[],invites:[],events:[],state:initial}));
 let now=Date.parse('2026-10-18T15:00:00-03:00');const api=await createAuthApi({directory,now:()=>now,idleMs:30*60000});
 const server=http.createServer(api);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const password='Senha-sintetica-testes-2026';
 async function request(route,data,cookie='',overrides={}){const r=await fetch(origin+'/api'+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...overrides},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],header:r.headers.get('set-cookie')};}
 async function invite(role,houses=[],validUntil=null){const r=await request('/admin/invites',{email:role+'@example.test',role,houses,validUntil},admin);assert.equal(r.status,201);const activated=await request('/activate',{code:r.body.code,name:'Pessoa de teste',email:role+'@example.test',password});assert.equal(activated.status,200);return {...activated,code:r.body.code};}
 let admin;
 try{
  assert.equal((await request('/state')).status,401);
  assert.equal((await request('/setup',{name:'Admin teste',email:'admin@example.test',password},'',{Origin:'https://other.test'})).status,403);
  const setup=await request('/setup',{name:'Admin teste',email:'admin@example.test',password,role:'proprietario',tenant:'outro'});assert.equal(setup.status,200);admin=setup.cookie;assert.match(setup.header,/HttpOnly/);assert.match(setup.header,/SameSite=Strict/);assert.equal(setup.body.user.role,'sindico');assert.equal(setup.body.user.tenant,'chandra');
  assert.equal((await request('/setup',{name:'Outro admin',email:'other@example.test',password})).status,409);
  assert.equal((await request('/login',{email:'admin@example.test',password:'senha incorreta'})).status,401);
  const adminState=await request('/state',undefined,admin);assert.equal(adminState.body.state.houses.length,14);assert.ok(!JSON.stringify(adminState.body).includes('foreign'));
  assert.equal((await request('/admin/invites',{email:'new@example.test',role:'sindico'},admin)).status,400);
  assert.equal((await request('/admin/invites',{email:'new@example.test',role:'proprietario',houses:['foreign-house']},admin)).status,400);
  const owner=await invite('proprietario',['c14']);const ownState=await request('/state',undefined,owner.cookie);assert.deepEqual(ownState.body.state.houses.map(h=>h.id),['c14']);assert.equal(ownState.body.state.stays.length,0);assert.equal(ownState.body.state.tasks.length,0);
  assert.equal((await request('/admin/users',undefined,owner.cookie)).status,403);
  const resident={houseId:'c14',kind:'annual',name:'Morador sintético',contact:'Contato de teste',people:['Morador sintético'],startDate:'2026-10-01',plannedEndDate:'2027-10-01'};
  assert.equal((await request('/residents',{...resident,houseId:'c01'},owner.cookie)).status,403);
  assert.equal((await request('/residents',{...resident,kind:'owner'},owner.cookie)).status,403);
  const createdResident=await request('/residents',resident,owner.cookie);assert.equal(createdResident.status,200);
  assert.equal((await request('/state',undefined,owner.cookie)).body.state.residents.length,1);
  assert.equal((await request('/residents/end',{id:createdResident.body.id,endedOn:'2026-10-18',reason:'Saída de teste'},owner.cookie)).status,200);
  assert.equal((await request('/state',undefined,owner.cookie)).body.state.residents.length,0);
  assert.equal((await request('/state',undefined,admin)).body.state.residents.length,1);
  const stay={houseId:'c01',responsible:'Pessoa Teste',contact:'Teste',people:['Pessoa Teste'],vehicles:[],source:'Direta',start:'2026-10-25T15:00',end:'2026-10-27T11:00',role:'sindico',tenant:'chandra'};
  assert.equal((await request('/stays',stay,owner.cookie)).status,403);
  assert.equal((await request('/stays',{...stay,houseId:'c14'},owner.cookie)).status,200);
  assert.equal((await request('/stays/decision',{id:'e02',status:'approved',reason:'Teste'},owner.cookie)).status,403);
  assert.equal((await request('/activate',{code:owner.code,name:'Reuso',email:'proprietario@example.test',password})).status,400);
  const portaria=await invite('portaria');const operational=await request('/state',undefined,portaria.cookie);assert.ok(operational.body.state.stays.every(s=>s.status==='approved'&&!('contact'in s)&&!('decisionReason'in s)));assert.ok(operational.body.state.houses.every(h=>!('owners'in h)));
  const caretaker=await invite('zelador');const tasks=await request('/state',undefined,caretaker.cookie);assert.equal(tasks.body.state.houses.length,0);assert.equal(tasks.body.state.stays.length,0);assert.equal(tasks.body.state.tasks.length,0);assert.equal((await request('/tasks',{id:'t01',version:0,status:'done'},caretaker.cookie)).status,403);const createdTask=await request('/tasks/create',{title:'Limpar piscina',area:'Piscina',due:'2026-10-20',assigneeId:caretaker.body.user.id},admin);assert.equal(createdTask.status,200);const task=createdTask.body.task;assert.equal((await request('/state',undefined,caretaker.cookie)).body.state.tasks.length,1);assert.equal((await request('/tasks',{id:task.id,version:task.version,status:'doing'},caretaker.cookie)).status,200);assert.equal((await request('/tasks',{id:task.id,version:task.version,status:'doing'},caretaker.cookie)).status,403);
  const upload=await request('/tasks/photo',{id:task.id,version:task.version+1,caption:'Foto sintética de teste',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII='},caretaker.cookie);assert.equal(upload.status,200);assert.ok(!JSON.stringify(upload.body).includes('base64'));const photoUrl=origin+'/api/tasks/photo?task='+task.id+'&photo='+upload.body.task.photos[0].id;const photoResponse=await fetch(photoUrl,{headers:{Cookie:caretaker.cookie}});assert.equal(photoResponse.status,200);assert.equal(photoResponse.headers.get('content-type'),'image/png');assert.ok((await photoResponse.arrayBuffer()).byteLength>0);assert.equal((await fetch(photoUrl,{headers:{Cookie:owner.cookie}})).status,403);assert.equal((await fetch(photoUrl)).status,401);const review=await request('/tasks',{id:task.id,version:upload.body.task.version,status:'review'},caretaker.cookie);assert.equal(review.status,200);assert.equal((await request('/tasks',{id:task.id,version:review.body.task.version,status:'done',reason:'Conferido'},caretaker.cookie)).status,403);assert.equal((await request('/tasks',{id:task.id,version:review.body.task.version,status:'done',reason:'Conferido pela gestão'},admin)).status,200);
  const realtor=await invite('imobiliaria',['c03'],new Date(now+60000).toISOString());now+=61000;assert.equal((await request('/state',undefined,realtor.cookie)).status,401);
  assert.equal((await request('/admin/suspend',{id:owner.body.user.id},admin)).status,200);assert.equal((await request('/state',undefined,owner.cookie)).status,401);assert.equal((await request('/login',{email:'proprietario@example.test',password})).status,401);
  const changed=await request('/password',{currentPassword:password,password:'Nova-senha-sintetica-2026'},admin);assert.equal(changed.status,200);assert.equal((await request('/state',undefined,admin)).status,401);admin=changed.cookie;
  const content=await fs.readFile(path.join(directory,'store.json'),'utf8');assert.ok(!content.includes(password));assert.ok(!content.includes(owner.code));assert.ok(!content.includes(admin));assert.ok(!content.includes('Nova-senha-sintetica-2026'));
  now+=31*60000;assert.equal((await request('/state',undefined,admin)).status,401);
  const again=await request('/login',{email:'admin@example.test',password:'Nova-senha-sintetica-2026'});assert.equal(again.status,200);assert.equal((await request('/logout',{},again.cookie)).status,200);assert.equal((await request('/state',undefined,again.cookie)).status,401);
 }finally{await new Promise(r=>server.close(r));const resolved=path.resolve(directory);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('vilazuni-auth-test-'))await fs.rm(resolved,{recursive:true,force:true});}
});
