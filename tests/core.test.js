import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,parseWords,start,advance,restore} from '../core.js';
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
 s=start(s,true);assert.deepEqual(s.exam,words.slice(1));assert.deepEqual(s.grades,{});assert.equal(s.round,2);
 s.phase='grading';s.grades={[words[1].id]:true,[words[2].id]:false};s=start(s,true);assert.deepEqual(s.exam,[words[2]]);
});
test('corrupt or unsupported storage safely resets',()=>{
 for(const raw of ['{','null','{}',JSON.stringify({...start(fresh(words)),index:999}),JSON.stringify({...fresh(),version:9}),JSON.stringify({...fresh(),grades:[]})])assert.deepEqual(restore(raw),fresh());
});
test('empty exams rejected and snapshots isolated',()=>{
 assert.throws(()=>start(fresh()));const s=fresh(words);const exam=start(s);s.words[0].korean='변경';assert.equal(exam.exam[0].korean,'사과');
});
