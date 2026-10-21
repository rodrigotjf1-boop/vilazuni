const current=document.querySelector('meta[name=vilazuni-build]')?.content;
let checking=false,available=false;
async function check(){
 if(!current||checking||document.hidden||available)return;checking=true;
 try{const r=await fetch('/version.json',{cache:'no-store',credentials:'omit'});if(!r.ok)return;const next=await r.json();if(!/^[a-f\d]{20}$/.test(next.build)||next.build===current)return;available=true;
  const notice=document.createElement('aside');notice.className='release-notice';notice.setAttribute('role','status');notice.innerHTML='<span><strong>Nova versão disponível</strong><small>Salve suas alterações antes de atualizar.</small></span><button type="button">Atualizar aplicativo</button>';document.body.append(notice);
  notice.querySelector('button').onclick=async()=>{const button=notice.querySelector('button');button.disabled=true;try{const registration=await navigator.serviceWorker?.getRegistration();await registration?.update();if(registration?.waiting){navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting.postMessage({type:'VILAZUNI_SKIP_WAITING'});setTimeout(()=>location.reload(),4000);}else location.reload();}catch{location.reload();}};
 }catch{}finally{checking=false;}
}
const timer=setInterval(check,60000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
