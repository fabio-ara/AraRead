import {defineConfig} from 'vite';
export default defineConfig({build:{target:'es2023',outDir:'dist',assetsInlineLimit:0},server:{host:'127.0.0.1',allowedHosts:['127.0.0.1','localhost']}});
