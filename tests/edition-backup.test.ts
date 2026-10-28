import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {config} from '../src/config.ts';
import {authenticate} from '../src/auth.ts';
import {execute} from '../src/service.ts';
import {transaction,pool,type Identity} from '../src/db.ts';
import {prepareDemo} from './fixtures/study-edition.ts';
if(!config.local||new URL(config.database).hostname!=='127.0.0.1')throw Error('Banco isolado e material sintético obrigatórios.');
const accounts=JSON.parse(await readFile('.local/test-accounts.json','utf8'));
async function login(index:number){const r=await fetch(`${config.authUrl}/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(accounts[index])});assert.equal(r.status,200);return authenticate(`Bearer ${(await r.json()).access_token}`);}
const alice=await login(0),bob=await login(1),call=(who:Identity,name:any,args:any)=>execute(name,args,who),op=()=>randomUUID();
after(()=>pool.end());
test('backup v4: compartilhamento consentido, restauração privada, hashes, RLS e arquivo inacessível',async()=>{
 const fixture=await prepareDemo((name,args)=>call(alice,name,args),`Backup sintético ${op()}`,'invited'),version=fixture.version_id;
 await assert.rejects(()=>call(bob,'edition_context',{version_id:version}),{code:'NOT_FOUND'});
 await assert.rejects(()=>transaction(bob,c=>c.query('insert into araread.edition_readers(owner_id,version_id) values($1,$2)',[bob.id,version])),{code:'23503'});
 const group=await call(alice,'edition_group',{operation_id:op(),expected_revision:0,action:'create',version_id:version,title:'Grupo sintético de backup'});
 const invite=await call(alice,'edition_group',{operation_id:op(),expected_revision:group.revision,action:'invite',group_id:group.group_id});
 const joined=await call(bob,'edition_group',{operation_id:op(),expected_revision:0,action:'join',invite_code:invite.invite_code});assert.equal(joined.revision,invite.revision+1);
 const context=await call(bob,'edition_context',{version_id:version}),first=context.passage.id;
 await call(alice,'edition_annotate',{operation_id:op(),expected_revision:0,version_id:version,passage_id:first,action:'note',text:'Nota privada exclusiva da pessoa autora — fixture.'});
 const target={passage_id:first,...context.passage.content.supports[0].target};
 let state=await call(bob,'edition_annotate',{operation_id:op(),expected_revision:0,version_id:version,passage_id:first,action:'highlight',target});
 state=await call(bob,'edition_annotate',{operation_id:op(),expected_revision:state.revision,version_id:version,passage_id:first,action:'note',target,text:'Minha nota sintética com referência exata.'});
 await assert.rejects(()=>transaction(bob,c=>c.query('update araread.edition_readers set opened=$3 where owner_id=$1 and version_id=$2',[bob.id,version,op()])),{code:'23503'});
 const manifest=await call(bob,'data_export',{format:'araread/4',section:'works',limit:1}),sections:Record<string,any[]>={};
 const sourceIds=fixture.imported.map(s=>s.source_id),passageIds=context.outline.map((p:any)=>p.id);
 for(const section of manifest.sections){sections[section]=[];let offset:number|null=0;while(offset!==null){const page=await call(bob,'data_export',{format:'araread/4',section,offset,limit:50,include_original:true,snapshot:manifest.snapshot});sections[section].push(...page.items);offset=page.pagination.next_offset;}}
 assert(!JSON.stringify(sections.edition_annotations).includes('Nota privada exclusiva da pessoa autora'));
 // Isolate this complete fixture from unrelated synthetic material in the same test accounts.
 for(const section of manifest.sections){const rows=sections[section];sections[section]=section==='edition_projects'?rows.filter(r=>r.id===fixture.project_id):section==='edition_sources'?rows.filter(r=>sourceIds.includes(r.id)):section==='edition_passages'?rows.filter(r=>passageIds.includes(r.id)):section==='edition_versions'?rows.filter(r=>r.id===version):['edition_readers','edition_annotations'].includes(section)?rows.filter(r=>r.version_id===version):section==='edition_groups'?rows.filter(r=>r.id===group.group_id):['edition_members','edition_comments','edition_invites'].includes(section)?rows.filter(r=>r.group_id===group.group_id):[];}
 const bundle={format:'araread/4',snapshot:manifest.snapshot,sections},request={operation_id:op(),bundle};
 const restored=await call(bob,'data_restore',request);assert.equal(restored.restored_editions,1);assert.equal(restored.sharing_reactivated,false);assert.equal(restored.archived_unavailable_annotations,0);
 assert.deepEqual(await call(bob,'data_restore',request),restored);
 const copy=await call(bob,'edition_context',{version_id:restored.id_map[version],passage_id:restored.id_map[first]});assert.equal(copy.version.visibility,'private');assert.equal(copy.passage.originals[0].text,context.passage.originals[0].text);assert.equal(copy.passage.content.segments[0].text,context.passage.content.segments[0].text);
 const personal=await call(bob,'edition_reader',{version_id:copy.version.id});assert.equal(personal.annotations.length,2);assert.equal(personal.annotations.find((a:any)=>a.kind==='highlight').target.exact,target.exact);assert.equal(personal.annotations[0].passage_id,copy.passage.id);
 await assert.rejects(()=>call(alice,'edition_context',{version_id:copy.version.id}),{code:'NOT_FOUND'});
 assert.equal((await call(bob,'edition_groups',{version_id:copy.version.id})).items.length,0);
 const corrupted=structuredClone(bundle);corrupted.sections.edition_sources[0].blocks[0].text+=' alteração';await assert.rejects(()=>call(bob,'data_restore',{operation_id:op(),bundle:corrupted}),{code:'INVALID_BACKUP'});
 const partial=structuredClone(bundle);for(const section of ['edition_projects','edition_sources','edition_passages','edition_versions'])partial.sections[section]=[];
 const archived=await call(bob,'data_restore',{operation_id:op(),bundle:partial});assert.equal(archived.restored_editions,0);assert.equal(archived.archived_unavailable_annotations,2);
 const archive=(await call(bob,'data_export',{format:'araread/4',section:'edition_archives',limit:50})).items.find((r:any)=>r.id===archived.edition_archive_id);assert.equal(archive.payload.unavailable.annotations[0].target.exact,target.exact);
 const snap=await call(bob,'data_export',{format:'araread/4',section:'works',limit:1});
 await call(alice,'edition_publish',{operation_id:op(),expected_revision:fixture.revision,project_id:fixture.project_id,version_id:version,action:'withdraw',note:'Retirada sintética para conferir consistência do backup.'});
 await assert.rejects(()=>call(bob,'data_export',{format:'araread/4',section:'edition_versions',snapshot:snap.snapshot}),{code:'EXPORT_CHANGED'});
 assert.equal((await call(bob,'data_export',{section:'works',limit:1})).format,'araread/3');
});
