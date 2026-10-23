import {readdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const excluded=new Set(JSON.parse(readFileSync(new URL('../docs/asset-dependent-tests.json',import.meta.url),'utf8')));
const tests=readdirSync('tests').filter(name=>name.endsWith('.test.ts')&&!excluded.has(name)).sort().map(name=>'tests/'+name);
console.log(`Running ${tests.length} source test files. ${excluded.size} files requiring omitted assets are excluded; see docs/asset-dependent-tests.json.`);
const result=spawnSync(process.execPath,['--import','tsx','--test',...tests],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
