import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Identity} from '../db.ts';
import {ensure} from '../errors.ts';
import {parameterDefaults,parameterDescriptions,parameterSchemas,preferenceSchemas,profileBundle,type Parameter} from './preference-contracts.ts';
const one=async(c:PoolClient,sql:string,args:unknown[]=[]) => (await c.query(sql,args)).rows[0];
const keys=Object.keys(parameterDefaults) as Parameter[],sensitive=new Set(['repertoire','goal','active_profile','perspective_id']);
const js=JSON.stringify;
export async function resolvePreferences(c:PoolClient,r:any,identity?:Identity,operation:any={}){
 const pref=await one(c,'select * from araread.preferences');
 const records=(await c.query("select * from araread.preference_records where scope='account' or (scope='reading' and reading_id=$1) or (scope='session' and session_id=$2 and (reading_id is null or reading_id=$1)) order by (reading_id is not null),created_at",[r?.id||null,identity?.session_id||null])).rows;
 const legacy=(v:any)=>({...v?.study,...(v?.language?{language:v.language}:{}),...(v?.portion_size?{portion_size:v.portion_size}:{})});
 const levels:any[]=[{scope:'account',values:legacy(pref)},{scope:'reading',values:legacy(r)}];
 const apply=(target:Record<string,any>,scope:string,values:any)=>{for(const key of keys)if(values[key]!==undefined)target[key]={value:values[key],origin:scope,scope,temporary:scope==='session'||scope==='operation',state:'active'};
  for(const rec of records.filter(v=>v.scope===scope)){if(rec.state==='disabled')continue;target[rec.key]={value:rec.state==='default'?parameterDefaults[rec.key as Parameter]:rec.value,origin:scope,scope,temporary:scope==='session',state:rec.state,provenance:rec.provenance};}
 };
 const selection:Record<string,any>={};for(const l of levels)apply(selection,l.scope,l.values);apply(selection,'session',{});for(const key of keys)if(operation[key]!==undefined)selection[key]={value:operation[key]};
 const profileId=selection.active_profile?.value;
 const profile=profileId?await one(c,'select * from araread.profiles where id=$1 and active',[profileId]):null;
 const effective:Record<string,any>=Object.fromEntries(keys.map(key=>[key,{value:parameterDefaults[key],origin:'default',scope:'default',temporary:false,state:'default'}]));
 apply(effective,'account',legacy(pref));
 if(profile)for(const [key,value]of Object.entries(profile.definition.values))if(keys.includes(key as Parameter)&&!['active_profile','perspective_id'].includes(key))effective[key]={value,origin:'profile',scope:'profile',profile_id:profile.id,profile_version:profile.version,profile_selection_scope:selection.active_profile.scope||'operation',temporary:['session','operation'].includes(selection.active_profile.scope||'operation'),state:'active'};
 apply(effective,'reading',legacy(r));apply(effective,'session',{});
 for(const key of keys)if(operation[key]!==undefined)effective[key]={value:operation[key],origin:'operation',scope:'operation',temporary:true,state:'active'};
 if(profileId&&!profile)effective.active_profile={...effective.active_profile,value:null,unavailable:true};
 return {catalog_version:'1',revision:r?.revision??pref?.revision??0,values:Object.fromEntries(keys.map(key=>[key,effective[key].value])),effective,records,profile};
}
async function validateValues(c:PoolClient,values:any,r:any,explicit:boolean){
 for(const [key,value]of Object.entries(values)){ensure(Object.hasOwn(parameterSchemas,key),'INVALID_PREFERENCE','Parâmetro fora do catálogo.');ensure(parameterSchemas[key as Parameter].safeParse(value).success,'INVALID_PREFERENCE','Valor incompatível com o catálogo.');if(sensitive.has(key)&&value!==null&&value!=='')ensure(explicit,'EXPLICIT_PREFERENCE_REQUIRED','Preferências interpretativas só podem ser guardadas por solicitação explícita do leitor.');}
 if(values.perspective_id)ensure(r&&await one(c,'select id from araread.perspectives where id=$1 and reading_id=$2',[values.perspective_id,r.id]),'INVALID_PERSPECTIVE','Perspectiva pertence a uma leitura específica.');
 if(values.active_profile)ensure(await one(c,'select id from araread.profiles where id=$1 and active',[values.active_profile]),'INVALID_PROFILE','Perfil indisponível ou desativado.');
}
async function profile(c:PoolClient,id:string){const p=await one(c,'select * from araread.profiles where id=$1',[id]);ensure(p,'NOT_FOUND','Perfil não encontrado.',404);return p;}
export function validateProfileDefinition(def:any){
 ensure(Buffer.byteLength(js(def))<=32768,'PROFILE_LIMIT','O perfil excede 32 KiB. Guarde apenas fontes e lentes necessárias.');
 ensure(!def.values.active_profile&&!def.values.perspective_id,'INVALID_PROFILE','Um perfil reutilizável não pode depender de outro perfil nem de uma perspectiva presa a uma leitura.');
 for(const lens of def.lenses){ensure(lens.nature!=='documented_commentary'||lens.sources.some((s:any)=>s.access==='available'&&s.consulted_at&&s.excerpt&&s.locator),'MISSING_EVIDENCE','Comentário documentado exige fonte realmente consultada, trecho e localizador.');}
 ensure(new Set(def.lenses.map((l:any)=>l.id)).size===def.lenses.length,'INVALID_PROFILE','Lentes duplicadas.');
}
export async function dispatchPreferences(name:string,a:any,identity:Identity,c:PoolClient,r:any){
 if(!Object.hasOwn(preferenceSchemas,name))return undefined;
 const uid=identity.id;
 if(a.reading_id&&!r){r=await one(c,'select * from araread.readings where id=$1',[a.reading_id]);ensure(r,'NOT_FOUND','Leitura não encontrada.',404);}
 if(name==='preferences_catalog')return {version:'1',precedence:['operation','session','reading','profile','account','default'],parameters:keys.map(key=>({key,description:parameterDescriptions[key],default:parameterDefaults[key],scopes:key==='perspective_id'?['reading','session','operation']:key==='active_profile'?['account','reading','session','operation']:['account','reading','session','operation','profile'],sensitive_explicit_only:sensitive.has(key)})),privacy:'Escolhas são privadas. Uma lente interpretativa não declara identidade política, religiosa ou clínica. Tradução preserva o original e não adota lentes.'};
 if(name==='preferences_get')return resolvePreferences(c,r,identity,a.operation);
 if(name==='profile_get')return a.profile_id?{profile:await profile(c,a.profile_id)}:{items:(await c.query('select * from araread.profiles order by created_at desc,id desc limit 50')).rows};
 if(name==='profile_export'){
  const p=await profile(c,a.profile_id),lenses=p.definition.lenses.filter((l:any)=>a.lens_ids.includes(l.id));ensure(lenses.length===new Set(a.lens_ids).size,'INVALID_PROFILE','Uma lente selecionada não pertence ao perfil.');
  const bundle=profileBundle.parse({format:'araread-profile/1',name:p.name,definition:{...p.definition,lenses,values:a.include_values?p.definition.values:{}},declared_author:a.declared_author,usage_terms:a.usage_terms,reviewed_for_sharing:true});
  return {bundle,preview:{name:p.name,lenses:lenses.map((l:any)=>l.name),included_values:Object.keys(bundle.definition.values),declared_author:a.declared_author,usage_terms:a.usage_terms},notice:'Prévia privada, sem publicação. O leitor declarou ter revisado fontes, texto e condições de compartilhamento; essa declaração não certifica direitos de terceiros.'};
 }
 const pref=await one(c,'select * from araread.preferences')||{language:'pt-BR',portion_size:'medium',revision:0};
 if(!r)ensure(pref.revision===a.expected_revision,'CONFLICT','Preferências alteradas em outra sessão. Consulte a revisão atual.',409);
 let result:any={};
 if(name==='preferences_set'||name==='preferences_unset'){
  const scope=a.scope||(r?'reading':'account');ensure(scope!=='reading'||r,'INVALID_SCOPE','Escolha a leitura deste parâmetro.');ensure(scope!=='account'||!r,'INVALID_SCOPE','Preferência da conta não recebe reading_id.');
  const rid=r?.id||null,sid=scope==='session'?identity.session_id:null;
  const values:any={...a.values,...(a.language!==undefined&&a.language!==null?{language:Intl.getCanonicalLocales(a.language)[0]}:{}),...(a.portion_size?{portion_size:a.portion_size}:{}),...a.study};
  // Legacy study selectors remain supported at their original reading scope.
  const legacyStudy:any={};for(const k of Object.keys(values))if(!keys.includes(k as Parameter)){ensure(r&&['representation','note_ids','provider','model'].includes(k),'INVALID_SCOPE','Este seletor pertence a uma leitura.');legacyStudy[k]=values[k];delete values[k];}
  if(a.study?.perspective_id&&!a.values)values.perspective_id=a.study.perspective_id;
  if(name==='preferences_set')await validateValues(c,values,r,a.explicit_request);
  const changed=name==='preferences_set'?Object.keys(values):a.keys;
  if(name==='preferences_set'&&a.language===null)changed.push('language');
  ensure(changed.length||Object.keys(legacyStudy).length,'INVALID_PREFERENCE','Informe os parâmetros a alterar.');
  for(const key of changed){
   const where='owner_id=$1 and scope=$2 and reading_id is not distinct from $3::uuid and session_id is not distinct from $4::uuid and key=$5',params=[uid,scope,rid,sid,key];
   const action=name==='preferences_set'?(a.language===null&&key==='language'?'unset':'set'):a.action;
   const previous=await one(c,`select * from araread.preference_records where ${where}`,params);
   if(['unset','delete'].includes(action)){await c.query(`delete from araread.preference_records where ${where}`,params);}
   else if(action==='disable'||action==='enable'){ensure(previous,'NOT_FOUND','Nenhuma definição registrada nesse escopo para desativar ou reativar.',404);await c.query('update araread.preference_records set state=$2 where id=$1',[previous.id,action==='disable'?'disabled':'active']);}
   else{
    const value=action==='reset'?null:values[key],state=action==='reset'?'default':'active',provenance={origin:'explicit_user_request',scope,recorded_at:new Date().toISOString(),sensitive:sensitive.has(key),inferred:false};
    if(previous)await c.query('update araread.preference_records set value=$2,state=$3,provenance=$4 where id=$1',[previous.id,js(value),state,js(provenance)]);
    else await c.query('insert into araread.preference_records(id,owner_id,scope,reading_id,session_id,key,value,state,provenance) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),...params,js(value),state,js(provenance)]);
   }
   // Remove obsolete mirrors so unset/disable cannot reveal the same old value.
   if(scope!=='session'){
    const table=scope==='reading'?'readings':'preferences',col=scope==='reading'?'id':'owner_id',id=rid||uid;
    if(key==='language'||key==='portion_size')await c.query(`update araread.${table} set ${key}=$2 where ${col}=$1`,[id,scope==='reading'?null:parameterDefaults[key as Parameter]]);
    else await c.query(`update araread.${table} set study=study-$2 where ${col}=$1`,[id,key]);
   }
  }
  if(r&&Object.keys(legacyStudy).length)await c.query('update araread.readings set study=study||$2::jsonb where id=$1',[r.id,js(legacyStudy)]);
  result={scope,changed,action:name==='preferences_set'?'set':a.action,temporary:scope==='session',notes_and_progress_preserved:true};
 }
 if(name==='profile_save'||name==='profile_import'){
  const imported=name==='profile_import',data=imported?a.bundle:a;validateProfileDefinition(data.definition);
  const previous=a.previous_id?await profile(c,a.previous_id):null,id=randomUUID(),version=(previous?.version||0)+1;
  await c.query('insert into araread.profiles(id,owner_id,name,version,previous_id,definition,provenance,active) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,uid,data.name,version,previous?.id||null,js(data.definition),js({declared_author:data.declared_author,usage_terms:data.usage_terms,imported,explicit_request:true,attribution_verified:false}),!imported]);result={profile_id:id,version,active:!imported,selected:false};
 }
 if(name==='profile_manage'){
  await profile(c,a.profile_id);
  if(a.action==='delete'){await c.query("delete from araread.preference_records where key='active_profile' and value=to_jsonb($1::text)",[a.profile_id]);await c.query('delete from araread.profiles where id=$1',[a.profile_id]);}
  else await c.query('update araread.profiles set active=$2 where id=$1',[a.profile_id,a.action==='enable']);
  result={profile_id:a.profile_id,action:a.action,notes_and_progress_preserved:true};
 }
 if(r)await c.query('update araread.readings set revision=revision+1 where id=$1',[r.id]);
 else await c.query('insert into araread.preferences(owner_id,language,portion_size,revision) values($1,$2,$3,$4) on conflict(owner_id) do update set revision=$4',[uid,pref.language,pref.portion_size,pref.revision+1]);
 return {...result,...(r?{reading_id:r.id}:{}),revision:(r?.revision??pref.revision)+1};
}
