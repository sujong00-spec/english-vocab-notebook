import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,parseWords,start,advance,restore,grade,updateWords,formatWords,stats,dueWords} from '../core.js';
const words=parseWords('1. apple 사과\n2) take care of : 돌보다\nfriend\t친구');
test('OCR numbered rows, phrases, separators and CRLF',()=>{
 assert.equal(words.length,3);assert.equal(words[1].english,'take care of');
 assert.equal(parseWords('apple - 사과\r\nschool | 학교\r\nwrong line').length,2);
 assert.equal(parseWords('ａｐｐｌｅ：사과')[0].english,'apple');
 assert.equal(parseWords('school ; 학교')[0].korean,'학교');
});
test('answers unlock only after last question',()=>{
 let s=start(fresh(words));s=advance(s);assert.equal(s.phase,'exam');s=advance(s);assert.equal(s.phase,'exam');s=advance(s);assert.equal(s.phase,'grading');
});
test('refresh restores question, frozen words, round and partial grades',()=>{
 let s=advance(start(fresh(words)));assert.deepEqual(restore(JSON.stringify(s)),s);
 s=advance(advance(s));s.grades[words[0].id]=false;assert.deepEqual(restore(JSON.stringify(s)),s);
});
test('wrong-only rounds retain order and reset grading',()=>{
 let s=start(fresh(words));s.phase='grading';s.grades={[words[0].id]:true,[words[1].id]:false,[words[2].id]:false};
 s=start(s,true);assert.deepEqual(s.exam.map(w=>w.id),words.slice(1).map(w=>w.id));assert.deepEqual(s.grades,{});assert.equal(s.round,2);
 s.phase='grading';s.grades={[words[1].id]:true,[words[2].id]:false};s=start(s,true);assert.deepEqual(s.exam.map(w=>w.id),[words[2].id]);
});
test('corrupt or unsupported storage safely resets',()=>{
 for(const raw of ['{','null','{}',JSON.stringify({...start(fresh(words)),index:999}),JSON.stringify({...fresh(),version:9}),JSON.stringify({...fresh(),grades:[]})])assert.deepEqual(restore(raw),fresh());
});
test('empty exams rejected and snapshots isolated',()=>{
 assert.throws(()=>start(fresh()));const s=fresh(words);const exam=start(s);s.words[0].korean='변경';assert.equal(exam.exam[0].korean,'사과');
});
const pair=parseWords('see : 보다 | 동사 | 눈으로 보이다\nwatch : 보다 | 동사 | 주의 깊게 보다');
function complete(s,answers,now){while(s.phase==='exam')s=advance(s);for(const [i,w]of s.exam.entries())s=grade(s,w.id,answers[i],now);return s;}
test('metadata round trips and English answers never enter question fields',()=>{
 assert.equal(pair[0].note,'눈으로 보이다');assert.equal(pair[1].pos,'동사');
 assert.equal(formatWords(parseWords(formatWords(pair))),formatWords(pair));
 assert.equal(parseWords('see : 보다 | 동사 | see를 쓰세요').length,0);
 assert.equal(formatWords(parseWords('see : 보다 |  | 눈으로 보이다')),'see : 보다 |  | 눈으로 보이다');
});
test('completed results survive retry, regrading updates once and editing preserves identity',()=>{
 let s=complete(start(fresh(pair)),[true,false]);assert.equal(s.history.length,1);
 s=grade(s,pair[1].id,true);assert.equal(s.history.length,1);assert.equal(stats(s,pair[1].id).errors,0);
 s=grade(s,pair[1].id,false);s=start(s,true);assert.equal(s.history.length,1);assert.equal(s.exam[0].originalNumber,2);
 s=complete(s,[true]);assert.equal(s.history.length,2);assert.equal(stats(s,pair[1].id).errors,1);
 s=updateWords(s,parseWords('see : 보다 | 동사 | 새 설명\nwatch : 보다 | 동사 | 주의 깊게 보다\nlook : 보다'));
 assert.equal(s.words[1].id,pair[1].id);assert.equal(s.history.length,2);assert.notEqual(s.words[2].id,pair[0].id);
 assert.deepEqual(restore(JSON.stringify(s)),s);
});
test('daily review is based on local calendar, same-day success is not confirmation',()=>{
 const today=new Date(2026,4,10,23,59),tomorrow=new Date(2026,4,11,0,1);
 let s=complete(start(fresh(pair),{now:today}),[true,false],today);
 assert.equal(dueWords(s,today).length,0);assert.equal(dueWords(s,tomorrow).length,2);
 s=complete(start(s,{mode:'wrong',now:today}),[true],today);
 assert.equal(stats(s,pair[1].id).confirmed,false);
 s=complete(start(s,{mode:'due',now:tomorrow}),[true,true],tomorrow);
 assert.equal(stats(s,pair[1].id).confirmed,true);assert.equal(dueWords(s,tomorrow).length,0);
 s=complete(start(s,{now:tomorrow}),[true,false],tomorrow);assert.equal(stats(s,pair[1].id).confirmed,false);
});
test('shuffle retains snapshot order on refresh and original numbering',()=>{
 const s=start(fresh(pair),{shuffle:true,random:()=>0});assert.equal(s.exam[0].id,pair[1].id);assert.equal(s.exam[0].originalNumber,2);
 assert.deepEqual(restore(JSON.stringify(s)).exam,s.exam);assert.equal(pair[0].english,'see');
});
test('v1 migration retains unfinished exam and partial grades',()=>{
 const legacy={version:1,words:pair,phase:'grading',exam:pair,index:1,grades:{[pair[0].id]:true},round:1};
 const migrated=restore(JSON.stringify(legacy));assert.equal(migrated.version,2);assert.deepEqual(migrated.grades,legacy.grades);
 const s=grade(migrated,pair[1].id,false);assert.equal(s.history.length,1);assert.deepEqual(restore(JSON.stringify(s)),s);
});
test('incomplete grading cannot start wrong-only round and corrupted history rejected',()=>{
 assert.throws(()=>start(start(fresh(pair)),true));
 const s=complete(start(fresh(pair)),[true,false]);s.history[0].finishedAt='not a date';assert.deepEqual(restore(JSON.stringify(s)),fresh());
});

test('printed part-of-speech prefixes and numeric Korean meanings are retained',()=>{
 const w=parseWords('see : (동) 보다\nMarch : 3월\napple [명사] 사과');
 assert.equal(w.length,3);assert.equal(w[0].pos,'동사');assert.equal(w[0].korean,'보다');assert.equal(w[1].korean,'3월');assert.equal(w[2].pos,'명사');
 assert.equal(parseWords('item : 123').length,0);
});
test('legacy completed exam retained without inventing a historical test date',()=>{
 const legacy={version:1,words:pair,phase:'grading',exam:pair,index:1,grades:{[pair[0].id]:true,[pair[1].id]:false},round:1};
 let s=restore(JSON.stringify(legacy));assert.equal(s.history.length,1);assert.equal(s.history[0].imported,true);
 s=start(s,true);assert.equal(s.history[0].grades[pair[1].id],false);assert.equal(s.history.length,1);
});
