import fs from 'node:fs/promises';import path from 'node:path';
import {privateFileStorage} from '../private-files.mjs';
import {fileStorage,postgresStorage} from '../storage.mjs';import {seed} from '../domain.mjs';import {createBackup,restoreBackup} from '../backup.mjs';
const [command,file]=process.argv.slice(2),directory=process.env.VILAZUNI_DATA_DIR||path.resolve('.data'),keyFile=process.env.VILAZUNI_BACKUP_KEY_FILE;
if(!['create','restore'].includes(command)||!file||!keyFile)throw Error('Uso: VILAZUNI_BACKUP_KEY_FILE=<arquivo privado> node scripts/backup.mjs create|restore <arquivo>. Restaure somente em destino vazio.');
const password=(await fs.readFile(keyFile,'utf8')).trim(),initial=()=>({schema:1,users:[],invites:[],events:[],state:seed()});
const baseStorage=process.env.DATABASE_URL?await postgresStorage(process.env.DATABASE_URL,initial):await fileStorage(directory,initial);const storage=privateFileStorage(baseStorage,path.join(directory,'private-files'));
try{
 if(command==='create'){const db=await storage.load();if(!db.users.length)throw Error('Destino sem contas; não criar backup vazio.');await fs.writeFile(file,createBackup(db,password),{mode:0o600,flag:'wx'});console.log('Backup cifrado criado. Guarde a chave separadamente e teste uma restauração em destino vazio.');}
 else{const db=await storage.load();if(db.users.length)throw Error('Restauração recusada: o destino já possui contas.');const restored=restoreBackup(await fs.readFile(file),password);await storage.save(restored);console.log('Backup validado e restaurado no destino vazio. Sessões exigem novo login.');}
}finally{await storage.close();}
