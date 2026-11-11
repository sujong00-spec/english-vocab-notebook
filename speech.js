// Browser speech is user-triggered; never read a hidden exam answer.
export function createSpeaker({synthesis,Utterance,onStatus=()=>{}}) {
  const supported=!!synthesis&&typeof synthesis.speak==='function'&&typeof synthesis.cancel==='function'&&typeof Utterance==='function';
  let generation=0;
  function stop(){generation++;if(supported){try{synthesis.cancel();}catch{/* Some embedded browsers expose a disabled API. */}}}
  function speak(text){
    stop();
    if(!supported){onStatus('이 브라우저는 발음을 지원하지 않아요. Safari나 Chrome에서 다시 시도해 주세요.');return;}
    const current=generation;
    try{
      const utterance=new Utterance(text);
      const voice=(synthesis.getVoices?.()||[]).find(v=>/^en[-_]/i.test(v.lang));
      utterance.lang=voice?.lang||'en-US';if(voice)utterance.voice=voice;
      utterance.rate=.85;utterance.pitch=1;
      utterance.onerror=event=>{if(current===generation&&!['canceled','interrupted'].includes(event.error))onStatus('발음을 재생하지 못했어요. 기기 음량과 영어 음성 설정을 확인해 주세요.');};
      onStatus('영어 발음을 재생해요.');synthesis.speak(utterance);
    }catch{onStatus('발음을 재생하지 못했어요. 기기 음량과 영어 음성 설정을 확인해 주세요.');}
  }
  return {supported,speak,stop};
}
