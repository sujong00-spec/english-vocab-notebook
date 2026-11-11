// Keep the storage key so version 1 users are migrated rather than losing progress.
export const KEY = 'vocab-notebook.v1';
export function parseWords(text) {
  return text.normalize('NFKC').split(/\r?\n/).flatMap((raw, index) => {
    const line = raw.replace(/^\s*\d+[.)\s]+/, '').trim();
    // A spaced pipe separates optional metadata; a single pipe can still separate the pair.
    const parts = line.split(/\s*\|\s*/);
    let pair = parts.shift();
    if (!/[가-힣]/.test(pair) && parts.length) pair += ' : ' + parts.shift();
    const match = pair.match(/^([A-Za-z][A-Za-z '\-]*?)\s*(?:[\t:;|–—,]+|\s+-\s+|\s+)\s*((?:\([^)]*\)\s*|\[[^\]]*\]\s*)?[0-9가-힣].*)$/);
    if (!match || !/[가-힣]/.test(match[2]) || parts.length > 2 || /[A-Za-z]/.test([match[2],...parts].join(' '))) return [];
    let korean=match[2].trim(),pos=parts[0]?.trim();
    const prefix=korean.match(/^(?:\(([^)]+)\)|\[([^\]]+)\])\s*(.+)$/);
    const names={'명':'명사','동':'동사','형':'형용사','부':'부사','대':'대명사','전':'전치사','접':'접속사','감':'감탄사','관':'관사'};
    if(prefix){const tag=(prefix[1]||prefix[2]).trim();if(names[tag]||Object.values(names).includes(tag)){pos=pos||names[tag]||tag;korean=prefix[3].trim();}}
    return [{ id: 'w-'+index, english: match[1].trim(), korean, ...(pos?{pos}:{}), ...(parts[1]?.trim()?{note:parts[1].trim()}:{}) }];
  });
}
export const formatWords = words => words.map(w => w.english+' : '+w.korean+(w.pos||w.note?' | '+(w.pos||''):'')+(w.note?' | '+w.note:'')).join('\n');
export function fresh(words = []) { return { version: 3, direction: 'ko-en', words, phase: 'setup', exam: [], index: 0, grades: {}, round: 0, history: [], mode: 'full', startedAt: null }; }
export function updateWords(state, words) {
  const used = new Set();
  return {...state, phase:'setup', exam:[],index:0,grades:{},words:words.map(w=>{
    const old=state.words.find(o=>!used.has(o.id)&&o.english===w.english&&o.korean===w.korean);
    const id=old?.id || crypto.randomUUID();used.add(id);return {...w,id};
  })};
}
export function day(date = new Date()) {
  const d = new Date(date);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export const directionLabel = direction => direction==='en-ko'?'영어 → 한글 뜻 쓰기':'한글 뜻 → 영어 쓰기';
export function stats(state, id, direction = state.direction || 'ko-en') {
  const attempts=state.history.filter(h=>(h.direction||'ko-en')===direction&&h.exam.some(w=>w.id===id)).map(h=>({date:h.finishedAt,correct:h.grades[id]}));
  const last=attempts.at(-1);
  const sinceWrong=attempts.slice(attempts.findLastIndex(a=>!a.correct)+1);
  return {errors:attempts.filter(a=>!a.correct).length, attempts:attempts.length, last:last?.date, correct:last?.correct,
    confirmed:!!last?.correct && new Set(sinceWrong.filter(a=>a.correct).map(a=>day(a.date))).size>=2};
}
export function dueWords(state, now = new Date(), direction = state.direction || 'ko-en') {
  return state.words.filter(w=>{const s=stats(state,w.id,direction);return s.last && day(s.last)<day(now);});
}
export function shuffled(words, random = Math.random) {
  const result=structuredClone(words);
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function start(state, options = false) {
  const o = typeof options==='boolean'?{mode:options?'wrong':'full'}:options;
  const mode=o.mode||'full', now=o.now||new Date();
  const direction=mode==='wrong'?(state.direction||'ko-en'):(o.direction||state.direction||'ko-en');
  if(!['ko-en','en-ko'].includes(direction))throw new Error('시험 방향을 선택해 주세요.');
  if(mode==='wrong' && !state.exam.every(w=>typeof state.grades[w.id]==='boolean'))throw new Error('모든 문항을 채점해 주세요.');
  let exam=mode==='wrong'?state.exam.filter(w=>state.grades[w.id]===false):mode==='due'?dueWords(state,now,direction):state.words;
  if (!exam.length) throw new Error('시험할 단어가 없습니다.');
  exam=exam.map(w=>({...w,originalNumber:w.originalNumber||state.words.findIndex(o=>o.id===w.id)+1}));
  if(o.shuffle)exam=shuffled(exam,o.random);
  return {...state,phase:'exam',exam:structuredClone(exam),index:0,grades:{},round:state.round+1,mode,direction,startedAt:new Date(now).toISOString()};
}
export function advance(state) {
  if (state.phase !== 'exam') return state;
  return state.index+1<state.exam.length?{...state,index:state.index+1}:{...state,phase:'grading'};
}
export function grade(state,id,correct,now=new Date()) {
  if(state.phase!=='grading'||!state.exam.some(w=>w.id===id)||typeof correct!=='boolean')throw new Error('채점할 수 없습니다.');
  const next={...state,grades:{...state.grades,[id]:correct}};
  if(next.exam.every(w=>typeof next.grades[w.id]==='boolean')) {
    const previous=state.history.find(h=>h.round===state.round);
    const record={...(previous?.imported?{imported:true}:{}),round:state.round,mode:state.mode,direction:state.direction,startedAt:state.startedAt,finishedAt:previous?.finishedAt||new Date(now).toISOString(),exam:structuredClone(state.exam),grades:{...next.grades}};
    next.history=[...state.history.filter(h=>h.round!==state.round),record];
  }
  return next;
}
const validWord=w=>w&&typeof w.id==='string'&&typeof w.english==='string'&&!!w.english.trim()&&typeof w.korean==='string'&&!!w.korean.trim()&&['pos','note'].every(k=>w[k]===undefined||typeof w[k]==='string')&&(w.originalNumber===undefined||(Number.isInteger(w.originalNumber)&&w.originalNumber>0));
const wordList=a=>Array.isArray(a)&&a.every(validWord)&&new Set(a.map(w=>w.id)).size===a.length;
const gradeMap=g=>g&&typeof g==='object'&&!Array.isArray(g)&&Object.values(g).every(v=>typeof v==='boolean');
const validDate=d=>typeof d==='string'&&Number.isFinite(Date.parse(d));
export function restore(raw) {
  try {
    const s=JSON.parse(raw);
    if(!s||![1,2,3].includes(s.version)||!['setup','exam','grading'].includes(s.phase)||!wordList(s.words)||!wordList(s.exam)||!Number.isInteger(s.index)||s.index<0||!Number.isInteger(s.round)||s.round<0||!gradeMap(s.grades))return fresh();
    if(s.phase!=='setup'&&(!s.exam.length||s.index>=s.exam.length))return fresh();
    if(s.version===1){
      const migrated={...fresh(),...s,version:3,direction:'ko-en',history:[],mode:'full',startedAt:null};
      // The old format has no timestamps: retain its finished result, marked as imported.
      if(s.round>0&&s.exam.length&&s.exam.every(w=>typeof s.grades[w.id]==='boolean'))migrated.history=[{round:s.round,mode:'full',direction:'ko-en',startedAt:null,finishedAt:new Date().toISOString(),imported:true,exam:structuredClone(s.exam),grades:{...s.grades}}];
      return migrated;
    }
    if(!['full','wrong','due'].includes(s.mode)||!(s.startedAt===null||validDate(s.startedAt))||!Array.isArray(s.history)||!s.history.every(h=>Number.isInteger(h.round)&&h.round>0&&h.round<=s.round&&['full','wrong','due'].includes(h.mode)&&validDate(h.finishedAt)&&wordList(h.exam)&&h.exam.length&&gradeMap(h.grades)&&h.exam.every(w=>typeof h.grades[w.id]==='boolean'))||new Set(s.history.map(h=>h.round)).size!==s.history.length)return fresh();
    if(s.version===3&&(!['ko-en','en-ko'].includes(s.direction)||!s.history.every(h=>['ko-en','en-ko'].includes(h.direction))))return fresh();
    return {...s,version:3,direction:s.direction||'ko-en',history:s.history.map(h=>({...h,direction:h.direction||'ko-en'}))};
  } catch {return fresh();}
}
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(2, 2600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for(let i=0;i<pixels.data.length;i+=4) {
      const gray = Math.max(0, Math.min(255, (pixels.data[i]*.299 + pixels.data[i+1]*.587 + pixels.data[i+2]*.114 - 128)*1.25+128));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;
    }
    ctx.putImageData(pixels,0,0); return canvas;
  } finally { bitmap.close(); }
}
