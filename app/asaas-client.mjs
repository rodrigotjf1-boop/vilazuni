const origins={sandbox:'https://api-sandbox.asaas.com/v3',production:'https://api.asaas.com/v3'};
export const ASAAS_EVENTS=['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_RESTORED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED'];
export function createAsaasClient({environment,apiKey,fetcher=fetch}){
 const origin=origins[environment];if(!origin||typeof apiKey!=='string'||apiKey.length<20||apiKey.length>2048||/\s/.test(apiKey))throw Error('Selecione o ambiente e informe uma chave de integração válida.');
 async function request(method,path,data){
  if(!/^\/[A-Za-z0-9_/?=&%.-]+$/.test(path)||path.startsWith('//')||path.includes('..'))throw Error('Operação Asaas inválida.');
  let response;try{response=await fetcher(origin+path,{method,headers:{access_token:apiKey,'User-Agent':'Vilazuni/0.3.0','Content-Type':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error',...(data===undefined?{}:{body:JSON.stringify(data)})});}catch{throw Object.assign(Error('Asaas não confirmou a operação. Consulte a situação antes de repetir.'),{uncertain:method!=='GET'});}
  let body;try{const raw=await response.text();if(raw.length>1024*1024)throw Error();body=JSON.parse(raw);}catch{throw Object.assign(Error('Resposta Asaas inválida. Consulte a situação antes de repetir.'),{uncertain:method!=='GET'});}
  if(!response.ok)throw Object.assign(Error(response.status===401||response.status===403?'Asaas recusou a chave ou as permissões da conta.':'Asaas recusou a solicitação. Confira os dados e a situação da conta.'),{providerStatus:response.status,uncertain:method!=='GET'&&(response.status>=500||response.status===429)});
  return body;
 }
 return {request,
  async account(){const [commercial,status]=await Promise.all([request('GET','/myAccount/commercialInfo'),request('GET','/myAccount/status')]);return {commercial,status};},
  async webhook({url,email,token}){const existing=await request('GET','/webhooks?limit=100');const matches=(existing.data||[]).filter(w=>w.url===url);if(matches.length>1)throw Error('Há webhooks duplicados para esta conexão. Revise na conta Asaas.');const data={name:'Vilazuni - cobranças',url,email,enabled:true,interrupted:false,authToken:token,sendType:'SEQUENTIALLY',events:ASAAS_EVENTS};return request(matches.length?'PUT':'POST',matches.length?'/webhooks/'+encodeURIComponent(matches[0].id):'/webhooks',data);},
  customers:reference=>request('GET','/customers?limit=100&externalReference='+encodeURIComponent(reference)),
  createCustomer:data=>request('POST','/customers',data),
  updateCustomer:(id,data)=>request('PUT','/customers/'+encodeURIComponent(id),data),
  payments:reference=>request('GET','/payments?limit=100&externalReference='+encodeURIComponent(reference)),
  createPayment:data=>request('POST','/payments',data),
  payment:id=>request('GET','/payments/'+encodeURIComponent(id)),
  cancel:id=>request('DELETE','/payments/'+encodeURIComponent(id)),
  notifications:id=>request('GET','/customers/'+encodeURIComponent(id)+'/notifications'),
  updateNotifications:data=>request('PUT','/notifications/batch',data)
 };
}
