// Optional CLI runner; the suite also works directly in the Playwright tool.
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
const {chromium}=await import('playwright').catch(()=>{throw Error('Install Playwright in the test environment, or pass scripts/test-automata-browser.js to the Playwright browser tool.');});
const suite=runInThisContext(await readFile(new URL('./test-automata-browser.js',import.meta.url),'utf8'));
const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage();
try{const result=await suite(page,{baseURL:process.argv[2]});console.log(JSON.stringify(result,null,2));if(result.failed||result.errors.length)process.exitCode=1;}finally{await browser.close();}
