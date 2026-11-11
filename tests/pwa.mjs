import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel=manifest]').href)).json());
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.equal(manifest.icons.length,3);
 const cdp=await context.newCDPSession(page),result=await cdp.send('Page.getAppManifest');assert.equal(result.errors.filter(e=>e.critical).length,0);
 // Install requires a user gesture: expose an event, then click the real UI button.
 await page.evaluate(()=>{window.prompts=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.prompts++;};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e);});
 assert.equal(await page.evaluate(()=>prompts),0);
 await page.getByRole('button',{name:'앱으로 설치',exact:true}).click();
 assert.equal(await page.evaluate(()=>prompts),1);assert.match(await page.locator('#offline-status').innerText(),/취소/);
 await page.locator('#words').fill('apple : 사과\nschool : 학교');await page.getByRole('button',{name:'단어장 확인하고 저장'}).click();
 await page.getByRole('radio',{name:'영어 → 한글 뜻 쓰기',exact:true}).check();await page.getByRole('button',{name:'시험 시작하기'}).click();
 assert.equal(await page.locator('#install-panel').isVisible(),false);
 await context.setOffline(true);await page.reload();
 assert.equal(await page.getByRole('heading',{name:'apple',exact:true}).count(),1);
 await page.getByRole('button',{name:'썼어요 · 다음 문제'}).click();await page.reload();
 assert.equal(await page.getByRole('heading',{name:'school',exact:true}).count(),1);
 await page.getByRole('button',{name:'다 썼어요 · 정답표 보기'}).click();
 await page.getByRole('group',{name:'1번 채점',exact:true}).getByRole('button',{name:'틀림',exact:true}).click();
 await page.getByRole('group',{name:'2번 채점',exact:true}).getByRole('button',{name:'맞음',exact:true}).click();
 await page.getByRole('button',{name:'오답 1개 다시 시험'}).click();await page.reload();
 assert.equal(await page.getByRole('heading',{name:'apple',exact:true}).count(),1);
 await page.getByRole('button',{name:'다 썼어요 · 정답표 보기'}).click();await page.getByRole('group',{name:'1번 채점',exact:true}).getByRole('button',{name:'맞음',exact:true}).click();
 await page.getByRole('button',{name:'단어장으로',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vocab-notebook.v1')).history.length),2);
 await page.getByRole('radio',{name:'한글 뜻 → 영어 쓰기',exact:true}).check();await page.getByRole('button',{name:'시험 시작하기'}).click();await page.reload();
 assert.equal(await page.getByRole('heading',{name:'사과',exact:true}).count(),1);
 // Cold reopen of the installed app's start URL also works without a network.
 const reopened=await context.newPage();await reopened.goto('http://127.0.0.1:4173/');assert.equal(await reopened.getByRole('heading',{name:'사과',exact:true}).count(),1);await reopened.close();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/offline-exam.png',fullPage:true});
 console.log('PASS: manifest/CDP validation, user-triggered install UI, real service worker cache, offline cold start/reload, both directions, grading, retry and saved history');
}finally{await browser.close();}
