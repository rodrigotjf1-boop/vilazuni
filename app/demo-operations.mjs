import {randomUUID} from 'node:crypto';
import {usersInTenant,tenantSettings} from './tenants.mjs';
import {can} from './permissions.mjs';
import {localDay} from './residents.mjs';
import {createStay,changeStay} from './domain.mjs';
import {createFacility,createReservation,decideReservation,toggleFacility} from './facilities.mjs';
import {linkTourFacility} from './tour.mjs';
import {createTask,advanceTask,addTaskPhoto,checkTask} from './tasks.mjs';
import {createMaintenance,generateMaintenance} from './maintenance.mjs';
import {createMaterial,moveMaterial} from './materials.mjs';
import {createIncident,updateIncident} from './incidents.mjs';
import {createParcel,updateParcel} from './parcels.mjs';
import {createSupplier,createPurchase,addQuote,submitPurchase,decidePurchase,receivePurchase} from './purchases.mjs';

const DAY=86400000;
const dateAt=(now,offset=0)=>new Date(Date.parse(localDay(now)+'T12:00:00Z')+offset*DAY).toISOString().slice(0,10);
const reservedPhone=n=>'1202555'+String(100+n%100).padStart(4,'0');
const fictional=name=>name+' (fictício)';
const collections=['facilities','reservations','stays','tasks','maintenance','materials','incidents','parcels','suppliers','purchases','tourLinks'];
const fail=message=>{throw Object.assign(Error(message),{status:403});};

// Called only by the transactional full-demo orchestrator. These are ordinary domain
// records inside a separate demonstration tenant; no provider or network is invoked.
export function seedDemoOperations(db,user,ctx,now=Date.now()){
 const state=db.state,pack=ctx.pack||'vilazuni-completo-v1',actors=ctx.users||{},users=usersInTenant(db.users,user.tenant),houses=ctx.houses||[];
 if(tenantSettings(state,user.tenant).demoMode!==true)fail('Cadastros operacionais fictícios são permitidos somente no ambiente de demonstração.');
 if(user.role!=='sindico'||houses.length<14||houses.some(h=>h.tenant!==user.tenant))fail('A demonstração operacional exige gestão e quatorze casas do mesmo condomínio.');
 const worker=actors.caretaker,owner=actors.owners?.[0],buyer=actors.administrator;
 if(!worker||!owner||!buyer||[worker,owner,buyer].some(p=>p.tenant!==user.tenant||!p.active)||worker.role!=='zelador'||owner.role!=='proprietario'||buyer.id===user.id||!can(buyer,'purchases')||!can(buyer,'materials'))fail('Os perfis fictícios de zeladoria, proprietário e administração precisam estar preparados.');
 const existing=(state.demoOperationalSeeds||[]).find(r=>r.tenant===user.tenant&&r.pack===pack);
 const records=key=>(state[key]||[]).filter(r=>r.tenant===user.tenant&&r.demoPack===pack);
 const result=()=>({counts:Object.fromEntries(collections.map(key=>[key,records(key).length])),facilities:records('facilities'),materials:records('materials'),purchases:records('purchases'),tasks:records('tasks'),stays:records('stays'),maintenance:records('maintenance'),suppliers:records('suppliers'),incidents:records('incidents'),parcels:records('parcels'),reservations:records('reservations')});
 if(existing)return result();
 state.tasks??=[];state.stays??=[];state.audit??=[];
 const phone=ctx.phone||reservedPhone,portrait=ctx.portrait;
 const house=n=>{const h=houses.find(h=>Number(h.number)===n);if(!h)throw Error('Casa fictícia ausente: '+n);return h;};
 const mark=(collection,record,key)=>{const stored=state[collection].find(r=>r.id===record.id&&r.tenant===user.tenant);if(!stored)throw Error('Registro fictício não localizado: '+collection);stored.demoPack=pack;stored.demoKey='operations:'+key;return stored;};
 const facilitySpecs=[
  {key:'party',name:'Salão de festas',capacity:40,maxHours:6,rules:'Demonstração: reservar com antecedência, respeitar capacidade e silêncio após 22h.'},
  {key:'bbq',name:'Churrasqueira',capacity:16,maxHours:4,rules:'Demonstração: entregar bancada limpa, recolher resíduos e conferir extintor.'},
  {key:'pool',name:'Piscina',capacity:25,maxHours:2,rules:'Demonstração: menores acompanhados e sem vidro na área de lazer.'},
  {key:'games',name:'Salão de jogos',capacity:12,maxHours:3,rules:'Demonstração: preservar os equipamentos e guardar acessórios após o uso.'}
 ];
 const spaces={};for(const f of facilitySpecs){spaces[f.key]=mark('facilities',createFacility(state,user,{...f,name:fictional(f.name),opens:'08:00',closes:'22:00'},now),'facility:'+f.key);linkTourFacility(state,user,{pointId:f.key,facilityId:spaces[f.key].id,version:0,reason:'Vínculo ilustrativo do conjunto fictício completo'},now);mark('tourLinks',state.tourLinks.find(l=>l.tenant===user.tenant&&l.pointId===f.key),'tour:'+f.key);}
 const ownerHouse=houses.find(h=>owner.houses?.includes(h.id))||house(1);
 for(const [key,facility,offset,start,end,status,people] of [
  ['party-approved','party',2,'14:00','18:00','approved',18],
  ['bbq-pending','bbq',3,'11:00','14:00','pending',8],
  ['games-cancelled','games',4,'16:00','18:00','cancelled',6]
 ]){let r=createReservation(state,owner,{facilityId:spaces[facility].id,houseId:ownerHouse.id,start:dateAt(now,offset)+'T'+start,end:dateAt(now,offset)+'T'+end,people,acceptRules:true},now);mark('reservations',r,'reservation:'+key);if(status!=='pending')decideReservation(state,user,{id:r.id,version:r.version,status,reason:'Situação de exemplo para explorar o calendário de reservas'},now);}
 toggleFacility(state,user,{id:spaces.games.id,version:spaces.games.version,active:false,reason:'Interdição fictícia para manutenção da mesa de jogos'},now);

 const taskSpecs=[
  ['pool-today','Conferir água e filtro da piscina','Piscina',0,'doing'],
  ['lights-review','Revisar iluminação da entrada','Portaria',-2,'review'],
  ['garden-week','Cuidar dos jardins e vasos','Alameda central',3,'todo'],
  ['inventory-week','Conferir materiais do depósito','Depósito',6,'todo'],
  ['fire-month','Conferir vencimento dos extintores','Áreas comuns',20,'todo'],
  ['water-done','Inspecionar tampa da caixa d’água','Reservatório',-1,'done']
 ];
 for(const [key,title,area,offset,status] of taskSpecs){const t=mark('tasks',createTask(state,users,user,{title:fictional(title),area,description:'Execução fictícia para explorar atribuição, acompanhamento e revisão. Não representa serviço executado no condomínio real.',due:dateAt(now,offset),assigneeId:worker.id,publicSchedule:true},now),'task:'+key);if(status!=='todo'){advanceTask(state,worker,{id:t.id,version:t.version,status:'doing'},now);if(['review','done'].includes(status)){if(portrait)addTaskPhoto(state,worker,{id:t.id,version:t.version,data:portrait,caption:'Imagem ilustrativa da execução fictícia'},now);advanceTask(state,worker,{id:t.id,version:t.version,status:'review'},now);if(status==='done')advanceTask(state,user,{id:t.id,version:t.version,status:'done',reason:'Aprovação simulada para demonstrar o histórico da tarefa'},now);}}}
 const plans=[['daily','Limpeza diária da alameda',1,0,['Varrer o piso','Recolher os resíduos','Conferir lixeiras']],['weekly','Revisão semanal da bomba da piscina',7,-3,['Observar ruído','Conferir conexões','Registrar medição']],['monthly','Inspeção mensal de equipamentos',30,12,['Conferir extintores','Conferir sinalização','Verificar iluminação de emergência']]];
 for(const [key,title,intervalDays,offset,checklist] of plans){const plan=mark('maintenance',createMaintenance(state,users,user,{title:fictional(title),area:key==='daily'?'Alameda central':'Áreas comuns',description:'Plano preventivo fictício com checklist de conferência; ajuste as orientações antes de uso real.',intervalDays,nextDue:dateAt(now,offset),checklist,assigneeId:worker.id},now),'maintenance:'+key);if(key==='daily'){const generated=generateMaintenance(state,users,user,{id:plan.id,version:plan.version},now),task=mark('tasks',state.tasks.find(t=>t.id===generated.taskId),'task:daily-maintenance');task.publicSchedule=true;checkTask(state,worker,{id:task.id,version:task.version,itemId:task.checklist[0].id,done:true},now);}}

 const stockSpecs=[['chlorine','Cloro granulado','kg',5,12],['detergent','Detergente neutro','litro',4,2],['bags','Sacos para coleta','pacote',3,8],['lamps','Lâmpada LED','unidade',4,6],['gloves','Luvas de proteção','par',3,10]];
 const stock={};for(const [key,name,unit,minimum,quantity] of stockSpecs){const m=mark('materials',createMaterial(state,user,{name:fictional(name),unit,minimum,location:'Depósito demonstrativo'}),'material:'+key);stock[key]=m;moveMaterial(state,user,{id:m.id,version:m.version,kind:'entry',quantity,reason:'Saldo fictício inicial para explorar o controle de estoque'},now);}
 const poolTask=records('tasks').find(t=>t.demoKey==='operations:task:pool-today');moveMaterial(state,worker,{id:stock.chlorine.id,version:stock.chlorine.version,kind:'consume',quantity:1,taskId:poolTask.id,taskVersion:poolTask.version,reason:'Consumo fictício vinculado à conferência da piscina'},now);

 const incidentSpecs=[['gate-open','Ruído no portão da entrada','Portaria','Relato fictício para testar abertura e comentários da gestão.','open'],['light-doing','Luminária apagada na alameda','Alameda central','Ocorrência fictícia em apuração com responsável definido.','doing'],['water-resolved','Torneira com gotejamento','Área de serviço','Histórico fictício de atendimento concluído para consulta.','resolved']];
 for(const [key,title,area,description,status] of incidentSpecs){const r=mark('incidents',createIncident(state,owner,{title:fictional(title),area,description,houseId:ownerHouse.id},now),'incident:'+key);if(status!=='open'){updateIncident(state,users,user,{id:r.id,version:r.version,action:'assign',assigneeId:user.id,message:'Gestão fictícia designada para conferência'},now);updateIncident(state,users,user,{id:r.id,version:r.version,action:'status',status:'doing',message:'Atendimento fictício iniciado'},now);if(status==='resolved')updateIncident(state,users,user,{id:r.id,version:r.version,action:'status',status:'resolved',message:'Atendimento fictício concluído e registrado'},now);}else updateIncident(state,users,user,{id:r.id,version:r.version,action:'comment',message:'Recebemos o relato fictício e vamos conferir o equipamento.'},now);}
 const parcelOperator=actors.portaria||user;for(const [key,description,status] of [['box-received','Caixa de livros — entrega fictícia','received'],['envelope-collected','Envelope de documentos — entrega fictícia','collected'],['package-cancelled','Pacote com cadastro duplicado — exemplo fictício','cancelled']]){const p=mark('parcels',createParcel(state,users,parcelOperator,{houseId:ownerHouse.id,recipientUserId:owner.id,description,location:'Armário demonstrativo da portaria'},now),'parcel:'+key);if(status!=='received')updateParcel(state,parcelOperator,{id:p.id,version:p.version,status,reason:'Conferência fictícia do fluxo de recebimento e retirada',pickedUpBy:status==='collected'?owner.name:undefined},now);}

 const vendors=[];for(const [index,name,category] of [[0,'LimpaMar Suprimentos','Limpeza'],[1,'CasaVerde Distribuidora','Materiais e manutenção'],[2,'Luz da Vila Serviços','Serviços elétricos']])vendors.push(mark('suppliers',createSupplier(state,buyer,{name:fictional(name),category,contact:'WhatsApp fictício +'+phone(60+index)+' · fornecedor'+(index+1)+'@example.invalid'},now),'supplier:'+index));
 const buyingSpecs=[['bags-draft','Reposição de sacos de coleta','bags',4,'draft',6500],['lamp-review','Reposição de lâmpadas para a alameda','lamps',8,'review',22400],['chlorine-received','Compra demonstrativa de cloro','chlorine',5,'received',18500],['gloves-approved','Compra demonstrativa de luvas','gloves',6,'approved',7200]];
 for(const [key,title,materialKey,quantity,status,totalCents] of buyingSpecs){const material=stock[materialKey],p=mark('purchases',createPurchase(state,buyer,{title:fictional(title),description:'Compra fictícia para explorar comparação de propostas, aprovação por outra pessoa e entrada no estoque.',quantity,materialId:material.id,taskId:status==='draft'?poolTask.id:undefined},now),'purchase:'+key);addQuote(state,buyer,{id:p.id,version:p.version,supplierId:vendors[0].id,totalCents,validUntil:dateAt(now,30),deliveryDays:2,terms:'Orçamento fictício: preço inclui frete, sem contratação ou pagamento real.'},now);if(status!=='draft'){addQuote(state,buyer,{id:p.id,version:p.version,supplierId:vendors[1].id,totalCents:totalCents+1500,validUntil:dateAt(now,30),deliveryDays:3,terms:'Segunda cotação fictícia para comparação.'},now);submitPurchase(state,buyer,{id:p.id,version:p.version,reason:'Reposição fictícia justificada pelo planejamento demonstrativo'},now);if(['approved','received'].includes(status)){decidePurchase(state,user,{id:p.id,version:p.version,status:'approved',quoteId:p.quotes[0].id,reason:'Conferência fictícia de preço e prazo por pessoa diferente da compradora'},now);if(status==='received')receivePurchase(state,buyer,{id:p.id,version:p.version,materialVersion:material.version,reference:'DEMO-RECEBIMENTO-'+key.toUpperCase(),reason:'Recebimento fictício integral, sem documento fiscal ou compra real'},now);}}}

 const staySpecs=[
  ['daily-current',3,'Beatriz Monteiro','daily',-1,1,'approved','Direta'],
  ['seasonal-current',4,'Rafael Azevedo','seasonal',-2,3,'approved','Booking'],
  ['seasonal-scheduled',6,'Bianca Oliveira','seasonal',5,8,'approved','Airbnb'],
  ['daily-pending',7,'Marcelo Tavares','daily',1,4,'pending','Direta'],
  ['seasonal-cancelled',9,'Laura Fernandes','seasonal',4,6,'cancelled','Outra']
 ];
 for(const [index,[key,number,name,rentalKind,startOffset,endOffset,status,source]] of staySpecs.entries()){const responsible=fictional(name),stay=mark('stays',createStay(state,user,{houseId:house(number).id,responsible,contact:'Contato fictício reservado para exploração da estadia',phone:phone(30+index),whatsapp:phone(30+index),email:'hospede'+number+'@example.invalid',rentalKind,people:[responsible,fictional('Acompanhante '+name.split(' ')[0])],vehicles:['DEMO-'+String(number).padStart(2,'0')],source,start:dateAt(now,startOffset)+'T15:00',end:dateAt(now,endOffset)+'T11:00',...(portrait?{photo:portrait}:{})},now).stay,'stay:'+key);if(status!=='pending')changeStay(state,user,stay.id,status,'Situação fictícia do período para explorar autorizações',now);}
 state.demoOperationalSeeds??=[];state.demoOperationalSeeds.push({id:randomUUID(),tenant:user.tenant,pack,createdAt:new Date(now).toISOString()});
 return result();
}
