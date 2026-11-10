// Optional CLI runner: install Playwright in your test environment first.
// The same suite can be passed directly to the browser tool by filename.
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
const {chromium}=await import('playwright').catch(()=>{throw Error('Install Playwright in your test environment, or run scripts/test-svg-paint-browser.js with the Playwright browser tool.');});
const suite=runInThisContext(await readFile(new URL('./test-svg-paint-browser.js',import.meta.url),'utf8'));
const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage();
try{const result=await suite(page,{baseURL:process.argv[2],screenshot:process.argv[3]});console.log(JSON.stringify(result,null,2));if(result.failed||result.errors.length)process.exitCode=1;}finally{await browser.close();}
