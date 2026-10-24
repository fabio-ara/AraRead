import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,readdir,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',maxBuffer:40*1024*1024,windowsHide:true});
const rules:[string,RegExp][]=[['secret-key',/\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{15,}/g],['jwt',/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/g],['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['database-password',/postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/g],['personal-email',/[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook)\.com/g]];
const hits:{path:string,rule:string,revision:string}[]=[],knownFixtures=new Set<string>();let blobs=0,bytes=0;
function scan(body:Buffer,path:string,revision:string){
 if(body.includes(0)||/\.(png|pdf)$/.test(path))return;const text=body.toString('utf8');
 for(const [name,re]of rules){re.lastIndex=0;for(const match of text.matchAll(re)){
  if(name==='database-password'&&/^postgres(?:ql)?:\/\/[^:]+:araread-local-(?:admin|auth)-only@(?:127\.0\.0\.1|db):/.test(match[0])){knownFixtures.add(path);continue;}
  if(name==='database-password'&&/^postgres(?:ql)?:\/\/araread_app:araread-local-only@127\.0\.0\.1:/.test(match[0])){knownFixtures.add(path);continue;}
  if(name==='personal-email'&&['THIRD_PARTY_LICENSES.txt','artifact/THIRD_PARTY_LICENSES.txt'].includes(path)){knownFixtures.add('Required public author attribution: '+path);continue;}
  hits.push({path,rule:name,revision});
 }}
}
for(const line of git('rev-list','--objects','--all').trim().split('\n')){const n=line.indexOf(' ');if(n<0)continue;const id=line.slice(0,n),path=line.slice(n+1);if(git('cat-file','-t',id).trim()!=='blob')continue;const body=execFileSync('git',['cat-file','blob',id],{maxBuffer:40*1024*1024,windowsHide:true});blobs++;bytes+=body.length;scan(body,path,id);}
const paths=[...new Set([...git('ls-files').trim().split('\n'),...git('ls-files','--others','--exclude-standard').trim().split('\n')])].filter(Boolean),forbidden=paths.filter(p=>/^(\.env$|\.local\/|node_modules\/|dist\/|test-results\/)|PROMPT_CODEX_.*\.md$/i.test(p));
for(const path of paths)try{scan(await readFile(path),path,'working-tree');}catch(e:any){if(e.code!=='ENOENT')throw e;}
let artifactFiles=0;const artifact=process.argv[process.argv.indexOf('--artifact')+1];
if(process.argv.includes('--artifact')){if(!artifact)throw Error('Artifact directory required');const root=await realpath(artifact),workspace=await realpath('.');if(!root.startsWith(workspace+sep))throw Error('Artifact outside workspace');async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Artifact symlink refused');const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else{const name=relative(root,path).replaceAll('\\','/');if(/(^|\/)(?:\.env|\.local|node_modules)(?:\/|$)|\.map$/i.test(name))forbidden.push('artifact/'+name);scan(await readFile(path),'artifact/'+name,'distribution');artifactFiles++;}}}await walk(root);}
const report={checked_at:new Date().toISOString(),commits:Number(git('rev-list','--count','--all')),blobs,bytes,working_files:paths.length,hits,forbidden,known_nonsecret_local_fixtures:[...knownFixtures].sort(),limitations:'Pattern scan, not a proof of absence. Binary fixtures, rights, screenshots and CI artifacts require separate review.'};
await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/public-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({commits:report.commits,blobs,working_files:paths.length,artifact_files:artifactFiles,alerts:hits,forbidden}));if(hits.length||forbidden.length)process.exitCode=1;
