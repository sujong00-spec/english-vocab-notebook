import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{
  window.speechCalls=[];window.cancelCalls=0;
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}}});
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-US'}],cancel:()=>window.cancelCalls++,speak:u=>window.speechCalls.push({text:u.text,lang:u.lang})}});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.locator('#words').fill('see : 보다 | 동사 | 눈으로 보이다\nwatch : 보다 | 동사 | 주의 깊게 보다');
 await page.getByRole('button',{name:'단어장 확인하고 저장'}).click();
 await page.getByRole('radio',{name:'영어 → 한글 뜻 쓰기',exact:true}).check();
 await page.reload();assert.equal(await page.getByRole('radio',{name:'영어 → 한글 뜻 쓰기',exact:true}).isChecked(),true);
 await page.getByRole('button',{name:'시험 시작하기'}).click();
 assert.equal(await page.getByRole('heading',{name:'see',exact:true}).count(),1);
 assert.equal(await page.getByText('보다',{exact:true}).count(),0);
 assert.equal(await page.locator('.context').count(),0);
 assert.equal((await page.evaluate(()=>speechCalls)).length,0);
 await page.getByRole('button',{name:'영어 발음 듣기',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>speechCalls),[{text:'see',lang:'en-US'}]);
 const canceled=await page.evaluate(()=>cancelCalls);
 await page.getByRole('button',{name:'썼어요 · 다음 문제'}).click();assert.ok(await page.evaluate(()=>cancelCalls)>canceled);
 await page.reload();assert.equal(await page.getByRole('heading',{name:'watch',exact:true}).count(),1);
 await page.getByRole('button',{name:'다 썼어요 · 정답표 보기'}).click();
 assert.equal(await page.locator('.grade-row strong').first().innerText(),'보다');
 await page.getByRole('button',{name:'1번 영어 발음 듣기',exact:true}).click();
 assert.equal((await page.evaluate(()=>speechCalls)).at(-1).text,'see');
 await page.getByRole('group',{name:'1번 채점',exact:true}).getByRole('button',{name:'틀림',exact:true}).click();
 await page.getByRole('group',{name:'2번 채점',exact:true}).getByRole('button',{name:'맞음',exact:true}).click();
 await page.getByRole('button',{name:'오답 1개 다시 시험'}).click();
 assert.equal(await page.getByRole('heading',{name:'see',exact:true}).count(),1);
 await page.getByRole('button',{name:'다 썼어요 · 정답표 보기'}).click();
 await page.getByRole('group',{name:'1번 채점',exact:true}).getByRole('button',{name:'맞음',exact:true}).click();
 await page.getByRole('button',{name:'단어장으로',exact:true}).click();
 await page.getByRole('radio',{name:'한글 뜻 → 영어 쓰기',exact:true}).check();
 assert.equal(await page.getByText('아직 시험 전',{exact:true}).count(),2);
 await page.getByRole('button',{name:'시험 시작하기'}).click();
 assert.equal(await page.getByRole('heading',{name:'보다',exact:true}).count(),1);
 assert.equal(await page.getByText('see',{exact:true}).count(),0);
 assert.equal(await page.locator('[data-speak],#pronounce').count(),0);
 await page.getByRole('button',{name:'썼어요 · 다음 문제'}).click();
 await page.getByRole('button',{name:'다 썼어요 · 정답표 보기'}).click();
 await page.getByRole('button',{name:'1번 영어 발음 듣기',exact:true}).click();assert.equal((await page.evaluate(()=>speechCalls)).at(-1).text,'see');
 assert.deepEqual(errors,[]);
 // Unsupported devices must still be able to take and grade the reverse exam.
 const other=await browser.newPage();await other.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:undefined}));
 await other.goto('http://127.0.0.1:4173');await other.getByRole('button',{name:'예시 넣기'}).click();await other.getByRole('button',{name:'단어장 확인하고 저장'}).click();
 await other.getByRole('radio',{name:'영어 → 한글 뜻 쓰기',exact:true}).check();await other.getByRole('button',{name:'시험 시작하기'}).click();
 assert.equal(await other.getByRole('button',{name:'영어 발음 듣기',exact:true}).isDisabled(),true);
 for(const width of [1024,768,390]){await other.setViewportSize({width,height:1024});assert.equal(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await other.screenshot({path:'test-results/tablet-reverse-exam.png',fullPage:true});await other.close();
 console.log('PASS: both directions, hidden answers, direction restoration, grading/retry, independent records, speech calls/cancellation and unsupported devices');
}finally{await browser.close();}
