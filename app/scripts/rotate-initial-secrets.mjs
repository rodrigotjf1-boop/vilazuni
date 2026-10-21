import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {runtimeConfig} from '../runtime-config.mjs';

class OperatorError extends Error {}
const codeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function privatePath(file,directory=false){
 const stat=await fs.lstat(file);
 if(stat.isSymbolicLink()||(directory?!stat.isDirectory():!stat.isFile())||(stat.mode&0o077))throw new OperatorError('Use somente diretório e arquivos privados, sem links simbólicos (700/600).');
}
async function writePrivate(file,text){const handle=await fs.open(file,'wx',0o600);try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}}
function parseEnv(text){
 const env={};for(const line of text.split(/\r?\n/)){if(!line.trim()||line.startsWith('#'))continue;const index=line.indexOf('='),key=line.slice(0,index);if(index<1||!/^[A-Z][A-Z0-9_]*$/.test(key)||Object.hasOwn(env,key))throw new OperatorError('Formato do arquivo de ambiente incompatível. Nenhuma chave foi trocada.');env[key]=line.slice(index+1);}
 return env;
}

// Executar com o servidor parado. Esta operação é exclusiva do primeiro acesso,
// antes de existir qualquer conta; a chave MFA não pode ser substituída depois.
export async function rotateInitialSecrets({directory,databaseHost,databasePort}={}){
 if(!directory)throw new OperatorError('Informe --directory com a pasta privada da primeira instalação.');
 await privatePath(directory,true);const root=await fs.realpath(directory);
 if(root===codeRoot||root.startsWith(codeRoot+path.sep))throw new OperatorError('As configurações devem ficar fora do checkout.');
 for(const file of ['application.env','database.sql','backup.key'])await privatePath(path.join(root,file));
 const envFile=path.join(root,'application.env'),sqlFile=path.join(root,'database.sql'),oldEnv=await fs.readFile(envFile,'utf8'),oldSql=await fs.readFile(sqlFile,'utf8'),env=parseEnv(oldEnv);
 runtimeConfig(env);if(env.NODE_ENV!=='production')throw new OperatorError('Procedimento exclusivo da configuração inicial de produção.');
 const originalUrl=new URL(env.DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(originalUrl.protocol)||!/^[a-f\d]{64}$/i.test(originalUrl.password)||!/^[a-z][a-z0-9_]{0,62}$/.test(originalUrl.username))throw new OperatorError('Use o ambiente gerado pelo preparo inicial.');
 const oldClause="PASSWORD '"+originalUrl.password+"'";
 if(oldSql.split(oldClause).length!==2)throw new OperatorError('O SQL inicial não corresponde ao ambiente atual. Nenhuma chave foi trocada.');
 const connectionUrl=new URL(originalUrl);if(databaseHost!==undefined){if(!['127.0.0.1','localhost'].includes(databaseHost))throw new OperatorError('A substituição do host admite somente loopback no contêiner do banco.');connectionUrl.hostname=databaseHost;}
 if(databasePort!==undefined){if(!/^\d+$/.test(String(databasePort))||Number(databasePort)<1||Number(databasePort)>65535)throw new OperatorError('Porta de manutenção inválida.');connectionUrl.port=String(databasePort);}
 const pending=path.join(root,'.rotation-pending');
 try{await fs.mkdir(pending,{mode:0o700});}catch(error){if(error.code==='EEXIST')throw new OperatorError('Existe uma troca pendente. Preserve os arquivos privados para conferir a recuperação; não gere outras chaves.');throw error;}
 const client=new pg.Client({connectionString:connectionUrl.href,connectionTimeoutMillis:5000});let commitAttempted=false;
 try{
  await client.connect();
  const role=(await client.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  if(!role||Object.values(role).some(Boolean))throw new OperatorError('Use a conexão do usuário restrito da aplicação.');
  await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='15s'");
  await client.query('LOCK TABLE vilazuni_control IN ACCESS EXCLUSIVE MODE');
  const controls=(await client.query('SELECT payload FROM vilazuni_control')).rows;
  if(controls.some(({payload})=>!Array.isArray(payload?.users)||payload.users.length))throw new OperatorError('Já existem contas ou uma base incompatível. A troca inicial foi recusada e as chaves atuais foram preservadas.');
  const password=randomBytes(32).toString('hex'),newUrl=new URL(originalUrl);newUrl.password=password;
  Object.assign(env,{DATABASE_URL:newUrl.href,MFA_SECRET_KEY:randomBytes(32).toString('hex'),BOOTSTRAP_TOKEN:randomBytes(24).toString('hex')});
  const newEnv=Object.entries(env).map(([key,value])=>key+'='+value).join('\n')+'\n',newSql=oldSql.replace(oldClause,"PASSWORD '"+password+"'");
  await writePrivate(path.join(pending,'application.previous.env'),oldEnv);await writePrivate(path.join(pending,'database.previous.sql'),oldSql);
  await writePrivate(path.join(pending,'application.env'),newEnv);await writePrivate(path.join(pending,'database.sql'),newSql);
  await client.query("ALTER ROLE CURRENT_USER PASSWORD '"+password+"'");commitAttempted=true;await client.query('COMMIT');
  const verifyUrl=new URL(connectionUrl);verifyUrl.password=password;const verify=new pg.Client({connectionString:verifyUrl.href,connectionTimeoutMillis:5000});
  try{await verify.connect();await verify.query('SELECT 1');}finally{await verify.end();}
  await fs.rename(path.join(pending,'application.env'),envFile);await fs.rename(path.join(pending,'database.sql'),sqlFile);
  const archive=path.join(root,'rotation-'+randomBytes(8).toString('hex'));await fs.rename(pending,archive);
  return {directory:root,archive};
 }catch(error){
  if(!commitAttempted){await client.query('ROLLBACK').catch(()=>{});await fs.rm(pending,{recursive:true,force:true});throw error;}
  throw new OperatorError('A troca pode ter sido confirmada no banco. Preserve .rotation-pending e application.env; mantenha a aplicação parada e confira a recuperação antes de repetir.');
 }finally{await client.end();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const names={'--directory':'directory','--database-host':'databaseHost','--database-port':'databasePort'},values={};
  for(let index=2;index<process.argv.length;index+=2){const key=names[process.argv[index]],value=process.argv[index+1];if(!key||!value||Object.hasOwn(values,key))throw new OperatorError('Uso: node scripts/rotate-initial-secrets.mjs --directory PASTA_PRIVADA [--database-host 127.0.0.1 --database-port 5432]');values[key]=value;}
  await rotateInitialSecrets(values);console.log('Senha do banco, chave MFA e código de instalação renovados. application.env e database.sql atualizados; backup.key preservado. Copie application.env para Ambiente sem compartilhar seu conteúdo e implante novamente.');
 }catch(error){console.error(error instanceof OperatorError?error.message:'Não foi possível concluir a troca. Nenhum segredo foi exibido; confira conexão, permissões e a existência de .rotation-pending.');process.exitCode=1;}
}
