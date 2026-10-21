import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const quote=value=>"'"+value.replace(/'/g,"''")+"'";
const identifier=value=>'"'+value.replace(/"/g,'""')+'"';
const inside=(root,destination)=>destination===root||destination.startsWith(root+path.sep);

export async function prepare({origin,databaseHost,databaseName='vilazuni',databaseRole='vilazuni_app',output}){
 let publicUrl;try{publicUrl=new URL(origin);}catch{throw Error('Informe a origem HTTPS exibida em Domains, sem caminho ou barra final.');}
 if(publicUrl.protocol!=='https:'||publicUrl.origin!==origin||publicUrl.username||publicUrl.password)throw Error('Use somente a origem HTTPS pública, sem caminho, credenciais ou barra final.');
 if(typeof databaseHost!=='string'||databaseHost.length>253||!/^[-a-zA-Z0-9_.]+$/.test(databaseHost)||databaseHost.startsWith('-'))throw Error('Informe o host interno do serviço PostgreSQL, sem porta.');
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(databaseRole))throw Error('Nome do papel de execução inválido.');
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName))throw Error('Nome do banco: letras minúsculas, números e sublinhado, começando com letra.');
 if(typeof output!=='string'||!output.trim())throw Error('Informe um diretório privado novo fora do repositório.');
 const destination=path.resolve(output),root=await fs.realpath(repository);
 if(inside(root,destination))throw Error('Grave as configurações fora do checkout para preservar as chaves.');
 if(inside(root,await fs.realpath(path.dirname(destination))))throw Error('O diretório pai aponta para dentro do repositório.');
 await fs.mkdir(destination,{mode:0o700});
 if(inside(root,await fs.realpath(destination))){await fs.rmdir(destination);throw Error('O destino aponta para dentro do repositório.');}
 const password=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex'),bootstrap=randomBytes(24).toString('hex'),backup=randomBytes(48).toString('hex');
 const databaseUrl=new URL('postgresql://'+databaseHost+':5432');databaseUrl.username=databaseRole;databaseUrl.password=password;databaseUrl.pathname='/'+databaseName;databaseUrl.searchParams.set('sslmode','disable');
 const migration=(await fs.readFile(new URL('../../app/migrations/001_storage.sql',import.meta.url),'utf8')).replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'');
 const sql=`\\set ON_ERROR_STOP on\nBEGIN;\nDO $vilazuni$ BEGIN\n IF current_database() <> ${quote(databaseName)} THEN RAISE EXCEPTION 'Banco incorreto; nenhuma alteração foi aplicada.'; END IF;\n IF to_regclass('public.vilazuni_control') IS NOT NULL OR to_regclass('public.vilazuni_tenants') IS NOT NULL OR to_regclass('public.vilazuni_schema_versions') IS NOT NULL THEN RAISE EXCEPTION 'A base Vilazuni já existe; não reprovisionar nem substituir credenciais.'; END IF;\n IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${quote(databaseRole)}) THEN RAISE EXCEPTION 'Papel de execução já existe; use um banco/serviço dedicado.'; END IF;\nEND $vilazuni$;\n${migration}\nCREATE ROLE ${identifier(databaseRole)} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${quote(password)};\nGRANT CONNECT ON DATABASE ${identifier(databaseName)} TO ${identifier(databaseRole)};\nGRANT USAGE ON SCHEMA public TO ${identifier(databaseRole)};\nGRANT SELECT,INSERT,UPDATE ON vilazuni_control,vilazuni_tenants TO ${identifier(databaseRole)};\nCOMMIT;\n`;
 const env=[
  'NODE_ENV=production','HOST=0.0.0.0','PORT=4173','VILAZUNI_DATA_DIR=/var/lib/vilazuni',
  'APP_ORIGIN='+origin,'DATABASE_URL='+databaseUrl.href,'MFA_SECRET_KEY='+key,'BOOTSTRAP_TOKEN='+bootstrap,
  'TRUST_PROXY=true','CLIENT_IP_HEADER=x-forwarded-for','AI_ENABLED=false','TELEGRAM_ENABLED=false',
  'VILAZUNI_BACKUP_KEY_FILE=/var/lib/vilazuni/backup.key',''
 ].join('\n');
 await fs.writeFile(path.join(destination,'application.env'),env,{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(destination,'database.sql'),sql,{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(destination,'backup.key'),backup+'\n',{mode:0o600,flag:'wx'});
 return {directory:destination,files:['application.env','database.sql','backup.key']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const values={};const names={'--origin':'origin','--database-host':'databaseHost','--database-name':'databaseName','--database-role':'databaseRole','--output':'output'};
  for(let index=2;index<process.argv.length;index+=2){const name=names[process.argv[index]],value=process.argv[index+1];if(!name||!value||Object.hasOwn(values,name))throw Error('Uso: node deploy/easypanel/prepare.mjs --origin https://DOMINIO --database-host HOST_INTERNO [--database-name vilazuni] --output DIRETORIO_NOVO_FORA_DO_CHECKOUT');values[name]=value;}
  const result=await prepare(values);console.log('Configuração inicial criada em diretório privado: '+result.directory+'\nArquivos: '+result.files.join(', ')+'\nAs chaves não são exibidas. Copie application.env somente para Environment do serviço app. Use database.sql somente no psql do banco dedicado. Guarde backup.key e MFA_SECRET_KEY em cópia protegida separada. Não regenere configurações para atualizar o aplicativo.');
 }catch(error){console.error(error.code==='EEXIST'?'Destino já existe; nenhuma configuração foi substituída.':error.code?'Falha ao gravar os arquivos privados. Confira caminho, permissões e espaço disponível.':error.message);process.exitCode=1;}
}
