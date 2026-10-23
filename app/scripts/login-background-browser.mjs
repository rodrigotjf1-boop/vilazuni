import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function loginBackgroundBrowser({page,browser,base}){
 const initialViewport=page.viewportSize(),artifacts=process.env.VILAZUNI_PANEL_ARTIFACTS;
 if(artifacts)await fs.mkdir(artifacts,{recursive:true});
 await page.locator('#auth-entry').waitFor();
 await page.waitForFunction(()=>Number(document.querySelector('#world-canvas')?.dataset.frames)>0);
 assert.equal(await page.locator('.world-shell').evaluate(el=>el.classList.contains('is-locked')),true);
 assert.equal(await page.locator('#world-navigation').isVisible(),false,'Login does not expose the application navigation');
 assert.equal(await page.locator('#world-canvas').getAttribute('tabindex'),'-1','The login scene is decorative');
 assert.equal(await page.locator('#world-canvas').getAttribute('aria-hidden'),'true');
 assert.equal(await page.locator('#experience-dock').isVisible(),false);
 const desktop=await page.locator('#world-canvas').screenshot();
 assert.ok(desktop.length>10000,'The paused login scene contains a rendered village rather than an empty canvas');
 if(artifacts)await page.screenshot({path:path.join(artifacts,'entrada-desktop.png'),animations:'disabled'});
 let frames=Number(await page.locator('#world-canvas').getAttribute('data-frames'));
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(before=>Number(document.querySelector('#world-canvas')?.dataset.frames)>before,frames);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(artifacts)await page.screenshot({path:path.join(artifacts,'entrada-celular.png'),animations:'disabled'});
 frames=Number(await page.locator('#world-canvas').getAttribute('data-frames'));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForFunction(before=>Number(document.querySelector('#world-canvas')?.dataset.frames)>before,frames);
 const after=Number(await page.locator('#world-canvas').getAttribute('data-frames'));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(Number(await page.locator('#world-canvas').getAttribute('data-frames')),after,'The login background stays still without an animation loop');
 await page.setViewportSize(initialViewport);
 const fallback=await browser.newContext();
 try{
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:original.call(this,kind,...args);};});
  const fallbackPage=await fallback.newPage(),privateRequests=[];
  fallbackPage.on('request',request=>{const pathname=new URL(request.url()).pathname;if(pathname.startsWith('/api/')&&pathname!=='/api/session')privateRequests.push(pathname);});
  await fallbackPage.goto(base);await fallbackPage.locator('#auth-entry').waitFor();
  assert.equal(await fallbackPage.getByRole('button',{name:'Criar minha conta de gestão',exact:true}).isVisible(),true);
  assert.equal(await fallbackPage.locator('#experience-dock').isVisible(),false);
  assert.deepEqual(privateRequests,[],'A browser without WebGL does not request private condominium records before login');
 }finally{await fallback.close();}
 console.log('Entrada: cenário renderizado antes da pausa, navegação oculta, fundo estático após resize/retorno da aba e autenticação disponível sem WebGL.');
}
