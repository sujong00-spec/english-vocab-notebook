import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
page.on('console',m=>console.log(m.type()+': '+m.text()));
page.on('requestfailed',r=>console.log('failed '+r.url()+': '+r.failure()?.errorText));
try {
 await page.goto('http://127.0.0.1:4173');
 const image=await page.evaluate(async()=>{
  await document.fonts.load('40px "Noto Sans CJK KR"');
  const c=document.createElement('canvas');c.width=1300;c.height=500;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='black';ctx.font='40px "Noto Sans CJK KR", sans-serif';
  ['apple : 사과','school : 학교','friend : 친구'].forEach((line,i)=>ctx.fillText(line,70,100+i*120));
  return c.toDataURL().split(',')[1];
 });
 await page.locator('#photo').setInputFiles({name:'printed-words.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.waitForFunction(()=>!document.querySelector('#words').disabled,{timeout:180000});
 console.log('Notice: '+await page.locator('#notice').innerText());
 const text=await page.locator('#words').inputValue();console.log('OCR result: '+text);
 assert.match(text,/apple/i);assert.match(text,/사과/);assert.match(text,/school/i);assert.match(text,/학교/);assert.match(text,/friend/i);assert.match(text,/친구/);
 await page.getByRole('button',{name:'단어장 확인하고 저장'}).click();
 assert.equal(await page.locator('.word-list li').count(),3);
 assert.match(await page.locator('#notice').innerText(),/3개 단어를 저장/);
 console.log('PASS: real eng+kor OCR and saving three clean printed word pairs');
} finally {await browser.close();}
