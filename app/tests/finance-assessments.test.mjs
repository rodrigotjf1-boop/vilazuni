import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createFund,createAccount,createReceivable,receiveReceivable,changeReceivable,saveAssessment,approveAssessment,cancelAssessment,generateAssessment,toggleFinancial,financeView,financialReport,financialClosureReport,closeMonth,reverseEntry} from '../finance.mjs';
import {balance,revision} from '../finance-ledger.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'a',role:'sindico'};
function base(){
 const s={houses:[1,2,3].map(n=>({id:'c0'+n,number:'0'+n,tenant:'a',owners:['Nome privado'],area:120})).concat({id:'foreign',number:'99',tenant:'b'})};
 const fund=createFund(s,root,{name:'Ordinário',purpose:'Operação corrente'},now),account=createAccount(s,root,{name:'Conta sintética',kind:'bank',fundId:fund.id,openingCents:10000,openingOn:'2026-09-01',reason:'Saldo conferido'},now);return {s,fund,account};
}
function input(b,patch={}){return {title:'Contribuição de teste',reference:'RAT-001',month:'2026-09',issuedOn:'2026-09-01',dueOn:'2026-09-20',fundId:b.fund.id,category:'Contribuições',basis:'Decisão sintética informada',reason:'Distribuição conferida',totalCents:10000,method:'equal',lines:[1,2,3].map(n=>({houseId:'c0'+n,debtor:'Pagador '+n,weight:1})),...patch};}
function approve(b,a){return approveAssessment(b.s,root,{id:a.id,version:a.version,reason:'Prévia conferida'},now);}
function generate(b,a,patch={}){return generateAssessment(b.s,root,{id:a.id,version:a.version,reason:'Geração conferida',operationId:randomUUID(),...patch},now);}
function receipt(b,r,date='2026-09-15'){return receiveReceivable(b.s,root,{id:r.id,version:r.version,accountId:b.account.id,accountVersion:b.s.financialAccounts[0].version,operationId:randomUUID(),date,reference:randomUUID(),reason:'Entrada conferida'},now);}

test('rateio igual preserva centavos e desempata por unidade, independentemente da ordem de entrada',()=>{
 const b=base(),a=saveAssessment(b.s,root,input(b),now),other=base(),reverse=saveAssessment(other.s,root,input(other,{lines:input(other).lines.reverse()}),now);
 assert.deepEqual(a.lines.map(l=>l.amountCents),[3334,3333,3333]);assert.deepEqual(a.lines,reverse.lines);assert.equal(a.lines.reduce((n,l)=>n+l.amountCents,0),a.totalCents);assert.equal(balance(b.s,'a'),10000);assert.equal(b.s.financialReceivables,undefined);
});
test('pesos inteiros usam maiores sobras com soma exata, inclusive nos limites monetários',()=>{
 for(const totalCents of [7,101,10001,100000000]){
  const b=base(),lines=input(b).lines.map((l,i)=>({...l,weight:[1000000,999999,555555][i]})),a=saveAssessment(b.s,root,input(b,{method:'weighted',totalCents,lines}),now),denominator=lines.reduce((n,l)=>n+BigInt(l.weight),0n);
  assert.equal(a.lines.reduce((n,l)=>n+l.amountCents,0),totalCents);for(const l of a.lines){const floor=Number(BigInt(totalCents)*BigInt(l.weight)/denominator);assert.ok(l.amountCents===floor||l.amountCents===floor+1);}
 }
 const b=base(),a=saveAssessment(b.s,root,input(b,{method:'weighted',totalCents:101,lines:[{houseId:'c01',debtor:'Mesmo pagador',weight:1},{houseId:'c02',debtor:'Mesmo pagador',weight:2}]}),now);assert.deepEqual(a.lines.map(l=>l.amountCents),[34,67]);
});
test('parâmetros inválidos, unidade repetida/alheia e contribuição zero não mudam o estado',()=>{
 const b=base(),before=structuredClone(b.s),one=input(b).lines[0];
 for(const patch of [{lines:[]},{lines:[one,one]},{lines:[{...one,houseId:'foreign'}]},{lines:[{...one,debtor:'x'}]},{totalCents:0},{totalCents:1},{totalCents:1.1},{totalCents:100000001},{issuedOn:'2026-10-20'},{dueOn:'2026-02-30'},{dueOn:'2026-08-31'},{month:'2026-13'},{month:['2026-09']},{method:'area'},{fundId:'foreign'}])assert.throws(()=>saveAssessment(b.s,root,input(b,patch),now));
 for(const weight of [0,-1,1.1,1000001,'10',Infinity])assert.throws(()=>saveAssessment(b.s,root,input(b,{method:'weighted',lines:[{...one,weight}]}),now));assert.deepEqual(b.s,before);
});
test('revisão mantém distribuição anterior, referência é única e aprovação congela o rascunho',()=>{
 const b=base();let a=saveAssessment(b.s,root,input(b),now);assert.throws(()=>saveAssessment(b.s,root,input(b,{reference:' ｒａｔ-001 '}),now),/já registrada/);assert.throws(()=>saveAssessment(b.s,root,input(b,{id:a.id,version:0,totalCents:20000}),now),/mudou/);
 a=saveAssessment(b.s,root,input(b,{id:a.id,version:1,totalCents:20000}),now);assert.equal(a.history[1].before.totalCents,10000);assert.equal(a.history[1].before.lines[0].amountCents,3334);
 a=approve(b,a);assert.equal(a.approval.by,root.id);assert.throws(()=>saveAssessment(b.s,root,input(b,{id:a.id,version:a.version,totalCents:1}),now),/Somente rascunho/);
 a=cancelAssessment(b.s,root,{id:a.id,version:a.version,reason:'Decisão revista'},now);assert.equal(a.status,'cancelled');assert.throws(()=>approve(b,a),/rascunho/);assert.throws(()=>saveAssessment(b.s,root,input(b),now),/já registrada/);assert.equal(b.s.financialReceivables,undefined);
});
test('geração usa somente valores aprovados, vincula unidade e não pode repetir o lote',()=>{
 const b=base();let a=saveAssessment(b.s,root,input(b),now);assert.throws(()=>generate(b,a),/aprovado/);a=approve(b,a);
 const operationId=randomUUID(),result=generate(b,a,{operationId,totalCents:1,lines:[],debtor:'Troca indevida',fundId:'foreign'});assert.equal(result.receivableIds.length,3);assert.equal(result.assessment.status,'generated');assert.equal(balance(b.s,'a'),10000);
 assert.deepEqual(b.s.financialReceivables.map(r=>r.amountCents),[3334,3333,3333]);assert.deepEqual(b.s.financialReceivables.map(r=>r.houseId),['c01','c02','c03']);assert.ok(b.s.financialReceivables.every(r=>r.assessmentId===a.id&&r.competence==='2026-09'&&r.fundId===b.fund.id));
 const before=structuredClone(b.s);assert.throws(()=>generate(b,result.assessment,{operationId}),/aprovado/);assert.throws(()=>cancelAssessment(b.s,root,{id:a.id,version:result.assessment.version,reason:'Excluir tudo'},now),/ainda não gerado/);assert.deepEqual(b.s,before);
 const next=approve(b,saveAssessment(b.s,root,input(b,{reference:'RAT-002'}),now));assert.throws(()=>generate(b,next,{operationId}),/já registrada/);
 assert.throws(()=>createReceivable(b.s,root,{houseId:'c01',assessmentId:a.id},now),/rateio aprovado/);
});
test('colisão na última unidade recusa geração inteira sem deixar recebíveis parciais',()=>{
 const b=base(),a=approve(b,saveAssessment(b.s,root,input(b),now)),line=a.lines.at(-1);
 createReceivable(b.s,root,{debtor:line.debtor,reference:line.reference,description:'Registro anterior',category:'Contribuições',amountCents:100,fundId:b.fund.id,issuedOn:'2026-09-01',dueOn:'2026-09-20'},now);
 const before=structuredClone(b.s);assert.throws(()=>generate(b,a),/já registrada/);assert.deepEqual(b.s,before);assert.equal(b.s.financialReceivables.length,1);
});
test('controle prepara/aprova, operação gera e leitura não amplia poderes ou dados residenciais',()=>{
 const b=base(),viewer={id:'v',name:'Consulta',tenant:'a',role:'subsindico',delegations:['financeRead']},writer={...viewer,delegations:['finance']},controller={...viewer,delegations:['financeClose']};
 for(const u of [viewer,writer])assert.throws(()=>saveAssessment(b.s,u,input(b),now));let a=saveAssessment(b.s,controller,input(b),now);
 assert.throws(()=>approveAssessment(b.s,writer,{id:a.id,version:1,reason:'Tentativa'},now));a=approveAssessment(b.s,controller,{id:a.id,version:1,reason:'Aprovado'},now);
 for(const u of [viewer,controller,{...root,tenant:'b'}])assert.throws(()=>generateAssessment(b.s,u,{id:a.id,version:a.version,operationId:randomUUID(),reason:'Tentativa'},now));
 const view=financeView(b.s,writer,now);assert.deepEqual(Object.keys(view.units[0]).sort(),['id','number']);assert.equal(view.units.length,3);assert.deepEqual(financeView(b.s,{...root,tenant:'b'},now).assessments,[]);assert.equal(financeView(b.s,{tenant:'a',role:'proprietario',houses:['c01']},now),null);
 generateAssessment(b.s,writer,{id:a.id,version:a.version,operationId:randomUUID(),reason:'Gerado'},now);assert.equal(b.s.financialReceivables.length,3);
});
test('fechamento exige tratar rateios aprovados e bloqueia emissão ou competência encerrada',()=>{
 const b=base(),draft=saveAssessment(b.s,root,input(b),now),a=approve(b,draft);assert.equal(financialReport(b.s,root,'2026-09').report.unissuedAssessments.length,1);assert.throws(()=>closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Conferido'},now),/rateios aprovados/);
 cancelAssessment(b.s,root,{id:a.id,version:a.version,reason:'Não será emitido'},now);const pending=saveAssessment(b.s,root,input(b,{reference:'RAT-002'}),now);closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Conferido'},now);
 assert.throws(()=>approve(b,pending),/encerrad/);assert.throws(()=>saveAssessment(b.s,root,input(b,{reference:'RAT-003',issuedOn:'2026-10-19',dueOn:'2026-10-25'}),now),/Competência encerrada/);assert.throws(()=>saveAssessment(b.s,root,input(b,{reference:'RAT-003',month:'2026-10'}),now),/Período encerrado/);
});
test('unidade alterada/inativa e fundo com rateio aprovado são reavaliados antes de gerar',()=>{
 const b=base();let a=saveAssessment(b.s,root,input(b),now);b.s.houses[0].number='10';assert.throws(()=>approve(b,a),/unidades mudaram/);a=saveAssessment(b.s,root,input(b,{id:a.id,version:a.version}),now);a=approve(b,a);
 // A zero balance fund still has an approved obligation waiting to be generated.
 const empty=base();empty.s.financialAccounts[0].openingCents=0;const waiting=approve(empty,saveAssessment(empty.s,root,input(empty),now));assert.throws(()=>toggleFinancial(empty.s,root,{kind:'fund',id:empty.fund.id,version:1,active:false,reason:'Em uso'},now),/rateio aprovado/);
 b.s.houses[0].active=false;const before=structuredClone(b.s);assert.throws(()=>generate(b,a),/unidades mudaram/);assert.deepEqual(b.s,before);assert.equal(waiting.status,'approved');
});
test('rateio e recebimentos têm corte histórico, sem alterar fechamento depois de estorno/cancelamento',()=>{
 const b=base(),a=approve(b,saveAssessment(b.s,root,input(b),now));generate(b,a);const first=b.s.financialReceivables[0],paid=receipt(b,first),closed=closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Conferido'},now);
 reverseEntry(b.s,root,{id:paid.entry.id,version:1,date:'2026-10-19',reference:'ESTORNO-001',reason:'Entrada revista',operationId:randomUUID(),accountVersions:[{id:b.account.id,version:b.s.financialAccounts[0].version}]},now);
 changeReceivable(b.s,root,{id:b.s.financialReceivables[1].id,version:1,status:'cancelled',reason:'Contribuição cancelada'},now);b.s.houses[0].number='99';
 const past=financialClosureReport(b.s,root,closed.id);assert.equal(past.sha256,closed.sha256);assert.equal(past.report.assessments[0].lines[0].status,'received');assert.equal(past.report.assessments[0].lines[1].status,'open');assert.equal(past.report.assessments[0].lines[0].houseNumber,'01');
 const current=financialReport(b.s,root,'2026-10').report;assert.deepEqual(current.assessments[0].lines.map(l=>l.status),['open','cancelled','open']);assert.equal(current.budget.totals.income.actualCents,-3334);assert.equal(current.receivables[0].assessmentId,a.id);assert.equal(current.receivables[0].houseNumber,'01');
});
test('bases e fechamentos anteriores aos rateios mantêm leitura e hash original',()=>{
 const b=base();assert.deepEqual(financeView(b.s,root,now).assessments,[]);const report=financialReport(b.s,root,'2026-09').report;delete report.assessments;delete report.unissuedAssessments;
 const sha256=createHash('sha256').update(JSON.stringify(report)).digest('hex');b.s.financialClosures=[{id:'antigo',tenant:'a',month:'2026-09',status:'closed',version:1,report,sha256,history:[]}];const before=structuredClone(b.s),saved=financialReport(b.s,root,'2026-09');assert.equal(saved.sha256,sha256);assert.equal(saved.report.assessments,undefined);assert.deepEqual(b.s,before);
});
