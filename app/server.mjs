import {runtimeConfig} from './runtime-config.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createAuthApi} from './auth-api.mjs';
const config=runtimeConfig(),bindHost=process.env.HOST||(config.production?'0.0.0.0':'127.0.0.1');
const root=path.dirname(fileURLToPath(import.meta.url));
const handleApi=await createAuthApi({directory:process.env.VILAZUNI_DATA_DIR||path.join(root,'.data')});
const files={'/operations-ui.mjs':'operations-ui.mjs','/mobile-ui.mjs':'mobile-ui.mjs','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/governance-ui.mjs':'governance-ui.mjs','/platform-ui.mjs':'platform-ui.mjs','/civic-ui.mjs':'civic-ui.mjs','/civic.css':'civic.css','/tour.css':'tour.css','/tour-layout.mjs':'tour-layout.mjs','/tour-geometry.mjs':'tour-geometry.mjs','/world-renderer.mjs':'world-renderer.mjs','/tour-ui.mjs':'tour-ui.mjs','/my-charges-ui.mjs':'my-charges-ui.mjs','/finance-collection-ui.mjs':'finance-collection-ui.mjs','/finance-fees-ui.mjs':'finance-fees-ui.mjs','/modelo-extrato.csv':'modelo-extrato.csv','/finance-reconciliation-ui.mjs':'finance-reconciliation-ui.mjs','/finance-agreements-ui.mjs':'finance-agreements-ui.mjs','/finance-recurring-ui.mjs':'finance-recurring-ui.mjs','/finance-settlements-ui.mjs':'finance-settlements-ui.mjs','/finance-assessments-ui.mjs':'finance-assessments-ui.mjs','/finance-receivables-ui.mjs':'finance-receivables-ui.mjs','/finance-budget-ui.mjs':'finance-budget-ui.mjs','/finance-ui.mjs':'finance-ui.mjs','/ui-common.mjs':'ui-common.mjs','/purchases-ui.mjs':'purchases-ui.mjs','/documents-ui.mjs':'documents-ui.mjs','/parcels-ui.mjs':'parcels-ui.mjs','/notifications-ui.mjs':'notifications-ui.mjs','/facilities-ui.mjs':'facilities-ui.mjs','/maintenance-ui.mjs':'maintenance-ui.mjs','/permissions.mjs':'permissions.mjs','/access-ui.mjs':'access-ui.mjs','/materials-ui.mjs':'materials-ui.mjs','/incidents-ui.mjs':'incidents-ui.mjs','/tasks-ui.mjs':'tasks-ui.mjs','/residents-ui.mjs':'residents-ui.mjs','/auth-ui.mjs':'auth-ui.mjs','/immersive.mjs':'immersive.mjs','/immersive.css':'immersive.css','/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/world.css':'world.css','/world.mjs':'world.mjs'};
const mime={'.js':'text/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.csv':'text/csv; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 if(req.url==='/.well-known/assetlinks.json'&&req.method==='GET'){const fingerprints=(process.env.ANDROID_SHA256_CERT_FINGERPRINTS||'').split(',').map(s=>s.trim()).filter(s=>/^([a-f\d]{2}:){31}[a-f\d]{2}$/i.test(s)).slice(0,10);if(!fingerprints.length){res.writeHead(404);res.end('Não configurado');return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'br.com.vilazuni.app',sha256_cert_fingerprints:fingerprints}}]));return;}
 if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"status":"ok"}');return;}
 if(req.url==='/readyz'){try{await handleApi.ready();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"status":"ready"}');}catch{res.writeHead(503);res.end('Indisponível');}return;}
 if(new URL(req.url,'http://localhost').pathname.startsWith('/api/')){await handleApi(req,res);return;}
 const name=files[new URL(req.url,'http://localhost').pathname];
 if(!name||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Não encontrado');return;}
 try{const data=await fs.readFile(path.join(root,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('Arquivo indisponível');}
});
let port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT deve ser um número entre 0 e 65535.');
let attempts=0;
server.on('error',error=>{
 if(error.code==='EADDRINUSE'&&!process.env.PORT&&attempts++<10){port++;server.listen(port,bindHost);return;}
 console.error('Não foi possível iniciar o Vilazuni:',error.message);
 process.exitCode=1;
});
server.on('listening',()=>{
 const url=config.origin||'http://127.0.0.1:'+server.address().port;
 console.log('\nVilazuni pronto: '+url+'\nMantenha esta janela aberta durante o uso. Para encerrar, pressione Ctrl+C.\n');
 if(process.argv.includes('--open')&&process.platform==='win32'){
  const browser=spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'});
  browser.on('error',()=>console.log('Abra manualmente no navegador: '+url));
 }
});
server.listen(port,bindHost);

const channelTimer=setInterval(()=>handleApi.tick().catch(()=>{}),30000),pushTimer=setInterval(()=>handleApi.pushTick().catch(()=>{}),30000);channelTimer.unref();pushTimer.unref();
let shuttingDown=false;async function shutdown(){if(shuttingDown)return;shuttingDown=true;clearInterval(channelTimer);clearInterval(pushTimer);const timer=setTimeout(()=>process.exit(1),10000);timer.unref();await new Promise(resolve=>server.close(resolve));await handleApi.close();clearTimeout(timer);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
