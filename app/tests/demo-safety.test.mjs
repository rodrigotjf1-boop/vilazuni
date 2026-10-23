import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {isDemoTenant,requireLiveTenant} from '../demo-policy.mjs';
import {createAsaasService} from '../asaas-service.mjs';
import {configureAutomation,authenticateAutomation,queueAutomationNotice,claimAutomationMessage,prepareAutomationReminders} from '../automation.mjs';
import {saveChannel,scheduledChannels,telegramWebhook,claimChannelMessage,deliverTelegram,prepareDaily} from '../channels.mjs';
import {saveDevice,physicalView,queueGate,claimGate,deliverGate,cameraSnapshot,plateEvent} from '../physical.mjs';
import {saveSubscription,sendPush} from '../push.mjs';

const now=Date.parse('2026-10-23T12:00:00-03:00'),user={id:'demo-syndic',tenant:'demo',name:'Síndico fictício',role:'sindico',active:true},live={...user,id:'real-syndic',tenant:'live'};
const state=()=>({houses:[],stays:[],audit:[],tenants:[{id:'demo',tenant:'demo',name:'Demonstração',demoMode:true},{id:'live',tenant:'live',name:'Operação',demoMode:false}]});
const denied=()=>error=>error.status===409&&error.code==='DEMO_EXTERNAL_DISABLED';

test('demonstração é reconhecida apenas pelo cadastro do servidor, sem afetar outro condomínio',()=>{
 const s=state();assert.equal(isDemoTenant(s,'demo'),true);assert.equal(isDemoTenant(s,'live'),false);assert.equal(isDemoTenant(s,'inexistente'),false);assert.throws(()=>requireLiveTenant(s,'demo'),denied());assert.doesNotThrow(()=>requireLiveTenant(s,'live'));assert.equal(isDemoTenant({...s,demoMode:true},'live'),false);
});

test('Asaas recusa operações e retornos da demonstração antes de construir cliente; cron ignora conexões fictícias',async()=>{
 let db={users:[],state:state()},calls=0,result;db.state.asaasConnections=[{id:'demo-connection',tenant:'demo',enabled:true}];db.state.asaasCharges=[{id:'demo-charge',tenant:'demo',connectionId:'demo-connection',status:'open'}];db.state.asaasWebhookEvents=[{id:'demo-event',tenant:'demo',connectionId:'demo-connection',status:'pending'}];
 const service=createAsaasService({read:()=>db,save:async next=>{db=next;},run:fn=>fn(),authorize:()=>({user}),body:async()=>({version:0,environment:'production',apiKey:'synthetic-key',confirm:true}),send:(res,status,body)=>{result={status,body};},users:()=>[],now:()=>now,origin:()=> 'https://example.invalid',transport:()=>{},clientFactory:()=>{calls++;throw Error('O cliente externo não deve ser construído.');}});
 for(const route of ['/asaas/connect','/asaas/check','/asaas/webhook-configure','/asaas/issue','/asaas/reconcile','/asaas/cancel','/reminders','/payers/save','/whatsapp-consent','/preview']){await service.perform({url:'/api/payments'+route,method:'POST',headers:{}},{});assert.equal(result.status,409,route);}
 await service.perform({url:'/api/payments/asaas/webhook/demo-connection',method:'POST',headers:{}},{});assert.equal(result.status,409);await service.tick();assert.equal(calls,0);assert.equal(db.state.asaasWebhookEvents[0].status,'pending');
 await service.perform({url:'/api/payments',method:'GET',headers:{}},{});assert.equal(result.status,200,'Consulta local continua disponível.');
});

test('WhatsApp e Telegram não habilitam nem retiram mensagens demonstrativas; canais reais mantêm autorização normal',async()=>{
 const s=state(),input={version:0,groupJid:'120363000000000000@g.us',enabled:true};assert.throws(()=>configureAutomation(s,user,input),denied());configureAutomation(s,user,{...input,enabled:false});assert.equal(s.automationConnections[0].enabled,false);
 const token='a'.repeat(64);s.automationConnections[0].enabled=true;s.automationConnections[0].tokenHash=createHash('sha256').update(token).digest('hex');assert.throws(()=>authenticateAutomation(s,token),/não autenticado/);assert.throws(()=>claimAutomationMessage(s,s.automationConnections[0],[],now),denied());assert.throws(()=>queueAutomationNotice(s,user,{id:'demo-notice',version:1,confirm:true},now),denied());s.asaasReminders=[{id:'demo-reminder',tenant:'demo',on:'2026-10-23'}];assert.equal(prepareAutomationReminders(s,[],now),0);
 const channel={name:'Grupo fictício',chatId:'-100000000001',botName:'@vilazunidemo',dailyAt:'09:00',reviewed:true,reason:'Grupo ilustrativo sem envio',active:false,scheduled:false};const c=saveChannel(s,user,channel,now);assert.equal(c.active,false);assert.throws(()=>saveChannel(s,user,{...channel,version:c.version,active:true}),denied());assert.throws(()=>saveChannel(s,user,{...channel,version:c.version,scheduled:true}),denied());
 // Even imported/stale enabled records cannot reach the delivery path.
 Object.assign(s.channels[0],{active:true,scheduled:true});s.channelOutbox=[{id:'message',tenant:'demo',channelId:c.id,status:'pending'}];assert.deepEqual(scheduledChannels(s,now),[]);assert.equal(prepareDaily(s,c,now),null);assert.throws(()=>claimChannelMessage(s,'demo','message',now),denied());assert.equal(telegramWebhook(s,{update_id:1,message:{chat:{id:Number(channel.chatId)},text:'@vilazunidemo piscina'}},'secret',{TELEGRAM_WEBHOOK_SECRET:'secret'},now).ignored,true);
 let sent=0;assert.equal((await deliverTelegram({demoMode:true},{TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'synthetic'},async()=>{sent++;})).status,'disabled');assert.equal(sent,0);
 const actual=saveChannel(s,live,{...channel,chatId:'-100000000002',active:true,scheduled:true},now);assert.deepEqual(scheduledChannels(s,now).map(c=>c.id),[actual.id]);
});

test('equipamentos demonstrativos simulam localmente e não usam relés, placas ou câmeras externas',async()=>{
 const s=state();s.stays.push({id:'stay',tenant:'demo',status:'approved',houseId:'c01',start:new Date(now-60000).toISOString(),end:new Date(now+60000).toISOString()});const input={name:'Portão fictício',kind:'gate',mode:'simulator',reason:'Simulação fictícia'};
 assert.throws(()=>saveDevice(s,user,{...input,mode:'relay',adapterKey:'REAL'}),denied());const device=saveDevice(s,user,input,now);assert.equal(device.demoMode,true);const c=queueGate(s,user,{deviceId:device.id,stayId:'stay',confirmed:true,requestId:'demonstration-request-123',reason:'Conferência fictícia'},now),prepared=claimGate(s,user,{id:c.id},now);let sent=0;const fetcher=async()=>{sent++;throw Error('Nenhum equipamento deve ser acionado.');};assert.equal((await deliverGate(prepared,{ACCESS_REAL_URL:'https://adapter.invalid',ACCESS_REAL_SECRET:'synthetic'},fetcher)).status,'simulated');
 const camera=saveDevice(s,user,{...input,kind:'camera'},now);assert.equal((await cameraSnapshot(camera,{},fetcher)).mime,'image/png');const forged={id:'forged',tenant:'demo',name:'Importado',kind:'camera',mode:'relay',adapterKey:'REAL',active:true};s.accessDevices.push(forged);const projected=physicalView(s,user).devices.find(d=>d.id==='forged');assert.equal(projected.demoMode,true);await assert.rejects(()=>cameraSnapshot(projected,{ACCESS_REAL_SNAPSHOT_URL:'https://camera.invalid',ACCESS_REAL_CAMERA_TOKEN:'synthetic'},fetcher),/Demonstração/);assert.throws(()=>queueGate(s,user,{deviceId:'forged'},now),denied());
 const raw=JSON.stringify({timestamp:now,nonce:'demo-plate-event-123',plate:'DEMO01'}),secret='synthetic',signature=createHmac('sha256',secret).update(raw).digest('hex');assert.throws(()=>plateEvent(s,forged.id,raw,signature,{ACCESS_REAL_EVENT_SECRET:secret},now),denied());assert.equal(sent,0);assert.doesNotThrow(()=>saveDevice(s,live,{...input,mode:'relay',adapterKey:'REAL'},now));
});

test('push demonstrativo não registra destino externo nem usa VAPID global; operação real continua disponível',async()=>{
 const s=state(),subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{auth:Buffer.alloc(16).toString('base64url'),p256dh:Buffer.alloc(65).toString('base64url')}};assert.throws(()=>saveSubscription(s,user,{subscription},now),denied());assert.equal(s.pushSubscriptions,undefined);
 const env={VAPID_PUBLIC_KEY:'synthetic',VAPID_PRIVATE_KEY:'synthetic',VAPID_SUBJECT:'mailto:synthetic@example.invalid'};let sent=0;const sender=async()=>{sent++;};assert.equal((await sendPush(subscription,env,sender,{state:s,tenant:'demo'})).status,'disabled');assert.equal((await sendPush({...subscription,demoMode:true},env,sender)).status,'disabled');assert.equal(sent,0);saveSubscription(s,live,{subscription},now);assert.equal((await sendPush(subscription,env,sender,{state:s,tenant:'live'})).status,'sent');assert.equal(sent,1);
});
