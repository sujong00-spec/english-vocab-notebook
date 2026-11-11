const panel=document.querySelector('#install-panel'),button=document.querySelector('#install-app'),status=document.querySelector('#offline-status');
let pendingInstall;
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(installed())panel.hidden=true;
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();pendingInstall=event;
 if(!installed())button.hidden=false;
});
button.addEventListener('click',async()=>{
 if(!pendingInstall)return;
 const prompt=pendingInstall;pendingInstall=null;button.disabled=true;
 try{
  await prompt.prompt();const choice=await prompt.userChoice;
  status.textContent=choice.outcome==='accepted'?'설치가 진행돼요. 홈 화면이나 앱 목록에서 열어 주세요.':'설치를 취소했어요. 크롬 메뉴에서도 설치할 수 있어요.';
 }catch{status.textContent='브라우저 메뉴의 앱 설치 또는 홈 화면에 추가를 이용해 주세요.';}
 finally{button.disabled=false;button.hidden=true;}
});
window.addEventListener('appinstalled',()=>{pendingInstall=null;panel.hidden=true;});
if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async registration=>{
  const updateReady=()=>{status.textContent='새 버전이 준비됐어요. 시험을 마친 뒤 이 사이트의 모든 창과 설치 앱을 닫고 다시 열면 적용돼요.';};
  if(registration.waiting)updateReady();
  registration.addEventListener('updatefound',()=>{
   const worker=registration.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)updateReady();});
  });
  await navigator.serviceWorker.ready;
  if(!registration.waiting)status.textContent='기본 시험·채점은 오프라인에서도 사용할 수 있어요. 사진 OCR과 일부 발음은 인터넷이 필요해요.';
 }).catch(()=>{status.textContent='오프라인 준비를 마치지 못했어요. 인터넷에 연결해 다시 열어 주세요. 지금은 온라인으로 사용할 수 있어요.';});
}else{status.textContent='크롬이나 Safari에서 HTTPS 주소로 열면 설치·오프라인 기능을 이용할 수 있어요.';}
