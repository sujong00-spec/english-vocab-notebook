import {KEY, fresh, restore, parseWords, start, advance, prepareImage} from './core.js';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
let state;
try { state = restore(localStorage.getItem(KEY)); } catch { state = fresh(); notice.textContent = '이 브라우저에서는 저장할 수 없습니다. 새로고침 시 진행이 사라질 수 있습니다.'; }
let draft = state.words.map(w => w.english + ' : ' + w.korean).join('\n');
let busy = false;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { notice.textContent = '저장 공간을 사용할 수 없습니다. 새로고침 시 진행이 사라질 수 있습니다.'; }
  render();
}
function render() {
  if(state.phase === 'setup') {
    app.innerHTML = `<div class="eyebrow">MY ENGLISH NOTEBOOK</div><h1>오늘의 단어, 공책에 써 볼까요?</h1><p>단어장을 준비하면 한글 뜻만 하나씩 보여 드려요.<br>영어 철자는 실제 공책에 쓰고, 채점은 보호자와 함께해요.</p><div class="grid"><section class="card"><h2>01 &nbsp; 단어장 준비</h2><p class="hint">영어 : 한글 뜻을 한 줄에 하나씩 입력하세요.</p><div class="actions"><label class="upload">사진에서 가져오기<input id="photo" class="sr-only" type="file" accept="image/*" ${busy?'disabled':''}></label><button id="sample" ${busy?'disabled':''}>예시 넣기</button></div><p class="hint" id="ocr-status" role="status">${busy?'사진을 읽고 있어요…':'밝고 정면에서 찍은 인쇄 단어장이 잘 인식돼요.'}</p><label for="words" class="hint">단어 입력 · OCR 결과 수정</label><textarea id="words" placeholder="apple : 사과&#10;school : 학교&#10;take care of : 돌보다" ${busy?'disabled':''}>${esc(draft)}</textarea><p class="hint">OCR 결과는 꼭 확인하세요. 저장되지 않는 줄은 안내해 드려요.</p><button class="primary full" id="store" ${busy?'disabled':''}>단어장 확인하고 저장</button></section><section class="card"><h2>02 &nbsp; 시험 준비</h2><div class="steps">① 한글 뜻을 보고 공책에 영어 쓰기<br>② 마지막 문제까지 풀고 정답표 열기<br>③ 보호자가 채점하고 오답만 다시 풀기</div><ul class="word-list">${state.words.length?state.words.map(w=>`<li><strong>${esc(w.english)}</strong><span>${esc(w.korean)}</span></li>`).join(''):'<li class="empty">아직 저장한 단어가 없어요.</li>'}</ul><p class="hint">총 ${state.words.length}개 · 진행 상황은 이 브라우저에 자동 저장돼요.</p><button id="begin" class="primary full" ${!state.words.length||busy?'disabled':''}>시험 시작하기</button><div class="actions"><button id="export" ${!state.words.length||busy?'disabled':''}>단어장 내보내기</button></div></section></div>`;
    document.querySelector('#words').oninput = e => {draft = e.target.value;};
    document.querySelector('#sample').onclick = () => {draft='apple : 사과\nschool : 학교\nfriend : 친구\nbeautiful : 아름다운\ntake care of : 돌보다';render();};
    document.querySelector('#store').onclick = () => {
      const words = parseWords(draft), total = draft.split(/\r?\n/).filter(l=>l.trim()).length;
      if(words.length !== total || !words.length) {notice.textContent=`${total-words.length}개 줄을 확인해 주세요. 영어 : 한글 뜻 형식으로 모든 줄을 수정한 뒤 저장하세요.`;return;}
      save(fresh(words)); notice.textContent = words.length+'개 단어를 저장했어요.';
    };
    document.querySelector('#begin').onclick = () => {
      if(draft !== state.words.map(w=>w.english+' : '+w.korean).join('\n') && !confirm('저장하지 않은 입력이 있습니다. 저장된 단어장으로 시험을 시작할까요?')) return;
      notice.textContent='';save(start(state));
    };
    document.querySelector('#export').onclick = () => {
      const url=URL.createObjectURL(new Blob([state.words.map(w=>w.english+' : '+w.korean).join('\n')],{type:'text/plain;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='영어-단어장.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    document.querySelector('#photo').onchange = readPhoto;
  } else if(state.phase === 'exam') {
    const word=state.exam[state.index];
    app.innerHTML=`<section class="exam"><div class="exam-top"><span>${state.round}번째 시험</span><strong>${state.index+1} / ${state.exam.length} 문제</strong><button id="leave">시험 나가기</button></div><div class="progress" role="progressbar" aria-label="시험 진행" aria-valuenow="${state.index+1}" aria-valuemin="0" aria-valuemax="${state.exam.length}"><span style="width:${(state.index+1)/state.exam.length*100}%"></span></div><div class="card question"><span class="badge">공책에 영어 철자를 써 주세요</span><h1>${esc(word.korean)}</h1><p>공책 ${state.index+1}번에 답을 적었나요?</p></div><div class="actions"><button id="previous" ${state.index===0?'disabled':''}>이전 문제</button><button id="next" class="primary">${state.index+1===state.exam.length?'다 썼어요 · 정답표 보기':'썼어요 · 다음 문제'}</button></div><p class="hint">정답은 모든 문제를 푼 다음에 보여 드려요.</p></section>`;
    document.querySelector('#previous').onclick=()=>save({...state,index:state.index-1});
    document.querySelector('#next').onclick=()=>save(advance(state));
    document.querySelector('#leave').onclick=()=>{if(confirm('시험을 끝내고 단어장으로 돌아갈까요? 이번 시험 진행은 초기화됩니다.')) save({...state,phase:'setup',exam:[],grades:{},index:0});};
  } else {
    const graded=state.exam.filter(w=>typeof state.grades[w.id]==='boolean').length;
    const correct=state.exam.filter(w=>state.grades[w.id]===true).length;
    const wrong=state.exam.filter(w=>state.grades[w.id]===false).length;
    app.innerHTML=`<div class="eyebrow">ANSWER & REVIEW</div><h1>다 썼어요! 함께 채점해요.</h1><p>보호자가 공책의 철자와 정답을 비교하고 맞음 / 틀림을 눌러 주세요.</p><div class="card"><h2>${graded} / ${state.exam.length}개 채점 · 맞음 ${correct} · 틀림 ${wrong}</h2>${state.exam.map((w,i)=>`<div class="grade-row"><span>${i+1}</span><div><strong>${esc(w.english)}</strong><p>${esc(w.korean)}</p></div><div class="grade-buttons" role="group" aria-label="${i+1}번 채점"><button data-id="${esc(w.id)}" data-grade="true" aria-pressed="${state.grades[w.id]===true}" class="${state.grades[w.id]===true?'selected-true':''}">맞음</button><button data-id="${esc(w.id)}" data-grade="false" aria-pressed="${state.grades[w.id]===false}" class="${state.grades[w.id]===false?'selected-false':''}">틀림</button></div></div>`).join('')}<div class="actions"><button id="retry" class="primary" ${graded!==state.exam.length||!wrong?'disabled':''}>오답 ${wrong}개 다시 시험</button><button id="home">단어장으로</button></div><p class="hint">${graded!==state.exam.length?'모든 단어를 채점하면 오답 시험을 시작할 수 있어요.':wrong?'오답 시험에도 정답은 마지막에만 나와요.':'모두 맞았어요! 수고했어요.'}</p></div>`;
    document.querySelectorAll('[data-grade]').forEach(button=>button.onclick=()=>{
      const focusId=button.dataset.id, grade=button.dataset.grade;
      save({...state,grades:{...state.grades,[focusId]:grade==='true'}});
      document.querySelector(`[data-id="${CSS.escape(focusId)}"][data-grade="${grade}"]`).focus({preventScroll:true});
    });
    document.querySelector('#retry').onclick=()=>{notice.textContent='';save(start(state,true));};
    document.querySelector('#home').onclick=()=>{if(graded!==state.exam.length&&!confirm('채점하지 않은 단어가 있습니다. 단어장으로 돌아갈까요?'))return;save({...state,phase:'setup'});};
  }
}
async function readPhoto(event) {
  const file=event.target.files[0]; if(!file)return;
  if(file.size>20*1024*1024){notice.textContent='20MB 이하 사진을 선택해 주세요.';return;}
  if(draft.trim()&&!confirm('현재 입력 내용을 사진 인식 결과로 바꿀까요? 저장된 단어장은 유지됩니다.'))return;
  busy=true;render();notice.textContent='';let worker;
  try {
    const image=await prepareImage(file);
    const {default: {createWorker}}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js');
    worker=await createWorker('eng+kor',1,{logger:m=>{const status=document.querySelector('#ocr-status');if(status)status.textContent=m.status==='recognizing text'?'단어를 읽고 있어요… '+Math.round(m.progress*100)+'%':'인식 도구를 준비하고 있어요…';}});
    await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
    const {data}=await worker.recognize(image);
    if(!data.text.trim())throw new Error('empty');
    draft=data.text.trim();
    notice.textContent='사진을 읽었어요. 영어 철자와 한글 뜻, 줄 순서를 확인하고 수정한 다음 저장하세요. 인식되지 않은 줄은 직접 입력해 주세요.';
  } catch { notice.textContent='사진을 읽지 못했어요. 인터넷 연결과 사진 형식을 확인하거나 단어를 직접 입력해 주세요.'; }
  finally {try{if(worker)await worker.terminate();}finally{busy=false;render();}}
}
render();
