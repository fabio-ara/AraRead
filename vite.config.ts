import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
export default defineConfig(({command})=>({
 base:process.env.ARAREAD_BASE_PATH||'/',build:{target:'es2023',outDir:'dist',assetsInlineLimit:0},
 plugins:[{name:'offline-shell-manifest',generateBundle(_,bundle){this.emitFile({type:'asset',fileName:'offline-assets.json',source:JSON.stringify(Object.keys(bundle).filter(name=>/^assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?)$/.test(name)))});}},{name:'distribution-licenses',generateBundle(){for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','THIRD_PARTY_LICENSES.txt'])this.emitFile({type:'asset',fileName:name==='LICENSE'?'LICENSE.txt':name,source:readFileSync(name,'utf8')});}},{name:'public-csp',transformIndexHtml(){const api=process.env.VITE_API_BASE?new URL(process.env.VITE_API_BASE).origin:'';return [{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${api} ${command==='serve'?'ws://127.0.0.1:4319':''}; object-src 'none'; base-uri 'none'; form-action 'self'`},injectTo:'head-prepend' as const}];}}],
 server:{host:'127.0.0.1',allowedHosts:['127.0.0.1','localhost']},
}));
