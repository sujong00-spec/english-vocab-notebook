import {createSpeaker} from './speech.js';
import {KEY,fresh,restore,parseWords,formatWords,updateWords,start,advance,grade,stats,dueWords,directionLabel,prepareImage} from './core.js';
const app=document.querySelector('#app'),notice=document.querySelector('#notice');
let state;
try{state=restore(localStorage.getItem(KEY));}catch{state=fresh();notice.textContent='저장할 수 없는 브라우저입니다. 새로고침 시 진행이 사라질 수 있습니다.';}
let draft=formatWords(state.words),busy=false,photoURL='',ocrActive=false,confidence=[],reviewed=new Set(),shuffle=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(id,text,disabled=false,primary=false)=>`<button id="${id}" ${disabled?'disabled':''} class="${primary?'primary':''}">${text}</button>`;
const speaker=createSpeaker({synthesis:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,onStatus:text=>{notice.textContent=text;}});
const details=w=>[w.pos,w.note].filter(Boolean).map(esc).join(' · ');
function save(next){state=next;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{notice.textContent='저장 공간을 사용할 수 없습니다. 새로고침 시 진행이 사라질 수 있습니다.';}render();}
function reviewRows(){return draft.split(/\r?\n/).map((text,i)=>({text,i,valid:!text.trim()||parseWords(text).length===1})).filter(r=>r.text.trim());}
function renderReview(){
 const target=document.querySelector('#review');if(!target)return;
 const rows=reviewRows();
 target.innerHTML=rows.map(r=>`<div class="review-row ${!r.valid?'invalid':''}">${ocrActive?`<label><input type="checkbox" data-review="${r.i}" ${reviewed.has(r.i+':'+r.text)?'checked':''} ${!r.valid?'disabled':''}> ${r.i+1}줄 확인</label>`:`<span>${r.i+1}줄</span>`}<span>${!r.valid?'형식 수정 필요':ocrActive&&!reviewed.has(r.i+':'+r.text)?confidence[r.i]<85?'인식 주의 · 원본과 비교':'원본과 비교해 주세요':'확인됨'}</span></div>`).join('');
 target.querySelectorAll('[data-review]').forEach(el=>el.onchange=()=>{const row=rows.find(r=>r.i===Number(el.dataset.review));el.checked?reviewed.add(row.i+':'+row.text):reviewed.delete(row.i+':'+row.text);renderReview();});
}
function begin(mode){
 if(draft!==formatWords(state.words)&&!confirm('저장하지 않은 입력이 있습니다. 저장된 단어장으로 시험을 시작할까요?'))return;
 try{notice.textContent='';save(start(state,{mode,shuffle}));}catch(e){notice.textContent=e.message;}
}
function historyHTML(){
 if(!state.history.length)return '<p class="hint">채점을 모두 마치면 첫 시험 점수와 복습 기록이 여기에 남아요.</p>';
 const first=state.history.find(h=>h.mode==='full'&&h.direction===state.direction);
 return `${first?`<p>${directionLabel(state.direction)} 첫 시험: <strong>${first.exam.filter(w=>first.grades[w.id]).length} / ${first.exam.length}</strong> · ${first.imported?'이전 버전에서 복원 · 시험 일시 미상':esc(new Date(first.finishedAt).toLocaleDateString('ko-KR'))}</p>`:''}<details><summary>시험 기록 ${state.history.length}회 보기</summary><ol>${state.history.map(h=>`<li>${h.imported?'이전 버전에서 복원 · 시험 일시 미상':esc(new Date(h.finishedAt).toLocaleString('ko-KR'))} · ${h.mode==='wrong'?'오답':h.mode==='due'?'다음날 복습':'전체'} ${h.round}회차 · ${directionLabel(h.direction)} · ${h.exam.filter(w=>h.grades[w.id]).length}/${h.exam.length}<ul>${h.exam.map(w=>`<li>${esc(w.english)} · ${esc(w.korean)} — ${h.grades[w.id]?'맞음':'틀림'}</li>`).join('')}</ul></li>`).join('')}</ol></details>`;
}
function render(){
 speaker.stop();
 if(state.phase==='setup')renderSetup();else if(state.phase==='exam')renderExam();else renderGrading();
}
function renderSetup(){
 const due=dueWords(state);
 app.innerHTML=`<div class="eyebrow">MY ENGLISH NOTEBOOK</div><h1>오늘의 단어, 공책에 써 볼까요?</h1><p>시험 방향을 고르고 답은 공책에 써요. 채점은 보호자와 함께해요.</p><div class="grid"><section class="card"><h2>01 &nbsp; 단어장 준비</h2><p class="hint">영어 : 한글 뜻 | 품사 | 구분 설명<br>예: see : 보다 | 동사 | 눈으로 보이다<br>품사와 설명은 생략해도 됩니다. 뜻·품사·설명은 한글로 적어 주세요.</p><div class="actions"><label class="upload">사진에서 가져오기<input id="photo" class="sr-only" type="file" accept="image/*" ${busy?'disabled':''}></label>${button('sample','예시 넣기',busy)}</div><p class="hint" id="ocr-status" role="status">${busy?'사진을 읽고 있어요…':'밝고 정면에서 찍은 인쇄 단어장이 잘 인식돼요.'}</p><div class="ocr-editor ${photoURL?'with-photo':''}">${photoURL?`<figure class="source-photo"><a href="${esc(photoURL)}" target="_blank" rel="noopener"><img src="${esc(photoURL)}" alt="등록한 단어장 원본 사진"></a><figcaption>사진을 누르면 크게 볼 수 있어요. 인식 결과와 줄별로 비교하세요.</figcaption></figure>`:''}<div class="text-editor"><label for="words" class="hint">단어 입력 · OCR 결과 수정</label><textarea id="words" placeholder="apple : 사과&#10;see : 보다 | 동사 | 눈으로 보이다" ${busy?'disabled':''}>${esc(draft)}</textarea></div></div><div id="review" aria-label="줄별 확인"></div><p class="hint">OCR 결과는 모든 줄을 확인 표시한 뒤 저장해 주세요.</p>${button('store','단어장 확인하고 저장',busy,true)}</section><section class="card"><h2>02 &nbsp; 시험 준비</h2><div class="steps">① 문제를 보고 공책에 답 쓰기<br>② 마지막 문제까지 풀고 정답표 열기<br>③ 보호자 채점 → 오답 재시험 → 다음날 확인</div><fieldset class="direction"><legend>시험 방향</legend><label><input type="radio" name="direction" value="ko-en" ${state.direction==='ko-en'?'checked':''}> 한글 뜻 → 영어 쓰기</label><label><input type="radio" name="direction" value="en-ko" ${state.direction==='en-ko'?'checked':''}> 영어 → 한글 뜻 쓰기</label></fieldset><p class="hint">선택한 방향별로 오답과 복습 기록을 따로 관리해요. 영어 문제는 발음도 들을 수 있어요.</p><ul class="word-list">${state.words.length?state.words.map(w=>{const s=stats(state,w.id);return `<li><div><strong>${esc(w.english)}</strong><div class="hint">${esc(w.korean)} ${details(w)}</div></div><span class="hint">${s.attempts?`오답 ${s.errors}회<br>${s.confirmed?'다른 날 정답 확인':s.correct?'다음날 확인 필요':'다시 연습해요'}`:'아직 시험 전'}</span></li>`;}).join(''):'<li class="empty">아직 저장한 단어가 없어요.</li>'}</ul><label class="shuffle"><input type="checkbox" id="shuffle" ${shuffle?'checked':''}> 문제 순서 섞기 (시험 중에는 순서 유지)</label><p class="hint">총 ${state.words.length}개 · 진행과 채점 결과 자동 저장</p>${button('begin','시험 시작하기',!state.words.length||busy,true)}<div class="review-plan"><h3>하루 뒤 다시 확인</h3><p class="hint">지난 날짜에 채점한 단어를 다시 풀어요. 오늘 바로 맞혀도 다른 날 확인하기 전에는 학습 완료로 보지 않아요.</p>${button('due',`오늘 복습 ${due.length}개 시작`,!due.length||busy)}<p class="hint">${!due.length&&state.history.length?'오늘 채점한 단어는 내일 복습할 수 있어요.':''}</p></div><div class="actions">${button('export','단어장 내보내기',!state.words.length||busy)}${button('export-history','학습 기록 내보내기',!state.history.length||busy)}</div></section></div><section class="card history"><h2>학습 기록</h2>${historyHTML()}</section>`;
 document.querySelectorAll('[name=direction]').forEach(input=>input.onchange=()=>save({...state,direction:input.value}));
 document.querySelector('#words').oninput=e=>{draft=e.target.value;renderReview();};renderReview();
 document.querySelector('#shuffle').onchange=e=>{shuffle=e.target.checked;};
 document.querySelector('#sample').onclick=()=>{draft='apple : 사과\nschool : 학교\nfriend : 친구\nbeautiful : 아름다운\ntake care of : 돌보다';ocrActive=false;reviewed.clear();render();};
 document.querySelector('#store').onclick=()=>{
  const rows=reviewRows(),bad=rows.filter(r=>!r.valid);
  if(!rows.length||bad.length){notice.textContent=`${bad.length}개 줄을 확인해 주세요.${bad.length?' ('+bad.map(r=>r.i+1).join(', ')+'줄)':''} 영어 : 한글 뜻 형식으로 수정한 뒤 저장하세요.`;return;}
  if(ocrActive&&rows.some(r=>!reviewed.has(r.i+':'+r.text))){notice.textContent='원본 사진과 비교한 뒤 모든 줄에 확인 표시를 해 주세요.';return;}
  const words=parseWords(draft);save(updateWords(state,words));draft=formatWords(state.words);ocrActive=false;render();notice.textContent=words.length+'개 단어를 저장했어요. 기존 학습 기록도 보존했어요.';
 };
 document.querySelector('#begin').onclick=()=>begin('full');document.querySelector('#due').onclick=()=>begin('due');
 document.querySelector('#export').onclick=()=>download('영어-단어장.txt',formatWords(state.words),'text/plain');
 document.querySelector('#export-history').onclick=()=>download('영어-학습기록.json',JSON.stringify(state.history,null,2),'application/json');
 document.querySelector('#photo').onchange=readPhoto;
}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderExam(){
 const reverse=state.direction==='en-ko';
 const w=state.exam[state.index],original=w.originalNumber||state.words.findIndex(o=>o.id===w.id)+1;
 app.innerHTML=`<section class="exam"><div class="exam-top"><span>${state.round}번째 ${state.mode==='wrong'?'오답 시험':state.mode==='due'?'다음날 복습':'시험'}</span><strong>${state.index+1} / ${state.exam.length} 문제</strong>${button('leave','시험 나가기')}</div><div class="progress" role="progressbar" aria-label="시험 진행" aria-valuenow="${state.index+1}" aria-valuemin="0" aria-valuemax="${state.exam.length}"><span style="width:${(state.index+1)/state.exam.length*100}%"></span></div><div class="card question"><span class="badge">원래 단어장 ${original}번</span><h1>${esc(reverse?w.english:w.korean)}</h1>${!reverse&&details(w)?`<p class="context">${details(w)}</p>`:''}<p>${directionLabel(state.direction)}</p>${reverse?button('pronounce','영어 발음 듣기',!speaker.supported):''}<p>새 줄에 ‘${state.round}회차 ${state.index+1}번’을 쓰고 ${reverse?'한글 뜻':'영어 답'}을 적어 주세요.</p></div><div class="actions">${button('previous','이전 문제',state.index===0)}${button('next',state.index+1===state.exam.length?'다 썼어요 · 정답표 보기':'썼어요 · 다음 문제',false,true)}</div><p class="hint">정답은 모든 문제를 푼 다음에 보여 드려요. 오답 시험도 새 줄에 써요.${reverse&&!speaker.supported?' 이 브라우저는 발음을 지원하지 않아요.':''}</p></section>`;
 document.querySelector('#pronounce')?.addEventListener('click',()=>speaker.speak(w.english));
 document.querySelector('#previous').onclick=()=>save({...state,index:state.index-1});
 document.querySelector('#next').onclick=()=>save(advance(state));
 document.querySelector('#leave').onclick=()=>{if(confirm('이번 시험을 종료할까요? 이전에 완료한 학습 기록은 보존됩니다.'))save({...state,phase:'setup',exam:[],grades:{},index:0});};
}
function renderGrading(){
 const graded=state.exam.filter(w=>typeof state.grades[w.id]==='boolean').length,correct=state.exam.filter(w=>state.grades[w.id]===true).length,wrong=state.exam.filter(w=>state.grades[w.id]===false).length;
 app.innerHTML=`<div class="eyebrow">ANSWER & REVIEW</div><h1>다 썼어요! 함께 채점해요.</h1><p>보호자가 ${state.round}회차 공책 답안의 ${state.direction==='en-ko'?'한글 뜻':'영어 철자'}를 비교해 주세요.<br>${state.direction==='en-ko'?'학원에서 인정하는 뜻과 비교해 채점해요.':'비슷한 뜻이라도 학원에서 요구한 단어·철자에 맞춰 채점해요.'}</p><div class="card"><h2>${graded} / ${state.exam.length}개 채점 · 맞음 ${correct} · 틀림 ${wrong}</h2>${state.exam.map((w,i)=>`<div class="grade-row"><span>${i+1}</span><div><strong>${esc(state.direction==='en-ko'?w.korean:w.english)}</strong><p>${esc(state.direction==='en-ko'?w.english:w.korean)} ${details(w)}</p><button data-speak="${esc(w.id)}" ${!speaker.supported?'disabled':''} aria-label="${i+1}번 영어 발음 듣기">발음 듣기</button><small>원래 단어장 ${w.originalNumber||i+1}번</small></div><div class="grade-buttons" role="group" aria-label="${i+1}번 채점"><button data-id="${esc(w.id)}" data-grade="true" aria-pressed="${state.grades[w.id]===true}" class="${state.grades[w.id]===true?'selected-true':''}">맞음</button><button data-id="${esc(w.id)}" data-grade="false" aria-pressed="${state.grades[w.id]===false}" class="${state.grades[w.id]===false?'selected-false':''}">틀림</button></div></div>`).join('')}<div class="actions">${button('retry',`오답 ${wrong}개 다시 시험`,graded!==state.exam.length||!wrong,true)}${button('home','단어장으로')}</div><label class="shuffle"><input type="checkbox" id="shuffle" ${shuffle?'checked':''}> 오답 순서 섞기</label><p class="hint">${graded!==state.exam.length?'모든 단어를 채점하면 오답 시험을 시작할 수 있어요.':wrong?'채점 기록을 저장했어요. 오답은 공책의 새 줄에서 다시 풀어요.':'오늘은 모두 맞았어요! 다음날 다시 기억하는지 확인해요.'}</p></div>`;
 document.querySelector('#shuffle').onchange=e=>{shuffle=e.target.checked;};
 document.querySelectorAll('[data-speak]').forEach(b=>b.onclick=()=>speaker.speak(state.exam.find(w=>w.id===b.dataset.speak).english));
 document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{const id=b.dataset.id,value=b.dataset.grade;save(grade(state,id,value==='true'));document.querySelector(`[data-id="${CSS.escape(id)}"][data-grade="${value}"]`).focus({preventScroll:true});});
 document.querySelector('#retry').onclick=()=>{notice.textContent='';save(start(state,{mode:'wrong',shuffle}));};
 document.querySelector('#home').onclick=()=>{if(graded!==state.exam.length&&!confirm('채점하지 않은 단어가 있습니다. 단어장으로 돌아갈까요? 미완료 시험은 기록되지 않습니다.'))return;save({...state,phase:'setup'});};
}
async function readPhoto(event){
 const file=event.target.files[0];if(!file)return;
 if(file.size>20*1024*1024){notice.textContent='20MB 이하 사진을 선택해 주세요.';return;}
 if(draft.trim()&&!confirm('현재 입력 내용을 사진 인식 결과로 바꿀까요? 저장된 단어장은 유지됩니다.'))return;
 if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);busy=true;ocrActive=false;reviewed.clear();render();notice.textContent='';let worker;
 try{
  const image=await prepareImage(file);
  const {default:{createWorker}}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js');
  worker=await createWorker('eng+kor',1,{logger:m=>{const el=document.querySelector('#ocr-status');if(el)el.textContent=m.status==='recognizing text'?'단어를 읽고 있어요… '+Math.round(m.progress*100)+'%':'인식 도구를 준비하고 있어요…';}});
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const {data}=await worker.recognize(image);if(!data.text.trim())throw new Error('empty');
  draft=data.text.trim();confidence=draft.split(/\r?\n/).map(text=>(data.lines||[]).find(l=>l.text?.trim()===text.trim())?.confidence);ocrActive=true;
  notice.textContent='원본과 영어 철자·한글 뜻·줄 순서를 비교하고 확인 표시한 다음 저장하세요. 인식되지 않은 단어도 직접 추가하세요.';
 }catch{notice.textContent='사진을 읽지 못했어요. 연결과 사진 형식을 확인하거나 원본을 보며 직접 입력해 주세요.';}
 finally{try{if(worker)await worker.terminate();}finally{busy=false;render();}}
}
window.addEventListener('pagehide',()=>speaker.stop());
render();
// Recalculate the day's review queue when returning to a tablet left open overnight.
document.addEventListener('visibilitychange',()=>{if(document.hidden)speaker.stop();else if(state.phase==='setup'&&!busy)render();});
