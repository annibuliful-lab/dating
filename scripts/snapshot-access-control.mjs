import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
const output = process.argv[2];
if (!output || !output.endsWith('.sql')) throw new Error('Provide a private output path ending in .sql');
const target = resolve(output);
if (target.includes('/public/')) throw new Error('Never put rollback files in the public directory');
const db = new URL(process.env.DATABASE_URL);
const result = spawnSync('psql', ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-f','scripts/snapshot-access-control.sql'], {
  encoding: 'utf8', timeout: 30000,
  env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port || '5432', PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password), PGDATABASE: db.pathname.slice(1), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '8' },
});
if (result.status !== 0 || !result.stdout.includes('EMERGENCY ROLLBACK')) throw new Error('Access-control snapshot failed; no backup was written');
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
writeFileSync(target, result.stdout, { mode: 0o600, flag: 'wx' });
console.log('Read-only access-control rollback snapshot saved.');
