import {Pool} from 'pg';import fs from 'node:fs/promises';
const url=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;if(!url)throw Error('Configure MIGRATION_DATABASE_URL em ambiente seguro.');
const pool=new Pool({connectionString:url,connectionTimeoutMillis:5000});try{await pool.query(await fs.readFile(new URL('../migrations/001_storage.sql',import.meta.url),'utf8'));console.log('Migração 001 aplicada. Conceda ao papel da aplicação SELECT/INSERT/UPDATE nas tabelas de controle e condomínio, sem SUPERUSER/BYPASSRLS.');}finally{await pool.end();}
