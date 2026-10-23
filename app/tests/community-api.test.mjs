import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixture} from './helpers.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
test('consulta automática do alerta não prolonga sessão sem atividade',async()=>{
 const f=await fixture();try{f.advance(29*60000);assert.equal((await f.request('/community/summary',undefined,f.admin.cookie)).status,200);f.advance(60001);assert.equal((await f.request('/community/summary',undefined,f.admin.cookie)).status,401);}finally{await f.close();}
});
test('API protege fichas/fotos e persiste fotos privadas e leituras após reinício',async()=>{
 const f=await fixture();try{
  const owner=await f.invite('proprietario',{houses:['c01']}),worker=await f.invite('zelador');
  for(const route of ['/community','/community/profile?slot=sindico','/community/profile/photo?slot=sindico&version=1','/community/summary'])assert.equal((await f.request(route)).status,401);
  const values={slot:'sindico',version:0,name:'Síndico de teste',age:45,userId:f.admin.body.user.id,houseId:'c01',isOwner:true,photo:image};
  assert.equal((await f.request('/community/profile/save',values,owner.cookie)).status,403);
  assert.equal((await f.request('/community/profile/save',values,f.admin.cookie)).status,200);
  const stored=await fs.readFile(f.directory+'/store.json','utf8');assert.ok(!stored.includes(image.split(',')[1]));assert.ok(stored.includes('"blob"'));
  const privateRoot=f.directory+'/private-files',tenantDirs=await fs.readdir(privateRoot);assert.equal(tenantDirs.length,1);
  const dir=privateRoot+'/'+tenantDirs[0],files=await fs.readdir(dir);assert.equal(files.length,1);assert.equal((await fs.stat(dir+'/'+files[0])).mode&0o777,0o600);
  const picture=await fetch(f.origin+'/api/community/profile/photo?slot=sindico&version=1',{headers:{Cookie:owner.cookie}});assert.equal(picture.status,200);assert.equal(picture.headers.get('cache-control'),'no-store');assert.equal(picture.headers.get('content-type'),'image/png');
  const created=await f.request('/community/notices/save',{version:0,title:'Aviso persistente',body:'Este aviso é sintético.'},worker.cookie);assert.equal(created.status,200);
  const n=created.body.notice;assert.equal((await f.request('/community/summary',undefined,owner.cookie)).body.unreadCount,1);
  assert.equal((await f.request('/community/notices/read',{id:n.id,version:n.version},owner.cookie)).status,200);
  const exported=await f.request('/tenants/export',undefined,f.admin.cookie);assert.equal(exported.status,200);assert.equal(exported.body.state.communityReads,undefined);assert.equal(exported.body.state.communityNotices.length,1);
  await f.restart();const login=await f.request('/login',{email:owner.email,password:f.password});assert.equal((await f.request('/community/summary',undefined,login.cookie)).body.unreadCount,0);assert.equal((await f.request('/community/profile?slot=sindico',undefined,login.cookie)).body.profile.photo,true);
  const again=await fetch(f.origin+'/api/community/profile/photo?slot=sindico&version=1',{headers:{Cookie:login.cookie}});assert.equal(again.status,200);
 }finally{await f.close();}
});

test('API evita edição concorrente e não dá leitura de outro condomínio ou após suspensão',async()=>{
 const f=await fixture();try{
  const owner=await f.invite('proprietario',{houses:['c01']}),worker=await f.invite('zelador');
  const n=(await f.request('/community/notices/save',{version:0,title:'Primeira versão',body:'Conteúdo de teste.'},owner.cookie)).body.notice;
  const edits=await Promise.all(['Segunda versão A','Segunda versão B'].map(title=>f.request('/community/notices/save',{id:n.id,version:n.version,title,body:'Texto alterado.'},owner.cookie)));assert.deepEqual(edits.map(x=>x.status).sort(),[200,409]);
  assert.equal((await f.request('/community/notices/read',{id:n.id,version:n.version},worker.cookie)).status,409);
  const next=await f.request('/tenants/create',{name:'Outro condomínio sintético',municipality:'Arraial do Cabo',state:'RJ',reason:'Isolamento da comunidade'},f.admin.cookie);assert.equal(next.status,200,JSON.stringify(next.body));
  const switched=await f.request('/session/context',{tenant:next.body.tenant.id},f.admin.cookie);assert.equal(switched.status,200);const otherCookie=switched.cookie;
  assert.equal((await f.request('/community/notices/detail?id='+n.id,undefined,otherCookie)).status,404);
  const returned=await f.request('/session/context',{tenant:'chandra'},otherCookie);
  assert.equal((await f.request('/admin/suspend',{id:worker.body.user.id},returned.cookie)).status,200);
  assert.equal((await f.request('/community',undefined,worker.cookie)).status,401);
 }finally{await f.close();}
});

test('API persiste prioridade do síndico e expõe alertas individuais sem conceder prioridade ao morador',async()=>{
 const f=await fixture();try{
  const owner=await f.invite('proprietario',{houses:['c01']});
  const values={version:0,title:'Manutenção importante',body:'Água suspensa durante a manutenção.',important:true};
  assert.equal((await f.request('/community/notices/save',values,owner.cookie)).status,403);
  const created=await f.request('/community/notices/save',values,f.admin.cookie);assert.equal(created.status,200);
  const n=created.body.notice;
  assert.equal((await f.request('/community',undefined,owner.cookie)).body.notices[0].important,true);
  assert.deepEqual((await f.request('/community/summary',undefined,owner.cookie)).body,{unreadCount:1,importantCount:1,importantUnreadCount:1});
  assert.equal((await f.request('/community/notices/read',{id:n.id,version:n.version},owner.cookie)).body.importantUnreadCount,0);
  await f.restart();const login=await f.request('/login',{email:owner.email,password:f.password});
  assert.deepEqual((await f.request('/community/summary',undefined,login.cookie)).body,{unreadCount:0,importantCount:1,importantUnreadCount:0});
  assert.equal((await f.request('/community',undefined,login.cookie)).body.notices[0].important,true);
 }finally{await f.close();}
});
