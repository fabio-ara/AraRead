import {test,expect} from '@playwright/test';
import {buildSync} from 'esbuild';
const script=buildSync({entryPoints:['src/reader-selection.ts'],bundle:true,write:false,format:'iife',globalName:'selectionTest',platform:'browser',target:'es2023'}).outputFiles[0].text;
test('mapeamento real DOM/UTF16/CP: espaços, nós formatados, reversa, emoji, RTL e repetidos',async({page})=>{
 await page.goto('about:blank');await page.setContent('<main><div id="root" tabindex="0"></div></main>');await page.addScriptTag({content:script});
 const results=await page.evaluate(()=>{
  const api=(window as any).selectionTest,root=document.getElementById('root')!,out:any[]=[];
  const cases=[{text:'  palavra\t\n palavra   é 😀 العربية  ',from:12,to:19,normalized:true},{text:'repetida repetida',from:9,to:17},{text:'é 👩🏽‍🔬 עברית',from:3,to:7},{text:'abc العربية xyz',from:4,to:11}];
  for(const c of cases){api.renderMappedText(root,c.text,{preserveWhitespace:!c.normalized});
   // Splitting rendered text into bold/italic nodes preserves its positional map.
   const rendered=root.textContent!,bold=document.createElement('b'),italic=document.createElement('i');bold.textContent=rendered.slice(0,4);italic.textContent=rendered.slice(4);root.replaceChildren(bold,italic);api.registerMappedText(root,c.text);
   const r=api.rangeForOffsets(root,c.from,c.to);if(!r){out.push({missing:true});continue;}const sel=window.getSelection()!;sel.removeAllRanges();sel.setBaseAndExtent(r.endContainer,r.endOffset,r.startContainer,r.startOffset);out.push(api.selectionOffsets(root));
  }
  api.renderMappedText(root,'é 😀');const node=root.firstChild!,r=document.createRange();r.setStart(node,0);r.setEnd(node,1);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(r);out.push(api.selectionOffsets(root));return out;
 });
 expect(results[0]).toMatchObject({start:12,end:19,exact:'palavra',prefix:'  palavra\t\n '});
 expect(results[1]).toMatchObject({start:9,end:17,exact:'repetida'});
 expect(results[2]).toMatchObject({start:3,end:7,exact:'👩🏽‍🔬'});
 expect(results[3]).toMatchObject({start:4,end:11,exact:'العربية'});expect(results[4]).toBeNull();
});
