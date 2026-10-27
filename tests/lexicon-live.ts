// Prova externa explícita; separada dos testes de domínio determinísticos.
import assert from 'node:assert/strict';
import {fetchPublicHtml} from '../src/importers.ts';
import {dictionaryExcerpt} from '../src/study/vocabulary.ts';
for(const [term,language]of [['casa','pt'],['ontology','en'],['free will','en']]){
 const url=`https://${language}.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g,'_'))}`,definitions=dictionaryExcerpt((await fetchPublicHtml(url)).toString('utf8'),language);
 assert.ok(definitions.length>0,`Definição ausente para ${term}`);assert.ok(definitions.every(d=>Array.from(d).length<=401));
 console.log(JSON.stringify({term,language,url,definitions:definitions.length,characters:definitions.map(d=>Array.from(d).length),consulted_at:new Date().toISOString()}));
}
