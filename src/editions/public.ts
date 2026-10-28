import {publicTransaction} from '../db.ts';
import {editionSchemas} from './contracts.ts';
import {catalog,versionContext} from './service.ts';
import {ensure,AppError} from '../errors.ts';
export async function publicEdition(name:string,input:unknown){
 ensure(name==='edition_catalog'||name==='edition_context','NOT_FOUND','Rota pública não encontrada.',404);
 const parsed=editionSchemas[name].safeParse(input);if(!parsed.success)throw new AppError('VALIDATION','Confira os campos da consulta pública.',400);
 const a:any=parsed.data;ensure(name!=='edition_context'||a.version_id&&!a.project_id,'NOT_FOUND','Projetos editoriais são privados.',404);
 return publicTransaction<any>(c=>name==='edition_catalog'?catalog(c,a):versionContext(c,a.version_id,a.passage_id));
}
