import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
import {createFund,createAccount,createEntry,transfer,reverseEntry,createPayable,payPayable,payPayablePartial,changePayable,importPurchase,createReceivable,receiveReceivable,receiveReceivablePartial,changeReceivable,saveBudget,saveAssessment,approveAssessment,generateAssessment,saveRecurringTemplate,prepareRecurringAssessment,createAgreement,approveAgreement,activateAgreement,closeMonth} from './finance.mjs';
import {balance,revision} from './finance-ledger.mjs';
import {createFeeRule,decideFeeRule,previewFeeAccrual,applyFeeAccrual} from './finance-fees.mjs';
import {assignFinancialPayer,issueManualRequest,createCollectionCase,updateCollectionCase,setCollectionHold,saveReminderPolicy,prepareFinancialReminders,daysBetween} from './finance-collection.mjs';
import {previewStatement,importStatement,changeStatementRow} from './finance-reconciliation.mjs';

const reason='Demonstração fictícia para explorar o aplicativo, sem pagamento ou recebimento real.';
const instructions='DEMONSTRAÇÃO: não efetue pagamentos. Não existe Pix, boleto ou conta bancária real neste cadastro. Explore a conferência manual no aplicativo.';
const offset=(day,n)=>new Date(Date.parse(day+'T12:00Z')+n*86400000).toISOString().slice(0,10);
const monthOffset=(day,n)=>{const d=new Date(day.slice(0,7)+'-01T12:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);};
const own=(s,key,u)=>(s[key]||[]).filter(r=>r.tenant===u.tenant);
const record=(s,key,id)=>s[key].find(r=>r.id===id);
const summary=(s,u)=>{
 const keys={funds:'financialFunds',accounts:'financialAccounts',entries:'financialEntries',payables:'financialPayables',receivables:'financialReceivables',budgets:'financialBudgets',assessments:'financialAssessments',agreements:'financialAgreements',recurringTemplates:'financialRecurringTemplates',statements:'financialStatements',closures:'financialClosures',feeRules:'financialFeeRules',feeAccruals:'financialFeeAccruals',manualRequests:'financialManualRequests',collectionCases:'financialCollectionCases',reminders:'financialReminders',payerLinks:'financialPayerLinks',collectionHolds:'financialCollectionHolds'};
 return {counts:Object.fromEntries(Object.entries(keys).map(([name,key])=>[name,own(s,key,u).length])),funds:own(s,'financialFunds',u),accounts:own(s,'financialAccounts',u),assessmentId:own(s,'financialAssessments',u).find(a=>a.status==='generated')?.id||null,statementId:own(s,'financialStatements',u)[0]?.id||null};
};

// Called only by the complete-demo provisioner. No provider/network functions are imported.
export function seedDemoFinance(db,user,ctx,now=Date.now()){
 const tenant=db.state.tenants?.find(t=>(t.id===user.tenant||t.tenant===user.tenant)&&t.demoMode===true);
 if(!tenant||user.role!=='sindico'||!can(user,'financeClose'))throw Error('O preenchimento financeiro exige o síndico de um condomínio de demonstração.');
 if(own(db.state,'financialFunds',user).length)return summary(db.state,user);
 const next=structuredClone(db),s=next.state,houses=ctx.houses||own(s,'houses',user),people=ctx.users,owners=people.owners||[],administrator=people.administrator;
 if(houses.length<7||!administrator||administrator.id===user.id||administrator.tenant!==user.tenant||!can(administrator,'financeClose'))throw Error('Prepare casas, proprietários e uma segunda pessoa de controle na demonstração.');
 const today=localDay(now),currentMonth=today.slice(0,7),previousMonth=monthOffset(today,-1),previousStart=previousMonth+'-01',previousDue=previousMonth+'-15',nextMonth=monthOffset(today,1);
 const general=createFund(s,user,{name:'Fundo ordinário (fictício)',purpose:'Despesas correntes do condomínio de demonstração'},now),reserve=createFund(s,user,{name:'Fundo de reserva (fictício)',purpose:'Reserva ilustrativa para reparos e imprevistos'},now);
 const bank=createAccount(s,user,{name:'Conta de movimento (fictícia)',kind:'bank',fundId:general.id,openingOn:previousStart,openingCents:2500000,reason},now),reserveBank=createAccount(s,user,{name:'Conta de reserva (fictícia)',kind:'bank',fundId:reserve.id,openingOn:previousStart,openingCents:800000,reason},now),cash=createAccount(s,user,{name:'Caixa pequeno (fictício)',kind:'cash',fundId:general.id,openingOn:previousStart,openingCents:20000,reason},now);
 const accountVersion=id=>record(s,'financialAccounts',id).version;
 const entry=(kind,amountCents,description,reference,on=today)=>createEntry(s,user,{operationId:randomUUID(),kind,accountId:bank.id,accountVersion:accountVersion(bank.id),fundId:general.id,date:on,amountCents,description,category:kind==='income'?'Contribuições':'Manutenção',reference,reason},now);
 entry('income',600000,'Contribuições do mês anterior (fictício)','DEMO-ENTRADA-ANTERIOR',previousMonth+'-05');
 entry('expense',320000,'Serviços do mês anterior (fictício)','DEMO-SAIDA-ANTERIOR',previousMonth+'-10');
 const receivable=(description,reference,amountCents,dueOn,debtor=owners[0]?.name||'Proprietário fictício',issuedOn=previousStart)=>createReceivable(s,user,{description,reference,debtor,amountCents,category:'Contribuições',fundId:general.id,issuedOn,dueOn},now);
 const receipt=(r,amountCents,reference)=>({id:r.id,version:record(s,'financialReceivables',r.id).version,accountId:bank.id,accountVersion:accountVersion(bank.id),amountCents,date:today,reference,reason,operationId:randomUUID()});
 const obligation=(description,reference,amountCents,dueOn,creditor='Fornecedor de demonstração')=>createPayable(s,user,{description,reference,amountCents,creditor,fundId:general.id,category:'Manutenção',issuedOn:previousStart,dueOn},now);
 const payment=(p,amountCents,reference)=>({id:p.id,version:record(s,'financialPayables',p.id).version,accountId:bank.id,accountVersion:accountVersion(bank.id),amountCents,date:today,reference,reason,operationId:randomUUID()});

 const lines=houses.map(h=>({houseId:h.id,debtor:owners.find(o=>o.houses?.includes(h.id))?.name||'Proprietário da casa '+h.number+' (fictício)',weight:1}));
 let assessment=saveAssessment(s,user,{title:'Contribuição mensal anterior (fictícia)',reference:'DEMO-RATEIO-ANTERIOR',month:previousMonth,issuedOn:previousStart,dueOn:previousDue,fundId:general.id,category:'Contribuições',basis:'Distribuição igual criada somente para demonstração; não representa deliberação real.',reason,totalCents:houses.length*45000,method:'equal',lines},now);
 assessment=approveAssessment(s,user,{id:assessment.id,version:assessment.version,reason},now);
 assessment=generateAssessment(s,user,{id:assessment.id,version:assessment.version,operationId:randomUUID(),reason},now).assessment;
 const contributions=assessment.lines.map(l=>record(s,'financialReceivables',l.receivableId));
 for(const r of contributions){const payer=owners.find(o=>o.houses?.includes(r.houseId));if(payer)assignFinancialPayer(s,owners,user,{id:r.id,version:r.version,linkVersion:0,payerUserId:payer.id,reason},now);}
 receiveReceivable(s,user,receipt(contributions[0],45000,'DEMO-RECEBIMENTO-INTEGRAL'),now);
 receiveReceivablePartial(s,user,receipt(contributions[1],15000,'DEMO-RECEBIMENTO-PARCIAL'),now);
 let agreement=createAgreement(s,user,{sourceId:contributions[2].id,sourceVersion:contributions[2].version,reference:'DEMO-ACORDO-03',terms:'Parcelamento fictício em três parcelas iguais, sem acréscimos.',firstDueOn:offset(today,5),count:3,reason},now);
 agreement=approveAgreement(s,administrator,{id:agreement.id,version:agreement.version,reason},now);
 activateAgreement(s,user,{id:agreement.id,version:agreement.version,operationId:randomUUID(),reason},now);
 const rule=createFeeRule(s,user,{reference:'DEMO-REGRA-ENCARGOS',basis:'Exemplo de regra fictícia para explorar a memória de cálculo. Percentuais ilustrativos sem aplicação a dívidas reais.',dueFrom:previousStart,dueThrough:today,fineBps:200,annualInterestBps:1200,reason},now);
 const approvedRule=decideFeeRule(s,administrator,{id:rule.id,version:rule.version,action:'approve',validated:true,reason},now);
 const feeInput={sourceId:contributions[3].id,sourceVersion:contributions[3].version,ruleId:approvedRule.id,ruleVersion:approvedRule.version,through:today};
 const memo=previewFeeAccrual(s,user,feeInput,now);
 applyFeeAccrual(s,user,{...feeInput,revision:memo.revision,reference:'DEMO-ENCARGO-04',dueOn:offset(today,7),reason},now);
 const extra=receivable('Reembolso ilustrativo já recebido','DEMO-REEMBOLSO-RECEBIDO',90000,previousDue);
 receiveReceivable(s,user,receipt(extra,90000,'DEMO-ENTRADA-REEMBOLSO'),now);
 const cancelled=receivable('Conta a receber cancelada (fictícia)','DEMO-RECEBIVEL-CANCELADO',18000,offset(today,10));
 changeReceivable(s,user,{id:cancelled.id,version:cancelled.version,status:'cancelled',reason},now);

 const paid=obligation('Limpeza da piscina (fictícia)','DEMO-NF-PISCINA',62000,today,'Piscinas Mar Azul (fictício)');payPayable(s,user,payment(paid,62000,'DEMO-SAIDA-PISCINA'),now);
 const partial=obligation('Manutenção da portaria (fictícia)','DEMO-NF-PORTARIA',50000,offset(today,5),'Reparos Praia (fictício)');payPayablePartial(s,user,payment(partial,20000,'DEMO-SAIDA-PARCIAL-PORTARIA'),now);
 obligation('Energia das áreas comuns em aberto (fictícia)','DEMO-NF-ENERGIA',38500,previousDue,'Energia do Piloto (fictício)');
 obligation('Jardinagem programada (fictícia)','DEMO-NF-JARDIM',28000,offset(today,10),'Jardim da Vila (fictício)');
 const cancelledPayable=obligation('Pedido cancelado antes do pagamento (fictício)','DEMO-NF-CANCELADA',12500,offset(today,5));changePayable(s,user,{id:cancelledPayable.id,version:cancelledPayable.version,status:'cancelled',reason},now);
 for(const purchase of (ctx.operations?.purchases||[]).filter(p=>p.tenant===user.tenant&&p.status==='received'))importPurchase(s,user,{purchaseId:purchase.id,purchaseVersion:purchase.version,fundId:general.id,dueOn:offset(today,14),category:'Materiais',reason},now);
 transfer(s,user,{kind:'transfer',operationId:randomUUID(),accountId:bank.id,accountVersion:accountVersion(bank.id),targetAccountId:cash.id,targetAccountVersion:accountVersion(cash.id),fundId:general.id,amountCents:50000,date:today,description:'Reposição do caixa pequeno (fictícia)',reference:'DEMO-TRANSFERENCIA-CAIXA',reason},now);
 transfer(s,user,{kind:'fundTransfer',operationId:randomUUID(),accountId:bank.id,accountVersion:accountVersion(bank.id),fundId:general.id,targetFundId:reserve.id,amountCents:150000,date:today,description:'Destinação à reserva (fictícia)',reference:'DEMO-REALOCACAO-RESERVA',reason},now);
 const corrected=entry('expense',12000,'Lançamento demonstrativo corrigido por estorno','DEMO-SAIDA-ESTORNADA');reverseEntry(s,user,{id:corrected.id,version:corrected.version,operationId:randomUUID(),date:today,reference:'DEMO-ESTORNO-SAIDA',reason,accountVersions:[{id:bank.id,version:accountVersion(bank.id)}]},now);

 saveBudget(s,user,{month:currentMonth,fundId:general.id,kind:'income',category:'Contribuições',plannedCents:houses.length*45000,reason},now);
 saveBudget(s,user,{month:currentMonth,fundId:general.id,kind:'expense',category:'Manutenção',plannedCents:180000,reason},now);
 saveBudget(s,user,{month:currentMonth,fundId:reserve.id,kind:'expense',category:'Reparos extraordinários',plannedCents:90000,reason},now);
 saveAssessment(s,user,{title:'Rateio extraordinário em preparação (fictício)',reference:'DEMO-RATEIO-RASCUNHO',month:currentMonth,issuedOn:today,dueOn:offset(today,15),fundId:reserve.id,category:'Reparos extraordinários',basis:'Pesos demonstrativos por unidade para explorar a aprovação do rateio.',reason,totalCents:houses.length*12500,method:'weighted',lines:lines.map((l,i)=>({...l,weight:i%3===0?2:1}))},now);
 const template=saveRecurringTemplate(s,user,{name:'Contribuição mensal recorrente (fictícia)',referencePrefix:'DEMO-MENSAL',sourceAssessmentId:assessment.id,sourceVersion:record(s,'financialAssessments',assessment.id).version,startMonth:currentMonth,endMonth:monthOffset(today,12),dueDay:10,reason},now);
 prepareRecurringAssessment(s,user,{id:template.id,version:template.version,month:nextMonth,issuedOn:today,operationId:randomUUID(),reason},now);

 const openReceivables=own(s,'financialReceivables',user).filter(r=>['open','partial'].includes(r.status));
 for(const r of openReceivables){const link=own(s,'financialPayerLinks',user).find(l=>l.receivableId===r.id);if(link)issueManualRequest(s,user,{id:r.id,version:r.version,linkVersion:link.version,reference:'DEMO-AVISO-'+r.id,instructions,reason},now);}
 const dispute=createCollectionCase(s,user,{id:contributions[4].id,kind:'dispute',message:'Exemplo fictício: proprietário solicita conferência do valor. Nenhuma contestação real.'},now);
 updateCollectionCase(s,user,{id:dispute.id,version:dispute.version,action:'status',status:'review',message:'Gestão fictícia está conferindo a documentação do exemplo.'},now);
 createCollectionCase(s,user,{id:contributions[5].id,kind:'paymentNotice',message:'Exemplo fictício: comprovante informado, aguardando conferência manual. Não há pagamento real.'},now);
 setCollectionHold(s,user,{id:contributions[6].id,version:0,held:true,reason:'Suspensão fictícia para explorar análise de uma cobrança.'},now);
 const reminderPolicy=saveReminderPolicy(s,user,{version:0,enabled:true,offsets:[0,daysBetween(previousDue,today)],reason:'Lembretes apenas internos da demonstração; nenhum envio externo.'},now);
 prepareFinancialReminders(s,owners,user,{version:reminderPolicy.version,reason},now);

 // Keep an authentic frozen prior-month report, while current-day statement has practice issues.
 closeMonth(s,user,{month:previousMonth,revision:revision(s,user.tenant),reason},now);
 const journal=own(s,'financialEntries',user).filter(e=>e.date===today).map(e=>({...e,net:e.postings.filter(p=>p.accountId===bank.id).reduce((n,p)=>n+p.amountCents,0)})).filter(e=>e.net!==0);
 const csvMoney=value=>(value<0?'-':'')+Math.floor(Math.abs(value)/100)+','+String(Math.abs(value)%100).padStart(2,'0');
 const statementRows=journal.map((e,i)=>({externalId:'DEMO-EXTRATO-'+(i+1),date:today,description:e.description,amountCents:e.net,entry:e}));
 statementRows.push({externalId:'DEMO-TARIFA-PENDENTE',date:today,description:'Tarifa fictícia pendente de conferência',amountCents:-990},{externalId:'DEMO-LINHA-RESSALVA',date:today,description:'Linha fictícia ignorada com ressalva',amountCents:-1234});
 const openingCents=balance(s,user.tenant,bank.id,null,offset(today,-1)),closingCents=openingCents+statementRows.reduce((n,r)=>n+r.amountCents,0);
 const content='id;data;descricao;valor\n'+statementRows.map(r=>[r.externalId,r.date,r.description.replace(/[;\r\n]/g,' '),csvMoney(r.amountCents)].join(';')).join('\n');
 const statementInput={accountId:bank.id,from:today,through:today,openingCents,closingCents,fileName:'extrato-ficticio.csv',content};
 const preview=previewStatement(s,user,statementInput,now);let statement=importStatement(s,user,{...statementInput,revision:preview.revision,accountVersion:preview.accountVersion,operationId:randomUUID(),reason},now);
 for(const line of statementRows.filter(r=>r.entry)){statement=changeStatementRow(s,user,{id:statement.id,version:statement.version,rowId:statement.rows.find(r=>r.externalId===line.externalId).id,action:'match',entryId:line.entry.id,entryVersion:line.entry.version,reason},now);}
 changeStatementRow(s,user,{id:statement.id,version:statement.version,rowId:statement.rows.find(r=>r.externalId==='DEMO-LINHA-RESSALVA').id,action:'ignore',reason:'Linha fictícia ignorada para praticar a conferência com ressalva.'},now);

 for(const [key,values] of Object.entries(s))if(Array.isArray(values)&&key.startsWith('financial'))for(const r of values)if(r.tenant===user.tenant)Object.assign(r,{demoPack:ctx.pack,demoKey:'finance:'+key+':'+(r.id||user.tenant)});
 Object.assign(db,next);return summary(db.state,user);
}
