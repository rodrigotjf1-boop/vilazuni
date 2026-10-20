export function runtimeConfig(env=process.env){const production=env.NODE_ENV==='production';let origin=null;if(env.APP_ORIGIN){const u=new URL(env.APP_ORIGIN);if(u.origin!==env.APP_ORIGIN||u.username||u.password||production&&u.protocol!=='https:')throw Error('APP_ORIGIN deve conter somente a origem HTTPS pública.');origin=u.origin;}
 if(production&&(!origin||!env.DATABASE_URL||!/^[a-f\d]{64}$/i.test(env.MFA_SECRET_KEY||'')||!env.BOOTSTRAP_TOKEN||!env.VILAZUNI_DATA_DIR))throw Error('Produção exige APP_ORIGIN HTTPS, DATABASE_URL, MFA_SECRET_KEY, BOOTSTRAP_TOKEN e VILAZUNI_DATA_DIR.');
 return {production,origin,secure:origin?.startsWith('https:')||false,bootstrapToken:env.BOOTSTRAP_TOKEN||null,requireManagerMfa:production||env.REQUIRE_MANAGER_MFA==='true'};
}
