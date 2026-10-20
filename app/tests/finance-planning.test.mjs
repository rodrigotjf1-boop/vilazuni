import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createFund,createAccount,createEntry,transfer,toggleFinancial,createReceivable,receiveReceivable,changeReceivable,editReceivable,saveBudget,reverseEntry,financeView,financialReport,financialClosureReport,closeMonth,reopenMonth} from '../finance.mjs';
import {balance,revision} from '../finance-ledger.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'a',role:'sindico'};
function base(openingCents=10000){
 const s={},fund=createFund(s,root,{name:'Ordinário',purpose:'Operação corrente'},now),reserve=createFund(s,root,{name:'Reserva',purpose:'Reserva de teste'},now);
 const account=createAccount(s,root,{name:'Conta sintética',kind:'bank',fundId:fund.id,openingCents,openingOn:'2026-09-01',reason:'Saldo conferido'},now);
 return {s,fund,reserve,account,current:()=>s.financialAccounts[0]};
}
function receivable(b,patch={}){return createReceivable(b.s,root,{description:'Recebível sintético',debtor:'Pagador de teste',reference:'DOC-001',amountCents:2501,fundId:b.fund.id,category:'Contribuições',issuedOn:'2026-09-02',dueOn:'2026-09-20',...patch},now);}
function receipt(b,r,patch={}){return {id:r.id,version:r.version,operationId:randomUUID(),accountId:b.account.id,accountVersion:b.current().version,date:'2026-09-15',reference:randomUUID(),reason:'Entrada conferida',...patch};}
function movement(b,patch={}){return {operationId:randomUUID(),kind:'income',accountId:b.account.id,accountVersion:b.current().version,fundId:b.fund.id,date:'2026-09-10',amountCents:1000,description:'Registro sintético',category:'Contribuições',reference:randomUUID(),reason:'Conferido em teste',...patch};}
function reverse(b,e,patch={}){return reverseEntry(b.s,root,{id:e.id,version:e.version,operationId:randomUUID(),date:'2026-10-19',reference:randomUUID(),reason:'Correção conferida',accountVersions:[{id:b.account.id,version:b.current().version}],...patch},now);}
function budget(b,patch={}){return {month:'2026-09',fundId:b.fund.id,kind:'income',category:'Contribuições',plannedCents:3000,reason:'Previsão sintética',...patch};}

test('conta a receber só altera caixa ao receber integralmente e não repete receita',()=>{
 const b=base(),r=receivable(b);assert.equal(balance(b.s,'a'),10000);
 const input=receipt(b,r),received=receiveReceivable(b.s,root,{...input,amountCents:1},now);
 assert.equal(balance(b.s,'a'),12501);assert.equal(received.entry.amountCents,2501);assert.equal(received.entry.receivableId,r.id);assert.equal(received.receivable.status,'received');
 const before=structuredClone(b.s);assert.throws(()=>receiveReceivable(b.s,root,input,now),/mudou/);assert.throws(()=>receiveReceivable(b.s,root,receipt(b,received.receivable),now),/em aberto/);assert.deepEqual(b.s,before);
 const report=financialReport(b.s,root,'2026-09').report;assert.equal(report.summary.incomeCents,2501);assert.equal(report.receivableOutstanding.length,0);assert.equal(report.receivables[0].receivedCents,2501);
});
test('duplicidade, datas, fundos e centavos inválidos não criam recebíveis',()=>{
 const b=base(),r=receivable(b),before=structuredClone(b.s);
 assert.throws(()=>receivable(b,{debtor:' PAGADOR DE TESTE ',reference:'ｄｏｃ-001'}),/já registrada/);
 for(const amountCents of [0,-1,1.1,'100',Infinity,100000001])assert.throws(()=>receivable(b,{reference:randomUUID(),amountCents}));
 assert.throws(()=>receivable(b,{reference:'OUTRO',issuedOn:'2026-10-20'}),/futura/);assert.throws(()=>receivable(b,{reference:'OUTRO',dueOn:'2026-02-30'}));assert.throws(()=>receivable(b,{reference:'OUTRO',dueOn:'2026-09-01'}),/Vencimento/);
 assert.throws(()=>receivable(b,{reference:'OUTRO',fundId:'outro-condominio'}));assert.throws(()=>receiveReceivable(b.s,root,receipt(b,r,{accountVersion:0}),now),/conta mudou/);
 assert.throws(()=>createEntry(b.s,root,movement(b,{receivableId:r.id}),now),/baixa vinculada/);assert.deepEqual(b.s,before);
});
test('estorno de entrada reabre recebível sem reescrever situação de mês anterior',()=>{
 const b=base(),r=receivable(b),received=receiveReceivable(b.s,root,receipt(b,r),now);
 reverse(b,received.entry);assert.equal(balance(b.s,'a'),10000);const current=b.s.financialReceivables[0];assert.equal(current.status,'open');assert.equal(current.receiptEntryId,null);
 assert.equal(financialReport(b.s,root,'2026-09').report.receivables[0].status,'received');assert.equal(financialReport(b.s,root,'2026-10').report.receivables[0].status,'open');
 const before=structuredClone(b.s);assert.throws(()=>receiveReceivable(b.s,root,receipt(b,current),now),/última alteração/);assert.deepEqual(b.s,before);
 receiveReceivable(b.s,root,receipt(b,current,{date:'2026-10-19'}),now);assert.equal(balance(b.s,'a'),12501);assert.equal(financialReport(b.s,root,'2026-09').report.receivables[0].receivedCents,2501);assert.equal(financialReport(b.s,root,'2026-10').report.receivables[0].receivedCents,2501);
});
test('estorno de recebimento já gasto falha sem reabrir recebível',()=>{
 const b=base(0),r=receivable(b),received=receiveReceivable(b.s,root,receipt(b,r),now);createEntry(b.s,root,movement(b,{kind:'expense',amountCents:2501,date:'2026-09-16'}),now);
 const before=structuredClone(b.s);assert.throws(()=>reverse(b,received.entry),/Saldo insuficiente/);assert.deepEqual(b.s,before);assert.equal(b.s.financialReceivables[0].status,'received');
});
test('cancelamento, reabertura e termos do recebível respeitam data de corte',()=>{
 const b=base(),r=receivable(b,{fundId:b.reserve.id});assert.throws(()=>toggleFinancial(b.s,root,{id:b.reserve.id,kind:'fund',version:1,active:false,reason:'Ainda aberto'},now),/contas a receber/);
 let current=editReceivable(b.s,root,{id:r.id,version:1,fundId:b.fund.id,dueOn:'2026-11-01',category:'Outra categoria',reason:'Revisão conferida'},now);
 const old=financialReport(b.s,root,'2026-09').report.receivables[0];assert.equal(old.fundId,b.reserve.id);assert.equal(old.dueOn,'2026-09-20');assert.equal(old.category,'Contribuições');
 current=changeReceivable(b.s,root,{id:r.id,version:current.version,status:'cancelled',reason:'Registro indevido'},now);
 assert.equal(financialReport(b.s,root,'2026-09').report.receivableOutstanding.length,1);assert.equal(financialReport(b.s,root,'2026-10').report.receivableOutstanding.length,0);assert.equal(financialReport(b.s,root,'2026-10').report.receivables[0].statusReason,'Registro indevido');
 assert.throws(()=>receivable(b),/já registrada/);current=changeReceivable(b.s,root,{id:r.id,version:current.version,status:'open',reason:'Registro mantido'},now);
 assert.throws(()=>receiveReceivable(b.s,root,receipt(b,current),now),/última alteração/);receiveReceivable(b.s,root,receipt(b,current,{date:'2026-10-19'}),now);
});
test('orçamento tem identidade única, versões, zero e histórico sem alterar saldo',()=>{
 const b=base(),plan=saveBudget(b.s,root,budget(b),now),before=structuredClone(b.s);
 assert.throws(()=>saveBudget(b.s,root,budget(b,{category:' CONTRIBUIÇÕES '}),now),/Já existe/);assert.throws(()=>saveBudget(b.s,root,budget(b,{id:plan.id,version:0,plannedCents:100}),now),/mudou/);assert.throws(()=>saveBudget(b.s,root,budget(b,{id:plan.id,version:1,month:'2026-10'}),now),/indisponível/);assert.deepEqual(b.s,before);
 const revised=saveBudget(b.s,root,budget(b,{id:plan.id,version:1,plannedCents:0}),now);assert.equal(revised.version,2);assert.deepEqual(revised.history.map(h=>h.plannedCents),[3000,0]);assert.equal(balance(b.s,'a'),10000);
 saveBudget(b.s,root,budget(b,{month:'2027-01',kind:'expense',plannedCents:1}),now);
 for(const plannedCents of [-1,1.1,'100',Infinity,100000001])assert.throws(()=>saveBudget(b.s,root,budget(b,{month:'2027-02',plannedCents}),now));assert.throws(()=>saveBudget(b.s,root,budget(b,{month:'2026-13'}),now));assert.throws(()=>saveBudget(b.s,root,budget(b,{kind:'transfer'}),now));
});
test('comparativo líquido inclui categorias sem previsão e exclui saldo, transferências e ajustes',()=>{
 const b=base();saveBudget(b.s,root,budget(b,{plannedCents:3000}),now);saveBudget(b.s,root,budget(b,{kind:'expense',category:'Manutenção',plannedCents:2000}),now);
 const income=createEntry(b.s,root,movement(b,{amountCents:2501,category:'CONTRIBUIÇÕES'}),now);createEntry(b.s,root,movement(b,{kind:'expense',category:'Manutenção',amountCents:2500}),now);createEntry(b.s,root,movement(b,{kind:'expense',category:'Extraordinária',amountCents:101}),now);
 transfer(b.s,root,{...movement(b),kind:'fundTransfer',targetFundId:b.reserve.id,amountCents:500},now);createEntry(b.s,root,movement(b,{kind:'adjustment',direction:'credit',amountCents:500}),now);
 reverse(b,income,{date:'2026-09-20'});
 const report=financialReport(b.s,root,'2026-09').report,{rows,totals}=report.budget;assert.equal(rows.length,3);assert.equal(totals.income.actualCents,0);assert.equal(totals.income.varianceCents,-3000);assert.equal(totals.expense.actualCents,2601);assert.equal(totals.expense.varianceCents,601);assert.equal(rows.find(r=>r.category==='Extraordinária').hasBudget,false);assert.equal(rows.find(r=>r.category==='Manutenção').varianceCents,500);
 assert.equal(report.summary.incomeCents,2501);assert.equal(report.summary.reversalCents,-2501);
});
test('estornos de mês anterior reduzem o realizado na data do estorno e fundos ficam separados',()=>{
 const b=base();saveBudget(b.s,root,budget(b,{kind:'expense',category:'Manutenção'}),now);saveBudget(b.s,root,budget(b,{fundId:b.reserve.id,kind:'expense',category:'Manutenção',plannedCents:500}),now);
 const expense=createEntry(b.s,root,movement(b,{kind:'expense',category:'manutenção',amountCents:1200}),now);reverse(b,expense);
 const sep=financialReport(b.s,root,'2026-09').report.budget,oct=financialReport(b.s,root,'2026-10').report.budget;assert.equal(sep.totals.expense.actualCents,1200);assert.equal(sep.rows.find(r=>r.fundId===b.reserve.id).actualCents,0);assert.equal(oct.totals.expense.actualCents,-1200);assert.equal(oct.rows[0].hasBudget,false);
});
test('fechamento congela recebíveis e orçamento, reabertura preserva versão e aceita revisão',()=>{
 const b=base(),r=receivable(b),plan=saveBudget(b.s,root,budget(b),now),closed=closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Período conferido'},now);
 assert.throws(()=>saveBudget(b.s,root,budget(b,{id:plan.id,version:1,plannedCents:4000}),now),/Período encerrado/);assert.throws(()=>receivable(b,{reference:'OUTRO'}),/Período encerrado/);
 receiveReceivable(b.s,root,receipt(b,r,{date:'2026-10-19'}),now);assert.equal(financialReport(b.s,root,'2026-09').report.receivableOutstanding.length,1);
 reopenMonth(b.s,root,{id:closed.id,version:1,revision:revision(b.s,'a'),reason:'Rever previsão'},now);saveBudget(b.s,root,budget(b,{id:plan.id,version:1,plannedCents:4000}),now);
 const current=closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Previsão revisada'},now);
 assert.equal(current.report.budget.totals.income.plannedCents,4000);assert.equal(financialClosureReport(b.s,root,closed.id).report.budget.totals.income.plannedCents,3000);assert.notEqual(current.sha256,closed.sha256);
});
test('bases e fechamentos anteriores continuam legíveis sem reescrever seu hash',()=>{
 const b=base(),view=financeView(b.s,root,now);assert.deepEqual(view.receivables,[]);assert.deepEqual(view.budgets,[]);
 const report=financialReport(b.s,root,'2026-09').report;delete report.budget;delete report.receivables;delete report.receivableOutstanding;
 const sha256=createHash('sha256').update(JSON.stringify(report)).digest('hex');b.s.financialClosures=[{id:'antigo',tenant:'a',month:'2026-09',status:'closed',version:1,report,sha256,history:[]}];
 const before=structuredClone(b.s),saved=financialReport(b.s,root,'2026-09');assert.equal(saved.sha256,sha256);assert.equal(saved.report.budget,undefined);assert.deepEqual(b.s,before);
});
test('recebíveis e orçamento respeitam delegações independentes e condomínio',()=>{
 const b=base(),r=receivable(b),viewer={tenant:'a',role:'subsindico',delegations:['financeRead']},writer={...viewer,delegations:['finance']},control={...viewer,delegations:['financeClose']};
 assert.throws(()=>receiveReceivable(b.s,viewer,receipt(b,r),now));assert.throws(()=>receiveReceivable(b.s,control,receipt(b,r),now));assert.throws(()=>saveBudget(b.s,writer,budget(b),now));assert.throws(()=>saveBudget(b.s,viewer,budget(b),now));
 assert.throws(()=>receiveReceivable(b.s,{...root,tenant:'b'},receipt(b,r),now));assert.throws(()=>saveBudget(b.s,{...root,tenant:'b'},budget(b),now));const other=financeView(b.s,{...root,tenant:'b'},now);assert.deepEqual(other.receivables,[]);assert.deepEqual(other.budgets,[]);assert.equal(financeView(b.s,{role:'proprietario',tenant:'a'},now),null);
});
