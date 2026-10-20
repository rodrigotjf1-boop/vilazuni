import {randomBytes,createCipheriv,createDecipheriv,scryptSync,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {validateDatabase} from './storage.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createBackup(database,password){
 validateDatabase(database);if(typeof password!=='string'||password.length<16)throw Error('Use uma chave de backup com pelo menos dezesseis caracteres.');
 const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(password,salt,32),plain=Buffer.from(JSON.stringify(database));if(plain.length>192*1024*1024)throw Error('Backup lógico excede 192 MiB. Use backup físico coordenado de PostgreSQL e volume privado.');const compressed=gzipSync(plain),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(compressed),cipher.final()]);
 return Buffer.from(JSON.stringify({format:'vilazuni-encrypted-backup-v1',createdAt:new Date().toISOString(),algorithm:'aes-256-gcm+scrypt+gzip',sha256:hash(plain),salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}));
}
export function restoreBackup(bytes,password){
 try{if(bytes.length>256*1024*1024)throw Error();const record=JSON.parse(Buffer.from(bytes).toString('utf8'));if(record.format!=='vilazuni-encrypted-backup-v1'||record.algorithm!=='aes-256-gcm+scrypt+gzip')throw Error();
  const key=scryptSync(password,Buffer.from(record.salt,'base64'),32),cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64'));cipher.setAuthTag(Buffer.from(record.tag,'base64'));const compressed=Buffer.concat([cipher.update(Buffer.from(record.data,'base64')),cipher.final()]),plain=gunzipSync(compressed,{maxOutputLength:256*1024*1024});
  if(hash(plain)!==record.sha256)throw Error();return validateDatabase(JSON.parse(plain.toString('utf8')));
 }catch{throw Error('Backup, integridade ou chave inválidos. Nenhum dado foi restaurado.');}
}
