import {api} from './auth-ui.mjs';
import {esc,stamp,onSubmit} from './ui-common.mjs';
import {calendarTasks} from './community-calendar.mjs';

const labels={sindico:'Síndico',zelador:'Zelador'};
const statusNames={todo:'A fazer',doing:'Em andamento',review:'Em revisão',done:'Concluída',cancelled:'Cancelada'};
const dateLabel=value=>value?value.split('-').reverse().join('/'):'Não informada';
const photoURL=p=>'/api/community/profile/photo?slot='+encodeURIComponent(p.slot)+'&version='+p.version;
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();

export function createCommunityUI({getState,getUser,panel,world,toast,openTasks}) {
 const owner=getUser()?.id,tenant=getUser()?.tenant;
 let serial=0,disposed=false,polling=false;
 const current=token=>!disposed&&owner&&getUser()?.id===owner&&getUser()?.tenant===tenant&&(token==null||serial===token);
 function sync(summary) { if(!current())return;getState().community={...getState().community,...summary};world()?.updateCommunity?.(summary); }
 async function poll() {
  if(!current()||document.hidden||polling)return;polling=true;
  try{const summary=await api('/community/summary');if(current())sync(summary);}catch{}finally{polling=false;}
 }
 const timer=owner?setInterval(poll,30000):null;
 const visibility=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visibility);
 async function team() {
  if(!current())return;const token=++serial;
  try{const data=await api('/community');if(!current(token))return;sync(data);
   const dock=panel('Pessoas que cuidam daqui.','EQUIPE DO CONDOMÍNIO',`<div class="community-team">${data.profiles.map(p=>`<button class="community-person-card" data-community-slot="${p.slot}">${p.photo?`<img src="${photoURL(p)}" alt="">`:`<span class="community-avatar" aria-hidden="true">${p.slot==='sindico'?'S':'Z'}</span>`}<span><small>${labels[p.slot]}</small><strong>${esc(p.configured?p.name:'Ficha ainda não preenchida')}</strong><span>Abrir ficha e contatos →</span></span></button>`).join('')}</div>`);
   dock.querySelectorAll('[data-community-slot]').forEach(b=>b.onclick=()=>profile(b.dataset.communitySlot));
  }catch(e){if(current(token))toast(e.message);}
 }
 function contacts(p) {
  return `<div class="community-contacts">${p.whatsapp?`<a class="glass-primary" href="https://wa.me/${encodeURIComponent(p.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:''}${p.phone?`<a class="glass-secondary" href="tel:+${encodeURIComponent(p.phone)}">Ligar</a>`:''}${p.email?`<a class="glass-secondary" href="mailto:${encodeURIComponent(p.email)}">Enviar e-mail</a>`:''}</div>${!p.whatsapp&&!p.phone&&!p.email?'<p class="quiet-state">Contatos ainda não cadastrados.</p>':''}`;
 }
 async function profile(which,period='day') {
  if(!current())return;const token=++serial;
  try{const data=await api('/community/profile?slot='+encodeURIComponent(which));if(!current(token))return;
   const p=data.profile,agenda=calendarTasks(data.tasks,period,data.today);
   const dock=panel(p.configured?p.name:labels[which],labels[which].toLocaleUpperCase('pt-BR'),`${p.configured?`<div class="community-profile-heading">${p.photo?`<img class="community-photo" src="${photoURL(p)}" alt="Foto de ${esc(p.name)}">`:`<div class="community-photo community-avatar" aria-hidden="true">${esc(initials(p.name))}</div>`}<div><h3>${esc(p.name)}</h3><p>${p.age!=null?p.age+' anos':'Idade não informada'}</p>${which==='sindico'?`<p>Vigência: ${dateLabel(p.termStart)} a ${dateLabel(p.termEnd)}</p>${!p.inTerm?'<span class="float-pill">Fora da vigência informada</span>':''}${p.house?`<p>Casa ${esc(p.house.number)} · ${p.isOwner?'Proprietário da unidade':'Não é proprietário da unidade'}</p>`:'<p>Sem casa vinculada.</p>'}`:''}</div></div>${contacts(p)}`:`<p class="quiet-state">${p.unavailable?'O vínculo da pessoa cadastrada não está vigente. A gestão pode atualizar esta ficha.':'A gestão ainda não preencheu esta ficha.'}</p>`}${p.canEdit?'<button class="glass-secondary" id="community-profile-edit">Editar ficha</button>':''}${which==='zelador'&&p.configured?`<section class="community-agenda"><h3>Tarefas do zelador</h3><div class="tour-view-switch" role="group" aria-label="Período das tarefas">${[['day','Hoje'],['week','Semana'],['month','Mês']].map(([value,label])=>`<button class="glass-secondary" data-agenda-period="${value}" aria-pressed="${period===value}">${label}</button>`).join('')}</div><p class="micro-note">${dateLabel(agenda.from)}${agenda.from!==agenda.through?' a '+dateLabel(agenda.through):''}</p><div class="float-feed">${agenda.tasks.map(t=>`<article class="floating-note"><span class="float-pill">${statusNames[t.status]||esc(t.status)}</span><h4>${esc(t.title)}</h4><p>${esc(t.area)} · ${dateLabel(t.due)}</p></article>`).join('')||'<p class="quiet-state">Nenhuma tarefa para este período.</p>'}</div>${!p.userId?'<p class="micro-note">Vincule a conta do zelador na ficha para consultar sua agenda.</p>':''}${data.canOpenTasks?'<button class="glass-secondary" id="community-open-tasks">Gerenciar tarefas</button>':'<p class="micro-note">Agenda compartilhada pela gestão com o condomínio.</p>'}</section>`:''}`,{back:team});
   dock.querySelector('#community-profile-edit')?.addEventListener('click',()=>editProfile(which));
   dock.querySelectorAll('[data-agenda-period]').forEach(b=>b.onclick=()=>profile(which,b.dataset.agendaPeriod));
   dock.querySelector('#community-open-tasks')?.addEventListener('click',()=>openTasks());
  }catch(e){if(current(token))toast(e.message);}
 }
 async function editProfile(which) {
  if(!current())return;const token=++serial;
  try{const data=await api('/community/editor?slot='+encodeURIComponent(which));if(!current(token))return;
   const p=data.profile;
   const dock=panel('Ficha do '+labels[which].toLocaleLowerCase('pt-BR'),'CADASTRO DA EQUIPE',`<form class="float-wizard" id="community-profile-form"><label>Nome<input name="name" required minlength="3" maxlength="120" value="${esc(p.name||'')}"></label><label>Idade<input name="age" type="number" min="18" max="120" value="${p.age??''}"></label><label>Conta vinculada<select name="userId"><option value="">Sem conta vinculada</option>${data.users.map(u=>`<option value="${esc(u.id)}" ${p.userId===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label><label>Telefone · DDI e DDD<input name="phone" type="tel" maxlength="30" placeholder="55 22 99999 9999" value="${esc(p.phone||'')}"></label><label>WhatsApp · DDI e DDD<input name="whatsapp" type="tel" maxlength="30" placeholder="55 22 99999 9999" value="${esc(p.whatsapp||'')}"></label><label>E-mail<input name="email" type="email" maxlength="200" value="${esc(p.email||'')}"></label>${which==='sindico'?`<label>Início da vigência<input name="termStart" type="date" value="${esc(p.termStart||'')}"></label><label>Fim da vigência<input name="termEnd" type="date" value="${esc(p.termEnd||'')}"></label><label>Casa vinculada<select name="houseId"><option value="">Sem casa vinculada</option>${data.houses.map(h=>`<option value="${esc(h.id)}" ${p.houseId===h.id?'selected':''}>Casa ${esc(h.number)}</option>`).join('')}</select></label><label class="inline-choice"><input name="isOwner" type="checkbox" ${p.isOwner?'checked':''}>É proprietário da unidade vinculada</label>`:''}<label>Foto<input name="photoFile" type="file" accept="image/jpeg,image/png,image/webp"></label>${p.photo?'<label class="inline-choice"><input name="removePhoto" type="checkbox">Remover foto atual</label>':''}<p class="micro-note">Os dados desta ficha ficam visíveis às pessoas com acesso ao condomínio.</p><p class="auth-error" role="alert"></p><button type="submit" class="glass-primary">Salvar ficha</button></form>`,{back:()=>profile(which)});
   onSubmit(dock.querySelector('form'),async(values,form)=>{
    if(!current(token))return;
    const file=form.elements.photoFile.files[0],image=file?await preparePhoto(file):undefined;
    if(file&&form.elements.removePhoto?.checked)throw Error('Escolha uma nova foto ou marque remover a foto atual.');
    if(!current(token))return;
    await api('/community/profile/save',{slot:which,version:p.version,name:values.name,age:values.age,userId:values.userId,phone:values.phone,whatsapp:values.whatsapp,email:values.email,termStart:values.termStart||null,termEnd:values.termEnd||null,houseId:values.houseId||null,isOwner:!!form.elements.isOwner?.checked,...(image?{photo:image}:form.elements.removePhoto?.checked?{photo:null}:{})});
    if(current(token)){toast('Ficha salva.');await profile(which);}
   });
  }catch(e){if(current(token))toast(e.message);}
 }
 async function board() {
  if(!current())return;const token=++serial;
  try{const data=await api('/community');if(!current(token))return;sync(data);
   const dock=panel('O que acontece por aqui.','MURAL DE AVISOS',`<div class="community-board-toolbar">${data.canPublish?'<button id="community-notice-create" class="glass-primary">＋ Publicar aviso</button>':''}<button id="community-board-refresh" class="glass-secondary">Atualizar mural</button></div><p class="micro-note" role="status">${data.unreadCount?data.unreadCount+' aviso(s) ainda não visto(s).':'Você viu todos os avisos disponíveis.'}</p><div class="community-noticeboard">${data.notices.map(n=>`<button class="community-note ${n.read?'':'unread'}" data-notice-id="${esc(n.id)}"><span class="community-note-pin" aria-hidden="true"></span>${!n.read?'<span class="community-note-alert" aria-label="Aviso não visto">!</span>':''}<h3>${esc(n.title)}</h3><p>${esc(n.author)} · ${esc(n.authorRole)}</p><small>${stamp(n.updatedAt)}${n.expiresOn?' · Até '+dateLabel(n.expiresOn):''}</small><strong>${n.read?'Abrir aviso':'Abrir aviso não visto'} →</strong></button>`).join('')||'<p class="quiet-state">O mural ainda não tem avisos. Publique o primeiro comunicado.</p>'}</div>`,{wide:true});
   dock.querySelector('#community-notice-create')?.addEventListener('click',()=>editNotice());
   dock.querySelector('#community-board-refresh').onclick=board;
   dock.querySelectorAll('[data-notice-id]').forEach(b=>b.onclick=()=>notice(b.dataset.noticeId));
  }catch(e){if(current(token))toast(e.message);}
 }
 async function notice(id) {
  if(!current())return;const token=++serial;
  try{const {notice:n}=await api('/community/notices/detail?id='+encodeURIComponent(id));if(!current(token))return;
   const dock=panel(n.title,'AVISO DO CONDOMÍNIO',`<p class="micro-note">${esc(n.author)} · ${esc(n.authorRole)}<br>${stamp(n.updatedAt)}${n.expiresOn?' · Disponível até '+dateLabel(n.expiresOn):''}</p><div class="community-notice-body">${esc(n.body)}</div>${n.canEdit?'<div class="community-board-toolbar"><button id="community-notice-edit" class="glass-secondary">Editar aviso</button><button id="community-notice-archive" class="glass-secondary">Arquivar aviso</button></div><div id="community-archive-confirm"></div>':''}<p class="micro-note" id="community-read-status" role="status">${n.read?'Aviso visto.':'Registrando visualização…'}</p>`,{back:board});
   dock.querySelector('#community-notice-edit')?.addEventListener('click',()=>editNotice(n));
   dock.querySelector('#community-notice-archive')?.addEventListener('click',()=>{
    const area=dock.querySelector('#community-archive-confirm');area.innerHTML='<p>Arquivar retira este aviso do mural para todas as pessoas.</p><button class="glass-primary" id="community-archive-confirm-button">Confirmar arquivamento</button><p class="auth-error" role="alert"></p>';
    area.querySelector('button').onclick=async e=>{if(!current(token))return;e.currentTarget.disabled=true;try{const result=await api('/community/notices/archive',{id:n.id,version:n.version});if(current(token)){sync(result);toast('Aviso arquivado.');await board();}}catch(error){if(current(token)){area.querySelector('.auth-error').textContent=error.message;area.querySelector('button').disabled=false;}}};
   });
   if(!n.read&&current(token)){
    try{const result=await api('/community/notices/read',{id:n.id,version:n.version});if(current(token)){sync(result);dock.querySelector('#community-read-status').textContent='Aviso visto.';}}
    catch(error){if(current(token))dock.querySelector('#community-read-status').textContent=error.message;}
   }
  }catch(e){if(current(token))toast(e.message);}
 }
 function editNotice(n=null) {
  if(!current())return;const token=++serial;
  const dock=panel(n?'Editar comunicado.':'Compartilhe com o condomínio.','PUBLICAR NO MURAL',`<form class="float-wizard"><label>Título do aviso<input name="title" required minlength="3" maxlength="160" value="${esc(n?.title||'')}"></label><label>Texto do aviso<textarea name="body" required minlength="3" maxlength="5000" rows="7">${esc(n?.body||'')}</textarea></label><label>Disponível até · opcional<input name="expiresOn" type="date" value="${esc(n?.expiresOn||'')}"></label><p class="auth-error" role="alert"></p><button class="glass-primary" type="submit">${n?'Salvar aviso':'Publicar aviso'}</button></form>`,{back:n?()=>notice(n.id):board});
  onSubmit(dock.querySelector('form'),async values=>{
   if(!current(token))return;const result=await api('/community/notices/save',{...values,...(n?{id:n.id}:{}),version:n?.version||0});
   if(current(token)){toast(n?'Aviso atualizado.':'Aviso publicado.');await board();}
   return result;
  });
 }
 return {team,profile,board,cancelPending(){serial++;},dispose(){disposed=true;serial++;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);}};
}

async function preparePhoto(file) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('Selecione uma foto JPEG, PNG ou WebP de até 12 MB.');
 const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler a foto.'));reader.readAsDataURL(file);});
 const image=new Image();image.src=url;await image.decode();
 if(!image.width||!image.height||image.width*image.height>40000000)throw Error('Selecione uma foto com dimensões menores.');
 const size=600,canvas=document.createElement('canvas'),edge=Math.min(image.width,image.height);canvas.width=size;canvas.height=size;
 const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,size,size);context.drawImage(image,(image.width-edge)/2,(image.height-edge)/2,edge,edge,0,0,size,size);
 return canvas.toDataURL('image/jpeg',.85);
}
