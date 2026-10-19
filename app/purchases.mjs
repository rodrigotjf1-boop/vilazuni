import {randomUUID} from 'node:crypto';
import {can} from './permissions.mjs';
import {moveMaterial} from './materials.mjs';
import {localDay} from './residents.mjs';

const procurement = user => can(user,'purchases');
export const canReadPurchases = user => procurement(user) || can(user,'purchaseApproval');
function text(value,label,max=160,min=3){
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error(`${label}: use entre ${min} e ${max} caracteres.`);
 return value.trim();
}
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00Z'))||new Date(value+'T12:00Z').toISOString().slice(0,10)!==value)throw Error('Informe uma data válida.');
 return value;
}
function quantity(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1000000||Math.abs(value*1000-Math.round(value*1000))>0.000001)throw Error('Quantidade positiva, até 1000000, com até três casas decimais.');
 return Math.round(value*1000)/1000;
}
export function latestQuotes(purchase){return [...new Map(purchase.quotes.map(q=>[q.supplierId,q])).values()];}
export function visibleSuppliers(state,user){
 if(!canReadPurchases(user))return [];
 return (state.suppliers||[]).filter(s=>s.tenant===user.tenant).map(s=>procurement(user)?structuredClone(s):{id:s.id,name:s.name,category:s.category,active:s.active});
}
export function visiblePurchases(state,user){return canReadPurchases(user)?structuredClone((state.purchases||[]).filter(p=>p.tenant===user.tenant)):[];}
export function createSupplier(state,user,input,now=Date.now()){
 if(!procurement(user))throw Error('Cadastro de fornecedores exige acesso a compras.');
 const name=text(input.name,'Nome'),category=text(input.category,'Categoria'),contact=text(input.contact,'Contato',200);
 if((state.suppliers||[]).some(s=>s.tenant===user.tenant&&s.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw Error('Fornecedor já cadastrado.');
 const supplier={id:randomUUID(),tenant:user.tenant,name,category,contact,active:true,version:1,history:[{at:new Date(now).toISOString(),actor:user.name,action:'Fornecedor cadastrado'}]};
 state.suppliers??=[];state.suppliers.push(supplier);return structuredClone(supplier);
}
export function updateSupplier(state,user,input,now=Date.now()){
 if(!procurement(user))throw Error('Alteração de fornecedor exige acesso a compras.');
 const s=(state.suppliers||[]).find(s=>s.id===input.id&&s.tenant===user.tenant);if(!s)throw Error('Fornecedor indisponível.');
 if(!Number.isInteger(input.version)||input.version!==s.version)throw Error('O fornecedor mudou. Atualize antes de continuar.');
 const name=text(input.name,'Nome'),category=text(input.category,'Categoria'),contact=text(input.contact,'Contato',200),reason=text(input.reason,'Motivo',500);
 if(state.suppliers.some(other=>other.id!==s.id&&other.tenant===user.tenant&&other.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))throw Error('Fornecedor já cadastrado.');
 s.history.push({at:new Date(now).toISOString(),actor:user.name,action:'Cadastro atualizado · '+reason,before:{name:s.name,category:s.category,contact:s.contact}});
 Object.assign(s,{name,category,contact,version:s.version+1});return structuredClone(s);
}
export function toggleSupplier(state,user,input,now=Date.now()){
 if(!procurement(user))throw Error('Alteração de fornecedor exige acesso a compras.');
 const s=(state.suppliers||[]).find(s=>s.id===input.id&&s.tenant===user.tenant);
 if(!s)throw Error('Fornecedor indisponível.');
 if(!Number.isInteger(input.version)||input.version!==s.version)throw Error('O fornecedor mudou. Atualize antes de continuar.');
 const reason=text(input.reason,'Motivo',500);
 if(typeof input.active!=='boolean'||input.active===s.active)throw Error('Alteração inválida.');
 s.active=input.active;s.version++;s.history.push({at:new Date(now).toISOString(),actor:user.name,action:(s.active?'Fornecedor reativado':'Fornecedor inativado')+' · '+reason});
 return structuredClone(s);
}
function record(p,user,action,reason,now){p.version++;p.history.push({at:new Date(now).toISOString(),actorId:user.id,actor:user.name,action,reason});}
function editable(state,user,input){
 if(!canReadPurchases(user))throw Error('Compras indisponíveis para este perfil.');
 const p=(state.purchases||[]).find(p=>p.id===input.id&&p.tenant===user.tenant);
 if(!p)throw Error('Compra indisponível.');
 if(!Number.isInteger(input.version)||input.version!==p.version)throw Error('A compra mudou. Atualize antes de continuar.');
 return p;
}
export function createPurchase(state,user,input,now=Date.now()){
 if(!procurement(user))throw Error('Preparação de compra exige acesso a compras.');
 const title=text(input.title,'Título'),description=text(input.description,'Especificação',1500),count=quantity(input.quantity);
 let material=null,unit=input.materialId?null:text(input.unit,'Unidade',30,2);
 if(input.materialId){material=(state.materials||[]).find(m=>m.id===input.materialId&&m.tenant===user.tenant);if(!material||!can(user,'materials'))throw Error('Selecione um material autorizado.');unit=material.unit;}
 let task=null;if(input.taskId){task=(state.tasks||[]).find(t=>t.id===input.taskId&&t.tenant===user.tenant&&can(user,'tasks')&&!['done','cancelled'].includes(t.status));if(!task)throw Error('Selecione uma tarefa aberta autorizada.');}
 const p={id:randomUUID(),tenant:user.tenant,title,description,quantity:count,unit,materialId:material?.id||null,materialName:material?.name||null,taskId:task?.id||null,taskTitle:task?.title||null,createdBy:user.id,createdByName:user.name,status:'draft',quotes:[],version:0,history:[]};
 record(p,user,'Compra preparada',description,now);state.purchases??=[];state.purchases.push(p);return structuredClone(p);
}
export function addQuote(state,user,input,now=Date.now()){
 const p=editable(state,user,input);if(!procurement(user)||p.status!=='draft')throw Error('Orçamentos podem ser registrados somente no rascunho.');
 const supplier=(state.suppliers||[]).find(s=>s.id===input.supplierId&&s.tenant===user.tenant&&s.active);if(!supplier)throw Error('Selecione um fornecedor ativo deste condomínio.');
 if(!Number.isSafeInteger(input.totalCents)||input.totalCents<1||input.totalCents>100000000)throw Error('Informe valor total em centavos, entre R$ 0,01 e R$ 1.000.000,00.');
 const validUntil=date(input.validUntil);if(validUntil<localDay(now))throw Error('O orçamento já está vencido.');
 if(!Number.isInteger(input.deliveryDays)||input.deliveryDays<0||input.deliveryDays>365)throw Error('Prazo de entrega de 0 a 365 dias.');
 if(p.quotes.length>=30)throw Error('Limite de 30 versões de orçamento por compra.');
 const quote={id:randomUUID(),supplierId:supplier.id,supplierName:supplier.name,totalCents:input.totalCents,validUntil,deliveryDays:input.deliveryDays,terms:text(input.terms,'Condições / referência',1000),createdBy:user.id,createdAt:new Date(now).toISOString()};
 p.quotes.push(quote);record(p,user,'Orçamento registrado: '+supplier.name,quote.terms,now);return structuredClone(p);
}
export function submitPurchase(state,user,input,now=Date.now()){
 const p=editable(state,user,input);if(!procurement(user)||p.status!=='draft')throw Error('Somente rascunhos podem seguir para análise.');
 if(!latestQuotes(p).some(q=>q.validUntil>=localDay(now)&&state.suppliers.some(s=>s.id===q.supplierId&&s.tenant===user.tenant&&s.active)))throw Error('Registre um orçamento válido de fornecedor ativo.');
 const reason=text(input.reason,'Justificativa',500);p.status='review';record(p,user,'Compra enviada para aprovação',reason,now);return structuredClone(p);
}
export function decidePurchase(state,user,input,now=Date.now()){
 const p=editable(state,user,input),reason=text(input.reason,'Justificativa',500);
 if(input.status==='approved'){
  if(!can(user,'purchaseApproval')||p.status!=='review')throw Error('Aprovação não permitida.');
  const quote=latestQuotes(p).find(q=>q.id===input.quoteId);if(!quote||quote.validUntil<localDay(now)||!state.suppliers.some(s=>s.id===quote.supplierId&&s.tenant===user.tenant&&s.active))throw Error('Selecione orçamento atual e válido de fornecedor ativo.');
  if(user.id===p.createdBy||user.id===quote.createdBy)throw Error('A aprovação exige outra pessoa, diferente de quem preparou a compra e registrou o orçamento escolhido.');
  if(user.role!=='sindico'&&(!Number.isSafeInteger(user.purchaseLimitCents)||quote.totalCents>user.purchaseLimitCents))throw Error('Valor acima do limite de aprovação delegado.');
  const valid=latestQuotes(p).filter(q=>q.validUntil>=localDay(now)&&state.suppliers.some(s=>s.id===q.supplierId&&s.tenant===user.tenant&&s.active));
  const singleQuoteReason=valid.length<2?text(input.singleQuoteReason,'Justificativa para cotação única',500):null;
  p.approval={quote:structuredClone(quote),approvedBy:user.id,approvedByName:user.name,approvedAt:new Date(now).toISOString(),reason,singleQuoteReason};p.status='approved';
 }else if(input.status==='rejected'){
  if(!can(user,'purchaseApproval')||p.status!=='review')throw Error('Recusa não permitida.');p.status='rejected';
 }else if(input.status==='draft'){
  if(!procurement(user)||p.status!=='rejected')throw Error('Reabertura não permitida.');p.status='draft';
 }else if(input.status==='cancelled'){
  if(!procurement(user)||!['draft','review','approved','rejected'].includes(p.status))throw Error('Cancelamento não permitido.');p.status='cancelled';
 }else throw Error('Decisão não permitida.');
 record(p,user,({approved:'Compra aprovada',rejected:'Compra recusada',draft:'Compra reaberta',cancelled:'Compra cancelada'})[p.status],reason,now);return structuredClone(p);
}
export function receivePurchase(state,user,input,now=Date.now()){
 const p=editable(state,user,input);if(!procurement(user)||p.status!=='approved')throw Error('Recebimento exige compra aprovada ainda não recebida.');
 const reference=text(input.reference,'Comprovante / referência de recebimento'),reason=text(input.reason,'Conferência do recebimento',500);
 if((state.purchases||[]).some(other=>other.tenant===user.tenant&&other.id!==p.id&&other.status==='received'&&other.approval.quote.supplierId===p.approval.quote.supplierId&&other.receipt.reference.toLocaleLowerCase('pt-BR')===reference.toLocaleLowerCase('pt-BR')))throw Error('Referência de recebimento já registrada para este fornecedor.');
 let movementId=null;
 if(p.materialId){
  const material=(state.materials||[]).find(m=>m.id===p.materialId&&m.tenant===user.tenant);if(!material||material.unit!==p.unit)throw Error('Material ou unidade indisponíveis para recebimento.');
  const movement=moveMaterial(state,user,{id:p.materialId,version:input.materialVersion,kind:'entry',quantity:p.quantity,reason:'Recebimento de compra: '+p.title+' · '+reference},now);
  movementId=movement.movement.id;material.movements.at(-1).purchaseId=p.id;
 }
 p.receipt={at:new Date(now).toISOString(),receivedBy:user.id,receivedByName:user.name,reference,reason,movementId};p.status='received';record(p,user,'Recebimento integral conferido',reason,now);return structuredClone(p);
}
