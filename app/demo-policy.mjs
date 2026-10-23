// A demonstration is a server-owned tenant setting, never a client request flag.
export function isDemoTenant(state,tenant){return typeof tenant==='string'&&(state?.tenants||[]).some(t=>t.id===tenant&&t.demoMode===true);}
export function requireLiveTenant(state,tenant,operation='Esta integração'){
 if(isDemoTenant(state,tenant))throw Object.assign(Error(operation+' não realiza envios ou operações externas na demonstração. Use os exemplos locais.'),{status:409,code:'DEMO_EXTERNAL_DISABLED'});
}
