export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const stamp=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
export function cents(value){
 if(typeof value!=='string'||!/^\d{1,7}(\.\d{1,2})?$/.test(value))throw Error('Informe valor positivo com até duas casas decimais.');
 const [whole,fraction='']=value.split('.'),result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(result<1||result>100000000)throw Error('Valor deve estar entre R$ 0,01 e R$ 1.000.000,00.');return result;
}
export function onSubmit(form,handler){form.onsubmit=async event=>{
 event.preventDefault();const button=form.querySelector('[type=submit]'),error=form.querySelector('.auth-error');button.disabled=true;error.textContent='';
 try{await handler(Object.fromEntries(new FormData(form)),form);}catch(e){error.textContent=e.message;button.disabled=false;}
};}
