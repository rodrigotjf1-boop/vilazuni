import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
export async function releaseInfo(){
 const pkg=JSON.parse(await fs.readFile(new URL('package.json',root),'utf8'));
 const files=(await fs.readdir(root)).filter(name=>/\.(mjs|js|css|html|webmanifest)$/.test(name)).sort(),hash=createHash('sha256');
 for(const file of files){hash.update(file+'\0');hash.update(await fs.readFile(new URL(file,root)));}
 return {version:pkg.version,build:hash.digest('hex').slice(0,20)};
}
