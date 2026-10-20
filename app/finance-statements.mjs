import {createHash} from 'node:crypto';
import {date} from './finance-ledger.mjs';
export const MAX_STATEMENT_BYTES=200*1024;
export function parseStatementCSV(content){
 if(typeof content!=='string'||Buffer.byteLength(content,'utf8')>MAX_STATEMENT_BYTES)throw Error('Envie CSV UTF-8 de até 200 KB.');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/.test(content))throw Error('CSV contém caracteres inválidos. Use UTF-8.');
 const source=content.replace(/^\ufeff/,''),records=[];let record=[],value='',quoted=false,afterQuote=false;
 function cell(){record.push(value);value='';afterQuote=false;}
 function row(){cell();if(record.some(v=>v.trim()))records.push(record);record=[];if(records.length>501)throw Error('Limite de 500 movimentos por extrato.');}
 for(let i=0;i<source.length;i++){
  const ch=source[i];if(quoted){if(ch==='"'){if(source[i+1]==='"'){value+='"';i++;}else{quoted=false;afterQuote=true;}}else value+=ch;continue;}
  if(ch===';'){cell();continue;}if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row();continue;}
  if(afterQuote)throw Error('CSV inválido após fechamento de aspas.');
  if(ch==='"'){if(value)throw Error('Aspas devem envolver o campo inteiro.');quoted=true;}else value+=ch;
 }
 if(quoted)throw Error('CSV com aspas não encerradas.');if(value||record.length||afterQuote)row();
 const header=records.shift()?.map(v=>v.trim().normalize('NFKC').toLowerCase());
 if(!header||header.length!==4||new Set(header).size!==4||!['id','data','descricao','valor'].every(k=>header.includes(k)))throw Error('Use cabeçalho id;data;descricao;valor, separado por ponto e vírgula.');
 const seen=new Set(),result=records.map((cells,i)=>{
  if(cells.length!==4)throw Error('Linha '+(i+2)+': informe quatro campos.');const fields=Object.fromEntries(header.map((h,j)=>[h,cells[j].trim()]));
  const externalId=fields.id.normalize('NFKC'),description=fields.descricao;
  if(!externalId||externalId.length>120||/[\r\n\t]/.test(externalId))throw Error('Linha '+(i+2)+': identificador de 1 a 120 caracteres, sem quebras de linha.');if(seen.has(externalId))throw Error('Identificador bancário repetido no arquivo.');seen.add(externalId);
  if(!description||description.length>300)throw Error('Linha '+(i+2)+': descrição de 1 a 300 caracteres.');
  if(!/^[+-]?\d{1,7},\d{2}$/.test(fields.valor))throw Error('Linha '+(i+2)+': valor deve usar vírgula e duas casas, sem separador de milhar.');
  const negative=fields.valor.startsWith('-'),[whole,fraction]=fields.valor.replace(/^[+-]/,'').split(','),amountCents=(Number(whole)*100+Number(fraction))*(negative?-1:1);
  if(!Number.isSafeInteger(amountCents)||amountCents===0||Math.abs(amountCents)>100000000)throw Error('Movimento deve ter valor diferente de zero e até R$ 1.000.000,00.');
  return {externalId,date:date(fields.data),description,amountCents};
 });
 return {rows:result,sha256:createHash('sha256').update(content,'utf8').digest('hex')};
}
