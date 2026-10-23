import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedDemoFinance} from '../demo-finance.mjs';
import {financeView,financialReport,receiveReceivablePartial} from '../finance.mjs';
import {visiblePayerCharges} from '../finance-collection.mjs';
import {balance} from '../finance-ledger.mjs';
import {asaasView,prepareAsaasReminders} from '../asaas.mjs';
import {randomUUID} from 'node:crypto';
import {seedDemoOperations} from '../demo-operations.mjs';
import {DELEGATIONS} from '../permissions.mjs';

const now=Date.parse('2026-10-23T12:00:00-03:00');
function base(tenant='demo-finance'){
 const user={id:'syndic-demo',tenant,role:'sindico',active:true,name:'Síndico fictício'},administrator={id:'administrator-demo',tenant,role:'administradora',active:true,name:'Administradora fictícia',delegations:['financeClose']};
 const houses=Array.from({length:14},(_,i)=>({id:'demo-c'+String(i+1).padStart(2,'0'),tenant,number:String(i+1).padStart(2,'0')}));
 const owners=houses.map((h,i)=>({id:'owner-demo-'+i,tenant,role:'proprietario',active:true,name:'Proprietário '+h.number+' (fictício)',houses:[h.id]}));
 const existing={id:'real-fund',tenant:'real-condo',name:'Saldo real preservado',version:7};
 const db={schema:1,users:[user,administrator,...owners],events:[],invites:[],state:{houses,tenants:[{id:tenant,tenant,name:'Demonstração fictícia',demoMode:true}],financialFunds:[existing],financialAccounts:[],audit:[]}};
 return {db,user,ctx:{pack:'vilazuni-completo-v1',houses,users:{syndic:user,administrator,owners},operations:{purchases:[]}},existing:structuredClone(existing)};
}
test('financeiro fictício percorre contas, rateios, baixas, acordos, encargos e conciliação sem provedor externo',()=>{
 const {db,user,ctx,existing}=base(),result=seedDemoFinance(db,user,ctx,now),s=db.state,f=financeView(s,user,now);
 assert.equal(result.counts.funds,2);assert.equal(result.counts.accounts,3);assert.equal(result.counts.assessments,3);assert.equal(result.counts.recurringTemplates,1);assert.equal(result.counts.payables,5);assert.equal(result.counts.receivables,20);
 assert.equal(balance(s,user.tenant),3668000);assert.equal(f.totalCents,3668000);assert.ok(f.allocations.every(a=>a.balanceCents>=0));
 assert.deepEqual(new Set(f.payables.map(p=>p.status)),new Set(['paid','partial','open','cancelled']));assert.ok(f.receivables.some(r=>r.status==='received'));assert.ok(f.receivables.some(r=>r.status==='partial'));assert.ok(f.receivables.some(r=>r.status==='renegotiated'));
 const agreement=f.agreements[0];assert.equal(agreement.status,'active');assert.equal(agreement.installments.length,3);assert.equal(agreement.installments.reduce((n,i)=>n+i.amountCents,0),agreement.principalCents);
 assert.equal(f.feeRules[0].status,'approved');assert.notEqual(f.feeRules[0].approval.by,f.feeRules[0].createdBy);assert.equal(f.feeAccruals[0].status,'active');assert.equal(f.feeAccruals[0].fineBps,200);
 const statement=f.statements[0];assert.equal(statement.pendingCount,1);assert.equal(statement.ignoredCount,1);assert.equal(statement.unmatchedEntries.length,0);assert.equal(statement.closingDifferenceCents,-2224);assert.ok(statement.rows.some(r=>r.status==='matched'));
 const closure=financialReport(s,user,'2026-09');assert.equal(closure.closed,true);assert.equal(closure.report.summary.closingCents,3600000);assert.match(closure.sha256,/^[a-f\d]{64}$/);
 assert.deepEqual(s.financialFunds.find(r=>r.tenant==='real-condo'),existing);for(const [key,value] of Object.entries(s))if(key.startsWith('financial')&&Array.isArray(value))for(const r of value.filter(r=>r.tenant===user.tenant))assert.equal(r.demoPack,ctx.pack);
 assert.deepEqual(asaasView(s,user,db.users,now).charges,[]);assert.deepEqual(prepareAsaasReminders(s,db.users,now),[]);assert.equal(s.asaasConnections,undefined);assert.equal(s.automationMessages,undefined);assert.equal(s.channelMessages,undefined);
});
test('cada proprietário vê somente seus exemplos de cobrança privada e a repetição preserva operações posteriores',()=>{
 const {db,user,ctx}=base();seedDemoFinance(db,user,ctx,now);const s=db.state,owner=ctx.users.owners[1],other=ctx.users.owners[4];
 const own=visiblePayerCharges(s,owner);assert.equal(own.length,1);assert.equal(own[0].houseNumber,'02');assert.equal(own[0].remainingCents,30000);assert.ok(own[0].instructions.includes('não efetue pagamentos'));
 const contested=visiblePayerCharges(s,other);assert.equal(contested.length,1);assert.equal(contested[0].held,true);assert.equal(contested[0].cases[0].status,'review');assert.equal(visiblePayerCharges(s,{...owner,tenant:'outro'}).length,0);
 const r=s.financialReceivables.find(r=>r.id===own[0].receivableId),account=s.financialAccounts.find(a=>a.name.includes('movimento'));
 receiveReceivablePartial(s,user,{id:r.id,version:r.version,amountCents:1000,accountId:account.id,accountVersion:account.version,date:'2026-10-23',reference:'EXPLORACAO-POSTERIOR',reason:'Conferência fictícia após o preenchimento',operationId:randomUUID()},now);
 const before=structuredClone(db);seedDemoFinance(db,user,ctx,now+86400000);assert.deepEqual(db,before);assert.equal(visiblePayerCharges(s,owner)[0].remainingCents,29000);
});
test('preenchimento financeiro é atômico e restrito ao contexto de demonstração, com datas relativas inclusive na virada do mês',()=>{
 const {db,user,ctx}=base(),snapshot=structuredClone(db);assert.throws(()=>seedDemoFinance(db,{...user,role:'proprietario'},ctx,now),/demonstração/);assert.deepEqual(db,snapshot);
 db.state.tenants[0].demoMode=false;assert.throws(()=>seedDemoFinance(db,user,ctx,now),/demonstração/);db.state.tenants[0].demoMode=true;
 const bad=structuredClone(ctx);bad.users.administrator.id=user.id;assert.throws(()=>seedDemoFinance(db,user,bad,now),/segunda pessoa/);assert.deepEqual(db,snapshot);
 const january=Date.parse('2027-01-01T00:00:00-03:00');seedDemoFinance(db,user,ctx,january);const f=financeView(db.state,user,january);assert.equal(f.lastClosedMonth,'2026-12');assert.equal(f.statements[0].through,'2027-01-01');assert.equal(f.recurringTemplates[0].generations[0].month,'2027-02');assert.ok(f.receivables.every(r=>r.dueOn>=r.issuedOn));assert.ok(f.collection.reminders.length>0);
});

test('compra fictícia recebida vira conta a pagar uma única vez e mantém o vínculo ao estoque',()=>{
 const {db,user,ctx}=base('chandra');ctx.users.administrator.delegations=Object.keys(DELEGATIONS);
 const caretaker={id:'caretaker-demo',tenant:user.tenant,role:'zelador',active:true,name:'Zelador fictício'},portaria={id:'gate-demo',tenant:user.tenant,role:'portaria',active:true,name:'Porteiro fictício'};db.users.push(caretaker,portaria);ctx.users.caretaker=caretaker;ctx.users.portaria=portaria;ctx.portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
 ctx.operations=seedDemoOperations(db,user,ctx,now);const received=ctx.operations.purchases.find(p=>p.status==='received');assert.ok(received);const beforeStock=structuredClone(db.state.materials);
 const result=seedDemoFinance(db,user,ctx,now),payable=db.state.financialPayables.find(p=>p.purchaseId===received.id);assert.equal(result.counts.payables,6);assert.equal(payable.amountCents,18500);assert.equal(payable.reference,received.receipt.reference);assert.ok(received.receipt.movementId);assert.deepEqual(db.state.materials,beforeStock);
 seedDemoFinance(db,user,ctx,now);assert.equal(db.state.financialPayables.filter(p=>p.purchaseId===received.id).length,1);
});
