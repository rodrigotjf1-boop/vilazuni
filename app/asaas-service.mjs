import {createAsaasClient} from './asaas-client.mjs';
import * as A from './asaas.mjs';
import {can,housingUser} from './permissions.mjs';
import {collectionHeld,payerLink} from './finance-collection-policy.mjs';
import {validBinding} from './access.mjs';
import {tenantSettings} from './tenants.mjs';

const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const controller=u=>{if(!can(u,'financeClose'))fail('Controle financeiro necessário.');};
// Network requests run outside the persistence queue. Emission is durably claimed before POST.
export function createAsaasService({read,save,run,authorize,body,send,users,vault,now,origin,transport,clientFactory=createAsaasClient}){
 const client=(s,tenant,id)=>clientFactory(A.asaasCredentials(s,tenant,vault,id));
 const change=async(u,fn)=>{const next=structuredClone(read()),result=fn(next.state,next);await save(next,u);return result;};
 async function prepare(req,fn){return run(async()=>{const session=authorize(req);return fn(session.user,read(),session);});}
 function unchanged(req,owner){const s=authorize(req);if(s.user.id!==owner.id||s.user.tenant!==owner.tenant||s.user.accessVersion!==owner.accessVersion)fail('O acesso mudou. Entre novamente.',401);return s.user;}
 async function perform(req,res){let claimed;
  try{
   const route=new URL(req.url,'http://localhost').pathname.replace('/api/payments','');transport(req,route.startsWith('/asaas/webhook/')&&req.method==='POST');
   if(route.startsWith('/asaas/webhook/')&&req.method==='POST'){
    const input=await body(req,512*1024),id=route.slice('/asaas/webhook/'.length);
    const result=await run(()=>change({id:'asaas-service'},s=>A.ingestAsaasWebhook(s,id,req.headers['asaas-access-token'],input,vault,now())));return send(res,200,result);
   }
   if(req.method==='GET'){
    const result=await prepare(req,(u,db)=>{if(route==='')return A.asaasView(db.state,u);if(route==='/settings'){controller(u);return {...(u.role==='sindico'?A.asaasSettings(db.state,u,{origin:origin(req),vault}):{}),people:users(db).filter(p=>p.tenant===u.tenant&&housingUser(p)&&validBinding(db.state,p,now())).map(({id,name,email})=>({id,name,email}))};}fail('Ação não encontrada.',404);});return send(res,200,result);
   }
   if(req.method!=='POST')fail('Método não permitido.',405);
   const input=await body(req);
   if(['/payers/save','/preview','/reminders','/whatsapp-consent'].includes(route)){
    const result=await prepare(req,(u,db)=>route==='/preview'?A.previewAsaasCharge(db.state,users(db),u,input,now()):change(u,s=>route==='/reminders'?A.setAsaasReminders(s,u,input):route==='/whatsapp-consent'?A.setPayerWhatsappConsent(s,u,input,now()):A.saveAsaasPayer(s,users(db),u,input,now())));return send(res,200,result);
   }
   if(route==='/asaas/connect'){
    const owner=await prepare(req,u=>{controller(u);if(u.role!=='sindico')fail('Somente o síndico conecta a conta.');return structuredClone(u);});
    const remote=clientFactory({environment:input.environment,apiKey:input.apiKey}),account=await remote.account();
    const result=await run(()=>{const u=unchanged(req,owner);return change(u,s=>({id:A.connectAsaas(s,u,input,account,vault,now())}));});return send(res,200,result);
   }
   if(['/asaas/check','/asaas/webhook-configure'].includes(route)){
    const p=await prepare(req,(u,db)=>{controller(u);if(u.role!=='sindico')fail('Somente o síndico configura a conexão.');const c=A.connectionFor(db.state,u.tenant);if(!c)fail('Conecte a conta primeiro.',409);return {owner:structuredClone(u),connection:structuredClone(c),remote:client(db.state,u.tenant),token:route.endsWith('configure')?A.asaasWebhookToken(db.state,u.tenant,vault):null};});
    const value=route.endsWith('check')?await p.remote.account():await p.remote.webhook({url:origin(req)+'/api/payments/asaas/webhook/'+p.connection.id,email:p.owner.email,token:p.token});
    const result=await run(()=>{const u=unchanged(req,p.owner),c=A.connectionFor(read().state,u.tenant);if(c?.version!==p.connection.version)fail('A conexão mudou. Atualize e confira.',409);return change(u,s=>route.endsWith('check')?{status:A.refreshAsaasStatus(s,u,value,now())}:(A.webhookConfigured(s,u,c.id,value,now()),{ok:true}));});return send(res,200,result);
   }
   if(route==='/asaas/issue'){
    const p=await prepare(req,(u,db)=>change(u,s=>{const q=A.claimAsaasCharge(s,users(db),u,input,now());return {q,payer:A.payerForCharge(s,q),remote:client(s,u.tenant,q.connectionId),owner:structuredClone(u)};}));claimed=p;
    let customerId=p.payer.customerId;
    if(!customerId){
     const reference='vilazuni-payer:'+p.payer.id,result=await p.remote.customers(reference),matches=(result.data||[]).filter(c=>c.externalReference===reference&&c.cpfCnpj?.replace(/\D/g,'')===p.payer.document);
     if(result.hasMore||matches.length>1)fail('Clientes duplicados no provedor. Confira antes de emitir.',409);
     const customer=matches[0]||await p.remote.createCustomer({name:p.payer.name,email:p.payer.email,cpfCnpj:p.payer.document,...(p.payer.mobilePhone?{mobilePhone:p.payer.mobilePhone}:{}),externalReference:reference,notificationDisabled:true});customerId=customer.id;
    }
    // All provider channels remain disabled. Private reminders are prepared inside Vilazuni.
    await p.remote.updateCustomer(customerId,{notificationDisabled:true});
    await run(()=>{const u=unchanged(req,p.owner);return change(u,s=>{const q=A.asaasOperation(s,u,p.q.id),r=(s.financialReceivables||[]).find(r=>r.tenant===u.tenant&&r.id===q.receivableId);if(A.connectionFor(s,u.tenant)?.id!==q.connectionId||r?.version!==q.receivableVersion||collectionHeld(s,u.tenant,q.receivableId)||payerLink(s,u.tenant,q.receivableId)?.payerUserId!==q.payerUserId||!users(read()).some(p=>p.id===q.payerUserId&&p.tenant===u.tenant&&validBinding(s,p,now())))fail('Os dados de cobrança mudaram. Confira antes de emitir.',409);A.saveAsaasCustomer(s,q,customerId);q.stage='dispatching';});});
    const payment=await p.remote.createPayment({customer:customerId,billingType:p.q.billingType,value:p.q.amountCents/100,dueDate:p.q.dueOn,description:p.q.description,externalReference:p.q.externalReference,fine:{value:0},interest:{value:0},discount:{value:0,type:'FIXED'}});
    const result=await run(()=>change(p.owner,s=>{A.finishAsaasCreation(s,p.owner,p.q.id,payment,now());return A.reconcileAsaasPayment(s,p.q.connectionId,payment,now());}));claimed=null;
    await prepare(req,u=>{if(u.id!==p.owner.id||u.tenant!==p.owner.tenant)fail('Entre novamente para consultar a emissão.',401);});return send(res,200,result);
   }
   if(['/asaas/reconcile','/asaas/cancel'].includes(route)){
    const p=await prepare(req,(u,db)=>{if(!can(u,'finance'))fail('Operação financeira necessária.');const q=structuredClone(A.asaasOperation(db.state,u,input.id));if(q.version!==input.version)fail('A cobrança mudou. Atualize.',409);if(route.endsWith('cancel')&&input.confirm!==true)fail('Confirme o cancelamento.',400);return {q,owner:structuredClone(u),remote:client(db.state,u.tenant,q.connectionId)};});
    let payment;if(p.q.paymentId)payment=await p.remote.payment(p.q.paymentId);else {const result=await p.remote.payments(p.q.externalReference),matches=(result.data||[]).filter(x=>x.externalReference===p.q.externalReference);if(result.hasMore||matches.length!==1)fail(matches.length?'Há resultados duplicados no provedor. Confira no Asaas.':'Ainda não há confirmação no provedor. A emissão não será repetida automaticamente.',409);payment=matches[0];}
    if(route.endsWith('cancel')){
     if(payment.externalReference!==p.q.externalReference||A.paymentCents(payment.value)!==p.q.amountCents||!['PENDING','OVERDUE'].includes(payment.status)||p.q.receiptEntryId)fail('Somente cobrança não recebida pode ser cancelada. Confira no Asaas.',409);
     await run(()=>{unchanged(req,p.owner);const q=A.asaasOperation(read().state,p.owner,p.q.id);if(q.version!==p.q.version)fail('A cobrança mudou. Atualize.',409);});
     const removed=await p.remote.cancel(payment.id);if(removed.deleted!==true)fail('O provedor não confirmou o cancelamento. Consulte a situação.',409);payment={...payment,deleted:true};
    }
    const result=await run(()=>change(p.owner,s=>{const q=A.asaasOperation(s,p.owner,p.q.id);if(!q.paymentId)A.finishAsaasCreation(s,p.owner,q.id,payment,now());return A.reconcileAsaasPayment(s,p.q.connectionId,payment,now());}));return send(res,200,result);
   }
   fail('Ação não encontrada.',404);
  }catch(error){
   if(claimed)await run(()=>change(claimed.owner,s=>{const q=A.asaasOperation(s,claimed.owner,claimed.q.id);if(q.status==='creating')A.failAsaasCreation(s,claimed.owner,q.id,{uncertain:q.stage==='dispatching'?(error.uncertain??true):false});})).catch(()=>{});
   return send(res,error.status||502,{error:error.status?error.message:'Não foi possível confirmar com o Asaas. Atualize e consulte a situação da operação.'});
  }
 }
 let ticking=false;
 async function tick(){if(ticking)return;ticking=true;try{
  await run(async()=>{const db=read(),next=structuredClone(db);if(A.prepareAsaasReminders(next.state,users(db),now()).length)await save(next,{id:'asaas-service'});});
  const p=await run(()=>{const db=read(),event=(db.state.asaasWebhookEvents||[]).find(e=>e.status==='pending'&&(!e.retryAt||e.retryAt<=now())),q=event?null:(db.state.asaasCharges||[]).find(q=>['creating','uncertain','open','overdue'].includes(q.status)&&(!q.checkedAt||Date.parse(q.checkedAt)+15*60000<=now())),c=(db.state.asaasConnections||[]).find(c=>c.id===(event?.connectionId||q?.connectionId));if(!c||tenantSettings(db.state,c.tenant).status==='closed')return null;return {event:event&&structuredClone(event),q:q&&structuredClone(q),c:structuredClone(c),remote:client(db.state,c.tenant,c.id)};});
  if(!p)return;let payment;
  try{
   if(p.event||p.q.paymentId)payment=await p.remote.payment(p.event?.paymentId||p.q.paymentId);else {const response=await p.remote.payments(p.q.externalReference),matches=(response.data||[]).filter(q=>q.externalReference===p.q.externalReference);if(response.hasMore||matches.length!==1)throw Error('Emissão não confirmada.');payment=matches[0];}
   await run(()=>change({id:'asaas-service',tenant:p.c.tenant},s=>{A.reconcileAsaasPayment(s,p.c.id,payment,now());if(p.event){const e=s.asaasWebhookEvents.find(e=>e.id===p.event.id);e.status='processed';e.processedAt=new Date(now()).toISOString();}}));
  }catch(error){
   await run(()=>change({id:'asaas-service',tenant:p.c.tenant},s=>{if(error.status===409&&payment){const q=(s.asaasCharges||[]).find(q=>q.tenant===p.c.tenant&&q.connectionId===p.c.id&&(q.paymentId===payment.id||q.externalReference===payment.externalReference));if(q){q.status='review';q.error='Dados, saldo ou período financeiro divergentes. Confira o recebimento no Asaas e o fechamento antes de conciliar.';q.version++;}}if(p.event){const e=s.asaasWebhookEvents.find(e=>e.id===p.event.id);e.attempts++;e.retryAt=now()+Math.min(60,e.attempts*5)*60000;if(e.attempts>=5)e.status='review';}else {const q=s.asaasCharges.find(q=>q.id===p.q.id);q.checkedAt=new Date(now()).toISOString();q.error||='A consulta requer conferência no Asaas. Nenhuma emissão foi repetida.';}}));
  }
 }finally{ticking=false;}}
 return {perform,tick};
}
