import puppeteer from 'puppeteer';
const URL='https://future-coach-production.up.railway.app';
const b=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],defaultViewport:{width:1440,height:900}});
const p=await b.newPage();
p.on('pageerror',e=>console.log('PAGEERROR>',e.message.split('\n')[0]));
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE.ERR>', m.text().slice(0,300)); });
await p.goto(URL,{waitUntil:'networkidle2',timeout:60000});
await p.waitForFunction(()=>document.querySelectorAll('.nav-item').length>20,{timeout:30000});
// dismiss onboarding
await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(e=>/Skip for now/.test(e.innerText)); x&&x.click();});
await new Promise(r=>setTimeout(r,800));
console.log('clicking Graph Explorer...');
await p.evaluate(()=>{const x=[...document.querySelectorAll('.nav-item')].find(e=>/Graph Explorer/.test(e.innerText)); x&&x.click();});
await new Promise(r=>setTimeout(r,3500));
console.log('navItems after graph click:', await p.evaluate(()=>document.querySelectorAll('.nav-item').length));
console.log('root children:', await p.evaluate(()=>document.getElementById('root')?.childElementCount));
await b.close();
