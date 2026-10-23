import assert from 'node:assert/strict';

export async function longPanelTitleBrowser(page) {
 const title=page.locator('#experience-dock .glass-heading h2'),original=await title.textContent();
 try {
  await title.evaluate(el=>{el.textContent='Comunicado importante do condomínio sobre os serviços de manutenção e a programação das atividades para moradores e visitantes. '.repeat(2).slice(0,160);});
  const dimensions=await page.locator('#experience-dock').evaluate(dock=>{
   const body=dock.querySelector('.glass-body'),close=dock.querySelector('.glass-close').getBoundingClientRect(),rect=dock.getBoundingClientRect();
   return {bodyHeight:body.clientHeight,bodyBottom:body.getBoundingClientRect().bottom,dockBottom:rect.bottom,closeBottom:close.bottom};
  });
  assert.ok(dimensions.bodyHeight>=80,'long titles leave enough room to read the content');
  assert.ok(dimensions.bodyBottom<=dimensions.dockBottom,'long titles do not push content out of the panel');
  assert.ok(dimensions.closeBottom<=dimensions.dockBottom,'long titles keep close accessible');
  await title.focus();await title.press('End');
  await page.waitForFunction(()=>{const el=document.querySelector('#experience-dock .glass-heading h2');return el.scrollHeight<=el.clientHeight||el.scrollTop>0;},null,{timeout:2000});
 } finally {await title.evaluate((el,text)=>{el.textContent=text;el.scrollTop=0;},original);}
}

export async function panelBrowser({page,capture}) {
 const original=page.viewportSize();
 try {
  for(const viewport of [{width:1440,height:1000},{width:1280,height:900},{width:768,height:1024},{width:390,height:844},{width:320,height:740},{width:844,height:390}]){
   await page.setViewportSize(viewport);
   const metrics=await page.locator('#experience-dock').evaluate(dock=>{
    const body=dock.querySelector('.glass-body'),heading=dock.querySelector('.glass-panel-header'),close=dock.querySelector('.glass-close'),message=dock.querySelector('.community-notice-body');
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    body.scrollTop=0;
    const before=rect(heading);body.scrollTop=body.scrollHeight;
    return {dock:rect(dock),body:rect(body),close:rect(close),before,after:rect(heading),scrollable:body.scrollHeight>body.clientHeight,overflow:body.scrollWidth>body.clientWidth,font:parseFloat(getComputedStyle(message).fontSize),actions:[...dock.querySelectorAll('.community-notice-actions>a,.community-notice-actions>button')].map(rect)};
   });
   assert.ok(metrics.dock.x>=0&&metrics.dock.right<=viewport.width,'panel fits viewport');
   assert.ok(metrics.dock.y>=0&&metrics.dock.bottom<=viewport.height,'panel fits viewport height');
   if(viewport.width>=901)assert.ok(metrics.dock.width>=500,'desktop panel provides more reading space');
   if(viewport.width===768)assert.ok(metrics.dock.width>=600,'tablet panel uses available width');
   assert.ok(metrics.body.height>=80,'content remains usable in landscape');
   assert.equal(metrics.overflow,false,'notice has no horizontal overflow');
   assert.ok(metrics.font>=17,'notice text remains legible');
   assert.ok(metrics.scrollable,'long notice can be scrolled');
   assert.equal(metrics.before.y,metrics.after.y,'header stays accessible while reading');
   assert.ok(metrics.close.y>=metrics.dock.y&&metrics.close.bottom<=metrics.dock.bottom,'close remains accessible');
   for(const action of metrics.actions)assert.ok(action.height>=44,'actions have comfortable touch targets');
   assert.ok(metrics.actions[0].bottom<=metrics.actions[1].y,'sharing actions do not overlap');
   await page.locator('.glass-body').evaluate(body=>body.scrollTop=0);
   if(viewport.width===320||viewport.height===390)await longPanelTitleBrowser(page);
   if(viewport.width===1440||viewport.width===390)await capture(page,viewport.width===1440?'aviso-painel-desktop.png':'aviso-painel-celular.png');
  }
 } finally {await page.setViewportSize(original);}
 console.log('Painel ampliado em desktop/tablet/celular e paisagem: texto legível, ações separadas e fechar/voltar acessíveis durante a rolagem.');
}
