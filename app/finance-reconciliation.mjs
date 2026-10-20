import {randomUUID} from 'node:crypto';
import {requireFinance,text,rows,revision,bump,openDate,activeAccount,balance} from './finance-ledger.mjs';
import {parseStatementCSV} from './finance-statements.mjs';
const audit=(u,action,reason,now,extra={})=>({at:new Date(now).toISOString(),actor:u.name,actorId:u.id,action,reason,...extra});
const active=(s,tenant)=>rows(s,'financialStatements',tenant).filter(r=>r.status!=='cancelled');
const net=(e,accountId)=>e.postings.filter(p=>p.accountId===accountId).reduce((n,p)=>n+p.amountCents,0);
function shifted(day,offset){const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
function journal(s,tenant,accountId){return rows(s,'financialEntries',tenant).map(e=>({...e,accountAmountCents:net(e,accountId)})).filter(e=>e.accountAmountCents!==0);}
function links(s,tenant,accountId){return active(s,tenant).filter(t=>t.accountId===accountId).flatMap(t=>t.rows.filter(r=>r.status==='matched').map(r=>({...r,statementId:t.id})));}
function opening(s,tenant,a,from){return balance(s,tenant,a.id,null,shifted(from,-1))+(a.openingOn===from?a.openingCents:0);}
function signedBalance(v){if(!Number.isSafeInteger(v)||Math.abs(v)>1000000000000)throw Error('Informe saldo em centavos inteiros dentro do limite do piloto.');return v;}
function normalized(v){return v.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');}
function suggestions(s,tenant,accountId,row){
 const used=new Set(links(s,tenant,accountId).map(r=>r.entryId));return journal(s,tenant,accountId).filter(e=>e.accountAmountCents===row.amountCents&&!used.has(e.id)).map(e=>({entryId:e.id,entryVersion:e.version,date:e.date,description:e.description,reference:e.reference,amountCents:e.accountAmountCents,dayDifference:Math.abs(Date.parse(e.date+'T12:00Z')-Date.parse(row.date+'T12:00Z'))/86400000,referenceMatches:normalized(e.reference)===normalized(row.externalId)})).sort((a,b)=>Number(b.referenceMatches)-Number(a.referenceMatches)||a.dayDifference-b.dayDifference||a.entryId.localeCompare(b.entryId)).slice(0,20);
}
function validated(s,u,input,now){
 requireFinance(u,'financeClose');const account=activeAccount(s,u,input.accountId);if(account.kind!=='bank')throw Error('Selecione uma conta bancária para o extrato.');
 const from=openDate(s,u,input.from,now),through=openDate(s,u,input.through,now);if(from>through||from.slice(0,7)!==through.slice(0,7))throw Error('Use um intervalo de um único mês, com início até o fim.');if(from<account.openingOn)throw Error('Extrato anterior ao saldo inicial da conta.');
 const openingCents=signedBalance(input.openingCents),closingCents=signedBalance(input.closingCents),fileName=text(input.fileName,'Nome do arquivo',120),parsed=parseStatementCSV(input.content);
 if(parsed.rows.some(r=>r.date<from||r.date>through))throw Error('Há movimento fora do intervalo informado.');
 if(openingCents+parsed.rows.reduce((n,r)=>n+r.amountCents,0)!==closingCents)throw Error('Saldo inicial mais movimentos não corresponde ao saldo final informado.');
 const current=active(s,u.tenant).filter(t=>t.accountId===account.id);
 if(current.some(t=>t.sha256===parsed.sha256&&t.from===from&&t.through===through))throw Error('Extrato já importado para esta conta.');
 if(current.some(t=>t.from<=through&&t.through>=from))throw Error('Período sobreposto a extrato ativo. Cancele o anterior antes de substituí-lo.');
 const ids=new Set(current.flatMap(t=>t.rows.map(r=>r.externalId)));if(parsed.rows.some(r=>ids.has(r.externalId)))throw Error('Identificador bancário já importado nesta conta.');
 return {account,values:{accountId:account.id,accountName:account.name,fileName,from,through,openingCents,closingCents,...parsed}};
}
export function previewStatement(s,u,input,now=Date.now()){
 const {account,values}=validated(s,u,input,now);return {...values,revision:revision(s,u.tenant),accountVersion:account.version,rows:values.rows.map(r=>({...r,suggestions:suggestions(s,u.tenant,account.id,r)})),registeredOpeningCents:opening(s,u.tenant,account,values.from),registeredClosingCents:balance(s,u.tenant,account.id,null,values.through)};
}
export function importStatement(s,u,input,now=Date.now()){
 const {account,values}=validated(s,u,input,now),reason=text(input.reason,'Conferência da importação',500);
 if(input.revision!==revision(s,u.tenant)||input.accountVersion!==account.version)throw Error('O financeiro mudou. Confira uma nova prévia antes de importar.');
 if(typeof input.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId))throw Error('Identificador da operação inválido.');
 if(rows(s,'financialStatements',u.tenant).some(t=>t.operationId===input.operationId))throw Error('Importação já registrada.');
 const statement={id:randomUUID(),tenant:u.tenant,version:1,status:'active',operationId:input.operationId,...values,rows:values.rows.map(r=>({...r,id:randomUUID(),status:'pending',entryId:null,history:[]})),history:[audit(u,'Extrato importado; vínculos ainda não conferidos',reason,now)]};
 s.financialStatements??=[];s.financialStatements.push(statement);bump(s,u.tenant);return structuredClone(statement);
}
function editable(s,u,input,now){
 requireFinance(u,'financeClose');const t=rows(s,'financialStatements',u.tenant).find(t=>t.id===input.id);if(!t||t.status==='cancelled')throw Error('Extrato indisponível.');
 if(!Number.isInteger(input.version)||input.version!==t.version)throw Error('O extrato mudou. Atualize antes de continuar.');openDate(s,u,t.from,now);return t;
}
export function changeStatementRow(s,u,input,now=Date.now()){
 const t=editable(s,u,input,now),r=t.rows.find(r=>r.id===input.rowId);if(!r)throw Error('Movimento indisponível.');const reason=text(input.reason,'Justificativa da conferência',500),before={status:r.status,entryId:r.entryId};let entryId=null;
 if(input.action==='match'){
  if(r.status!=='pending')throw Error('Desfaça a conferência anterior antes de vincular.');const e=journal(s,u.tenant,t.accountId).find(e=>e.id===input.entryId);if(!e||e.accountAmountCents!==r.amountCents)throw Error('Lançamento deve pertencer à conta e ter o mesmo valor com sinal.');
  if(!Number.isInteger(input.entryVersion)||input.entryVersion!==e.version)throw Error('O lançamento mudou. Atualize a conferência.');openDate(s,u,e.date,now);
  if(links(s,u.tenant,t.accountId).some(x=>x.entryId===e.id))throw Error('Lançamento já vinculado a outro movimento desta conta.');entryId=e.id;
 }else if(input.action==='ignore'){if(r.status!=='pending')throw Error('Desfaça o vínculo antes de ignorar o movimento.');}
 else if(input.action==='reset'){if(r.status==='pending')throw Error('Movimento já está pendente.');if(r.entryId){const e=rows(s,'financialEntries',u.tenant).find(e=>e.id===r.entryId);openDate(s,u,e.date,now);}}
 else throw Error('Ação de conciliação inválida.');
 r.status=input.action==='match'?'matched':input.action==='ignore'?'ignored':'pending';r.entryId=entryId;r.history.push(audit(u,r.status==='matched'?'Vínculo conferido':r.status==='ignored'?'Movimento ignorado com ressalva':'Conferência desfeita',reason,now,{before,entryId}));t.version++;t.history.push(audit(u,'Conferência do movimento '+r.externalId,reason,now,{rowId:r.id,actionType:input.action}));bump(s,u.tenant);return structuredClone(t);
}
export function cancelStatement(s,u,input,now=Date.now()){
 const t=editable(s,u,input,now),reason=text(input.reason,'Motivo do cancelamento',500);if(t.rows.some(r=>r.status==='matched'))throw Error('Desfaça todos os vínculos antes de cancelar o extrato.');t.status='cancelled';t.version++;t.history.push(audit(u,'Extrato cancelado; dados e histórico preservados',reason,now));bump(s,u.tenant);return structuredClone(t);
}
export function statementView(s,tenant,t,withSuggestions=false){
 const a=rows(s,'financialAccounts',tenant).find(a=>a.id===t.accountId),book=journal(s,tenant,t.accountId),allLinks=links(s,tenant,t.accountId),period=book.filter(e=>e.date>=t.from&&e.date<=t.through);
 const unmatchedEntries=period.filter(e=>!allLinks.some(r=>r.entryId===e.id&&r.date>=t.from&&r.date<=t.through)).map(e=>({id:e.id,date:e.date,description:e.description,reference:e.reference,amountCents:e.accountAmountCents}));
 const registeredOpeningCents=opening(s,tenant,a,t.from),registeredClosingCents=balance(s,tenant,a.id,null,t.through),openingDifferenceCents=t.openingCents-registeredOpeningCents,closingDifferenceCents=t.closingCents-registeredClosingCents;
 const pendingCount=t.rows.filter(r=>r.status==='pending').length,ignoredCount=t.rows.filter(r=>r.status==='ignored').length,outsidePeriodCount=t.rows.filter(r=>r.entryId&&book.some(e=>e.id===r.entryId&&(e.date<t.from||e.date>t.through))).length;
 return {...structuredClone(t),rows:t.rows.map(r=>({...structuredClone(r),entry:r.entryId?book.filter(e=>e.id===r.entryId).map(e=>({id:e.id,date:e.date,reference:e.reference,description:e.description,amountCents:e.accountAmountCents}))[0]:null,...(withSuggestions&&r.status==='pending'&&t.status==='active'?{suggestions:suggestions(s,tenant,t.accountId,r)}:{})})),registeredOpeningCents,registeredClosingCents,openingDifferenceCents,closingDifferenceCents,pendingCount,ignoredCount,outsidePeriodCount,unmatchedEntries,complete:t.status==='active'&&!pendingCount&&!ignoredCount&&!outsidePeriodCount&&!unmatchedEntries.length&&!openingDifferenceCents&&!closingDifferenceCents};
}
export function reconciliationMonth(s,tenant,month,from,through){
 return {accounts:rows(s,'financialAccounts',tenant).filter(a=>a.kind==='bank'&&a.openingOn<=through).map(a=>{
  const statements=active(s,tenant).filter(t=>t.accountId===a.id&&t.from.slice(0,7)===month).sort((a,b)=>a.from.localeCompare(b.from)).map(t=>statementView(s,tenant,t));
  let cursor=a.openingOn>from?a.openingOn:from,coverageComplete=statements.length>0;for(const t of statements){if(t.from!==cursor)coverageComplete=false;cursor=shifted(t.through,1);}coverageComplete=coverageComplete&&cursor===shifted(through,1);
  return {accountId:a.id,account:a.name,coverageComplete,complete:coverageComplete&&statements.every(t=>t.complete),statements};
 })};
}
