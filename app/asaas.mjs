import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {can} from './permissions.mjs';
import {validBinding} from './access.mjs';
import {localDay} from './residents.mjs';
import {tenantSettings} from './tenants.mjs';
import {rows,canReadFinance,requireFinance,activeAccount,openDate,post} from './finance-ledger.mjs';
import {settlementPosition,syncSettlement} from './finance-settlements.mjs';
import {collectionHeld,payerLink} from './finance-collection-policy.mjs';
import {ASAAS_EVENTS} from './asaas-client.mjs';

const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
const ids=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{3,100}$/.test(value);
export const connectionFor=(s,tenant)=>(s.asaasConnections||[]).find(c=>c.tenant===tenant&&c.enabled);
const audit=(s,u,action,id,now)=>{s.audit??=[];s.audit.unshift({id:randomUUID(),tenant:u.tenant,actor:u.name,actorId:u.id,action,resource:id,at:new Date(now).toISOString()});};
function manager(u){if(u.role!=='sindico'||!can(u,'financeClose'))fail('A conexão de recebimento exige o síndico com controle financeiro.');}
function revision(input,record){if(!Number.isInteger(input.version)||input.version!==(record?.version||0))fail('O cadastro mudou. Atualize antes de continuar.',409);}
function seal(vault,tenant,kind,value){if(!vault)fail('A proteção de credenciais precisa estar configurada no servidor.',409);return vault.seal(JSON.stringify({tenant,kind,value}));}
function open(vault,record,kind,field){if(!vault)fail('Credencial indisponível.',409);try{const value=JSON.parse(vault.open(record[field]));if(value.tenant!==record.tenant||value.kind!==kind||typeof value.value!=='string')throw Error();return value.value;}catch{fail('Credencial indisponível. Reconecte a conta.',409);}}
export function asaasCredentials(s,tenant,vault,id){const c=id?(s.asaasConnections||[]).find(c=>c.tenant===tenant&&c.id===id):connectionFor(s,tenant);if(!c)fail('Conecte primeiro a conta Asaas.',409);return {environment:c.environment,apiKey:open(vault,c,'asaas-key','credential')};}
export function asaasWebhookToken(s,tenant,vault,id){const c=id?(s.asaasConnections||[]).find(c=>c.tenant===tenant&&c.id===id):connectionFor(s,tenant);if(!c)fail('Conexão indisponível.');return open(vault,c,'asaas-webhook','webhookCredential');}
function mask(document){return document.length===14?document.slice(0,2)+'.***.***/****-'+document.slice(-2):'***.***.***-'+document.slice(-2);}
export function paymentCents(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000||Math.abs(value*100-Math.round(value*100))>.000001)fail('Valor Asaas inválido.',409);return Math.round(value*100);}
export function brazilianDocument(value){
 if(typeof value!=='string')fail('Informe CPF ou CNPJ válido.',400);const digits=value.replace(/[.\-/\s]/g,'');
 if(![11,14].includes(digits.length)||!/^\d+$/.test(digits)||/^(\d)\1+$/.test(digits))fail('Informe CPF ou CNPJ válido.',400);
 const check=(length,weights)=>{let total=0;for(let i=0;i<length;i++)total+=Number(digits[i])*weights[i];const remainder=total%11;return remainder<2?0:11-remainder;};
 const valid=digits.length===11?check(9,[10,9,8,7,6,5,4,3,2])===Number(digits[9])&&check(10,[11,10,9,8,7,6,5,4,3,2])===Number(digits[10]):check(12,[5,4,3,2,9,8,7,6,5,4,3,2])===Number(digits[12])&&check(13,[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(digits[13]);
 if(!valid)fail('Informe CPF ou CNPJ válido.',400);return digits;
}
export function connectAsaas(s,u,input,account,vault,now=Date.now()){
 manager(u);const previous=connectionFor(s,u.tenant);revision(input,previous);
 if(!['sandbox','production'].includes(input.environment)||input.confirmAccount!==true)fail('Confirme a conta de recebimento e o ambiente.',400);
 if(input.environment==='production'&&input.confirmProduction!==true)fail('Confirme a conexão da conta de produção.',400);
 const document=brazilianDocument(String(account.commercial?.cpfCnpj||'')),name=String(account.commercial?.companyName||account.commercial?.name||'').trim();if(!name||name.length>160)fail('A conta não retornou identificação válida.',409);
 const fingerprint=hash(input.environment+':'+document);
 if(previous&&previous.fingerprint!==fingerprint&&rows(s,'asaasCharges',u.tenant).some(q=>q.connectionId===previous.id&&!['received','cancelled','failed'].includes(q.status)))fail('Conclua ou cancele as cobranças antes de trocar o ambiente ou a conta.',409);
 if(previous?.environment==='production'&&previous.fingerprint!==fingerprint&&rows(s,'asaasCharges',u.tenant).some(q=>q.connectionId===previous.id))fail('Preserve a conta de produção com histórico de recebimentos.',409);
 const same=previous?.fingerprint===fingerprint?previous:(s.asaasConnections||[]).find(c=>c.tenant===u.tenant&&c.fingerprint===fingerprint);
 const financeAccount=activeAccount(s,u,input.accountId);if(financeAccount.kind!=='bank')fail('Selecione uma conta financeira bancária para o saldo Asaas.',400);
 if(same&&same.accountId!==financeAccount.id&&rows(s,'asaasCharges',u.tenant).some(q=>q.connectionId===same.id))fail('A conta de conciliação não pode mudar com cobranças registradas.',409);
 const c={id:same?.id||randomUUID(),tenant:u.tenant,version:Math.max(previous?.version||0,same?.version||0)+1,environment:input.environment,name,documentMasked:mask(document),fingerprint,accountId:financeAccount.id,credential:seal(vault,u.tenant,'asaas-key',input.apiKey),webhookCredential:same?.webhookCredential||seal(vault,u.tenant,'asaas-webhook',randomBytes(32).toString('hex')),webhookId:same?.webhookId||null,webhookReady:same?.webhookReady||false,status:account.status?.general||'UNKNOWN',checkedAt:new Date(now).toISOString(),enabled:true,remindersEnabled:same?.remindersEnabled||false};
 s.asaasConnections??=[];if(previous)previous.enabled=false;if(same)s.asaasConnections[s.asaasConnections.indexOf(same)]=c;else s.asaasConnections.push(c);audit(s,u,'Conta Asaas conectada: '+c.environment,c.id,now);return c.id;
}
export function webhookConfigured(s,u,id,remote,now=Date.now()){
 const c=connectionFor(s,u.tenant);if(!c||c.id!==id||!ids(remote.id))fail('A conexão mudou durante a configuração.',409);c.webhookId=remote.id;c.webhookReady=true;c.version++;audit(s,u,'Webhook Asaas configurado',c.id,now);
}
export function refreshAsaasStatus(s,u,account,now=Date.now()){
 manager(u);const c=connectionFor(s,u.tenant);if(!c)fail('Conexão indisponível.');if(c.fingerprint!==hash(c.environment+':'+brazilianDocument(String(account.commercial?.cpfCnpj||''))))fail('A chave pertence a outra conta.',409);c.status=account.status?.general||'UNKNOWN';c.checkedAt=new Date(now).toISOString();c.version++;return c.status;
}
function safeConnection(c){if(!c)return null;const {id,version,environment,name,documentMasked,accountId,webhookReady,status,checkedAt,enabled,remindersEnabled=false}=c;return {id,version,environment,name,documentMasked,accountId,webhookReady,status,checkedAt,enabled,remindersEnabled};}
export function setAsaasReminders(s,u,input){requireFinance(u,'financeClose');const c=connectionFor(s,u.tenant);if(!c)fail('Conecte a conta primeiro.',409);revision(input,c);if(typeof input.enabled!=='boolean')fail('Informe a situação dos lembretes.',400);c.remindersEnabled=input.enabled;c.version++;return {enabled:c.remindersEnabled};}
export function prepareAsaasReminders(s,users,now=Date.now()){
 const today=localDay(now),created=[];
 for(const q of s.asaasCharges||[]){const c=(s.asaasConnections||[]).find(c=>c.id===q.connectionId),offset=Math.round((Date.parse(today+'T12:00Z')-Date.parse(q.dueOn+'T12:00Z'))/86400000);
  if(q.environment!=='production'||!c?.enabled||!c.remindersEnabled||!['open','overdue'].includes(q.status)||tenantSettings(s,q.tenant).status==='closed'||![-3,0,1,7,15,30].includes(offset)||collectionHeld(s,q.tenant,q.receivableId)||payerLink(s,q.tenant,q.receivableId)?.payerUserId!==q.payerUserId||!users.some(u=>u.tenant===q.tenant&&u.id===q.payerUserId&&validBinding(s,u,now))||(s.asaasReminders||[]).some(r=>r.chargeId===q.id&&r.on===today))continue;
  const r={id:randomUUID(),tenant:q.tenant,version:1,chargeId:q.id,receivableId:q.receivableId,payerUserId:q.payerUserId,on:today,offset};s.asaasReminders??=[];s.asaasReminders.push(r);created.push(r);
 }return created;
}
export function asaasSettings(s,u,{origin,vault}={}){
 manager(u);const c=connectionFor(s,u.tenant);return {connection:safeConnection(c),credentialsReady:!!vault,webhookUrl:c&&origin?origin+'/api/payments/asaas/webhook/'+c.id:null};
}
export function saveAsaasPayer(s,users,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const target=users.find(p=>p.id===input.userId&&p.tenant===u.tenant&&validBinding(s,p,now)&&['proprietario','imobiliaria','ocupante','temporario'].includes(p.role));if(!target)fail('Selecione um pagador ativo deste condomínio.');
 const previous=rows(s,'asaasPayers',u.tenant).find(p=>p.userId===target.id);revision(input,previous);
 if(previous&&(s.asaasCharges||[]).some(q=>q.tenant===u.tenant&&q.payerId===previous.id&&!['cancelled','failed'].includes(q.status)))fail('O pagador tem cobranças com histórico. Preserve a identificação já utilizada.',409);
 const document=brazilianDocument(input.document),phone=String(input.mobilePhone||'').replace(/[\s()+.-]/g,'');if(phone&&!/^\d{10,13}$/.test(phone))fail('Informe telefone válido com DDD.',400);
 const p={id:previous?.id||randomUUID(),tenant:u.tenant,userId:target.id,name:target.name,email:target.email,document,mobilePhone:phone,version:(previous?.version||0)+1,customers:previous?.document===document?previous.customers||{}:{}};
 s.asaasPayers??=[];if(previous)s.asaasPayers[s.asaasPayers.indexOf(previous)]=p;else s.asaasPayers.push(p);audit(s,u,'Pagador Asaas cadastrado',p.id,now);return {id:p.id};
}
export function setPayerWhatsappConsent(s,u,input,now=Date.now()){
 requireFinance(u,'financeClose');const p=rows(s,'asaasPayers',u.tenant).find(p=>p.id===input.id);if(!p)fail('Pagador indisponível.');revision(input,p);if(typeof input.enabled!=='boolean'||input.enabled&&!/^(?:55)?\d{10,11}$/.test(p.mobilePhone))fail('Confira o celular com DDD antes de autorizar.',400);if(typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>500)fail('Registre a autorização do contato ou o motivo da retirada.',400);p.whatsappConsent=input.enabled;p.consentAt=new Date(now).toISOString();p.consentBy=u.id;p.consentReason=input.reason.trim();p.version++;audit(s,u,input.enabled?'WhatsApp privado autorizado para o pagador':'WhatsApp privado retirado pelo controle',p.id,now);return {enabled:p.whatsappConsent};
}
function linkAndReceivable(s,users,u,input,now){
 requireFinance(u,'finance');const c=connectionFor(s,u.tenant);if(!c?.enabled||!c.webhookReady||c.status!=='APPROVED')fail('Conecte uma conta aprovada e configure o retorno de pagamentos.',409);
 const r=rows(s,'financialReceivables',u.tenant).find(r=>r.id===input.receivableId);if(!r)fail('Conta a receber indisponível.');if(input.receivableVersion!==r.version)fail('A conta a receber mudou.',409);
 const link=payerLink(s,u.tenant,r.id),payer=rows(s,'asaasPayers',u.tenant).find(p=>p.userId===link?.payerUserId);if(!payer)fail('Cadastre os dados do pagador vinculado à conta a receber.',409);
 if(!users.some(p=>p.id===payer.userId&&p.tenant===u.tenant&&validBinding(s,p,now)))fail('O acesso do pagador não está vigente.');
 if(collectionHeld(s,u.tenant,r.id))fail('A cobrança está suspensa ou em análise.',409);
 if(rows(s,'financialFeeAccruals',u.tenant).some(a=>a.sourceId===r.id&&a.status==='active'))fail('Revise os encargos locais antes de emitir pelo provedor.',409);
 const position=settlementPosition(s,u.tenant,'receivable',r);if(!['open','partial'].includes(position.status)||position.remainingCents<=0)fail('Não há saldo aberto para emitir.');
 if(rows(s,'asaasCharges',u.tenant).some(q=>q.environment===c.environment&&q.receivableId===r.id&&!['cancelled','failed'].includes(q.status)))fail('Há uma cobrança externa vinculada. Consulte antes de emitir novamente.',409);
 if(rows(s,'financialManualRequests',u.tenant).some(q=>q.receivableId===r.id&&!q.cancelledOn))fail('Cancele o aviso manual antes de emitir cobrança externa.',409);
 if(!['PIX','BOLETO'].includes(input.billingType))fail('Escolha Pix ou boleto.',400);activeAccount(s,u,c.accountId);
 return {c,r,payer,position};
}
export function previewAsaasCharge(s,users,u,input,now=Date.now()){
 const {c,r,payer,position}=linkAndReceivable(s,users,u,input,now);
 return {environment:c.environment,receiver:c.name,receiverDocument:c.documentMasked,debtor:payer.name,documentMasked:mask(payer.document),description:r.description,reference:r.reference,dueOn:r.dueOn,amountCents:position.remainingCents,billingType:input.billingType,receivableId:r.id,receivableVersion:r.version,connectionVersion:c.version,payerVersion:payer.version};
}
export function claimAsaasCharge(s,users,u,input,now=Date.now()){
 const {c,r,payer,position}=linkAndReceivable(s,users,u,input,now);if(input.confirm!==true||input.connectionVersion!==c.version||input.payerVersion!==payer.version)fail('Confira a prévia atual antes de confirmar.',409);
 if(c.environment==='production'&&input.confirmProduction!==true)fail('Confirme a emissão de cobrança real.',400);
 const q={id:randomUUID(),tenant:u.tenant,connectionId:c.id,environment:c.environment,accountId:c.accountId,receivableId:r.id,receivableVersion:r.version,payerId:payer.id,payerUserId:payer.userId,amountCents:position.remainingCents,billingType:input.billingType,dueOn:r.dueOn,description:r.description,status:'creating',version:1,createdAt:new Date(now).toISOString(),receiptOperationId:randomUUID(),feeOperationId:randomUUID()};q.externalReference='vilazuni:'+q.id;
 s.asaasCharges??=[];s.asaasCharges.push(q);audit(s,u,'Emissão Asaas confirmada: '+c.environment,q.id,now);return structuredClone(q);
}
export function asaasOperation(s,u,id){const q=rows(s,'asaasCharges',u.tenant).find(q=>q.id===id);if(!q)fail('Cobrança indisponível.');return q;}
export function payerForCharge(s,q){const p=rows(s,'asaasPayers',q.tenant).find(p=>p.id===q.payerId);if(!p)fail('Pagador indisponível.');return {...structuredClone(p),customerId:p.customers?.[q.connectionId]||null};}
export function saveAsaasCustomer(s,q,id){if(!ids(id))fail('Cliente Asaas inválido.',409);const p=rows(s,'asaasPayers',q.tenant).find(p=>p.id===q.payerId);if(!p)fail('Pagador indisponível.');p.customers??={};p.customers[q.connectionId]=id;}
function safeURL(value){if(!value)return null;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['asaas.com','www.asaas.com','sandbox.asaas.com'].includes(url.hostname))return null;return url.href;}catch{return null;}}
export function finishAsaasCreation(s,u,id,payment,now=Date.now()){
 const q=asaasOperation(s,u,id);if(q.status!=='creating'&&q.status!=='uncertain')fail('A emissão já foi concluída.',409);
 if(!ids(payment.id)||payment.customer!==payerForCharge(s,q).customerId||payment.externalReference!==q.externalReference||paymentCents(payment.value)!==q.amountCents||payment.billingType!==q.billingType||payment.dueDate!==q.dueOn)fail('A resposta não corresponde à cobrança preparada.',409);
 q.paymentId=payment.id;q.customerId=payment.customer;q.status='open';q.providerStatus=payment.status;q.invoiceUrl=safeURL(payment.invoiceUrl);q.bankSlipUrl=safeURL(payment.bankSlipUrl);q.version++;q.updatedAt=new Date(now).toISOString();return structuredClone(q);
}
export function failAsaasCreation(s,u,id,error){const q=asaasOperation(s,u,id);q.status=error.uncertain===false?'failed':'uncertain';q.error='O provedor não confirmou a emissão. Consulte a situação antes de tentar novamente.';q.version++;return {id:q.id,status:q.status};}
export function ingestAsaasWebhook(s,connectionId,token,event,vault,now=Date.now()){
 const c=(s.asaasConnections||[]).find(c=>c.id===connectionId);if(!c||typeof token!=='string'||token.length>256)fail('Evento não autenticado.');
 const expected=hash(asaasWebhookToken(s,c.tenant,vault,c.id)),received=hash(token);if(!timingSafeEqual(Buffer.from(expected),Buffer.from(received)))fail('Evento não autenticado.');
 if(!event||!ids(event.id)||!ASAAS_EVENTS.includes(event.event)||!ids(event.payment?.id))fail('Evento inválido.',400);
 const existing=rows(s,'asaasWebhookEvents',c.tenant).find(e=>e.connectionId===c.id&&e.eventId===event.id);
 if(existing)return {received:true,duplicate:true};
 const receipt={id:randomUUID(),tenant:c.tenant,connectionId:c.id,eventId:event.id,event:event.event,paymentId:event.payment.id,status:'pending',attempts:0,receivedAt:new Date(now).toISOString()};s.asaasWebhookEvents??=[];s.asaasWebhookEvents.push(receipt);return {received:true};
}
function serviceUser(tenant){return {id:'asaas-service',tenant,name:'Asaas · retorno verificado',role:'sindico'};}
export function reconcileAsaasPayment(s,connectionId,payment,now=Date.now()){
 const next=structuredClone(s),result=reconcilePayment(next,connectionId,payment,now),before=s.asaasCharges?.find(q=>q.id===result.id),after=next.asaasCharges.find(q=>q.id===result.id);
 const publicState=q=>{const {version,checkedAt,...fields}=q;return JSON.stringify(fields);};if(before&&publicState(before)===publicState(after))after.version=before.version;
 Object.assign(s,next);return result;
}
function reconcilePayment(s,connectionId,payment,now){
 const c=(s.asaasConnections||[]).find(c=>c.id===connectionId),q=c&&rows(s,'asaasCharges',c.tenant).find(q=>q.connectionId===c.id&&(q.paymentId===payment.id||q.externalReference===payment.externalReference));
 if(!c||!q)fail('Cobrança externa ainda não vinculada.',409);
 if(tenantSettings(s,c.tenant).status==='closed')fail('Condomínio encerrado.',409);
 if(!ids(payment.id)||payment.externalReference!==q.externalReference||paymentCents(payment.value)!==q.amountCents||payment.billingType!==q.billingType||payment.dueDate!==q.dueOn||payment.customer!==payerForCharge(s,q).customerId||q.customerId&&payment.customer!==q.customerId)fail('Retorno divergente da cobrança.',409);
 q.invoiceUrl=safeURL(payment.invoiceUrl);q.bankSlipUrl=safeURL(payment.bankSlipUrl);if(!q.paymentId){q.paymentId=payment.id;q.customerId=payment.customer;}q.providerStatus=payment.status;q.checkedAt=new Date(now).toISOString();q.version++;delete q.error;
 if(['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','PARTIALLY_REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status)){q.status='review';q.error='Estorno ou contestação do provedor: confira valores e tarifas antes da conciliação.';return {id:q.id,status:q.status};}
 if(payment.deleted||payment.status==='DELETED'){if(q.receiptEntryId){q.status='review';q.error='Cobrança removida após recebimento: conferir no provedor.';}else q.status='cancelled';return {id:q.id,status:q.status};}
 if(payment.status!=='RECEIVED'){if(!q.receiptEntryId)q.status=payment.status==='OVERDUE'?'overdue':['PENDING','CONFIRMED'].includes(payment.status)?'open':'review';return {id:q.id,status:q.status};}
 if(q.receiptEntryId){q.status='received';return {id:q.id,status:q.status,duplicate:true};}
 const gross=paymentCents(payment.value),net=paymentCents(payment.netValue),fee=gross-net;if(net>gross)fail('Tarifa do provedor inválida.',409);
 if(q.environment==='sandbox'){Object.assign(q,{status:'received',netCents:net,feeCents:fee});return {id:q.id,status:q.status,simulation:true};}
 const r=rows(s,'financialReceivables',q.tenant).find(r=>r.id===q.receivableId);if(!r||r.version!==q.receivableVersion||settlementPosition(s,q.tenant,'receivable',r).remainingCents!==gross)fail('O saldo local mudou. Confira o recebimento antes de conciliar.',409);
 const u=serviceUser(q.tenant),day=localDay(now),on=openDate(s,u,day,now),account=activeAccount(s,u,q.accountId);
 const entry=post(s,u,{operationId:q.receiptOperationId,kind:'income',date:on,description:r.description,category:r.category,reference:'Asaas '+payment.id,reason:'Recebimento confirmado por consulta autenticada ao Asaas',amountCents:gross,receivableId:r.id,providerPaymentId:payment.id,postings:[{accountId:account.id,fundId:r.fundId,amountCents:gross}]},[{id:account.id,version:account.version}],now);
 if(fee)post(s,u,{operationId:q.feeOperationId,kind:'expense',date:on,description:'Tarifa Asaas · '+r.reference,category:'Tarifas de cobrança',reference:'Tarifa Asaas '+payment.id,reason:'Diferença entre valor recebido e líquido confirmado no provedor',amountCents:fee,providerPaymentId:payment.id,postings:[{accountId:account.id,fundId:r.fundId,amountCents:-fee}]},[{id:account.id,version:account.version}],now);
 syncSettlement(s,q.tenant,'receivable',r);r.version++;r.history.push({at:new Date(now).toISOString(),actor:u.name,action:'Recebimento Asaas conciliado',entryId:entry.id,amountCents:gross});
 Object.assign(q,{status:'received',receiptEntryId:entry.id,receivedOn:on,netCents:net,feeCents:fee});audit(s,u,'Recebimento e tarifa Asaas conciliados',q.id,now);return {id:q.id,status:q.status};
}
export function asaasView(s,u){
 const managerView=canReadFinance(u);
 const charges=rows(s,'asaasCharges',u.tenant).filter(q=>managerView||q.payerUserId===u.id&&payerLink(s,u.tenant,q.receivableId)?.payerUserId===u.id).map(q=>({id:q.id,version:q.version,receivableId:q.receivableId,description:q.description,amountCents:q.amountCents,dueOn:q.dueOn,billingType:q.billingType,status:q.status,providerStatus:q.providerStatus,environment:q.environment,invoiceUrl:['open','overdue'].includes(q.status)&&!collectionHeld(s,u.tenant,q.receivableId)?q.invoiceUrl:null,bankSlipUrl:['open','overdue'].includes(q.status)&&!collectionHeld(s,u.tenant,q.receivableId)?q.bankSlipUrl:null,held:collectionHeld(s,u.tenant,q.receivableId),...(managerView?{paymentId:q.paymentId,error:q.error||null,netCents:q.netCents,feeCents:q.feeCents}:{} )}));
 return {charges,...(managerView?{connection:safeConnection(connectionFor(s,u.tenant)),payers:rows(s,'asaasPayers',u.tenant).map(({document,customerId,customers,...p})=>({...p,documentMasked:mask(document)}))}:{})};
}
