import fs from 'node:fs/promises';
import path from 'node:path';

export function validateDatabase(db){if(db?.schema!==1||!Array.isArray(db.users)||!Array.isArray(db.invites)||!Array.isArray(db.events)||!db.state||!Array.isArray(db.state.houses))throw Error('Base incompatível. Nenhum dado foi sobrescrito.');return db;}
export async function fileStorage(directory,initial){
 await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'store.json');let current;
 try{current=validateDatabase(JSON.parse(await fs.readFile(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw Error('Não foi possível ler a base local. Nenhum dado foi sobrescrito.');current=initial();}
 return {kind:'file',async load(){return structuredClone(current);},async save(next){validateDatabase(next);const temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,file);current=structuredClone(next);},async close(){}};
}
export async function postgresStorage(connectionString,initial,{allowPrivileged=false}={}){
 const {Pool}=await import('pg'),pool=new Pool({connectionString,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});let revision=0;
 try{
  const {rows}=await pool.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
  if(!allowPrivileged&&(rows[0].rolsuper||rows[0].rolbypassrls))throw Error('Use um papel PostgreSQL sem SUPERUSER/BYPASSRLS na aplicação.');
  await pool.query('SELECT revision FROM vilazuni_control WHERE id=1');
 }catch(e){await pool.end();throw Error('PostgreSQL indisponível ou não migrado: '+(e.message.includes('SUPERUSER')?e.message:'confira migrações, conexão e papel da aplicação.'));}
 async function load(){
  const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const {rows}=await client.query('SELECT revision,payload FROM vilazuni_control WHERE id=1');
   if(!rows.length){await client.query('COMMIT');revision=0;return initial();}
   const control=rows[0];revision=Number(control.revision);const {tenantIds,stateMeta,...db}=control.payload;db.state=stateMeta;db.events=[];
   for(const tenant of tenantIds){await client.query("SELECT set_config('vilazuni.tenant',$1,true)",[tenant]);const data=await client.query('SELECT payload FROM vilazuni_tenants WHERE tenant=$1',[tenant]);if(!data.rows.length)throw Error('Partição do condomínio indisponível.');for(const [key,records] of Object.entries(data.rows[0].payload.state)){db.state[key]??=[];db.state[key].push(...records);}db.events.push(...data.rows[0].payload.events);}
   await client.query('COMMIT');db.events.sort((a,b)=>a.at.localeCompare(b.at));return validateDatabase(db);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async function save(next){
  validateDatabase(next);const tenants=new Map(),stateMeta={};const partition=id=>{if(!tenants.has(id))tenants.set(id,{state:{},events:[]});return tenants.get(id);};
  for(const [key,value] of Object.entries(next.state)){if(!Array.isArray(value)){if(value!==null&&typeof value==='object')throw Error('Metadado não particionado: '+key);stateMeta[key]=value;continue;}stateMeta[key]=[];for(const record of value){if(typeof record?.tenant!=='string')throw Error('Registro sem condomínio na coleção '+key);const p=partition(record.tenant);p.state[key]??=[];p.state[key].push(record);}}
  for(const u of next.users)for(const b of [u,...(u.memberships||[])])partition(b.tenant);
  for(const e of next.events)partition(e.tenant).events.push(e);
  const {state,events,...identity}=next,payload={...identity,tenantIds:[...tenants.keys()],stateMeta};
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(736190204)');const existing=await client.query('SELECT revision FROM vilazuni_control WHERE id=1 FOR UPDATE');const actual=Number(existing.rows[0]?.revision||0);if(actual!==revision)throw Object.assign(Error('A base foi atualizada por outra instância. Atualize antes de confirmar.'),{status:409});
   for(const [tenant,data] of tenants){await client.query("SELECT set_config('vilazuni.tenant',$1,true)",[tenant]);await client.query('INSERT INTO vilazuni_tenants(tenant,payload) VALUES($1,$2) ON CONFLICT(tenant) DO UPDATE SET payload=excluded.payload',[tenant,JSON.stringify(data)]);}
   await client.query('INSERT INTO vilazuni_control(id,revision,payload) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload',[actual+1,JSON.stringify(payload)]);await client.query('COMMIT');revision=actual+1;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 return {kind:'postgres',load,save,close:()=>pool.end()};
}
