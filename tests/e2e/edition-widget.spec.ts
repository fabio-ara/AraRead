import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {widgetHtml} from '../../src/widget.ts';
import {editionDisplay} from '../../src/editions/presentation.ts';
import {editionDefaults} from '../../src/editions/contracts.ts';

test('painel editorial em host sintético: tabela, fórmula, apoio preparado e três abas',async({page})=>{
 const source=randomUUID(),table=randomUUID(),equation=randomUUID(),passage=randomUUID(),segment=randomUUID(),version=randomUUID(),text='Premissa\tLimite\nHipótese\tNão é prova';
 const refs=[{source_id:source,element_id:table,start:0,end:Array.from(text).length},{source_id:source,element_id:equation,start:0,end:5}],errors:string[]=[],requests:string[]=[];
 const context:any={version:{id:version,title:'Material visual sintético',version:1},config:{values:{...editionDefaults,contrast:'high'}},passage:{id:passage,content:{title:'Relações e limites',chapter:'Visual',refs,segments:[{id:segment,representation:'facilitated',text:'Uma hipótese não é prova. A tabela conserva essa distinção.',language:'pt-BR',refs}],supports:[{id:randomUUID(),kind:'context',title:'O papel da tabela',text:'A tabela organiza duas categorias; não prova uma hipótese.',target:{representation:'original',segment_id:table,start:0,end:refs[0].end,exact:text,prefix:'',suffix:''},evidence_ids:[],attribution:'Fixture visual',nature:'synthetic',limits:'Material sintético; nenhuma revisão acadêmica inferida.'}],evidence:[],activities:[]},originals:[{id:table,representation:'original',language:'pt-BR',text,kind:'table',meta:{rows:[['Premissa','Limite'],['Hipótese','Não é prova']]},base_offset:0},{id:equation,representation:'original',language:'pt-BR',text:'x^2+1',kind:'equation',meta:{},base_offset:0}]}},display={...editionDisplay(context,null,false),reader_preferences:context.config.values};
 page.on('pageerror',e=>errors.push(e.message));page.on('download',()=>errors.push('Download proibido.'));page.on('request',r=>requests.push(r.url()));
 await page.setContent('<iframe title="AraRead MCP Apps" sandbox="allow-scripts" style="width:100%;max-width:480px;height:calc(100vh - 16px);border:0"></iframe>');
 await page.evaluate(()=>window.addEventListener('message',event=>{const m=event.data,frame=document.querySelector('iframe')!;if(event.source!==frame.contentWindow||m.jsonrpc!=='2.0')return;if(m.method==='ui/initialize')event.source!.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2026-01-26',hostInfo:{name:'Synthetic visual host',version:'1'},hostCapabilities:{},hostContext:{theme:'light'}}},{targetOrigin:'*'});}));
 await page.locator('iframe').evaluate((e:any,html)=>e.srcdoc=html,widgetHtml);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'AraRead',exact:true})).toBeVisible();
 await page.locator('iframe').evaluate((e:any,data)=>e.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{content:[],structuredContent:{ok:true,data}}},'*'),display);
 await expect(frame.getByRole('tab')).toHaveCount(3);await frame.getByRole('tab',{name:'Original',exact:true}).click();await expect(frame.getByRole('table')).toContainText('Não é prova');await expect(frame.locator('math')).toHaveCount(1);await expect(frame.locator('math')).toContainText('x');
 await frame.getByText('Selecionar texto canônico',{exact:true}).first().click();await frame.locator('.text-segment').filter({hasText:'Premissa'}).last().evaluate(node=>{const text=node.firstChild!,range=document.createRange();range.setStart(text,0);range.setEnd(text,8);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
 await frame.getByRole('button',{name:'Contexto',exact:true}).click();await expect(frame.getByRole('dialog')).toContainText('trecho maior');await expect(frame.getByRole('dialog')).toContainText('não prova uma hipótese');await frame.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.setViewportSize({width:390,height:1000});await mkdir('.local/evidence',{recursive:true});await page.screenshot({path:`.local/evidence/edition-widget-${process.env.PLAYWRIGHT_BROWSER||'chromium'}.png`,fullPage:true});
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});
